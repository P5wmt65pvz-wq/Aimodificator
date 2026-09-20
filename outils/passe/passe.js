/*!
 * Passe — la résistance d'un mot de passe, calculée hors ligne, raisonnement affiché.
 *
 * Le mot de passe saisi ne quitte jamais l'appareil : il n'est envoyé nulle
 * part, il n'est pas enregistré, et il disparaît au rechargement de la page.
 * Ce n'est pas une promesse commerciale — il n'y a aucun serveur pour le
 * recevoir. Tout le calcul ci-dessous tourne dans le navigateur.
 *
 * Le principe : un mot de passe ne vaut pas sa longueur, il vaut le nombre
 * d'essais qu'il impose. « Motdepasse2024! » fait quinze caractères et tombe
 * presque tout de suite, parce qu'un attaquant n'essaie pas les caractères un
 * par un : il essaie des mots, des dates, des motifs de clavier.
 *
 * L'estimation est donc volontairement PESSIMISTE. Elle suppose que
 * l'attaquant connaît tous les motifs détectés ici et commence par eux. Un
 * attaquant réel mettra souvent plus de temps, rarement moins.
 */
(function (root, factory) {
  var mots = (typeof module === 'object' && module.exports)
    ? require('./mots.js')
    : root.PasseMots;
  var api = factory(mots);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Passe = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PasseMots) {
  'use strict';

  var MOTS = (PasseMots && PasseMots.MOTS) || [];

  /* Index de recherche : un objet est bien plus rapide qu'un indexOf sur mille
     entrées, et l'analyse tourne à chaque frappe. */
  var DICO = Object.create(null);
  for (var iM = 0; iM < MOTS.length; iM++) DICO[MOTS[iM]] = true;

  /* Mots anglais très courants dans les mots de passe français. La liste est
     courte et assumée comme telle : elle n'a pas vocation à être exhaustive,
     seulement à empêcher qu'un mot anglais évident passe pour aléatoire. */
  var ANGLAIS = ('love hate life death dream star sun moon fire water earth ' +
    'king queen lord master money power black white blue green red gold ' +
    'silver dragon tiger eagle wolf bear shadow angel devil heaven hell ' +
    'music dance happy lucky magic super hyper mega ultra alpha omega ' +
    'password secret private hidden access login admin user guest root ' +
    'summer winter spring autumn night light dark storm cloud rain snow ' +
    'house home family friend baby girl boy man woman child school work ' +
    'game play win lose team sport football soccer hello world test ' +
    'computer internet online mobile phone email please thanks welcome').split(' ');
  for (var iA = 0; iA < ANGLAIS.length; iA++) DICO[ANGLAIS[iA]] = true;

  /* Mots ajoutés pour la DÉTECTION seulement. La liste de génération est
     bornée à 4-9 lettres sans accent parce qu'une phrase de passe doit se
     retaper sans faute ; reconnaître un mot déjà écrit n'a pas cette
     contrainte. On y met donc ce que la première ne peut pas contenir : mots
     très courants trop courts ou trop longs, prénoms, mots du quotidien
     numérique. Un mot manquant ici fait surestimer la force — jamais
     l'inverse. */
  var DETECTION = ('troubadour anniversaire ordinateur telephone portable ' +
    'appartement gouvernement administration information organisation ' +
    'developpement environnement etablissement enseignement changement ' +
    'connexion identifiant utilisateur motdepasse bienvenue entreprise ' +
    'universite bibliotheque restaurant television photographie ' +
    'roi toi moi lui eux mer sel feu jeu vie ami eau air ' +
    'chat chien ours loup lion aigle tigre singe ' +
    'papa maman mamie papi tonton tata fille garcon ' +
    'alexandre antoine arthur baptiste benjamin bernard bertrand ' +
    'catherine charlotte christian christophe clement corentin ' +
    'damien david dominique dorian edouard emilie etienne ' +
    'fabien fabrice florent francois frederic gabriel gerard ' +
    'guillaume gregory hugo isabelle jacques jerome jonathan ' +
    'josephine juliette laurent leonie ludovic manon marie ' +
    'martin mathieu mathilde mickael morgane nathalie nathan ' +
    'olivier pascal patrick philippe pierre quentin raphael ' +
    'romain sandrine sebastien severine stephane sylvie valentin ' +
    'vincent virginie william yannick lucas emma louise jules ' +
    'correct horse battery staple letmein qwerty azerty ' +
    'chocolat vacances voiture maison jardin cuisine famille ' +
    'liberte egalite fraternite marseillaise napoleon ' +
    'footballeur basketball handball natation cyclisme ' +
    'janvier fevrier mars avril juin juillet aout septembre ' +
    'octobre novembre decembre lundi mardi mercredi jeudi ' +
    'vendredi samedi dimanche printemps ete automne hiver').split(' ');
  for (var iD = 0; iD < DETECTION.length; iD++) {
    if (DETECTION[iD].length >= 3) DICO[DETECTION[iD]] = true;
  }

  var TAILLE_DICO = Object.keys(DICO).length;

  /* Mots de passe très répandus, du plus au moins attendu dans l'ordre où ils
     sont écrits. Le rang sert directement de coût : s'il est en deuxième
     position, il tombe au deuxième essai.

     Cette liste ne prétend PAS être « le classement officiel des mots de passe
     les plus utilisés ». Elle rassemble des suites que tout outil d'attaque
     essaie d'emblée. Sa taille exacte est affichée sur la page. */
  var COURANTS = ('123456 password 123456789 12345678 12345 azerty qwerty ' +
    '123456789 motdepasse 1234567890 111111 000000 iloveyou admin welcome ' +
    'monkey dragon letmein football abc123 123123 qwerty123 azerty123 ' +
    'password1 password123 motdepasse1 soleil bonjour chouchou doudou ' +
    'nicolas julien camille marine sophie thomas maxime chocolat liverpool ' +
    'princess sunshine superman batman pokemon naruto starwars ' +
    'loulou coucou salut bisous amour toto titi tata jetaime ' +
    'marseille paris france lyon bordeaux toulouse nantes ' +
    'azertyuiop qwertyuiop 1qaz2wsx qazwsx zaq12wsx ' +
    'trustno1 whatever shadow master hunter killer ninja ' +
    'samsung google apple iphone android ' +
    'aaaaaa abcdef abcd1234 a1b2c3 12341234 147258369 ' +
    'anonymous computer internet chelsea arsenal barcelona ' +
    'soleil123 cheval chaton minou bebe maman papa ' +
    'jesus jordan michael michelle jennifer charlie daniel ' +
    'baseball dolphin cookie chocolate secret freedom').split(' ');
  var RANG = Object.create(null);
  for (var iC = 0; iC < COURANTS.length; iC++) {
    if (RANG[COURANTS[iC]] === undefined) RANG[COURANTS[iC]] = Object.keys(RANG).length + 1;
  }
  var TAILLE_COURANTS = Object.keys(RANG).length;

  /* Rangées de clavier. Un mot de passe « azerty » ou « 1234 » n'est pas
     aléatoire : c'est un déplacement sur le clavier. */
  var RANGEES = [
    '1234567890', 'azertyuiop', 'qsdfghjklm', 'wxcvbn',       /* AZERTY */
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm'                      /* QWERTY */
  ];
  var TOUCHES_CLAVIER = 40; /* ordre de grandeur des touches d'une frappe utile */

  /* Substitutions « leet ». Plusieurs sont AMBIGUËS : « 1 » peut remplacer un
     « l » comme un « i ». Ne tester qu'une lecture laissait passer
     « Ju1llet », lu « julllet », qui n'est dans aucun dictionnaire. On essaie
     donc toutes les lectures, dans une limite fixe pour rester instantané. */
  var LEET = { '4': ['a'], '@': ['a'], '8': ['b'], '(': ['c'], '3': ['e'],
    '6': ['g'], '1': ['l', 'i'], '!': ['i', 'l'], '|': ['l', 'i'],
    '0': ['o'], '9': ['g', 'q'], '5': ['s'], '$': ['s'], '7': ['t'],
    '+': ['t'], '2': ['z'] };
  var MAX_LECTURES = 64;

  /* ---------------------------------------------------- jeux de caractères */

  var JEUX = [
    { cle: 'minuscules', taille: 26, test: /[a-z]/, nom: 'minuscules' },
    { cle: 'majuscules', taille: 26, test: /[A-Z]/, nom: 'majuscules' },
    { cle: 'chiffres', taille: 10, test: /[0-9]/, nom: 'chiffres' },
    { cle: 'symboles', taille: 33, test: /[^a-zA-Z0-9À-ɏ]/, nom: 'symboles' },
    { cle: 'accents', taille: 40, test: /[À-ɏ]/, nom: 'lettres accentuées' }
  ];

  function jeuxPresents(mdp) {
    var out = [];
    for (var i = 0; i < JEUX.length; i++) if (JEUX[i].test.test(mdp)) out.push(JEUX[i]);
    return out;
  }

  function tailleJeu(mdp) {
    var t = 0, j = jeuxPresents(mdp);
    for (var i = 0; i < j.length; i++) t += j[i].taille;
    return t || 1;
  }

  /* ------------------------------------------------------------ variations */

  /* Combien de façons de placer les majuscules d'un fragment. « Bonjour »
     coûte deux fois « bonjour » : l'attaquant essaie les deux. */
  function variantesMajuscules(frag) {
    if (!/[A-Z]/.test(frag)) return 1;
    if (/^[A-Z][^A-Z]*$/.test(frag)) return 2;   /* Première lettre */
    if (/^[^a-z]*$/.test(frag)) return 2;        /* TOUT EN MAJUSCULES */
    if (/^[^A-Z]*[A-Z]$/.test(frag)) return 2;   /* dernière lettre */
    var maj = (frag.match(/[A-Z]/g) || []).length;
    var min = frag.length - maj;
    var n = 0, k = Math.min(maj, min);
    for (var i = 0; i <= k; i++) n += combinaisons(frag.length, i);
    return Math.max(2, n);
  }

  function combinaisons(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  }

  /* Combien de façons de « leeter » un fragment. « p@ssw0rd » coûte quatre
     fois « password » : deux substitutions, chacune faite ou non. Un caractère
     ambigu compte ses lectures : « 1 » vaut trois états — chiffre, « l », « i ». */
  function variantesLeet(frag) {
    var n = 1, vu = false;
    for (var i = 0; i < frag.length; i++) {
      var opts = LEET[frag[i]];
      if (!opts) continue;
      vu = true;
      n *= (opts.length + 1);
      if (n > 4096) return 4096;
    }
    return vu ? n : 1;
  }

  /* Lecture canonique : la première possibilité de chaque caractère. */
  function deleet(frag) {
    var out = '';
    for (var i = 0; i < frag.length; i++) {
      var opts = LEET[frag[i]];
      out += opts ? opts[0] : frag[i];
    }
    return out;
  }

  /* Toutes les lectures plausibles d'un fragment, le fragment inclus. */
  function deleetVariantes(frag) {
    var sorties = [''];
    for (var i = 0; i < frag.length; i++) {
      var c = frag[i], opts = LEET[c];
      var choix = opts ? [c].concat(opts) : [c];
      var suivantes = [];
      for (var s = 0; s < sorties.length; s++) {
        for (var k = 0; k < choix.length; k++) {
          suivantes.push(sorties[s] + choix[k]);
          if (suivantes.length >= MAX_LECTURES) break;
        }
        if (suivantes.length >= MAX_LECTURES) break;
      }
      sorties = suivantes;
    }
    return sorties;
  }

  /* Première lecture d'un fragment présente dans « table », ou null. */
  function lectureConnue(frag, table) {
    var v = deleetVariantes(frag);
    for (var i = 0; i < v.length; i++) if (table[v[i]] !== undefined) return v[i];
    return null;
  }

  /* ------------------------------------------------------------- détecteurs */

  /* Chaque détecteur renvoie des motifs { debut, fin, type, cout, detail }.
     « fin » est exclusive, comme pour slice(). */

  function motifsCourants(mdp) {
    var bas = mdp.toLowerCase(), out = [];
    for (var d = 0; d < bas.length; d++) {
      for (var f = bas.length; f > d; f--) {
        var frag = bas.slice(d, f);
        if (frag.length < 4) continue;
        var cle = lectureConnue(frag, RANG);
        if (cle === null) continue;
        var r = RANG[cle];
        var brut = mdp.slice(d, f);
        out.push({
          debut: d, fin: f, type: 'courant',
          cout: r * variantesMajuscules(brut) * variantesLeet(brut),
          detail: cle
        });
      }
    }
    return out;
  }

  function motifsDictionnaire(mdp) {
    var bas = mdp.toLowerCase(), out = [];
    for (var d = 0; d < bas.length; d++) {
      for (var f = Math.min(bas.length, d + 16); f > d + 3; f--) {
        var frag = bas.slice(d, f);
        var cle = lectureConnue(frag, DICO);
        if (cle === null) continue;
        var brut = mdp.slice(d, f);
        out.push({
          debut: d, fin: f, type: 'mot',
          cout: TAILLE_DICO * variantesMajuscules(brut) * variantesLeet(brut),
          detail: cle
        });
      }
    }
    return out;
  }

  function motifsClavier(mdp) {
    var bas = mdp.toLowerCase(), out = [];
    for (var r = 0; r < RANGEES.length; r++) {
      var rangee = RANGEES[r];
      for (var d = 0; d < bas.length; d++) {
        var sens = 0, f = d + 1;
        while (f < bas.length) {
          var a = rangee.indexOf(bas[f - 1]), b = rangee.indexOf(bas[f]);
          if (a === -1 || b === -1) break;
          var pas = b - a;
          if (pas !== 1 && pas !== -1) break;
          if (sens === 0) sens = pas;
          else if (pas !== sens) break;
          f++;
        }
        var lg = f - d;
        if (lg >= 3 && rangee.indexOf(bas[d]) !== -1) {
          out.push({
            debut: d, fin: f, type: 'clavier',
            cout: TOUCHES_CLAVIER * 2 * (lg - 1),
            detail: bas.slice(d, f)
          });
        }
      }
    }
    return out;
  }

  function motifsSuite(mdp) {
    var out = [];
    for (var d = 0; d < mdp.length; d++) {
      var sens = 0, f = d + 1;
      while (f < mdp.length) {
        var pas = mdp.charCodeAt(f) - mdp.charCodeAt(f - 1);
        if (pas !== 1 && pas !== -1) break;
        if (sens === 0) sens = pas;
        else if (pas !== sens) break;
        f++;
      }
      var lg = f - d;
      if (lg < 3) continue;
      var frag = mdp.slice(d, f);
      if (!/^[a-zA-Z]+$/.test(frag) && !/^[0-9]+$/.test(frag)) continue;
      var base = /^[0-9]+$/.test(frag) ? 10 : 26;
      out.push({
        debut: d, fin: f, type: 'suite',
        cout: base * lg * (sens < 0 ? 2 : 1),
        detail: frag
      });
    }
    return out;
  }

  function motifsRepetition(mdp) {
    var out = [];
    for (var taille = 1; taille <= Math.floor(mdp.length / 2); taille++) {
      for (var d = 0; d + taille * 2 <= mdp.length; d++) {
        var unite = mdp.slice(d, d + taille), n = 1, f = d + taille;
        while (f + taille <= mdp.length && mdp.slice(f, f + taille) === unite) { n++; f += taille; }
        if (n < 2) continue;
        if (f - d < 3) continue;
        out.push({
          debut: d, fin: f, type: 'repetition',
          cout: Math.pow(tailleJeu(unite), unite.length) * n,
          detail: unite + ' ×' + n
        });
      }
    }
    return out;
  }

  function motifsDate(mdp) {
    var out = [];
    /* Année sur quatre chiffres. 1900-2099 : deux cents possibilités. */
    var re = /(19|20)\d\d/g, m;
    while ((m = re.exec(mdp)) !== null) {
      out.push({ debut: m.index, fin: m.index + 4, type: 'date', cout: 200, detail: m[0] });
      re.lastIndex = m.index + 1;
    }
    /* Date complète : un jour, un mois, une année sur deux ou quatre chiffres. */
    var re2 = /(3[01]|[12]\d|0?[1-9])[\/.\-]?(1[0-2]|0?[1-9])[\/.\-]?((?:19|20)?\d\d)/g;
    while ((m = re2.exec(mdp)) !== null) {
      if (m[0].length < 6) { re2.lastIndex = m.index + 1; continue; }
      out.push({
        debut: m.index, fin: m.index + m[0].length, type: 'date',
        cout: 365 * (m[3].length === 4 ? 200 : 100), detail: m[0]
      });
      re2.lastIndex = m.index + 1;
    }
    return out;
  }

  function tousMotifs(mdp) {
    return motifsCourants(mdp)
      .concat(motifsDictionnaire(mdp))
      .concat(motifsClavier(mdp))
      .concat(motifsSuite(mdp))
      .concat(motifsRepetition(mdp))
      .concat(motifsDate(mdp));
  }

  /* ------------------------------------------------------- couverture la moins chère */

  /* Programmation dynamique : pour chaque préfixe, le plus petit nombre
     d'essais qui suffit à le couvrir. On prend toujours le chemin le moins
     cher, c'est-à-dire le plus favorable à l'attaquant. */
  function couverture(mdp) {
    var n = mdp.length, jeu = tailleJeu(mdp);
    var motifs = tousMotifs(mdp);
    var parFin = [];
    for (var i = 0; i <= n; i++) parFin.push([]);
    for (var k = 0; k < motifs.length; k++) parFin[motifs[k].fin].push(motifs[k]);

    var best = [1], via = [null];
    for (var f = 1; f <= n; f++) {
      var meilleur = best[f - 1] * jeu;
      var choix = { debut: f - 1, fin: f, type: 'brut', cout: jeu, detail: mdp[f - 1] };
      var cands = parFin[f];
      for (var c = 0; c < cands.length; c++) {
        var cand = cands[c];
        var total = best[cand.debut] * cand.cout;
        if (total < meilleur) { meilleur = total; choix = cand; }
      }
      best.push(meilleur);
      via.push(choix);
    }

    var suite = [], pos = n;
    while (pos > 0) { suite.unshift(via[pos]); pos = via[pos].debut; }
    return { essais: best[n], morceaux: suite };
  }

  /* ------------------------------------------------------------ hypothèses */

  /* Ces vitesses sont des HYPOTHÈSES DE CALCUL, pas des mesures. La vitesse
     réelle dépend du matériel de l'attaquant et de la façon dont le site
     range les mots de passe — deux choses qu'on ne peut pas connaître de
     l'extérieur. Elles sont affichées sur la page et modifiables, pour que le
     lecteur voie de quoi dépend le résultat. */
  var HYPOTHESES = {
    enligne: { vitesse: 10, nom: 'Service qui limite les tentatives',
      note: 'Un site qui bloque après quelques essais ratés. Le cas d’un compte en ligne bien protégé.' },
    lent: { vitesse: 1e4, nom: 'Vol de base de données, rangement lent',
      note: 'Le site s’est fait voler sa base, mais il rangeait les mots de passe avec une fonction lente, conçue pour ça.' },
    rapide: { vitesse: 1e10, nom: 'Vol de base de données, rangement rapide',
      note: 'Même vol, mais le site utilisait une fonction rapide, inadaptée aux mots de passe. C’est le pire cas courant.' }
  };

  /* En moyenne, la moitié de l'espace suffit. */
  function secondes(essais, vitesse) { return (essais / 2) / vitesse; }

  /* Les trois délais d'un même nombre d'essais, un par hypothèse. Sert à la
     fois à l'analyse et au générateur, pour que les deux panneaux ne puissent
     pas afficher des durées calculées différemment. */
  function delaisPour(essais) {
    return Object.keys(HYPOTHESES).map(function (c) {
      return { cle: c, nom: HYPOTHESES[c].nom, note: HYPOTHESES[c].note,
        duree: duree(secondes(essais, HYPOTHESES[c].vitesse)) };
    });
  }

  var UNITES = [
    { s: 1, n: 1, un: 'seconde', pl: 'secondes' },
    { s: 60, n: 60, un: 'minute', pl: 'minutes' },
    { s: 3600, n: 3600, un: 'heure', pl: 'heures' },
    { s: 86400, n: 86400, un: 'jour', pl: 'jours' },
    { s: 2629800, n: 2629800, un: 'mois', pl: 'mois' },
    { s: 31557600, n: 31557600, un: 'an', pl: 'ans' }
  ];

  function duree(sec) {
    if (!isFinite(sec)) return 'au-delà de toute échelle';
    if (sec < 1) return 'moins d’une seconde';
    for (var i = UNITES.length - 1; i >= 0; i--) {
      if (sec >= UNITES[i].s) {
        var v = sec / UNITES[i].n;
        if (UNITES[i].un === 'an') {
          if (v >= 1e12) return 'plus de mille milliards d’années';
          if (v >= 1e9) return Math.round(v / 1e9) + ' milliards d’années';
          if (v >= 1e6) return Math.round(v / 1e6) + ' millions d’années';
          if (v >= 1e3) return Math.round(v / 1e3) + ' milliers d’années';
        }
        var r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
        /* Virgule décimale : on écrit « 4,2 heures », pas « 4.2 heures ». */
        return String(r).replace('.', ',') + ' ' + (r > 1 ? UNITES[i].pl : UNITES[i].un);
      }
    }
    return 'moins d’une seconde';
  }

  /* Le verdict découle du temps affiché, pas d'un barème posé d'avance : il
     change si l'hypothèse change, et le lecteur voit pourquoi. */
  var NIVEAUX = ['Très faible', 'Faible', 'Moyen', 'Solide', 'Très solide'];

  function niveau(sec) {
    if (sec < 60) return 0;
    if (sec < 86400) return 1;
    if (sec < 31557600) return 2;
    if (sec < 31557600 * 1000) return 3;
    return 4;
  }

  /* --------------------------------------------------------------- analyse */

  var LONGUEUR_MAX = 128;

  function analyser(mdp, cleHypothese) {
    mdp = typeof mdp === 'string' ? mdp.slice(0, LONGUEUR_MAX) : '';
    var hyp = HYPOTHESES[cleHypothese] || HYPOTHESES.lent;
    if (!mdp) {
      return { vide: true, longueur: 0, essais: 0, bits: 0, morceaux: [],
        jeux: [], secondes: 0, duree: '—', niveau: 0, verdict: '—',
        hypothese: hyp, conseils: [] };
    }
    var cov = couverture(mdp);
    var sec = secondes(cov.essais, hyp.vitesse);
    var nv = niveau(sec);
    return {
      vide: false,
      longueur: mdp.length,
      essais: cov.essais,
      bits: Math.log2(cov.essais),
      bitsBruts: mdp.length * Math.log2(tailleJeu(mdp)),
      morceaux: cov.morceaux,
      jeux: jeuxPresents(mdp).map(function (j) { return j.nom; }),
      secondes: sec,
      duree: duree(sec),
      niveau: nv,
      verdict: NIVEAUX[nv],
      hypothese: hyp,
      tousLesDelais: delaisPour(cov.essais),
      conseils: conseils(mdp, cov, nv)
    };
  }

  function conseils(mdp, cov, nv) {
    var out = [], types = {};
    for (var i = 0; i < cov.morceaux.length; i++) types[cov.morceaux[i].type] = true;

    if (types.courant) out.push('Votre mot de passe contient une suite qui figure parmi les plus essayées. Elle ne coûte quasiment rien à deviner : changez-la entièrement, ne la rallongez pas.');
    if (types.mot) out.push('Un mot du dictionnaire est reconnu même déguisé en « l33t » : remplacer un « a » par « @ » ajoute un essai, pas mille.');
    if (types.clavier) out.push('Une suite de touches voisines (azerty, qsdf, 1234) n’est pas du hasard : c’est un déplacement sur le clavier, et les outils d’attaque les parcourent tous.');
    if (types.date) out.push('Une année ou une date de naissance ne vaut que quelques centaines d’essais — et elle est souvent publique.');
    if (types.repetition) out.push('Répéter un motif n’allonge presque rien : « abcabcabc » coûte à peine plus que « abc ».');
    if (types.suite) out.push('Une suite ordonnée (1234, abcd, 9876) fait partie des tout premiers essais.');

    if (mdp.length < 12) out.push('En dessous de douze caractères, la longueur est le facteur qui manque le plus. C’est aussi le plus simple à corriger.');
    if (nv <= 2) out.push('Le plus efficace n’est pas d’ajouter des symboles, c’est d’allonger : une phrase de passe de cinq mots tirés au hasard bat un mot de passe court et compliqué, et se retient.');
    if (nv >= 3 && !out.length) out.push('Rien à redire sur celui-ci. Le point qui reste : ne le réutilisez nulle part ailleurs. Un mot de passe solide volé sur un site reste volé pour tous les autres.');
    out.push('Un mot de passe différent par site, gardé dans un gestionnaire, règle le problème mieux que n’importe quelle règle de complexité.');
    return out;
  }

  /* --------------------------------------------- génération de phrase de passe */

  /* Tirage sans biais. Prendre le reste d'une division (aleatoire % n) rend
     les premiers mots de la liste légèrement plus probables que les derniers ;
     sur un mot de passe, ce biais est un défaut réel. On rejette donc les
     valeurs qui tombent dans la zone qui déborde, et on retire. */
  function entier(n) {
    var src = (typeof globalThis !== 'undefined' && globalThis.crypto &&
      globalThis.crypto.getRandomValues) ? globalThis.crypto : null;
    if (!src) throw new Error('Générateur aléatoire sûr indisponible dans ce navigateur.');
    var limite = Math.floor(4294967296 / n) * n;
    var buf = new Uint32Array(1);
    for (var essais = 0; essais < 1000; essais++) {
      src.getRandomValues(buf);
      if (buf[0] < limite) return buf[0] % n;
    }
    throw new Error('Tirage aléatoire impossible.');
  }

  function genererPhrase(nbMots, options) {
    options = options || {};
    nbMots = Math.max(3, Math.min(12, Math.floor(nbMots) || 6));
    if (!MOTS.length) throw new Error('Liste de mots vide.');

    var choisis = [];
    for (var i = 0; i < nbMots; i++) choisis.push(MOTS[entier(MOTS.length)]);

    var bits = nbMots * Math.log2(MOTS.length);
    var sortie = choisis.slice();

    if (options.majuscule) {
      var q = entier(nbMots);
      sortie[q] = sortie[q].charAt(0).toUpperCase() + sortie[q].slice(1);
      bits += Math.log2(nbMots);
    }
    if (options.chiffre) {
      var p = entier(nbMots);
      sortie[p] = sortie[p] + String(entier(10));
      bits += Math.log2(nbMots * 10);
    }

    var sep = typeof options.separateur === 'string' ? options.separateur : '-';
    /* Ici, et seulement ici, l'entropie est EXACTE : elle vient du tirage,
       pas d'une estimation. L'analyseur du haut de page, lui, ne sait pas
       d'où viennent les mots et se montre trop généreux avec une phrase
       fabriquée ici. C'est ce chiffre-ci qui fait foi. */
    return {
      phrase: sortie.join(sep),
      mots: choisis,
      nbMots: nbMots,
      bits: bits,
      essais: Math.pow(2, bits),
      delais: delaisPour(Math.pow(2, bits)),
      tailleListe: MOTS.length,
      bitsParMot: Math.log2(MOTS.length)
    };
  }

  /* ------------------------------------------------------------------- DOM */

  function $(s) { return document.querySelector(s); }
  function creer(t, c, txt) {
    var e = document.createElement(t);
    if (c) e.className = c;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  var ETIQUETTES = {
    courant: 'très répandu', mot: 'mot connu', clavier: 'suite de clavier',
    suite: 'suite ordonnée', repetition: 'répétition', date: 'date', brut: 'imprévisible'
  };

  /* Le thème est la SEULE chose que cette page écrit sur l'appareil. Le mot
     de passe saisi n'est jamais enregistré, nulle part. */
  function bindTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem('passe.theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) cur = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      var suiv = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', suiv);
      try { localStorage.setItem('passe.theme', suiv); } catch (e) {}
    });
  }

  function demarrer() {
    bindTheme();
    var champ = $('#mdp');
    if (!champ) return;

    var res = $('#resultat');
    var jauge = $('#jauge-barre');
    var verdict = $('#verdict');
    var delai = $('#delai');
    var bits = $('#bits');
    var decoupe = $('#decoupe');
    var listeConseils = $('#conseils');
    var tableau = $('#delais');
    var choixHyp = $('#hypothese');
    var noteHyp = $('#note-hypothese');

    function rendre() {
      var a = analyser(champ.value, choixHyp ? choixHyp.value : 'lent');
      res.hidden = a.vide;
      if (noteHyp) noteHyp.textContent = a.hypothese.note;
      if (a.vide) return;

      jauge.style.width = ((a.niveau + 1) / 5 * 100) + '%';
      jauge.className = 'jauge-barre n' + a.niveau;
      verdict.textContent = a.verdict;
      verdict.className = 'verdict n' + a.niveau;
      delai.textContent = a.duree;
      bits.textContent = a.bits.toFixed(1).replace('.', ',') + ' bits · '
        + a.longueur + ' caractère' + (a.longueur > 1 ? 's' : '') + ' · '
        + a.jeux.join(', ');

      decoupe.textContent = '';
      for (var i = 0; i < a.morceaux.length; i++) {
        var m = a.morceaux[i];
        var span = creer('span', 'morceau t-' + m.type);
        span.textContent = '•'.repeat(m.fin - m.debut);
        span.title = ETIQUETTES[m.type] + (m.type !== 'brut' ? ' : ' + m.detail : '');
        var lab = creer('span', 'etiq', ETIQUETTES[m.type]);
        var bloc = creer('span', 'bloc');
        bloc.appendChild(span);
        bloc.appendChild(lab);
        decoupe.appendChild(bloc);
      }

      listeConseils.textContent = '';
      for (var c = 0; c < a.conseils.length; c++) {
        listeConseils.appendChild(creer('li', null, a.conseils[c]));
      }

      tableau.textContent = '';
      for (var d = 0; d < a.tousLesDelais.length; d++) {
        var t = a.tousLesDelais[d];
        var tr = creer('tr');
        tr.appendChild(creer('th', null, t.nom));
        tr.appendChild(creer('td', null, t.duree));
        if (choixHyp && t.cle === choixHyp.value) tr.className = 'actif';
        tableau.appendChild(tr);
      }
    }

    champ.addEventListener('input', rendre);
    if (choixHyp) choixHyp.addEventListener('change', rendre);

    var voir = $('#voir');
    if (voir) voir.addEventListener('click', function () {
      var cache = champ.type === 'password';
      champ.type = cache ? 'text' : 'password';
      voir.textContent = cache ? 'Masquer' : 'Afficher';
      voir.setAttribute('aria-pressed', cache ? 'true' : 'false');
    });

    var vider = $('#vider');
    if (vider) vider.addEventListener('click', function () {
      champ.value = '';
      rendre();
      champ.focus();
    });

    /* ----- générateur ----- */
    var bouton = $('#generer');
    var sortie = $('#phrase');
    var infoPhrase = $('#info-phrase');
    var copier = $('#copier');
    var delaisPhrase = $('#delais-phrase');

    function tirer() {
      try {
        var p = genererPhrase(Number($('#nb-mots').value),
          { majuscule: $('#opt-maj').checked, chiffre: $('#opt-chiffre').checked });
        sortie.value = p.phrase;
        infoPhrase.textContent = p.bits.toFixed(1).replace('.', ',')
          + ' bits — ' + p.nbMots + ' mots tirés au sort dans une liste de '
          + p.tailleListe + ', soit ' + p.bitsParMot.toFixed(2).replace('.', ',')
          + ' bits par mot.';
        if (copier) { copier.hidden = false; copier.textContent = 'Copier'; }
        if (delaisPhrase) {
          delaisPhrase.textContent = '';
          for (var d = 0; d < p.delais.length; d++) {
            var tr = creer('tr');
            tr.appendChild(creer('th', null, p.delais[d].nom));
            tr.appendChild(creer('td', null, p.delais[d].duree));
            delaisPhrase.appendChild(tr);
          }
        }
      } catch (e) {
        infoPhrase.textContent = e.message;
        sortie.value = '';
        if (delaisPhrase) delaisPhrase.textContent = '';
      }
    }

    if (bouton) bouton.addEventListener('click', tirer);
    if (copier) copier.addEventListener('click', function () {
      if (!sortie.value) return;
      var fini = function () { copier.textContent = 'Copié'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sortie.value).then(fini, function () {
          copier.textContent = 'Copie refusée';
        });
      } else {
        sortie.select();
        try { document.execCommand('copy'); fini(); }
        catch (e) { copier.textContent = 'Copie refusée'; }
      }
    });

    var cible = $('#taille-liste');
    if (cible) cible.textContent = String(MOTS.length);
    var cibleC = $('#taille-courants');
    if (cibleC) cibleC.textContent = String(TAILLE_COURANTS);

    rendre();
  }

  function boot() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
    else demarrer();
  }

  return {
    MOTS: MOTS, DICO: DICO, DETECTION: DETECTION, COURANTS: COURANTS, RANG: RANG,
    TAILLE_DICO: TAILLE_DICO, TAILLE_COURANTS: TAILLE_COURANTS,
    HYPOTHESES: HYPOTHESES, NIVEAUX: NIVEAUX, LONGUEUR_MAX: LONGUEUR_MAX,
    jeuxPresents: jeuxPresents, tailleJeu: tailleJeu,
    variantesMajuscules: variantesMajuscules, variantesLeet: variantesLeet,
    deleet: deleet, deleetVariantes: deleetVariantes, lectureConnue: lectureConnue,
    motifsCourants: motifsCourants, motifsDictionnaire: motifsDictionnaire,
    motifsClavier: motifsClavier, motifsSuite: motifsSuite,
    motifsRepetition: motifsRepetition, motifsDate: motifsDate,
    couverture: couverture, secondes: secondes, delaisPour: delaisPour,
    duree: duree, niveau: niveau,
    analyser: analyser, genererPhrase: genererPhrase, entier: entier,
    boot: boot
  };
});
