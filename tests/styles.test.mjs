/* Garde-fou transversal sur les pages secondaires du site.
   Ces règles ont déjà été enfreintes une fois : ce test empêche la récidive.
   Il couvre outils/ et exemples/ — toute page ajoutée sous l'une de ces
   racines est vérifiée automatiquement, sans modifier ce fichier. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = path.resolve(import.meta.dirname, '..');

/* Une « section » regroupe des pages qui suivent la même convention.
   `dossiers: true` → chaque sous-dossier est une page (outils/<nom>/).
   `dossiers: false` → la racine est elle-même la page (exemples/). */
const SECTIONS = [
  { nom: 'outils', dossiers: true },
  { nom: 'exemples', dossiers: false }
];

/* Renvoie [{ id, dir, url }] pour toutes les pages surveillées. */
function pages() {
  const out = [];
  for (const s of SECTIONS) {
    const racine = path.join(BASE, s.nom);
    if (!existsSync(racine)) continue;
    if (s.dossiers) {
      for (const d of readdirSync(racine, { withFileTypes: true })) {
        if (d.isDirectory()) out.push({ id: `${s.nom}/${d.name}`, dir: path.join(racine, d.name), url: `/${s.nom}/${d.name}/` });
      }
    } else {
      out.push({ id: s.nom, dir: racine, url: `/${s.nom}/` });
    }
  }
  return out;
}

const PAGES = pages();
const feuilles = (p) => readdirSync(p.dir).filter((f) => f.endsWith('.css'));
const html = (p) => readFileSync(path.join(p.dir, 'index.html'), 'utf8');

test('les deux sections surveillées contiennent des pages', () => {
  assert.ok(PAGES.length >= 2, `pages trouvées : ${PAGES.map((p) => p.id).join(', ')}`);
  for (const s of SECTIONS) {
    assert.ok(PAGES.some((p) => p.id.startsWith(s.nom)), `section ${s.nom} vide ou absente`);
  }
});

test('chaque page neutralise display: face à l\'attribut hidden', () => {
  for (const p of PAGES) {
    const css = feuilles(p);
    assert.ok(css.length >= 1, `${p.id} : aucune feuille de style`);
    for (const f of css) {
      const s = readFileSync(path.join(p.dir, f), 'utf8');
      assert.match(s, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
        `${p.id}/${f} : sans cette règle, une section « hidden » reste visible`);
    }
  }
});

test('chaque page déclare ses couleurs pour les deux thèmes', () => {
  for (const p of PAGES) {
    for (const f of feuilles(p)) {
      const s = readFileSync(path.join(p.dir, f), 'utf8');
      assert.match(s, /:root\[data-theme="light"\]/, `${p.id}/${f} : thème clair manquant`);
      assert.match(s, /prefers-color-scheme: light/, `${p.id}/${f} : thème système non pris en compte`);
      assert.match(s, /prefers-reduced-motion/, `${p.id}/${f} : animations réduites non prises en compte`);
    }
  }
});

test('chaque page a les balises indispensables et aucune ressource externe', () => {
  for (const p of PAGES) {
    assert.ok(existsSync(path.join(p.dir, 'index.html')), `${p.id} : index.html manquant`);
    const h = html(p);
    assert.match(h, /<title>[^<]{10,}<\/title>/, `${p.id} : titre absent ou trop court`);
    assert.match(h, /<meta name="description" content="[^"]{50,}"/, `${p.id} : description absente ou trop courte`);
    assert.match(h, /<link rel="canonical"/, `${p.id} : lien canonique absent`);
    assert.match(h, /<html lang="fr"/, `${p.id} : langue non déclarée`);
    for (const e of h.match(/(?:src|href)="https?:\/\/[^"]+"/g) || []) {
      assert.ok(/github\.com|p5wmt65pvz-wq\.github\.io/.test(e), `${p.id} : ressource externe interdite → ${e}`);
    }
    assert.doesNotMatch(h, /<(?:script|link rel="stylesheet")[^>]*="https?:/,
      `${p.id} : script ou style chargé depuis l'extérieur`);
  }
});

test('chaque page a un titre et une description qui lui sont propres', () => {
  const vus = new Map();
  for (const p of PAGES) {
    const h = html(p);
    for (const [quoi, re] of [['titre', /<title>([^<]+)<\/title>/],
                              ['description', /<meta name="description" content="([^"]+)"/]]) {
      const v = h.match(re)[1].trim();
      const cle = quoi + '::' + v;
      assert.ok(!vus.has(cle), `${p.id} partage son ${quoi} avec ${vus.get(cle)}`);
      vus.set(cle, p.id);
    }
  }
});

test('chaque page est listée dans le sitemap', () => {
  const sm = readFileSync(path.join(BASE, 'sitemap.xml'), 'utf8');
  for (const p of PAGES) assert.ok(sm.includes(p.url), `${p.id} : absent du sitemap.xml`);
});

test('chaque page est atteignable depuis l\'accueil', () => {
  const accueil = readFileSync(path.join(BASE, 'index.html'), 'utf8');
  for (const p of PAGES) {
    const rel = p.url.replace(/^\//, '');
    assert.ok(accueil.includes(`href="${rel}"`), `${p.id} : aucun lien depuis l'accueil`);
  }
});
