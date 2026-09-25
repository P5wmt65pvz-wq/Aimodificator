/* Vrai prix — le calcul, et surtout ce qu'il refuse de calculer.
   Le défaut le plus coûteux ici ne serait pas une erreur d'arithmétique
   visible : ce serait un « 0,00 € » affiché sur une saisie vide. Faux, et
   rassurant. La moitié de ces tests portent là-dessus. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vp = require('../outils/vrai-prix/vrai-prix.js');

const proche = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) < tol, `${a} attendu proche de ${b}`);

test('le prix est ramené au mois selon le cycle', () => {
  proche(vp.coutMensuel(9.99, 'mensuel'), 9.99);
  proche(vp.coutMensuel(120, 'annuel'), 10);
  proche(vp.coutMensuel(30, 'trimestriel'), 10);
  proche(vp.coutMensuel(60, 'semestriel'), 10);
});

test('l\'hebdomadaire passe par la durée réelle d\'un mois, pas par quatre semaines', () => {
  const reel = vp.coutMensuel(5, 'hebdomadaire');
  proche(reel, 5 * (365.25 / 12) / 7);
  assert.ok(reel > 20, 'quatre semaines donnerait 20 € et perdrait presque un mois par an');
});

test('une saisie inexploitable rend NaN, jamais zéro', () => {
  /* Number('') et Number(null) valent 0 : sans garde explicite, un champ vide
     ressortirait en « 0,00 € sur cinq ans ». */
  for (const v of ['', '   ', null, undefined, true, false, {}, [], 'abc', NaN, Infinity]) {
    assert.ok(Number.isNaN(vp.coutMensuel(v, 'mensuel')),
      `${JSON.stringify(v)} aurait dû rendre NaN`);
  }
  assert.ok(Number.isNaN(vp.coutMensuel(-5, 'mensuel')), 'un prix négatif n\'a pas de sens');
  assert.ok(Number.isNaN(vp.coutMensuel(10, 'trimensuel')), 'cycle inconnu');
});

test('la virgule décimale française est acceptée', () => {
  proche(vp.coutMensuel('9,99', 'mensuel'), 9.99);
  proche(vp.coutMensuel('9.99', 'mensuel'), 9.99);
});

test('le cumulé sans hausse est une simple multiplication', () => {
  proche(vp.cumul(9.99, 60, 0), 599.40);
  proche(vp.cumul(10, 12, 0), 120);
});

test('la hausse ne s\'applique qu\'aux anniversaires, pas au premier mois', () => {
  /* Douze mois au prix d'origine : la hausse ne doit RIEN changer sur un an. */
  proche(vp.cumul(10, 12, 0.10), 120);
  /* Deuxième année à 11 € : 120 + 132. */
  proche(vp.cumul(10, 24, 0.10), 252);
  /* Troisième à 12,10 € : 252 + 145,20. */
  proche(vp.cumul(10, 36, 0.10), 397.20);
});

test('le cumulé croît avec la durée et avec la hausse', () => {
  assert.ok(vp.cumul(10, 60, 0) < vp.cumul(10, 61, 0));
  assert.ok(vp.cumul(10, 60, 0) < vp.cumul(10, 60, 0.05));
});

test('le cumulé refuse une durée ou un prix aberrants', () => {
  for (const [prix, mois] of [[NaN, 12], [10, 0], [10, -3], [10, NaN], ['x', 12]]) {
    assert.ok(Number.isNaN(vp.cumul(prix, mois, 0)), `${prix}/${mois} aurait dû rendre NaN`);
  }
});

test('le point de bascule est le premier mois où le cumulé atteint l\'achat', () => {
  /* 9,99 €/mois contre 249 € : 24 mois font 239,76 €, 25 font 249,75 €. */
  assert.equal(vp.bascule(9.99, 249, 0), 25);
  /* Le mois juste avant ne doit pas suffire. */
  assert.ok(vp.cumul(9.99, 24, 0) < 249);
  assert.ok(vp.cumul(9.99, 25, 0) >= 249);
});

test('la hausse rapproche le point de bascule, jamais l\'inverse', () => {
  const sans = vp.bascule(9.99, 900, 0);
  const avec = vp.bascule(9.99, 900, 0.10);
  assert.ok(avec <= sans, `avec hausse ${avec} devrait arriver avant ${sans}`);
});

test('la recherche du point de bascule est bornée et ne boucle jamais', () => {
  /* Un achat gigantesque face à un abonnement dérisoire : la boucle doit
     s'arrêter au plafond et rendre null, pas tourner indéfiniment. */
  assert.equal(vp.bascule(0.01, 1e9, 0), null);
  assert.equal(vp.MOIS_MAX, 600);
  for (const mauvais of [[NaN, 100], [10, 0], [10, -1], [10, 'x'], [0, 100]]) {
    assert.equal(vp.bascule(mauvais[0], mauvais[1], 0), null);
  }
});

test('les montants et les durées s\'écrivent lisiblement', () => {
  assert.equal(vp.euros(599.4), '599,40 €');
  for (const v of [NaN, null, undefined, 'x', Infinity]) {
    assert.equal(vp.euros(v), '—', `${JSON.stringify(v)} devait rendre un tiret`);
  }
  assert.equal(vp.duree(25), '2 ans et 1 mois');
  assert.equal(vp.duree(12), '1 an');
  assert.equal(vp.duree(7), '7 mois');
  assert.equal(vp.duree(0), '—');
  assert.equal(vp.duree(NaN), '—');
});

test('une bascule qui tombe pile n’arrive pas un mois trop tard', () => {
  /* De l'argent se compare en centimes, pas en flottants. 9,99 additionné
     douze fois donne 119.87999999999998 : un test « >= 119,88 » échouait, et
     l'outil annonçait treize mois là où la réponse exacte est douze.

     Trouvé en recalculant les cas limites à la main, pas en lisant le code —
     l'expression avait l'air juste. */
  assert.equal(vp.bascule(9.99, 119.88, 0), 12, 'douze mois à 9,99 font exactement 119,88');
  assert.equal(vp.bascule(9.99, 119.89, 0), 13, 'un centime de plus demande un mois de plus');
  assert.equal(vp.bascule(9.99, 119.87, 0), 12, 'un centime de moins reste à douze');
  assert.equal(vp.bascule(10, 600, 0), 60, 'cinq ans à 10 € font exactement 600 €');
  assert.equal(vp.bascule(9.99, 9.99, 0), 1, 'un achat au prix d’un mois bascule dès le premier');
  assert.equal(vp.bascule(10, 120, 0.2), 12, 'la hausse ne frappe qu’après la première année');
});

test('le cumulé est borné, comme le point de bascule', () => {
  /* Sans borne, cumul(10, 1e308) bouclait sans fin. Le défaut est resté caché
     trois jours : le fuzzer appelait la fonction avec la LISTE des valeurs
     hostiles au lieu de chacune d'elles. */
  const t0 = Date.now();
  assert.ok(Number.isNaN(vp.cumul(10, 1e308, 0)));
  assert.ok(Number.isNaN(vp.cumul(10, vp.MOIS_MAX + 1, 0)));
  assert.ok(Date.now() - t0 < 50, 'le refus doit être immédiat, pas après une boucle');
  proche(vp.cumul(10, vp.MOIS_MAX, 0), 10 * vp.MOIS_MAX);
});

test('une hausse invraisemblable est refusée, pas propagée vers l\'infini', () => {
  assert.ok(Number.isNaN(vp.cumul(10, 60, 1e308)));
  assert.ok(Number.isNaN(vp.cumul(10, 60, vp.HAUSSE_MAX + 0.01)));
  assert.equal(vp.bascule(10, 249, 1e308), null);
  assert.ok(Number.isFinite(vp.cumul(10, 60, vp.HAUSSE_MAX)));
  /* Un prix absurde fait déborder la somme : refusée, pas rendue infinie. */
  assert.ok(Number.isNaN(vp.cumul(1e308, 60, 0)));
});
