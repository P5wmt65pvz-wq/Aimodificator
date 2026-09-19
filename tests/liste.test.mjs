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
