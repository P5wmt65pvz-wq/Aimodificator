/* L'application tient-elle ses promesses ?
 *
 * La page « Application » en fait trois, et chacune est vérifiée ici, dans
 * Chromium, contre un vrai serveur qu'on coupe vraiment :
 *
 * 1. Un simple visiteur ne télécharge rien de plus que ce qu'il ouvre.
 *    Mesuré côté serveur : on compte ce qui y arrive, pas ce que la page
 *    croit demander.
 * 2. Installée, l'application garde tout le site, sans qu'on touche à rien.
 *    L'installation est simulée par le seul signal que le site regarde : le
 *    mode d'affichage « standalone ».
 * 3. Sans réseau, chaque page s'ouvre, sans erreur, et les outils calculent.
 *    Le réseau n'est pas émulé : le serveur est arrêté.
 *
 * Et un quatrième point, qui compte autant : en ligne, la copie ne masque
 * jamais le site. La page est redemandée au serveur à chaque ouverture.
 */
import { servir, chromium, PAGES, rapport } from './serveur.mjs';
import { fichiersHorsLigne } from '../build-app.mjs';

const { srv, base } = await servir(8169);
const recus = [];
srv.on('request', (q) => recus.push(decodeURIComponent(q.url.split('?')[0])));

const nav = await chromium();
const pb = [];
const dire = (ok, quoi) => { console.log((ok ? '  ok   ' : '  ECHEC') + '  ' + quoi); if (!ok) pb.push(quoi); };
const FICHIERS = fichiersHorsLigne();
const absolue = (f) => '/' + (f === './' ? '' : f);
const CACHE = 'aimodificator-hors-ligne-1';

async function contexte({ installee = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  if (installee) {
    /* Le seul signal que le site regarde pour savoir s'il est installé. */
    await ctx.addInitScript(() => {
      const origine = window.matchMedia.bind(window);
      window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q)
        ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
        : origine(q));
    });
  }
  const erreurs = [];
  ctx.on('page', (p) => {
    p.on('console', (m) => { if (m.type() === 'error') erreurs.push(`${p.url()} : ${m.text()}`); });
    p.on('pageerror', (e) => erreurs.push(`${p.url()} : ${e.message}`));
  });
  return { ctx, erreurs };
}

const pret = (page) => page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  return !!r.active;
});

async function gardes(page) {
  return page.evaluate(async ({ liste, nom }) => {
    const c = await caches.open(nom);
    const manquants = [];
    for (const f of liste) if (!(await c.match(new URL(f, location.origin + '/').href, { ignoreVary: true }))) manquants.push(f);
    return manquants;
  }, { liste: FICHIERS.map(absolue), nom: CACHE });
}

async function attendre(cond, ms = 15000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 150)); }
  return false;
}

/* --------------------------------------------- 1. le simple visiteur */
console.log('\n=== Un simple visiteur ne télécharge que ce qu\'il ouvre ===');
const visiteur = await contexte();
{
  const page = await visiteur.ctx.newPage();
  recus.length = 0;
  await page.goto(base + '/outils/passe/', { waitUntil: 'networkidle' });
  dire(await pret(page), 'le service worker est actif');
  await page.waitForTimeout(1500);
  const permis = new Set(['/outils/passe/', '/outils/passe/passe.css', '/outils/passe/mots.js', '/outils/passe/passe.js',
    '/assets/js/installation.js', '/sw.js', '/manifest.webmanifest', '/assets/app/icone-180.png',
    '/assets/app/icone-192.png', '/assets/app/icone-512.png', '/assets/app/icone-masquable-512.png']);
  const autres = [...new Set(recus)].filter((u) => !permis.has(u));
  dire(autres.length === 0, `aucun autre fichier du site demandé au serveur${autres.length ? ' → ' + autres.slice(0, 4).join(', ') : ''}`);
  dire(!recus.includes('/outils/partage/') && !recus.includes('/'), 'ni l\'accueil ni une autre page ne sont téléchargées d\'avance');

  /* Rechargée une fois sous le service worker : elle est gardée, et elle
     seule. C'est ce qui servira au point 3. */
  await page.reload({ waitUntil: 'networkidle' });
  const manquants = await gardes(page);
  dire(!manquants.includes('/outils/passe/') && !manquants.includes('/outils/passe/passe.js'), 'la page ouverte est gardée');
  dire(manquants.includes('/outils/clause/'), 'une page jamais ouverte ne l\'est pas');
}

/* --------------------------------------------- 2. l'application installée */
console.log('\n=== Installée, l\'application garde tout le site d\'elle-même ===');
const installee = await contexte({ installee: true });
{
  const page = await installee.ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  dire(await pret(page), 'le service worker est actif');
  let manquants = FICHIERS;
  const complet = await attendre(async () => (manquants = await gardes(page)).length === 0);
  dire(complet, `les ${FICHIERS.length} fichiers du site sont gardés, sans aucun clic${complet ? '' : ' → manquent ' + manquants.slice(0, 4).join(', ')}`);

  /* Réseau d'abord : en ligne, la page revient du serveur, pas de la copie. */
  recus.length = 0;
  await page.goto(base + '/outils/vrai-prix/', { waitUntil: 'networkidle' });
  dire(recus.includes('/outils/vrai-prix/'), 'en ligne, une page gardée est quand même redemandée au site');

  /* La page Application voit l'état réel. */
  await page.goto(base + '/application/', { waitUntil: 'networkidle' });
  const vu = await page.waitForSelector('.hors-ligne.is-complet', { timeout: 10000 }).then(() => true, () => false);
  dire(vu, 'la page Application l\'affiche : tout le site est gardé');
  const texte = vu ? await page.locator('#compte').innerText() : '';
  dire(texte.includes(String(FICHIERS.length)), `le compte affiché est le vrai (${texte.trim()})`);
  dire(/installée/.test(await page.locator('#etat-install').innerText()), 'la page reconnaît qu\'elle tourne installée');
}

/* Le bouton « Garder tout le site », sans installation. */
console.log('\n=== Sans installer : la copie complète, sur demande ===');
{
  const c = await contexte();
  const page = await c.ctx.newPage();
  await page.goto(base + '/application/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#hors-ligne:not([hidden])', { timeout: 10000 }).catch(() => {});
  dire(await page.locator('#garder-tout').isVisible(), 'le bouton de copie apparaît');
  const avant = (await page.locator('#compte').innerText()).trim();
  dire(/^rien n'est encore gardé/.test(avant), `avant la copie, le compteur le dit en français correct (« ${avant} »)`);
  await page.click('#garder-tout');
  const ok = await page.waitForSelector('.hors-ligne.is-complet', { timeout: 15000 }).then(() => true, () => false);
  dire(ok, 'un clic garde tout le site');
  dire((await gardes(page)).length === 0, 'et tout y est réellement');
  dire(c.erreurs.length === 0, `aucune erreur console${c.erreurs.length ? ' → ' + c.erreurs[0] : ''}`);
  await c.ctx.close();
}

/* --------------------------------------------- 3. le serveur est coupé */
console.log('\n=== Serveur arrêté ===');
srv.closeAllConnections();
await new Promise((r) => srv.close(r));
{
  const sonde = await fetch(base + '/').then(() => 'répond', () => 'coupé');
  dire(sonde === 'coupé', `le serveur ne répond plus (${sonde})`);
}

for (const url of PAGES) {
  const page = await installee.ctx.newPage();
  const rep = await page.goto(base + url, { waitUntil: 'load' }).catch((e) => e);
  const ouverte = rep && typeof rep.status === 'function' && rep.status() === 200;
  const titre = ouverte ? (await page.locator('h1').first().innerText().catch(() => '')).trim() : '';
  dire(ouverte && titre.length > 0, `${url} s'ouvre sans réseau${titre ? ' — « ' + titre.split('\n')[0].slice(0, 50) + ' »' : ''}`);
  await page.close();
}

/* Les outils calculent, pas seulement s'affichent. */
{
  const page = await installee.ctx.newPage();
  await page.goto(base + '/outils/passe/', { waitUntil: 'load' });
  await page.fill('#mdp', 'Motdepasse2024!');
  await page.waitForTimeout(100);
  const v = (await page.locator('#verdict').innerText()).trim();
  dire(v.length > 1 && v !== '—', `Passe calcule hors connexion (« ${v} »)`);

  await page.goto(base + '/outils/partage/#WzEsWyJBZHJpZW4iLCJMw6lhIiwiVG9tIl0sW1siQ291cnNlcyIsMCw5MDAwLFswLDEsMl1dLFsiRXNzZW5jZSIsMSw0NTAwLFswLDFdXSxbIkNpbsOpbWEiLDIsMTAwMCxbMCwxLDJdXV1d', { waitUntil: 'load' });
  const vir = (await page.locator('#virements li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  dire(vir.length === 2 && /Tom rembourse Adrien 23,33/.test(vir[0] || ''), `Partage calcule un lien reçu hors connexion (${vir[0] || 'rien'})`);

  await page.goto(base + '/', { waitUntil: 'load' });
  await page.fill('#request', 'Écris un court article sur le vélo en ville pour des débutants');
  await page.click('#generate');
  await page.waitForTimeout(200);
  const sortie = await page.evaluate(() => (document.querySelector('#output, .output, pre') || {}).textContent || '');
  dire(sortie.trim().length > 200, 'PromptForge génère un prompt hors connexion');
  await page.close();
}
dire(installee.erreurs.length === 0, `application installée : aucune erreur console${installee.erreurs.length ? ' → ' + installee.erreurs[0] : ''}`);

/* Le visiteur n'a gardé que Passe : Passe s'ouvre, le reste le dit. */
{
  const page = await visiteur.ctx.newPage();
  const r1 = await page.goto(base + '/outils/passe/', { waitUntil: 'load' }).catch((e) => e);
  dire(r1 && r1.status && r1.status() === 200, 'visiteur : la page déjà ouverte s\'ouvre sans réseau');
  const r2 = await page.goto(base + '/outils/clause/', { waitUntil: 'load' }).catch((e) => e);
  const msg = await page.locator('h1').first().innerText().catch(() => '');
  dire(r2 && r2.status && r2.status() === 503 && /connexion/i.test(msg), `visiteur : une page jamais ouverte le dit clairement (« ${msg} »)`);
  dire(await page.locator('a[href$="/application/"]').count() === 1, 'visiteur : la page hors connexion mène à l\'application');
}

await nav.close();
rapport(pb, 'TOUT EST VERT — l\'application tient ses trois promesses, serveur coupé');
