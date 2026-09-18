/* Garde-fou transversal sur les feuilles de style des outils.
   Ces règles ont déjà été enfreintes une fois : ce test empêche la récidive. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..', 'outils');
const outils = existsSync(RACINE)
  ? readdirSync(RACINE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

test('au moins un outil existe', () => {
  assert.ok(outils.length >= 1);
});

test('chaque outil neutralise display: face à l\'attribut hidden', () => {
  for (const nom of outils) {
    const dir = path.join(RACINE, nom);
    const css = readdirSync(dir).filter((f) => f.endsWith('.css'));
    assert.ok(css.length >= 1, `${nom} : aucune feuille de style`);
    for (const f of css) {
      const s = readFileSync(path.join(dir, f), 'utf8');
      assert.match(s, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
        `${nom}/${f} : sans cette règle, une section « hidden » reste visible`);
    }
  }
});

test('chaque outil déclare ses couleurs pour les deux thèmes', () => {
  for (const nom of outils) {
    const dir = path.join(RACINE, nom);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.css'))) {
      const s = readFileSync(path.join(dir, f), 'utf8');
      assert.match(s, /:root\[data-theme="light"\]/, `${nom}/${f} : thème clair manquant`);
      assert.match(s, /prefers-color-scheme: light/, `${nom}/${f} : thème système non pris en compte`);
      assert.match(s, /prefers-reduced-motion/, `${nom}/${f} : animations réduites non prises en compte`);
    }
  }
});

test('chaque outil a les balises indispensables et aucune ressource externe', () => {
  for (const nom of outils) {
    const p = path.join(RACINE, nom, 'index.html');
    assert.ok(existsSync(p), `${nom} : index.html manquant`);
    const h = readFileSync(p, 'utf8');
    assert.match(h, /<title>[^<]{10,}<\/title>/, `${nom} : titre absent ou trop court`);
    assert.match(h, /<meta name="description" content="[^"]{50,}"/, `${nom} : description absente ou trop courte`);
    assert.match(h, /<link rel="canonical"/, `${nom} : lien canonique absent`);
    assert.match(h, /<html lang="fr"/, `${nom} : langue non déclarée`);
    /* aucune ressource chargée depuis l'extérieur */
    const externes = h.match(/(?:src|href)="https?:\/\/[^"]+"/g) || [];
    for (const e of externes) {
      assert.ok(/github\.com|p5wmt65pvz-wq\.github\.io/.test(e),
        `${nom} : ressource externe interdite → ${e}`);
      assert.ok(!/<(?:script|link rel="stylesheet")[^>]*https?:/.test(h),
        `${nom} : script ou style chargé depuis l'extérieur`);
    }
  }
});

test('chaque outil est listé dans le sitemap', () => {
  const sm = readFileSync(path.resolve(import.meta.dirname, '..', 'sitemap.xml'), 'utf8');
  for (const nom of outils) {
    assert.ok(sm.includes(`/outils/${nom}/`), `${nom} : absent du sitemap.xml`);
  }
});
