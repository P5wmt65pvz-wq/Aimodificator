/*!
 * Empreinte — mesure ce qu'un site peut lire sur vous sans rien vous demander.
 * Tout s'exécute dans le navigateur. Aucune requête réseau n'est émise.
 *
 * La logique de notation est séparée des sondes pour être testable sous Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Empreinte = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------- notation */

  /* Chaque signal porte un poids : combien il réduit le nombre de personnes
     auxquelles vous pourriez être confondu. Un signal « haut » est un signal
     presque unique (empreinte canvas, liste de polices) ; un signal « bas »
     est partagé par des millions de gens (fuseau horaire en France). */
  var WEIGHTS = { high: 14, mid: 7, low: 3 };

  function scoreFrom(findings) {
    var total = 0;
    findings.forEach(function (f) {
      if (!f.exposed) return;
      total += WEIGHTS[f.level] || 0;
    });
    return Math.max(0, Math.min(100, Math.round(total)));
  }

  function verdictFor(score) {
    if (score >= 70) return {
      key: 'critical',
      label: 'Vous êtes très probablement identifiable de façon unique.',
      explain: 'La combinaison de ces éléments suffit à vous reconnaître d\'un site à l\'autre, ' +
               'même sans cookie, même en navigation privée, même après avoir changé d\'adresse IP. ' +
               'C\'est exactement ce que font les régies publicitaires et les traqueurs.',
      color: 'var(--critical)'
    };
    if (score >= 45) return {
      key: 'serious',
      label: 'Vous êtes reconnaissable dans un groupe restreint.',
      explain: 'Vous ne sortez pas complètement du lot, mais assez de signaux vous distinguent pour ' +
               'qu\'un recoupement sur plusieurs visites permette de vous suivre.',
      color: 'var(--serious)'
    };
    if (score >= 22) return {
      key: 'warning',
      label: 'Empreinte modérée — vous vous fondez partiellement dans la masse.',
      explain: 'Une partie des signaux les plus révélateurs est bloquée ou indisponible. ' +
               'Vous restez suivable, mais avec nettement moins de fiabilité.',
      color: 'var(--warning)'
    };
    return {
      key: 'good',
      label: 'Empreinte faible — vous ressemblez à beaucoup de monde.',
      explain: 'Les signaux les plus identifiants sont indisponibles ou neutralisés. ' +
               'C\'est le comportement d\'un navigateur qui résiste au pistage.',
      color: 'var(--good)'
    };
  }

  /* --------------------------------------------------------------- sondes */

  function safe(fn, fallback) {
    try {
      var v = fn();
      return (v === undefined || v === null || v === '') ? fallback : v;
    } catch (e) { return fallback; }
  }

  /* Hachage court et stable, uniquement pour afficher une empreinte lisible.
     Ce n'est pas de la cryptographie : rien n'est transmis ni conservé. */
  function shortHash(str) {
    var h = 5381, i = str.length;
    while (i) h = (h * 33) ^ str.charCodeAt(--i);
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function canvasPrint() {
    var c = document.createElement('canvas');
    c.width = 260; c.height = 60;
    var ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = '15px "Arial"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(2, 2, 90, 24);
    ctx.fillStyle = '#069';
    ctx.fillText('Empreinte 🔍 éàç', 4, 8);
    ctx.fillStyle = 'rgba(102, 200, 0, .7)';
    ctx.fillText('Empreinte 🔍 éàç', 6, 20);
    return shortHash(c.toDataURL());
  }

  function webglInfo() {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return null;
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbg) return { vendor: null, renderer: null };
    return {
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
    };
  }

  /* Détecte les polices installées en comparant la largeur d'un même texte
     rendu avec la police testée puis avec une police de repli connue. */
  function detectFonts() {
    var base = ['monospace', 'sans-serif', 'serif'];
    var test = ['Arial', 'Verdana', 'Georgia', 'Garamond', 'Times New Roman', 'Courier New',
                'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Tahoma', 'Palatino', 'Helvetica',
                'Calibri', 'Cambria', 'Consolas', 'Segoe UI', 'Optima', 'Futura', 'Menlo',
                'Lucida Grande', 'Roboto', 'Ubuntu', 'Noto Sans', 'DejaVu Sans'];
    var span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap';
    span.textContent = 'mmmmmmmmmmlli';
    document.body.appendChild(span);

    var baseline = {};
    base.forEach(function (b) { span.style.fontFamily = b; baseline[b] = span.offsetWidth; });

    var found = [];
    test.forEach(function (f) {
      for (var i = 0; i < base.length; i++) {
        span.style.fontFamily = '"' + f + '",' + base[i];
        if (span.offsetWidth !== baseline[base[i]]) { found.push(f); return; }
      }
    });
    document.body.removeChild(span);
    return found;
  }

  function collect() {
    var nav = navigator, scr = screen;
    var canvas = safe(canvasPrint, null);
    var gl = safe(webglInfo, null);
    var fonts = safe(detectFonts, []);
    var langs = safe(function () { return (nav.languages || [nav.language]).join(', '); }, null);
    var tz = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, null);
    var conn = safe(function () { return nav.connection && nav.connection.effectiveType; }, null);
    var dnt = safe(function () {
      if (nav.globalPrivacyControl) return 'Global Privacy Control activé';
      var v = nav.doNotTrack || window.doNotTrack;
      return (v === '1' || v === 'yes') ? 'Do Not Track activé' : null;
    }, null);

    return [
      {
        id: 'canvas', level: 'high', exposed: !!canvas,
        title: 'Empreinte de rendu graphique (canvas)',
        value: canvas ? canvas + ' — identifiant dérivé du rendu' : 'Bloquée ou indisponible',
        note: canvas
          ? 'Votre machine dessine un texte de façon très légèrement différente des autres, à cause du ' +
            'système, des pilotes et des polices. Le résultat sert d\'identifiant. C\'est l\'un des signaux ' +
            'les plus utilisés par les traqueurs, et il survit à la navigation privée.'
          : 'Votre navigateur bloque cette lecture ou renvoie un résultat brouillé. C\'est une bonne nouvelle : ' +
            'c\'est le signal le plus identifiant.'
      },
      {
        id: 'fonts', level: 'high', exposed: fonts.length > 6,
        title: 'Polices installées',
        value: fonts.length ? fonts.length + ' détectées : ' + fonts.slice(0, 12).join(', ') + (fonts.length > 12 ? '…' : '') : 'Aucune détectée',
        note: fonts.length > 6
          ? 'La liste exacte des polices de votre machine est presque une signature : elle dépend de votre ' +
            'système, des logiciels installés, de votre langue. Peu de gens ont exactement la même.'
          : 'Peu de polices détectables, ce qui rend ce signal peu utile pour vous distinguer.'
      },
      {
        id: 'webgl', level: 'high', exposed: !!(gl && gl.renderer),
        title: 'Carte graphique',
        value: gl && gl.renderer ? String(gl.renderer) : 'Masquée ou indisponible',
        note: gl && gl.renderer
          ? 'Le modèle exact de votre carte graphique est lisible. Combiné au système et à la résolution, ' +
            'cela restreint fortement le nombre de personnes correspondantes.'
          : 'Le modèle de votre carte graphique n\'est pas exposé. Un point de moins pour vous identifier.'
      },
      {
        id: 'ua', level: 'mid', exposed: true,
        title: 'Navigateur et système',
        value: safe(function () { return nav.userAgent; }, 'inconnu'),
        note: 'Envoyé à chaque requête, par construction. Version du navigateur, du système, parfois du modèle ' +
              'd\'appareil. Impossible à supprimer complètement, mais certains navigateurs le simplifient.'
      },
      {
        id: 'screen', level: 'mid', exposed: true,
        title: 'Écran',
        value: safe(function () {
          return scr.width + '×' + scr.height + ' px · densité ' + (window.devicePixelRatio || 1) +
                 ' · ' + scr.colorDepth + ' bits de couleur';
        }, 'inconnu'),
        note: 'La taille exacte de l\'écran et la densité de pixels forment une combinaison peu partagée, ' +
              'surtout sur ordinateur où les résolutions varient beaucoup.'
      },
      {
        id: 'hardware', level: 'mid', exposed: safe(function () { return !!nav.hardwareConcurrency; }, false),
        title: 'Puissance de la machine',
        value: safe(function () {
          var parts = [];
          if (nav.hardwareConcurrency) parts.push(nav.hardwareConcurrency + ' cœurs processeur');
          if (nav.deviceMemory) parts.push(nav.deviceMemory + ' Go de mémoire (approximatif)');
          return parts.length ? parts.join(' · ') : 'Non exposée';
        }, 'Non exposée'),
        note: 'Le nombre de cœurs et la mémoire disponible sont lisibles sans permission. ' +
              'Pris isolément c\'est peu, combiné au reste c\'est un filtre de plus.'
      },
      {
        id: 'timezone', level: 'low', exposed: !!tz,
        title: 'Fuseau horaire',
        value: tz || 'inconnu',
        note: 'Révèle votre zone géographique indépendamment de votre adresse IP. ' +
              'Un VPN qui vous place à l\'étranger alors que votre fuseau reste français est d\'ailleurs ' +
              'une incohérence facilement détectable.'
      },
      {
        id: 'lang', level: 'low', exposed: !!langs,
        title: 'Langues préférées',
        value: langs || 'inconnu',
        note: 'L\'ordre exact de vos langues préférées est plus révélateur qu\'il n\'y paraît : ' +
              'une liste inhabituelle réduit beaucoup le groupe auquel vous appartenez.'
      },
      {
        id: 'touch', level: 'low', exposed: true,
        title: 'Type d\'appareil',
        value: safe(function () {
          var t = nav.maxTouchPoints || 0;
          return (t > 0 ? 'Tactile (' + t + ' points)' : 'Non tactile') +
                 ' · plateforme annoncée : ' + (nav.platform || 'inconnue');
        }, 'inconnu'),
        note: 'Permet de séparer immédiatement téléphone, tablette et ordinateur.'
      },
      {
        id: 'conn', level: 'low', exposed: !!conn,
        title: 'Type de connexion',
        value: conn ? 'Estimée : ' + conn : 'Non exposée',
        note: conn
          ? 'Votre navigateur communique une estimation de la qualité de votre connexion.'
          : 'Votre navigateur ne communique pas ce renseignement.'
      },
      {
        id: 'prefs', level: 'low', exposed: true,
        title: 'Préférences d\'affichage',
        value: safe(function () {
          var m = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
          var out = [];
          out.push(m('(prefers-color-scheme: dark)') ? 'thème sombre' : 'thème clair');
          if (m('(prefers-reduced-motion: reduce)')) out.push('animations réduites');
          if (m('(prefers-contrast: more)')) out.push('contraste renforcé');
          return out.join(' · ');
        }, 'inconnues'),
        note: 'Vos réglages d\'accessibilité et d\'affichage sont lisibles. Les réglages peu courants — ' +
              'contraste renforcé, animations coupées — sont paradoxalement très identifiants.'
      },
      {
        id: 'dnt', level: 'low', exposed: !dnt,
        title: 'Signal de refus du pistage',
        value: dnt || 'Aucun signal envoyé',
        note: dnt
          ? 'Vous envoyez un signal demandant de ne pas être pisté. En France, le Global Privacy Control ' +
            'n\'oblige pas juridiquement les sites ; la plupart l\'ignorent.'
          : 'Vous n\'envoyez aucun signal de refus. À noter : activer ce signal vous rend légèrement plus ' +
            'identifiable, puisque peu de gens le font.'
      }
    ];
  }

  /* --------------------------------------------------------------- rendu */

  var ADVICE = [
    ['Installer uBlock Origin',
     'Un bloqueur de contenus sérieux coupe la majorité des traqueurs avant qu\'ils ne se chargent. ' +
     'C\'est de loin l\'action avec le meilleur rapport effort/résultat. Gratuit et libre.'],
    ['Utiliser un navigateur qui résiste au pistage',
     'Firefox avec la protection renforcée, Brave, ou le Navigateur Tor pour les cas sensibles. ' +
     'Ils brouillent l\'empreinte canvas et limitent les lectures matérielles — ce qu\'un VPN ne fait pas.'],
    ['Ne pas multiplier les extensions',
     'Chaque extension visible depuis la page ajoute un signal. Une combinaison rare d\'extensions ' +
     'vous rend plus reconnaissable, pas moins. Moins, mais mieux choisies.'],
    ['Comprendre ce que la navigation privée ne fait pas',
     'Elle efface l\'historique et les cookies à la fermeture. Elle ne change strictement rien à votre ' +
     'empreinte : tout ce qui est listé plus haut reste lisible à l\'identique.'],
    ['Cloisonner plutôt que cacher',
     'Des profils de navigateur séparés — un pour les comptes personnels, un pour le reste — empêchent ' +
     'de relier vos activités entre elles. C\'est plus efficace que de chercher l\'invisibilité.']
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var LEVEL_LABEL = { high: 'très révélateur', mid: 'révélateur', low: 'peu révélateur' };

  function render(findings) {
    var score = scoreFrom(findings);
    var v = verdictFor(score);

    document.getElementById('score').textContent = String(score);
    var fill = document.getElementById('gauge-fill');
    fill.style.width = score + '%';
    fill.style.backgroundColor = v.color;
    document.getElementById('verdict-label').textContent = v.label;
    document.getElementById('verdict-explain').textContent = v.explain;

    var box = document.getElementById('cards');
    box.innerHTML = '';
    findings.forEach(function (f) {
      var card = el('article', 'card');
      card.dataset.level = f.level;
      card.dataset.exposed = String(!!f.exposed);
      var top = el('div', 'card-top');
      top.appendChild(el('h3', null, f.title));
      top.appendChild(el('span', 'tag ' + (f.exposed ? f.level : 'low'),
        f.exposed ? LEVEL_LABEL[f.level] : 'protégé'));
      card.appendChild(top);
      card.appendChild(el('div', 'value', f.value));
      card.appendChild(el('p', null, f.note));
      box.appendChild(card);
    });

    var steps = document.getElementById('steps');
    steps.innerHTML = '';
    ADVICE.forEach(function (a) {
      var li = document.createElement('li');
      li.appendChild(el('b', null, a[0]));
      li.appendChild(el('span', null, a[1]));
      steps.appendChild(li);
    });
  }

  function bindFilters() {
    var btns = Array.prototype.slice.call(document.querySelectorAll('.filter'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (o) { o.classList.toggle('is-on', o === b); });
        var only = b.dataset.filter === 'high';
        Array.prototype.slice.call(document.querySelectorAll('.card')).forEach(function (c) {
          var show = !only || (c.dataset.level === 'high' && c.dataset.exposed === 'true');
          c.hidden = !show;
        });
      });
    });
  }

  function bindTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem('empreinte.theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) {
        var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        cur = dark ? 'dark' : 'light';
      }
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('empreinte.theme', next); } catch (e) {}
    });
  }

  function boot() {
    var start = function () {
      bindTheme();
      render(collect());
      bindFilters();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return {
    scoreFrom: scoreFrom,
    verdictFor: verdictFor,
    shortHash: shortHash,
    WEIGHTS: WEIGHTS,
    ADVICE: ADVICE,
    boot: boot
  };
});
