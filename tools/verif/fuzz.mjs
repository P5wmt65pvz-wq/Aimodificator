/* Fuzzing des moteurs : on jette de l'entrée hostile aux fonctions pures et
   on regarde ce qui plante, ce qui rend NaN ou l'infini, et ce qui boucle.
   Aucun résultat n'est jugé correct ou non — seulement solide ou non.
 *
 * Une précaution qui compte. Une première version envoyait n'importe quoi à
 * n'importe quelle fonction, y compris un Symbol à un analyseur de texte, et
 * rapportait dix-neuf « défauts ». Aucun n'était atteignable : le champ d'un
 * formulaire rend toujours une chaîne, et charger() filtre déjà sa liste. Une
 * suite qui crie au loup est une suite qu'on cesse de lire.
 *
 * Chaque fonction déclare donc ici le domaine qui peut RÉELLEMENT lui
 * parvenir depuis une page. Ce qui sort de ce domaine est signalé à part, à
 * titre d'information, et ne fait pas échouer le contrôle.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(path.join(RACINE, 'x.js'));

const E   = require(path.join(RACINE, 'assets/js/engine.js'));
const EMP = require(path.join(RACINE, 'outils/empreinte/empreinte.js'));
const PHO = require(path.join(RACINE, 'outils/photo/photo.js'));
const CLA = require(path.join(RACINE, 'outils/clause/clause.js'));
const ABO = require(path.join(RACINE, 'outils/abonnements/abonnements.js'));
const PAS = require(path.join(RACINE, 'outils/passe/passe.js'));
const VPX = require(path.join(RACINE, 'outils/vrai-prix/vrai-prix.js'));

const defauts = [], infos = [];

/* ------------------------------------------------- domaines d'entrée réels */

/* Ce que rend un champ de saisie : toujours une chaîne. Plus null et undefined,
   qu'un élément absent du document peut produire. */
const TEXTES = [
  '', ' ', '\n\n\n', '\t', '\u0000', '\u0000abc', 'a'.repeat(100000),
  '�', '‮‭', '🙂'.repeat(500), '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>', '${7*7}', '{{7*7}}', '../../etc/passwd',
  '\\', '\\\\', '%s%s%s', 'NaN', 'Infinity', '-0', '1e308',
  'é'.repeat(5000), 'ÀÉÎÔÛ', 'الْعَرَبِيَّة', '中文测试', '𝕳𝖊𝖑𝖑𝖔',
  '\r\n'.repeat(1000), 'á'.repeat(1000), '[object Object]', 'undefined',
  '-'.repeat(200), '0'.repeat(400), '999999999999999999999999',
  'azerty'.repeat(300), 'Motdepasse2024!'.repeat(50), null, undefined
];

/* Ce que rend un champ numérique, un compteur, un score. */
const NOMBRES = [-1e9, -1, -0.5, 0, 0.5, 1, 99, 100, 101, 1e12, 1e308,
  NaN, Infinity, -Infinity, null, undefined];

/* Ce que rend un lecteur de fichier : des octets, valides ou non. */
const OCTETS = [
  new Uint8Array(0), new Uint8Array([0xFF]), new Uint8Array([0xFF, 0xD8]),
  new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1]),
  new Uint8Array(1000).fill(0xFF), new Uint8Array(1000).fill(0),
  Uint8Array.from({ length: 5000 }, () => Math.floor(Math.random() * 256)),
  Uint8Array.from([0xFF,0xD8, 0xFF,0xE1, 0x00,0x20, ...Array(40).fill(0x41)]),
  /* Longueur de segment qui déborde du fichier. */
  Uint8Array.from([0xFF,0xD8, 0xFF,0xE1, 0xFF,0xFF, 0x00,0x00]),
  /* Longueur nulle : le piège à boucle infinie. */
  Uint8Array.from([0xFF,0xD8, 0xFF,0xE1, 0x00,0x00, 0x00,0x00]),
  null, undefined
];

/* Ce que rend charger() : toujours un tableau, déjà filtré par valide().
   On y met quand même des entrées douteuses, parce qu'une version future du
   format, ou un filtre assoupli, les laisserait passer. */
const ABOS = [
  { nom: 'A', prix: 0, cycle: 'mensuel' },
  { nom: 'B', prix: 1e308, cycle: 'annuel' },
  { nom: 'C', prix: '10', cycle: 'mensuel' },
  { nom: 'D', prix: 10, cycle: 'mensuel', depart: 'pas une date' },
  { nom: 'E', prix: 10, cycle: 'mensuel', depart: '0001-01-01' },
  { nom: 'F', prix: 10, cycle: 'mensuel', depart: '9999-12-31' },
  { nom: 'G', prix: 10, cycle: 'hebdomadaire', depart: '2026-02-29' },
  { nom: 'H', prix: 10, cycle: 'mensuel', depart: '2024-01-31' },
  { nom: 'I'.repeat(100000), prix: 5, cycle: 'mensuel' },
  { nom: 'J', prix: 10, cycle: 'inexistant' },
  {}, null
];

/* Ce que rend une sonde d'Empreinte : une liste de constats. */
const CONSTATS = [
  [], [{}], [{ level: 'critical' }], [{ level: 'inconnu', weight: NaN }],
  [{ level: 'mid', weight: 1e308 }], Array(500).fill({ level: 'low' })
];

/* ------------------------------------------------------------ mécanique */

function apercu(a) {
  if (typeof a === 'string') return `« ${a.slice(0, 20).replace(/\n/g, '\\n')}${a.length > 20 ? '…' : ''} » (${a.length})`;
  if (a instanceof Uint8Array) return `${a.length} octets`;
  try { return (JSON.stringify(a) ?? String(a)).slice(0, 50); } catch { return String(a); }
}

function verifieNombres(nom, r, arg, chemin = '', prof = 0) {
  if (prof > 4 || r === null || r === undefined) return;
  if (typeof r === 'number') {
    if (Number.isNaN(r)) defauts.push(`${nom}${chemin} rend NaN sur ${apercu(arg)}`);
    else if (!Number.isFinite(r)) defauts.push(`${nom}${chemin} rend ${r} sur ${apercu(arg)}`);
    return;
  }
  if (Array.isArray(r)) { r.slice(0, 40).forEach((v, i) => verifieNombres(nom, v, arg, `${chemin}[${i}]`, prof + 1)); return; }
  if (typeof r === 'object') {
    for (const k of Object.keys(r).slice(0, 40)) verifieNombres(nom, r[k], arg, `${chemin}.${k}`, prof + 1);
  }
}

/* `nanAdmis` ne dispense de rien : il déplace la règle d'une couche.

   NaN est un défaut quand il peut atteindre l'écran — c'est le cas par défaut,
   et ça reste vrai pour toute fonction qui rend du texte affichable.

   Mais une fonction de CALCUL a besoin de pouvoir dire « je ne sais pas ».
   Lui faire rendre 0 à la place est pire : 0 est une valeur légitime — un
   abonnement gratuit coûte 0 € — donc 0 confond « gratuit » et « saisie
   illisible », et affiche « 0,00 € sur cinq ans » sur un champ vide. Faux, et
   rassurant.

   Le drapeau n'est donc légitime que si DEUX conditions tiennent, et elles
   sont vérifiées ailleurs, pas ici : la fonction documente NaN comme son
   refus, et la couche d'affichage le convertit (euros() et duree() rendent
   « — », et tests/vrai-prix.test.mjs l'exige sur chaque entrée hostile). */
function eprouve(nom, fn, entrees, options) {
  var nanAdmis = !!(options && options.nanAdmis);
  for (const arg of entrees) {
    const t0 = Date.now();
    let r;
    try { r = fn(arg); }
    catch (e) {
      defauts.push(`${nom} lève « ${e.message} » sur ${apercu(arg)}`);
      continue;
    }
    const dt = Date.now() - t0;
    if (dt > 4000) defauts.push(`${nom} prend ${dt} ms sur ${apercu(arg)}`);
    if (nanAdmis && typeof r === 'number' && Number.isNaN(r)) continue;
    verifieNombres(nom, r, arg);
  }
}

/* ------------------------------------------------------------ les moteurs */

console.log('PromptForge — texte saisi');
for (const [n, f] of Object.entries({
  analyze: (x) => E.analyze(x), normalize: (x) => E.normalize(x),
  detectLanguage: (x) => E.detectLanguage(x), detectDomain: (x) => E.detectDomain(x),
  estimateTokens: (x) => E.estimateTokens(x), toObjective: (x) => E.toObjective(x),
  toSubject: (x) => E.toSubject(x), build: (x) => E.build(x, {})
})) eprouve('engine.' + n, f, TEXTES);
eprouve('engine.build(options)', (o) => E.build('Écris un article', o),
  [null, undefined, {}, { model: 'inexistant' }, { lang: 'xx' }, { format: '???' },
   { model: null, lang: null, format: null }, { model: 123 }, { shape: 'zzz' }]);

console.log('Empreinte — constats des sondes, et scores');
eprouve('empreinte.scoreFrom', (x) => EMP.scoreFrom(x), CONSTATS);
eprouve('empreinte.verdictFor', (x) => EMP.verdictFor(x), NOMBRES);
eprouve('empreinte.niveau', (x) => EMP.niveau(x), NOMBRES);
eprouve('empreinte.shortHash', (x) => EMP.shortHash(x), TEXTES.filter((x) => typeof x === 'string'));

console.log('Clause — texte collé');
eprouve('clause.normalize', (x) => CLA.normalize(x), TEXTES);
eprouve('clause.analyse', (x) => CLA.analyse(x), TEXTES);
eprouve('clause.verdictFor', (x) => CLA.verdictFor(x), NOMBRES);

console.log('Photo — fichier déposé');
eprouve('photo.segments', (x) => PHO.segments(x), OCTETS);
eprouve('photo.analyse', (x) => PHO.analyse(x), OCTETS);
eprouve('photo.strip', (x) => PHO.strip(x), OCTETS);
eprouve('photo.humanSize', (x) => PHO.humanSize(x), NOMBRES);

console.log('Abonnements — liste chargée du stockage');
for (const [n, f] of Object.entries({
  coutMensuel: (x) => ABO.coutMensuel(x), coutAnnuel: (x) => ABO.coutAnnuel(x),
  prochaineEcheance: (x) => ABO.prochaineEcheance(x), valide: (x) => ABO.valide(x)
})) eprouve('abo.' + n, f, ABOS);
eprouve('abo.totaux', (x) => ABO.totaux(x), [ABOS, [], [null], [{}]]);
eprouve('abo.trier', (x) => ABO.trier(x), [ABOS, [], [null], [{}]]);
eprouve('abo.imminents', (x) => ABO.imminents(x), [ABOS, [], [null], [{}]]);
eprouve('abo.euros', (x) => ABO.euros(x), NOMBRES);

console.log('Vrai prix — champs de saisie');

/* Un champ de formulaire rend toujours une chaîne ; les nombres passent par
   les mêmes fonctions une fois la saisie convertie. Les deux domaines sont
   éprouvés, plus les cycles inconnus. */
for (const [n, f] of Object.entries({
  coutMensuel: (x) => VPX.coutMensuel(x, 'mensuel'),
  coutMensuelCycle: (x) => VPX.coutMensuel(10, x),
  cumulPrix: (x) => VPX.cumul(x, 60, 0),
  cumulMois: (x) => VPX.cumul(10, x, 0),
  cumulHausse: (x) => VPX.cumul(10, 60, x),
  basculePrix: (x) => VPX.bascule(x, 249, 0),
  basculeAchat: (x) => VPX.bascule(10, x, 0),
  basculeHausse: (x) => VPX.bascule(10, 249, x),
})) eprouve('vraiprix.' + n, f, [TEXTES, NOMBRES], { nanAdmis: true });

/* La frontière, elle, reste sous la règle stricte : ce qui part à l'écran ne
   peut jamais être NaN. */
for (const [n, f] of Object.entries({
  euros: (x) => VPX.euros(x),
  duree: (x) => VPX.duree(x)
})) eprouve('vraiprix.' + n, f, [TEXTES, NOMBRES]);

console.log('Passe — mot de passe tapé');
eprouve('passe.analyser', (x) => PAS.analyser(x, 'lent'), TEXTES);
eprouve('passe.tailleJeu', (x) => PAS.tailleJeu(String(x ?? '')), TEXTES);
eprouve('passe.duree', (x) => PAS.duree(x), NOMBRES);
eprouve('passe.genererPhrase', (x) => PAS.genererPhrase(x, {}),
  [-1, 0, 0.5, 3, 12, 99, 1e9, NaN, Infinity, null, undefined, '5']);
eprouve('passe.genererPhrase(options)', (o) => PAS.genererPhrase(5, o),
  [null, undefined, {}, { separateur: null }, { separateur: 123 },
   { majuscule: 1, chiffre: 'oui' }, { separateur: 'a'.repeat(1000) }]);
eprouve('passe.analyser(hypothèse)', (h) => PAS.analyser('Motdepasse2024!', h),
  ['lent', 'rapide', 'enligne', '', null, undefined, 'zzz', 123, {}]);

/* -------- pour information : ce qui ne peut PAS arriver depuis une page ---- */
console.log('\nPour information — entrées impossibles depuis une page');
const IMPOSSIBLES = [Symbol('x'), 0n, () => {}, true, false, 0, [1, 2, 3]];
for (const [nom, fn] of [['engine.analyze', (x) => E.analyze(x)],
                          ['empreinte.scoreFrom', (x) => EMP.scoreFrom(x)],
                          ['abo.totaux', (x) => ABO.totaux(x)]]) {
  for (const a of IMPOSSIBLES) {
    try { fn(a); } catch (e) { infos.push(`${nom} lève sur ${apercu(a)} — sans conséquence : la page ne peut pas lui en donner`); }
  }
}
console.log(`  ${infos.length} cas, tous hors du domaine réel`);

console.log('\n' + (defauts.length
  ? `${defauts.length} DÉFAUT(S) :\n - ` + defauts.join('\n - ')
  : 'AUCUN DÉFAUT — les sept moteurs encaissent tout ce qu\'une page peut leur donner'));
process.exit(defauts.length ? 1 : 0);
