/*! Exemples — bascule de thème uniquement. La page est entièrement statique. */
(function () {
  'use strict';
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var saved = null;
  try { saved = localStorage.getItem('exemples.theme'); } catch (e) {}
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  btn.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    if (!cur) cur = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('exemples.theme', next); } catch (e) {}
  });
})();
