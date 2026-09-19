/*!
 * PromptForge — liste de diffusion.
 *
 * Il n'y a pas de serveur pour recevoir un formulaire, et la règle 3 du dépôt
 * interdit toute requête réseau après le chargement. L'inscription passe donc
 * par un simple lien mailto:, complété par l'adresse affichée en clair pour
 * les visiteurs sans logiciel de messagerie.
 *
 * SERVICE est prévu pour le jour où un service d'inscription serait branché.
 * Il est volontairement vide : le brancher exigerait une requête réseau, donc
 * une modification de la règle 3. Ce n'est pas une décision de code.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.liste = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Adresse dédiée au projet. Affichée publiquement, donc jamais une adresse
     personnelle : si elle croule sous le spam, elle se remplace ici sans rien
     casser d'autre. */
  var ADRESSE = 'promptforge.contact@gmail.com';

  /* À remplir seulement si la règle 3 est un jour assouplie. Voir plus haut. */
  var SERVICE = '';

  /* Même règle de sûreté qu'offers.js : seules les URL https absolues sont
     acceptées, jamais un schéma javascript:, data: ou http: en clair, jamais
     une adresse d'exemple restée en place. */
  function isLive(url) {
    if (typeof url !== 'string') return false;
    var u = url.trim();
    if (!u) return false;
    if (!/^https:\/\/[^\s/$.?#][^\s]*$/i.test(u)) return false;
    return u.indexOf('exemple.') === -1 && u.indexOf('example.') === -1;
  }

  function serviceLive() {
    return isLive(SERVICE);
  }

  /* Lien d'inscription, objet pré-rempli pour que le message soit
     reconnaissable sans avoir à le lire. */
  function mailto(lang) {
    var sujet = lang === 'en' ? 'Subscribe to the list' : 'Inscription à la liste';
    return 'mailto:' + ADRESSE + '?subject=' + encodeURIComponent(sujet);
  }

  return {
    ADRESSE: ADRESSE,
    SERVICE: SERVICE,
    isLive: isLive,
    serviceLive: serviceLive,
    mailto: mailto
  };
});
