/* Service worker de l'application.
 *
 * La liste FICHIERS est GÉNÉRÉE par `npm run app`, à partir des pages du site :
 * ne pas l'écrire à la main. `npm test` signale une liste qui ne correspond
 * plus aux pages. Le reste du fichier s'écrit normalement.
 *
 * Ce qu'il fait, et rien d'autre :
 * - Réseau d'abord. En ligne, chaque page arrive fraîche du site, exactement
 *   comme sans lui, et la copie gardée est remplacée au passage. Une copie
 *   ne peut donc jamais masquer une mise à jour.
 * - Hors connexion, ou si le réseau ne répond pas dans le délai, il sert la
 *   dernière copie gardée.
 * - Il ne touche qu'aux fichiers de ce site. Une requête vers un autre
 *   domaine — la relecture optionnelle par une IA, avec la clé de
 *   l'utilisateur — passe sans qu'il la voie ni la garde.
 * - Il ne télécharge rien de lui-même. La copie complète du site n'est faite
 *   que sur demande de la page, quand l'application est installée : un simple
 *   visiteur ne télécharge que ce qu'il ouvre.
 */
'use strict';

const CACHE = 'aimodificator-hors-ligne-1';
const DELAI = 4000;

const FICHIERS = [
  './',
  'application/',
  'application/application.css',
  'application/application.js',
  'assets/app/icone-180.png',
  'assets/app/icone-192.png',
  'assets/app/icone-512.png',
  'assets/app/icone-masquable-512.png',
  'assets/css/app.css',
  'assets/js/ai.js',
  'assets/js/app.js',
  'assets/js/engine.js',
  'assets/js/i18n.js',
  'assets/js/installation.js',
  'assets/js/liste.js',
  'assets/js/offers.js',
  'assets/js/profiles.js',
  'assets/js/templates.js',
  'en/fingerprint/',
  'exemples/',
  'exemples/exemples.css',
  'exemples/exemples.js',
  'manifest.webmanifest',
  'outils/abonnements/',
  'outils/abonnements/abonnements.css',
  'outils/abonnements/abonnements.js',
  'outils/clause/',
  'outils/clause/clause.css',
  'outils/clause/clause.js',
  'outils/empreinte/',
  'outils/empreinte/empreinte.css',
  'outils/empreinte/empreinte.i18n.js',
  'outils/empreinte/empreinte.js',
  'outils/partage/',
  'outils/partage/partage.css',
  'outils/partage/partage.js',
  'outils/passe/',
  'outils/passe/mots.js',
  'outils/passe/passe.css',
  'outils/passe/passe.js',
  'outils/photo/',
  'outils/photo/photo.css',
  'outils/photo/photo.js',
  'outils/vrai-prix/',
  'outils/vrai-prix/vrai-prix.css',
  'outils/vrai-prix/vrai-prix.js'
];

const PORTEE = new URL(self.registration.scope).pathname;
const absolue = (f) => new URL(f, self.registration.scope).href;

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  /* Une version précédente au nom de cache différent est effacée : elle ne
     serait plus jamais lue. */
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('aimodificator-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Seule une réponse complète et du site est gardée : ni erreur, ni morceau
   (206), ni réponse opaque d'un autre domaine. */
const gardable = (rep) => rep && rep.status === 200 && rep.type === 'basic';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PORTEE)) return;

  /* La copie est écrite à côté de la réponse, pas avant elle : la page reçoit
     la réponse du réseau sans attendre l'écriture. Une écriture qui échoue
     (stockage plein) ne fait jamais échouer la page. */
  let ecriture = Promise.resolve();
  const reseau = fetch(req).then((rep) => {
    if (gardable(rep)) {
      const pourLaCopie = rep.clone();
      ecriture = caches.open(CACHE).then((c) => c.put(req, pourLaCopie)).catch(() => {});
    }
    return rep;
  });
  /* Le réseau peut finir après la réponse servie depuis la copie : on le
     laisse terminer, pour que la copie soit à jour la fois suivante. */
  e.waitUntil(reseau.then(() => ecriture, () => {}));

  e.respondWith((async () => {
    const copie = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
    if (!copie) return reseau.catch(() => horsLigne(req));
    return Promise.race([
      reseau.then((rep) => (rep.ok ? rep : copie)).catch(() => copie),
      new Promise((r) => setTimeout(() => r(copie), DELAI))
    ]);
  })());
});

/* Une page jamais ouverte, demandée sans réseau : on le dit clairement au
   lieu de laisser la page d'erreur du navigateur. */
function horsLigne(req) {
  if (req.mode !== 'navigate') return Response.error();
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light"><title>Hors connexion</title>
<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:0 auto;padding:48px 20px;line-height:1.6;background:#0b0b10;color:#f3f3f7}
@media (prefers-color-scheme: light){body{background:#f7f7f4;color:#15151c}}a{color:#8b7bff}</style></head>
<body><h1>Pas de connexion</h1>
<p>Cette page n'a pas encore été gardée pour une utilisation hors connexion. Elle le sera à sa
prochaine ouverture avec du réseau.</p>
<p><a href="${absolue('./')}">Revenir à l'accueil</a> · <a href="${absolue('application/')}">L'application</a></p></body></html>`;
  return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/* Deux demandes possibles de la page :
   - « état » : combien de fichiers du site sont déjà gardés, sans rien
     télécharger ;
   - « tout-prendre » : garder ceux qui manquent. Un fichier déjà gardé n'est
     pas redemandé. */
self.addEventListener('message', (e) => {
  const repondre = (bilan) => { if (e.source) e.source.postMessage({ type: 'bilan', ...bilan }); };
  if (e.data === 'etat') e.waitUntil(etat().then(repondre));
  if (e.data === 'tout-prendre') e.waitUntil(toutPrendre().then(repondre));
});

async function etat() {
  const cache = await caches.open(CACHE);
  let presents = 0;
  for (const f of FICHIERS) if (await cache.match(absolue(f), { ignoreVary: true })) presents++;
  return { total: FICHIERS.length, presents, echecs: 0 };
}

async function toutPrendre() {
  const cache = await caches.open(CACHE);
  let presents = 0, echecs = 0;
  for (const f of FICHIERS) {
    const url = absolue(f);
    if (await cache.match(url, { ignoreVary: true })) { presents++; continue; }
    try {
      const rep = await fetch(url, { cache: 'no-cache' });
      if (gardable(rep)) { await cache.put(url, rep); presents++; } else echecs++;
    } catch (err) { echecs++; }
  }
  return { total: FICHIERS.length, presents, echecs };
}
