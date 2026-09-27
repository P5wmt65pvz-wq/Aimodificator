/*!
 * Installation de l'application — chargé par chaque page du site.
 *
 * Inscrit le service worker (sw.js, à la racine du site) et, quand le site
 * tourne comme application installée, lui demande de garder une copie de
 * toutes les pages pour le hors connexion. Un simple visiteur ne déclenche
 * aucun téléchargement : seul ce qu'il ouvre est gardé.
 *
 * Rien n'est affiché ici, et rien n'est proposé avec insistance : le bouton
 * d'installation n'existe que sur la page « Application », pour qui l'a
 * cherchée.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  var script = document.currentScript;
  if (!script || !script.src) return;

  /* Ce fichier est dans assets/js/ : la racine du site est deux dossiers
     plus haut, quelle que soit la page qui le charge. */
  var racine = new URL('../../', script.src);

  function estInstallee() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function demander(quoi) {
    return navigator.serviceWorker.ready.then(function (r) {
      if (r.active) r.active.postMessage(quoi);
    });
  }

  var inscription = navigator.serviceWorker
    .register(new URL('sw.js', racine).href, { scope: racine.pathname })
    .then(function (r) {
      if (estInstallee()) demander('tout-prendre');
      return r;
    });
  /* Un refus (navigation privée, stockage désactivé) n'est pas une erreur de
     la page : le site marche exactement comme avant, en ligne. */
  inscription.catch(function () {});

  window.addEventListener('appinstalled', function () { demander('tout-prendre').catch(function () {}); });

  window.PFApp = {
    racine: racine.href,
    estInstallee: estInstallee,
    demander: function (quoi) { return inscription.then(function () { return demander(quoi); }); }
  };
})();
