/*!
 * Application — la page d'installation.
 *
 * Le bouton n'apparaît que si le navigateur propose réellement l'installation
 * (événement beforeinstallprompt). Sur iPhone, il n'existe pas : la page le
 * dit au lieu d'afficher un bouton qui ne ferait rien.
 *
 * Le compteur hors connexion interroge le service worker ; il ne télécharge
 * rien. Seul le bouton « Garder tout le site » lance une copie complète.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var theme = $('theme-toggle');
  if (theme) {
    var saved = null;
    try { saved = localStorage.getItem('application.theme'); } catch (e) {}
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    theme.addEventListener('click', function () {
      var suiv = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', suiv);
      try { localStorage.setItem('application.theme', suiv); } catch (e) {}
    });
  }

  var etat = $('etat-install'), bouton = $('bouton-installer');
  if (!etat || !bouton) return;
  var dire = function (t) { etat.textContent = t; };
  var app = window.PFApp;

  if (app && app.estInstallee()) {
    dire('L\'application est installée : c\'est elle que vous utilisez en ce moment.');
  }

  var invite = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    invite = e;
    bouton.hidden = false;
    dire('Votre navigateur permet l\'installation directe, en un geste.');
  });
  bouton.addEventListener('click', function () {
    if (!invite) return;
    var i = invite;
    invite = null;
    bouton.hidden = true;
    i.prompt();
    i.userChoice.then(function (choix) {
      dire(choix && choix.outcome === 'accepted'
        ? 'Installation lancée : l\'icône apparaît sur l\'écran d\'accueil.'
        : 'Installation annulée. Le bouton reviendra à la prochaine visite.');
    }).catch(function () {});
  });
  window.addEventListener('appinstalled', function () {
    bouton.hidden = true;
    dire('Application installée : l\'icône est sur l\'écran d\'accueil.');
  });

  /* ------------------------------------------------------- hors connexion */
  var bloc = $('hors-ligne'), compte = $('compte'), jauge = $('jauge'), garder = $('garder-tout');
  if (!app || !('serviceWorker' in navigator) || !bloc) return;

  /* En français, 0 et 1 prennent le singulier : « 0 fichier », « 1 fichier ». */
  var nb = function (n, un, plusieurs) { return n + ' ' + (n < 2 ? un : plusieurs); };

  var enCours = false;
  navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'bilan' || typeof d.total !== 'number' || typeof d.presents !== 'number') return;
    var complet = d.total > 0 && d.presents >= d.total;
    bloc.hidden = false;
    bloc.classList.toggle('is-complet', complet);
    jauge.style.width = (d.total > 0 ? Math.min(100, Math.round(100 * d.presents / d.total)) : 0) + '%';
    compte.textContent = (complet
      ? 'tout le site est gardé sur cet appareil (' + nb(d.total, 'fichier', 'fichiers') + ').'
      : d.presents === 0
        ? 'rien n\'est encore gardé sur cet appareil (' + nb(d.total, 'fichier', 'fichiers') + ' à garder).'
        : nb(d.presents, 'fichier gardé', 'fichiers gardés') + ' sur ' + d.total + '.') +
      (d.echecs > 0
        ? ' ' + (d.echecs === 1 ? '1 n\'a pas pu être téléchargé' : d.echecs + ' n\'ont pas pu être téléchargés') +
          ' : réessayez avec une meilleure connexion.'
        : '');
    enCours = false;
    garder.disabled = false;
    garder.hidden = complet;
    garder.textContent = 'Garder tout le site sur cet appareil';
  });
  if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();

  garder.addEventListener('click', function () {
    if (enCours) return;
    enCours = true;
    garder.disabled = true;
    garder.textContent = 'Copie en cours…';
    app.demander('tout-prendre').catch(function () {
      enCours = false;
      garder.disabled = false;
      garder.textContent = 'Garder tout le site sur cet appareil';
    });
  });

  app.demander('etat').catch(function () {});
})();
