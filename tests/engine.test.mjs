/* Tests du moteur. Exécution : node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../assets/js/engine.js');
const profiles = require('../assets/js/profiles.js');
const templates = require('../assets/js/templates.js');
const i18n = require('../assets/js/i18n.js');
const ai = require('../assets/js/ai.js');
const offers = require('../assets/js/offers.js');

test('chaque profil de domaine est complet en FR et en EN', () => {
  assert.ok(profiles.list.length >= 15);
  for (const d of profiles.list) {
    for (const key of ['label', 'persona', 'method', 'constraints', 'quality', 'pitfalls', 'output']) {
      assert.ok(d[key], `${d.id} → ${key} manquant`);
      assert.ok(d[key].fr && d[key].en, `${d.id} → ${key} non bilingue`);
    }
    assert.ok(d.method.fr.length >= 4, `${d.id} → méthode trop courte`);
    assert.equal(d.method.fr.length, d.method.en.length, `${d.id} → méthode désynchronisée`);
  }
});

test('toutes les clés i18n existent dans les deux langues', () => {
  for (const [key, value] of Object.entries(i18n.strings)) {
    assert.ok(value.fr, `${key} → FR manquant`);
    assert.ok(value.en, `${key} → EN manquant`);
  }
});

test('la détection de domaine reconnaît les demandes typiques', () => {
  const cases = [
    ['écris une fonction python qui lit un csv', 'code'],
    ['traduis ce paragraphe en anglais', 'translation'],
    ['rédige un post linkedin sur le télétravail', 'social'],
    ['génère une image de chat astronaute', 'image'],
    ['explique la photosynthèse à un enfant de 8 ans', 'education'],
    ['écris un email de relance à un client', 'email'],
    ['analyse ces données de ventes trimestrielles', 'data'],
    ['write a landing page for my saas product', 'marketing'],
    ['optimise cette page pour le référencement google', 'seo'],
    ['rédige les critères d\'acceptation de cette user story', 'product']
  ];
  for (const [text, expected] of cases) {
    assert.equal(engine.detectDomain(text).id, expected, `« ${text} » mal classé`);
  }
});

test('une demande vide ou insignifiante retombe sur le domaine généraliste', () => {
  assert.equal(engine.detectDomain('').id, 'general');
  assert.equal(engine.detectDomain('bonjour').id, 'general');
});

test('la détection de langue distingue FR et EN', () => {
  assert.equal(engine.detectLanguage('je voudrais un résumé de ce texte'), 'fr');
  assert.equal(engine.detectLanguage('I would like a summary of this text'), 'en');
  assert.equal(engine.detectLanguage(''), null);
});

test('l\'objectif est nettoyé des tournures de politesse', () => {
  assert.equal(engine.toObjective('Peux-tu écrire un mail de relance ?', 'fr'), 'Écrire un mail de relance ?');
  assert.equal(engine.toObjective("J'aimerais que tu me fasses un script", 'fr'), 'Faire un script.');
  assert.equal(engine.toObjective('Can you write a cold email', 'en'), 'Write a cold email.');
  assert.equal(engine.toObjective('Bonjour, rédige une fiche produit', 'fr'), 'Rédige une fiche produit.');
});

test('le sujet visuel est extrait des demandes d\'image', () => {
  assert.equal(engine.toSubject('génère une image de chat astronaute', 'fr'), 'Chat astronaute');
  assert.equal(engine.toSubject('generate an image of a red car', 'en'), 'A red car');
});

test('la demande initiale est toujours conservée mot pour mot', () => {
  const raw = 'Fais-moi un tableau comparatif de 3 CRM pour une PME de 12 personnes';
  for (const format of engine.FORMATS) {
    const out = engine.build(raw, { format });
    assert.ok(out.text.includes(raw), `format ${format} : demande initiale perdue`);
  }
});

test('chaque format produit une sortie non vide et distincte', () => {
  const raw = 'écris un article de 500 mots sur le compostage urbain';
  const seen = new Set();
  for (const format of engine.FORMATS) {
    const out = engine.build(raw, { format });
    assert.ok(out.text.length > 200, `format ${format} trop court`);
    assert.ok(!seen.has(out.text), `format ${format} identique à un autre`);
    seen.add(out.text);
  }
});

test('le format JSON produit un objet JSON valide', () => {
  const out = engine.build('extrais le nom et l\'email de ce texte', { format: 'json' });
  const parsed = JSON.parse(out.text);
  assert.equal(typeof parsed.task, 'string');
  assert.equal(typeof parsed.original_request, 'string');
});

test('le format XML ouvre et ferme chaque balise', () => {
  const out = engine.build('rédige une note de synthèse sur le budget 2026', { format: 'xml' });
  const opened = [...out.text.matchAll(/<([a-z_]+)>/g)].map(m => m[1]);
  const closed = [...out.text.matchAll(/<\/([a-z_]+)>/g)].map(m => m[1]);
  assert.deepEqual(opened, closed);
  assert.ok(opened.length >= 5);
});

test('le prompt généré score plus haut que la demande brute', () => {
  const requests = [
    'un mail pour relancer un client',
    'article blog teletravail',
    'aide moi avec mon budget',
    'code python csv'
  ];
  for (const r of requests) {
    const out = engine.build(r, {});
    assert.ok(out.meta.after > out.meta.before + 25,
      `« ${r} » : ${out.meta.before} → ${out.meta.after}, gain insuffisant`);
    assert.ok(out.meta.after >= 70, `« ${r} » : prompt généré trop faible (${out.meta.after})`);
  }
});

test('le score reste dans les bornes et une demande vide vaut zéro', () => {
  assert.equal(engine.score('', 'fr').total, 0);
  for (const text of ['court', 'a'.repeat(3000), 'Rédige 5 idées pour mon équipe, format tableau, ton direct, sans jargon']) {
    const s = engine.score(text, 'fr');
    assert.ok(s.total >= 0 && s.total <= 100);
    for (const d of s.dimensions) assert.ok(d.value >= 0 && d.value <= 100, `${d.id} hors bornes`);
  }
});

test('les options désactivées retirent bien leurs sections', () => {
  const raw = 'rédige une note interne sur la nouvelle politique de congés';
  const full = engine.build(raw, {});
  const bare = engine.build(raw, {
    flags: { role: false, method: false, quality: false, pitfalls: false, reasoning: false, selfCheck: false },
    clarification: 'none'
  });
  assert.ok(bare.text.length < full.text.length);
  assert.ok(!bare.sections.some(s => s.key === 'role'));
  assert.ok(!bare.sections.some(s => s.key === 'method'));
  assert.ok(full.sections.some(s => s.key === 'quality'));
});

test('la profondeur « direct » supprime la méthode et le raisonnement', () => {
  const out = engine.build('résume ce compte rendu', { depth: 'direct' });
  assert.ok(!out.sections.some(s => s.key === 'method'));
  assert.ok(!out.sections.some(s => s.key === 'reasoning'));
});

test('le domaine peut être forcé et le rôle personnalisé', () => {
  const out = engine.build('un texte quelconque', { domain: 'legal', persona: 'un notaire spécialisé en droit rural' });
  assert.equal(out.analysis.domain.id, 'legal');
  assert.ok(out.text.includes('notaire spécialisé en droit rural'));
});

test('la langue du prompt est respectée', () => {
  const fr = engine.build('write a product description', { lang: 'fr' });
  const en = engine.build('rédige une description produit', { lang: 'en' });
  assert.ok(fr.text.includes('RÔLE') || fr.text.includes('role'));
  assert.ok(en.text.includes('ROLE') || en.text.includes('role'));
  assert.ok(en.text.includes('You are'));
});

test('la langue de réponse demandée apparaît dans les contraintes', () => {
  const out = engine.build('rédige une annonce', { lang: 'fr', answerLang: 'es' });
  assert.ok(out.text.includes('espagnol'));
});

test('le domaine image produit un prompt compact et un negative prompt', () => {
  const out = engine.build('génère une image de phare dans la tempête', {});
  assert.equal(out.analysis.domain.id, 'image');
  assert.ok(out.sections.some(s => s.key === 'brief'));
  assert.ok(out.sections.some(s => s.key === 'negative'));
});

test('tous les modèles de la bibliothèque produisent un prompt solide', () => {
  assert.ok(templates.list.length >= 20);
  for (const tpl of templates.list) {
    for (const lang of ['fr', 'en']) {
      const out = engine.build(tpl.request[lang], Object.assign({ lang }, tpl.opts));
      assert.ok(out.text.length > 300, `${tpl.id}/${lang} trop court`);
      // Le format compact aplatit volontairement la structure : barème un peu plus bas.
      const floor = tpl.opts && tpl.opts.format === 'compact' ? 62 : 70;
      assert.ok(out.meta.after >= floor, `${tpl.id}/${lang} score ${out.meta.after}`);
    }
  }
});

test('les identifiants de modèle de la bibliothèque sont uniques', () => {
  const ids = templates.list.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('les entrées hostiles ne cassent pas le moteur', () => {
  for (const raw of ['', '   ', '<script>alert(1)</script>', '```', '𝔘𝔫𝔦𝔠𝔬𝔡𝔢 ✨', 'a'.repeat(20000), '\n\n\n']) {
    assert.doesNotThrow(() => engine.build(raw, {}));
  }
});

test('la requête Anthropic porte les en-têtes attendus', () => {
  const req = ai.buildRequest('anthropic', { key: 'test-key', model: '', prompt: 'p', lang: 'fr' });
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(req.init.headers['x-api-key'], 'test-key');
  const body = JSON.parse(req.init.body);
  assert.equal(body.model, 'claude-opus-5');
  assert.ok(body.max_tokens > 0);
});

test('la requête OpenAI utilise un jeton Bearer', () => {
  const req = ai.buildRequest('openai', { key: 'k', model: 'some-model', prompt: 'p', lang: 'en' });
  assert.equal(req.init.headers.authorization, 'Bearer k');
  assert.equal(JSON.parse(req.init.body).model, 'some-model');
});

test('l\'extraction de réponse gère les deux formats', () => {
  assert.equal(ai.extractText('anthropic', { content: [{ type: 'text', text: 'A' }, { type: 'thinking' }] }), 'A');
  assert.equal(ai.extractText('openai', { choices: [{ message: { content: 'B' } }] }), 'B');
  assert.equal(ai.extractText('anthropic', {}), '');
});

test('chaque offre est complète et bilingue', () => {
  assert.ok(offers.list.length >= 3);
  for (const o of offers.list) {
    assert.ok(o.id && o.icon, `offre sans id/icône`);
    for (const key of ['title', 'desc', 'cta', 'price']) {
      assert.ok(o[key], `${o.id} → ${key} manquant`);
      assert.ok(o[key].fr && o[key].en, `${o.id} → ${key} non bilingue`);
    }
    assert.equal(typeof o.url, 'string', `${o.id} → url doit être une chaîne`);
  }
});

test('seule une URL https absolue rend une offre affichable', () => {
  const ok = ['https://buy.stripe.com/abc123', 'https://ko-fi.com/nom', 'https://nom.gumroad.com/l/pack'];
  const ko = ['', '   ', 'http://nom.fr', 'javascript:alert(1)', 'data:text/html,x',
              '//nom.fr', 'nom.fr', 'https://exemple.com/x', 'https://example.com/x'];
  for (const url of ok) assert.equal(offers.isLive({ url }), true, `${url} aurait dû passer`);
  for (const url of ko) assert.equal(offers.isLive({ url }), false, `${url} aurait dû être refusé`);
  assert.equal(offers.isLive(null), false);
  assert.equal(offers.isLive({}), false);
});

test('live() ne retient que les offres réellement payables', () => {
  const live = offers.live();
  assert.equal(live.length, offers.list.filter((o) => offers.isLive(o)).length);
  for (const o of live) assert.match(o.url, /^https:\/\//);
  assert.equal(offers.hasLive(), live.length > 0);
});

test('le rappel de configuration ne cible que le local', () => {
  assert.equal(offers.isLocal('localhost', 'http:'), true);
  assert.equal(offers.isLocal('127.0.0.1', 'http:'), true);
  assert.equal(offers.isLocal('', 'file:'), true);
  assert.equal(offers.isLocal('p5wmt65pvz-wq.github.io', 'https:'), false);
  assert.equal(offers.isLocal('promptforge.fr', 'https:'), false);
});
