/*!
 * PromptForge — offres payantes.
 *
 * TOUT SE CONFIGURE ICI. Chaque offre attend une URL de paiement que vous créez
 * chez votre prestataire (Stripe Payment Link, Ko-fi, Gumroad, GitHub Sponsors…).
 * Collez-la dans « url ». Voir MONETISATION.md pour la marche à suivre.
 *
 * Règle de sûreté : une offre sans URL https valide n'est JAMAIS affichée aux
 * visiteurs. Le site ne peut donc pas partir en ligne avec un bouton mort.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PF = root.PF || {};
  root.PF.offers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ----------------------------------------------------------- à remplir */

  var OFFERS = [
    {
      id: 'support',
      icon: '☕',
      url: '',                       /* ex. https://buymeacoffee.com/votrenom */
      price: { fr: 'au choix', en: 'name your price' },
      title: { fr: 'Soutenir PromptForge', en: 'Support PromptForge' },
      desc: {
        fr: 'L\'outil est gratuit, sans compte et sans traceur, et le restera. Si vous l\'utilisez souvent, un pourboire finance les prochains domaines et modèles.',
        en: 'The tool is free, account-free and tracker-free, and will stay that way. If you use it often, a tip funds the next domains and templates.'
      },
      cta: { fr: 'Laisser un pourboire', en: 'Leave a tip' }
    },
    {
      id: 'pack',
      icon: '📦',
      url: '',                       /* ex. https://votrenom.gumroad.com/l/promptforge-pro */
      price: { fr: '19 €', en: '€19' },
      featured: true,
      title: { fr: 'Pack Pro — prompts prêts à vendre', en: 'Pro Pack — ready-to-sell prompts' },
      desc: {
        fr: 'Les 24 modèles du site étendus en un dossier de prompts finis, classés par métier, en français et en anglais. Fichiers .md à copier directement dans votre IA.',
        en: 'The site\'s 24 templates expanded into a folder of finished prompts, sorted by job, in French and English. .md files to paste straight into your AI.'
      },
      cta: { fr: 'Acheter le pack', en: 'Buy the pack' },
      note: {
        fr: 'Paiement et TVA gérés par le vendeur officiel (Gumroad ou Lemon Squeezy).',
        en: 'Payment and VAT handled by the merchant of record (Gumroad or Lemon Squeezy).'
      }
    },
    {
      id: 'service',
      icon: '🛠',
      url: '',                       /* ex. https://buy.stripe.com/xxxxxxxx */
      price: { fr: 'à partir de 150 €', en: 'from €150' },
      title: { fr: 'Un prompt sur-mesure', en: 'A prompt built for you' },
      desc: {
        fr: 'Vous décrivez votre cas réel — support client, rédaction, extraction de données. Vous recevez un prompt testé sur vos propres exemples, avec deux tours de correction.',
        en: 'You describe your real case — customer support, copywriting, data extraction. You get a prompt tested on your own examples, with two rounds of revision.'
      },
      cta: { fr: 'Réserver une prestation', en: 'Book the service' }
    },
    {
      id: 'sponsor',
      icon: '🌱',
      url: '',                       /* ex. https://github.com/sponsors/votrecompte */
      price: { fr: 'dès 5 €/mois', en: 'from €5/mo' },
      title: { fr: 'Sponsor mensuel', en: 'Monthly sponsor' },
      desc: {
        fr: 'Pour les entreprises qui s\'appuient sur l\'outil au quotidien. Votre logo apparaît dans cette section et dans le dépôt.',
        en: 'For companies that rely on the tool daily. Your logo appears in this section and in the repository.'
      },
      cta: { fr: 'Devenir sponsor', en: 'Become a sponsor' }
    }
  ];

  /* --------------------------------------------------------------- règles */

  /* Seules les URL https absolues sont acceptées : pas de javascript:, pas de
     data:, pas de http: en clair, pas de placeholder oublié. */
  function isLive(offer) {
    if (!offer || typeof offer.url !== 'string') return false;
    var url = offer.url.trim();
    if (!url) return false;
    if (!/^https:\/\/[^\s/$.?#][^\s]*$/i.test(url)) return false;
    return url.indexOf('exemple.') === -1 && url.indexOf('example.') === -1;
  }

  function live() {
    return OFFERS.filter(isLive);
  }

  function hasLive() {
    return live().length > 0;
  }

  /* Vrai quand le site tourne en local : sert à n'afficher le rappel de
     configuration qu'au développeur, jamais au visiteur. */
  function isLocal(hostname, protocol) {
    if (protocol === 'file:') return true;
    if (!hostname) return false;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '0.0.0.0';
  }

  return {
    list: OFFERS,
    isLive: isLive,
    live: live,
    hasLive: hasLive,
    isLocal: isLocal
  };
});
