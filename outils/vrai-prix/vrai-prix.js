/*!
 * Vrai prix — ce qu'un abonnement coûte sur la durée, face à l'achat unique.
 *
 * Complément d'Abonnements : celui-ci répond « quand est-ce que ça tombe ? »,
 * celui-ci répond « combien ça fait, au bout du compte ? ».
 *
 * Aucune donnée ne sort du navigateur, et rien n'est enregistré : la page ne
 * garde même pas la saisie. Il n'y a pas de serveur pour recevoir quoi que ce
 * soit.
 *
 * Le calcul est en fonctions pures, testables sous Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.VraiPrix = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Même base qu'Abonnements : 365,25 jours par an absorbe les bissextiles,
     soit 30,4375 jours par mois en moyenne. Sans ça, « quatre semaines »
     ferait perdre presque un mois de facturation par an. */
  var JOURS_PAR_MOIS = 365.25 / 12;

  var CYCLES = {
    hebdomadaire: { jours: 7, label: 'par semaine' },
    mensuel: { mois: 1, label: 'par mois' },
    trimestriel: { mois: 3, label: 'par trimestre' },
    semestriel: { mois: 6, label: 'par semestre' },
    annuel: { mois: 12, label: 'par an' }
  };

  /* Plafond de recherche du point de bascule : cinquante ans. Au-delà, la
     question ne veut plus rien dire, et une boucle sans borne sur une saisie
     aberrante bloquerait la page. */
  var MOIS_MAX = 600;

  /* Number() convertit avant de tester : Number('') et Number(null) valent
     tous les deux 0, et un champ vide ressortirait en « 0,00 € sur cinq ans »
     — faux, et rassurant, la pire combinaison. Seuls un nombre fini et une
     chaîne non vide sont acceptés ; tout le reste rend NaN. */
  function nombre(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var t = v.trim();
    if (t === '') return NaN;
    var n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  /* Prix ramené au mois. Rend NaN sur une saisie inexploitable plutôt que 0 :
     un zéro silencieux ferait afficher « 0 € sur cinq ans », ce qui est faux
     et rassurant, la pire combinaison. */
  function coutMensuel(prix, cycle) {
    var c = CYCLES[cycle];
    var p = nombre(prix);
    if (!c || !Number.isFinite(p) || p < 0) return NaN;
    if (c.jours) return p * (JOURS_PAR_MOIS / c.jours);
    return p / c.mois;
  }

  /* Total dépensé au bout de `mois` mois, hausse annuelle comprise.
     La hausse s'applique à chaque anniversaire, pas au premier mois : un
     abonnement qui augmente de 10 % par an coûte son prix d'origine pendant
     douze mois, puis le prix majoré. */
  function cumul(prixMensuel, mois, hausse) {
    var m = Math.floor(nombre(mois));
    var h = Number.isFinite(nombre(hausse)) ? nombre(hausse) : 0;
    if (!Number.isFinite(prixMensuel) || !Number.isFinite(m) || m <= 0) return NaN;
    if (h < -1) return NaN;
    var total = 0;
    var courant = prixMensuel;
    for (var i = 0; i < m; i++) {
      if (i > 0 && i % 12 === 0) courant = courant * (1 + h);
      total += courant;
    }
    return total;
  }

  /* Premier mois où le cumulé de l'abonnement atteint le prix de l'achat
     unique. Rend null si ce n'est pas atteint en cinquante ans — auquel cas
     l'abonnement est réellement le choix le moins cher, et la page le dit. */
  function bascule(prixMensuel, achat, hausse) {
    var a = nombre(achat);
    if (!Number.isFinite(prixMensuel) || prixMensuel <= 0) return null;
    if (!Number.isFinite(a) || a <= 0) return null;
    var total = 0;
    var courant = prixMensuel;
    for (var i = 0; i < MOIS_MAX; i++) {
      if (i > 0 && i % 12 === 0) courant = courant * (1 + (Number.isFinite(nombre(hausse)) ? nombre(hausse) : 0));
      total += courant;
      /* De l'argent se compare en centimes, pas en flottants. 9,99 additionné
         douze fois donne 119.87999999999998, ce qui n'est jamais « >= 119,88 » :
         la bascule tombait un mois trop tard sur les valeurs pile. */
      if (Math.round(total * 100) >= Math.round(a * 100)) return i + 1;
    }
    return null;
  }

  /* --------------------------------------------------------- présentation */

  function euros(n) {
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /* « 14 mois » est exact mais ne parle pas. « 1 an et 2 mois » parle. */
  function duree(mois) {
    if (!Number.isFinite(mois) || mois <= 0) return '—';
    var m = Math.round(mois);
    var ans = Math.floor(m / 12);
    var reste = m % 12;
    var bouts = [];
    if (ans) bouts.push(ans + (ans > 1 ? ' ans' : ' an'));
    if (reste) bouts.push(reste + ' mois');
    return bouts.join(' et ') || '0 mois';
  }

  /* ----------------------------------------------------------------- page */

  function boot() {
    var $ = function (id) { return document.getElementById(id); };
    var form = $('calcul');
    if (!form) return;

    var theme = $('theme-toggle');
    if (theme) {
      var saved = null;
      try { saved = localStorage.getItem('vraiprix.theme'); } catch (e) {}
      if (saved) document.documentElement.setAttribute('data-theme', saved);
      theme.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var suiv = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', suiv);
        try { localStorage.setItem('vraiprix.theme', suiv); } catch (e) {}
      });
    }

    function rendre() {
      var erreur = $('erreur');
      var resultat = $('resultat');
      var mensuel = coutMensuel($('prix').value, $('cycle').value);

      if (!Number.isFinite(mensuel) || mensuel <= 0) {
        resultat.hidden = true;
        erreur.hidden = $('prix').value.trim() === '';
        erreur.textContent = 'Entrez un prix supérieur à zéro.';
        return;
      }
      erreur.hidden = true;
      resultat.hidden = false;

      var hausse = nombre($('hausse').value) / 100;
      if (!Number.isFinite(hausse)) hausse = 0;

      $('mensuel').textContent = euros(mensuel);
      [1, 3, 5].forEach(function (ans) {
        $('somme' + ans).textContent = euros(cumul(mensuel, ans * 12, hausse));
      });

      var achat = nombre($('achat').value);
      var bloc = $('bascule');
      if (!Number.isFinite(achat) || achat <= 0) { bloc.hidden = true; return; }
      bloc.hidden = false;

      var m = bascule(mensuel, achat, hausse);
      if (m === null) {
        bloc.classList.add('is-good');
        $('bascule-texte').innerHTML = 'Au rythme indiqué, l’abonnement ne rattrape pas '
          + euros(achat) + ' avant cinquante ans. Sur cette durée, c’est lui le moins cher.';
      } else {
        bloc.classList.remove('is-good');
        $('bascule-texte').innerHTML = 'L’abonnement dépasse l’achat unique au bout de '
          + '<span class="cle">' + duree(m) + '</span>. Passé ce point, tout ce que vous payez '
          + 'est en plus de ce qu’aurait coûté l’achat.';
      }
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); rendre(); });
    ['prix', 'cycle', 'hausse', 'achat'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', rendre);
      if (el && el.tagName === 'SELECT') el.addEventListener('change', rendre);
    });
  }

  return {
    CYCLES: CYCLES, JOURS_PAR_MOIS: JOURS_PAR_MOIS, MOIS_MAX: MOIS_MAX,
    coutMensuel: coutMensuel, cumul: cumul, bascule: bascule,
    euros: euros, duree: duree, boot: boot
  };
});
