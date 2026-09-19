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

  /* Les textes visibles vivent dans empreinte.i18n.js, partagé par la version
     française et la version anglaise de la page. Dans le navigateur, ce
     fichier est chargé avant celui-ci ; sous Node, on le require. */
  var I18N = (typeof EmpreinteI18n !== 'undefined') ? EmpreinteI18n
           : (typeof require === 'function' ? require('./empreinte.i18n.js') : null);
  function S(cle, lang) { return I18N ? I18N.t(cle, lang) : cle; }

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

  function verdictFor(score, lang) {
    var cle = score >= 70 ? 'critical' : score >= 45 ? 'serious' : score >= 22 ? 'warning' : 'good';
    return {
      key: cle,
      label: S('verdict.' + cle + '.label', lang),
      explain: S('verdict.' + cle + '.explain', lang),
      color: 'var(--' + cle + ')'
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

  function collect(lang) {
    var nav = navigator, scr = screen;
    var f = function (cle) { return S('f.' + cle, lang); };
    var canvas = safe(canvasPrint, null);
    var gl = safe(webglInfo, null);
    var fonts = safe(detectFonts, []);
    var langs = safe(function () { return (nav.languages || [nav.language]).join(', '); }, null);
    var tz = safe(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, null);
    var conn = safe(function () { return nav.connection && nav.connection.effectiveType; }, null);
    var dnt = safe(function () {
      if (nav.globalPrivacyControl) return f('dnt.gpc');
      var v = nav.doNotTrack || window.doNotTrack;
      return (v === '1' || v === 'yes') ? f('dnt.dnt') : null;
    }, null);

    return [
      {
        id: 'canvas', level: 'high', exposed: !!canvas,
        title: f('canvas.t'),
        value: canvas ? canvas + f('canvas.suffix') : f('canvas.off'),
        note: canvas ? f('canvas.nOn') : f('canvas.nOff')
      },
      {
        id: 'fonts', level: 'high', exposed: fonts.length > 6,
        title: f('fonts.t'),
        value: fonts.length
          ? fonts.length + f('fonts.count') + fonts.slice(0, 12).join(', ') + (fonts.length > 12 ? '\u2026' : '')
          : f('fonts.none'),
        note: fonts.length > 6 ? f('fonts.nOn') : f('fonts.nOff')
      },
      {
        id: 'webgl', level: 'high', exposed: !!(gl && gl.renderer),
        title: f('webgl.t'),
        value: gl && gl.renderer ? String(gl.renderer) : f('webgl.off'),
        note: gl && gl.renderer ? f('webgl.nOn') : f('webgl.nOff')
      },
      {
        id: 'ua', level: 'mid', exposed: true,
        title: f('ua.t'),
        value: safe(function () { return nav.userAgent; }, f('ua.unknown')),
        note: f('ua.n')
      },
      {
        id: 'screen', level: 'mid', exposed: true,
        title: f('screen.t'),
        value: safe(function () {
          return scr.width + '\u00d7' + scr.height + f('screen.density') + (window.devicePixelRatio || 1) +
                 ' \u00b7 ' + scr.colorDepth + f('screen.bits');
        }, f('screen.unknown')),
        note: f('screen.n')
      },
      {
        id: 'hardware', level: 'mid', exposed: safe(function () { return !!nav.hardwareConcurrency; }, false),
        title: f('hardware.t'),
        value: safe(function () {
          var parts = [];
          if (nav.hardwareConcurrency) parts.push(nav.hardwareConcurrency + f('hardware.cores'));
          if (nav.deviceMemory) parts.push(nav.deviceMemory + f('hardware.memory'));
          return parts.length ? parts.join(' \u00b7 ') : f('hardware.off');
        }, f('hardware.off')),
        note: f('hardware.n')
      },
      {
        id: 'timezone', level: 'low', exposed: !!tz,
        title: f('timezone.t'),
        value: tz || f('timezone.unknown'),
        note: f('timezone.n')
      },
      {
        id: 'lang', level: 'low', exposed: !!langs,
        title: f('lang.t'),
        value: langs || f('lang.unknown'),
        note: f('lang.n')
      },
      {
        id: 'touch', level: 'low', exposed: true,
        title: f('touch.t'),
        value: safe(function () {
          var n = nav.maxTouchPoints || 0;
          return (n > 0 ? f('touch.touch') + n + f('touch.points') : f('touch.noTouch')) +
                 f('touch.platform') + (nav.platform || f('touch.unknown'));
        }, f('touch.unknown')),
        note: f('touch.n')
      },
      {
        id: 'conn', level: 'low', exposed: !!conn,
        title: f('conn.t'),
        value: conn ? f('conn.est') + conn : f('conn.off'),
        note: conn ? f('conn.nOn') : f('conn.nOff')
      },
      {
        id: 'prefs', level: 'low', exposed: true,
        title: f('prefs.t'),
        value: safe(function () {
          var m = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
          var out = [m('(prefers-color-scheme: dark)') ? f('prefs.dark') : f('prefs.light')];
          if (m('(prefers-reduced-motion: reduce)')) out.push(f('prefs.reduced'));
          if (m('(prefers-contrast: more)')) out.push(f('prefs.contrast'));
          return out.join(' \u00b7 ');
        }, f('prefs.unknown')),
        note: f('prefs.n')
      },
      {
        id: 'dnt', level: 'low', exposed: !dnt,
        title: f('dnt.t'),
        value: dnt || f('dnt.none'),
        note: dnt ? f('dnt.nOn') : f('dnt.nOff')
      }
    ];
  }

  /* --------------------------------------------------------------- rendu */

  /* Les conseils viennent de la table partagée, dans la langue de la page. */
  function conseils(lang) {
    var l = lang === 'en' ? 'en' : 'fr';
    return (I18N ? I18N.T.advice : []).map(function (a) { return [a.t[l], a.b[l]]; });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function niveau(cle, lang) { return S('level.' + cle, lang); }

  function render(findings, lang) {
    var score = scoreFrom(findings);
    var v = verdictFor(score, lang);

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
        f.exposed ? niveau(f.level, lang) : niveau('safe', lang)));
      card.appendChild(top);
      card.appendChild(el('div', 'value', f.value));
      card.appendChild(el('p', null, f.note));
      box.appendChild(card);
    });

    var steps = document.getElementById('steps');
    steps.innerHTML = '';
    conseils(lang).forEach(function (a) {
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
      var lang = (document.documentElement.getAttribute('lang') || 'fr').indexOf('en') === 0 ? 'en' : 'fr';
      render(collect(lang), lang);
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
    conseils: conseils,
    niveau: niveau,
    boot: boot
  };
});
