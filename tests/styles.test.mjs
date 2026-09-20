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
  { nom: 'outils', dossiers: true, lang: 'fr', depuisAccueil: true },
  { nom: 'exemples', dossiers: false, lang: 'fr', depuisAccueil: true },
  /* Les pages anglaises ne sont pas listées dans la navigation de l'accueil :
     elles sont atteintes depuis leur équivalent français, et déclarées à
     Google par les balises hreflang. */
  { nom: 'en', dossiers: true, lang: 'en', depuisAccueil: false }
];

/* Renvoie [{ id, dir, url }] pour toutes les pages surveillées. */
function pages() {
  const out = [];
  for (const s of SECTIONS) {
    const racine = path.join(BASE, s.nom);
    if (!existsSync(racine)) continue;
    if (s.dossiers) {
      for (const d of readdirSync(racine, { withFileTypes: true })) {
        if (d.isDirectory()) out.push({ id: `${s.nom}/${d.name}`, dir: path.join(racine, d.name), url: `/${s.nom}/${d.name}/`, lang: s.lang, depuisAccueil: s.depuisAccueil });
      }
    } else {
      out.push({ id: s.nom, dir: racine, url: `/${s.nom}/`, lang: s.lang, depuisAccueil: s.depuisAccueil });
    }
  }
  return out;
}

const PAGES = pages();
const html = (p) => readFileSync(path.join(p.dir, 'index.html'), 'utf8');

/* On vérifie les feuilles que la page charge vraiment, pas celles qui
   traînent dans son dossier : une page peut légitimement partager la feuille
   d'une autre, comme le fait la version anglaise d'Empreinte. */
const feuilles = (p) => [...html(p).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
  .map((m) => path.resolve(p.dir, m[1]));

test('les deux sections surveillées contiennent des pages', () => {
  assert.ok(PAGES.length >= 2, `pages trouvées : ${PAGES.map((p) => p.id).join(', ')}`);
  for (const s of SECTIONS) {
    assert.ok(PAGES.some((p) => p.id.startsWith(s.nom)), `section ${s.nom} vide ou absente`);
  }
});

test('chaque page neutralise display: face à l\'attribut hidden', () => {
  for (const p of PAGES) {
    const css = feuilles(p);
    assert.ok(css.length >= 1, `${p.id} : aucune feuille de style chargée`);
    for (const f of css) {
      assert.ok(existsSync(f), `${p.id} : feuille introuvable — ${f}`);
      const s = readFileSync(f, 'utf8');
      assert.match(s, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
        `${p.id}/${f} : sans cette règle, une section « hidden » reste visible`);
    }
  }
});

test('chaque page déclare ses couleurs pour les deux thèmes', () => {
  for (const p of PAGES) {
    for (const f of feuilles(p)) {
      const s = readFileSync(f, 'utf8');
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
    assert.match(h, new RegExp(`<html lang="${p.lang}"`), `${p.id} : langue non déclarée ou incorrecte`);
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

test('chaque page française est atteignable depuis l\'accueil', () => {
  const accueil = readFileSync(path.join(BASE, 'index.html'), 'utf8');
  for (const p of PAGES.filter((x) => x.depuisAccueil)) {
    const rel = p.url.replace(/^\//, '');
    assert.ok(accueil.includes(`href="${rel}"`), `${p.id} : aucun lien depuis l'accueil`);
  }
});

test('chaque page traduite se déclare et pointe vers son équivalent', () => {
  for (const p of PAGES.filter((x) => !x.depuisAccueil)) {
    const h = html(p);
    assert.match(h, /rel="alternate" hreflang="fr"/, `${p.id} : hreflang français absent`);
    assert.match(h, /rel="alternate" hreflang="en"/, `${p.id} : hreflang anglais absent`);
    assert.match(h, /hreflang="x-default"/, `${p.id} : hreflang x-default absent`);
    /* et la page d'origine doit pointer en retour, sinon le lien est à sens unique */
    const cible = h.match(/rel="alternate" hreflang="fr" href="[^"]*\/Aimodificator(\/[^"]*)"/);
    assert.ok(cible, `${p.id} : impossible de retrouver la page d'origine`);
    const origine = PAGES.find((x) => x.url === cible[1]);
    assert.ok(origine, `${p.id} : la page d'origine ${cible[1]} n'existe pas`);
    assert.ok(html(origine).includes(p.url.replace(/^\//, '')) || html(origine).includes('../..' + p.url),
      `${origine.id} : ne renvoie pas vers sa version ${p.lang}`);
  }
});

test('la vérification Google Search Console est en place sur l\'accueil', () => {
  /* Sans cette balise, la propriété se dé-vérifie : Google cesse de remonter
     les erreurs d'indexation et le sitemap n'est plus suivi. Elle doit rester
     sur la page racine, qui est l'adresse déclarée comme propriété. */
  const accueil = readFileSync(path.join(BASE, 'index.html'), 'utf8');
  const m = accueil.match(/<meta name="google-site-verification" content="([^"]+)"/);
  assert.ok(m, 'balise de vérification absente de index.html');
  assert.ok(m[1].length >= 20, `jeton de vérification suspect : « ${m[1]} »`);
  assert.doesNotMatch(m[1], /^(XXX|TODO|votre|your)/i, 'jeton d\'exemple laissé en place');
});
