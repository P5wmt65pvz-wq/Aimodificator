/*!
 * Abonnements — ce que vos abonnements coûtent vraiment, et quand ils se renouvellent.
 *
 * Répond à la plainte la plus répandue dans les avis d'utilisateurs français :
 * la reconduction automatique qu'on n'avait pas vue venir.
 *
 * Tout reste dans le navigateur : la liste est enregistrée dans le stockage
 * local, elle n'est envoyée nulle part. Aucun serveur n'existe pour la recevoir.
 *
 * Le calcul est en fonctions pures, testables sous Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Abonnements = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Nombre de mois d'un cycle. L'hebdomadaire est traité à part : il ne tombe
     pas sur un nombre entier de mois. */
  var CYCLES = {
    hebdomadaire: { mois: 0, jours: 7, label: { fr: 'par semaine', court: 'sem.' } },
    mensuel: { mois: 1, jours: 0, label: { fr: 'par mois', court: 'mois' } },
    trimestriel: { mois: 3, jours: 0, label: { fr: 'par trimestre', court: 'trim.' } },
    semestriel: { mois: 6, jours: 0, label: { fr: 'par semestre', court: 'sem.' } },
    annuel: { mois: 12, jours: 0, label: { fr: 'par an', court: 'an' } }
  };

  /* --------------------------------------------------------------- calculs */

  /* Coût ramené au mois. Base : 365,25 jours par an pour absorber les années
     bissextiles, soit 30,4375 jours par mois en moyenne. */
  var JOURS_PAR_MOIS = 365.25 / 12;

  function coutMensuel(abo) {
    var c = CYCLES[abo && abo.cycle];
    var prix = Number(abo && abo.prix);
    if (!c || !isFinite(prix)) return 0;
    if (c.jours) return prix * (JOURS_PAR_MOIS / c.jours);
    return prix / c.mois;
  }

  function coutAnnuel(abo) {
    return coutMensuel(abo) * 12;
  }

  /* Ajoute n mois à une date en gardant le dernier jour du mois quand le jour
     d'origine n'existe pas : 31 janvier + 1 mois donne le 28 (ou 29) février,
     pas le 3 mars comme le ferait setMonth() seul. */
  function ajouterMois(date, n) {
    var jour = date.getUTCDate();
    var d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
    var dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(jour, dernier));
    return d;
  }

  function ajouterJours(date, n) {
    return new Date(date.getTime() + n * 86400000);
  }

  function auJour(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /* Prochaine reconduction strictement après aujourd'hui, en partant de la date
     de souscription et en avançant de cycle en cycle. Une date de départ dans
     le futur est renvoyée telle quelle : c'est déjà la prochaine échéance. */
  function prochaineEcheance(abo, aujourdhui) {
    if (!abo || !abo.depart) return null;
    var c = CYCLES[abo.cycle];
    if (!c) return null;
    var depart = auJour(new Date(abo.depart));
    if (isNaN(depart.getTime())) return null;
    var today = auJour(aujourdhui ? new Date(aujourdhui) : new Date());

    var d = depart;
    var garde = 0;
    while (d.getTime() <= today.getTime()) {
      d = c.jours ? ajouterJours(d, c.jours) : ajouterMois(d, c.mois);
      if (++garde > 5000) return null;          /* date de départ aberrante */
    }
    return d;
  }

  function joursAvant(date, aujourdhui) {
    if (!date) return null;
    var today = auJour(aujourdhui ? new Date(aujourdhui) : new Date());
    return Math.round((auJour(date).getTime() - today.getTime()) / 86400000);
  }

  function totaux(liste) {
    var m = (liste || []).reduce(function (a, abo) { return a + coutMensuel(abo); }, 0);
    return { mensuel: m, annuel: m * 12 };
  }

  /* Du plus imminent au plus lointain ; ceux sans date valable ferment la marche. */
  function trier(liste, aujourdhui) {
    return (liste || []).slice().sort(function (a, b) {
      var ja = joursAvant(prochaineEcheance(a, aujourdhui), aujourdhui);
      var jb = joursAvant(prochaineEcheance(b, aujourdhui), aujourdhui);
      if (ja === null && jb === null) return 0;
      if (ja === null) return 1;
      if (jb === null) return -1;
      return ja - jb;
    });
  }

  /* Un abonnement dont la reconduction tombe dans les `seuil` prochains jours.
     C'est le moment où l'on peut encore résilier sans être reconduit. */
  function imminents(liste, aujourdhui, seuil) {
    seuil = seuil === undefined ? 14 : seuil;
    return (liste || []).filter(function (abo) {
      var j = joursAvant(prochaineEcheance(abo, aujourdhui), aujourdhui);
      return j !== null && j <= seuil;
    });
  }

  /* --------------------------------------------------------- présentation */

  function euros(n) {
    if (!isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function dateCourte(d) {
    if (!d) return '—';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function delai(jours) {
    if (jours === null) return 'date inconnue';
    if (jours === 0) return "aujourd'hui";
    if (jours === 1) return 'demain';
    if (jours < 0) return 'date passée';
    return 'dans ' + jours + ' jours';
  }

  /* ------------------------------------------------------------ stockage */

  var CLE = 'abonnements.liste';

  function charger() {
    try {
      var brut = localStorage.getItem(CLE);
      if (!brut) return [];
      var v = JSON.parse(brut);
      return Array.isArray(v) ? v.filter(valide) : [];
    } catch (e) { return []; }
  }

  function enregistrer(liste) {
    try { localStorage.setItem(CLE, JSON.stringify(liste)); return true; }
    catch (e) { return false; }
  }

  function valide(abo) {
    return !!abo && typeof abo.nom === 'string' && abo.nom.trim() !== '' &&
      isFinite(Number(abo.prix)) && Number(abo.prix) >= 0 && !!CYCLES[abo.cycle];
  }

  /* ---------------------------------------------------------------- rendu */

  function el(tag, cls, texte) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  var liste = [];

  function rendre() {
    var corps = document.getElementById('liste');
    var vide = document.getElementById('vide');
    var t = totaux(liste);

    document.getElementById('total-mensuel').textContent = euros(t.mensuel);
    document.getElementById('total-annuel').textContent = euros(t.annuel);
    document.getElementById('compte').textContent = liste.length === 0 ? ''
      : liste.length + (liste.length > 1 ? ' abonnements' : ' abonnement');

    var proches = imminents(liste, null, 14);
    var alerte = document.getElementById('alerte');
    alerte.hidden = proches.length === 0;
    if (proches.length) {
      alerte.textContent = proches.length === 1
        ? '« ' + proches[0].nom +' » se reconduit ' + delai(joursAvant(prochaineEcheance(proches[0]))) +
          '. C\'est maintenant qu\'on peut encore l\'arrêter.'
        : proches.length + ' abonnements se reconduisent dans les deux semaines. C\'est maintenant qu\'on peut encore les arrêter.';
    }

    corps.innerHTML = '';
    vide.hidden = liste.length > 0;

    trier(liste).forEach(function (abo) {
      var ech = prochaineEcheance(abo);
      var j = joursAvant(ech);
      var proche = j !== null && j <= 14;

      var ligne = el('article', 'abo' + (proche ? ' is-proche' : ''));

      var haut = el('div', 'abo-haut');
      haut.appendChild(el('h3', null, abo.nom));
      haut.appendChild(el('span', 'abo-prix', euros(Number(abo.prix)) + ' ' + CYCLES[abo.cycle].label.fr));
      ligne.appendChild(haut);

      var bas = el('div', 'abo-bas');
      var ech1 = el('span', 'abo-echeance');
      ech1.appendChild(el('b', null, dateCourte(ech)));
      ech1.appendChild(el('span', 'muted', ' · ' + delai(j)));
      bas.appendChild(ech1);
      bas.appendChild(el('span', 'abo-mensuel muted', 'soit ' + euros(coutMensuel(abo)) + ' par mois'));
      ligne.appendChild(bas);

      var sup = el('button', 'abo-supprimer', 'Retirer');
      sup.type = 'button';
      sup.setAttribute('aria-label', 'Retirer ' + abo.nom);
      sup.addEventListener('click', function () {
        liste = liste.filter(function (x) { return x !== abo; });
        enregistrer(liste);
        rendre();
      });
      ligne.appendChild(sup);

      corps.appendChild(ligne);
    });
  }

  function bindTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem('abonnements.theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) cur = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var suiv = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', suiv);
      try { localStorage.setItem('abonnements.theme', suiv); } catch (e) {}
    });
  }

  function demarrer() {
    bindTheme();
    var form = document.getElementById('ajout');
    if (!form) return;

    liste = charger();
    rendre();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var abo = {
        nom: document.getElementById('nom').value.trim(),
        prix: document.getElementById('prix').value,
        cycle: document.getElementById('cycle').value,
        depart: document.getElementById('depart').value
      };
      var erreur = document.getElementById('erreur');
      if (!valide(abo)) {
        erreur.hidden = false;
        erreur.textContent = 'Il manque le nom ou le prix — le prix doit être un nombre positif.';
        return;
      }
      if (!prochaineEcheance(abo)) {
        erreur.hidden = false;
        erreur.textContent = 'La date de souscription ou de dernier prélèvement est nécessaire pour calculer la reconduction.';
        return;
      }
      erreur.hidden = true;
      abo.prix = Number(abo.prix);
      liste.push(abo);
      enregistrer(liste);
      rendre();
      form.reset();
      document.getElementById('nom').focus();
    });

    var vider = document.getElementById('vider');
    if (vider) vider.addEventListener('click', function () {
      if (!liste.length) return;
      liste = [];
      enregistrer(liste);
      rendre();
    });
  }

  function boot() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();
  }

  return {
    CYCLES: CYCLES, JOURS_PAR_MOIS: JOURS_PAR_MOIS,
    coutMensuel: coutMensuel, coutAnnuel: coutAnnuel,
    ajouterMois: ajouterMois, prochaineEcheance: prochaineEcheance, joursAvant: joursAvant,
    totaux: totaux, trier: trier, imminents: imminents,
    euros: euros, dateCourte: dateCourte, delai: delai,
    charger: charger, enregistrer: enregistrer, valide: valide,
    boot: boot
  };
});
