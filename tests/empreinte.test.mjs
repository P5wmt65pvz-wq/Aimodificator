/* Tests de l'outil Empreinte (logique pure, sans navigateur). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../outils/empreinte/empreinte.js');
const I18N = require('../outils/empreinte/empreinte.i18n.js');

const f = (level, exposed) => ({ level, exposed });

test('le score ne compte que les signaux réellement exposés', () => {
  assert.equal(E.scoreFrom([]), 0);
  assert.equal(E.scoreFrom([f('high', false), f('high', false)]), 0);
  assert.equal(E.scoreFrom([f('high', true)]), E.WEIGHTS.high);
  assert.equal(E.scoreFrom([f('high', true), f('mid', true), f('low', true)]),
    E.WEIGHTS.high + E.WEIGHTS.mid + E.WEIGHTS.low);
});

test('le score reste borné entre 0 et 100', () => {
  const beaucoup = Array.from({ length: 40 }, () => f('high', true));
  assert.equal(E.scoreFrom(beaucoup), 100);
  assert.ok(E.scoreFrom([]) >= 0);
});

test('un niveau inconnu ne casse pas le calcul', () => {
  assert.equal(E.scoreFrom([{ level: 'inexistant', exposed: true }]), 0);
  assert.equal(E.scoreFrom([{ exposed: true }]), 0);
});

test('les verdicts couvrent toute l\'échelle sans trou', () => {
  const vus = new Set();
  for (let s = 0; s <= 100; s++) {
    const v = E.verdictFor(s);
    assert.ok(v.label && v.explain && v.color, `score ${s} → verdict incomplet`);
    vus.add(v.key);
  }
  assert.deepEqual([...vus].sort(), ['critical', 'good', 'serious', 'warning']);
});

test('le verdict s\'aggrave de façon monotone', () => {
  const rang = { good: 0, warning: 1, serious: 2, critical: 3 };
  let precedent = 0;
  for (let s = 0; s <= 100; s++) {
    const r = rang[E.verdictFor(s).key];
    assert.ok(r >= precedent, `régression de gravité à ${s}`);
    precedent = r;
  }
});

test('le hachage est stable et sans collision sur des entrées proches', () => {
  assert.equal(E.shortHash('abc'), E.shortHash('abc'));
  assert.notEqual(E.shortHash('abc'), E.shortHash('abd'));
  assert.match(E.shortHash('x'), /^[0-9a-f]{8}$/);
});

test('chaque conseil a un titre et une explication, dans les deux langues', () => {
  for (const lang of ['fr', 'en']) {
    const liste = E.conseils(lang);
    assert.ok(liste.length >= 4, `${lang} : trop peu de conseils`);
    for (const [titre, texte] of liste) {
      assert.ok(titre && titre.length > 5, `${lang} : titre trop court`);
      assert.ok(texte && texte.length > 40, `${lang} : explication trop courte — ${titre}`);
      assert.ok(!titre.includes('advice.'), `${lang} : clé non traduite — ${titre}`);
    }
  }
  assert.notDeepEqual(E.conseils('fr'), E.conseils('en'), 'les deux langues sont identiques');
});

/* Quelques fragments s'écrivent réellement de la même façon dans les deux
   langues. Les lister explicitement vaut mieux qu'affaiblir la règle : toute
   nouvelle coïncidence devra être justifiée ici. */
const IDENTIQUES_LEGITIMES = new Set(['f.touch.points']);

test('tout le texte visible existe dans les deux langues', () => {
  const parcourir = (noeud, chemin = []) => {
    if (noeud && typeof noeud === 'object' && 'fr' in noeud && 'en' in noeud) {
      assert.ok(noeud.fr && noeud.fr.length > 1, `${chemin.join('.')} : français vide`);
      assert.ok(noeud.en && noeud.en.length > 1, `${chemin.join('.')} : anglais vide`);
      const cle = chemin.join('.');
      if (!IDENTIQUES_LEGITIMES.has(cle)) {
        assert.notEqual(noeud.fr, noeud.en, `${cle} : traduction absente, les deux textes sont identiques`);
      }
      return 1;
    }
    if (noeud && typeof noeud === 'object') {
      return Object.keys(noeud).reduce((n, k) => n + parcourir(noeud[k], chemin.concat(k)), 0);
    }
    return 0;
  };
  const n = parcourir(I18N.T);
  assert.ok(n >= 40, `seulement ${n} textes bilingues trouvés`);
});

test('les verdicts et les niveaux sont traduits', () => {
  for (const score of [0, 30, 50, 90]) {
    const fr = E.verdictFor(score, 'fr'), en = E.verdictFor(score, 'en');
    assert.equal(fr.key, en.key, 'le verdict ne doit pas dépendre de la langue');
    assert.notEqual(fr.label, en.label, `score ${score} : libellé non traduit`);
    assert.ok(!fr.label.includes('verdict.'), 'clé non résolue en français');
    assert.ok(!en.label.includes('verdict.'), 'clé non résolue en anglais');
  }
  for (const n of ['high', 'mid', 'low', 'safe']) {
    assert.notEqual(E.niveau(n, 'fr'), E.niveau(n, 'en'), `niveau ${n} non traduit`);
  }
});
