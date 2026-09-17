/*!
 * PromptForge — bibliothèque de départs prêts à l'emploi.
 * Ce ne sont pas des prompts finis : ce sont des demandes bien formulées,
 * que le moteur transforme ensuite en prompt complet.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.templates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TEMPLATES = [
    {
      id: 'blog-article', domain: 'writing',
      title: { fr: 'Article de blog', en: 'Blog article' },
      desc: { fr: 'Un article de fond, structuré et publiable', en: 'A structured, publishable long-form article' },
      request: {
        fr: "Rédiger un article de blog de 1 200 mots sur [SUJET], destiné à [PUBLIC]. L'angle : [IDÉE PRINCIPALE À DÉFENDRE]. Je veux une introduction qui accroche en 3 phrases, 4 sections avec des sous-titres, des exemples concrets, et une conclusion qui donne une chose à faire. Ton : [expert mais accessible].",
        en: "Write a 1,200-word blog article about [TOPIC] for [AUDIENCE]. The angle: [MAIN IDEA TO DEFEND]. I want a hook of 3 sentences, 4 sections with subheadings, concrete examples, and a conclusion that gives one thing to do. Tone: [expert but accessible]."
      },
      opts: { outputShape: 'markdown', depth: 'balanced' }
    },
    {
      id: 'cold-email', domain: 'email',
      title: { fr: 'E-mail de prospection', en: 'Cold outreach email' },
      desc: { fr: 'Un premier contact court qui obtient une réponse', en: 'A short first contact that gets a reply' },
      request: {
        fr: "Écrire un e-mail de prospection à [FONCTION] chez [TYPE D'ENTREPRISE]. Je vends [OFFRE] qui résout [PROBLÈME PRÉCIS]. Nous avons obtenu [RÉSULTAT CHIFFRÉ] pour [CLIENT SIMILAIRE]. Objectif : obtenir un appel de 15 minutes. Maximum 120 mots, ton direct, pas de flatterie.",
        en: "Write a cold email to [ROLE] at [COMPANY TYPE]. I sell [OFFER] which solves [SPECIFIC PROBLEM]. We achieved [QUANTIFIED RESULT] for [SIMILAR CLIENT]. Goal: book a 15-minute call. Max 120 words, direct tone, no flattery."
      },
      opts: { outputShape: 'email', depth: 'direct' }
    },
    {
      id: 'code-review', domain: 'code',
      title: { fr: 'Relecture de code', en: 'Code review' },
      desc: { fr: 'Une revue sérieuse : bugs, sécurité, lisibilité', en: 'A serious review: bugs, security, readability' },
      request: {
        fr: "Relire le code ci-dessous en [LANGAGE] et signaler : les bugs réels, les failles de sécurité, les cas limites non gérés et les problèmes de lisibilité. Classe les remarques par gravité. Pour chacune, donne la ligne concernée et le correctif. Ne commente pas le style si le fond est correct.\n\n```\n[COLLER LE CODE ICI]\n```",
        en: "Review the [LANGUAGE] code below and report: real bugs, security flaws, unhandled edge cases and readability issues. Rank findings by severity. For each, give the line and the fix. Do not comment on style if the substance is sound.\n\n```\n[PASTE CODE HERE]\n```"
      },
      opts: { outputShape: 'markdown', depth: 'deep' }
    },
    {
      id: 'debug', domain: 'code',
      title: { fr: 'Débogage guidé', en: 'Guided debugging' },
      desc: { fr: 'Trouver la cause réelle, pas un symptôme', en: 'Find the real cause, not a symptom' },
      request: {
        fr: "Je rencontre cette erreur : [MESSAGE D'ERREUR COMPLET]. Contexte : [LANGAGE/FRAMEWORK + VERSION], sur [ENVIRONNEMENT]. Ce que fait le code : [COMPORTEMENT ATTENDU]. Ce qui se passe : [COMPORTEMENT RÉEL]. J'ai déjà essayé : [TENTATIVES]. Trouve la cause la plus probable, explique pourquoi, et donne le correctif.",
        en: "I hit this error: [FULL ERROR MESSAGE]. Context: [LANGUAGE/FRAMEWORK + VERSION], on [ENVIRONMENT]. What the code should do: [EXPECTED]. What happens: [ACTUAL]. Already tried: [ATTEMPTS]. Find the most likely cause, explain why, and give the fix."
      },
      opts: { depth: 'deep' }
    },
    {
      id: 'landing-page', domain: 'marketing',
      title: { fr: 'Page de vente', en: 'Landing page copy' },
      desc: { fr: 'Structure complète, bloc par bloc', en: 'Full structure, block by block' },
      request: {
        fr: "Écrire le texte d'une page de vente pour [PRODUIT], qui s'adresse à [CLIENT IDÉAL] et résout [PROBLÈME]. Prix : [PRIX]. Preuves disponibles : [CHIFFRES / TÉMOIGNAGES]. Blocs attendus : titre principal, sous-titre, problème, solution, bénéfices, preuves, objections, offre, appel à l'action. Donne 3 variantes de titre principal.",
        en: "Write landing-page copy for [PRODUCT], aimed at [IDEAL CUSTOMER], solving [PROBLEM]. Price: [PRICE]. Available proof: [FIGURES / TESTIMONIALS]. Blocks: headline, subhead, problem, solution, benefits, proof, objections, offer, call to action. Give 3 headline variants."
      },
      opts: { outputShape: 'markdown' }
    },
    {
      id: 'linkedin-post', domain: 'social',
      title: { fr: 'Post LinkedIn', en: 'LinkedIn post' },
      desc: { fr: 'Une accroche qui arrête le scroll', en: 'A hook that stops the scroll' },
      request: {
        fr: "Écrire un post LinkedIn sur [SUJET]. Mon angle : [OPINION OU LEÇON APPRISE]. Mon expérience concrète : [FAIT VÉCU, CHIFFRE, RÉSULTAT]. Public : [CIBLE]. 200 mots maximum, ton parlé, une idée par ligne, pas d'emoji décoratif. Termine par une question ouverte.",
        en: "Write a LinkedIn post about [TOPIC]. My angle: [OPINION OR LESSON LEARNED]. My concrete experience: [REAL FACT, NUMBER, OUTCOME]. Audience: [TARGET]. 200 words max, spoken tone, one idea per line, no decorative emoji. End with an open question."
      },
      opts: { depth: 'direct' }
    },
    {
      id: 'explain-simply', domain: 'education',
      title: { fr: 'Expliquer simplement', en: 'Explain it simply' },
      desc: { fr: 'De l\'intuition à la maîtrise, sans raccourci faux', en: 'From intuition to mastery, with no false shortcut' },
      request: {
        fr: "Expliquer [CONCEPT] à quelqu'un qui a [NIVEAU DE DÉPART]. Commence par une analogie du quotidien, puis la définition exacte, puis un exemple entièrement déroulé. Signale l'erreur que tout le monde fait à cet endroit. Termine par 3 exercices corrigés de difficulté croissante.",
        en: "Explain [CONCEPT] to someone with [STARTING LEVEL]. Start with an everyday analogy, then the exact definition, then one fully worked example. Flag the mistake everyone makes at that point. End with 3 solved exercises of increasing difficulty."
      },
      opts: { depth: 'balanced' }
    },
    {
      id: 'compare-options', domain: 'research',
      title: { fr: 'Comparer des options', en: 'Compare options' },
      desc: { fr: 'Un tableau comparatif puis une recommandation', en: 'A comparison table, then a recommendation' },
      request: {
        fr: "Comparer [OPTION A], [OPTION B] et [OPTION C] pour [MON CAS D'USAGE]. Mes critères par ordre d'importance : [CRITÈRE 1], [CRITÈRE 2], [CRITÈRE 3]. Mes contraintes : [BUDGET, TEMPS, COMPÉTENCES]. Donne un tableau comparatif, puis une recommandation argumentée, puis ce qui me ferait changer d'avis.",
        en: "Compare [OPTION A], [OPTION B] and [OPTION C] for [MY USE CASE]. My criteria in order: [CRITERION 1], [CRITERION 2], [CRITERION 3]. My constraints: [BUDGET, TIME, SKILLS]. Give a comparison table, then a reasoned recommendation, then what would change your mind."
      },
      opts: { outputShape: 'table', depth: 'deep' }
    },
    {
      id: 'data-analysis', domain: 'data',
      title: { fr: 'Analyse de données', en: 'Data analysis' },
      desc: { fr: 'De la donnée brute à la décision', en: 'From raw data to a decision' },
      request: {
        fr: "Analyser les données ci-dessous pour répondre à : [QUESTION DÉCISIONNELLE]. Période couverte : [PÉRIODE]. Ce que je compte faire du résultat : [DÉCISION À PRENDRE]. Donne la méthode avant les chiffres, puis les 3 constats les plus décisifs, puis ce que ces données ne permettent pas de conclure.\n\n[COLLER LES DONNÉES ICI]",
        en: "Analyse the data below to answer: [DECISION QUESTION]. Period covered: [PERIOD]. What I will do with the result: [DECISION]. Give the method before the numbers, then the 3 most decisive findings, then what this data cannot support.\n\n[PASTE DATA HERE]"
      },
      opts: { depth: 'deep' }
    },
    {
      id: 'business-plan', domain: 'strategy',
      title: { fr: 'Décision stratégique', en: 'Strategic decision' },
      desc: { fr: 'Un arbitrage tranché, avec plan d\'action', en: 'A decided trade-off, with an action plan' },
      request: {
        fr: "Je dois décider : [DÉCISION À PRENDRE]. Contexte : [ACTIVITÉ, TAILLE, ÉTAPE]. Mes ressources : [BUDGET, TEMPS, ÉQUIPE]. Ce que j'ai déjà essayé : [HISTORIQUE]. Compare 2 ou 3 scénarios sur les mêmes critères, tranche, et donne un plan d'action 48 h / 30 jours / 90 jours avec un indicateur par étape.",
        en: "I need to decide: [DECISION]. Context: [BUSINESS, SIZE, STAGE]. My resources: [BUDGET, TIME, TEAM]. What I already tried: [HISTORY]. Compare 2-3 scenarios on the same criteria, commit to one, and give a 48h / 30-day / 90-day action plan with one metric per step."
      },
      opts: { depth: 'deep' }
    },
    {
      id: 'user-story', domain: 'product',
      title: { fr: 'Spécification produit', en: 'Product spec' },
      desc: { fr: 'Parcours, critères d\'acceptation, hors périmètre', en: 'Journey, acceptance criteria, out of scope' },
      request: {
        fr: "Rédiger la spécification de la fonctionnalité [NOM]. Problème utilisateur : [PROBLÈME] — preuve : [DONNÉE OU RETOUR CLIENT]. Utilisateur concerné : [PERSONA]. Décris le parcours écran par écran, y compris états vides, chargement et erreur. Donne les critères d'acceptation en « étant donné / quand / alors » et ce qui est hors périmètre.",
        en: "Write the spec for the [NAME] feature. User problem: [PROBLEM] — evidence: [DATA OR FEEDBACK]. Affected user: [PERSONA]. Describe the journey screen by screen, including empty, loading and error states. Give acceptance criteria as given/when/then, and what is out of scope."
      },
      opts: { outputShape: 'markdown', depth: 'deep' }
    },
    {
      id: 'image-photo', domain: 'image',
      title: { fr: 'Image photoréaliste', en: 'Photorealistic image' },
      desc: { fr: 'Sujet, cadrage, lumière, rendu', en: 'Subject, framing, light, finish' },
      request: {
        fr: "Générer une image de [SUJET PRÉCIS] dans [LIEU / DÉCOR]. Ambiance : [ÉMOTION]. Lumière : [HEURE DU JOUR, DIRECTION]. Cadrage : [PLAN LARGE / PORTRAIT / GROS PLAN]. Style : photographie [TYPE D'APPAREIL OU DE RENDU]. Format : [RATIO].",
        en: "Generate an image of [PRECISE SUBJECT] in [PLACE / SETTING]. Mood: [EMOTION]. Light: [TIME OF DAY, DIRECTION]. Framing: [WIDE / PORTRAIT / CLOSE-UP]. Style: [CAMERA OR RENDER TYPE] photography. Aspect ratio: [RATIO]."
      },
      opts: { format: 'compact', model: 'image' }
    },
    {
      id: 'video-script', domain: 'video',
      title: { fr: 'Script vidéo court', en: 'Short video script' },
      desc: { fr: 'Minuté, voix off et image séparées', en: 'Timed, voice and visuals separated' },
      request: {
        fr: "Écrire un script de vidéo de [DURÉE] sur [SUJET] pour [PLATEFORME]. Public : [CIBLE]. Objectif : [CE QUE LE SPECTATEUR DOIT FAIRE / RETENIR]. Découpe en séquences minutées, avec pour chacune la voix off, ce qui est à l'image et le texte à l'écran. Les 5 premières secondes doivent retenir l'attention.",
        en: "Write a [DURATION] video script about [TOPIC] for [PLATFORM]. Audience: [TARGET]. Goal: [WHAT THE VIEWER SHOULD DO / REMEMBER]. Break it into timed sequences, each with voice-over, visuals and on-screen text. The first 5 seconds must hold attention."
      },
      opts: { outputShape: 'table' }
    },
    {
      id: 'translate', domain: 'translation',
      title: { fr: 'Traduction professionnelle', en: 'Professional translation' },
      desc: { fr: 'Le sens et l\'effet, pas le mot à mot', en: 'Meaning and effect, not word for word' },
      request: {
        fr: "Traduire le texte ci-dessous de [LANGUE SOURCE] vers [LANGUE CIBLE]. Usage du texte : [SITE WEB / CONTRAT / POST / NOTICE]. Public : [CIBLE]. Registre : [FORMEL / COURANT]. Ne traduis pas : [NOMS PROPRES, MARQUES, TERMES À CONSERVER]. Signale à part les passages ambigus.\n\n[COLLER LE TEXTE ICI]",
        en: "Translate the text below from [SOURCE LANGUAGE] into [TARGET LANGUAGE]. Use of the text: [WEBSITE / CONTRACT / POST / MANUAL]. Audience: [TARGET]. Register: [FORMAL / NEUTRAL]. Do not translate: [PROPER NOUNS, BRANDS, TERMS TO KEEP]. Flag ambiguous passages separately.\n\n[PASTE TEXT HERE]"
      },
      opts: { depth: 'balanced' }
    },
    {
      id: 'seo-page', domain: 'seo',
      title: { fr: 'Page optimisée SEO', en: 'SEO-optimised page' },
      desc: { fr: 'Intention de recherche, plan, balises', en: 'Search intent, outline, meta tags' },
      request: {
        fr: "Rédiger une page web optimisée sur la requête « [MOT-CLÉ PRINCIPAL] », pour [TYPE DE SITE]. Intention de recherche : [INFORMATIONNELLE / COMPARATIVE / TRANSACTIONNELLE]. Public : [CIBLE]. Ce que mes concurrents ne disent pas : [ANGLE DIFFÉRENCIANT]. Donne le plan H1/H2/H3, le contenu rédigé, puis title, meta description et slug.",
        en: "Write a page optimised for the query \"[PRIMARY KEYWORD]\", for [SITE TYPE]. Search intent: [INFORMATIONAL / COMPARATIVE / TRANSACTIONAL]. Audience: [TARGET]. What competitors miss: [DIFFERENTIATING ANGLE]. Give the H1/H2/H3 outline, the written content, then title, meta description and slug."
      },
      opts: { outputShape: 'markdown' }
    },
    {
      id: 'meeting-summary', domain: 'general',
      title: { fr: 'Compte rendu de réunion', en: 'Meeting summary' },
      desc: { fr: 'Décisions, actions, responsables', en: 'Decisions, actions, owners' },
      request: {
        fr: "Transformer les notes ci-dessous en compte rendu de réunion. Structure : décisions prises, actions avec responsable et échéance, points en suspens, prochaine étape. Reste strictement fidèle aux notes : n'ajoute aucune décision qui ne s'y trouve pas.\n\n[COLLER LES NOTES ICI]",
        en: "Turn the notes below into a meeting summary. Structure: decisions taken, actions with owner and due date, open points, next step. Stay strictly faithful to the notes: add no decision that is not in them.\n\n[PASTE NOTES HERE]"
      },
      opts: { outputShape: 'markdown', depth: 'direct' }
    },
    {
      id: 'json-extract', domain: 'data',
      title: { fr: 'Extraction en JSON', en: 'JSON extraction' },
      desc: { fr: 'Sortie machine, schéma strict', en: 'Machine output, strict schema' },
      request: {
        fr: "Extraire les informations suivantes du texte ci-dessous et les renvoyer en JSON : [CHAMP 1], [CHAMP 2], [CHAMP 3]. Si une information est absente, mets null — n'invente rien. Renvoie uniquement l'objet JSON, sans texte autour.\n\n[COLLER LE TEXTE ICI]",
        en: "Extract the following from the text below and return JSON: [FIELD 1], [FIELD 2], [FIELD 3]. If a value is absent, use null — invent nothing. Return only the JSON object, with no surrounding text.\n\n[PASTE TEXT HERE]"
      },
      opts: { outputShape: 'json', format: 'xml', depth: 'direct' }
    },
    {
      id: 'contract-review', domain: 'legal',
      title: { fr: 'Lecture de contrat', en: 'Contract read-through' },
      desc: { fr: 'Points de vigilance, en langage clair', en: 'Risk points, in plain language' },
      request: {
        fr: "Lire la clause / le contrat ci-dessous et m'expliquer, en langage clair : ce qu'elle m'engage à faire, les risques pour moi, et ce qui mériterait d'être renégocié. Je suis [PARTIE : prestataire / client / salarié]. Droit applicable : [PAYS]. Ne cite aucun article de loi sans certitude.\n\n[COLLER LE TEXTE ICI]",
        en: "Read the clause / contract below and explain in plain language: what it commits me to, the risks for me, and what is worth renegotiating. I am the [PARTY: provider / client / employee]. Governing law: [COUNTRY]. Cite no statute without certainty.\n\n[PASTE TEXT HERE]"
      },
      opts: { depth: 'deep' }
    },
    {
      id: 'budget-forecast', domain: 'finance',
      title: { fr: 'Prévisionnel chiffré', en: 'Financial forecast' },
      desc: { fr: 'Hypothèses visibles, scénarios', en: 'Visible assumptions, scenarios' },
      request: {
        fr: "Construire un prévisionnel sur [DURÉE] pour [ACTIVITÉ]. Entrées connues : [CHIFFRE D'AFFAIRES, CHARGES, PRIX, VOLUMES]. Devise : [DEVISE]. Donne les hypothèses en tête, le tableau de calcul détaillé mois par mois, puis un scénario pessimiste et un optimiste avec l'hypothèse qui les fait basculer.",
        en: "Build a [DURATION] forecast for [BUSINESS]. Known inputs: [REVENUE, COSTS, PRICE, VOLUMES]. Currency: [CURRENCY]. Put assumptions first, then a detailed month-by-month calculation table, then a downside and an upside scenario with the assumption that flips them."
      },
      opts: { outputShape: 'table', depth: 'deep' }
    },
    {
      id: 'rewrite-better', domain: 'writing',
      title: { fr: 'Réécrire un texte', en: 'Rewrite a text' },
      desc: { fr: 'Plus clair, plus court, même sens', en: 'Clearer, shorter, same meaning' },
      request: {
        fr: "Réécrire le texte ci-dessous pour [OBJECTIF : le rendre plus clair / plus court / plus percutant]. Public : [CIBLE]. Ton visé : [TON]. Conserve strictement le sens et les faits. Donne la version réécrite, puis la liste des changements les plus importants et pourquoi.\n\n[COLLER LE TEXTE ICI]",
        en: "Rewrite the text below to [GOAL: make it clearer / shorter / punchier]. Audience: [TARGET]. Target tone: [TONE]. Keep the meaning and facts strictly intact. Give the rewritten version, then the list of the most important changes and why.\n\n[PASTE TEXT HERE]"
      },
      opts: { depth: 'balanced' }
    },
    {
      id: 'interview-prep', domain: 'general',
      title: { fr: 'Préparer un entretien', en: 'Interview preparation' },
      desc: { fr: 'Questions probables et réponses travaillées', en: 'Likely questions and worked answers' },
      request: {
        fr: "Me préparer à un entretien pour le poste de [POSTE] chez [TYPE D'ENTREPRISE]. Mon parcours : [EXPÉRIENCE EN 3 LIGNES]. Mes points faibles sur cette offre : [FAIBLESSES]. Donne les 10 questions les plus probables, ce que le recruteur cherche derrière chacune, et une trame de réponse fondée sur mon parcours.",
        en: "Prepare me for an interview for a [ROLE] position at [COMPANY TYPE]. My background: [EXPERIENCE IN 3 LINES]. My weak points for this role: [WEAKNESSES]. Give the 10 most likely questions, what the interviewer is really testing, and an answer outline based on my background."
      },
      opts: { depth: 'deep' }
    },
    {
      id: 'brainstorm', domain: 'general',
      title: { fr: 'Générer des idées', en: 'Idea generation' },
      desc: { fr: 'Des idées exploitables, pas une liste creuse', en: 'Usable ideas, not a hollow list' },
      request: {
        fr: "Proposer 15 idées de [TYPE D'IDÉES] pour [CONTEXTE ET OBJECTIF]. Mes contraintes : [BUDGET, TEMPS, MOYENS]. Ce qui a déjà été fait et qu'il faut éviter : [DÉJÀ TESTÉ]. Pour chaque idée : une phrase de description, l'effort estimé et le risque principal. Classe-les de la plus rentable à la moins rentable.",
        en: "Propose 15 ideas for [IDEA TYPE] for [CONTEXT AND GOAL]. My constraints: [BUDGET, TIME, RESOURCES]. Already done, to avoid: [ALREADY TRIED]. For each idea: a one-line description, the estimated effort and the main risk. Rank from highest to lowest payoff.",
      },
      opts: { outputShape: 'table', depth: 'balanced' }
    },
    {
      id: 'sql-query', domain: 'data',
      title: { fr: 'Requête SQL', en: 'SQL query' },
      desc: { fr: 'Le schéma d\'abord, la requête ensuite', en: 'Schema first, query second' },
      request: {
        fr: "Écrire une requête SQL ([MOTEUR : PostgreSQL / MySQL / BigQuery]) qui répond à : [QUESTION]. Schéma des tables : [TABLES ET COLONNES]. Volume approximatif : [NOMBRE DE LIGNES]. Explique la requête ligne à ligne, puis indique comment la rendre performante.",
        en: "Write a SQL query ([ENGINE: PostgreSQL / MySQL / BigQuery]) answering: [QUESTION]. Table schema: [TABLES AND COLUMNS]. Approximate volume: [ROW COUNT]. Explain the query line by line, then say how to make it performant."
      },
      opts: { outputShape: 'code', depth: 'balanced' }
    },
    {
      id: 'system-prompt', domain: 'general',
      title: { fr: 'Prompt système d\'un agent', en: 'Agent system prompt' },
      desc: { fr: 'Pour configurer un assistant durable', en: 'To configure a lasting assistant' },
      request: {
        fr: "Écrire le prompt système d'un assistant qui [MISSION]. Ses utilisateurs : [QUI]. Ce qu'il doit toujours faire : [RÈGLES]. Ce qu'il ne doit jamais faire : [INTERDITS]. Ton : [TON]. Comment il réagit quand il ne sait pas : [COMPORTEMENT ATTENDU]. Format de ses réponses : [FORMAT].",
        en: "Write the system prompt for an assistant that [MISSION]. Its users: [WHO]. What it must always do: [RULES]. What it must never do: [PROHIBITIONS]. Tone: [TONE]. How it behaves when it does not know: [EXPECTED BEHAVIOUR]. Response format: [FORMAT]."
      },
      opts: { format: 'xml', depth: 'deep' }
    }
  ];

  return { list: TEMPLATES };
});
