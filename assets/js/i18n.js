/*! PromptForge — chaînes d'interface (FR / EN). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.i18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STR = {
    'app.name': { fr: 'PromptForge', en: 'PromptForge' },
    'app.tagline': { fr: 'L\'atelier de prompts', en: 'The prompt workshop' },
    'meta.description': {
      fr: 'Transformez n\'importe quelle demande en un prompt professionnel, prêt à envoyer à une IA.',
      en: 'Turn any request into a professional prompt, ready to send to an AI.'
    },

    'nav.workshop': { fr: 'Atelier', en: 'Workshop' },
    'nav.library': { fr: 'Bibliothèque', en: 'Library' },
    'nav.method': { fr: 'Méthode', en: 'Method' },
    'nav.theme': { fr: 'Changer de thème', en: 'Switch theme' },
    'nav.lang': { fr: 'Changer de langue', en: 'Switch language' },

    'hero.title': { fr: 'Votre idée, transformée en prompt de niveau professionnel.', en: 'Your idea, turned into a professional-grade prompt.' },
    'hero.lede': {
      fr: 'Écrivez votre demande comme elle vous vient. PromptForge en fait un prompt structuré — rôle, méthode, contraintes, critères de qualité — que vous collez tel quel dans l\'IA de votre choix.',
      en: 'Write your request however it comes out. PromptForge turns it into a structured prompt — role, method, constraints, quality bar — that you paste straight into the AI of your choice.'
    },
    'hero.stat1': { fr: 'domaines d\'expertise', en: 'expertise domains' },
    'hero.stat2': { fr: 'modèles de départ', en: 'starting templates' },
    'hero.stat3': { fr: 'donnée envoyée à un serveur', en: 'data sent to any server' },
    'hero.local': { fr: 'Tout est calculé dans votre navigateur.', en: 'Everything runs in your browser.' },

    'composer.title': { fr: 'Votre demande', en: 'Your request' },
    'composer.hint': { fr: 'Une phrase suffit. Plus vous en dites, meilleur sera le prompt.', en: 'One sentence is enough. The more you say, the better the prompt.' },
    'composer.placeholder': {
      fr: 'Ex. : je veux un mail pour relancer un client qui ne répond plus depuis trois semaines',
      en: 'e.g. I want an email to follow up with a client who has gone quiet for three weeks'
    },
    'composer.generate': { fr: 'Forger le prompt', en: 'Forge the prompt' },
    'composer.surprise': { fr: 'Exemple', en: 'Example' },
    'composer.clear': { fr: 'Effacer', en: 'Clear' },
    'composer.settings': { fr: 'Réglages du prompt', en: 'Prompt settings' },
    'composer.advanced': { fr: 'Options avancées', en: 'Advanced options' },
    'composer.detected': { fr: 'Domaine détecté', en: 'Detected domain' },
    'composer.words': { fr: 'mots', en: 'words' },

    'field.domain': { fr: 'Domaine', en: 'Domain' },
    'field.domain.auto': { fr: 'Détection automatique', en: 'Auto-detect' },
    'field.model': { fr: 'IA de destination', en: 'Target AI' },
    'field.format': { fr: 'Format du prompt', en: 'Prompt format' },
    'field.lang': { fr: 'Langue du prompt', en: 'Prompt language' },
    'field.lang.auto': { fr: 'Auto — langue de la demande', en: 'Auto — language of the request' },
    'field.answerLang': { fr: 'Langue de la réponse attendue', en: 'Expected answer language' },
    'field.answerLang.same': { fr: 'Identique au prompt', en: 'Same as the prompt' },
    'field.depth': { fr: 'Profondeur', en: 'Depth' },
    'field.outputShape': { fr: 'Forme de la réponse', en: 'Answer shape' },
    'field.clarification': { fr: 'Si une information manque', en: 'If information is missing' },
    'field.audience': { fr: 'Public cible', en: 'Target audience' },
    'field.audience.ph': { fr: 'ex. dirigeants non techniques', en: 'e.g. non-technical executives' },
    'field.tone': { fr: 'Ton', en: 'Tone' },
    'field.tone.ph': { fr: 'ex. direct, chaleureux, factuel', en: 'e.g. direct, warm, factual' },
    'field.length': { fr: 'Longueur visée', en: 'Target length' },
    'field.length.ph': { fr: 'ex. 400 mots, 5 puces', en: 'e.g. 400 words, 5 bullets' },
    'field.persona': { fr: 'Rôle personnalisé', en: 'Custom role' },
    'field.persona.ph': { fr: 'Laisser vide pour le rôle du domaine', en: 'Leave empty to use the domain role' },
    'field.context': { fr: 'Contexte additionnel', en: 'Additional context' },
    'field.context.ph': { fr: 'Qui vous êtes, à quoi servira le résultat, ce qui a déjà été tenté…', en: 'Who you are, what the result is for, what was already tried…' },

    'depth.direct': { fr: 'Direct — droit au but', en: 'Direct — straight to the point' },
    'depth.balanced': { fr: 'Équilibré — recommandé', en: 'Balanced — recommended' },
    'depth.deep': { fr: 'Approfondi — raisonnement détaillé', en: 'Deep — detailed reasoning' },

    'clarif.assume': { fr: 'Poser une hypothèse et la signaler', en: 'Assume and flag it' },
    'clarif.ask': { fr: 'Poser des questions avant de répondre', en: 'Ask questions first' },
    'clarif.none': { fr: 'Ne rien ajouter', en: 'Add nothing' },

    'shape.auto': { fr: 'Automatique (selon le domaine)', en: 'Automatic (by domain)' },
    'shape.prose': { fr: 'Texte rédigé', en: 'Prose' },
    'shape.bullets': { fr: 'Liste à puces', en: 'Bullet list' },
    'shape.table': { fr: 'Tableau', en: 'Table' },
    'shape.markdown': { fr: 'Markdown structuré', en: 'Structured markdown' },
    'shape.json': { fr: 'JSON strict', en: 'Strict JSON' },
    'shape.code': { fr: 'Code', en: 'Code' },
    'shape.email': { fr: 'E-mail', en: 'Email' },
    'shape.steps': { fr: 'Étapes numérotées', en: 'Numbered steps' },
    'shape.slides': { fr: 'Diapositives', en: 'Slides' },

    'format.structured': { fr: 'Markdown', en: 'Markdown' },
    'format.xml': { fr: 'Balises XML', en: 'XML tags' },
    'format.compact': { fr: 'Compact', en: 'Compact' },
    'format.json': { fr: 'JSON', en: 'JSON' },
    'format.systemuser': { fr: 'Système + Utilisateur', en: 'System + User' },
    'format.structured.help': { fr: 'Titres en markdown. Lisible partout, le choix par défaut.', en: 'Markdown headings. Readable everywhere, the default choice.' },
    'format.xml.help': { fr: 'Sections balisées. Claude suit particulièrement bien ce format.', en: 'Tagged sections. Claude follows this format especially well.' },
    'format.compact.help': { fr: 'Un seul paragraphe dense. Pour les champs courts et les modèles d\'image.', en: 'One dense paragraph. For short fields and image models.' },
    'format.json.help': { fr: 'Objet structuré. Pour un appel API ou un agent.', en: 'Structured object. For an API call or an agent.' },
    'format.systemuser.help': { fr: 'Séparé en message système et message utilisateur, pour une intégration API.', en: 'Split into a system message and a user message, for API integration.' },

    'toggle.role': { fr: 'Rôle expert', en: 'Expert role' },
    'toggle.method': { fr: 'Méthode étape par étape', en: 'Step-by-step method' },
    'toggle.constraints': { fr: 'Contraintes', en: 'Constraints' },
    'toggle.quality': { fr: 'Critères de qualité', en: 'Quality bar' },
    'toggle.pitfalls': { fr: 'Pièges à éviter', en: 'Pitfalls to avoid' },
    'toggle.noHallucination': { fr: 'Clause anti-invention', en: 'Anti-fabrication clause' },
    'toggle.reasoning': { fr: 'Consigne de raisonnement', en: 'Reasoning instruction' },
    'toggle.selfCheck': { fr: 'Auto-vérification finale', en: 'Final self-check' },
    'toggle.examples': { fr: 'Emplacement pour des exemples', en: 'Slot for examples' },

    'tab.prompt': { fr: 'Prompt', en: 'Prompt' },
    'tab.analysis': { fr: 'Analyse', en: 'Analysis' },
    'tab.library': { fr: 'Bibliothèque', en: 'Library' },

    'result.empty.title': { fr: 'Votre prompt apparaîtra ici', en: 'Your prompt will appear here' },
    'result.empty.body': {
      fr: 'Écrivez une demande à gauche, puis lancez la transformation. Vous pouvez aussi partir d\'un modèle de la bibliothèque.',
      en: 'Write a request on the left, then run the transformation. You can also start from a template in the library.'
    },
    'result.copy': { fr: 'Copier', en: 'Copy' },
    'result.copied': { fr: 'Copié', en: 'Copied' },
    'result.download': { fr: 'Télécharger', en: 'Download' },
    'result.share': { fr: 'Lien de partage', en: 'Share link' },
    'result.shared': { fr: 'Lien copié', en: 'Link copied' },
    'result.refine': { fr: 'Affiner avec une IA', en: 'Refine with an AI' },
    'result.tokens': { fr: 'jetons (estimation)', en: 'tokens (estimate)' },
    'result.chars': { fr: 'caractères', en: 'characters' },

    'analysis.score': { fr: 'Qualité de votre demande', en: 'Quality of your request' },
    'analysis.before': { fr: 'Votre demande', en: 'Your request' },
    'analysis.after': { fr: 'Prompt généré', en: 'Generated prompt' },
    'analysis.gain': { fr: 'points gagnés', en: 'points gained' },
    'analysis.dimensions': { fr: 'Ce qui a été mesuré', en: 'What was measured' },
    'analysis.suggestions': { fr: 'Ce qui rendrait votre demande encore meilleure', en: 'What would make your request even better' },
    'analysis.nosuggestion': { fr: 'Votre demande couvre déjà toutes les dimensions mesurées. Rien à ajouter.', en: 'Your request already covers every measured dimension. Nothing to add.' },
    'analysis.signals': { fr: 'Éléments repérés dans votre demande', en: 'Signals found in your request' },
    'analysis.nosignal': { fr: 'Aucun élément concret repéré : ajoutez des chiffres, des noms ou un format attendu.', en: 'No concrete signal found: add numbers, names or an expected format.' },
    'analysis.domainConfidence': { fr: 'confiance', en: 'confidence' },
    'analysis.method': { fr: 'Le barème est le même pour votre demande et pour le prompt généré : la comparaison est donc directe.', en: 'The same scale is applied to your request and to the generated prompt, so the comparison is direct.' },

    'signal.quantity': { fr: 'Volume demandé', en: 'Requested volume' },
    'signal.count': { fr: 'Quantité d\'éléments', en: 'Item count' },
    'signal.format': { fr: 'Format', en: 'Format' },
    'signal.tone': { fr: 'Ton', en: 'Tone' },
    'signal.audience': { fr: 'Public', en: 'Audience' },
    'signal.deadline': { fr: 'Échéance', en: 'Deadline' },
    'signal.language': { fr: 'Langue', en: 'Language' },
    'signal.numbers': { fr: 'Chiffres', en: 'Numbers' },
    'signal.propernouns': { fr: 'Noms propres', en: 'Proper nouns' },
    'signal.quoted': { fr: 'Citations', en: 'Quotes' },

    'library.title': { fr: 'Partez d\'un modèle', en: 'Start from a template' },
    'library.lede': { fr: 'Des demandes déjà bien formulées. Choisissez-en une, remplacez les crochets, forgez.', en: 'Requests that are already well framed. Pick one, replace the brackets, forge.' },
    'library.all': { fr: 'Tous', en: 'All' },
    'library.use': { fr: 'Utiliser', en: 'Use' },
    'library.search': { fr: 'Rechercher un modèle', en: 'Search templates' },
    'library.none': { fr: 'Aucun modèle ne correspond.', en: 'No template matches.' },

    'history.title': { fr: 'Historique local', en: 'Local history' },
    'history.empty': { fr: 'Vos prompts forgés apparaîtront ici. Ils restent dans ce navigateur.', en: 'Your forged prompts will appear here. They stay in this browser.' },
    'history.clear': { fr: 'Vider', en: 'Clear' },
    'history.restore': { fr: 'Restaurer', en: 'Restore' },
    'history.confirmClear': { fr: 'Effacer tout l\'historique de ce navigateur ?', en: 'Erase all history from this browser?' },

    'refine.title': { fr: 'Affiner avec une IA', en: 'Refine with an AI' },
    'refine.lede': {
      fr: 'Optionnel. PromptForge peut envoyer le prompt généré à votre propre compte API pour une passe de relecture. Votre clé reste dans ce navigateur et n\'est envoyée qu\'au fournisseur choisi.',
      en: 'Optional. PromptForge can send the generated prompt to your own API account for a review pass. Your key stays in this browser and is only sent to the provider you choose.'
    },
    'refine.provider': { fr: 'Fournisseur', en: 'Provider' },
    'refine.key': { fr: 'Clé API', en: 'API key' },
    'refine.model': { fr: 'Identifiant du modèle', en: 'Model ID' },
    'refine.remember': { fr: 'Mémoriser la clé dans ce navigateur', en: 'Remember the key in this browser' },
    'refine.run': { fr: 'Lancer l\'affinage', en: 'Run refinement' },
    'refine.running': { fr: 'Affinage en cours…', en: 'Refining…' },
    'refine.cancel': { fr: 'Fermer', en: 'Close' },
    'refine.done': { fr: 'Prompt affiné. Le résultat a remplacé le prompt.', en: 'Prompt refined. The result replaced the prompt.' },
    'refine.revert': { fr: 'Revenir à la version locale', en: 'Back to the local version' },
    'refine.warning': {
      fr: 'Une clé API stockée dans un navigateur est lisible par toute personne ayant accès à cet appareil. Sur un poste partagé, ne la mémorisez pas.',
      en: 'An API key stored in a browser can be read by anyone with access to this device. On a shared machine, do not remember it.'
    },
    'refine.nokey': { fr: 'Renseignez une clé API.', en: 'Enter an API key.' },
    'refine.error': { fr: 'Échec de l\'appel', en: 'Request failed' },

    'method.title': { fr: 'Ce que PromptForge ajoute à votre demande', en: 'What PromptForge adds to your request' },
    'method.lede': {
      fr: 'Un bon prompt n\'est pas une formule magique : c\'est un cahier des charges. Voici les neuf éléments que le moteur ajoute, et pourquoi chacun change le résultat.',
      en: 'A good prompt is not a magic phrase: it is a brief. Here are the nine elements the engine adds, and why each one changes the result.'
    },
    'method.c1.t': { fr: 'Un rôle réellement spécialisé', en: 'A genuinely specialised role' },
    'method.c1.b': { fr: 'Chacun des 17 domaines a son propre expert, avec sa façon de travailler. Un ingénieur logiciel et un directeur artistique ne raisonnent pas de la même manière — le prompt non plus.', en: 'Each of the 17 domains has its own expert, with its own way of working. A software engineer and an art director do not reason alike — neither should the prompt.' },
    'method.c2.t': { fr: 'Le contexte, conservé mot pour mot', en: 'Context, kept verbatim' },
    'method.c2.b': { fr: 'Votre demande d\'origine est toujours reprise telle quelle dans le prompt. Rien de ce que vous avez écrit n\'est perdu ou réinterprété.', en: 'Your original request is always carried into the prompt as written. Nothing you wrote is lost or reinterpreted.' },
    'method.c3.t': { fr: 'Une méthode, pas une consigne vague', en: 'A method, not a vague instruction' },
    'method.c3.b': { fr: 'Les étapes de travail du domaine sont explicitées dans l\'ordre. C\'est ce qui fait la différence entre « écris un article » et un article réellement construit.', en: 'The domain\'s working steps are spelled out in order. That is the difference between "write an article" and an actually constructed article.' },
    'method.c4.t': { fr: 'Des critères de qualité vérifiables', en: 'A verifiable quality bar' },
    'method.c4.b': { fr: 'Le modèle relit sa propre réponse contre une liste de critères avant de vous la donner. Une exigence énoncée est une exigence tenue.', en: 'The model re-reads its own answer against a checklist before handing it over. A stated standard is a met standard.' },
    'method.c5.t': { fr: 'Une clause contre l\'invention', en: 'A clause against fabrication' },
    'method.c5.b': { fr: 'Interdiction explicite d\'inventer chiffres, sources, citations et dates — et obligation de signaler ce qui manque plutôt que de combler le vide.', en: 'An explicit ban on inventing figures, sources, quotations and dates — and an obligation to flag what is missing instead of filling the gap.' },
    'method.c6.t': { fr: 'Les pièges du domaine, nommés', en: 'The domain\'s pitfalls, named' },
    'method.c6.b': { fr: 'Chaque domaine a ses travers connus. Les nommer dans le prompt est plus efficace que d\'espérer que le modèle les évite spontanément.', en: 'Every domain has known failure modes. Naming them in the prompt works better than hoping the model avoids them.' },
    'method.c7.t': { fr: 'Un format de sortie décidé', en: 'A decided output format' },
    'method.c7.b': { fr: 'Longueur, structure, langue, type de livrable : ce qui n\'est pas précisé est décidé par le modèle, rarement comme vous l\'imaginiez.', en: 'Length, structure, language, deliverable type: whatever you leave unspecified, the model decides — rarely the way you pictured it.' },
    'method.c8.t': { fr: 'Le bon niveau de raisonnement', en: 'The right level of reasoning' },
    'method.c8.b': { fr: 'Direct pour une tâche simple, approfondi pour un arbitrage. Demander un raisonnement détaillé pour un e-mail de trois lignes ne fait que diluer la réponse.', en: 'Direct for a simple task, deep for a trade-off. Asking for detailed reasoning on a three-line email only dilutes the answer.' },
    'method.c9.t': { fr: 'Une règle pour ce qui manque', en: 'A rule for what is missing' },
    'method.c9.b': { fr: 'Plutôt que d\'inventer ou de bloquer, le modèle pose l\'hypothèse la plus raisonnable et vous la signale. Vous gardez le contrôle.', en: 'Rather than inventing or stalling, the model takes the most reasonable assumption and flags it. You stay in control.' },

    'nav.examples': { fr: 'Exemples', en: 'Examples' },
    'nav.offers': { fr: 'Soutenir', en: 'Support' },

    'liste.title': { fr: 'Être prévenu des prochains outils', en: 'Hear about the next tools' },
    'liste.lede': {
      fr: 'Un message quand un nouvel outil sort. Rien d\'autre : pas de lettre hebdomadaire, pas de publicité, pas plus d\'un message par mois.',
      en: 'One message when a new tool ships. Nothing else: no weekly newsletter, no advertising, never more than one message a month.'
    },
    'liste.cta': { fr: 'Écrire pour s\'inscrire', en: 'Email to subscribe' },
    'liste.or': { fr: 'Ou écrivez directement à :', en: 'Or write directly to:' },
    'liste.copy': { fr: 'Copier l\'adresse', en: 'Copy the address' },
    'liste.copied': { fr: 'Adresse copiée', en: 'Address copied' },
    'liste.honest': {
      fr: 'Votre adresse ne sert qu\'à cela et n\'est ni revendue, ni transmise, ni utilisée pour autre chose. Pour partir, répondez « stop » à n\'importe quel message : c\'est traité à la main, il n\'y a pas de formulaire à remplir.',
      en: 'Your address is used for this and nothing else — never sold, never shared. To leave, reply “stop” to any message: it is handled by hand, there is no form to fill in.'
    },
    'liste.local': {
      fr: 'Il n\'y a pas de formulaire ici, et ce n\'est pas un oubli : le site n\'a aucun serveur, donc rien ne pourrait recevoir ce que vous taperiez.',
      en: 'There is no form here, and that is not an oversight: the site has no server, so nothing could receive what you typed.'
    },

    'offers.title': { fr: 'Soutenir l\'atelier', en: 'Support the workshop' },
    'offers.lede': {
      fr: 'PromptForge reste gratuit et sans compte. Ce qui suit est facultatif — et c\'est ce qui finance la suite.',
      en: 'PromptForge stays free and account-free. What follows is optional — and it is what funds what comes next.'
    },
    'offers.setup.title': { fr: 'Aucune offre n\'est encore branchée', en: 'No offer is wired up yet' },
    'offers.setup.body': {
      fr: 'Ouvrez assets/js/offers.js et collez vos liens de paiement dans le champ « url » de chaque offre. Une offre sans lien valide n\'est jamais montrée aux visiteurs. Marche à suivre complète dans MONETISATION.md.',
      en: 'Open assets/js/offers.js and paste your payment links into each offer\'s "url" field. An offer without a valid link is never shown to visitors. Full walkthrough in MONETISATION.md.'
    },
    'offers.setup.only': { fr: 'Ce rappel ne s\'affiche qu\'en local. Il est invisible pour vos visiteurs.', en: 'This reminder only shows locally. Your visitors never see it.' },

    'footer.privacy': { fr: 'Aucune donnée ne quitte votre navigateur : le moteur est entièrement local. Historique et réglages sont stockés dans ce navigateur uniquement.', en: 'No data leaves your browser: the engine is entirely local. History and settings are stored in this browser only.' },
    'footer.open': { fr: 'Code source ouvert', en: 'Open source' },
    'footer.built': { fr: 'Sans dépendance, sans traceur, sans compte.', en: 'No dependencies, no trackers, no account.' },

    'toast.generated': { fr: 'Prompt forgé', en: 'Prompt forged' },
    'toast.empty': { fr: 'Écrivez d\'abord votre demande.', en: 'Write your request first.' },
    'toast.loaded': { fr: 'Modèle chargé', en: 'Template loaded' },
    'toast.copyfail': { fr: 'Copie impossible — sélectionnez le texte manuellement.', en: 'Copy failed — select the text manually.' },
    'toast.restored': { fr: 'Prompt restauré', en: 'Prompt restored' },
    'toast.linkloaded': { fr: 'Demande chargée depuis le lien partagé', en: 'Request loaded from the shared link' }
  };

  function t(key, lang) {
    var e = STR[key];
    if (!e) return key;
    return e[lang === 'en' ? 'en' : 'fr'];
  }

  return { t: t, strings: STR };
});
