import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../outils/passe/passe.js');
const { MOTS } = require('../outils/passe/mots.js');

const bits = (mdp) => P.analyser(mdp, 'lent').bits;

/* ------------------------------------------------------- la liste de mots */

test('la liste de mots est utilisable sur n’importe quel clavier', () => {
  /* Une phrase de passe qu’on ne peut pas retaper sur l’écran de démarrage
     d’un ordinateur ou sur un clavier anglais ne sert à rien. */
  const fautifs = MOTS.filter((m) => !/^[a-z]{4,9}$/.test(m));
  assert.deepEqual(fautifs, [], `mots hors format : ${fautifs.join(', ')}`);
});

test('aucun mot en double dans la liste de génération', () => {
  /* Un doublon rendrait le tirage inégal et ferait mentir l’entropie. */
  const vus = new Set(), dup = [];
  for (const m of MOTS) { if (vus.has(m)) dup.push(m); vus.add(m); }
  assert.deepEqual(dup, [], `doublons : ${dup.join(', ')}`);
  assert.ok(MOTS.length >= 1000, `liste trop courte : ${MOTS.length}`);
});

/* -------------------------------------------------------- les faux amis */

test('un mot de passe très répandu ne vaut presque rien, même rallongé', () => {
  assert.ok(P.analyser('123456', 'lent').essais < 100);
  /* Quinze caractères, quatre jeux de caractères — et pourtant misérable. */
  const long = P.analyser('Motdepasse2024!', 'lent');
  assert.ok(long.bits < 25, `${long.bits} bits, attendu moins de 25`);
  assert.ok(long.bitsBruts > 90, 'le calcul naïf devrait, lui, être flatteur');
});

test('le « leet » ne sauve pas un mot connu', () => {
  /* Remplacer a par @ ajoute un essai, pas mille. */
  assert.ok(bits('P@ssw0rd') < 15, `${bits('P@ssw0rd')} bits`);
  assert.ok(bits('M0tdep@sse') < 20);
});

test('une lecture ambiguë du « leet » est trouvée quand même', () => {
  /* « 1 » peut remplacer un « l » comme un « i ». N’en tester qu’une seule
     laissait passer « Ju1llet », lu « julllet ». */
  const m = P.motifsDictionnaire('Ju1llet').map((x) => x.detail);
  assert.ok(m.includes('juillet'), `lectures trouvées : ${m.join(', ')}`);
  assert.ok(P.deleetVariantes('1').includes('i'));
  assert.ok(P.deleetVariantes('1').includes('l'));
});

test('une date complète est vue d’un seul tenant', () => {
  /* L’ordre des branches comptait : « 15/03/2008 » se faisait couper en
     « 1 » + « 5/03/2008 », ce qui rapportait des points imméritées. */
  const a = P.analyser('15/03/2008', 'lent');
  assert.equal(a.morceaux.length, 1, a.morceaux.map((m) => m.detail).join(' | '));
  assert.equal(a.morceaux[0].type, 'date');
  assert.equal(a.morceaux[0].fin - a.morceaux[0].debut, 10);
});

test('répéter un motif n’ajoute presque rien', () => {
  const court = P.analyser('abcabc', 'lent');
  const long = P.analyser('abcabcabcabcabcabc', 'lent');   /* trois fois plus long */
  /* Le compte naïf, lui, récompense chaque caractère ajouté. */
  assert.ok(long.bitsBruts - court.bitsBruts > 50, 'le calcul naïf doit, lui, s’envoler');
  assert.ok(long.bits - court.bits < 5,
    `${court.bits} -> ${long.bits} bits : la répétition rapporte trop`);
  assert.ok(long.bits < long.bitsBruts / 4,
    `${long.bits} bits au lieu de ${long.bitsBruts} : l’écart devrait être franc`);
});

test('une suite de clavier ou de chiffres est reconnue', () => {
  assert.ok(bits('azertyuiop') < 15);
  assert.ok(bits('qwertyuiop') < 15);
  assert.ok(bits('azertyuiop123') < 20, `${bits('azertyuiop123')} bits`);
  assert.ok(P.motifsSuite('123').length > 0, 'trois chiffres suffisent à trahir la suite');
});

test('un mot de passe réellement tiré au hasard passe devant un long mot de passe deviné', () => {
  /* Le message central de la page : la longueur seule ne fait pas la force. */
  assert.ok(bits('Xk9$mQ2vLp7w') > bits('Motdepasse2024!') + 40);
});

/* --------------------------------------------------- solidité du calcul */

test('le nombre d’essais reste toujours un nombre utilisable', () => {
  /* Sur chaque préfixe : jamais zéro, jamais l’infini, jamais négatif. */
  for (const base of ['Ju1llet-2024azerty!', 'Xk9$mQ2vLp7w', '31/12/1999abc']) {
    for (let i = 1; i <= base.length; i++) {
      const e = P.couverture(base.slice(0, i)).essais;
      assert.ok(e >= 1 && Number.isFinite(e),
        `essais aberrants sur « ${base.slice(0, i)} » : ${e}`);
    }
  }
});

test('l’estimation ne dépasse jamais le comptage naïf', () => {
  /* Le comptage caractère par caractère est toujours une option offerte au
     chemin le moins cher : le résultat ne peut donc pas être pire que lui.
     S’il l’était, un motif ferait perdre du travail à l’attaquant,
     ce qui n’a pas de sens. */
  for (const mdp of ['Motdepasse2024!', 'Xk9$mQ2vLp7w', 'azertyuiop123',
    'correcthorsebatterystaple', 'aaaa1111', 'Ju1llet-2024']) {
    const a = P.analyser(mdp, 'lent');
    assert.ok(a.bits <= a.bitsBruts + 1e-9,
      `${mdp} : ${a.bits} bits estimés pour ${a.bitsBruts} bits naïfs`);
  }
});

test('allonger un mot de passe peut l’affaiblir, et c’est voulu', () => {
  /* « Ju1lle » n’est rien, « Ju1llet » est un mois du calendrier. La
     lettre ajoutée fait donc CHUTER le nombre d’essais. Ce n’est pas un défaut
     de calcul : c’est le comportement réel d’un attaquant, et c’est la chose
     que cette page existe pour montrer. */
  assert.ok(P.couverture('Ju1llet').essais < P.couverture('Ju1lle').essais / 1000,
    'compléter un mot connu devrait faire chuter le coût');
  assert.ok(bits('Motdepasse') < bits('Motdepass'),
    'le mot complet doit coûter moins cher que son amorce');
});

test('aucun motif ne coûte zéro ni l’infini', () => {
  /* Un coût nul donnerait une entropie de moins l’infini et casserait
     l’affichage sans qu’on s’en aperçoive. */
  const echantillons = ['123456', 'Ju1llet-2024', 'aaaaaaaa', 'P@ssw0rd!!',
    'azertyuiop', '31/12/1999', 'Sophie2008', 'abcabcabc', 'éàüîô'];
  for (const e of echantillons) {
    for (const m of P.couverture(e).morceaux) {
      assert.ok(m.cout >= 1 && Number.isFinite(m.cout),
        `coût aberrant ${m.cout} pour ${m.type} « ${m.detail} » dans ${e}`);
      assert.ok(m.fin > m.debut, 'motif de longueur nulle');
    }
  }
});

test('la couverture recouvre le mot de passe entier, sans trou ni chevauchement', () => {
  for (const e of ['Motdepasse2024!', 'correcthorsebatterystaple', 'Xk9$mQ2v']) {
    const m = P.couverture(e).morceaux;
    assert.equal(m[0].debut, 0, `trou au début de ${e}`);
    assert.equal(m[m.length - 1].fin, e.length, `trou à la fin de ${e}`);
    for (let i = 1; i < m.length; i++) {
      assert.equal(m[i].debut, m[i - 1].fin, `chevauchement ou trou dans ${e}`);
    }
  }
});

test('un mot de passe très long reste calculable et ne fait pas boucler', () => {
  const debut = Date.now();
  const a = P.analyser('a1!B'.repeat(80), 'lent');   /* 320 caractères */
  assert.equal(a.longueur, P.LONGUEUR_MAX, 'la saisie doit être tronquée');
  assert.ok(Number.isFinite(a.bits) && a.bits > 0);
  assert.ok(Date.now() - debut < 3000, 'analyse trop lente pour une frappe au clavier');
});

test('une saisie vide ne produit ni verdict ni erreur', () => {
  const a = P.analyser('', 'lent');
  assert.equal(a.vide, true);
  assert.equal(a.essais, 0);
  assert.deepEqual(a.morceaux, []);
  assert.equal(P.analyser(null, 'lent').vide, true);
  assert.equal(P.analyser(undefined, 'lent').vide, true);
});

test('le verdict suit l’hypothèse affichée, il n’est pas posé d’avance', () => {
  /* Tout l’honnêteté de la page tient là : changer l’hypothèse doit changer
     le résultat, sinon le chiffre serait décoratif. */
  const mdp = 'tiroir-reglage-bosquet';
  const lent = P.analyser(mdp, 'lent'), rapide = P.analyser(mdp, 'rapide');
  assert.equal(lent.bits, rapide.bits, 'le nombre d’essais ne dépend pas de l’attaquant');
  assert.ok(lent.secondes > rapide.secondes * 1000, 'le délai, si');
  assert.ok(lent.niveau > rapide.niveau, 'et donc le verdict aussi');
});

test('une hypothèse inconnue retombe sur la plus prudente, sans planter', () => {
  const a = P.analyser('azerty', 'inexistante');
  assert.equal(a.hypothese, P.HYPOTHESES.lent);
});

/* ------------------------------------------------------- le générateur */

test('l’entropie d’une phrase générée est exacte, pas estimée', () => {
  /* Elle vient du tirage lui-même : c’est le seul chiffre de la page qui
     n’est pas une estimation. */
  for (const n of [3, 5, 6, 12]) {
    const p = P.genererPhrase(n, {});
    assert.equal(p.nbMots, n);
    assert.equal(p.mots.length, n);
    assert.ok(Math.abs(p.bits - n * Math.log2(MOTS.length)) < 1e-9);
    assert.equal(p.phrase.split('-').length, n);
  }
});

test('le nombre de mots est ramené dans des bornes utilisables', () => {
  assert.equal(P.genererPhrase(1, {}).nbMots, 3);
  assert.equal(P.genererPhrase(99, {}).nbMots, 12);
  assert.equal(P.genererPhrase(0, {}).nbMots, 6, 'valeur par défaut');
  assert.equal(P.genererPhrase(NaN, {}).nbMots, 6);
});

test('les options ajoutent leur entropie, et pas plus', () => {
  const nu = P.genererPhrase(5, {});
  const maj = P.genererPhrase(5, { majuscule: true });
  const chi = P.genererPhrase(5, { chiffre: true });
  /* Une majuscule sur un mot parmi cinq : cinq possibilités, pas davantage. */
  assert.ok(Math.abs((maj.bits - nu.bits) - Math.log2(5)) < 1e-9);
  assert.ok(Math.abs((chi.bits - nu.bits) - Math.log2(50)) < 1e-9);
  assert.ok(/[A-Z]/.test(maj.phrase), 'la majuscule doit être visible');
  assert.ok(/\d/.test(chi.phrase), 'le chiffre doit être visible');
});

test('chaque mot tiré vient bien de la liste', () => {
  const connus = new Set(MOTS);
  for (let i = 0; i < 50; i++) {
    for (const m of P.genererPhrase(6, {}).mots) {
      assert.ok(connus.has(m), `mot hors liste : ${m}`);
    }
  }
});

test('le tirage couvre toute la liste et ne favorise pas le début', () => {
  /* Prendre le reste d’une division rend les premiers mots plus probables.
     Sur un mot de passe, ce biais est un vrai défaut, pas un détail. */
  const n = MOTS.length;
  const compte = new Array(n).fill(0);
  for (let i = 0; i < 40000; i++) compte[P.entier(n)]++;
  assert.equal(compte.filter((c) => c === 0).length, 0, 'des mots jamais tirés');
  const premiere = compte.slice(0, 100).reduce((a, b) => a + b, 0);
  const derniere = compte.slice(-100).reduce((a, b) => a + b, 0);
  const ecart = Math.abs(premiere - derniere) / ((premiere + derniere) / 2);
  assert.ok(ecart < 0.25, `écart début/fin de liste trop marqué : ${(ecart * 100).toFixed(1)} %`);
});

test('deux tirages successifs ne donnent pas la même phrase', () => {
  const vues = new Set();
  for (let i = 0; i < 100; i++) vues.add(P.genererPhrase(6, {}).phrase);
  assert.equal(vues.size, 100, 'phrases répétées : le tirage n’est pas aléatoire');
});

test('les délais du générateur et ceux de l’analyse sortent du même calcul', () => {
  /* Deux formules distinctes finiraient par diverger sans qu’on le voie. */
  const p = P.genererPhrase(6, {});
  assert.deepEqual(p.delais, P.delaisPour(p.essais));
  assert.equal(p.delais.length, Object.keys(P.HYPOTHESES).length);
});

test('les durées se lisent en français, à toutes les échelles', () => {
  assert.equal(P.duree(0.4), 'moins d’une seconde');
  assert.equal(P.duree(90), '1,5 minutes');   /* virgule décimale française */
  assert.equal(P.duree(3600 * 25), '1 jour');
  assert.match(P.duree(31557600 * 5), /^5 ans$/);
  assert.match(P.duree(31557600 * 5e6), /millions d’années/);
  assert.match(P.duree(Infinity), /au-delà/);
});
