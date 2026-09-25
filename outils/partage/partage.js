/*!
 * Partage — qui doit combien à qui, après des dépenses de groupe.
 *
 * Tout le calcul voyage dans le lien : la partie de l'adresse située après
 * le « # » n'est jamais transmise au serveur par le navigateur. Le site ne
 * reçoit donc ni les noms ni les montants — il n'a de toute façon aucun
 * serveur pour les recevoir.
 *
 * Tous les montants sont en CENTIMES ENTIERS. De l'argent ne se calcule pas en
 * virgule flottante : 12 × 9,99 y vaut 119,87999999999998, et une comparaison
 * à 119,88 échoue. Ce dépôt l'a déjà appris une fois.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Partage = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;
  /* Bornes du format. Elles protègent la page contre un lien fabriqué pour la
     faire ramer : tout lien qui les dépasse est refusé en entier. */
  var MAX_PERSONNES = 20;
  var MAX_NOM = 40;
  var MAX_DEPENSES = 200;
  var MAX_QUOI = 60;
  var MAX_MONTANT = 100000000;          /* un million d'euros, en centimes */
  var MAX_LIEN = 20000;

  /* ------------------------------------------------------------- saisies */

  /* « 42,50 », « 42.5 » ou « 42 » → 4250. Tout le reste → NaN : pas de
     négatif, pas de notation 1e3, pas de troisième décimale arrondie en
     silence. Un montant qu'on n'a pas compris ne doit pas être deviné. */
  function centimes(saisie) {
    if (typeof saisie !== 'string') return NaN;
    var t = saisie.trim().replace(/\s/g, '');
    var m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(t);
    if (!m) return NaN;
    var c = Number(m[1]) * 100 + (m[2] ? Number((m[2] + '0').slice(0, 2)) : 0);
    return c >= 1 && c <= MAX_MONTANT ? c : NaN;
  }

  function nomValide(n) {
    return typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= MAX_NOM;
  }

  /* -------------------------------------------------------------- calcul */

  /* Part de chacun dans une dépense. Les centimes qui ne se divisent pas vont
     aux premiers de la liste, un par un : 10,00 € à trois font 3,34 + 3,33 +
     3,33, et la somme retombe exactement sur 10,00. */
  function parts(montant, pour) {
    var n = pour.length;
    var base = Math.floor(montant / n);
    var reste = montant - base * n;
    return pour.map(function (_, k) { return base + (k < reste ? 1 : 0); });
  }

  /* Solde de chacun, en centimes : ce qu'il a payé moins ce qu'il doit.
     Positif, on lui doit de l'argent ; négatif, il en doit. La somme des
     soldes vaut toujours exactement zéro — un test le vérifie. */
  function soldes(etat) {
    var s = etat.noms.map(function () { return 0; });
    etat.depenses.forEach(function (d) {
      s[d.payeur] += d.montant;
      parts(d.montant, d.pour).forEach(function (p, k) { s[d.pour[k]] -= p; });
    });
    return s;
  }

  /* Qui rembourse qui. Le plus gros débiteur rembourse le plus gros créancier,
     et ainsi de suite : chaque virement solde au moins une personne, donc il y
     en a au plus une de moins que de membres du groupe. */
  function remboursements(s) {
    var cred = [], deb = [];
    s.forEach(function (v, i) {
      if (v > 0) cred.push({ i: i, v: v });
      else if (v < 0) deb.push({ i: i, v: -v });
    });
    var ordre = function (x, y) { return y.v - x.v || x.i - y.i; };
    cred.sort(ordre); deb.sort(ordre);
    var out = [], a = 0, b = 0;
    while (a < deb.length && b < cred.length) {
      var m = Math.min(deb[a].v, cred[b].v);
      out.push({ de: deb[a].i, a: cred[b].i, montant: m });
      deb[a].v -= m; cred[b].v -= m;
      if (deb[a].v === 0) a++;
      if (cred[b].v === 0) b++;
    }
    return out;
  }

  function total(etat) {
    return etat.depenses.reduce(function (t, d) { return t + d.montant; }, 0);
  }

  /* ---------------------------------------------------------------- lien */

  function versB64url(str) {
    var octets = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < octets.length; i++) bin += String.fromCharCode(octets[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function depuisB64url(s) {
    if (typeof s !== 'string' || s.length > MAX_LIEN || !/^[A-Za-z0-9_-]*$/.test(s)) return null;
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    try {
      var bin = atob(b);
      var octets = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: true }).decode(octets);
    } catch (e) { return null; }
  }

  /* Format compact, en tableaux plutôt qu'en objets, pour un lien court :
     [version, [noms], [[quoi, payeur, montant, [pour]], …]] */
  function encoder(etat) {
    return versB64url(JSON.stringify([VERSION, etat.noms,
      etat.depenses.map(function (d) { return [d.quoi, d.payeur, d.montant, d.pour]; })]));
  }

  var entierDans = function (x, min, max) {
    return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
  };

  /* Un lien est une donnée venue de l'extérieur : n'importe qui peut en
     fabriquer un. Il est validé en entier, et au moindre écart il est refusé
     en entier — jamais réparé à moitié. */
  function decoder(code) {
    var json = depuisB64url(code);
    if (json === null) return null;
    var v;
    try { v = JSON.parse(json); } catch (e) { return null; }
    if (!Array.isArray(v) || v.length !== 3 || v[0] !== VERSION) return null;
    var noms = v[1], deps = v[2];
    if (!Array.isArray(noms) || noms.length < 1 || noms.length > MAX_PERSONNES) return null;
    if (!Array.isArray(deps) || deps.length > MAX_DEPENSES) return null;
    var vus = {};
    for (var i = 0; i < noms.length; i++) {
      if (!nomValide(noms[i])) return null;
      var cle = noms[i].trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(vus, cle)) return null;
      vus[cle] = true;
    }
    var n = noms.length, depenses = [];
    for (var j = 0; j < deps.length; j++) {
      var d = deps[j];
      if (!Array.isArray(d) || d.length !== 4) return null;
      if (typeof d[0] !== 'string' || d[0].length > MAX_QUOI) return null;
      if (!entierDans(d[1], 0, n - 1) || !entierDans(d[2], 1, MAX_MONTANT)) return null;
      if (!Array.isArray(d[3]) || d[3].length < 1 || d[3].length > n) return null;
      for (var k = 0; k < d[3].length; k++) {
        if (!entierDans(d[3][k], 0, n - 1)) return null;
        if (k > 0 && d[3][k] <= d[3][k - 1]) return null;   /* trié, sans doublon */
      }
      depenses.push({ quoi: d[0], payeur: d[1], montant: d[2], pour: d[3].slice() });
    }
    return { noms: noms.map(function (x) { return x.trim(); }), depenses: depenses };
  }

  /* --------------------------------------------------------- présentation */

  function euros(c) {
    /* Au-delà d'un entier sûr, String() bascule en notation « 1e+306 » et
       l'affichage deviendrait absurde : on refuse plutôt. */
    if (typeof c !== 'number' || !Number.isSafeInteger(c)) return '—';
    var signe = c < 0 ? '−' : '';
    var a = Math.abs(c);
    var e = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return signe + e + ',' + String(a % 100).padStart(2, '0') + ' €';
  }

  /* ----------------------------------------------------------------- page */

  function boot() {
    var $ = function (id) { return document.getElementById(id); };
    if (!$('f-personne')) return;

    var theme = $('theme-toggle');
    if (theme) {
      var saved = null;
      try { saved = localStorage.getItem('partage.theme'); } catch (e) {}
      if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
      theme.addEventListener('click', function () {
        var suiv = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', suiv);
        try { localStorage.setItem('partage.theme', suiv); } catch (e) {}
      });
    }

    var etat = { noms: [], depenses: [] };
    var el = function (tag, cls, texte) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (texte !== undefined) e.textContent = texte;
      return e;
    };
    var dire = function (msg) { var e = $('erreur'); e.textContent = msg || ''; e.hidden = !msg; };

    function lien() {
      return location.href.split('#')[0] + (etat.noms.length ? '#' + encoder(etat) : '');
    }

    function charger() {
      var h = location.hash.slice(1);
      $('lien-abime').hidden = true;
      if (!h) return;
      var e = decoder(h);
      if (e) etat = e;
      else { etat = { noms: [], depenses: [] }; $('lien-abime').hidden = false; }
    }

    function rendre() {
      /* le groupe */
      var ul = $('personnes'); ul.innerHTML = '';
      etat.noms.forEach(function (nom, i) {
        var li = el('li', 'personne');
        li.appendChild(el('span', null, nom));
        var b = el('button', 'retirer', '×');
        b.type = 'button';
        b.setAttribute('aria-label', 'Retirer ' + nom);
        b.addEventListener('click', function () {
          if (etat.depenses.some(function (d) { return d.payeur === i || d.pour.indexOf(i) >= 0; })) {
            dire(nom + ' apparaît dans une dépense : retirez d’abord cette dépense.');
            return;
          }
          etat.noms.splice(i, 1);
          etat.depenses.forEach(function (d) {
            if (d.payeur > i) d.payeur--;
            d.pour = d.pour.map(function (p) { return p > i ? p - 1 : p; });
          });
          maj();
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
      $('vide-groupe').hidden = etat.noms.length > 0;

      /* le formulaire de dépense dépend du groupe */
      var sel = $('payeur'), pour = $('pour');
      var avant = sel.value;
      sel.innerHTML = ''; pour.innerHTML = '';
      etat.noms.forEach(function (nom, i) {
        var o = el('option', null, nom); o.value = String(i); sel.appendChild(o);
        var lab = el('label', 'case');
        var c = document.createElement('input');
        c.type = 'checkbox'; c.value = String(i); c.checked = true;
        lab.appendChild(c); lab.appendChild(el('span', null, nom));
        pour.appendChild(lab);
      });
      if (avant && Number(avant) < etat.noms.length) sel.value = avant;
      $('bloc-depense').hidden = etat.noms.length < 2;
      $('attente-depense').hidden = etat.noms.length >= 2;

      /* le résultat */
      var res = $('resultat');
      res.hidden = etat.depenses.length === 0;
      if (res.hidden) return;

      $('total').textContent = euros(total(etat));
      $('nb').textContent = etat.depenses.length + (etat.depenses.length > 1 ? ' dépenses' : ' dépense');

      var s = soldes(etat);
      var vir = remboursements(s);
      var ol = $('virements'); ol.innerHTML = '';
      if (!vir.length) ol.appendChild(el('li', 'equilibre', 'Personne ne doit rien à personne : les comptes sont équilibrés.'));
      vir.forEach(function (v) {
        var li = el('li', 'virement');
        li.appendChild(el('b', null, etat.noms[v.de]));
        li.appendChild(el('span', 'fleche', ' rembourse '));
        li.appendChild(el('b', null, etat.noms[v.a]));
        li.appendChild(el('span', 'montant', euros(v.montant)));
        ol.appendChild(li);
      });

      var us = $('soldes'); us.innerHTML = '';
      s.forEach(function (v, i) {
        var li = el('li', 'solde ' + (v > 0 ? 'is-credit' : v < 0 ? 'is-debit' : 'is-zero'));
        li.appendChild(el('span', null, etat.noms[i]));
        li.appendChild(el('span', 'montant', (v > 0 ? '+' : '') + euros(v)));
        us.appendChild(li);
      });

      var ud = $('depenses'); ud.innerHTML = '';
      etat.depenses.forEach(function (d, j) {
        var li = el('li', 'depense');
        var txt = el('div', 'dep-texte');
        txt.appendChild(el('b', null, d.quoi || 'Dépense'));
        txt.appendChild(el('span', 'muted', etat.noms[d.payeur] + ' a payé · pour '
          + (d.pour.length === etat.noms.length ? 'tout le groupe'
             : d.pour.map(function (p) { return etat.noms[p]; }).join(', '))));
        li.appendChild(txt);
        li.appendChild(el('span', 'montant', euros(d.montant)));
        var b = el('button', 'retirer', '×');
        b.type = 'button';
        b.setAttribute('aria-label', 'Retirer la dépense ' + (d.quoi || (j + 1)));
        b.addEventListener('click', function () { etat.depenses.splice(j, 1); maj(); });
        li.appendChild(b);
        ud.appendChild(li);
      });

      $('lien').value = lien();
    }

    function maj() {
      dire('');
      var code = etat.noms.length ? '#' + encoder(etat) : '';
      history.replaceState(null, '', location.pathname + location.search + code);
      rendre();
    }

    $('f-personne').addEventListener('submit', function (e) {
      e.preventDefault();
      var champ = $('nom'), nom = champ.value.trim();
      if (!nomValide(nom)) { dire('Un prénom, de 1 à ' + MAX_NOM + ' caractères.'); return; }
      if (etat.noms.length >= MAX_PERSONNES) { dire('Un groupe compte au plus ' + MAX_PERSONNES + ' personnes.'); return; }
      if (etat.noms.some(function (n) { return n.toLowerCase() === nom.toLowerCase(); })) {
        dire(nom + ' fait déjà partie du groupe.'); return;
      }
      etat.noms.push(nom);
      champ.value = '';
      maj();
      champ.focus();
    });

    $('f-depense').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = centimes($('montant').value);
      if (!Number.isInteger(m)) { dire('Un montant en euros, par exemple 42,50.'); return; }
      var pour = Array.prototype.slice.call(document.querySelectorAll('#pour input:checked'))
        .map(function (c) { return Number(c.value); }).sort(function (a, b) { return a - b; });
      if (!pour.length) { dire('Cochez au moins une personne concernée par la dépense.'); return; }
      if (etat.depenses.length >= MAX_DEPENSES) { dire('Au plus ' + MAX_DEPENSES + ' dépenses par calcul.'); return; }
      etat.depenses.push({ quoi: $('quoi').value.trim().slice(0, MAX_QUOI), payeur: Number($('payeur').value),
        montant: m, pour: pour });
      $('quoi').value = ''; $('montant').value = '';
      maj();
      $('quoi').focus();
    });

    $('copier').addEventListener('click', function () {
      var champ = $('lien'), ok = $('copie');
      var fini = function () { ok.hidden = false; setTimeout(function () { ok.hidden = true; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(champ.value).then(fini, function () { champ.select(); });
      } else { champ.select(); }
    });

    $('recommencer').addEventListener('click', function () {
      etat = { noms: [], depenses: [] };
      maj();
    });

    window.addEventListener('hashchange', function () { charger(); rendre(); });
    charger();
    rendre();
  }

  return {
    VERSION: VERSION, MAX_PERSONNES: MAX_PERSONNES, MAX_DEPENSES: MAX_DEPENSES,
    MAX_MONTANT: MAX_MONTANT, MAX_LIEN: MAX_LIEN,
    centimes: centimes, nomValide: nomValide, parts: parts, soldes: soldes,
    remboursements: remboursements, total: total,
    encoder: encoder, decoder: decoder, euros: euros, boot: boot
  };
});
