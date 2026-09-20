/* Tests de la liste de diffusion.
   Le point critique : rien ici ne doit ouvrir la porte à une requête réseau. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const liste = require('../assets/js/liste.js');
const i18n = require('../assets/js/i18n.js');
const BASE = path.resolve(import.meta.dirname, '..');

test('l\'adresse est une adresse valide, et pas une adresse d\'exemple', () => {
  assert.match(liste.ADRESSE, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  assert.ok(!/exemple\.|example\./.test(liste.ADRESSE), 'adresse d\'exemple restée en place');
});

test('aucun service d\'inscription n\'est branché', () => {
  assert.equal(liste.SERVICE, '', 'brancher un service exigerait une requête réseau');
  assert.equal(liste.serviceLive(), false);
});

test('la règle de sûreté refuse tout ce qui n\'est pas une URL https absolue', () => {
  for (const bon of ['https://x.fr/a', 'https://listmonk.example-libre.org/s']) {
    assert.equal(liste.isLive(bon), true, `${bon} aurait dû passer`);
  }
  for (const mauvais of ['', '   ', 'http://x.fr', 'javascript:alert(1)', 'data:text/html,x',
                         '//x.fr', 'x.fr', 'https://exemple.com/a', 'https://example.com/a',
                         null, undefined, 42, {}]) {
    assert.equal(liste.isLive(mauvais), false, `${JSON.stringify(mauvais)} aurait dû être refusé`);
  }
});

test('le lien mailto est correctement formé dans les deux langues', () => {
  for (const lang of ['fr', 'en']) {
    const m = liste.mailto(lang);
    assert.ok(m.startsWith('mailto:' + liste.ADRESSE + '?subject='), `mailto mal formé : ${m}`);
    assert.doesNotMatch(m, /\s/, 'le lien ne doit contenir aucune espace brute');
  }
  assert.notEqual(liste.mailto('fr'), liste.mailto('en'), 'l\'objet doit être traduit');
});

test('tous les textes de la section passent par i18n, dans les deux langues', () => {
  const cles = ['liste.title', 'liste.lede', 'liste.cta', 'liste.or', 'liste.copy',
                'liste.copied', 'liste.honest', 'liste.local'];
  for (const c of cles) {
    assert.ok(i18n.strings[c], `clé ${c} absente`);
    assert.ok(i18n.strings[c].fr && i18n.strings[c].en, `clé ${c} non bilingue`);
  }
});

test('le texte annonce la fréquence, l\'usage et le moyen de partir', () => {
  for (const lang of ['fr', 'en']) {
    const lede = i18n.t('liste.lede', lang).toLowerCase();
    const honest = i18n.t('liste.honest', lang).toLowerCase();
    assert.match(lede, lang === 'fr' ? /mois/ : /month/, 'fréquence non annoncée');
    assert.match(honest, lang === 'fr' ? /revendue|transmise/ : /sold|shared/, 'usage non précisé');
    assert.match(honest, lang === 'fr' ? /stop/ : /stop/, 'désinscription non expliquée');
  }
});

test('la section ne contient aucun formulaire ni aucune adresse en dur', () => {
  const html = readFileSync(path.join(BASE, 'index.html'), 'utf8');
  const section = html.match(/<section class="liste"[\s\S]*?<\/section>/);
  assert.ok(section, 'section absente de l\'accueil');
  assert.doesNotMatch(section[0], /<form|<input|action=/i,
    'un formulaire impliquerait un envoi réseau, interdit par la règle 3');
  assert.doesNotMatch(section[0], /@[a-z0-9.-]+\.[a-z]{2,}/i,
    'l\'adresse doit venir de liste.js, pas être écrite dans la page');
  /* tous les textes visibles passent par i18n */
  assert.doesNotMatch(section[0], />[^<>{}\n]*[a-zà-ÿ]{4,}[^<>{}\n]*</i,
    'du texte est écrit en dur au lieu de passer par data-i18n');
});

/* Les pages d'outils portent le lien d'inscription en clair : elles n'ont pas
   d'i18n et un lien posé par script serait mort sans JavaScript. L'adresse peut
   donc y dériver — ce test l'interdit. La source de vérité reste liste.js. */
test('tout lien d\'inscription écrit dans une page correspond à liste.js', () => {
  const PAGES = [
    ['outils/photo/index.html', 'fr'], ['outils/passe/index.html', 'fr'],
    ['outils/clause/index.html', 'fr'], ['outils/abonnements/index.html', 'fr'],
    ['outils/empreinte/index.html', 'fr'], ['en/fingerprint/index.html', 'en']
  ];
  let trouves = 0;
  for (const [f, lang] of PAGES) {
    const html = readFileSync(path.join(BASE, f), 'utf8');
    const liens = html.match(/mailto:[^"']+/g) || [];
    assert.ok(liens.length > 0, `${f} : aucun lien d'inscription`);
    for (const lien of liens) {
      assert.equal(lien, liste.mailto(lang),
        `${f} : le lien a dérivé de liste.js → ${lien}`);
      trouves++;
    }
  }
  assert.ok(trouves >= PAGES.length, 'moins de liens trouvés que de pages');
});

/* Un lien d'inscription doit annoncer ce à quoi on s'inscrit, sinon il est
   trompeur. Même exigence que pour la section de l'accueil. */
test('chaque page annonce la fréquence, l\'usage et le moyen de partir', () => {
  const PAGES = [
    ['outils/photo/index.html', /mois/, /revendue|transmise/, /stop/],
    ['outils/passe/index.html', /mois/, /revendue|transmise/, /stop/],
    ['outils/clause/index.html', /mois/, /revendue|transmise/, /stop/],
    ['outils/abonnements/index.html', /mois/, /revendue|transmise/, /stop/],
    ['outils/empreinte/index.html', /mois/, /revendue|transmise/, /stop/],
    ['en/fingerprint/index.html', /month/, /sold|shared/, /stop/]
  ];
  for (const [f, freq, usage, sortie] of PAGES) {
    const bloc = readFileSync(path.join(BASE, f), 'utf8').match(/<h2>[^<]*<\/h2>\s*<p>[\s\S]*?mailto:[\s\S]*?<\/p>/);
    assert.ok(bloc, `${f} : bloc d'inscription introuvable`);
    assert.match(bloc[0], freq, `${f} : fréquence non annoncée`);
    assert.match(bloc[0], usage, `${f} : usage de l'adresse non précisé`);
    assert.match(bloc[0], sortie, `${f} : désinscription non expliquée`);
  }
});
