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

/* Domaines vers lesquels une page peut poser un lien cliquable. Le dépôt
   lui-même, et les sources officielles qu'une page de contenu doit pouvoir
   citer. Rien d'autre : pas de blog, pas d'agrégateur, pas de source qui
   pourrait disparaître ou changer d'avis. */
const LIENS_SORTANTS_AUTORISES =
  /^https:\/\/(?:github\.com\/|p5wmt65pvz-wq\.github\.io\/|www\.cnil\.fr\/|www\.service-public\.fr\/|entreprendre\.service-public\.fr\/|www\.legifrance\.gouv\.fr\/)/;

test('chaque page a les balises indispensables et aucune ressource externe', () => {
  for (const p of PAGES) {
    assert.ok(existsSync(path.join(p.dir, 'index.html')), `${p.id} : index.html manquant`);
    const h = html(p);
    assert.match(h, /<title>[^<]{10,}<\/title>/, `${p.id} : titre absent ou trop court`);
    assert.match(h, /<meta name="description" content="[^"]{50,}"/, `${p.id} : description absente ou trop courte`);
    assert.match(h, /<link rel="canonical"/, `${p.id} : lien canonique absent`);
    assert.match(h, new RegExp(`<html lang="${p.lang}"`), `${p.id} : langue non déclarée ou incorrecte`);
    /* Une RESSOURCE externe est chargée par la page : elle déclenche une requête
       réseau, ce que la règle 3 du dépôt interdit. Aucune exception. */
    for (const e of h.match(/src="https?:\/\/[^"]+"/g) || []) {
      assert.ok(/github\.com|p5wmt65pvz-wq\.github\.io/.test(e), `${p.id} : ressource externe interdite → ${e}`);
    }
    /* Un LIEN sortant ne charge rien : il attend un clic, donc il ne viole pas la
       règle 3. Il faut pouvoir en poser, sinon aucune source n'est citable et la
       règle « aucune page de contenu sans source citable » (DISTRIBUTION.md)
       devient intenable. La liste reste courte et volontairement composée de
       sources officielles ou du dépôt lui-même : l'élargir est une décision, pas
       une commodité. */
    for (const e of h.match(/href="https?:\/\/[^"]+"/g) || []) {
      const url = e.slice(6, -1);
      assert.match(url, LIENS_SORTANTS_AUTORISES, `${p.id} : lien sortant non autorisé → ${url}`);
      if (!/^https:\/\/p5wmt65pvz-wq\.github\.io\//.test(url)) {
        const balise = h.match(new RegExp('<a[^>]*href="' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>'));
        if (balise) assert.match(balise[0], /rel="noopener"/, `${p.id} : lien sortant sans rel="noopener" → ${url}`);
      }
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
  /* Un jeton de vérification ne se déduit pas et ne s'invente pas : il vient
     du compte Search Console de son propriétaire, et de nulle part ailleurs.
     Le garde-fou précédent ne vérifiait que la forme — il a laissé passer un
     remplacement silencieux du jeton. Les valeurs connues sont donc épinglées
     ici. Ajouter ou retirer un jeton doit faire échouer ce test, pour que le
     changement soit forcément délibéré et expliqué. */
  const CONNUS = [
    /* Fourni par le propriétaire le 20 septembre 2026, dans la conversation. */
    '0h7HRPpQHBOrq5hc-7Z3xVPrnk5ekj_ARIOi3Of5MEE',
    /* Apparu dans le commit 5046387 le 21 septembre 2026. Provenance non
       confirmée par le propriétaire : conservé pour ne rien casser, jamais
       supprimé sans son accord. */
    'wmj_OMVsFzco-OYBZmh7O6oKtlr13qskSpej0NZPLKk'
  ];
  const trouves = [...accueil.matchAll(/<meta name="google-site-verification" content="([^"]+)"/g)].map((x) => x[1]);
  assert.ok(trouves.length > 0, 'balise de vérification absente de index.html');
  for (const t of trouves) {
    assert.ok(t.length >= 20, `jeton de vérification suspect : « ${t} »`);
    assert.doesNotMatch(t, /^(XXX|TODO|votre|your)/i, 'jeton d\'exemple laissé en place');
    assert.ok(CONNUS.includes(t),
      `jeton inconnu « ${t} » : un jeton de vérification vient du compte Search Console ` +
      'de son propriétaire. S\'il est légitime, l\'ajouter à CONNUS en disant d\'où il vient.');
  }
  for (const c of CONNUS) {
    assert.ok(trouves.includes(c), `le jeton connu « ${c} » a disparu d\'index.html`);
  }
});
