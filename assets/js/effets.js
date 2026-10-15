/*!
 * Effets — chargé par chaque page.
 *
 * Deux détails de finition, rien qui porte une fonction :
 * - la lueur qui suit le pointeur sur les cartes : la position est passée en
 *   variables CSS (--mx, --my), le dessin reste dans verre.css ;
 * - l'en-tête qui se densifie dès qu'on fait défiler la page.
 *
 * Sans ce script, ou avec les animations réduites, la page est identique,
 * simplement plus sobre.
 */
(function () {
  'use strict';
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduit && window.PointerEvent) {
    document.addEventListener('pointermove', function (e) {
      var c = e.target && e.target.closest && e.target.closest('.card, .method-card, .tuile');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  var racine = document.documentElement;
  var suivre = function () { racine.classList.toggle('a-defile', window.scrollY > 8); };
  window.addEventListener('scroll', suivre, { passive: true });
  suivre();
})();
