/* Tests de la détection de tâche et de ce qu'elle change au prompt.
 *
 * Chaque cas vient d'un défaut constaté sur la version précédente du moteur :
 * « Résume ce texte » produisait un prompt sans aucune place pour le texte,
 * « corrige mon code » sans place pour le code ni l'erreur, et une demande de
 * 5 points recevait une consigne de format contradictoire.
 *
 * Les règles d'écriture vérifiées ici suivent les guides des éditeurs :
 * - Anthropic, « Prompting best practices » (platform.claude.com) : contenu
 *   long au-dessus de la question, balises XML pour délimiter, dire la raison
 *   d'une consigne, pas de majuscules d'alarme.
 * - OpenAI, guides de prompting GPT-4.1 et GPT-5 (dépôt openai-cookbook) :
 *   des consignes contradictoires dégradent la réponse ; consignes au début
 *   et à la fin d'un contenu long. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../assets/js/engine.js');

const section = (out, key) => out.sections.find((s) => s.key === key);
const texte = (out, key) => (section(out, key) || { lines: [] }).lines.join('\n');

test('la tâche est reconnue sur des demandes courantes, en français et en anglais', () => {
  const cas = [
    ['Résume ce texte en 5 points pour mon patron', 'summarize'],
    ['Fais-moi un résumé de cet article pour des lycéens', 'summarize'],
    ['Summarize this report for my team', 'summarize'],
    ['traduis ce mail en anglais', 'translate'],
    ['translate this paragraph into Spanish', 'translate'],
    ['corrige les fautes de ma lettre de motivation', 'rewrite'],
    ['reformule ce paragraphe pour qu\'il soit plus percutant', 'rewrite'],
    ['proofread my essay', 'rewrite'],
    ['analyse ce contrat de bail et dis-moi ce qui est risqué', 'review'],
    ['relis ce code et dis-moi ce qui ne va pas', 'review'],
    ['corrige mon code python qui plante avec KeyError', 'debug'],
    ['fix this python error: KeyError when reading the json', 'debug'],
    ['optimise cette fonction python qui est trop lente', 'refactor'],
    ['extrais les noms et emails de ce document', 'extract'],
    ['analyse ces données de ventes trimestrielles', 'analyze'],
    ['explique la photosynthèse à un enfant de 8 ans', 'explain'],
    ['donne-moi 10 idées de noms pour ma boulangerie', 'brainstorm'],
    ['compare Notion et Obsidian pour un étudiant', 'compare'],
    ['fais-moi un planning de révision pour le bac', 'plan'],
    ['écris un email de relance à un client', 'create'],
    ['rédige une note de synthèse sur le budget 2026', 'create']
  ];
  for (const [demande, attendu] of cas) {
    assert.equal(engine.build(demande, {}).analysis.task.id, attendu, `« ${demande} »`);
  }
});

test('un contenu à traiter reçoit sa place dans le prompt, entre balises', () => {
  const out = engine.build('Résume ce texte en 5 points pour mon patron', {});
  const bloc = texte(out, 'inputs');
  assert.match(bloc, /<document>\n\[Collez ici le texte à résumer\]\n<\/document>/);
  assert.equal(out.meta.placeholders, 1);
  /* Le contenu vient après la consigne courte et avant les instructions
     détaillées ; la tâche est redite en dernier. */
  const ordre = out.sections.map((s) => s.key);
  assert.ok(ordre.indexOf('objective') < ordre.indexOf('inputs'));
  assert.ok(ordre.indexOf('inputs') < ordre.indexOf('method'));
  assert.equal(ordre[ordre.length - 1], 'reminder');
  assert.match(texte(out, 'reminder'), /Résume ce texte en 5 points/);
});

test('un prompt de débogage demande le code ET le message d\'erreur', () => {
  const out = engine.build('corrige mon code python qui plante avec KeyError', {});
  const bloc = texte(out, 'inputs');
  assert.match(bloc, /<code>[\s\S]*\[Collez ici le code concerné\][\s\S]*<\/code>/);
  assert.match(bloc, /<erreur>[\s\S]*message d'erreur complet[\s\S]*<\/erreur>/);
  assert.equal(out.meta.placeholders, 2);
  assert.match(texte(out, 'method'), /cause racine/);
});

test('un contenu à fournir absent fait demander, pas inventer', () => {
  const out = engine.build('traduis ce mail en anglais', {});
  assert.match(texte(out, 'constraints'), /absent ou encore entre crochets, demande-le/);
});

test('un contenu déjà collé dans la demande n\'appelle aucun emplacement', () => {
  const out = engine.build('Traduis : Bonjour, je voudrais réserver une table pour deux personnes ce soir.', {});
  assert.equal(out.meta.placeholders, 0);
  assert.ok(!section(out, 'inputs'));
  assert.match(texte(out, 'objective'), /figure dans la demande initiale/);
  /* « une table » appartient au texte à traduire, pas à la consigne. */
  assert.doesNotMatch(texte(out, 'output'), /Tableau/);
});

test('les créations sans contenu désigné n\'ont aucun emplacement', () => {
  for (const d of ['écris un email de relance à un client', 'donne-moi 5 conseils pour mieux dormir', 'c\'est quoi une API ?']) {
    const out = engine.build(d, {});
    assert.equal(out.meta.placeholders, 0, d);
    assert.ok(!section(out, 'inputs'), d);
  }
});

test('une quantité exigée remplace le format habituel du domaine, sans contradiction', () => {
  const out = engine.build('Résume ce texte en 5 points pour mon patron', {});
  const sortie = texte(out, 'output');
  assert.match(sortie, /exactement 5 points/);
  /* Le format « Synthèse en tête (5 lignes), puis analyse… » du domaine
     recherche contredisait les 5 points demandés. */
  assert.doesNotMatch(sortie, /Synthèse en tête|tableau comparatif/);
});

test('le nombre est recopié avec l\'orthographe de la demande', () => {
  const out = engine.build('donne-moi 10 idées de noms pour ma boulangerie', {});
  assert.match(texte(out, 'output'), /exactement 10 idées de noms/);
});

test('le public nommé dans la demande est repris, avec la raison de le viser', () => {
  const cas = [
    ['Résume ce texte pour mon patron', 'mon patron'],
    ['explique la photosynthèse à un enfant de 8 ans', 'un enfant de 8 ans'],
    ['écris un mail à mon propriétaire pour signaler une fuite', 'mon propriétaire'],
    ['Summarize this report for my team', 'my team']
  ];
  for (const [d, public_] of cas) {
    const out = engine.build(d, {});
    assert.equal(out.analysis.extras.audience, public_, d);
    assert.match(texte(out, 'context'), /Adapte|Adapt/, d);
  }
  /* « pour faire » ou « pour que » ne sont pas des publics. */
  assert.equal(engine.extractAudience('écris un texte pour faire rire'), '');
});

test('une forme de sortie ne s\'impose que si la consigne la demande en toutes lettres', () => {
  assert.match(texte(engine.build('Fais-moi un tableau comparatif de 3 CRM', {}), 'output'), /tableau/i);
  assert.match(texte(engine.build('extrais les noms de ce document en JSON', {}), 'output'), /JSON/);
  /* Un fichier JSON lu par le code n'est pas une réponse en JSON. */
  assert.doesNotMatch(texte(engine.build('écris une fonction python qui lit un fichier json', {}), 'output'), /unique objet JSON/);
  assert.doesNotMatch(texte(engine.build('fix this python error: KeyError when reading the json', {}), 'output'), /unique objet JSON/);
});

test('« en anglais » fixe la langue de la réponse sans faire de la demande une traduction', () => {
  const out = engine.build('écris un mail en anglais à mon propriétaire pour signaler une fuite', {});
  assert.equal(out.analysis.task.id, 'create');
  assert.equal(out.analysis.domain.id, 'email');
  assert.match(texte(out, 'constraints'), /Langue de la réponse : anglais/);
  const tr = engine.build('traduis ce paragraphe en espagnol', {});
  assert.match(texte(tr, 'constraints'), /Langue cible : espagnol/);
});

test('du code à relire est confié à un développeur, pas à un traducteur', () => {
  const out = engine.build('relis ce code et dis-moi ce qui ne va pas', {});
  assert.equal(out.analysis.domain.id, 'code');
  assert.doesNotMatch(texte(out, 'constraints'), /imports et la configuration/);
});

test('les informations manquantes sont nommées une à une', () => {
  const out = engine.build('résume ce compte rendu de réunion', {});
  assert.match(texte(out, 'clarify'), /longueur du résumé/);
  assert.match(texte(out, 'clarify'), /lecteur visé/);
  const ask = engine.build('résume ce compte rendu de réunion', { clarification: 'ask' });
  assert.match(texte(ask, 'clarify'), /pose au maximum 3 questions courtes, en priorité sur : la longueur du résumé/);
  /* Rien à demander quand la demande dit déjà tout. */
  assert.doesNotMatch(texte(engine.build('Résume ce texte en 5 points pour mon patron', {}), 'clarify'), /ne précise pas/);
});

test('la correction seule ne touche pas au style', () => {
  const out = engine.build('corrige les fautes de ma lettre de motivation', {});
  assert.ok(out.analysis.task.proofread);
  assert.match(texte(out, 'method'), /Ne touche pas au style/);
  assert.equal(section(out, 'inputs').title, 'LETTRE À CORRIGER');
});

test('aucune majuscule d\'alarme, aucune consigne contradictoire sur le début de la réponse', () => {
  const demandes = ['Résume ce texte', 'écris une fonction python', 'donne-moi 5 idées', 'write a cold email', 'analyse ce contrat'];
  for (const d of demandes) {
    for (const lang of ['fr', 'en']) {
      const out = engine.build(d, { lang });
      assert.doesNotMatch(out.text, /ABSOLUMENT|MUST AVOID|CRITICAL/, `${d}/${lang}`);
      /* « pas de rappel des consignes » contredisait les méthodes qui font
         reformuler le besoin ; « pas de préambule » contredisait la liste
         d'hypothèses demandée en tête. */
      assert.doesNotMatch(out.text, /pas de rappel des consignes|no restating the instructions/, `${d}/${lang}`);
    }
  }
});

test('une seule règle contre l\'invention par prompt', () => {
  for (const d of ['analyse les tendances du marché du vélo', 'corrige mon code python qui plante', 'résume ce texte']) {
    const cons = texte(engine.build(d, {}), 'constraints');
    const regles = (cons.match(/N'invente|N'ajoute aucune information/g) || []).length;
    assert.ok(regles <= 1, `« ${d} » : ${regles} règles contre l'invention`);
  }
});

test('chaque tâche est complète et bilingue', () => {
  for (const [id, t] of Object.entries(engine.TASKS)) {
    assert.ok(t.label.fr && t.label.en, `${id} : libellé`);
    for (const k of ['method', 'constraints', 'quality', 'pitfalls', 'output', 'proofread']) {
      if (!t[k]) continue;
      assert.ok(t[k].fr && t[k].en, `${id} → ${k} non bilingue`);
      if (Array.isArray(t[k].fr)) assert.equal(t[k].fr.length, t[k].en.length, `${id} → ${k} désynchronisé`);
    }
    if (t.family === 'transform') {
      for (const k of ['persona', 'method', 'constraints', 'quality', 'pitfalls', 'output']) assert.ok(t[k], `${id} → ${k} manquant`);
    }
  }
});

test('le compte des emplacements correspond au texte, dans tous les formats', () => {
  for (const format of engine.FORMATS) {
    const out = engine.build('corrige mon code python qui plante avec KeyError', { format });
    assert.equal(out.meta.placeholders, engine.countPlaceholders(out.text), format);
    assert.equal(out.meta.placeholders, 2, format);
  }
});

test('analyser des données n\'est pas critiquer un document', () => {
  const out = engine.build('analyse ces données de ventes et sors un tableau des trois écarts', {});
  assert.equal(out.analysis.task.id, 'analyze');
  assert.equal(section(out, 'inputs').title, 'DONNÉES À ANALYSER');
  /* La méthode vient du domaine des données, pas de la grille de critique. */
  assert.doesNotMatch(texte(out, 'output'), /verdict|points forts/);
  assert.match(texte(out, 'output'), /Tableau/);
  assert.equal(engine.build('analyse ce contrat de bail', {}).analysis.task.id, 'review');
});

test('le moteur reste rapide sur un texte énorme et sans structure', () => {
  /* Une règle en « [a-z]+error » reparcourait le texte depuis chaque lettre :
     14 secondes sur 100 000 « a ». Chaque cas ci-dessous a coûté au moins
     une seconde à une version du moteur. */
  for (const s of ['a'.repeat(100000), '[coller '.repeat(12000), '[Collez ici '.repeat(8000), '«'.repeat(100000)]) {
    const t = Date.now();
    engine.build(s, {});
    assert.ok(Date.now() - t < 3000, `${JSON.stringify(s.slice(0, 10))} : ${Date.now() - t} ms`);
  }
});
