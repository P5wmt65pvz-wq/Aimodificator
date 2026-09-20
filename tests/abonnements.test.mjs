/* Tests d'Abonnements. Le calcul de date est là où se cachent les bugs :
   fins de mois, années bissextiles, cycles longs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('../outils/abonnements/abonnements.js');

const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);
const abo = (o) => Object.assign({ nom: 'X', prix: 10, cycle: 'mensuel', depart: '2026-01-15' }, o);

test('le coût est ramené au mois quel que soit le cycle', () => {
  assert.equal(A.coutMensuel(abo({ prix: 9.99, cycle: 'mensuel' })).toFixed(2), '9.99');
  assert.equal(A.coutMensuel(abo({ prix: 120, cycle: 'annuel' })).toFixed(2), '10.00');
  assert.equal(A.coutMensuel(abo({ prix: 30, cycle: 'trimestriel' })).toFixed(2), '10.00');
  assert.equal(A.coutMensuel(abo({ prix: 60, cycle: 'semestriel' })).toFixed(2), '10.00');
  /* l'hebdomadaire passe par la moyenne de jours, pas par « 4 semaines » */
  const hebdo = A.coutMensuel(abo({ prix: 7, cycle: 'hebdomadaire' }));
  assert.ok(hebdo > 30 && hebdo < 31, `hebdomadaire mal converti : ${hebdo}`);
  assert.equal(A.coutAnnuel(abo({ prix: 10, cycle: 'mensuel' })).toFixed(2), '120.00');
});

test('une entrée incohérente vaut zéro au lieu de fausser le total', () => {
  for (const mauvais of [null, undefined, {}, { prix: 'abc', cycle: 'mensuel' },
                         { prix: 10, cycle: 'inconnu' }, { prix: NaN, cycle: 'mensuel' }]) {
    assert.equal(A.coutMensuel(mauvais), 0, `${JSON.stringify(mauvais)} aurait dû valoir 0`);
  }
});

test('ajouterMois ne déborde jamais sur le mois suivant', () => {
  const j = (a, m, d) => new Date(Date.UTC(a, m, d));
  assert.equal(iso(A.ajouterMois(j(2026, 0, 31), 1)), '2026-02-28', '31 janvier + 1 mois');
  assert.equal(iso(A.ajouterMois(j(2028, 0, 31), 1)), '2028-02-29', 'année bissextile');
  assert.equal(iso(A.ajouterMois(j(2026, 2, 31), 1)), '2026-04-30', '31 mars + 1 mois');
  assert.equal(iso(A.ajouterMois(j(2026, 11, 31), 1)), '2027-01-31', 'passage d\'année');
  assert.equal(iso(A.ajouterMois(j(2026, 0, 15), 12)), '2027-01-15', 'douze mois');
});

test('la prochaine échéance tombe toujours après aujourd\'hui', () => {
  const e = A.prochaineEcheance(abo({ depart: '2026-01-15', cycle: 'mensuel' }), '2026-09-19');
  assert.equal(iso(e), '2026-10-15');

  /* le jour même de l'échéance, la suivante est celle d'après */
  assert.equal(iso(A.prochaineEcheance(abo({ depart: '2026-01-15' }), '2026-09-15')), '2026-10-15');

  /* une souscription à venir est déjà la prochaine échéance */
  assert.equal(iso(A.prochaineEcheance(abo({ depart: '2027-03-01' }), '2026-09-19')), '2027-03-01');

  /* cycle annuel sur plusieurs années */
  assert.equal(iso(A.prochaineEcheance(abo({ depart: '2020-02-29', cycle: 'annuel' }), '2026-09-19')), '2027-02-28');
});

test('une date absente ou aberrante ne fait pas boucler le calcul', () => {
  assert.equal(A.prochaineEcheance(abo({ depart: '' }), '2026-09-19'), null);
  assert.equal(A.prochaineEcheance(abo({ depart: 'pas une date' }), '2026-09-19'), null);
  assert.equal(A.prochaineEcheance(null, '2026-09-19'), null);
  /* un départ très ancien en hebdomadaire : des milliers de cycles, doit s'arrêter */
  const t = Date.now();
  A.prochaineEcheance(abo({ depart: '1900-01-01', cycle: 'hebdomadaire' }), '2026-09-19');
  assert.ok(Date.now() - t < 1000, 'le calcul a pris trop de temps');
});

test('le total additionne des cycles différents correctement', () => {
  const liste = [
    abo({ nom: 'A', prix: 9.99, cycle: 'mensuel' }),
    abo({ nom: 'B', prix: 120, cycle: 'annuel' }),
    abo({ nom: 'C', prix: 30, cycle: 'trimestriel' })
  ];
  const t = A.totaux(liste);
  assert.equal(t.mensuel.toFixed(2), '29.99');
  assert.equal(t.annuel.toFixed(2), '359.88');
  assert.deepEqual(A.totaux([]), { mensuel: 0, annuel: 0 });
  assert.deepEqual(A.totaux(null), { mensuel: 0, annuel: 0 });
});

test('le tri met la reconduction la plus proche en premier', () => {
  const liste = [
    abo({ nom: 'loin', depart: '2026-01-25' }),
    abo({ nom: 'proche', depart: '2026-01-21' }),
    abo({ nom: 'sans date', depart: '' })
  ];
  const noms = A.trier(liste, '2026-09-19').map((x) => x.nom);
  assert.deepEqual(noms, ['proche', 'loin', 'sans date'],
    'les entrées sans date doivent fermer la marche');
  /* le tri ne modifie pas la liste d'origine */
  assert.equal(liste[0].nom, 'loin');
});

test('les reconductions imminentes sont celles qu\'on peut encore arrêter', () => {
  const liste = [
    abo({ nom: 'dans 2 jours', depart: '2026-09-21' }),
    abo({ nom: 'dans 20 jours', depart: '2026-10-09' }),
    abo({ nom: 'sans date', depart: '' })
  ];
  assert.deepEqual(A.imminents(liste, '2026-09-19', 14).map((x) => x.nom), ['dans 2 jours']);
  assert.deepEqual(A.imminents(liste, '2026-09-19', 30).map((x) => x.nom), ['dans 2 jours', 'dans 20 jours']);
  assert.deepEqual(A.imminents([], '2026-09-19'), []);
});

test('le décompte de jours est juste, y compris aujourd\'hui et demain', () => {
  const j = (s) => A.joursAvant(new Date(s + 'T00:00:00Z'), '2026-09-19');
  assert.equal(j('2026-09-19'), 0);
  assert.equal(j('2026-09-20'), 1);
  assert.equal(j('2026-10-19'), 30);
  assert.equal(A.delai(0), "aujourd'hui");
  assert.equal(A.delai(1), 'demain');
  assert.equal(A.delai(12), 'dans 12 jours');
  assert.equal(A.delai(null), 'date inconnue');
});

test('la validation refuse ce qui fausserait les totaux', () => {
  assert.equal(A.valide(abo({})), true);
  assert.equal(A.valide(abo({ nom: '   ' })), false);
  assert.equal(A.valide(abo({ prix: -5 })), false);
  assert.equal(A.valide(abo({ prix: 'gratuit' })), false);
  assert.equal(A.valide(abo({ cycle: 'quotidien' })), false);
  assert.equal(A.valide(null), false);
  assert.equal(A.valide(abo({ prix: 0 })), true, 'un abonnement à 0 € reste valable');
});

test('les montants sont affichés à la française', () => {
  assert.match(A.euros(9.9), /^9,90\s?€$/);
  assert.match(A.euros(1234.5), /1\s?234,50\s?€$/);
  assert.equal(A.euros(NaN), '—');
});
