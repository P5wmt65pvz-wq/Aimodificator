/*!
 * Clause — lit une politique de confidentialité à votre place.
 *
 * Colle le texte, l'outil surligne ce qui compte vraiment et signale ce qui
 * manque. Tout se passe dans le navigateur : le texte n'est envoyé nulle part.
 *
 * L'analyse est en fonctions pures (texte -> objet), testables sous Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Clause = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Minuscules sans accents, espaces normalisés : la détection ne doit pas
     dépendre de la typographie du document. */
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’′]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------------------------------------- détections
     Chaque règle décrit UNE pratique. « level » dit à quel point elle joue
     contre le lecteur, pas à quel point elle est illégale : une pratique peut
     être parfaitement licite et rester défavorable. */

  var RULES = [
    {
      id: 'vente',
      level: 'critical',
      title: 'Vos données peuvent être vendues ou cédées',
      patterns: [
        /\bvend(?:re|ons|u|ue)s?\b[^.]{0,60}\bdonnees\b/,
        /\bdonnees\b[^.]{0,60}\bvend(?:re|ues?|ons)\b/,
        /\bcede(?:r|ons|es)?\b[^.]{0,60}\b(?:donnees|tiers)\b/,
        /\bsell\b[^.]{0,50}\b(?:data|information)\b/,
        /\bmonetis(?:er|ation)\b[^.]{0,50}\bdonnees\b/
      ],
      meaning: 'Le document prévoit la transmission de vos données à d\'autres sociétés, ' +
               'contre paiement ou dans le cadre d\'un partenariat commercial. C\'est la clause ' +
               'qui a le plus de conséquences concrètes : vos données circulent au-delà du service ' +
               'auquel vous vous êtes inscrit.'
    },
    {
      id: 'partenaires',
      level: 'serious',
      title: 'Partage avec des partenaires ou des annonceurs',
      patterns: [
        /\bpartenaires?\b[^.]{0,60}\b(?:commerciaux|publicitaires|marketing|annonceurs)\b/,
        /\b(?:partag|transmet|communiqu)[a-z]*\b[^.]{0,60}\btiers\b/,
        /\bthird[- ]part(?:y|ies)\b[^.]{0,50}\b(?:advertis|marketing|partner)/
      ],
      meaning: 'Vos données sont communiquées à des sociétés extérieures. Le document ne les nomme ' +
               'pas toujours, ce qui rend impossible de savoir qui détient vos informations.'
    },
    {
      id: 'hors-ue',
      level: 'serious',
      title: 'Transfert de données hors de l\'Union européenne',
      patterns: [
        /\bhors (?:de )?(?:l['\s])?(?:union europeenne|ue|eee|espace economique)/,
        /\bpays tiers?\b/,
        /\btransfer(?:t|e|ons|es)\b[^.]{0,60}\b(?:etats-unis|usa|hors)\b/,
        /\bclauses contractuelles types\b/,
        /\boutside (?:the )?(?:eu|european union|eea)\b/
      ],
      meaning: 'Vos données sortent de l\'espace européen. Les garanties du droit européen ne ' +
               's\'appliquent alors plus directement, et le recours en cas de problème devient ' +
               'nettement plus difficile.'
    },
    {
      id: 'consentement-presume',
      level: 'serious',
      title: 'Votre accord est présumé, pas demandé',
      patterns: [
        /\ben (?:poursuivant|continuant)\b[^.]{0,50}\b(?:navigation|utilisation)\b/,
        /\b(?:vous )?(?:etes )?repute[e]?s? (?:avoir )?(?:accepte|consenti)/,
        /\bl['\s]utilisation (?:du|de ce|de notre) (?:site|service)[^.]{0,40}\bvaut acceptation\b/,
        /\bby continuing\b[^.]{0,40}\byou (?:agree|consent)\b/
      ],
      meaning: 'Le document considère que vous avez accepté simplement parce que vous utilisez le ' +
               'service. Pour les traceurs publicitaires, un consentement doit normalement être ' +
               'donné par un acte clair, pas déduit de votre présence sur la page.'
    },
    {
      id: 'profilage',
      level: 'serious',
      title: 'Profilage ou décision automatisée',
      patterns: [
        /\bprofilage\b/,
        /\bdecisions? automatisees?\b/,
        /\bpublicite (?:ciblee|personnalisee|comportementale)\b/,
        /\bautomated decision[- ]making\b/,
        /\bprofiling\b/
      ],
      meaning: 'Vos données servent à déduire des choses sur vous — habitudes, centres d\'intérêt, ' +
               'situation — et parfois à prendre des décisions sans intervention humaine. ' +
               'Vous pouvez normalement vous y opposer et demander un réexamen humain.'
    },
    {
      id: 'sensibles',
      level: 'critical',
      title: 'Données particulièrement sensibles',
      patterns: [
        /\bdonnees (?:de )?(?:sante|biometriques|genetiques)\b/,
        /\b(?:orientation sexuelle|opinions politiques|convictions religieuses)\b/,
        /\bgeolocalisation (?:precise|exacte|en temps reel)\b/,
        /\b(?:health|biometric|genetic) data\b/
      ],
      meaning: 'Le document mentionne des catégories de données qui bénéficient d\'une protection ' +
               'renforcée. Leur collecte suppose des conditions strictes et un consentement explicite.'
    },
    {
      id: 'conservation-illimitee',
      level: 'serious',
      title: 'Conservation sans limite claire',
      patterns: [
        /\b(?:indefiniment|sans limitation de duree|de maniere permanente)\b/,
        /\baussi longtemps que (?:necessaire|nous le jugeons)/,
        /\bindefinitely\b/,
        /\bas long as (?:necessary|needed)\b/
      ],
      meaning: 'La durée de conservation n\'est pas chiffrée. « Aussi longtemps que nécessaire » ' +
               'laisse la décision entièrement au service, et vos données peuvent rester des années.'
    },
    {
      id: 'modification',
      level: 'mid',
      title: 'Le document peut changer sans vous prévenir',
      patterns: [
        /\bnous (?:nous )?reservons le droit de (?:modifier|changer)/,
        /\bpeut etre modifiee? a tout moment\b/,
        /\bwe (?:may|reserve the right to) (?:change|modify|update)\b[^.]{0,40}\bat any time\b/
      ],
      meaning: 'Les règles peuvent être réécrites unilatéralement. En pratique, ce que vous acceptez ' +
               'aujourd\'hui n\'engage pas le service demain, sauf si une notification est prévue.'
    },
    {
      id: 'traceurs',
      level: 'mid',
      title: 'Traceurs et cookies',
      patterns: [
        /\bcookies?\b/,
        /\btraceurs?\b/,
        /\bpixels? (?:invisibles?|espions?|de suivi)\b/,
        /\bweb beacons?\b/
      ],
      meaning: 'Des traceurs sont déposés sur votre appareil. Tous ne se valent pas : ceux qui sont ' +
               'strictement nécessaires au fonctionnement sont admis sans accord, ceux qui servent ' +
               'à la publicité demandent le vôtre.'
    },
    {
      id: 'conservation-chiffree',
      level: 'good',
      title: 'Durée de conservation chiffrée',
      patterns: [
        /\bconserv[a-z]*\b[^.]{0,60}\b\d+\s*(?:ans?|mois|jours?)\b/,
        /\bpendant (?:une duree de )?\d+\s*(?:ans?|mois|jours?)\b/,
        /\bretained? for \d+\s*(?:years?|months?|days?)\b/
      ],
      meaning: 'Bon signe : le document annonce une durée précise plutôt qu\'une formule vague. ' +
               'C\'est vérifiable, donc opposable.'
    },
    {
      id: 'droits',
      level: 'good',
      title: 'Vos droits sont énoncés',
      patterns: [
        /\bdroit (?:d['\s])?(?:acces|opposition|rectification|effacement|portabilite)\b/,
        /\bdroit (?:a )?(?:l['\s]|la )?(?:effacement|rectification|portabilite|opposition)\b/,
        /\bdroits? (?:des personnes|dont vous disposez)\b/,
        /\bright to (?:access|erasure|rectification|object|portability)\b/
      ],
      meaning: 'Le document rappelle que vous pouvez demander l\'accès à vos données, leur ' +
               'correction, leur effacement, ou vous opposer à certains traitements.'
    },
    {
      id: 'contact',
      level: 'good',
      title: 'Un contact est fourni',
      patterns: [
        /\bdelegue a la protection des donnees\b/,
        /\bdpo\b/,
        /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/,
        /\bdata protection officer\b/
      ],
      meaning: 'Il existe un moyen concret d\'exercer vos droits. Une politique sans aucun contact ' +
               'rend toute demande impossible en pratique.'
    }
  ];

  /* Éléments dont l'absence est en soi une information. */
  var EXPECTED = [
    { id: 'droits', label: 'Vos droits (accès, effacement, opposition)',
      why: 'Sans cette section, rien ne vous indique comment reprendre la main sur vos données.' },
    { id: 'contact', label: 'Un contact pour exercer vos droits',
      why: 'Sans adresse ni responsable désigné, une demande d\'effacement n\'a nulle part où aller.' },
    { id: 'conservation-chiffree', label: 'Une durée de conservation chiffrée',
      why: 'Sans durée annoncée, vous ne savez pas combien de temps vos données sont gardées.' }
  ];

  function extract(text, normText, re) {
    var m = re.exec(normText);
    if (!m) return null;
    /* On récupère la phrase d'origine autour de la correspondance, en se basant
       sur la position dans le texte normalisé — approximatif mais lisible. */
    var ratio = text.length / (normText.length || 1);
    var at = Math.min(text.length - 1, Math.max(0, Math.round(m.index * ratio)));
    var start = text.lastIndexOf('.', at);
    start = start === -1 ? Math.max(0, at - 120) : start + 1;
    var end = text.indexOf('.', at + m[0].length);
    end = end === -1 ? Math.min(text.length, at + 240) : end + 1;
    var s = text.slice(start, end).trim().replace(/\s+/g, ' ');
    if (s.length > 320) s = s.slice(0, 317) + '…';
    return s || null;
  }

  function analyse(text) {
    var norm = normalize(text);
    var words = norm ? norm.split(' ').filter(Boolean).length : 0;
    var found = [], ids = {};

    RULES.forEach(function (rule) {
      for (var i = 0; i < rule.patterns.length; i++) {
        var re = new RegExp(rule.patterns[i].source, 'g');
        if (re.test(norm)) {
          ids[rule.id] = true;
          found.push({
            id: rule.id, level: rule.level, title: rule.title, meaning: rule.meaning,
            excerpt: extract(text, norm, new RegExp(rule.patterns[i].source))
          });
          return;
        }
      }
    });

    var missing = EXPECTED.filter(function (e) { return !ids[e.id]; });

    var order = { critical: 0, serious: 1, mid: 2, good: 3 };
    found.sort(function (a, b) { return order[a.level] - order[b.level]; });

    return { words: words, findings: found, missing: missing, verdict: verdictFor(found, missing, words) };
  }

  function verdictFor(found, missing, words) {
    if (!words) return { key: 'empty', label: 'Collez un texte pour commencer.', detail: '' };
    if (words < 60) return {
      key: 'short',
      label: 'Texte trop court pour être une politique de confidentialité.',
      detail: 'L\'analyse porte sur le document complet. Collez la page entière, pas un extrait.'
    };
    var crit = found.filter(function (f) { return f.level === 'critical'; }).length;
    var ser = found.filter(function (f) { return f.level === 'serious'; }).length;
    if (crit) return {
      key: 'critical',
      label: 'Ce document autorise des pratiques lourdes de conséquences.',
      detail: 'Au moins un point engage durablement vos données au-delà du service lui-même. ' +
              'Lisez les passages surlignés en rouge avant d\'accepter.'
    };
    if (ser >= 2) return {
      key: 'serious',
      label: 'Plusieurs clauses jouent nettement en votre défaveur.',
      detail: 'Rien d\'illégal en soi, mais l\'équilibre penche du côté du service. Regardez surtout ' +
              'les transferts hors Union européenne et la façon dont votre accord est obtenu.'
    };
    if (ser || missing.length >= 2) return {
      key: 'warning',
      label: 'Document acceptable, avec des zones floues.',
      detail: 'Les manques comptent autant que ce qui est écrit : ce qui n\'est pas annoncé n\'est ' +
              'pas vérifiable.'
    };
    return {
      key: 'good',
      label: 'Document plutôt clair et équilibré.',
      detail: 'Les éléments essentiels sont présents et aucune clause lourde n\'a été repérée. ' +
              'Cela ne garantit pas les pratiques réelles, seulement ce qui est annoncé.'
    };
  }

  /* ---------------------------------------------------------------- rendu */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var LEVEL_LABEL = { critical: 'lourd de conséquences', serious: 'à votre défaveur',
                      mid: 'à savoir', good: 'bon point' };

  function render(text) {
    var r = analyse(text);
    var out = document.getElementById('resultat');
    out.hidden = !r.words;
    document.getElementById('compteur').textContent =
      r.words ? r.words.toLocaleString('fr-FR') + ' mots analysés' : '';
    if (!r.words) return;

    var v = document.getElementById('verdict');
    v.className = 'verdict is-' + r.verdict.key;
    v.innerHTML = '';
    v.appendChild(el('b', null, r.verdict.label));
    if (r.verdict.detail) v.appendChild(el('span', null, ' ' + r.verdict.detail));

    var list = document.getElementById('liste');
    list.innerHTML = '';
    r.findings.forEach(function (f) {
      var card = el('article', 'card is-' + f.level);
      var top = el('div', 'card-top');
      top.appendChild(el('h3', null, f.title));
      top.appendChild(el('span', 'tag ' + f.level, LEVEL_LABEL[f.level]));
      card.appendChild(top);
      if (f.excerpt) {
        var q = el('blockquote', 'excerpt');
        q.appendChild(el('span', null, f.excerpt));
        card.appendChild(q);
      }
      card.appendChild(el('p', null, f.meaning));
      list.appendChild(card);
    });
    if (!r.findings.length) {
      list.appendChild(el('p', 'muted', 'Aucune clause connue repérée. Soit le document est très ' +
        'sommaire, soit il est rédigé de façon inhabituelle — relisez-le vous-même.'));
    }

    var miss = document.getElementById('manques');
    var missList = document.getElementById('liste-manques');
    missList.innerHTML = '';
    miss.hidden = !r.missing.length;
    r.missing.forEach(function (m) {
      var li = document.createElement('li');
      li.appendChild(el('b', null, m.label));
      li.appendChild(el('span', null, m.why));
      missList.appendChild(li);
    });
  }

  function bindTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem('clause.theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) cur = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('clause.theme', next); } catch (e) {}
    });
  }

  function boot() {
    var start = function () {
      bindTheme();
      var ta = document.getElementById('texte');
      if (!ta) return;
      var timer;
      var go = function () { clearTimeout(timer); timer = setTimeout(function () { render(ta.value); }, 180); };
      ta.addEventListener('input', go);
      var clear = document.getElementById('vider');
      if (clear) clear.addEventListener('click', function () { ta.value = ''; render(''); ta.focus(); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return { normalize: normalize, analyse: analyse, verdictFor: verdictFor,
           RULES: RULES, EXPECTED: EXPECTED, boot: boot };
});
