/* Adaptation à l'écran et au texte grossi.
   `npm test` tourne sans navigateur : ces contrôles portent donc sur les
   règles écrites, pas sur le rendu. Ils ne remplacent pas la mesure dans
   Chromium, ils empêchent qu'on retire en silence une règle dont on a oublié
   pourquoi elle était là.

   Chacune vient d'un débordement réellement mesuré à 390 px avec le texte
   doublé — la situation de quelqu'un qui a grossi les caractères de son
   téléphone pour lire plus confortablement. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = path.resolve(import.meta.dirname, '..');

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

const lire = (f) => readFileSync(path.join(BASE, f), 'utf8');
/* Le corps de la première règle portant exactement ce sélecteur. */
function regle(css, selecteur) {
  const m = css.match(new RegExp('^' + selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'm'));
  return m ? m[1] : null;
}

test('toutes les feuilles savent couper un mot trop long', () => {
  /* Sans cette règle, un titre à 200 % poussait la page 81 px hors écran. */
  for (const f of feuilles()) {
    assert.match(lire(f), /overflow-wrap:\s*break-word/,
      `${f} : aucune règle de coupure — un mot long fera déborder la page`);
  }
});

test('les rangées de l’en-tête passent à la ligne', () => {
  /* Un texte doublé ne rétrécit pas la fenêtre : les seuils en pixels ne se
     déclenchent pas, et une rangée rigide sort de l'écran. */
  for (const f of feuilles()) {
    const css = lire(f);
    for (const sel of ['.site-header', '.header-tools', '.site-nav']) {
      const r = regle(css, sel);
      if (r === null) continue;
      assert.match(r, /flex-wrap:\s*wrap/, `${f} ${sel} : ne passe pas à la ligne`);
    }
  }
});

test('une pastille de carte ne peut pas déborder de sa carte', () => {
  /* « flex: none » empêchait la pastille de rétrécir : à texte doublé elle
     sortait de 104 px. Il lui faut les deux — pouvoir passer à la ligne, et
     ne jamais dépasser la largeur disponible. */
  for (const f of feuilles()) {
    const css = lire(f);
    if (!/^\.tag\s*\{/m.test(css)) continue;
    const tag = regle(css, '.tag');
    const haut = regle(css, '.card-top');
    assert.ok(/max-width:\s*100%/.test(css.slice(css.indexOf('.tag'))) || /max-width:\s*100%/.test(tag || ''),
      `${f} .tag : rien ne borne sa largeur`);
    if (haut !== null) {
      assert.match(css, /\.card-top\s*\{[^}]*flex-wrap:\s*wrap|\.card-top\s*\{\s*flex-wrap:\s*wrap/,
        `${f} .card-top : la pastille ne peut pas descendre d’une ligne`);
    }
  }
});

test('une grille d’une colonne reste bornée à son conteneur', () => {
  /* Une colonne « auto » se dimensionne sur son contenu. À texte doublé,
     .steps passait à 391 px dans un cadre de 358 — et aucun mot ne faisait
     plus de 130 px : c'était la grille, pas le texte. */
  for (const f of feuilles()) {
    const css = lire(f);
    const r = regle(css, '.steps');
    if (r === null) continue;
    if (!/display:\s*grid/.test(r)) continue;
    assert.match(r, /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
      `${f} .steps : colonne non bornée, elle s’élargira au-delà du cadre`);
  }
});

test('la césure est désactivée là où elle changerait le sens', () => {
  /* Couper un mot de passe, une adresse ou un bout de code avec un trait
     d'union le rendrait faux à la lecture et à la recopie. */
  for (const f of feuilles()) {
    const css = lire(f);
    if (!/hyphens:\s*auto/.test(css)) continue;
    assert.match(css, /hyphens:\s*none/,
      `${f} : la césure est activée sans exception pour le code et les champs`);
    const i = css.search(/hyphens:\s*none/);
    const contexte = css.slice(Math.max(0, i - 400), i);
    for (const sel of ['code', 'pre', 'input', 'textarea']) {
      assert.ok(contexte.includes(sel), `${f} : ${sel} n’est pas exempté de césure`);
    }
  }
});

test('aucune feuille ne fixe une largeur en pixels sur un conteneur de page', () => {
  /* Une largeur figée ne se plie ni à un petit écran ni à un texte grossi.
     Les maxima en ch ou en rem, eux, suivent la taille du texte. */
  const fautes = [];
  for (const f of feuilles()) {
    const css = lire(f);
    for (const m of css.matchAll(/^([^{@\n][^{\n]*)\{([^}]*)\}/gm)) {
      const sel = m[1].trim(), corps = m[2];
      if (/^(html|body|main|\.wrap|\.container|section|article)\b/.test(sel)) {
        const w = corps.match(/(?<!max-|min-)width:\s*(\d{3,})px/);
        if (w) fautes.push(`${f} « ${sel} » width: ${w[1]}px`);
      }
    }
  }
  assert.deepEqual(fautes, [], 'largeur figée sur un conteneur :\n  ' + fautes.join('\n  '));
});
