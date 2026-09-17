/*! PromptForge — interface. Tout l'état vit dans ce navigateur. */
(function () {
  'use strict';

  var engine = PF.engine, i18n = PF.i18n, profiles = PF.profiles, templates = PF.templates;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var KEYS = { theme: 'pf.theme', lang: 'pf.lang', history: 'pf.history', settings: 'pf.settings', ai: 'pf.ai' };
  var MAX_HISTORY = 12;

  var TARGETS = [
    { id: 'claude', icon: '✳' },
    { id: 'gpt', icon: '◉' },
    { id: 'gemini', icon: '✦' },
    { id: 'mistral', icon: '◈' },
    { id: 'claudecode', icon: '❯_', badge: true },
    { id: 'image', icon: '◐' },
    { id: 'any', icon: '✶' }
  ];

  var state = {
    lang: 'fr',
    result: null,
    localResult: null,
    format: 'structured',
    target: 'any',
    formatTouched: false,
    domainSetByTarget: false,
    libraryFilter: 'all',
    librarySearch: ''
  };

  /* ------------------------------------------------------------- storage */

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* mode privé, quota : sans effet */ }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { /* idem */ }
  }

  /* --------------------------------------------------------------- utils */

  function t(key) { return i18n.t(key, state.lang); }

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function debounce(fn, ms) {
    var id;
    return function () {
      var args = arguments, self = this;
      clearTimeout(id);
      id = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function b64encode(str) {
    return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decode(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  /* ----------------------------------------------------------------- i18n */

  function applyI18n() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $('#lang-label').textContent = state.lang === 'fr' ? 'EN' : 'FR';
    document.title = state.lang === 'fr'
      ? "PromptForge — transformez n'importe quelle demande en prompt professionnel"
      : 'PromptForge — turn any request into a professional prompt';
    fillDomainSelect();
    renderTargets();
    renderFormatChips();
    renderLibraryFilters();
    renderLibrary();
    renderHistory();
    if (state.result) render(state.result);
  }

  function renderTargets() {
    var box = $('#targets');
    box.innerHTML = '';
    TARGETS.forEach(function (target) {
      var label = document.createElement('label');
      label.className = 'target' + (target.badge ? ' has-badge' : '');
      label.innerHTML =
        '<input type="radio" name="target" value="' + target.id + '"' + (target.id === state.target ? ' checked' : '') + '>' +
        '<span class="target-body">' +
        '<span class="target-top"><span class="target-icon" aria-hidden="true">' + escapeHtml(target.icon) + '</span>' +
        '<span class="target-name">' + escapeHtml(t('target.' + target.id + '.name')) + '</span>' +
        (target.badge ? '<span class="target-badge">' + escapeHtml(t('target.badge')) + '</span>' : '') + '</span>' +
        '<span class="target-desc">' + escapeHtml(t('target.' + target.id + '.desc')) + '</span>' +
        '</span>';
      label.querySelector('input').addEventListener('change', function () {
        state.target = this.value;
        state.formatTouched = false;
        syncTarget();
        persistSettings();
        if ($('#request').value.trim()) generate({ silent: true, noHistory: true });
        else { renderFormatChips(); renderSummaryChips(); }
      });
      box.appendChild(label);
    });
    syncTarget();
  }

  /** Affiche les champs propres à la destination et aligne le format conseillé. */
  function syncTarget() {
    $('#agent-fields').hidden = state.target !== 'claudecode';

    // Choisir « génération d'images » comme destination fixe le domaine :
    // le changement est visible dans les réglages, et réversible.
    var domainEl = $('#opt-domain');
    if (state.target === 'image' && domainEl.value !== 'image') {
      domainEl.value = 'image';
      state.domainSetByTarget = true;
    } else if (state.target !== 'image' && state.domainSetByTarget) {
      domainEl.value = 'auto';
      state.domainSetByTarget = false;
    }

    if (!state.formatTouched) {
      var domainSel = $('#opt-domain').value;
      var detected = domainSel !== 'auto' ? domainSel : engine.detectDomain($('#request').value).id;
      state.format = engine.recommendedFormat(state.target, engine.domainForModel(state.target, detected));
    }
    updateLive();
    renderSummaryChips();
  }

  /* Réglages non standard : on les compte pour que l'utilisateur sache
     qu'il y a quelque chose sous le volet, sans avoir à l'ouvrir. */
  var DEFAULT_SETTINGS = {
    'opt-domain': 'auto', 'opt-depth': 'balanced', 'opt-shape': 'auto', 'opt-clarif': 'assume',
    'opt-answer-lang': '', 'opt-audience': '', 'opt-tone': '', 'opt-length': '', 'opt-persona': '', 'opt-context': ''
  };

  function countChangedSettings() {
    var n = 0;
    Object.keys(DEFAULT_SETTINGS).forEach(function (id) {
      var el = $('#' + id);
      if (el && String(el.value).trim() !== DEFAULT_SETTINGS[id]) n++;
    });
    $$('[data-flag]').forEach(function (cb) {
      var expected = cb.getAttribute('data-flag') !== 'examples';
      if (cb.checked !== expected) n++;
    });
    return n;
  }

  function renderSummaryChips() {
    var n = countChangedSettings();
    $('#summary-chips').textContent = n
      ? n + ' ' + t(n === 1 ? 'summary.setting' : 'summary.settings')
      : t('summary.default');
    $('#summary-chips').classList.toggle('is-changed', n > 0);
  }

  function fillDomainSelect() {
    var sel = $('#opt-domain');
    var current = sel.value || 'auto';
    sel.innerHTML = '';
    var auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = t('field.domain.auto');
    sel.appendChild(auto);
    profiles.list.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.icon + '  ' + d.label[state.lang];
      sel.appendChild(o);
    });
    sel.value = current;
  }

  /* --------------------------------------------------------------- theme */

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /* ------------------------------------------------------------ settings */

  function currentOptions() {
    var flags = {};
    $$('[data-flag]').forEach(function (cb) { flags[cb.getAttribute('data-flag')] = cb.checked; });
    return {
      lang: $('#opt-lang').value,
      format: state.format,
      domain: $('#opt-domain').value,
      model: state.target,
      stack: $('#opt-stack').value.trim(),
      files: $('#opt-files').value.trim(),
      testCmd: $('#opt-test').value.trim(),
      depth: $('#opt-depth').value,
      outputShape: $('#opt-shape').value,
      clarification: $('#opt-clarif').value,
      answerLang: $('#opt-answer-lang').value,
      audience: $('#opt-audience').value.trim(),
      tone: $('#opt-tone').value.trim(),
      length: $('#opt-length').value.trim(),
      persona: $('#opt-persona').value.trim(),
      context: $('#opt-context').value.trim(),
      flags: flags
    };
  }

  function applyOptions(o) {
    if (!o) return;
    var set = function (sel, v) { if (v !== undefined && v !== null && v !== '') $(sel).value = v; };
    set('#opt-lang', o.lang); set('#opt-domain', o.domain);
    set('#opt-depth', o.depth); set('#opt-shape', o.outputShape); set('#opt-clarif', o.clarification);
    if (o.stack !== undefined) $('#opt-stack').value = o.stack;
    if (o.files !== undefined) $('#opt-files').value = o.files;
    if (o.testCmd !== undefined) $('#opt-test').value = o.testCmd;
    if (o.model) {
      var known = TARGETS.some(function (x) { return x.id === o.model; });
      state.target = known ? o.model : 'any';
      var radio = document.querySelector('input[name="target"][value="' + state.target + '"]');
      if (radio) radio.checked = true;
      $('#agent-fields').hidden = state.target !== 'claudecode';
    }
    if (o.answerLang !== undefined) $('#opt-answer-lang').value = o.answerLang;
    if (o.audience !== undefined) $('#opt-audience').value = o.audience;
    if (o.tone !== undefined) $('#opt-tone').value = o.tone;
    if (o.length !== undefined) $('#opt-length').value = o.length;
    if (o.persona !== undefined) $('#opt-persona').value = o.persona;
    if (o.context !== undefined) $('#opt-context').value = o.context;
    if (o.format) state.format = o.format;
    if (o.flags) {
      $$('[data-flag]').forEach(function (cb) {
        var k = cb.getAttribute('data-flag');
        if (o.flags[k] !== undefined) cb.checked = !!o.flags[k];
      });
    }
  }

  var persistSettings = debounce(function () {
    var o = currentOptions();
    delete o.context;
    write(KEYS.settings, o);
  }, 400);

  /* -------------------------------------------------------------- render */

  function renderFormatChips() {
    var box = $('#format-chips');
    box.innerHTML = '';
    var recommended = state.result ? state.result.meta.recommendedFormat : null;
    engine.FORMATS.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'format-chip';
      b.setAttribute('aria-pressed', String(f === state.format));
      b.dataset.format = f;
      b.innerHTML = escapeHtml(t('format.' + f)) + (f === recommended ? ' <span class="rec" title="recommandé">◆</span>' : '');
      b.addEventListener('click', function () {
        state.format = f;
        state.formatTouched = true;
        persistSettings();
        if ($('#request').value.trim()) generate({ silent: true });
        else { renderFormatChips(); updateFormatHelp(); }
      });
      box.appendChild(b);
    });
    updateFormatHelp();
  }

  function updateFormatHelp() {
    var key = 'format.' + state.format + '.help';
    var txt = t(key);
    $('#format-help').textContent = txt === key ? '' : txt;
  }

  function severity(value) {
    if (value < 35) return 'critical';
    if (value < 55) return 'serious';
    if (value < 75) return 'warning';
    return 'good';
  }

  function render(result) {
    state.result = result;
    $('#empty-state').hidden = true;
    $('#output').textContent = result.text;
    $('#token-count').textContent = '≈ ' + result.meta.tokens + ' ' + t('result.tokens');
    renderFormatChips();
    renderAnalysis(result);
  }

  function renderAnalysis(result) {
    var a = result.analysis, m = result.meta, box = $('#analysis-body');
    var g = a.grade;
    var afterGrade = engine.grade(m.after, state.lang);
    var domainLabel = a.profile.icon + ' ' + a.profile.label[state.lang];
    var html = '';

    html += '<div class="score-hero">' +
      '<div class="score-figure"><span class="value">' + m.before + '</span>' +
      '<span class="label">' + escapeHtml(t('analysis.before')) + ' / 100</span>' +
      '<span class="score-grade grade-' + g.key + '">' + escapeHtml(g.label) + '</span></div>' +
      '<div class="score-arrow" aria-hidden="true">→</div>' +
      '<div class="score-figure after"><span class="value">' + m.after + '</span>' +
      '<span class="label">' + escapeHtml(t('analysis.after')) + ' / 100</span>' +
      '<span class="score-grade grade-' + afterGrade.key + '">' + escapeHtml(afterGrade.label) + '</span></div>' +
      '<div class="score-gain"><b>+' + Math.max(0, m.gain) + '</b><br><span class="muted">' +
      escapeHtml(t('analysis.gain')) + '</span></div>' +
      '</div>';

    html += '<p class="muted" style="margin-top:10px">' + escapeHtml(t('analysis.method')) + '</p>';

    html += '<div class="analysis-block"><h3>' + escapeHtml(t('composer.detected')) + '</h3>' +
      '<p class="muted">' + escapeHtml(domainLabel) +
      (a.domain.forced ? '' : (a.domain.confidence ? ' · ' + a.domain.confidence + ' % ' + escapeHtml(t('analysis.domainConfidence')) : '')) +
      '</p></div>';

    html += '<div class="analysis-block"><h3>' + escapeHtml(t('analysis.dimensions')) + '</h3><div class="meters">';
    a.score.dimensions.slice().sort(function (x, y) { return y.value - x.value; }).forEach(function (d) {
      var sev = severity(d.value);
      html += '<div class="meter is-' + sev + '">' +
        '<span class="name">' + escapeHtml(d.label) + '</span>' +
        '<span class="track"><span class="fill" style="width:' + Math.max(2, d.value) + '%"></span></span>' +
        '<span class="val">' + d.value + '</span></div>';
    });
    html += '</div></div>';

    var tips = a.score.dimensions.filter(function (d) { return d.tip; });
    html += '<div class="analysis-block"><h3>' + escapeHtml(t('analysis.suggestions')) + '</h3>';
    if (!tips.length) {
      html += '<p class="muted">' + escapeHtml(t('analysis.nosuggestion')) + '</p>';
    } else {
      html += '<ul class="tips">';
      tips.forEach(function (d) {
        html += '<li><span class="tip-tag grade-' + severity(d.value) + '">' + escapeHtml(d.label) + '</span>' +
          '<span>' + escapeHtml(d.tip) + '</span></li>';
      });
      html += '</ul>';
    }
    html += '</div>';

    var sig = a.signals;
    var rows = Object.keys(sig).filter(function (k) { return sig[k] && sig[k].length; });
    html += '<div class="analysis-block"><h3>' + escapeHtml(t('analysis.signals')) + '</h3>';
    if (!rows.length) {
      html += '<p class="muted">' + escapeHtml(t('analysis.nosignal')) + '</p>';
    } else {
      html += '<div class="signal-grid">';
      rows.forEach(function (k) {
        var label = t('signal.' + k);
        html += '<div class="signal"><div class="k">' + escapeHtml(label === 'signal.' + k ? k : label) + '</div>' +
          '<div class="v">' + escapeHtml(sig[k].join(' · ')) + '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    box.innerHTML = html;
  }

  /* ------------------------------------------------------------ generate */

  function generate(opts) {
    opts = opts || {};
    var raw = $('#request').value.trim();
    if (!raw) { toast(t('toast.empty')); $('#request').focus(); return; }
    var result = engine.build(raw, currentOptions());
    state.localResult = result.text;
    render(result);
    renderSummaryChips();
    persistSettings();
    if (!opts.noHistory) pushHistory(raw, currentOptions());
    if (!opts.silent) toast(t('toast.generated'));
  }

  var updateLive = debounce(function () {
    var raw = $('#request').value;
    var chip = $('#live-domain');
    var count = $('#live-count');
    var words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
    count.textContent = words ? words + ' ' + t('composer.words') : '';
    if (raw.trim().length < 3 || $('#opt-domain').value !== 'auto') { chip.hidden = true; return; }
    var d = engine.detectDomain(raw);
    var p = profiles.get(d.id);
    chip.hidden = false;
    chip.textContent = p.icon + ' ' + p.label[state.lang] + (d.confidence ? ' · ' + d.confidence + ' %' : '');
  }, 220);

  /* ------------------------------------------------------------- history */

  function pushHistory(request, options) {
    var list = read(KEYS.history, []);
    list = list.filter(function (h) { return h.request !== request; });
    list.unshift({ request: request, options: options, at: Date.now() });
    write(KEYS.history, list.slice(0, MAX_HISTORY));
    renderHistory();
  }

  function renderHistory() {
    var list = read(KEYS.history, []);
    var section = $('#history-section');
    var ul = $('#history-list');
    section.hidden = !list.length;
    ul.innerHTML = '';
    list.forEach(function (h, idx) {
      var li = document.createElement('li');
      var when = new Date(h.at);
      var domain = profiles.get(engine.detectDomain(h.request).id);
      li.innerHTML = '<div class="h-text"><div class="h-req">' + escapeHtml(h.request) + '</div>' +
        '<div class="h-meta">' + escapeHtml(domain.icon + ' ' + domain.label[state.lang]) + ' · ' +
        escapeHtml(when.toLocaleString(state.lang === 'fr' ? 'fr-FR' : 'en-GB')) + '</div></div>';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-small btn-ghost';
      btn.textContent = t('history.restore');
      btn.addEventListener('click', function () {
        $('#request').value = h.request;
        applyOptions(h.options);
        updateLive();
        generate({ noHistory: true, silent: true });
        toast(t('toast.restored'));
        document.getElementById('workshop').scrollIntoView({ block: 'start' });
      });
      li.appendChild(btn);
      ul.appendChild(li);
      void idx;
    });
  }

  /* ------------------------------------------------------------- library */

  function renderLibraryFilters() {
    var box = $('#library-filters');
    box.innerHTML = '';
    var used = {};
    templates.list.forEach(function (tpl) { used[tpl.domain] = true; });
    var ids = ['all'].concat(profiles.list.filter(function (d) { return used[d.id]; }).map(function (d) { return d.id; }));
    ids.forEach(function (id) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter';
      b.setAttribute('aria-pressed', String(id === state.libraryFilter));
      b.textContent = id === 'all' ? t('library.all') : (profiles.get(id).icon + ' ' + profiles.get(id).label[state.lang]);
      b.addEventListener('click', function () {
        state.libraryFilter = id;
        renderLibraryFilters();
        renderLibrary();
      });
      box.appendChild(b);
    });
  }

  function renderLibrary() {
    var box = $('#library-cards');
    var q = engine.normalize(state.librarySearch);
    box.innerHTML = '';
    var items = templates.list.filter(function (tpl) {
      if (state.libraryFilter !== 'all' && tpl.domain !== state.libraryFilter) return false;
      if (!q) return true;
      var hay = engine.normalize([tpl.title.fr, tpl.title.en, tpl.desc.fr, tpl.desc.en, tpl.request[state.lang]].join(' '));
      return hay.indexOf(q) !== -1;
    });
    if (!items.length) {
      box.innerHTML = '<p class="muted">' + escapeHtml(t('library.none')) + '</p>';
      return;
    }
    items.forEach(function (tpl) {
      var d = profiles.get(tpl.domain);
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.innerHTML =
        '<div class="card-top"><span class="card-icon" aria-hidden="true">' + escapeHtml(d.icon) + '</span>' +
        '<h3>' + escapeHtml(tpl.title[state.lang]) + '</h3></div>' +
        '<p>' + escapeHtml(tpl.desc[state.lang]) + '</p>' +
        '<span class="card-domain">' + escapeHtml(d.label[state.lang]) + '</span>';
      card.addEventListener('click', function () { useTemplate(tpl); });
      box.appendChild(card);
    });
  }

  function useTemplate(tpl) {
    $('#request').value = tpl.request[state.lang];
    if (tpl.opts) {
      applyOptions({
        outputShape: tpl.opts.outputShape, depth: tpl.opts.depth,
        model: tpl.opts.model, domain: tpl.domain
      });
      if (tpl.opts.format) { state.format = tpl.opts.format; state.formatTouched = true; }
      else state.formatTouched = false;
      renderTargets();
    }
    updateLive();
    generate({ silent: true });
    toast(t('toast.loaded'));
    document.getElementById('workshop').scrollIntoView({ block: 'start' });
    $('#request').focus();
  }

  /* --------------------------------------------------------------- share */

  function shareLink() {
    if (!$('#request').value.trim()) { toast(t('toast.empty')); return; }
    var payload = { r: $('#request').value.trim(), o: currentOptions(), l: state.lang };
    var url = location.origin + location.pathname + '#p=' + b64encode(JSON.stringify(payload));
    copyText(url).then(function () { toast(t('result.shared')); }, function () {
      history.replaceState(null, '', '#p=' + b64encode(JSON.stringify(payload)));
      toast(t('toast.copyfail'));
    });
  }

  function loadFromHash() {
    var m = /[#&]p=([A-Za-z0-9\-_]+)/.exec(location.hash);
    if (!m) return false;
    try {
      var payload = JSON.parse(b64decode(m[1]));
      if (payload.l) { state.lang = payload.l === 'en' ? 'en' : 'fr'; }
      applyOptions(payload.o);
      $('#request').value = payload.r || '';
      return true;
    } catch (e) { return false; }
  }

  /* -------------------------------------------------------------- refine */

  function openRefine() {
    if (!state.result) { toast(t('toast.empty')); return; }
    var saved = read(KEYS.ai, {});
    $('#refine-provider').value = saved.provider || 'anthropic';
    $('#refine-model').value = saved.model || PF.ai.PROVIDERS[$('#refine-provider').value].defaultModel;
    $('#refine-endpoint').value = saved.endpoint || '';
    $('#refine-key').value = saved.key || '';
    $('#refine-remember').checked = !!saved.key;
    $('#refine-error').hidden = true;
    syncRefineProvider();
    var dlg = $('#refine-dialog');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function closeRefine() {
    var dlg = $('#refine-dialog');
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  function syncRefineProvider() {
    var p = $('#refine-provider').value;
    $('#refine-endpoint-field').hidden = p !== 'custom';
    var def = PF.ai.PROVIDERS[p];
    $('#refine-key').setAttribute('placeholder', def && def.keyHint ? def.keyHint : '');
    if (!$('#refine-model').value && def && def.defaultModel) $('#refine-model').value = def.defaultModel;
  }

  function runRefine() {
    var provider = $('#refine-provider').value;
    var key = $('#refine-key').value.trim();
    var model = $('#refine-model').value.trim();
    var endpoint = $('#refine-endpoint').value.trim();
    var err = $('#refine-error');
    err.hidden = true;

    if (!key) { err.textContent = t('refine.nokey'); err.hidden = false; return; }

    if ($('#refine-remember').checked) write(KEYS.ai, { provider: provider, model: model, endpoint: endpoint, key: key });
    else write(KEYS.ai, { provider: provider, model: model, endpoint: endpoint });

    var btn = $('#refine-run');
    btn.disabled = true;
    btn.textContent = t('refine.running');

    PF.ai.refine({
      provider: provider, key: key, model: model, endpoint: endpoint,
      prompt: state.result.text, lang: state.result.options.lang
    }).then(function (text) {
      $('#output').textContent = text;
      state.result.text = text;
      $('#token-count').textContent = '≈ ' + engine.estimateTokens(text) + ' ' + t('result.tokens');
      closeRefine();
      toast(t('refine.done'));
    }, function (e) {
      err.textContent = t('refine.error') + ' : ' + (e && e.message ? e.message : '');
      err.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = t('refine.run');
    });
  }

  /* ---------------------------------------------------------------- init */

  function bind() {
    $('#composer').addEventListener('submit', function (e) { e.preventDefault(); generate(); });

    $('#request').addEventListener('input', updateLive);
    $('#request').addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    });

    $('#example').addEventListener('click', function () {
      var pool = templates.list;
      useTemplate(pool[Math.floor(Math.random() * pool.length)]);
    });

    $('#clear').addEventListener('click', function () {
      $('#request').value = '';
      $('#opt-context').value = '';
      $('#opt-stack').value = ''; $('#opt-files').value = ''; $('#opt-test').value = '';
      $('#output').textContent = '';
      $('#empty-state').hidden = false;
      $('#token-count').textContent = '';
      $('#live-domain').hidden = true;
      $('#live-count').textContent = '';
      $('#analysis-body').innerHTML = '<p class="muted">' + escapeHtml(t('result.empty.body')) + '</p>';
      state.result = null;
      renderFormatChips();
      $('#request').focus();
    });

    $('#copy').addEventListener('click', function () {
      if (!state.result) { toast(t('toast.empty')); return; }
      var btn = this;
      copyText(state.result.text).then(function () {
        btn.textContent = t('result.copied');
        setTimeout(function () { btn.textContent = t('result.copy'); }, 1600);
      }, function () { toast(t('toast.copyfail')); });
    });

    $('#download').addEventListener('click', function () {
      if (!state.result) { toast(t('toast.empty')); return; }
      var ext = state.result.options.format === 'json' ? 'json' : 'md';
      var blob = new Blob([state.result.text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'promptforge-' + state.result.analysis.domain.id + '.' + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    $('#share').addEventListener('click', shareLink);
    $('#refine-open').addEventListener('click', openRefine);
    $('#refine-close').addEventListener('click', closeRefine);
    $('#refine-run').addEventListener('click', runRefine);
    $('#refine-provider').addEventListener('change', function () {
      $('#refine-model').value = PF.ai.PROVIDERS[this.value].defaultModel || '';
      syncRefineProvider();
    });

    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-selected', 'false'); });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        $$('.tabpanel').forEach(function (p) {
          p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab);
        });
      });
    });

    $$('#composer select, #composer input, #composer textarea').forEach(function (el) {
      if (el.name === 'target') return;
      el.addEventListener('change', function () {
        persistSettings();
        renderSummaryChips();
        if (el.id === 'opt-domain') { state.domainSetByTarget = false; state.formatTouched = false; syncTarget(); }
        if (state.result && el.id !== 'request') generate({ silent: true, noHistory: true });
      });
    });

    $('#reset-settings').addEventListener('click', function () {
      Object.keys(DEFAULT_SETTINGS).forEach(function (id) {
        var el = $('#' + id);
        if (el) el.value = DEFAULT_SETTINGS[id];
      });
      $$('[data-flag]').forEach(function (cb) { cb.checked = cb.getAttribute('data-flag') !== 'examples'; });
      $('#opt-stack').value = ''; $('#opt-files').value = ''; $('#opt-test').value = '';
      state.formatTouched = false;
      syncTarget();
      persistSettings();
      if (state.result) generate({ silent: true, noHistory: true });
    });

    $('#history-clear').addEventListener('click', function () {
      if (window.confirm(t('history.confirmClear'))) { drop(KEYS.history); renderHistory(); }
    });

    $('#library-search').addEventListener('input', debounce(function () {
      state.librarySearch = this.value;
      renderLibrary();
    }, 180));

    $('#theme-toggle').addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme');
      if (!now) {
        now = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
      }
      var next = now === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      write(KEYS.theme, next);
    });

    $('#lang-toggle').addEventListener('click', function () {
      state.lang = state.lang === 'fr' ? 'en' : 'fr';
      write(KEYS.lang, state.lang);
      $('#opt-lang').value = state.lang;
      applyI18n();
      if (state.result) generate({ silent: true, noHistory: true });
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && document.activeElement !== $('#request')) {
        e.preventDefault(); generate();
      }
    });
  }

  function init() {
    // Sans choix explicite, on laisse la préférence du système décider.
    var savedTheme = read(KEYS.theme, null);
    if (savedTheme) applyTheme(savedTheme);

    var savedLang = read(KEYS.lang, null);
    state.lang = savedLang || ((navigator.language || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en');

    $('#stat-domains').textContent = String(profiles.list.length);
    $('#stat-templates').textContent = String(templates.list.length);

    bind();
    var saved = read(KEYS.settings, null);
    if (saved && saved.model) state.target = TARGETS.some(function (x) { return x.id === saved.model; }) ? saved.model : 'any';
    if (saved && saved.format) { state.format = saved.format; state.formatTouched = true; }
    applyOptions(saved);
    $('#opt-lang').value = state.lang;

    var fromHash = loadFromHash();
    applyI18n();
    updateLive();

    if (fromHash) {
      generate({ silent: true, noHistory: true });
      toast(t('toast.linkloaded'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
