/*! Mentions légales — seul le choix du thème est géré ici. */
(function () {
  'use strict';
  var theme = document.getElementById('theme-toggle');
  if (!theme) return;
  var saved = null;
  try { saved = localStorage.getItem('mentions.theme'); } catch (e) {}
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  theme.addEventListener('click', function () {
    var suiv = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', suiv);
    try { localStorage.setItem('mentions.theme', suiv); } catch (e) {}
  });
})();
