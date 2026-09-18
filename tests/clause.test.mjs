/* Tests de Clause : détection de clauses et repérage des manques. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../outils/clause/clause.js');

/* Un corps de texte neutre assez long pour dépasser le seuil des 60 mots. */
const REMPLISSAGE = 'Le present document decrit le traitement des informations recueillies lors de votre visite sur notre plateforme et precise les modalites applicables. '.repeat(4);
const avec = (s) => s + ' ' + REMPLISSAGE;

const ids = (t) => C.analyse(avec(t)).findings.map((f) => f.id);

test('la normalisation neutralise accents, casse et typographie', () => {
  assert.equal(C.normalize('Données   PERSONNELLES'), 'donnees personnelles');
  assert.equal(C.normalize('l’Union'), "l'union");
  assert.equal(C.normalize('  a\n\nb  '), 'a b');
  assert.equal(C.normalize(null), '');
  assert.equal(C.normalize(undefined), '');
});

test('la revente de données est détectée et classée en tête', () => {
  const r = C.analyse(avec('Nous pouvons vendre vos données à des sociétés tierces.'));
  assert.ok(r.findings.some((f) => f.id === 'vente'));
  assert.equal(r.findings[0].level, 'critical', 'le plus grave doit remonter en premier');
  assert.equal(r.verdict.key, 'critical');
});

test('les transferts hors Union européenne sont repérés, apostrophe ou non', () => {
  assert.ok(ids("Vos données sont transférées hors de l'Union européenne.").includes('hors-ue'));
  assert.ok(ids('Vos donnees sont transferees hors de l Union europeenne.').includes('hors-ue'));
  assert.ok(ids('Des clauses contractuelles types encadrent ces flux.').includes('hors-ue'));
});

test('le consentement présumé est distingué d\'un vrai consentement', () => {
  assert.ok(ids('En poursuivant votre navigation, vous acceptez le dépôt de traceurs.').includes('consentement-presume'));
  assert.ok(!ids('Votre consentement est recueilli avant tout dépôt.').includes('consentement-presume'));
});

test('une durée chiffrée est un bon point, une durée vague ne l\'est pas', () => {
  const chiffree = ids('Nous conservons vos données pendant 3 ans.');
  assert.ok(chiffree.includes('conservation-chiffree'));
  assert.ok(!chiffree.includes('conservation-illimitee'));

  const vague = ids('Nous conservons vos données aussi longtemps que nécessaire.');
  assert.ok(vague.includes('conservation-illimitee'));
  assert.ok(!vague.includes('conservation-chiffree'));
});

test('les manques sont signalés quand les sections attendues sont absentes', () => {
  const r = C.analyse(avec('Nous collectons des informations de navigation.'));
  const manquants = r.missing.map((m) => m.id);
  assert.deepEqual(manquants.sort(), ['conservation-chiffree', 'contact', 'droits']);
  for (const m of r.missing) assert.ok(m.label && m.why, 'manque mal décrit');
});

test('une politique complète ne signale aucun manque', () => {
  const r = C.analyse(avec(
    'Vous disposez d\'un droit d\'accès et d\'opposition. Écrivez à contact@exemple.fr. ' +
    'Les données sont conservées pendant 12 mois.'));
  assert.deepEqual(r.missing, []);
  assert.ok(['good', 'warning'].includes(r.verdict.key), `verdict inattendu : ${r.verdict.key}`);
});

test('chaque clause détectée cite un extrait du texte d\'origine', () => {
  const r = C.analyse(avec('Nous pouvons céder vos données à des tiers partenaires commerciaux.'));
  const f = r.findings.find((x) => x.id === 'vente' || x.id === 'partenaires');
  assert.ok(f, 'aucune clause de partage détectée');
  assert.ok(f.excerpt && f.excerpt.length > 10, 'extrait absent');
  assert.ok(f.excerpt.length <= 320, 'extrait trop long');
});

test('un texte vide ou trop court est signalé plutôt qu\'analysé', () => {
  assert.equal(C.analyse('').verdict.key, 'empty');
  assert.equal(C.analyse('   ').verdict.key, 'empty');
  assert.equal(C.analyse('Politique de confidentialité. Nous vendons vos données.').verdict.key, 'short');
});

test('chaque règle est bien formée et sans identifiant en double', () => {
  const vus = new Set();
  for (const r of C.RULES) {
    assert.ok(r.id && r.title && r.meaning, `règle incomplète : ${r.id}`);
    assert.ok(['critical', 'serious', 'mid', 'good'].includes(r.level), `niveau inconnu : ${r.level}`);
    assert.ok(r.patterns.length >= 1, `aucun motif pour ${r.id}`);
    assert.ok(!vus.has(r.id), `identifiant dupliqué : ${r.id}`);
    vus.add(r.id);
    for (const p of r.patterns) assert.doesNotThrow(() => new RegExp(p.source), `motif invalide dans ${r.id}`);
  }
  for (const e of C.EXPECTED) assert.ok(vus.has(e.id), `${e.id} attendu mais absent des règles`);
});

test('un texte très long ou hostile ne fait pas planter l\'analyse', () => {
  assert.doesNotThrow(() => C.analyse('données '.repeat(60000)));
  assert.doesNotThrow(() => C.analyse('<script>alert(1)</script> '.repeat(200)));
  assert.doesNotThrow(() => C.analyse('.'.repeat(10000)));
  assert.doesNotThrow(() => C.analyse('\u0000￿'.repeat(500)));
});
