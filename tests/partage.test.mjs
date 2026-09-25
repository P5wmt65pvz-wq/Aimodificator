/* Partage — le calcul, le lien, et surtout ce que le lien REFUSE.
   Le lien est la seule entrée du site que quelqu'un d'autre fabrique : il
   arrive par une messagerie, n'importe qui peut le forger. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../outils/partage/partage.js');

const GROUPE = { noms: ['Adrien', 'Léa', 'Tom'], depenses: [
  { quoi: 'Courses', payeur: 0, montant: 9000, pour: [0, 1, 2] },
  { quoi: 'Essence', payeur: 1, montant: 4500, pour: [0, 1] },
  { quoi: 'Cinéma 🎬', payeur: 2, montant: 1000, pour: [0, 1, 2] }
] };

/* Générateur pseudo-aléatoire à graine fixe : les cas « au hasard » sont les
   mêmes à chaque exécution, donc un échec se reproduit. */
function graine(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

test('les montants se lisent en centimes, et rien n\'est deviné', () => {
  assert.equal(P.centimes('42,50'), 4250);
  assert.equal(P.centimes('42.5'), 4250);
  assert.equal(P.centimes('42'), 4200);
  assert.equal(P.centimes(' 0,10 '), 10);
  assert.equal(P.centimes('1 250,00'), 125000);
  for (const x of ['', '0', '-5', '1e3', '3,999', 'abc', '12,', ',5', '1.2.3', null, undefined, 42, {}]) {
    assert.ok(Number.isNaN(P.centimes(x)), `${JSON.stringify(x)} aurait dû être refusé`);
  }
});

test('une somme indivisible ne perd ni n\'invente aucun centime', () => {
  assert.deepEqual(P.parts(1000, [0, 1, 2]), [334, 333, 333]);
  assert.deepEqual(P.parts(1, [0, 1, 2]), [1, 0, 0]);
  const r = graine(7);
  for (let i = 0; i < 500; i++) {
    const m = 1 + Math.floor(r() * 100000);
    const n = 1 + Math.floor(r() * 20);
    const p = P.parts(m, Array.from({ length: n }, (_, k) => k));
    assert.equal(p.reduce((a, b) => a + b, 0), m, `${m} centimes en ${n} parts`);
    assert.ok(Math.max(...p) - Math.min(...p) <= 1, 'les parts ne diffèrent que d\'un centime au plus');
  }
});

test('les soldes du groupe exemple sont ceux calculés à la main', () => {
  /* Courses 90 € à trois : 30 chacun. Essence 45 € à deux : 22,50. Cinéma
     10 € à trois : 3,34 + 3,33 + 3,33, le centime restant au premier coché. */
  assert.deepEqual(P.soldes(GROUPE), [3416, -1083, -2333]);
  assert.deepEqual(P.remboursements(P.soldes(GROUPE)), [
    { de: 2, a: 0, montant: 2333 }, { de: 1, a: 0, montant: 1083 }]);
  assert.equal(P.total(GROUPE), 14500);
});

test('sur 300 groupes au hasard, les soldes somment à zéro et les virements soldent tout', () => {
  const r = graine(42);
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(r() * 19);
    const e = { noms: Array.from({ length: n }, (_, i) => 'P' + i), depenses: [] };
    const nd = Math.floor(r() * 40);
    for (let j = 0; j < nd; j++) {
      const pour = Array.from({ length: n }, (_, i) => i).filter(() => r() < 0.6);
      if (!pour.length) pour.push(0);
      e.depenses.push({ quoi: '', payeur: Math.floor(r() * n), montant: 1 + Math.floor(r() * 50000), pour });
    }
    const s = P.soldes(e);
    assert.equal(s.reduce((a, b) => a + b, 0), 0, 'la somme des soldes doit valoir zéro');
    const v = P.remboursements(s);
    assert.ok(v.length <= Math.max(0, n - 1), `${v.length} virements pour ${n} personnes`);
    const apres = s.slice();
    for (const x of v) {
      assert.ok(x.montant > 0 && Number.isInteger(x.montant));
      apres[x.de] += x.montant; apres[x.a] -= x.montant;
    }
    assert.ok(apres.every((x) => x === 0), 'après les virements, plus personne ne doit rien');
  }
});

test('le lien fait l\'aller-retour à l\'identique, accents et emoji compris', () => {
  const code = P.encoder(GROUPE);
  assert.match(code, /^[A-Za-z0-9_-]+$/, 'le lien ne doit contenir que des caractères sûrs dans une adresse');
  assert.deepEqual(P.decoder(code), GROUPE);
});

test('un lien forgé ou abîmé est refusé en entier, jamais réparé à moitié', () => {
  const fabrique = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const bon = [1, ['a', 'b'], [['x', 0, 100, [0, 1]]]];
  assert.ok(P.decoder(fabrique(bon)), 'le cas de référence doit passer');
  const mauvais = {
    'version inconnue': [2, ['a', 'b'], []],
    'personne': [1, [], []],
    'nom vide': [1, [' ', 'b'], []],
    'nom trop long': [1, ['x'.repeat(41), 'b'], []],
    'doublon, casse comprise': [1, ['Léa', 'léa'], []],
    'trop de monde': [1, Array.from({ length: 21 }, (_, i) => 'p' + i), []],
    'payeur hors du groupe': [1, ['a', 'b'], [['x', 2, 100, [0]]]],
    'montant nul': [1, ['a', 'b'], [['x', 0, 0, [0]]]],
    'montant négatif': [1, ['a', 'b'], [['x', 0, -100, [0]]]],
    'montant à virgule': [1, ['a', 'b'], [['x', 0, 10.5, [0]]]],
    'montant démesuré': [1, ['a', 'b'], [['x', 0, P.MAX_MONTANT + 1, [0]]]],
    'personne ne paie pour personne': [1, ['a', 'b'], [['x', 0, 100, []]]],
    'bénéficiaire en double': [1, ['a', 'b'], [['x', 0, 100, [0, 0]]]],
    'bénéficiaires dans le désordre': [1, ['a', 'b'], [['x', 0, 100, [1, 0]]]],
    'bénéficiaire hors du groupe': [1, ['a', 'b'], [['x', 0, 100, [0, 5]]]],
    'dépense tronquée': [1, ['a', 'b'], [['x', 0, 100]]],
    'objet au lieu de tableau': { 0: 1, 1: ['a'], 2: [] },
    'pollution de prototype': [1, ['a', '__proto__'], [['x', 0, 100, [0]]]]
  };
  for (const [quoi, v] of Object.entries(mauvais)) {
    const r = P.decoder(fabrique(v));
    if (quoi === 'pollution de prototype') {
      /* « __proto__ » est un prénom comme un autre : il doit être accepté
         comme simple texte, sans rien polluer. */
      assert.ok(r && r.noms[1] === '__proto__');
      assert.equal(({}).pollue, undefined);
      continue;
    }
    assert.equal(r, null, `lien accepté à tort : ${quoi}`);
  }
  for (const x of ['', '#', '!!!', 'abc', 'A'.repeat(P.MAX_LIEN + 1), null, 42, {}, '////']) {
    assert.equal(P.decoder(x), null, `${JSON.stringify(String(x)).slice(0, 30)} aurait dû être refusé`);
  }
});

test('un lien démesuré est refusé tout de suite, sans être lu', () => {
  const t0 = Date.now();
  assert.equal(P.decoder('A'.repeat(5_000_000)), null);
  assert.ok(Date.now() - t0 < 50);
});

test('les montants s\'affichent en euros, jamais en notation scientifique', () => {
  assert.equal(P.euros(4250), '42,50 €');
  assert.equal(P.euros(-1083), '−10,83 €');
  assert.equal(P.euros(125000), '1 250,00 €');
  assert.equal(P.euros(0), '0,00 €');
  for (const x of [NaN, Infinity, 1e308, 10.5, null, undefined, '42']) {
    assert.equal(P.euros(x), '—', `${String(x)} devait rendre un tiret`);
  }
});
