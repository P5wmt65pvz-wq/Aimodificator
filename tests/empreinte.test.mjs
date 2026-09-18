/* Tests de l'outil Empreinte (logique pure, sans navigateur). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../outils/empreinte/empreinte.js');

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

test('chaque conseil a un titre et une explication', () => {
  assert.ok(E.ADVICE.length >= 4);
  for (const [titre, texte] of E.ADVICE) {
    assert.ok(titre && titre.length > 5, 'titre trop court');
    assert.ok(texte && texte.length > 40, `explication trop courte : ${titre}`);
  }
});
