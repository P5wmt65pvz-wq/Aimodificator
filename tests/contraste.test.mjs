/* Le contraste des textes se dégrade sans bruit : celui qui choisit la
   couleur la voit très bien sur son écran. Ce test mesure, il ne juge pas à
   l'œil.

   Il est né d'un relevé réel : dix-huit textes du site étaient sous la norme,
   dont « révélateur » à 2,52:1 et la pastille « Faible » à 2,64:1. La cause
   profonde n'était pas une couleur mal choisie, c'était qu'une même couleur
   servait de fond ET de texte, et que les sept feuilles de style avaient
   divergé sans que rien ne le signale. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = path.resolve(import.meta.dirname, '..');

/* Toutes les feuilles qui déclarent la palette. Une feuille ajoutée plus tard
   est prise en compte sans toucher à ce fichier. */
function feuilles() {
  const out = [];
  const outils = path.join(BASE, 'outils');
  if (existsSync(outils)) {
    for (const d of readdirSync(outils, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of readdirSync(path.join(outils, d.name))) {
        if (f.endsWith('.css')) out.push(path.join('outils', d.name, f));
      }
    }
  }
  for (const rel of ['assets/css/app.css', 'exemples/exemples.css']) {
    if (existsSync(path.join(BASE, rel))) out.push(rel);
  }
  return out.filter((f) => readFileSync(path.join(BASE, f), 'utf8').includes('--muted:'));
}

/* Les jetons d'un bloc :root, dans l'ordre où ils sont déclarés. */
function jetons(css, selecteur) {
  const i = css.indexOf(selecteur + ' {');
  if (i === -1) return null;
  const j = css.indexOf('\n}', i);
  const bloc = css.slice(i, j);
  const out = {};
  for (const m of bloc.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const s = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
function contraste(a, b) {
  const l1 = lum(rgb(a)), l2 = lum(rgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/* Une pastille pose sa propre couleur à 12 % sur la surface : le fond réel
   est donc plus proche du texte que la surface nue, et le contraste baisse. */
function teinte(couleur, fond, part = 0.12) {
  const c = rgb(couleur), f = rgb(fond);
  const m = c.map((v, i) => Math.round(v * part + f[i] * (1 - part)));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const AA = 4.5;
const ENCRES = ['--good-ink', '--warning-ink', '--serious-ink', '--critical-ink'];
const FONDS = ['--bg', '--surface', '--surface-2'];

for (const f of feuilles()) {
  const css = readFileSync(path.join(BASE, f), 'utf8');

  test(`${f} : les encres sont lisibles sur tous les fonds, thème sombre`, () => {
    const t = jetons(css, ':root');
    assert.ok(t, 'bloc :root introuvable');
    for (const encre of ENCRES) {
      assert.ok(t[encre], `${encre} manquant — une encre non déclarée retombe sur une couleur de fond`);
      for (const fond of FONDS) {
        if (!t[fond]) continue;
        const nu = contraste(t[encre], t[fond]);
        const sur = contraste(t[encre], teinte(t[encre], t[fond]));
        assert.ok(nu >= AA, `${encre} sur ${fond} : ${nu.toFixed(2)}:1, il en faut ${AA}`);
        assert.ok(sur >= AA, `${encre} sur sa pastille ${fond} : ${sur.toFixed(2)}:1, il en faut ${AA}`);
      }
    }
  });

  test(`${f} : les encres sont lisibles sur tous les fonds, thème clair`, () => {
    const t = jetons(css, ':root[data-theme="light"]');
    assert.ok(t, 'bloc de thème clair introuvable');
    const sombre = jetons(css, ':root');
    for (const encre of ENCRES) {
      assert.ok(t[encre], `${encre} n’est pas redéfini en thème clair — il garderait la valeur du thème sombre`);
      for (const fond of FONDS) {
        const valeurFond = t[fond] || sombre[fond];
        if (!valeurFond) continue;
        const nu = contraste(t[encre], valeurFond);
        const sur = contraste(t[encre], teinte(t[encre], valeurFond));
        assert.ok(nu >= AA, `${encre} sur ${fond} : ${nu.toFixed(2)}:1, il en faut ${AA}`);
        assert.ok(sur >= AA, `${encre} sur sa pastille ${fond} : ${sur.toFixed(2)}:1, il en faut ${AA}`);
      }
    }
  });

  test(`${f} : les textes secondaires restent lisibles`, () => {
    for (const sel of [':root', ':root[data-theme="light"]']) {
      const t = jetons(css, sel);
      if (!t) continue;
      const base = sel === ':root' ? t : { ...jetons(css, ':root'), ...t };
      for (const cle of ['--text', '--text-2', '--muted']) {
        if (!base[cle]) continue;
        for (const fond of FONDS) {
          if (!base[fond]) continue;
          const r = contraste(base[cle], base[fond]);
          assert.ok(r >= AA, `${sel} ${cle} sur ${fond} : ${r.toFixed(2)}:1, il en faut ${AA}`);
        }
      }
    }
  });
}

test('les encres sont identiques dans toutes les feuilles', () => {
  /* Les encres encodent une décision d'accessibilité MESURÉE : une valeur qui
     diverge d'une feuille à l'autre est toujours une erreur de recopie, jamais
     un choix. Le reste de la palette peut légitimement varier — app.css garde
     volontairement une palette d'état commune aux deux thèmes, et le dit —
     et chaque feuille est de toute façon mesurée séparément plus haut.

     Ce contrôle existe parce que la divergence est indétectable à la lecture :
     --muted avait dérivé dans une seule feuille sur sept, et cette feuille-là
     seule tombait à 4,08:1. */
  const par = {};
  for (const f of feuilles()) {
    const css = readFileSync(path.join(BASE, f), 'utf8');
    for (const sel of [':root', ':root[data-theme="light"]']) {
      const t = jetons(css, sel);
      if (!t) continue;
      for (const encre of ENCRES) {
        if (!t[encre]) continue;
        const id = `${sel} ${encre}`;
        (par[id] ||= {});
        (par[id][t[encre]] ||= []).push(f);
      }
    }
  }
  assert.ok(Object.keys(par).length >= ENCRES.length, 'aucune encre trouvée : le contrôle ne vérifierait rien');
  const ecarts = [];
  for (const [id, valeurs] of Object.entries(par)) {
    if (Object.keys(valeurs).length > 1) {
      ecarts.push(`${id} → ` + Object.entries(valeurs)
        .map(([v, fs]) => `${v} dans ${fs.join(', ')}`).join('  vs  '));
    }
  }
  assert.deepEqual(ecarts, [], 'encres incohérentes entre feuilles :\n  ' + ecarts.join('\n  '));
});

test('une pastille de verdict ne porte jamais de texte blanc sur fond clair', () => {
  /* Texte blanc sur orange valait 2,64:1 et sur vert 2,54:1. Ces fonds-là
     exigent une encre sombre, comme la pastille ambre l'avait déjà. */
  const p = path.join(BASE, 'outils/passe/passe.css');
  if (!existsSync(p)) return;
  const css = readFileSync(p, 'utf8');
  const t = jetons(css, ':root');
  const clair = { ...t, ...jetons(css, ':root[data-theme="light"]') };

  const FONDS_PASTILLE = { n0: '--critical', n1: '--serious', n2: '--warning', n3: '--good', n4: '--accent' };
  /* L'encre sombre déclarée par la feuille, et les pastilles qui l'utilisent. */
  const m = css.match(/((?:\.verdict\.n\d,?\s*)+)\{\s*color:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(m, 'règle d’encre sombre des pastilles introuvable');
  const encreSombre = m[2].toLowerCase();
  const avecEncreSombre = new Set([...m[1].matchAll(/n(\d)/g)].map((x) => 'n' + x[1]));

  for (const [niveau, jeton] of Object.entries(FONDS_PASTILLE)) {
    for (const [nomTheme, palette] of [['sombre', t], ['clair', clair]]) {
      const fond = palette[jeton];
      if (!fond) continue;
      const encre = avecEncreSombre.has(niveau) ? encreSombre
        : (jeton === '--accent' ? (palette['--accent-ink'] || '#ffffff') : '#ffffff');
      const r = contraste(encre, fond);
      assert.ok(r >= AA, `pastille ${niveau} (${jeton}) en thème ${nomTheme} : encre ${encre} sur ${fond} = ${r.toFixed(2)}:1, il en faut ${AA}`);
    }
  }
});
