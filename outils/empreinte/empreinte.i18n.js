/*!
 * Empreinte — tous les textes visibles, en français et en anglais.
 *
 * Séparés du moteur pour qu'une correction de logique profite aux deux langues
 * à la fois : les pages /outils/empreinte/ et /en/fingerprint/ partagent le
 * même empreinte.js et le même empreinte.css, seul le HTML diffère.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.EmpreinteI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var T = {
    verdict: {
      critical: {
        label: { fr: 'Vous êtes très probablement identifiable de façon unique.',
                 en: 'You are almost certainly identifiable as a single individual.' },
        explain: { fr: 'La combinaison de ces éléments suffit à vous reconnaître d\'un site à l\'autre, même sans cookie, même en navigation privée, même après avoir changé d\'adresse IP. C\'est exactement ce que font les régies publicitaires et les traqueurs.',
                   en: 'Together, these details are enough to recognise you from one site to the next — with no cookie, in a private window, and after changing IP address. This is exactly what advertising networks and trackers do.' }
      },
      serious: {
        label: { fr: 'Vous êtes reconnaissable dans un groupe restreint.',
                 en: 'You stand out within a small group.' },
        explain: { fr: 'Vous ne sortez pas complètement du lot, mais assez de signaux vous distinguent pour qu\'un recoupement sur plusieurs visites permette de vous suivre.',
                   en: 'You are not fully unique, but enough signals single you out that matching them across several visits is enough to follow you.' }
      },
      warning: {
        label: { fr: 'Empreinte modérée — vous vous fondez partiellement dans la masse.',
                 en: 'Moderate fingerprint — you partly blend into the crowd.' },
        explain: { fr: 'Une partie des signaux les plus révélateurs est bloquée ou indisponible. Vous restez suivable, mais avec nettement moins de fiabilité.',
                   en: 'Some of the most revealing signals are blocked or unavailable. You can still be followed, but far less reliably.' }
      },
      good: {
        label: { fr: 'Empreinte faible — vous ressemblez à beaucoup de monde.',
                 en: 'Low fingerprint — you look like a lot of other people.' },
        explain: { fr: 'Les signaux les plus identifiants sont indisponibles ou neutralisés. C\'est le comportement d\'un navigateur qui résiste au pistage.',
                   en: 'The most identifying signals are unavailable or neutralised. This is how a browser that resists tracking behaves.' }
      }
    },

    level: {
      high: { fr: 'très révélateur', en: 'highly revealing' },
      mid:  { fr: 'révélateur', en: 'revealing' },
      low:  { fr: 'peu révélateur', en: 'mildly revealing' },
      safe: { fr: 'protégé', en: 'protected' }
    },

    f: {
      canvas: {
        t: { fr: 'Empreinte de rendu graphique (canvas)', en: 'Graphics rendering fingerprint (canvas)' },
        suffix: { fr: ' — identifiant dérivé du rendu', en: ' — identifier derived from the rendering' },
        off: { fr: 'Bloquée ou indisponible', en: 'Blocked or unavailable' },
        nOn: { fr: 'Votre machine dessine un texte de façon très légèrement différente des autres, à cause du système, des pilotes et des polices. Le résultat sert d\'identifiant. C\'est l\'un des signaux les plus utilisés par les traqueurs, et il survit à la navigation privée.',
               en: 'Your machine draws text very slightly differently from every other, because of the operating system, the drivers and the fonts. The result works as an identifier. It is one of the signals trackers rely on most, and it survives private browsing.' },
        nOff: { fr: 'Votre navigateur bloque cette lecture ou renvoie un résultat brouillé. C\'est une bonne nouvelle : c\'est le signal le plus identifiant.',
                en: 'Your browser blocks this reading or returns a scrambled result. That is good news: this is the single most identifying signal.' }
      },
      fonts: {
        t: { fr: 'Polices installées', en: 'Installed fonts' },
        count: { fr: ' détectées : ', en: ' detected: ' },
        none: { fr: 'Aucune détectée', en: 'None detected' },
        nOn: { fr: 'La liste exacte des polices de votre machine est presque une signature : elle dépend de votre système, des logiciels installés, de votre langue. Peu de gens ont exactement la même.',
               en: 'The exact list of fonts on your machine is close to a signature: it depends on your operating system, the software you installed and your language. Few people have exactly the same one.' },
        nOff: { fr: 'Peu de polices détectables, ce qui rend ce signal peu utile pour vous distinguer.',
                en: 'Few fonts are detectable, which makes this signal of little use in telling you apart.' }
      },
      webgl: {
        t: { fr: 'Carte graphique', en: 'Graphics card' },
        off: { fr: 'Masquée ou indisponible', en: 'Hidden or unavailable' },
        nOn: { fr: 'Le modèle exact de votre carte graphique est lisible. Combiné au système et à la résolution, cela restreint fortement le nombre de personnes correspondantes.',
               en: 'The exact model of your graphics card is readable. Combined with your operating system and screen resolution, it sharply narrows the number of matching people.' },
        nOff: { fr: 'Le modèle de votre carte graphique n\'est pas exposé. Un point de moins pour vous identifier.',
                en: 'Your graphics card model is not exposed. One less way to identify you.' }
      },
      ua: {
        t: { fr: 'Navigateur et système', en: 'Browser and operating system' },
        unknown: { fr: 'inconnu', en: 'unknown' },
        n: { fr: 'Envoyé à chaque requête, par construction. Version du navigateur, du système, parfois du modèle d\'appareil. Impossible à supprimer complètement, mais certains navigateurs le simplifient.',
             en: 'Sent with every request, by design. Browser version, operating system, sometimes the device model. It cannot be removed entirely, though some browsers cut it down.' }
      },
      screen: {
        t: { fr: 'Écran', en: 'Screen' },
        unknown: { fr: 'inconnu', en: 'unknown' },
        density: { fr: ' px · densité ', en: ' px · pixel ratio ' },
        bits: { fr: ' bits de couleur', en: '-bit colour' },
        n: { fr: 'La taille exacte de l\'écran et la densité de pixels forment une combinaison peu partagée, surtout sur ordinateur où les résolutions varient beaucoup.',
             en: 'Exact screen size and pixel density form a combination few people share, especially on desktop where resolutions vary widely.' }
      },
      hardware: {
        t: { fr: 'Puissance de la machine', en: 'Machine capacity' },
        cores: { fr: ' cœurs processeur', en: ' processor cores' },
        memory: { fr: ' Go de mémoire (approximatif)', en: ' GB of memory (approximate)' },
        off: { fr: 'Non exposée', en: 'Not exposed' },
        n: { fr: 'Le nombre de cœurs et la mémoire disponible sont lisibles sans permission. Pris isolément c\'est peu, combiné au reste c\'est un filtre de plus.',
             en: 'Core count and available memory are readable without asking permission. On their own they say little; combined with the rest they narrow the field further.' }
      },
      timezone: {
        t: { fr: 'Fuseau horaire', en: 'Time zone' },
        unknown: { fr: 'inconnu', en: 'unknown' },
        n: { fr: 'Révèle votre zone géographique indépendamment de votre adresse IP. Un VPN qui vous place à l\'étranger alors que votre fuseau reste français est d\'ailleurs une incohérence facilement détectable.',
             en: 'Reveals roughly where you are, independently of your IP address. A VPN that places you in another country while your time zone stays put is an inconsistency that is easy to spot.' }
      },
      lang: {
        t: { fr: 'Langues préférées', en: 'Preferred languages' },
        unknown: { fr: 'inconnu', en: 'unknown' },
        n: { fr: 'L\'ordre exact de vos langues préférées est plus révélateur qu\'il n\'y paraît : une liste inhabituelle réduit beaucoup le groupe auquel vous appartenez.',
             en: 'The exact order of your preferred languages gives away more than it seems: an unusual list shrinks the group you belong to considerably.' }
      },
      touch: {
        t: { fr: 'Type d\'appareil', en: 'Device type' },
        touch: { fr: 'Tactile (', en: 'Touch (' },
        points: { fr: ' points)', en: ' points)' },
        noTouch: { fr: 'Non tactile', en: 'Not touch' },
        platform: { fr: ' · plateforme annoncée : ', en: ' · reported platform: ' },
        unknown: { fr: 'inconnue', en: 'unknown' },
        n: { fr: 'Permet de séparer immédiatement téléphone, tablette et ordinateur.',
             en: 'Separates phone, tablet and desktop straight away.' }
      },
      conn: {
        t: { fr: 'Type de connexion', en: 'Connection type' },
        est: { fr: 'Estimée : ', en: 'Estimated: ' },
        off: { fr: 'Non exposée', en: 'Not exposed' },
        nOn: { fr: 'Votre navigateur communique une estimation de la qualité de votre connexion.',
               en: 'Your browser reports an estimate of your connection quality.' },
        nOff: { fr: 'Votre navigateur ne communique pas ce renseignement.',
                en: 'Your browser does not report this.' }
      },
      prefs: {
        t: { fr: 'Préférences d\'affichage', en: 'Display preferences' },
        dark: { fr: 'thème sombre', en: 'dark theme' },
        light: { fr: 'thème clair', en: 'light theme' },
        reduced: { fr: 'animations réduites', en: 'reduced motion' },
        contrast: { fr: 'contraste renforcé', en: 'increased contrast' },
        unknown: { fr: 'inconnues', en: 'unknown' },
        n: { fr: 'Vos réglages d\'accessibilité et d\'affichage sont lisibles. Les réglages peu courants — contraste renforcé, animations coupées — sont paradoxalement très identifiants.',
             en: 'Your display and accessibility settings are readable. Uncommon ones — increased contrast, motion turned off — are, awkwardly, among the most identifying.' }
      },
      dnt: {
        t: { fr: 'Signal de refus du pistage', en: 'Do-not-track signal' },
        gpc: { fr: 'Global Privacy Control activé', en: 'Global Privacy Control enabled' },
        dnt: { fr: 'Do Not Track activé', en: 'Do Not Track enabled' },
        none: { fr: 'Aucun signal envoyé', en: 'No signal sent' },
        nOn: { fr: 'Vous envoyez un signal demandant de ne pas être pisté. En France, le Global Privacy Control n\'oblige pas juridiquement les sites ; la plupart l\'ignorent.',
               en: 'You are sending a signal asking not to be tracked. Whether a site is legally required to honour it depends on where you live; most sites ignore it either way.' },
        nOff: { fr: 'Vous n\'envoyez aucun signal de refus. À noter : activer ce signal vous rend légèrement plus identifiable, puisque peu de gens le font.',
                en: 'You are sending no refusal signal. Worth knowing: turning one on makes you slightly more identifiable, precisely because few people do.' }
      }
    },

    advice: [
      { t: { fr: 'Installer uBlock Origin', en: 'Install uBlock Origin' },
        b: { fr: 'Un bloqueur de contenus sérieux coupe la majorité des traqueurs avant qu\'ils ne se chargent. C\'est de loin l\'action avec le meilleur rapport effort/résultat. Gratuit et libre.',
             en: 'A serious content blocker stops most trackers before they ever load. By far the best return on effort here. Free and open source.' } },
      { t: { fr: 'Utiliser un navigateur qui résiste au pistage', en: 'Use a browser that resists tracking' },
        b: { fr: 'Firefox avec la protection renforcée, Brave, ou le Navigateur Tor pour les cas sensibles. Ils brouillent l\'empreinte canvas et limitent les lectures matérielles — ce qu\'un VPN ne fait pas.',
             en: 'Firefox with strict protection, Brave, or the Tor Browser for sensitive cases. They scramble the canvas fingerprint and limit hardware readings — which a VPN does not do.' } },
      { t: { fr: 'Ne pas multiplier les extensions', en: 'Do not pile up extensions' },
        b: { fr: 'Chaque extension visible depuis la page ajoute un signal. Une combinaison rare d\'extensions vous rend plus reconnaissable, pas moins. Moins, mais mieux choisies.',
             en: 'Every extension visible from the page adds a signal. A rare combination of extensions makes you more recognisable, not less. Fewer, better chosen.' } },
      { t: { fr: 'Comprendre ce que la navigation privée ne fait pas', en: 'Understand what private browsing does not do' },
        b: { fr: 'Elle efface l\'historique et les cookies à la fermeture. Elle ne change strictement rien à votre empreinte : tout ce qui est listé plus haut reste lisible à l\'identique.',
             en: 'It clears history and cookies when you close the window. It changes nothing at all about your fingerprint: everything listed above stays exactly as readable.' } },
      { t: { fr: 'Cloisonner plutôt que cacher', en: 'Compartmentalise rather than hide' },
        b: { fr: 'Des profils de navigateur séparés — un pour les comptes personnels, un pour le reste — empêchent de relier vos activités entre elles. C\'est plus efficace que de chercher l\'invisibilité.',
             en: 'Separate browser profiles — one for personal accounts, one for everything else — stop your activities being linked together. More effective than chasing invisibility.' } }
    ]
  };

  /* Résout « f.canvas.nOn » dans la langue demandée. Renvoie la clé elle-même
     si elle manque : un texte anglais oublié se voit immédiatement à l'écran
     plutôt que de se transformer en « undefined ». */
  function t(chemin, lang) {
    var noeud = T;
    var parts = chemin.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!noeud) return chemin;
      noeud = noeud[parts[i]];
    }
    if (!noeud) return chemin;
    return noeud[lang === 'en' ? 'en' : 'fr'] || chemin;
  }

  return { T: T, t: t };
});
