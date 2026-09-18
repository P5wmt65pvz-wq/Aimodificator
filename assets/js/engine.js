/*!
 * PromptForge — moteur d'analyse et de construction de prompts.
 * 100 % déterministe, exécuté localement : aucune donnée ne quitte le navigateur.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function profiles() {
    if (root.PF && root.PF.profiles) return root.PF.profiles;
    if (typeof require === 'function') return require('./profiles.js');
    throw new Error('PF.profiles is required');
  }

  /* ------------------------------------------------------------------ utils */

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasWord(haystack, needle) {
    if (needle.indexOf(' ') !== -1 || needle.indexOf("'") !== -1) {
      return haystack.indexOf(needle) !== -1;
    }
    var re = new RegExp('(^|[^a-z0-9])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|x)?([^a-z0-9]|$)');
    return re.test(haystack);
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /** Estimation grossière du coût en jetons (~4 caractères par jeton). */
  function estimateTokens(text) { return Math.round(String(text || '').length / 4); }

  /* --------------------------------------------------------------- language */

  var FR_MARKERS = ['le ', 'la ', 'les ', 'un ', 'une ', 'des ', 'du ', 'je ', 'tu ', 'nous ', 'vous ', 'pour ',
    'avec ', 'dans ', 'sur ', 'est ', 'sont ', 'que ', 'qui ', 'pas ', 'plus ', 'mon ', 'ma ', 'mes ', 'ce ',
    'cette ', 'comment ', 'pourquoi ', 'faire ', 'peux ', 'veux ', 'ecrire ', 'creer '];
  var EN_MARKERS = ['the ', 'a ', 'an ', 'of ', 'to ', 'and ', 'i ', 'you ', 'we ', 'for ', 'with ', 'in ', 'on ',
    'is ', 'are ', 'that ', 'which ', 'not ', 'more ', 'my ', 'this ', 'how ', 'why ', 'make ', 'can ', 'want ',
    'write ', 'create '];

  function detectLanguage(text) {
    var t = ' ' + normalize(text) + ' ';
    var fr = 0, en = 0, i;
    for (i = 0; i < FR_MARKERS.length; i++) if (t.indexOf(' ' + FR_MARKERS[i]) !== -1) fr++;
    for (i = 0; i < EN_MARKERS.length; i++) if (t.indexOf(' ' + EN_MARKERS[i]) !== -1) en++;
    if (/[àâçéèêëîïôûùüœ]/i.test(text)) fr += 2;
    if (fr === 0 && en === 0) return null;
    return en > fr ? 'en' : 'fr';
  }

  /* ----------------------------------------------------------- domain match */

  /* Verbes d'action communs à tous les domaines : ils disent ce qu'on veut faire,
     pas de quoi il s'agit. On les compte, mais très faiblement. */
  var GENERIC_VERBS = ['ecrire', 'ecris', 'redige', 'rediger', 'creer', 'cree', 'faire', 'fais', 'genere',
    'generer', 'propose', 'proposer', 'write', 'writing', 'create', 'make', 'draft', 'generate', 'build'];

  function detectDomain(text) {
    var t = ' ' + normalize(text) + ' ';
    var head = t.slice(0, 90);
    var scores = {};
    var best = { id: 'general', score: 0 };

    profiles().list.forEach(function (d) {
      var s = 0;
      d.keywords.forEach(function (k) {
        var key = normalize(k);
        if (!key) return;
        if (!hasWord(t, key)) return;
        if (GENERIC_VERBS.indexOf(key) !== -1) { s += 1; return; }
        s += key.indexOf(' ') !== -1 ? 3 : 2;
        if (hasWord(head, key)) s += 1.5;
        // un mot-clé qui ouvre la demande porte l'intention principale
        if (t.indexOf(' ' + key) === 0 || t.indexOf(' ' + key) === 1) s += 1.5;
      });
      scores[d.id] = s;
      if (s > best.score) best = { id: d.id, score: s };
    });

    var ranked = Object.keys(scores)
      .filter(function (id) { return scores[id] > 0; })
      .sort(function (a, b) { return scores[b] - scores[a]; });

    var confidence = 0;
    if (best.score > 0) {
      var second = ranked.length > 1 ? scores[ranked[1]] : 0;
      confidence = clamp(Math.round((best.score / (best.score + second + 4)) * 100), 20, 97);
    }
    if (best.score < 2) { best.id = 'general'; confidence = 0; }

    return { id: best.id, score: best.score, confidence: confidence, scores: scores, ranked: ranked.slice(0, 3) };
  }

  /* --------------------------------------------------------------- signals */

  var SIGNAL_RULES = {
    quantity: /((?:\d{1,3}(?:[ .,]\d{3})+)|\d+)\s*(mots?|words?|caracteres?|characters?|signes?|lignes?|lines?|pages?|slides?|diapositives?|minutes?|secondes?|seconds?|paragraphes?|paragraphs?)/g,
    count: /(\d+)\s*(idees?|ideas?|exemples?|examples?|points?|conseils?|tips?|variantes?|variants?|options?|etapes?|steps?|questions?)/g,
    format: /\b(json|xml|yaml|csv|markdown|tableau|table|liste a puces|bullet points?|bullet|liste|list|code|schema|diagramme|diagram|slides?)\b/g,
    tone: /\b(formel|informel|professionnel|amical|humoristique|drole|serieux|percutant|chaleureux|neutre|direct|academique|familier|persuasif|inspirant|formal|casual|friendly|funny|serious|punchy|professional|persuasive)\b/g,
    audience: /\b(pour (?:des |les |un |une |mon |ma |mes |le |la )?[a-zàâçéèêëîïôûùüœ\-]+(?: [a-zàâçéèêëîïôûùüœ\-]+)?|for (?:a |an |the |my )?[a-z\-]+(?: [a-z\-]+)?|debutants?|beginners?|experts?|enfants?|kids?|etudiants?|students?|clients?|investisseurs?|investors?|recruteurs?|developpeurs?|developers?)\b/g,
    deadline: /\b(avant (?:le |la )?\S+|d'ici \S+|deadline|urgent|aujourd'hui|demain|cette semaine|by (?:monday|tomorrow|friday|next week))\b/g,
    language: /\b(anglais|english|francais|french|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|chinois|chinese|japonais|japanese|arabe|arabic|russe|russian|neerlandais|dutch)\b/g
  };

  function extractSignals(text) {
    var t = normalize(text);
    var out = {};
    Object.keys(SIGNAL_RULES).forEach(function (key) {
      var re = new RegExp(SIGNAL_RULES[key].source, 'g');
      var found = [], m;
      while ((m = re.exec(t)) !== null) {
        found.push(m[0].trim());
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      out[key] = uniq(found).slice(0, 6);
    });
    out.numbers = uniq((t.match(/\b\d+([.,]\d+)?\s*(%|€|\$|k|m)?\b/g) || [])).slice(0, 8);
    out.propernouns = uniq((String(text).match(/(?!^)\b[A-ZÀ-Ý][a-zà-ÿ]{2,}\b/g) || [])).slice(0, 8);
    out.quoted = uniq((String(text).match(/["“«]([^"”»]{3,120})["”»]/g) || [])).slice(0, 4);
    return out;
  }

  /* ------------------------------------------------------------- scoring */

  var DIM_LABELS = {
    clarity: { fr: 'Clarté de la demande', en: 'Clarity of the request' },
    context: { fr: 'Contexte fourni', en: 'Context provided' },
    specificity: { fr: 'Précision & détails', en: 'Specificity & detail' },
    audience: { fr: 'Public cible', en: 'Target audience' },
    format: { fr: 'Format attendu', en: 'Expected format' },
    constraints: { fr: 'Contraintes & limites', en: 'Constraints & limits' },
    examples: { fr: 'Exemples / références', en: 'Examples / references' },
    success: { fr: 'Critère de réussite', en: 'Success criterion' }
  };

  var DIM_TIPS = {
    clarity: { fr: 'Commencez par un verbe d\'action et une seule demande principale.', en: 'Start with an action verb and a single main request.' },
    context: { fr: 'Expliquez la situation : qui vous êtes, à quoi servira le résultat, ce qui a déjà été essayé.', en: 'Explain the situation: who you are, what the result is for, what was already tried.' },
    specificity: { fr: 'Ajoutez des éléments concrets : chiffres, noms, versions, périmètre exact.', en: 'Add concrete elements: numbers, names, versions, exact scope.' },
    audience: { fr: 'Précisez pour qui est le résultat : son niveau, son rôle, ce qu\'il connaît déjà.', en: 'State who the result is for: their level, role and prior knowledge.' },
    format: { fr: 'Indiquez la forme attendue : longueur, structure, tableau, JSON, liste…', en: 'State the expected shape: length, structure, table, JSON, list…' },
    constraints: { fr: 'Posez les limites : ton, longueur maximale, ce qu\'il ne faut surtout pas faire.', en: 'Set the limits: tone, maximum length, what must not happen.' },
    examples: { fr: 'Donnez un exemple de ce que vous voulez — ou de ce que vous ne voulez pas.', en: 'Give one example of what you want — or of what you do not want.' },
    success: { fr: 'Dites à quoi vous verrez que la réponse est réussie.', en: 'Say how you will know the answer is a success.' }
  };

  var WEIGHTS = { clarity: 0.18, context: 0.16, specificity: 0.16, format: 0.12, constraints: 0.12, audience: 0.10, examples: 0.08, success: 0.08 };

  var ACTION_VERBS = ['ecris', 'ecrire', 'redige', 'rediger', 'cree', 'creer', 'genere', 'generer', 'analyse', 'analyser',
    'explique', 'expliquer', 'resume', 'resumer', 'traduis', 'traduire', 'compare', 'comparer', 'liste', 'lister',
    'propose', 'proposer', 'corrige', 'corriger', 'optimise', 'optimiser', 'calcule', 'calculer', 'conçois', 'concevoir',
    'planifie', 'planifier', 'developpe', 'developper', 'ameliore', 'ameliorer', 'transforme', 'convertis', 'trouve',
    'write', 'create', 'generate', 'analyze', 'analyse', 'explain', 'summarize', 'translate', 'compare', 'list',
    'propose', 'fix', 'optimize', 'calculate', 'design', 'plan', 'build', 'improve', 'convert', 'find', 'draft', 'review'];

  var CONTEXT_MARKERS = ['je suis', 'nous sommes', 'mon entreprise', 'ma societe', 'dans le cadre', 'actuellement',
    'le probleme', 'contexte', 'aujourd\'hui je', 'j\'ai deja', 'nous avons', 'mon equipe', 'notre', 'parce que',
    'car ', 'suite a', 'i am', 'we are', 'my company', 'currently', 'the problem', 'context', 'we have', 'because',
    'my team', 'our '];

  var CONSTRAINT_MARKERS = ['sans ', 'ne pas', 'maximum', 'minimum', 'au plus', 'au moins', 'moins de', 'doit ',
    'obligatoire', 'interdit', 'eviter', 'il faut', 'imperatif', 'limite', 'ton ', 'style ', 'contrainte',
    'without', 'do not', 'don\'t', 'no more than', 'at least', 'must ', 'required', 'avoid', 'limit', 'tone ', 'constraint'];

  var EXAMPLE_MARKERS = ['par exemple', 'comme ceci', 'voici', 'ci-dessous', 'inspire de', 'dans le style de',
    'similaire a', 'exemple :', 'modele :', 'for example', 'e.g.', 'like this', 'such as', 'inspired by',
    'similar to', 'here is', 'sample:'];

  var SUCCESS_MARKERS = ['objectif', 'afin de', 'pour que', 'le but', 'resultat attendu', 'je veux obtenir',
    'reussi si', 'ideal serait', 'j\'attends', 'livrable', 'goal', 'so that', 'in order to', 'the aim',
    'expected result', 'success', 'i want to get', 'i expect', 'objective', 'deliverable', 'outcome'];

  var FORMAT_MARKERS = ['json', 'tableau', 'table', 'liste', 'list', 'markdown', 'csv', 'xml', 'yaml', 'bullet',
    'puces', 'paragraphe', 'paragraph', 'sections', 'plan', 'outline', 'slides', 'email', 'code', 'schema'];

  var AUDIENCE_MARKERS = ['pour des', 'pour les', 'pour un', 'pour une', 'a destination de', 's\'adresse a',
    'debutant', 'expert', 'enfant', 'etudiant', 'client', 'investisseur', 'recruteur', 'developpeur', 'grand public',
    'for beginners', 'for experts', 'for children', 'for students', 'for clients', 'audience', 'aimed at', 'targeted at'];

  function anyMarker(t, markers) {
    for (var i = 0; i < markers.length; i++) if (t.indexOf(markers[i]) !== -1) return true;
    return false;
  }
  function countMarkers(t, markers) {
    var n = 0;
    for (var i = 0; i < markers.length; i++) if (t.indexOf(markers[i]) !== -1) n++;
    return n;
  }

  /**
   * Note la qualité d'une demande sur 8 dimensions. Le même barème est appliqué
   * à la demande brute et au prompt généré : la comparaison est donc honnête.
   */
  function scoreText(text, lang) {
    var raw = String(text || '');
    var t = ' ' + normalize(raw) + ' ';
    var words = t.split(' ').filter(Boolean).length;
    var signals = extractSignals(raw);
    var dims = {};

    // Clarté : longueur exploitable + verbe d'action + demande lisible
    var clarity = 0;
    if (words >= 4) clarity += 25;
    if (words >= 10) clarity += 20;
    if (words >= 20) clarity += 10;
    if (words > 900) clarity -= 15;
    if (anyMarker(t, ACTION_VERBS.map(function (v) { return ' ' + v; }))) clarity += 30;
    if (/[.?!]/.test(raw)) clarity += 10;
    if (raw.trim().length > 0 && words < 4) clarity += 5;
    dims.clarity = clamp(clarity, 0, 100);

    // Contexte
    var ctx = clamp(countMarkers(t, CONTEXT_MARKERS) * 22, 0, 66);
    if (words >= 40) ctx += 17;
    if (words >= 90) ctx += 17;
    dims.context = clamp(ctx, 0, 100);

    // Spécificité
    var spec = 0;
    spec += clamp(signals.numbers.length * 14, 0, 42);
    spec += clamp(signals.propernouns.length * 10, 0, 30);
    spec += clamp(signals.quantity.length * 14, 0, 28);
    if (words >= 25) spec += 10;
    dims.specificity = clamp(spec, 0, 100);

    // Public cible
    dims.audience = clamp(countMarkers(t, AUDIENCE_MARKERS) * 45 + (signals.audience.length ? 30 : 0), 0, 100);

    // Format attendu
    dims.format = clamp(countMarkers(t, FORMAT_MARKERS) * 34 + signals.quantity.length * 22, 0, 100);

    // Contraintes
    dims.constraints = clamp(countMarkers(t, CONSTRAINT_MARKERS) * 26 + signals.tone.length * 22, 0, 100);

    // Exemples
    dims.examples = clamp(countMarkers(t, EXAMPLE_MARKERS) * 45 + signals.quoted.length * 30, 0, 100);

    // Critère de réussite
    dims.success = clamp(countMarkers(t, SUCCESS_MARKERS) * 40, 0, 100);

    var total = 0;
    Object.keys(WEIGHTS).forEach(function (k) { total += dims[k] * WEIGHTS[k]; });
    if (!raw.trim()) total = 0;

    var l = lang === 'en' ? 'en' : 'fr';
    var dimensions = Object.keys(WEIGHTS).map(function (k) {
      return {
        id: k,
        label: DIM_LABELS[k][l],
        value: Math.round(dims[k]),
        weight: WEIGHTS[k],
        tip: dims[k] < 55 ? DIM_TIPS[k][l] : null
      };
    }).sort(function (a, b) { return a.value - b.value; });

    return { total: Math.round(total), dimensions: dimensions, words: words, chars: raw.length };
  }

  function grade(total, lang) {
    var l = lang === 'en' ? 'en' : 'fr';
    var scale = [
      { max: 34, key: 'critical', fr: 'Trop vague', en: 'Too vague' },
      { max: 54, key: 'serious', fr: 'Perfectible', en: 'Needs work' },
      { max: 74, key: 'warning', fr: 'Correct', en: 'Decent' },
      { max: 89, key: 'good', fr: 'Solide', en: 'Solid' },
      { max: 101, key: 'good', fr: 'Excellent', en: 'Excellent' }
    ];
    for (var i = 0; i < scale.length; i++) if (total <= scale[i].max) return { key: scale[i].key, label: scale[i][l] };
    return { key: 'good', label: scale[4][l] };
  }

  /* -------------------------------------------------------------- analyse */

  function analyze(text, opts) {
    opts = opts || {};
    var detectedLang = detectLanguage(text);
    var lang = opts.lang || detectedLang || 'fr';
    var domain = detectDomain(text);
    if (opts.domain && opts.domain !== 'auto') {
      domain = { id: opts.domain, score: domain.score, confidence: 100, scores: domain.scores, ranked: domain.ranked, forced: true };
    }
    var sc = scoreText(text, lang);
    return {
      lang: lang,
      detectedLang: detectedLang,
      domain: domain,
      profile: profiles().get(domain.id),
      signals: extractSignals(text),
      score: sc,
      grade: grade(sc.total, lang)
    };
  }

  /* --------------------------------------------------------- objective text */

  var POLITE_FR = /^(bonjour|salut|coucou|hello|hey|hi)\b[\s,!.:-]*/i;
  var LEAD_FR = /^(est-ce que tu (peux|pourrais)|peux[- ]?tu|pourrais[- ]?tu|j'?\s?aimerais que tu|je voudrais que tu|je veux que tu|il faudrait que tu|tu peux|tu pourrais|j'?\s?aimerais|je voudrais|je veux|merci de|s'?il te pla[iî]t,?|stp,?|fais[- ]moi|donne[- ]moi|aide[- ]moi [aà]|que tu me |que tu )\s*/i;
  var LEAD_EN = /^(can you|could you|would you|please|i want you to|i'?d like you to|i would like you to|i need you to|i want|i need|help me to|help me|give me|make me)\s+/i;

  /* Formes conjuguées fréquentes après « que tu … » → infinitif.
     Table fermée : on ne conjugue jamais au hasard. */
  var SUBJUNCTIVE_FR = {
    fasses: 'faire', fasse: 'faire', ecrives: 'écrire', rediges: 'rédiger', crees: 'créer',
    generes: 'générer', expliques: 'expliquer', traduises: 'traduire', analyses: 'analyser',
    proposes: 'proposer', donnes: 'donner', corriges: 'corriger', ameliores: 'améliorer',
    resumes: 'résumer', listes: 'lister', trouves: 'trouver', developpes: 'développer',
    concoives: 'concevoir', prepares: 'préparer', montres: 'montrer', aides: 'aider',
    verifies: 'vérifier', optimises: 'optimiser', transformes: 'transformer', calcules: 'calculer',
    construises: 'construire', mettes: 'mettre', prennes: 'prendre', puisses: 'pouvoir',
    reformules: 'reformuler', simplifies: 'simplifier', compares: 'comparer', planifies: 'planifier'
  };

  function deconjugate(s) {
    var m = s.match(/^([A-Za-zÀ-ÿ']+)(\s|$)/);
    if (!m) return s;
    var inf = SUBJUNCTIVE_FR[normalize(m[1])];
    return inf ? inf + s.slice(m[1].length) : s;
  }

  function toObjective(text, lang) {
    var s = String(text || '').trim().replace(/\s+/g, ' ');
    s = s.replace(POLITE_FR, '');
    var prev;
    do { prev = s; s = s.replace(lang === 'en' ? LEAD_EN : LEAD_FR, ''); } while (s !== prev);
    if (lang !== 'en') s = s.replace(LEAD_EN, '');
    else s = s.replace(LEAD_FR, '');
    s = s.replace(/^(que tu |que vous )/i, '');
    s = s.replace(/^(m'|m |me |moi |nous |te |t'|lui )\s*/i, '');
    s = s.replace(/^(de |d'|à |a )/i, '');
    if (lang !== 'en') s = deconjugate(s.trim());
    s = cap(s.trim());
    if (s && !/[.?!]$/.test(s)) s += '.';
    return s;
  }

  var IMG_LEAD_FR = /^(g[ée]n[eè]r[e]r?|cr[eé]e(?:r)?|dessine(?:r)?|fais|produis|r[eé]alise|imagine)\s+(moi\s+)?(une?\s+|le\s+|la\s+|un\s+)?(image|illustration|photo(?:graphie)?|dessin|visuel|logo|affiche|poster|rendu|artwork|miniature|banni[eè]re)\s*(de\s+|d['’]\s*|d\s+(?=une?\s)|du\s+|des\s+|qui\s+|avec\s+|montrant\s+|repr[eé]sentant\s+|:\s*)?/i;
  var IMG_LEAD_EN = /^(generate|create|draw|make|render|design)\s+(me\s+)?(an?\s+|the\s+)?(image|picture|illustration|photo(?:graph)?|drawing|visual|logo|poster|artwork|thumbnail|banner)\s*(of\s+|showing\s+|with\s+|:\s*)?/i;

  /** Extrait le sujet visuel d'une demande d'image (« génère une image de X » → « X »). */
  function toSubject(text, lang) {
    var s = toObjective(text, lang).replace(/\.$/, '');
    var stripped = s.replace(lang === 'en' ? IMG_LEAD_EN : IMG_LEAD_FR, '');
    if (stripped === s) stripped = s.replace(lang === 'en' ? IMG_LEAD_FR : IMG_LEAD_EN, '');
    stripped = stripped.trim();
    return cap(stripped || s);
  }

  /* ------------------------------------------------------------- vocabulary */

  var L = {
    role: { fr: 'RÔLE', en: 'ROLE' },
    context: { fr: 'CONTEXTE', en: 'CONTEXT' },
    objective: { fr: 'OBJECTIF', en: 'OBJECTIVE' },
    method: { fr: 'MÉTHODE — suis ces étapes dans l\'ordre', en: 'METHOD — follow these steps in order' },
    inputs: { fr: 'ÉLÉMENTS FOURNIS', en: 'PROVIDED INPUTS' },
    constraints: { fr: 'CONTRAINTES', en: 'CONSTRAINTS' },
    output: { fr: 'FORMAT DE SORTIE', en: 'OUTPUT FORMAT' },
    quality: { fr: 'CRITÈRES DE QUALITÉ — vérifie-les avant de répondre', en: 'QUALITY BAR — check these before answering' },
    avoid: { fr: 'À ÉVITER ABSOLUMENT', en: 'MUST AVOID' },
    examples: { fr: 'EXEMPLES', en: 'EXAMPLES' },
    clarify: { fr: 'INFORMATIONS MANQUANTES', en: 'MISSING INFORMATION' },
    reasoning: { fr: 'RAISONNEMENT', en: 'REASONING' },
    check: { fr: 'VÉRIFICATION FINALE', en: 'FINAL CHECK' }
  };

  var XML_TAGS = {
    role: 'role', context: 'context', objective: 'objective', method: 'method', inputs: 'inputs',
    constraints: 'constraints', output: 'output_format', quality: 'quality_bar', avoid: 'avoid',
    examples: 'examples', clarify: 'missing_info', reasoning: 'reasoning', check: 'final_check',
    brief: 'prompt', subject: 'subject', composition: 'composition', light: 'lighting',
    style: 'style', tech: 'technical_parameters', negative: 'negative_prompt'
  };

  var T = {
    youAre: { fr: 'Tu es ', en: 'You are ' },
    initialRequest: { fr: 'Demande initiale de l\'utilisateur, mot pour mot : ', en: 'The user\'s original request, verbatim: ' },
    audience: { fr: 'Public cible : ', en: 'Target audience: ' },
    tone: { fr: 'Ton et registre : ', en: 'Tone and register: ' },
    length: { fr: 'Longueur visée : ', en: 'Target length: ' },
    lang: { fr: 'Langue de la réponse : ', en: 'Answer in: ' },
    model: { fr: 'Destiné à : ', en: 'Intended for: ' },
    fmt: { fr: 'Structure attendue : ', en: 'Expected structure: ' },
    noHallu: {
      fr: 'N\'invente aucun fait, chiffre, source, citation, référence ni date. Si une information te manque, écris explicitement ce qui manque plutôt que de combler le vide.',
      en: 'Invent no fact, figure, source, quotation, reference or date. If information is missing, say what is missing rather than filling the gap.'
    },
    cotLight: { fr: 'Réfléchis à la structure de ta réponse avant de l\'écrire ; ne montre pas ce travail préparatoire.', en: 'Think through the structure of your answer before writing it; do not show that scratch work.' },
    cotDeep: {
      fr: 'Raisonne étape par étape avant de conclure. Pose d\'abord le problème, explore au moins deux approches, retiens la meilleure et explique ce choix en une phrase. Puis rédige la réponse finale.',
      en: 'Reason step by step before concluding. Frame the problem, explore at least two approaches, pick the best and justify that choice in one sentence. Then write the final answer.'
    },
    askFirst: {
      fr: 'Avant de produire quoi que ce soit : si une information indispensable manque, pose au maximum 3 questions ciblées et attends la réponse. Si tout est clair, réponds directement.',
      en: 'Before producing anything: if essential information is missing, ask at most 3 targeted questions and wait. If everything is clear, answer directly.'
    },
    assume: {
      fr: 'Si une information manque, ne bloque pas : retiens l\'hypothèse la plus raisonnable, liste tes hypothèses en tête sous « Hypothèses », puis produis la réponse complète.',
      en: 'If information is missing, do not stall: take the most reasonable assumption, list your assumptions first under "Assumptions", then deliver the full answer.'
    },
    selfCheck: {
      fr: 'Avant d\'envoyer ta réponse, relis-la contre les critères de qualité ci-dessus. Corrige silencieusement ce qui ne les respecte pas ; n\'affiche ni la relecture ni la liste des corrections.',
      en: 'Before sending, re-read your answer against the quality bar above. Silently fix anything that falls short; do not show the review or the list of corrections.'
    },
    fewShot: {
      fr: 'Aligne-toi sur les exemples ci-dessous : reprends leur structure, leur niveau de détail et leur ton, sans en recopier le contenu.',
      en: 'Match the examples below: reuse their structure, level of detail and tone, without copying their content.'
    },
    fewShotPlaceholder: {
      fr: '[Collez ici 1 ou 2 exemples du résultat attendu — ou d\'un résultat à ne pas reproduire, en le signalant.]',
      en: '[Paste 1-2 examples of the result you want here — or one to avoid, labelled as such.]'
    },
    startNow: { fr: 'Commence maintenant.', en: 'Begin now.' },
    deliverables: { fr: 'Livrable attendu : ', en: 'Deliverable: ' }
  };

  var LANG_NAMES = {
    fr: { fr: 'français', en: 'French' }, en: { fr: 'anglais', en: 'English' },
    es: { fr: 'espagnol', en: 'Spanish' }, de: { fr: 'allemand', en: 'German' },
    it: { fr: 'italien', en: 'Italian' }, pt: { fr: 'portugais', en: 'Portuguese' },
    nl: { fr: 'néerlandais', en: 'Dutch' }, ar: { fr: 'arabe', en: 'Arabic' },
    zh: { fr: 'chinois', en: 'Chinese' }, ja: { fr: 'japonais', en: 'Japanese' },
    ru: { fr: 'russe', en: 'Russian' }
  };

  var MODEL_NAMES = {
    claude: 'Claude', gpt: 'ChatGPT / GPT', gemini: 'Gemini', mistral: 'Mistral / Le Chat',
    llama: 'Llama', deepseek: 'DeepSeek', perplexity: 'Perplexity', image: { fr: 'un modèle de génération d\'images', en: 'an image-generation model' },
    any: { fr: 'tout assistant IA généraliste', en: 'any general-purpose AI assistant' }
  };

  var OUTPUT_SHAPES = {
    auto: null,
    prose: { fr: 'Texte rédigé en paragraphes, titres de section si la longueur le justifie.', en: 'Flowing prose with section headings if length warrants.' },
    bullets: { fr: 'Liste à puces hiérarchisée, une idée par puce, pas de phrase de plus de deux lignes.', en: 'Hierarchical bullet list, one idea per bullet, no bullet longer than two lines.' },
    table: { fr: 'Tableau markdown avec des colonnes explicitement nommées, une ligne par élément comparé.', en: 'Markdown table with explicitly named columns, one row per compared item.' },
    markdown: { fr: 'Markdown structuré : titres ##, listes, gras pour les termes clés, blocs de code si nécessaire.', en: 'Structured markdown: ## headings, lists, bold for key terms, code blocks where relevant.' },
    json: { fr: 'Un unique objet JSON valide, sans texte avant ni après, sans bloc de code. Toutes les clés en anglais, en snake_case.', en: 'A single valid JSON object, with no text before or after and no code fence. All keys in English snake_case.' },
    code: { fr: 'Bloc(s) de code annoté(s) du langage, précédés d\'une explication de 3 lignes maximum.', en: 'Language-tagged code block(s), preceded by an explanation of 3 lines max.' },
    email: { fr: 'Objet sur la première ligne, puis le corps du message prêt à envoyer.', en: 'Subject line first, then the ready-to-send body.' },
    steps: { fr: 'Étapes numérotées, chacune actionnable seule, avec le résultat attendu de l\'étape.', en: 'Numbered steps, each actionable on its own, with the expected outcome of the step.' },
    slides: { fr: 'Une section par diapositive : titre, 3 puces maximum, note de présentation.', en: 'One section per slide: title, max 3 bullets, speaker note.' }
  };

  var DEPTH_LABEL = {
    direct: { fr: 'Va droit au but : pas de préambule, pas de résumé de la demande, pas de conclusion de politesse.', en: 'Get straight to the point: no preamble, no restating the request, no polite sign-off.' },
    balanced: { fr: 'Réponse complète mais dense : chaque paragraphe doit apporter une information nouvelle.', en: 'Complete but dense: every paragraph must add new information.' },
    deep: { fr: 'Traitement approfondi : explore les implications, les cas particuliers et les objections crédibles.', en: 'In-depth treatment: explore implications, edge cases and credible objections.' }
  };

  /* ---------------------------------------------------------- image builder */

  function buildImageSections(raw, o, a) {
    var l = o.lang;
    var subject = toSubject(raw, l);
    var fr = l === 'fr';
    return [
      { key: 'subject', title: fr ? 'SUJET PRINCIPAL' : 'MAIN SUBJECT', lines: [subject,
        fr ? 'Précisez ici la matière, la couleur, la texture, la posture et l\'état du sujet.' : 'Specify material, colour, texture, posture and condition of the subject here.'] },
      { key: 'composition', title: fr ? 'COMPOSITION' : 'COMPOSITION', lines: fr
        ? ['Cadrage : plan large / plan moyen / gros plan', 'Angle : hauteur d\'œil, contre-plongée, vue de dessus', 'Optique : 35 mm grand angle, 50 mm neutre, 85 mm portrait', 'Profondeur de champ : arrière-plan net ou flou (f/1.8 à f/11)']
        : ['Framing: wide shot / medium shot / close-up', 'Angle: eye level, low angle, top-down', 'Lens: 35mm wide, 50mm neutral, 85mm portrait', 'Depth of field: sharp or blurred background (f/1.8 to f/11)'] },
      { key: 'light', title: fr ? 'LUMIÈRE & ATMOSPHÈRE' : 'LIGHT & MOOD', lines: fr
        ? ['Source et direction : lumière naturelle latérale, contre-jour, éclairage studio à trois points', 'Qualité : douce et diffuse, ou dure avec ombres marquées', 'Température : chaude (heure dorée) ou froide (heure bleue)', 'Ambiance générale en un mot : sereine, tendue, solennelle, joyeuse']
        : ['Source and direction: side natural light, backlight, three-point studio setup', 'Quality: soft and diffuse, or hard with defined shadows', 'Temperature: warm (golden hour) or cool (blue hour)', 'Overall mood in one word: serene, tense, solemn, joyful'] },
      { key: 'style', title: fr ? 'STYLE & MÉDIUM' : 'STYLE & MEDIUM', lines: fr
        ? ['Médium : photographie, illustration vectorielle, aquarelle, rendu 3D, pixel art, gravure', 'Époque ou courant visuel, décrit par ses caractéristiques (et non par le nom d\'un artiste vivant)', 'Palette : 2 ou 3 couleurs dominantes nommées précisément', 'Niveau de détail : minimaliste, réaliste, hyper-détaillé']
        : ['Medium: photography, vector illustration, watercolour, 3D render, pixel art, engraving', 'Period or visual movement, described by its characteristics (not by a living artist\'s name)', 'Palette: 2-3 dominant colours, precisely named', 'Level of detail: minimal, realistic, hyper-detailed'] },
      { key: 'tech', title: fr ? 'PARAMÈTRES TECHNIQUES' : 'TECHNICAL PARAMETERS', lines: fr
        ? ['Format : carré 1:1, portrait 4:5 ou 9:16, paysage 3:2 ou 16:9', 'Résolution ou qualité maximale disponible', 'Rendu : photoréaliste, cinématographique, plat et graphique']
        : ['Aspect ratio: square 1:1, portrait 4:5 or 9:16, landscape 3:2 or 16:9', 'Resolution or maximum available quality', 'Finish: photorealistic, cinematic, flat and graphic'] },
      { key: 'negative', title: fr ? 'À EXCLURE (negative prompt)' : 'EXCLUDE (negative prompt)', lines: fr
        ? ['texte illisible, filigrane, logo, mains déformées, membres surnuméraires, visage asymétrique, artefacts de compression, cadre, bordure, signature']
        : ['illegible text, watermark, logo, deformed hands, extra limbs, asymmetric face, compression artefacts, frame, border, signature'] }
    ];
  }

  function buildImageOneLiner(raw, o, a) {
    var subject = toSubject(raw, o.lang);
    var bits = [subject];
    if (o.tone) bits.push(o.tone);
    bits.push(o.lang === 'fr'
      ? 'composition soignée, cadrage précis, éclairage maîtrisé, rendu haute définition, détails nets'
      : 'careful composition, precise framing, controlled lighting, high-definition finish, crisp detail');
    return bits.join(', ');
  }

  /* --------------------------------------------------------------- builder */

  var DEFAULTS = {
    lang: 'fr', format: 'structured', domain: 'auto', model: 'any', persona: '', audience: '', tone: '',
    length: '', outputShape: 'auto', depth: 'balanced', context: '', answerLang: '', clarification: 'assume',
    flags: {}
  };

  var DEFAULT_FLAGS = {
    role: true, method: true, constraints: true, quality: true, pitfalls: true,
    noHallucination: true, reasoning: true, selfCheck: true, examples: false
  };

  function withDefaults(opts) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = (opts && opts[k] !== undefined && opts[k] !== null && opts[k] !== '') ? opts[k] : DEFAULTS[k]; });
    o.flags = {};
    Object.keys(DEFAULT_FLAGS).forEach(function (k) {
      o.flags[k] = (opts && opts.flags && opts.flags[k] !== undefined) ? !!opts.flags[k] : DEFAULT_FLAGS[k];
    });
    if (o.lang !== 'en') o.lang = 'fr';
    if (!MODEL_NAMES[o.model]) o.model = 'any';
    return o;
  }

  function buildSections(raw, o, a) {
    var l = o.lang;
    var p = a.profile;
    var sections = [];
    var push = function (key, title, lines) {
      lines = (lines || []).filter(function (x) { return x && String(x).trim(); });
      if (lines.length) sections.push({ key: key, title: title, lines: lines });
    };

    if (a.domain.id === 'image') {
      if (o.flags.role) {
        push('role', L.role[l], [T.youAre[l] + (o.persona || p.persona[l]) + '.']);
      }
      var imgCtx = [];
      if (o.context) imgCtx.push(o.context.trim());
      imgCtx.push(T.initialRequest[l] + '« ' + String(raw).trim().replace(/\s+/g, ' ') + ' »');
      if (o.audience) imgCtx.push(T.audience[l] + o.audience);
      push('context', L.context[l], imgCtx);
      push('objective', L.objective[l], [
        (l === 'fr' ? 'Objectif : produire une image exploitable telle quelle, fidèle à la description ci-dessous.'
                    : 'Objective: produce an image usable as is, faithful to the description below.'),
        (l === 'fr' ? 'Le prompt compact ci-dessous est la version à copier ; les blocs suivants le détaillent.'
                    : 'The compact prompt below is the version to copy; the blocks that follow expand on it.')
      ]);
      push('brief', l === 'fr' ? 'PROMPT COMPACT (à copier tel quel)' : 'COMPACT PROMPT (copy as is)',
        [buildImageOneLiner(raw, o, a)]);
      buildImageSections(raw, o, a).forEach(function (sec) { sections.push(sec); });
      if (o.flags.constraints) {
        var icons = p.constraints[l].slice();
        if (o.audience) icons.unshift(T.audience[l] + o.audience + '.');
        if (o.tone) icons.unshift(T.tone[l] + o.tone + '.');
        push('constraints', L.constraints[l], icons.map(function (x) { return '- ' + x; }));
      }
      if (o.flags.quality) push('quality', L.quality[l], p.quality[l].map(function (x) { return '- ' + x; }));
      if (o.flags.pitfalls) push('avoid', L.avoid[l], p.pitfalls[l].map(function (x) { return '- ' + x; }));
      push('output', L.output[l], [
        p.output[l],
        (l === 'fr' ? 'Rends la liste des blocs en markdown, un titre par bloc, sans commentaire autour.'
                    : 'Return the block list in markdown, one heading per block, with no commentary around it.')
      ]);
      return sections;
    }

    // RÔLE
    if (o.flags.role) {
      var persona = o.persona || p.persona[l];
      push('role', L.role[l], [
        T.youAre[l] + persona + '.',
        l === 'fr'
          ? 'Tu réponds avec le niveau d\'exigence que tu appliquerais à un livrable facturé à un client.'
          : 'You answer to the standard you would apply to a deliverable a client is paying for.'
      ]);
    }

    // CONTEXTE
    var ctxLines = [];
    if (o.context) ctxLines.push(o.context.trim());
    ctxLines.push(T.initialRequest[l] + '« ' + String(raw).trim().replace(/\s+/g, ' ') + ' »');
    if (o.audience) ctxLines.push(T.audience[l] + o.audience);
    if (o.model && o.model !== 'any') {
      var mn = MODEL_NAMES[o.model];
      ctxLines.push(T.model[l] + (typeof mn === 'string' ? mn : (mn ? mn[l] : o.model)));
    }
    push('context', L.context[l], ctxLines);

    // OBJECTIF
    var objLines = [toObjective(raw, l)];
    objLines.push(DEPTH_LABEL[o.depth] ? DEPTH_LABEL[o.depth][l] : DEPTH_LABEL.balanced[l]);
    if (a.signals.count.length) {
      objLines.push((l === 'fr' ? 'Quantité demandée : ' : 'Requested quantity: ') + a.signals.count.join(', ') + '.');
    }
    push('objective', L.objective[l], objLines);

    // MÉTHODE
    if (o.flags.method && o.depth !== 'direct') {
      push('method', L.method[l], p.method[l].map(function (s, i) { return (i + 1) + '. ' + s; }));
    }

    // CONTRAINTES
    if (o.flags.constraints) {
      var cons = p.constraints[l].slice();
      if (o.tone) cons.unshift(T.tone[l] + o.tone + '.');
      if (o.length) cons.unshift(T.length[l] + o.length + '.');
      else if (a.signals.quantity.length) cons.unshift(T.length[l] + a.signals.quantity.join(', ') + '.');
      var al = o.answerLang && LANG_NAMES[o.answerLang] ? LANG_NAMES[o.answerLang][l] : null;
      if (al) cons.unshift(T.lang[l] + al + '.');
      if (o.flags.noHallucination) cons.push(T.noHallu[l]);
      push('constraints', L.constraints[l], cons.map(function (s) { return '- ' + s; }));
    }

    // FORMAT DE SORTIE
    var shape = OUTPUT_SHAPES[o.outputShape] ? OUTPUT_SHAPES[o.outputShape][l] : null;
    var outLines = [shape || p.output[l]];
    if (a.signals.format.length && o.outputShape === 'auto') {
      outLines.push((l === 'fr' ? 'Éléments de format repérés dans la demande : ' : 'Format cues found in the request: ') + a.signals.format.join(', ') + '.');
    }
    outLines.push(l === 'fr'
      ? 'Livre directement le résultat demandé : pas de préambule, pas de rappel des consignes, pas de commentaire sur ta propre réponse.'
      : 'Deliver the requested result directly: no preamble, no restating the instructions, no commentary on your own answer.');
    push('output', L.output[l], outLines);

    // EXEMPLES
    if (o.flags.examples) {
      push('examples', L.examples[l], [T.fewShot[l], '', T.fewShotPlaceholder[l]]);
    }

    // CRITÈRES DE QUALITÉ
    if (o.flags.quality) {
      push('quality', L.quality[l], p.quality[l].map(function (s) { return '- ' + s; }));
    }

    // À ÉVITER
    if (o.flags.pitfalls) {
      push('avoid', L.avoid[l], p.pitfalls[l].map(function (s) { return '- ' + s; }));
    }

    // RAISONNEMENT
    if (o.flags.reasoning && o.depth !== 'direct') {
      push('reasoning', L.reasoning[l], [o.depth === 'deep' ? T.cotDeep[l] : T.cotLight[l]]);
    }

    // INFORMATIONS MANQUANTES
    if (o.clarification === 'ask') push('clarify', L.clarify[l], [T.askFirst[l]]);
    else if (o.clarification === 'assume') push('clarify', L.clarify[l], [T.assume[l]]);

    // VÉRIFICATION FINALE
    if (o.flags.selfCheck) push('check', L.check[l], [T.selfCheck[l], T.startNow[l]]);

    return sections;
  }

  /* -------------------------------------------------------------- renderers */

  function renderStructured(sections) {
    return sections.map(function (s) {
      return '## ' + s.title + '\n' + s.lines.join('\n');
    }).join('\n\n').trim();
  }

  function renderXml(sections) {
    return sections.map(function (s) {
      var tag = XML_TAGS[s.key] || s.key;
      return '<' + tag + '>\n' + s.lines.map(function (x) { return x; }).join('\n') + '\n</' + tag + '>';
    }).join('\n\n').trim();
  }

  function renderCompact(sections, lang) {
    var parts = sections.map(function (s) {
      var body = s.lines
        .map(function (x) { return String(x).replace(/^\s*[-–]\s*/, '').replace(/^\d+\.\s*/, '').trim(); })
        .filter(Boolean)
        .join(' ');
      return cap(s.title.split('—')[0].trim().toLowerCase()) + ' : ' + body;
    });
    return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  function renderJson(sections, o, a, raw) {
    var obj = {
      task: toObjective(raw, o.lang),
      original_request: String(raw).trim(),
      domain: a.domain.id,
      language: o.answerLang || o.lang
    };
    sections.forEach(function (s) {
      var key = XML_TAGS[s.key] || s.key;
      var vals = s.lines.map(function (x) { return String(x).replace(/^\s*[-–]\s*/, '').replace(/^\d+\.\s*/, '').trim(); }).filter(Boolean);
      if (key === 'context' || key === 'objective') return;
      obj[key] = vals.length === 1 ? vals[0] : vals;
    });
    return JSON.stringify(obj, null, 2);
  }

  function renderSystemUser(sections, lang) {
    var sysKeys = ['role', 'constraints', 'quality', 'avoid', 'reasoning', 'check'];
    var sys = sections.filter(function (s) { return sysKeys.indexOf(s.key) !== -1; });
    var usr = sections.filter(function (s) { return sysKeys.indexOf(s.key) === -1; });
    var head = lang === 'fr' ? ['### MESSAGE SYSTÈME', '### MESSAGE UTILISATEUR'] : ['### SYSTEM MESSAGE', '### USER MESSAGE'];
    return head[0] + '\n\n' + renderStructured(sys) + '\n\n' + head[1] + '\n\n' + renderStructured(usr);
  }

  var FORMATS = ['structured', 'xml', 'compact', 'json', 'systemuser'];

  function recommendedFormat(model, domainId) {
    if (domainId === 'image') return 'compact';
    if (model === 'claude') return 'xml';
    if (model === 'gpt' || model === 'gemini' || model === 'mistral') return 'structured';
    return 'structured';
  }

  /**
   * Construit le prompt final.
   * @returns {{text:string, sections:Array, analysis:Object, options:Object, meta:Object}}
   */
  function build(raw, opts) {
    var o = withDefaults(opts);
    var a = analyze(raw, { lang: o.lang, domain: o.domain });
    var sections = buildSections(raw, o, a);
    var text;
    switch (o.format) {
      case 'xml': text = renderXml(sections); break;
      case 'compact': text = renderCompact(sections, o.lang); break;
      case 'json': text = renderJson(sections, o, a, raw); break;
      case 'systemuser': text = renderSystemUser(sections, o.lang); break;
      default: text = renderStructured(sections);
    }
    var after = scoreText(text, o.lang);
    return {
      text: text,
      sections: sections,
      analysis: a,
      options: o,
      meta: {
        before: a.score.total,
        after: after.total,
        gain: after.total - a.score.total,
        tokens: estimateTokens(text),
        words: text.split(/\s+/).filter(Boolean).length,
        recommendedFormat: recommendedFormat(o.model, a.domain.id)
      }
    };
  }

  return {
    normalize: normalize,
    detectLanguage: detectLanguage,
    detectDomain: detectDomain,
    extractSignals: extractSignals,
    score: scoreText,
    grade: grade,
    analyze: analyze,
    build: build,
    toObjective: toObjective,
    toSubject: toSubject,
    estimateTokens: estimateTokens,
    recommendedFormat: recommendedFormat,
    FORMATS: FORMATS,
    OUTPUT_SHAPES: OUTPUT_SHAPES,
    LANG_NAMES: LANG_NAMES,
    MODEL_NAMES: MODEL_NAMES
  };
});
