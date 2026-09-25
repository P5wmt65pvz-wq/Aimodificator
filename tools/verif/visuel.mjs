/* Contrôle visuel : chaque page, outil en action, comparée pixel par pixel à
 * une capture de référence validée à l'œil.
 *
 * Pourquoi cette suite existe. Le 22 septembre 2026, trois défauts de mise en
 * page sont passés au travers des huit autres suites : un formulaire dont les
 * champs s'étalaient sur toute la largeur, et des listes rendues avec les puces
 * et les liens bruts du navigateur sur six pages. Aucun débordement, aucun
 * contraste insuffisant, aucun piège au clavier, aucune erreur console. Il
 * fallait regarder — c'est ce que fait cette suite, à chaque exécution.
 *
 * Deux pièges évités, faute de quoi la suite crierait au loup :
 *  - l'horloge est figée, sinon « dans 29 jours » et les horodatages de
 *    l'historique changeraient chaque jour ;
 *  - sur Empreinte, les VALEURS lues sur la machine sont masquées (c'est le
 *    principe même de l'outil qu'elles varient), mais la mise en page ne l'est
 *    pas : cartes, grille et espacements restent comparés.
 *
 * Usage :
 *   node tools/verif/visuel.mjs          compare aux références
 *   node tools/verif/visuel.mjs --maj    régénère les références
 * Après --maj, REGARDER les captures avant de commiter : une référence n'est
 * juste que si quelqu'un l'a vue.
 */
import { servir, chromium, rapport } from './serveur.mjs';
import { construitJpeg } from './jpeg.mjs';
import fs from 'node:fs';
import path from 'node:path';

const ICI = import.meta.dirname;
const REF = path.join(ICI, 'references', 'visuel');
const ECARTS = path.join(ICI, 'ecarts');
const MAJ = process.argv.includes('--maj');

/* Un jour et une heure quelconques, mais toujours les mêmes. */
const FIXE = new Date('2026-09-22T10:00:00+02:00');

/* Écart toléré par canal de couleur, pour absorber l'anticrénelage. Au-delà,
   le pixel compte comme différent. */
const SEUIL_PIXEL = 24;
/* Nombre de pixels différents au-delà duquel la page est en défaut.

   Le premier réglage était une PROPORTION, 0,1 % de la page, présentée comme
   « moins qu'un mot déplacé ». C'était faux : sur l'accueil, haut de 4 700 px,
   0,1 % fait 5 600 pixels, et l'ajout d'un mot entier dans la navigation n'en
   change que 1 146. Il est passé en silence, étiqueté « anticrénelage ».

   Le seuil est donc calé sur ce qui a été MESURÉ : deux passes successives sur
   les mêmes pages donnent exactement 0 pixel de différence. 50 pixels laissent
   une marge pour un rendu légèrement instable, et restent vingt fois sous le
   plus petit changement réel observé. */
const SEUIL_PIXELS = 50;

const POLITIQUE = "Nous pouvons vendre vos données à des partenaires commerciaux. "
  + "Vos données sont conservées sans limitation de durée et transférées hors de "
  + "l'Union européenne. En poursuivant votre navigation, vous consentez à ce "
  + "traitement. Nous nous réservons le droit de modifier cette politique à tout "
  + "moment sans vous en informer. Nos partenaires de confiance peuvent également "
  + "y accéder pour améliorer votre expérience.";

const MASQUES_EMPREINTE = ['#cards .value', '#cards .tag', '#score', '#gauge-fill',
  '#verdict-label', '#verdict-explain', '#steps'];

const SCENARIOS = [
  ['accueil', '/', [], async (p) => {
    await p.fill('#request', 'Écris un article de blog sur les métadonnées cachées dans les photos, pour un public non technique, environ 1200 mots.');
    await p.click('#generate');
  }],
  ['empreinte', '/outils/empreinte/', MASQUES_EMPREINTE, async () => {}],
  ['photo', '/outils/photo/', [], async (p) => {
    await p.setInputFiles('#fichier', { name: 'vacances.jpg', mimeType: 'image/jpeg',
      buffer: Buffer.from(construitJpeg({ exif: true })) });
  }],
  ['clause', '/outils/clause/', [], async (p) => { await p.fill('#texte', POLITIQUE); }],
  ['passe', '/outils/passe/', [], async (p) => { await p.fill('#mdp', 'Motdepasse2024!'); }],
  ['abonnements', '/outils/abonnements/', [], async (p) => {
    for (const [n, prix, cyc] of [['Streaming vidéo', '9.99', 'mensuel'],
      ['Logiciel de montage', '120', 'annuel'], ['Salle de sport', '29.90', 'mensuel']]) {
      await p.fill('#nom', n); await p.fill('#prix', prix);
      await p.selectOption('#cycle', cyc); await p.fill('#depart', '2026-09-21');
      await p.click('#ajout button[type=submit]');
    }
  }],
  ['vrai-prix', '/outils/vrai-prix/', [], async (p) => {
    await p.fill('#prix', '9.99'); await p.fill('#hausse', '5'); await p.fill('#achat', '249');
  }],
  ['exemples', '/exemples/', [], async () => {}],
  /* Chargé par le lien, comme le reçoit un membre du groupe : l'état est
     entièrement déterminé par l'adresse. */
  ['partage', '/outils/partage/#WzEsWyJBZHJpZW4iLCJMw6lhIiwiVG9tIl0sW1siQ291cnNlcyIsMCw5MDAwLFswLDEsMl1dLFsiRXNzZW5jZSIsMSw0NTAwLFswLDFdXSxbIkNpbsOpbWEiLDIsMTAwMCxbMCwxLDJdXV1d', [], async () => {}],
  ['fingerprint-en', '/en/fingerprint/', MASQUES_EMPREINTE, async () => {}]
];

const { srv, base } = await servir(8184);
const nav = await chromium();
const pb = [];
fs.mkdirSync(REF, { recursive: true });
fs.rmSync(ECARTS, { recursive: true, force: true });

/* La comparaison se fait dans le navigateur, sur un canvas : aucune
   bibliothèque de décodage d'image n'est nécessaire, et le dépôt n'en a
   aucune. */
const cmpCtx = await nav.newContext();
const cmp = await cmpCtx.newPage();

async function compare(a, b) {
  return cmp.evaluate(async ({ a, b, seuil }) => {
    const charge = (s) => new Promise((ok, ko) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = 'data:image/png;base64,' + s;
    });
    const [ia, ib] = await Promise.all([charge(a), charge(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { taille: [ia.width, ia.height, ib.width, ib.height] };
    }
    const w = ia.width, h = ia.height;
    const px = (img) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data;
    };
    const da = px(ia), db = px(ib);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ox = out.getContext('2d'); const od = ox.createImageData(w, h);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > seuil) { n++; od.data[i] = 255; od.data[i + 1] = 0; od.data[i + 2] = 255; }
      else { const g = (db[i] + db[i + 1] + db[i + 2]) / 12; od.data[i] = od.data[i + 1] = od.data[i + 2] = g; }
      od.data[i + 3] = 255;
    }
    ox.putImageData(od, 0, 0);
    return { n, total: w * h, ecart: n ? out.toDataURL('image/png').split(',')[1] : null };
  }, { a: a.toString('base64'), b: b.toString('base64'), seuil: SEUIL_PIXEL });
}

for (const [nom, url, masques, action] of SCENARIOS) {
  const ctx = await nav.newContext({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 1,
    colorScheme: 'dark', locale: 'fr-FR', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.install({ time: FIXE });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await action(page);
  await page.waitForTimeout(700);
  /* Le focus laissé par la saisie dessinerait un anneau selon l'ordre des
     actions : on le retire pour que seule la mise en page soit comparée. */
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(100);

  const img = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide',
    mask: masques.map((s) => page.locator(s)), maskColor: '#ff00ff' });
  await ctx.close();

  const fRef = path.join(REF, nom + '.png');
  if (MAJ) {
    /* Seules les pages qui ont réellement changé sont réécrites : les
       références sont commitées, et réécrire les neuf à chaque retouche
       ajouterait cinq mégaoctets à l'historique Git pour un seul pixel
       déplacé. */
    if (fs.existsSync(fRef)) {
      const r = await compare(fs.readFileSync(fRef), img);
      if (!r.taille && r.n <= SEUIL_PIXELS) { console.log(`  inchangée  ${nom}`); continue; }
    }
    fs.writeFileSync(fRef, img);
    console.log(`  RÉÉCRITE   ${nom}`);
    continue;
  }
  if (!fs.existsSync(fRef)) { pb.push(`${nom} : aucune référence — lancer avec --maj, puis regarder la capture`); continue; }

  const r = await compare(fs.readFileSync(fRef), img);
  fs.mkdirSync(ECARTS, { recursive: true });
  if (r.taille) {
    fs.writeFileSync(path.join(ECARTS, nom + '-actuel.png'), img);
    pb.push(`${nom} : la page a changé de taille (${r.taille[0]}×${r.taille[1]} → ${r.taille[2]}×${r.taille[3]}) — mise en page déplacée`);
    console.log(`  ECHEC  ${nom} — taille ${r.taille[1]} → ${r.taille[3]} px`);
    continue;
  }
  const part = r.n / r.total;
  if (r.n > SEUIL_PIXELS) {
    fs.writeFileSync(path.join(ECARTS, nom + '-actuel.png'), img);
    fs.writeFileSync(path.join(ECARTS, nom + '-ecart.png'), Buffer.from(r.ecart, 'base64'));
    pb.push(`${nom} : ${r.n} pixels différents (${(part * 100).toFixed(3)} %) — voir tools/verif/ecarts/${nom}-ecart.png`);
    console.log(`  ECHEC  ${nom} — ${r.n} pixels différents`);
  } else {
    /* Pas de mot comme « anticrénelage » ici : on ne sait pas ce que sont ces
       pixels, on sait seulement qu'ils sont sous le seuil mesuré. */
    console.log(`  ok     ${nom}${r.n ? ` (${r.n} px différents, sous le seuil de ${SEUIL_PIXELS})` : ''}`);
  }
}

await cmpCtx.close();
await nav.close();
srv.close();
if (MAJ) { console.log('\nRéférences régénérées. Les REGARDER avant de commiter.'); process.exit(0); }
rapport(pb, 'AUCUN DÉFAUT — chaque page est identique à sa référence');
