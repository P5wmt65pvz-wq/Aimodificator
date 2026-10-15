/*!
 * PromptForge — moteur d'analyse et de construction de prompts.
 * 100 % déterministe, exécuté localement : aucune donnée ne quitte le navigateur.
 *
 * Les règles d'écriture suivent les guides publiés par les éditeurs, relus le
 * 15 octobre 2026 :
 * - Anthropic, « Prompting best practices »
 *   (platform.claude.com/docs/en/build-with-claude/prompt-engineering/
 *   claude-prompting-best-practices) : être explicite sur le format, donner la
 *   raison d'une consigne, délimiter le contenu par des balises XML, placer le
 *   contenu long au-dessus de la question, éviter les majuscules d'alarme.
 * - OpenAI, guides de prompting GPT-4.1 et GPT-5 (github.com/openai/
 *   openai-cookbook, examples/) : des consignes contradictoires dégradent la
 *   réponse ; avec un contenu long, consignes au début ET à la fin.
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

  /* Les règles travaillent sur le texte normalisé (sans accents) ; ce qu'on
     recopie dans le prompt doit garder l'orthographe de la demande. */
  var ACCENTS = { a: 'aàâä', c: 'cç', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', y: 'yÿ' };
  function retrouve(raw, norm) {
    var src = norm.split('').map(function (ch) {
      if (ACCENTS[ch]) return '[' + ACCENTS[ch] + ']';
      if (ch === ' ') return '\\s+';
      if (ch === "'") return "['’]";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    var m = String(raw).match(new RegExp(src, 'i'));
    return m ? m[0] : norm;
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function cite(s, l) { return l === 'en' ? '"' + s + '"' : '« ' + s + ' »'; }

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
    count: /\b(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|two|three|four|five|seven|eight|nine|ten|twelve|fifteen|twenty)\s+(idees?|ideas?|exemples?|examples?|points?|conseils?|tips?|variantes?|variants?|options?|etapes?|steps?|questions?|noms?|names?|titres?|titles?|slogans?|accroches?|hooks?|taglines?|propositions?|suggestions?|raisons?|reasons?|arguments?|phrases?|sentences?|puces?|bullet points?|bullets?|erreurs?|mistakes?|outils?|tools?|strategies?|methodes?|methods?|astuces?|tricks?)(?:\s+(?:ideas?|options?|suggestions?)|\s+(?:de|d')\s*[a-z]+)?\b/g,
    format: /\b(json|xml|yaml|csv|markdown|tableau|table|liste a puces|bullet points?|bullet|liste|list|code|schema|diagramme|diagram|slides?)\b/g,
    tone: /\b(formel|informel|professionnel|amical|humoristique|drole|serieux|percutant|chaleureux|neutre|direct|academique|familier|persuasif|inspirant|formal|casual|friendly|funny|serious|punchy|professional|persuasive)\b/g,
    audience: /\b(pour (?:des |les |un |une |mon |ma |mes |le |la )?[a-zàâçéèêëîïôûùüœ\-]+(?: [a-zàâçéèêëîïôûùüœ\-]+)?|for (?:a |an |the |my )?[a-z\-]+(?: [a-z\-]+)?|so that (?:the |a |my |our )?[a-z\-]+|debutants?|beginners?|experts?|enfants?|kids?|etudiants?|students?|clients?|investisseurs?|investors?|recruteurs?|developpeurs?|developers?)\b/g,
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
    'le probleme', 'aujourd\'hui je', 'j\'ai deja', 'nous avons', 'mon equipe', 'notre', 'parce que',
    'car ', 'suite a', 'i am', 'we are', 'my company', 'currently', 'the problem', 'context', 'we have', 'because',
    /* espaces encadrantes indispensables : sans elles, 'our ' matchait à
       l'intérieur de « pour » et de « your », et gonflait le score à tort */
    'my team', ' our '];

  var CONSTRAINT_MARKERS = ['sans ', 'ne pas', 'maximum', 'minimum', 'au plus', 'au moins', 'moins de', 'doit ',
    'obligatoire', 'interdit', 'eviter', 'il faut', 'imperatif', 'ton ', 'style ', 'contrainte',
    'without', 'do not', 'don\'t', 'no more than', 'at least', 'must ', 'required', 'avoid', 'limit', 'constraint',
    /* « tone » sans espace finale : « in a direct tone, » se termine par une virgule */
    'tone', 'words max', 'characters max', 'at most', 'no longer than', 'keep it', 'make sure', 'ensure ',
    'strictly', 'never ', 'only use', 'stick to'];

  var EXAMPLE_MARKERS = ['par exemple', 'comme ceci', 'voici', 'ci-dessous', 'inspire de', 'dans le style de',
    'similaire a', 'exemple :', 'modele :', 'for example', 'e.g.', 'like this', 'such as', 'inspired by',
    'similar to', 'here is', 'sample:'];

  var SUCCESS_MARKERS = ['objectif', 'afin de', 'pour que', 'le but', 'resultat attendu', 'je veux obtenir',
    'reussi si', 'ideal serait', 'j\'attends', 'livrable', 'goal', 'so that', 'in order to', 'the aim',
    'expected result', 'success', 'i want to get', 'i expect', 'objective', 'deliverable', 'outcome'];

  /* Les formes anglaises courtes couvrent déjà les françaises : « tableau »
     contient « table », « liste » contient « list », « paragraphe » contient
     « paragraph ». Les garder toutes comptait deux fois le même mot. */
  var FORMAT_MARKERS = ['json', 'table', 'list', 'markdown', 'csv', 'xml', 'yaml', 'bullet',
    'puces', 'paragraph', 'sections', 'plan', 'outline', 'slides', 'email', 'code', 'schema'];

  var AUDIENCE_MARKERS = ['pour des', 'pour les', 'pour un', 'a destination de', 's\'adresse a',
    'debutant', 'expert', 'enfant', 'etudiant', 'client', 'investisseur', 'recruteur', 'developpeur', 'grand public',
    'for children', 'audience', 'aimed at', 'targeted at',
    'beginner', 'student', 'the team', 'my team', 'non-technical', 'newcomer', 'for developers', 'for recruiters'];

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

    /* À contenu égal, l'anglais s'écrit en moins de mots que le français.
       Comparer les deux aux mêmes seuils de longueur pénalise donc l'anglais
       sur la clarté, la spécificité et le contexte, sans que la demande soit
       moins bonne. On ramène le compte à une base commune avant de comparer.
       Le facteur est un réglage, pas une constante mesurée : il est choisi
       pour que deux demandes équivalentes obtiennent des notes comparables.
       Les seuils de garde (moins de 4 mots, plus de 900) gardent le compte
       réel : ils protègent contre les demandes vides, pas contre la langue. */
    var LONGUEUR_EQ = { en: 1.15, fr: 1 };
    var wordsEq = words * (LONGUEUR_EQ[lang === 'en' ? 'en' : 'fr']);

    // Clarté : longueur exploitable + verbe d'action + demande lisible
    var clarity = 0;
    if (words >= 4) clarity += 25;
    if (wordsEq >= 10) clarity += 20;
    if (wordsEq >= 20) clarity += 10;
    if (words > 900) clarity -= 15;
    if (anyMarker(t, ACTION_VERBS.map(function (v) { return ' ' + v; }))) clarity += 30;
    if (/[.?!]/.test(raw)) clarity += 10;
    if (raw.trim().length > 0 && words < 4) clarity += 5;
    dims.clarity = clamp(clarity, 0, 100);

    // Contexte
    var ctx = clamp(countMarkers(t, CONTEXT_MARKERS) * 22, 0, 66);
    if (wordsEq >= 40) ctx += 17;
    if (wordsEq >= 90) ctx += 17;
    dims.context = clamp(ctx, 0, 100);

    // Spécificité
    var spec = 0;
    spec += clamp(signals.numbers.length * 14, 0, 42);
    spec += clamp(signals.propernouns.length * 10, 0, 30);
    spec += clamp(signals.quantity.length * 14, 0, 28);
    if (wordsEq >= 25) spec += 10;
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
    var task = detectTask(text, lang, domain.id);
    if (!domain.forced) {
      /* Deux erreurs de domaine que la tâche permet de corriger : du code à
         relire n'est pas une traduction parce qu'on dit « relis » ; « écris un
         mail en anglais » n'est pas une traduction parce qu'on dit « anglais ». */
      if (task.ref && CODE_NOUNS.indexOf(task.ref) !== -1 && domain.id !== 'code') domain = redirige(domain, 'code');
      else if (domain.id === 'translation' && task.id !== 'translate' && task.family !== 'transform') {
        var next = domain.ranked.filter(function (id) { return id !== 'translation' && domain.scores[id] >= 2; })[0];
        domain = redirige(domain, next || 'general');
      }
    }
    /* Pour une tâche qui travaille sur un contenu, la consigne s'arrête où le
       contenu commence ; pour les autres, rien n'est retiré de la demande. */
    var surContenu = task.family === 'transform' || !!task.ref || task.id === 'review' || task.id === 'analyze';
    var consigne = surContenu ? instructionPart(text) : text;
    return {
      lang: lang,
      detectedLang: detectedLang,
      domain: domain,
      task: task,
      profile: profiles().get(domain.id),
      signals: extractSignals(text),
      /* Ce que la CONSIGNE demande : sans le contenu éventuellement collé. */
      cues: extractSignals(consigne),
      shape: explicitShape(consigne),
      extras: { audience: extractAudience(consigne), targetLang: extractTargetLang(consigne) },
      score: sc,
      grade: grade(sc.total, lang)
    };
  }

  function redirige(domain, id) {
    var sc = domain.scores[id] || 0;
    return { id: id, score: sc, confidence: sc ? clamp(Math.round((sc / (sc + 4)) * 100), 20, 97) : 0,
      scores: domain.scores, ranked: domain.ranked, corrected: true };
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

  /* ---------------------------------------------------------------- tâches */

  /* Le domaine dit DE QUOI parle la demande ; la tâche dit CE QU'IL FAUT EN
     FAIRE. « Résume ce rapport financier » relève de la finance, mais c'est un
     résumé : la méthode, le format et surtout la place du texte à résumer
     viennent de la tâche. Sans elle, le prompt demandait à l'IA de résumer un
     texte qu'elle n'avait jamais reçu.

     Trois familles :
     - « transformer » : l'IA travaille sur un contenu que l'utilisateur doit
       fournir (résumer, traduire, réécrire, extraire, déboguer, améliorer du
       code). La tâche porte tout : méthode, contraintes, format, pièges.
     - « orienter » : le domaine garde son expertise, la tâche impose sa
       méthode et sa forme (analyser, expliquer, comparer, trouver des idées,
       planifier).
     - « créer » : le profil du domaine, tel quel. */

  /* Noms qui désignent un contenu à fournir : forme normalisée → affichage
     français, article, affichage anglais. */
  var NOUNS = {
    'texte': ['texte', 'le', 'text'], 'text': ['texte', 'le', 'text'],
    'article': ['article', "l'", 'article'], 'document': ['document', 'le', 'document'],
    'doc': ['document', 'le', 'document'], 'pdf': ['PDF', 'le', 'PDF'],
    'fichier': ['fichier', 'le', 'file'], 'file': ['fichier', 'le', 'file'],
    'mail': ['e-mail', "l'", 'email'], 'email': ['e-mail', "l'", 'email'], 'e-mail': ['e-mail', "l'", 'email'],
    'courriel': ['courriel', 'le', 'email'], 'message': ['message', 'le', 'message'],
    'lettre': ['lettre', 'la', 'letter'], 'letter': ['lettre', 'la', 'letter'],
    'cv': ['CV', 'le', 'CV'], 'resume': ['CV', 'le', 'résumé'], 'resume-fr': ['résumé', 'le', 'summary'],
    'rapport': ['rapport', 'le', 'report'], 'report': ['rapport', 'le', 'report'],
    'contrat': ['contrat', 'le', 'contract'], 'contract': ['contrat', 'le', 'contract'],
    'code': ['code', 'le', 'code'], 'script': ['script', 'le', 'script'],
    'fonction': ['fonction', 'la', 'function'], 'function': ['fonction', 'la', 'function'],
    'programme': ['programme', 'le', 'program'], 'program': ['programme', 'le', 'program'],
    'essai': ['essai', "l'", 'essay'], 'essay': ['essai', "l'", 'essay'],
    'paragraphe': ['paragraphe', 'le', 'paragraph'], 'paragraph': ['paragraphe', 'le', 'paragraph'],
    'discours': ['discours', 'le', 'speech'], 'speech': ['discours', 'le', 'speech'],
    'post': ['post', 'le', 'post'], 'presentation': ['présentation', 'la', 'presentation'],
    'transcription': ['transcription', 'la', 'transcript'], 'transcript': ['transcription', 'la', 'transcript'],
    'notes': ['notes', 'les', 'notes'], 'compte rendu': ['compte rendu', 'le', 'minutes'],
    'compte-rendu': ['compte rendu', 'le', 'minutes'], 'minutes': ['compte rendu', 'le', 'minutes'],
    'dissertation': ['dissertation', 'la', 'essay'], 'copie': ['copie', 'la', 'paper'],
    'devoir': ['devoir', 'le', 'assignment'], 'chapitre': ['chapitre', 'le', 'chapter'], 'chapter': ['chapitre', 'le', 'chapter'],
    'annonce': ['annonce', "l'", 'ad'], 'devis': ['devis', 'le', 'quote'],
    'politique': ['politique', 'la', 'policy'], 'policy': ['politique', 'la', 'policy'],
    'tableau': ['tableau', 'le', 'table'], 'donnees': ['données', 'les', 'data'], 'data': ['données', 'les', 'data'],
    'phrase': ['phrase', 'la', 'sentence'], 'sentence': ['phrase', 'la', 'sentence'],
    'bio': ['bio', 'la', 'bio'], 'introduction': ['introduction', "l'", 'introduction'],
    'prompt': ['prompt', 'le', 'prompt'], 'requete': ['requête', 'la', 'query'], 'query': ['requête', 'la', 'query']
  };
  var NOUN_KEYS = Object.keys(NOUNS).filter(function (k) { return k !== 'resume-fr'; }).sort(function (a, b) { return b.length - a.length; })
    .map(function (k) { return k.replace(/[-]/g, '\\-'); }).join('|');
  /* Seuls un démonstratif, un possessif ou « ci-dessous » désignent à coup sûr
     un contenu existant : « écris le code d'une appli » n'en fournit aucun. */
  var REF_FR = new RegExp("(?:^|[^a-z])(?:ce|cet|cette|ces|mon|ma|mes|notre|nos|ton|ta|tes|votre|vos)\\s+(" + NOUN_KEYS + ")(?![a-z])");
  var REF_FR_SUIVANT = new RegExp("(?:^|[^a-z])(?:le|la|les|l')\\s*(" + NOUN_KEYS + ")\\s+(?:ci-dessous|ci-joint|ci-jointe|suivant|suivante|suivants|joint|jointe|colle|collee)(?![a-z])");
  var REF_EN = new RegExp("(?:^|[^a-z])(?:this|these|my|our|your|the following|the attached|attached)\\s+(" + NOUN_KEYS + ")(?![a-z])");

  function findReference(n) {
    var m = n.match(REF_FR) || n.match(REF_FR_SUIVANT);
    /* « ce résumé » est un résumé ; « my resume » est un CV. */
    if (m) return m[1] === 'resume' ? 'resume-fr' : m[1];
    m = n.match(REF_EN);
    return m ? m[1] : null;
  }

  /* Où commence le contenu déjà présent dans la demande, s'il y en a un :
     un bloc de code, un emplacement que l'utilisateur a prévu (« [COLLER LE
     TEXTE ICI] »), des lignes sous la consigne, ou un texte après des
     deux-points qui suivent une consigne courte d'une seule phrase
     (« Traduis : … »). Plus loin, ou après une phrase complète, des
     deux-points introduisent une précision (« Mon angle : … »), pas le
     contenu. Renvoie -1 sans contenu. */
  function contentStart(raw) {
    var s = String(raw || '');
    var i = s.indexOf('```');
    if (i !== -1) return i;
    var m = s.match(/\[\s*(coller|collez|colle|paste|insert|ins[ée]rer|ins[ée]rez)\b[^\]]{0,200}\]/i);
    if (m) return m.index;
    i = s.indexOf('\n');
    if (i !== -1 && s.slice(i).trim().length >= 60) return i;
    i = s.indexOf(':');
    if (i !== -1 && i <= 50 && !/[.!?]/.test(s.slice(0, i)) && s.slice(i + 1).trim().length >= 40) return i;
    /* Un long passage entre guillemets : cherché en un seul passage sur le
       texte (une expression régulière reparcourait la fin depuis chaque
       guillemet ouvrant). */
    var q = s.search(/["“«]/);
    var fin = q === -1 ? -1 : s.slice(q + 1).search(/["”»]/);
    return fin >= 40 ? s.length : -1;
  }
  function inlineContent(raw) { return contentStart(raw) !== -1; }

  /* La consigne seule, sans le contenu collé à sa suite : un « table » dans
     le texte à traduire n'est pas une demande de tableau. */
  function instructionPart(raw) {
    var s = String(raw || '');
    var cut = contentStart(s);
    return cut > 0 ? s.slice(0, cut) : s;
  }

  /* La forme de sortie que la consigne exige en toutes lettres. Un mot seul
     ne suffit pas : « une fonction qui lit un fichier JSON » ne demande pas
     une réponse en JSON. */
  function explicitShape(text) {
    var n = ' ' + normalize(text) + ' ';
    if (/\b(slides?|diapositives?|diapos?)\b/.test(n)) return 'slides';
    if (/\b(un tableau|a table)\b|\b(tableau|table) (comparatif|recapitulatif|de synthese|comparison|summary)\b|\b(sous forme de|en|dans un|in a|as a|into a) (tableau|table)\b|^ (un |une |fais un |fais moi un |cree un |dresse un |make a |create a |build a )?(tableau|table)\b/.test(n)) return 'table';
    if (/\b(en|au format|format|sous forme de|as|in|into|returns?|renvoie|output) (du |de |un |a )?json\b/.test(n)) return 'json';
    if (/\b(liste a puces|bullet points?|bullet list|en liste|sous forme de liste|as a list|in a list|une liste de|a list of)\b|^ (liste|list)\b/.test(n)) return 'bullets';
    if (/\b(en|in|au format) markdown\b/.test(n)) return 'markdown';
    return null;
  }

  var CRITIQUABLE = ['cv', 'resume', 'contrat', 'contract', 'code', 'script', 'fonction', 'function', 'programme', 'program',
    'lettre', 'letter', 'essai', 'essay', 'dissertation', 'copie', 'devoir', 'post', 'annonce', 'prompt', 'presentation',
    'discours', 'speech', 'mail', 'email', 'e-mail', 'courriel', 'message', 'bio', 'introduction', 'politique', 'policy', 'devis'];

  var CODE_NOUNS = ['code', 'script', 'fonction', 'function', 'programme', 'program', 'requete', 'query'];

  var CODE_CUE = /\b(code|script|fonction|function|programme|program|python|javascript|typescript|java|php|ruby|rust|golang|kotlin|swift|sql|bash|powershell|html|css|react|node|api|regex|classe|class|methode|method|vba|macro)\b/;
  var ERROR_CUE = /(\bbugs?\b|\berreurs?\b|\berrors?\b|\bexceptions?\b|\bplante\b|\bcrash|marche pas|fonctionne pas|doesn'?t work|does not work|not working|traceback|stack ?trace|\b[a-z]{0,30}error\b|segfault|undefined is not)/;
  var CODE_LANG = /\b(python|javascript|typescript|java|php|ruby|rust|golang|kotlin|swift|sql|bash|powershell|c\+\+|c#|csharp|dart|scala|vba|html|css|react|node(?:\.?js)?)\b/;

  var START = function (re) { return function (n, o) { return re.test(o); }; };

  /* Ordre = priorité : la première règle qui répond l'emporte. */
  var TASK_RULES = [
    ['debug', function (n, o, dom) {
      /* « Relis ce code et signale les bugs » est une relecture, pas un débogage. */
      if (/^(relis|relire|review|audit|audite|auditer|evalue|evaluer)\b/.test(o)) return false;
      return ERROR_CUE.test(n) && (CODE_CUE.test(n) || dom === 'code');
    }],
    ['translate', function (n, o) { return /^(traduis|traduire|traduction|translate|translation)\b/.test(o) || /\b(traduis|traduire|translate)\b/.test(n); }],
    ['summarize', function (n, o, dom, lang) {
      return (lang !== 'en' && /^(resume|resumer|synthetise|synthetiser)\b/.test(o))
        || /^(summarize|summarise|condense|tl;?dr)\b/.test(o)
        || /^(fais|faire|ecris|ecrire|redige|rediger|donne|write|give)( moi| me)? (un |une |a )?(court |bref |petit |short |brief )?(resume|synthese|summary)\b/.test(o)
        || /\b(resume|synthese|summary) (de |du |des |d'|of )(ce |cet |cette |ces |mon |ma |mes |this |these |my |the following )/.test(n);
    }],
    ['extract', START(/^(extrais|extraire|extract|releve|relever|recense|recenser|pull out)\b/)],
    ['refactor', function (n, o) { return /^(ameliore|ameliorer|optimise|optimiser|refactorise|refactoriser|refactor|improve|optimize|clean up|nettoie|nettoyer|simplifie|simplifier|simplify)\b/.test(o) && CODE_CUE.test(n); }],
    ['rewrite', function (n, o, dom, lang, ref, inline) {
      /* Du code à relire ou à corriger relève de l'analyse ou du débogage. */
      if (CODE_CUE.test(n) && !/\b(texte|mail|e-mail|email|message|lettre|text|letter)\b/.test(n)) return false;
      if (!/^(reformule|reformuler|reecris|reecrire|ameliore|ameliorer|corrige|corriger|relis|relire|simplifie|simplifier|raccourcis|raccourcir|allonge|allonger|rends|retravaille|retravailler|peaufine|peaufiner|rephrase|rewrite|reword|proofread|edit|polish|improve|shorten|simplify|paraphrase|fix)\b/.test(o)) return false;
      return !!ref || inline || /\b(fautes?|orthographe|grammaire|coquilles?|typos?|spelling|grammar)\b/.test(n);
    }],
    ['review', function (n, o, dom, lang, ref, inline) {
      if (!ref && !inline) return false;
      if (/^(evalue|evaluer|critique|critiquer|juge|juger|note|noter|audite|auditer|relis|relire|donne(?: moi)? (?:ton|un|des|mon) (?:avis|retour|retours|feedback)|qu'en penses|review|assess|evaluate|audit|rate|grade|critique|give (?:me )?feedback|what do you think)\b/.test(o)) return true;
      /* « Analyse ce contrat » appelle une critique ; « analyse ces données »,
         une analyse de leur contenu. */
      return /^(analyse|analyser|analyze)\b/.test(o) && CRITIQUABLE.indexOf(ref) !== -1;
    }],
    ['analyze', function (n, o, dom, lang, ref, inline) {
      return (!!ref || inline) && /^(analyse|analyser|analyze|examine|examiner|etudie|etudier|study|interprete|interpreter|interpret)\b/.test(o);
    }],
    ['compare', function (n) { return /\b(compare|comparer|comparatif|comparaison|versus|vs|difference entre|differences entre|lequel choisir|laquelle choisir|quel est le meilleur|quelle est la meilleure|which is better|difference between|differences between|pros and cons|avantages et inconvenients)\b/.test(n); }],
    ['brainstorm', function (n, o) {
      /* Les idées sont le livrable quand elles ouvrent la demande ; « une idée
         par ligne » au milieu d'une consigne n'en fait pas un remue-méninges. */
      var tete = o.split(' ').slice(0, 10).join(' ');
      return /^(brainstorm|remue-meninges)/.test(o)
        || /\b(\d+|des|quelques|plusieurs|dix|vingt|some|a few|ten|twenty)\s+(idees|ideas|noms|titres|slogans|accroches|names|titles|taglines|hooks)\b/.test(tete)
        || /\b(\d+ )?(name|title|slogan) ideas\b/.test(tete)
        || (/^(trouve|trouver|propose|proposer|suggere|suggerer|imagine|imaginer|suggest|find|give me|donne moi|come up with)\b/.test(o) && /\b(idees?|ideas?|noms?|titres?|slogans?|accroches?|names?|titles?|taglines?|hooks?)\b/.test(tete));
    }],
    ['plan', function (n, o) {
      return /^(planifie|planifier|organise|organiser|plan|schedule)\b/.test(o)
        || /\b(planning|plan d'action|plan de (revision|travail|entrainement|formation|communication)|feuille de route|roadmap|itineraire|itinerary|study plan|training plan|action plan)\b/.test(n);
    }],
    ['explain', START(/^(explique|expliquer|explain|c'est quoi|c est quoi|qu'est-ce que|qu'est ce que|qu est ce que|comment (fonctionne|marche)|pourquoi|what is|what are|what's|how does|how do|why)\b/)]
  ];

  /* Chaque tâche : son libellé, sa famille, et ce qu'elle impose au prompt.
     Les textes suivent les guides des éditeurs : dire quoi faire plutôt que
     quoi éviter, donner la raison d'une consigne, aucune majuscule d'alarme. */
  var TASKS = {
    summarize: {
      label: { fr: 'Résumé', en: 'Summary' }, family: 'transform', verb: { fr: 'À RÉSUMER', en: 'TO SUMMARIZE' },
      persona: { fr: 'un rédacteur spécialisé en synthèse, qui va à l\'essentiel sans trahir le texte source', en: 'an editor who specialises in summaries: gets to the point without distorting the source' },
      method: {
        fr: ['Lis le texte en entier avant d\'écrire : repère son message central, puis les idées qui le soutiennent.',
          'Classe ces idées par importance pour le lecteur visé, pas par ordre d\'apparition.',
          'Rédige le résumé avec tes propres mots ; garde tels quels les chiffres, les noms et les dates du texte.',
          'Relis en comparant au texte : chaque affirmation du résumé doit s\'y trouver.'],
        en: ['Read the whole text before writing: find its central message, then the ideas that support it.',
          'Rank those ideas by importance to the intended reader, not by order of appearance.',
          'Write the summary in your own words; keep the text\'s figures, names and dates exactly as they are.',
          'Check against the text: every statement in the summary must be found in it.']
      },
      constraints: {
        fr: ['N\'ajoute aucune information absente du texte, même utile : le lecteur doit pouvoir se fier au résumé comme au texte.',
          'Conserve les nuances (conditions, réserves, ordres de grandeur) : une hypothèse du texte reste une hypothèse.'],
        en: ['Add no information that is not in the text, however useful: the reader must be able to trust the summary as they would the text.',
          'Keep the nuances (conditions, caveats, orders of magnitude): a hypothesis in the text stays a hypothesis.']
      },
      quality: {
        fr: ['Quelqu\'un qui ne lit que le résumé comprend le message central et peut agir dessus.', 'Rien d\'essentiel ne manque, rien d\'accessoire n\'est gardé.'],
        en: ['Someone who reads only the summary grasps the central message and can act on it.', 'Nothing essential is missing, nothing secondary is kept.']
      },
      pitfalls: {
        fr: ['Recopier des phrases entières du texte au lieu de les condenser.', 'Commenter ou juger le texte au lieu de le résumer.'],
        en: ['Copying whole sentences from the text instead of condensing them.', 'Commenting on or judging the text instead of summarizing it.']
      },
      output: { fr: 'Une phrase qui donne le message central, puis les points clés en liste à puces, du plus important au moins important.', en: 'One sentence with the central message, then the key points as a bullet list, most important first.' }
    },
    translate: {
      label: { fr: 'Traduction', en: 'Translation' }, family: 'transform', verb: { fr: 'À TRADUIRE', en: 'TO TRANSLATE' },
      persona: { fr: 'un traducteur professionnel qui traduit le sens et l\'intention, pas les mots', en: 'a professional translator who translates meaning and intent, not words' },
      method: {
        fr: ['Lis tout le texte pour en saisir le sens, le ton et le public avant de traduire.',
          'Traduis le sens : adapte les expressions idiomatiques, les unités et les références culturelles au lecteur de la langue cible.',
          'Garde la mise en forme d\'origine (titres, listes, sauts de ligne) ; laisse tels quels les noms propres, le code et les adresses web.',
          'Relis la traduction comme un texte écrit directement dans la langue cible.'],
        en: ['Read the whole text to grasp its meaning, tone and audience before translating.',
          'Translate the meaning: adapt idioms, units and cultural references for a reader of the target language.',
          'Keep the original layout (headings, lists, line breaks); leave proper names, code and web addresses unchanged.',
          'Reread the translation as if it had been written in the target language.']
      },
      constraints: {
        fr: ['N\'ajoute ni ne retire aucune information.', 'Si un terme est ambigu ou sans équivalent, choisis la traduction la plus probable et signale-le dans une note après le texte.'],
        en: ['Add or remove no information.', 'If a term is ambiguous or has no equivalent, choose the most likely translation and flag it in a note after the text.']
      },
      quality: {
        fr: ['Un lecteur natif ne devine pas qu\'il lit une traduction.', 'Le registre (familier, professionnel, juridique…) est le même que dans l\'original.'],
        en: ['A native reader cannot tell it is a translation.', 'The register (casual, professional, legal…) matches the original.']
      },
      pitfalls: {
        fr: ['Traduire mot à mot une expression idiomatique.', 'Corriger ou améliorer le fond du texte pendant la traduction.'],
        en: ['Translating an idiom word for word.', 'Correcting or improving the substance of the text while translating.']
      },
      output: { fr: 'La traduction seule, prête à copier, puis les éventuelles notes de traduction.', en: 'The translation alone, ready to copy, then any translator\'s notes.' }
    },
    rewrite: {
      label: { fr: 'Réécriture', en: 'Rewrite' }, family: 'transform', verb: { fr: 'À RETRAVAILLER', en: 'TO REWORK' },
      persona: { fr: 'un éditeur et correcteur professionnel', en: 'a professional editor and proofreader' },
      method: {
        fr: ['Lis tout le texte et repère son objectif et son lecteur avant de modifier quoi que ce soit.',
          'Corrige l\'orthographe, la grammaire et la ponctuation.',
          'Améliore la clarté : phrases plus courtes, mots précis, répétitions et remplissage supprimés.',
          'Garde le sens, les informations et la voix de l\'auteur ; ne change le fond que si la demande le dit.'],
        en: ['Read the whole text and identify its purpose and reader before changing anything.',
          'Fix spelling, grammar and punctuation.',
          'Improve clarity: shorter sentences, precise words, repetition and filler removed.',
          'Keep the meaning, the information and the author\'s voice; change substance only if the request says so.']
      },
      proofreadVerb: { fr: 'À CORRIGER', en: 'TO PROOFREAD' },
      proofreadOutput: { fr: 'Le texte corrigé en entier, prêt à copier, puis la liste des corrections, une ligne chacune (avant → après).', en: 'The full corrected text, ready to copy, then the list of corrections, one line each (before → after).' },
      proofread: {
        fr: ['Lis tout le texte avant de corriger.',
          'Corrige l\'orthographe, la grammaire, la conjugaison, la ponctuation et la typographie.',
          'Ne touche pas au style ni au choix des mots quand ils sont corrects : l\'auteur doit retrouver son texte.',
          'Relis une seconde fois en cherchant uniquement les fautes restantes.'],
        en: ['Read the whole text before correcting.',
          'Fix spelling, grammar, verb forms, punctuation and typography.',
          'Leave style and word choice alone when they are correct: the author must recognise their text.',
          'Reread a second time looking only for remaining errors.']
      },
      constraints: {
        fr: ['Ne supprime aucune information du texte d\'origine sans le signaler.', 'Garde le registre de l\'auteur, sauf si la demande en fixe un autre.'],
        en: ['Remove no information from the original without flagging it.', 'Keep the author\'s register unless the request sets another one.']
      },
      quality: {
        fr: ['Le texte se lit d\'une traite, sans phrase à relire deux fois.', 'L\'auteur reconnaît son texte : même message, mieux dit.'],
        en: ['The text reads in one go, with no sentence to read twice.', 'The author recognises their text: same message, better said.']
      },
      pitfalls: {
        fr: ['Réécrire au point de changer le message ou le ton.', 'Ajouter des formules creuses ou des superlatifs.'],
        en: ['Rewriting so much that the message or tone changes.', 'Adding empty phrases or superlatives.']
      },
      output: { fr: 'Le texte retravaillé en entier, prêt à copier, puis la liste courte des changements importants (3 à 5 lignes).', en: 'The full reworked text, ready to copy, then a short list of the important changes (3-5 lines).' }
    },
    extract: {
      label: { fr: 'Extraction', en: 'Extraction' }, family: 'transform', verb: { fr: 'SOURCE', en: 'SOURCE' }, shape: 'table',
      persona: { fr: 'un analyste rigoureux qui relève des informations sans jamais les déformer', en: 'a rigorous analyst who pulls out information without ever distorting it' },
      method: {
        fr: ['Parcours tout le contenu avant de répondre.', 'Relève chaque élément demandé, exactement tel qu\'il apparaît.', 'Si un élément demandé est absent, indique-le comme absent plutôt que de le deviner.'],
        en: ['Go through the whole content before answering.', 'Pull out each requested item exactly as it appears.', 'If a requested item is missing, mark it as missing rather than guessing it.']
      },
      constraints: {
        fr: ['Recopie les valeurs telles quelles, sans les reformuler ni les compléter : elles serviront telles quelles.'],
        en: ['Copy values exactly, without rewording or completing them: they will be used as they are.']
      },
      quality: {
        fr: ['Aucun élément présent dans le contenu n\'est oublié.', 'Aucune valeur n\'est inventée ni complétée.'],
        en: ['No item present in the content is missed.', 'No value is invented or completed.']
      },
      pitfalls: { fr: ['Compléter une valeur partielle par déduction.'], en: ['Completing a partial value by inference.'] },
      output: { fr: 'Un tableau, une ligne par élément trouvé, sans texte autour.', en: 'A table, one row per item found, with no text around it.' }
    },
    debug: {
      label: { fr: 'Débogage', en: 'Debugging' }, family: 'transform', verb: null,
      persona: { fr: 'un ingénieur logiciel senior spécialisé dans le diagnostic de bugs en production', en: 'a senior software engineer who specialises in diagnosing production bugs' },
      method: {
        fr: ['Lis le code et le message d\'erreur en entier ; repère la ligne et la valeur en cause.',
          'Explique la cause racine en 2 ou 3 phrases : pourquoi l\'erreur se produit, pas seulement où.',
          'Propose le correctif minimal qui supprime la cause, sans réécrire ce qui fonctionne.',
          'Donne un moyen de vérifier le correctif : une entrée qui échouait et réussit désormais.',
          'Signale les autres endroits du code exposés au même problème.'],
        en: ['Read the code and the full error message; locate the line and the value at fault.',
          'Explain the root cause in 2-3 sentences: why the error happens, not just where.',
          'Propose the minimal fix that removes the cause, without rewriting what works.',
          'Give a way to verify the fix: an input that used to fail and now succeeds.',
          'Point out other places in the code exposed to the same problem.']
      },
      constraints: {
        fr: ['Ne change pas le comportement du code au-delà du correctif ; propose les autres améliorations à part.',
          'N\'invente aucune fonction ni option de bibliothèque : si tu n\'es pas sûr qu\'elle existe dans la version utilisée, dis-le.'],
        en: ['Change no behaviour beyond the fix; suggest other improvements separately.',
          'Invent no library function or option: if you are not sure it exists in the version in use, say so.']
      },
      quality: {
        fr: ['Le correctif s\'applique tel quel et fait disparaître l\'erreur décrite.', 'La cause expliquée correspond au message d\'erreur fourni.'],
        en: ['The fix applies as is and removes the error described.', 'The cause explained matches the error message provided.']
      },
      pitfalls: {
        fr: ['Masquer l\'erreur (try/except vide, valeur par défaut silencieuse) au lieu d\'en traiter la cause.', 'Réécrire tout le code pour corriger une ligne.'],
        en: ['Hiding the error (empty try/except, silent default) instead of fixing its cause.', 'Rewriting all the code to fix one line.']
      },
      output: { fr: '1. La cause, en 2 ou 3 phrases. 2. Le code corrigé dans un bloc de code (la partie modifiée, avec assez de contexte pour la situer). 3. Comment vérifier. 4. Les autres risques repérés, s\'il y en a.', en: '1. The cause, in 2-3 sentences. 2. The fixed code in a code block (the changed part, with enough context to place it). 3. How to verify. 4. Other risks found, if any.' }
    },
    refactor: {
      label: { fr: 'Amélioration de code', en: 'Code improvement' }, family: 'transform', verb: { fr: 'À AMÉLIORER', en: 'TO IMPROVE' },
      persona: { fr: 'un ingénieur logiciel senior qui fait des revues de code exigeantes', en: 'a senior software engineer who does demanding code reviews' },
      method: {
        fr: ['Lis le code en entier et décris en une phrase ce qu\'il fait réellement.',
          'Repère les problèmes par ordre d\'impact : bugs latents, sécurité, performance, lisibilité.',
          'Réécris le code en gardant exactement le même comportement visible.',
          'Liste chaque changement avec sa raison en une ligne.'],
        en: ['Read the whole code and describe in one sentence what it actually does.',
          'Find the problems in order of impact: latent bugs, security, performance, readability.',
          'Rewrite the code keeping exactly the same visible behaviour.',
          'List each change with its reason in one line.']
      },
      constraints: {
        fr: ['Garde la même interface (noms publics, paramètres, valeurs de retour), sauf si la demande dit le contraire.', 'N\'ajoute aucune dépendance sans la justifier en une ligne.'],
        en: ['Keep the same interface (public names, parameters, return values) unless the request says otherwise.', 'Add no dependency without a one-line justification.']
      },
      quality: {
        fr: ['Le code amélioré fait exactement ce que faisait l\'original, en mieux.', 'Chaque changement a une raison écrite.'],
        en: ['The improved code does exactly what the original did, better.', 'Every change has a written reason.']
      },
      pitfalls: { fr: ['Changer le comportement du code sans le dire.', 'Ajouter de l\'abstraction que le problème ne demande pas.'], en: ['Changing the code\'s behaviour without saying so.', 'Adding abstraction the problem does not need.'] },
      output: { fr: 'Le code amélioré complet dans un bloc de code, puis la liste des changements (une ligne chacun, avec sa raison).', en: 'The complete improved code in a code block, then the list of changes (one line each, with its reason).' }
    },
    review: {
      label: { fr: 'Analyse critique', en: 'Review' }, family: 'shape', verb: { fr: 'À ANALYSER', en: 'TO REVIEW' },
      method: {
        fr: ['Lis le contenu en entier et identifie à quoi il sert et pour qui.',
          'Annonce les critères d\'évaluation adaptés à cet usage, puis évalue le contenu sur chacun.',
          'Classe les problèmes du plus grave au moins grave, en citant le passage concerné.',
          'Pour chaque problème important, propose une correction concrète.',
          'Termine par ce qui fonctionne déjà et doit être conservé.'],
        en: ['Read the whole content and identify what it is for and who it is for.',
          'State the evaluation criteria that fit that purpose, then assess the content on each.',
          'Rank the problems from most to least serious, quoting the passage concerned.',
          'For each important problem, propose a concrete fix.',
          'End with what already works and should be kept.']
      },
      constraints: {
        fr: ['Juge le contenu sur ce qu\'il doit accomplir, pas sur tes préférences de style.', 'Distingue les problèmes certains des points discutables, et dis lesquels sont lesquels.'],
        en: ['Judge the content on what it must achieve, not on your style preferences.', 'Separate definite problems from debatable points, and say which is which.']
      },
      ownQuality: true,
      quality: {
        fr: ['Chaque critique cite le passage qu\'elle vise.', 'Chaque correction est applicable sans autre explication.', 'Le problème le plus grave apparaît en premier.'],
        en: ['Every criticism quotes the passage it targets.', 'Every fix can be applied without further explanation.', 'The most serious problem comes first.']
      },
      pitfalls: {
        fr: ['Aligner des remarques de forme quand le fond pose problème.', 'Critiquer sans proposer de correction.'],
        en: ['Piling up surface remarks when the substance has a problem.', 'Criticising without proposing a fix.']
      },
      output: { fr: 'Un verdict en 2 phrases, puis les points à corriger classés par gravité (passage cité, problème, correction), puis les points forts.', en: 'A two-sentence verdict, then the issues ranked by severity (quoted passage, problem, fix), then the strengths.' }
    },
    explain: {
      label: { fr: 'Explication', en: 'Explanation' }, family: 'shape', verb: { fr: 'À EXPLIQUER', en: 'TO EXPLAIN' },
      method: {
        fr: ['Commence par une réponse directe en une ou deux phrases.',
          'Développe ensuite le mécanisme : comment et pourquoi, étape par étape.',
          'Donne un exemple concret ou une analogie tirée de la vie courante.',
          'Signale l\'erreur de compréhension la plus fréquente sur ce sujet.'],
        en: ['Start with a direct answer in one or two sentences.',
          'Then develop the mechanism: how and why, step by step.',
          'Give a concrete example or an everyday analogy.',
          'Point out the most common misunderstanding about this topic.']
      },
      quality: {
        fr: ['Le lecteur pourrait réexpliquer l\'idée à quelqu\'un d\'autre après lecture.'],
        en: ['After reading, the reader could explain the idea to someone else.']
      },
      output: { fr: 'La réponse directe d\'abord, puis l\'explication, puis l\'exemple.', en: 'The direct answer first, then the explanation, then the example.' }
    },
    brainstorm: {
      label: { fr: 'Idées', en: 'Ideas' }, family: 'shape', verb: null,
      method: {
        fr: ['Produis d\'abord beaucoup de pistes, puis ne garde que les plus fortes.',
          'Varie les angles : chaque proposition doit différer des autres sur le fond, pas seulement dans la formulation.',
          'Pour chaque proposition, ajoute en une ligne pourquoi elle fonctionne.',
          'Termine par ta recommandation et sa raison.'],
        en: ['First generate many options, then keep only the strongest.',
          'Vary the angles: each proposal must differ from the others in substance, not just wording.',
          'For each proposal, add one line on why it works.',
          'End with your recommendation and its reason.']
      },
      quality: {
        fr: ['Aucune proposition n\'est une variante d\'une autre.', 'Au moins une proposition sort des réponses attendues.'],
        en: ['No proposal is a variant of another.', 'At least one proposal goes beyond the expected answers.']
      },
      output: { fr: 'Une liste numérotée de propositions (10 si la demande ne fixe pas de nombre), chacune suivie de sa justification en une ligne, puis la recommandation.', en: 'A numbered list of proposals (10 if the request sets no number), each followed by a one-line rationale, then the recommendation.' },
      outputCounted: { fr: 'Une liste numérotée de propositions, chacune suivie de sa justification en une ligne, puis la recommandation.', en: 'A numbered list of proposals, each followed by a one-line rationale, then the recommendation.' }
    },
    compare: {
      label: { fr: 'Comparaison', en: 'Comparison' }, family: 'shape', verb: null, shape: 'table',
      method: {
        fr: ['Définis les critères qui comptent pour cette décision, et dis pourquoi.',
          'Évalue chaque option sur chaque critère, avec la même exigence pour toutes.',
          'Signale ce qui ferait changer la conclusion (budget, contexte, priorité).',
          'Termine par une recommandation claire pour le cas décrit.'],
        en: ['Define the criteria that matter for this decision, and say why.',
          'Assess each option on each criterion, with the same rigour for all.',
          'Point out what would change the conclusion (budget, context, priority).',
          'End with a clear recommendation for the case described.']
      },
      quality: {
        fr: ['Les options sont jugées sur les mêmes critères.', 'La recommandation découle des critères, pas d\'une préférence non dite.'],
        en: ['The options are judged on the same criteria.', 'The recommendation follows from the criteria, not from an unstated preference.']
      },
      output: { fr: 'Un tableau (une colonne par option, une ligne par critère), puis la recommandation en 2 ou 3 phrases.', en: 'A table (one column per option, one row per criterion), then the recommendation in 2-3 sentences.' }
    },
    plan: {
      label: { fr: 'Plan d\'action', en: 'Plan' }, family: 'shape', verb: null,
      method: {
        fr: ['Pars de l\'objectif final et de l\'échéance, puis découpe en étapes.',
          'Pour chaque étape : ce qu\'il faut faire, le temps estimé, ce qui doit être fini avant.',
          'Repère l\'étape qui risque le plus de bloquer et propose une parade.'],
        en: ['Start from the final goal and the deadline, then break it into steps.',
          'For each step: what to do, the estimated time, what must be finished first.',
          'Identify the step most likely to stall and propose a workaround.']
      },
      quality: {
        fr: ['Chaque étape est faisable telle qu\'écrite, sans autre recherche.', 'Le total des durées tient dans le temps disponible.'],
        en: ['Each step is doable as written, with no further research.', 'The total duration fits the time available.']
      },
      output: { fr: 'Les étapes numérotées dans l\'ordre d\'exécution, chacune avec sa durée estimée et son résultat attendu.', en: 'Numbered steps in order of execution, each with its estimated duration and expected outcome.' }
    },
    /* Analyser un contenu fourni : l'expertise vient du domaine (données,
       finance…), la tâche n'apporte que la place du contenu. */
    analyze: { label: { fr: 'Analyse', en: 'Analysis' }, family: 'create', verb: { fr: 'À ANALYSER', en: 'TO ANALYZE' } },
    create: { label: { fr: 'Création', en: 'Creation' }, family: 'create', verb: null }
  };

  function detectTask(raw, lang, domainId) {
    var n = normalize(raw);
    var o = normalize(toObjective(raw, lang));
    var ref = findReference(n);
    var inline = inlineContent(raw);
    var id = 'create';
    for (var i = 0; i < TASK_RULES.length; i++) {
      if (TASK_RULES[i][1](n, o, domainId, lang, ref, inline)) { id = TASK_RULES[i][0]; break; }
    }
    var def = TASKS[id];
    var proofread = id === 'rewrite' && (/^(corrige|corriger|proofread)\b/.test(o) || /\b(fautes?|orthographe|grammaire|coquilles?|typos?|spelling|grammar)\b/.test(n));
    /* Un contenu à fournir : toujours pour une transformation, et pour les
       autres tâches seulement quand la demande en désigne un. Déjà présent
       dans la demande, il n'appelle aucun emplacement. */
    var needsInput = !inline && (def.family === 'transform' || !!ref);
    return { id: id, family: def.family, label: def.label, ref: ref, inline: inline, needsInput: needsInput, proofread: proofread };
  }

  /* Le public, tel que la demande le nomme : « pour mon patron », « à un
     enfant de 8 ans », « for non-technical managers ». Recopié entre
     guillemets plutôt que réécrit : aucun risque de le trahir. */
  var AUDIENCE_NOUNS = /\b(cto|ceo|cfo|coo|cmo|drh|dg|pdg|vp|patron|patronne|chef|cheffe|manager|managers|responsable|responsables|direction|directeur|directrice|dirigeants?|equipe|collegues?|clients?|prospects?|enfants?|eleves?|etudiants?|lyceens?|collegiens?|debutants?|novices?|experts?|specialistes?|investisseurs?|recruteurs?|jury|professeurs?|profs?|parents?|grand public|public|lecteurs?|proprietaires?|proprio|bailleur|locataires?|voisins?|mairie|banque|banquier|assureur|conseill[a-z]+|employeur|fournisseurs?|service client|pme|tpe|startups?|entreprises?|associations?|familles?|landlord|tenants?|neighbou?rs?|bank|insurer|employer|suppliers?|small business(?:es)?|compan(?:y|ies)|abonnes?|utilisateurs?|developpeurs?|medecins?|patients?|juristes?|avocats?|employes?|salaries?|candidats?|partenaires?|boss|team|colleagues?|customers?|kids?|children|students?|beginners?|executives?|stakeholders?|investors?|recruiters?|teachers?|readers?|users?|developers?|audience|newcomers?|non-?experts?)\b/;
  var AUDIENCE_STOP = /\s+(?:en|avec|sur|qui|que|afin|pour|et|dans|in|with|about|that|which|so|and|on)\s+.*$/i;

  function extractAudience(raw) {
    var s = String(raw || '');
    var re = /(?:^|[\s(])(?:pour|à|a|destinée? à|destinés? à|for|to|aimed at)\s+((?:un|une|des|les|mon|ma|mes|notre|nos|son|sa|ses|ton|ta|tes|leur|leurs|le|la|l'|a|an|the|my|our|your|their)\s+[^,.;:!?()\n]{2,70})/gi;
    var m;
    while ((m = re.exec(s)) !== null) {
      var phrase = m[1].replace(AUDIENCE_STOP, '').trim();
      var head = normalize(phrase).split(' ').slice(0, 5).join(' ');
      if (AUDIENCE_NOUNS.test(head)) return phrase;
    }
    return '';
  }

  /* La langue d'arrivée d'une traduction ou d'une réponse : « en anglais »,
     « vers l'espagnol », « into German ». */
  var LANG_WORDS = {
    anglais: 'en', english: 'en', francais: 'fr', french: 'fr', espagnol: 'es', spanish: 'es', allemand: 'de', german: 'de',
    italien: 'it', italian: 'it', portugais: 'pt', portuguese: 'pt', neerlandais: 'nl', dutch: 'nl', arabe: 'ar', arabic: 'ar',
    chinois: 'zh', chinese: 'zh', japonais: 'ja', japanese: 'ja', russe: 'ru', russian: 'ru'
  };
  function extractTargetLang(raw) {
    var n = normalize(raw);
    var m = n.match(/\b(?:en|vers l'|vers le|vers|in|into|to)\s*(anglais|english|francais|french|espagnol|spanish|allemand|german|italien|italian|portugais|portuguese|neerlandais|dutch|arabe|arabic|chinois|chinese|japonais|japanese|russe|russian)\b/);
    return m ? LANG_WORDS[m[1]] : '';
  }

  /* Ce que la demande ne dit pas et dont la réponse dépend. Nommé dans le
     prompt, plutôt qu'un « si une information manque » générique : l'IA sait
     exactement sur quoi faire une hypothèse, ou quoi demander. */
  function missingSlots(task, a, o, raw, extra) {
    var n = normalize(raw);
    var out = [];
    var add = function (fr, en) { out.push({ fr: fr, en: en }); };
    var hasLen = !!(o.length || a.cues.quantity.length || a.cues.count.length);
    var hasAud = !!(o.audience || extra.audience);
    var hasTone = !!(o.tone || a.cues.tone.length);
    var dom = a.domain.id;
    switch (task.id) {
      case 'summarize':
        if (!hasLen) add('la longueur du résumé', 'the length of the summary');
        if (!hasAud) add('le lecteur visé', 'the intended reader');
        break;
      case 'translate':
        if (!extra.targetLang && !o.answerLang) add('la langue cible', 'the target language');
        break;
      case 'rewrite':
        if (!task.proofread && !hasTone) add('le ton visé', 'the intended tone');
        break;
      case 'debug':
        if (!CODE_LANG.test(n)) add('le langage et sa version', 'the language and its version');
        if (!/\b(devrait|cense|censee|attendu|attendue|should|expected|supposed)\b/.test(n)) add('ce que le code devrait faire', 'what the code should do');
        break;
      case 'refactor':
        if (!CODE_LANG.test(n)) add('le langage et sa version', 'the language and its version');
        if (!/\b(lisib|perf|rapide|vitesse|memoire|readab|speed|fast|memory|securit|security)/.test(n)) add('la priorité : lisibilité, performance ou sécurité', 'the priority: readability, performance or security');
        break;
      case 'extract':
        break;
      case 'review':
        /* « Analyse ce document », sans plus : on ne sait pas selon quoi juger. */
        if (!hasAud && normalize(toObjective(raw, 'fr')).split(' ').length <= 5) add('à quoi sert le contenu et pour qui', 'what the content is for and who it is for');
        break;
      case 'explain':
        if (!hasAud) add('le niveau de connaissance du lecteur', 'the reader\'s level of knowledge');
        break;
      case 'brainstorm':
        if (!a.cues.count.length) add('le nombre de propositions', 'the number of proposals');
        if (!hasAud) add('le public visé', 'the target audience');
        break;
      case 'compare':
        if (!/\b(critere|criteres|budget|prix|cout|criteria|price|cost)\b/.test(n)) add('les critères qui comptent le plus (budget, simplicité, performance…)', 'the criteria that matter most (budget, simplicity, performance…)');
        break;
      case 'plan':
        if (!a.cues.deadline.length && !/\b\d+\s*(jours?|semaines?|mois|ans?|days?|weeks?|months?|years?)\b/.test(n)) add('l\'échéance', 'the deadline');
        if (!/\b\d+\s*(h|heures?|minutes?|hours?)\b|par (jour|semaine)|per (day|week)/.test(n)) add('le temps disponible', 'the time available');
        break;
      case 'create':
        if (dom === 'email') {
          if (!hasAud) add('le destinataire et la relation avec lui', 'the recipient and the relationship with them');
          if (!countMarkers(' ' + n + ' ', SUCCESS_MARKERS)) add('l\'action attendue du destinataire', 'the action expected from the recipient');
        } else if (dom === 'social') {
          if (!/\b(linkedin|instagram|tiktok|twitter|facebook|youtube|threads|bluesky|pinterest|snapchat)\b/.test(n)) add('le réseau social visé', 'the target social network');
          if (!hasAud) add('le public visé', 'the target audience');
        } else if (dom === 'writing' || dom === 'marketing' || dom === 'seo') {
          if (!hasAud) add('le public visé', 'the target audience');
          if (!hasLen) add('la longueur visée', 'the target length');
        }
    }
    return out.slice(0, 3);
  }

  /* ------------------------------------------------------------- vocabulary */

  var L = {
    role: { fr: 'RÔLE', en: 'ROLE' },
    context: { fr: 'CONTEXTE', en: 'CONTEXT' },
    objective: { fr: 'OBJECTIF', en: 'OBJECTIVE' },
    method: { fr: 'MÉTHODE — suis ces étapes dans l\'ordre', en: 'METHOD — follow these steps in order' },
    inputs: { fr: 'CONTENU FOURNI', en: 'PROVIDED CONTENT' },
    reminder: { fr: 'RAPPEL DE LA TÂCHE', en: 'TASK REMINDER' },
    constraints: { fr: 'CONTRAINTES', en: 'CONSTRAINTS' },
    output: { fr: 'FORMAT DE SORTIE', en: 'OUTPUT FORMAT' },
    quality: { fr: 'CRITÈRES DE QUALITÉ — vérifie-les avant de répondre', en: 'QUALITY BAR — check these before answering' },
    avoid: { fr: 'PIÈGES À ÉVITER', en: 'PITFALLS TO AVOID' },
    examples: { fr: 'EXEMPLES', en: 'EXAMPLES' },
    clarify: { fr: 'INFORMATIONS MANQUANTES', en: 'MISSING INFORMATION' },
    reasoning: { fr: 'RAISONNEMENT', en: 'REASONING' },
    check: { fr: 'VÉRIFICATION FINALE', en: 'FINAL CHECK' }
  };

  var XML_TAGS = {
    role: 'role', context: 'context', objective: 'objective', method: 'method', inputs: 'inputs',
    constraints: 'constraints', output: 'output_format', quality: 'quality_bar', avoid: 'avoid',
    examples: 'examples', clarify: 'missing_info', reasoning: 'reasoning', check: 'final_check', reminder: 'task_reminder',
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
      fr: 'N\'invente aucun fait, chiffre, source, citation, référence ni date : la réponse sera utilisée telle quelle, et une erreur passerait inaperçue. Si une information te manque, écris ce qui manque plutôt que de combler le vide.',
      en: 'Invent no fact, figure, source, quotation, reference or date: the answer will be used as is, and an error would go unnoticed. If information is missing, say what is missing rather than filling the gap.'
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
    balanced: { fr: 'Réponse complète mais dense : chaque phrase doit apporter une information nouvelle.', en: 'Complete but dense: every sentence must add new information.' },
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

    var task = a.task;
    var tdef = TASKS[task.id];
    var transform = tdef.family === 'transform';
    var orient = tdef.family === 'shape';
    var fr = l === 'fr';
    var audience = o.audience || a.extras.audience;
    var objective = toObjective(raw, l);
    var inp = task.needsInput ? inputBlock(task, tdef, l) : null;

    // RÔLE
    if (o.flags.role) {
      var persona = o.persona;
      if (!persona) {
        persona = transform ? tdef.persona[l] : p.persona[l];
        /* Un résumé de contrat reste un résumé, mais il faut connaître le
           droit pour savoir ce qui compte : la tâche donne le métier, le
           domaine la spécialité. */
        if (transform && SPECIALISED.indexOf(a.domain.id) !== -1 && a.domain.confidence >= 40) {
          persona += fr ? ', familier du domaine « ' + p.label.fr + ' »' : ', at home in the field of "' + p.label.en + '"';
        }
      }
      push('role', L.role[l], [
        T.youAre[l] + persona + '.',
        fr
          ? 'Tu réponds avec le niveau d\'exigence que tu appliquerais à un livrable facturé à un client.'
          : 'You answer to the standard you would apply to a deliverable a client is paying for.'
      ]);
    }

    // CONTEXTE
    var ctxLines = [];
    if (o.context) ctxLines.push(o.context.trim());
    ctxLines.push(T.initialRequest[l] + cite(String(raw).trim().replace(/\s+/g, ' '), l));
    if (audience) {
      /* La raison suit la consigne : un modèle qui sait POURQUOI il doit
         viser ce lecteur en tire seul les conséquences. */
      ctxLines.push(T.audience[l] + (o.audience ? o.audience : cite(audience, l)) + '. ' +
        (fr ? 'Adapte le vocabulaire, le niveau de détail et les exemples à ce lecteur.' : 'Adapt vocabulary, level of detail and examples to this reader.'));
    }
    if (o.model && o.model !== 'any') {
      var mn = MODEL_NAMES[o.model];
      ctxLines.push(T.model[l] + (typeof mn === 'string' ? mn : (mn ? mn[l] : o.model)));
    }
    push('context', L.context[l], ctxLines);

    // OBJECTIF
    var objLines = [objective];
    if (inp) objLines.push(fr ? 'Le contenu à traiter est fourni plus bas, ' + inp.where.fr + '.' : 'The content to work on is provided below, ' + inp.where.en + '.');
    else if (task.inline && (transform || task.ref)) objLines.push(fr ? 'Le contenu à traiter figure dans la demande initiale ci-dessus.' : 'The content to work on is in the original request above.');
    objLines.push(DEPTH_LABEL[o.depth] ? DEPTH_LABEL[o.depth][l] : DEPTH_LABEL.balanced[l]);
    push('objective', L.objective[l], objLines);

    // CONTENU FOURNI — après la consigne courte, avant les instructions
    // détaillées : les éditeurs recommandent de placer le contenu long au-dessus
    // de la question, et de rappeler la tâche après lui.
    if (inp) push('inputs', inp.title, inp.lines);

    // MÉTHODE
    if (o.flags.method && o.depth !== 'direct') {
      var steps = task.proofread ? tdef.proofread[l] : (tdef.method ? tdef.method[l] : p.method[l]);
      push('method', L.method[l], steps.map(function (st, i) { return (i + 1) + '. ' + st; }));
    }

    // CONTRAINTES
    if (o.flags.constraints) {
      var cons = (tdef.constraints ? tdef.constraints[l] : p.constraints[l]).slice();
      var tone = o.tone || a.cues.tone.join(', ');
      if (tone) cons.unshift(T.tone[l] + tone + '.');
      if (o.length) cons.unshift(T.length[l] + o.length + '.');
      else if (a.cues.quantity.length) cons.unshift(T.length[l] + a.cues.quantity.map(function (q) { return retrouve(raw, q); }).join(', ') + '.');
      var langCode = o.answerLang || a.extras.targetLang;
      var al = langCode && LANG_NAMES[langCode] ? LANG_NAMES[langCode][l] : null;
      if (al) cons.unshift((task.id === 'translate' ? (fr ? 'Langue cible : ' : 'Target language: ') : T.lang[l]) + al + '.');
      if (inp) cons.push(fr
        ? 'Si le contenu attendu ' + inp.where.fr + ' est absent ou encore entre crochets, demande-le au lieu de répondre : sans lui, toute réponse serait inventée.'
        : 'If the content expected ' + inp.where.en + ' is missing or still in square brackets, ask for it instead of answering: without it, any answer would be made up.');
      /* Une seule règle contre l'invention : si le profil ou la tâche en porte
         déjà une, la répéter n'ajoute rien. */
      if (o.flags.noHallucination && !/(invent|aucune information absente|ajoute ni ne retire|add no information|add or remove no)/i.test(cons.join(' '))) cons.push(T.noHallu[l]);
      push('constraints', L.constraints[l], cons.map(function (st) { return '- ' + st; }));
    }

    // FORMAT DE SORTIE — ce que la demande exige l'emporte sur ce que la tâche
    // propose, qui l'emporte sur l'habitude du domaine. Deux consignes de forme
    // contradictoires font perdre au modèle son raisonnement à les concilier.
    /* Une forme explicite dans la consigne s'impose, sauf à une transformation
       dont le format découle de la tâche (« corrige cette erreur JSON » ne
       demande pas une réponse en JSON). */
    var signalKey = o.outputShape === 'auto' && (!transform || task.id === 'extract') ? a.shape : null;
    var shapeKey = o.outputShape !== 'auto' ? o.outputShape : signalKey;
    if (signalKey && tdef.shape === signalKey) shapeKey = null;
    var counts = a.cues.count.map(function (c) { return retrouve(raw, c); });
    var outLines = [];
    var countFirst = counts.length && !a.cues.quantity.length && countLeads(objective, a.cues.count[0]);
    if (shapeKey && OUTPUT_SHAPES[shapeKey]) outLines.push(OUTPUT_SHAPES[shapeKey][l]);
    else if (tdef.family === 'create' && countFirst) outLines.push(fr ? 'Une liste numérotée, chaque élément développé en 1 à 3 phrases.' : 'A numbered list, each item developed in 1-3 sentences.');
    else if (task.proofread) outLines.push(tdef.proofreadOutput[l]);
    else if (counts.length && tdef.outputCounted) outLines.push(tdef.outputCounted[l]);
    else outLines.push(tdef.output ? tdef.output[l] : p.output[l]);
    if (counts.length) outLines.push((fr ? 'Quantité : exactement ' : 'Quantity: exactly ') + counts.join(', ') + '.');
    var autres = a.cues.format.filter(function (f) { return /^(csv|yaml|xml|schema|diagramme|diagram)$/.test(f); });
    if (autres.length && o.outputShape === 'auto' && !transform) {
      outLines.push((fr ? 'Éléments de format repérés dans la demande : ' : 'Format cues found in the request: ') + autres.join(', ') + '.');
    }
    var withHyp = o.clarification === 'assume';
    outLines.push(fr
      ? 'Commence directement par le contenu demandé' + (withHyp ? ' (précédé seulement des hypothèses, s\'il y en a)' : '') + ' : pas de phrase d\'introduction, pas de commentaire sur ta propre réponse.'
      : 'Start directly with the requested content' + (withHyp ? ' (preceded only by your assumptions, if any)' : '') + ': no introductory sentence, no commentary on your own answer.');
    push('output', L.output[l], outLines);

    // EXEMPLES
    if (o.flags.examples) {
      push('examples', L.examples[l], [T.fewShot[l], '', T.fewShotPlaceholder[l]]);
    }

    // CRITÈRES DE QUALITÉ
    if (o.flags.quality) {
      var qual = transform || tdef.ownQuality ? tdef.quality[l] : (orient ? p.quality[l].slice(0, 3).concat(tdef.quality[l]) : p.quality[l]);
      push('quality', L.quality[l], qual.map(function (st) { return '- ' + st; }));
    }

    // PIÈGES
    if (o.flags.pitfalls) {
      push('avoid', L.avoid[l], (tdef.pitfalls ? tdef.pitfalls[l] : p.pitfalls[l]).map(function (st) { return '- ' + st; }));
    }

    // RAISONNEMENT
    if (o.flags.reasoning && o.depth !== 'direct') {
      push('reasoning', L.reasoning[l], [o.depth === 'deep' ? T.cotDeep[l] : T.cotLight[l]]);
    }

    // INFORMATIONS MANQUANTES — nommées une à une quand on les connaît.
    var slots = missingSlots(task, a, o, raw, a.extras).map(function (x) { return x[l]; });
    if (o.clarification === 'ask') {
      push('clarify', L.clarify[l], [slots.length
        ? (fr ? 'Avant de produire quoi que ce soit, pose au maximum 3 questions courtes, en priorité sur : ' + slots.join(' ; ') + '. Attends les réponses. Si tout est déjà clair, réponds directement.'
              : 'Before producing anything, ask at most 3 short questions, first about: ' + slots.join('; ') + '. Wait for the answers. If everything is already clear, answer directly.')
        : T.askFirst[l]]);
    } else if (o.clarification === 'assume') {
      push('clarify', L.clarify[l], [slots.length
        ? (fr ? 'La demande ne précise pas : ' + slots.join(' ; ') + '. ' + (slots.length > 1 ? 'Pour chacun de ces points, retiens' : 'Retiens') + ' l\'hypothèse la plus raisonnable et annonce-la en une ligne au début de ta réponse, sous « Hypothèses ». Puis produis la réponse complète.'
              : 'The request does not specify: ' + slots.join('; ') + '. ' + (slots.length > 1 ? 'For each of these, take' : 'Take') + ' the most reasonable assumption and state it in one line at the start of your answer, under "Assumptions". Then deliver the full answer.')
        : T.assume[l]]);
    }

    // VÉRIFICATION FINALE
    if (o.flags.selfCheck) push('check', L.check[l], inp ? [T.selfCheck[l]] : [T.selfCheck[l], T.startNow[l]]);

    // RAPPEL — la tâche redite après le contenu, en dernier.
    if (inp) {
      push('reminder', L.reminder[l], [
        (fr ? 'Ta tâche : ' : 'Your task: ') + objective + ' ' +
        (fr ? 'Appuie-toi ' + (transform ? 'uniquement ' : '') + 'sur le contenu fourni ' + inp.where.fr + '.'
            : 'Rely ' + (transform ? 'only ' : '') + 'on the content provided ' + inp.where.en + '.'),
        T.startNow[l]
      ]);
    }

    return sections;
  }

  /* Domaines dont la spécialité change ce qui compte dans un texte. */
  var SPECIALISED = ['legal', 'finance', 'data', 'strategy', 'product', 'marketing', 'seo', 'education'];

  /* Le bloc où l'utilisateur colle son contenu : un titre, des balises qui le
     délimitent sans ambiguïté, et un emplacement entre crochets. */
  function inputBlock(task, tdef, l) {
    var fr = l === 'fr';
    if (task.id === 'debug') {
      var err = fr ? 'erreur' : 'error';
      return {
        title: fr ? 'CODE ET MESSAGE D\'ERREUR' : 'CODE AND ERROR MESSAGE',
        where: { fr: 'entre les balises <code> et <' + err + '>', en: 'between the <code> and <' + err + '> tags' },
        lines: ['<code>', fr ? '[Collez ici le code concerné]' : '[Paste the code concerned here]', '</code>',
          '<' + err + '>', fr ? '[Collez ici le message d\'erreur complet, avec la trace]' : '[Paste the full error message here, with the traceback]', '</' + err + '>']
      };
    }
    var key = task.ref || (task.id === 'refactor' ? 'code' : 'texte');
    var info = NOUNS[key] || NOUNS.texte;
    var verb = task.proofread ? tdef.proofreadVerb[l] : (tdef.verb ? tdef.verb[l] : '');
    var shown = fr ? info[0] : info[2];
    var title = verb ? (shown + ' ' + verb).toUpperCase() : (fr ? 'CONTENU FOURNI : ' : 'PROVIDED CONTENT: ') + shown.toUpperCase();
    var named = fr ? (info[1] === "l'" ? "l'" : info[1] + ' ') + info[0] : 'the ' + info[2];
    var tail = verb ? ' ' + verb.toLowerCase() : '';
    return {
      title: title,
      where: { fr: 'entre les balises <document>', en: 'between the <document> tags' },
      lines: ['<document>', fr ? '[Collez ici ' + named + tail + ']' : '[Paste ' + named + tail + ' here]', '</document>']
    };
  }

  /* Le nombre ouvre-t-il la demande (« donne-moi 5 conseils ») ou n'est-il
     qu'un détail d'un livrable plus large (« un article avec 5 exemples ») ? */
  function countPlaceholders(text) {
    return (String(text || '').match(/\[(?:Collez ici|Paste )[^\]\n]{0,200}\]/g) || []).length;
  }

  function countLeads(objective, count) {
    var words = normalize(objective).split(' ').slice(0, 8).join(' ');
    return words.indexOf(normalize(count)) !== -1;
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
        recommendedFormat: recommendedFormat(o.model, a.domain.id),
        task: a.task.id,
        /* Les emplacements que l'utilisateur doit remplir avant d'envoyer. */
        placeholders: countPlaceholders(text)
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
    detectTask: detectTask,
    countPlaceholders: countPlaceholders,
    extractAudience: extractAudience,
    extractTargetLang: extractTargetLang,
    TASKS: TASKS,
    estimateTokens: estimateTokens,
    recommendedFormat: recommendedFormat,
    FORMATS: FORMATS,
    OUTPUT_SHAPES: OUTPUT_SHAPES,
    LANG_NAMES: LANG_NAMES,
    MODEL_NAMES: MODEL_NAMES
  };
});
