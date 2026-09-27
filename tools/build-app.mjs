/*
 * Construit ce qui fait du site une application installable.
 *
 *   npm run app
 *
 * 1. La liste des fichiers gardés pour le hors connexion, écrite dans sw.js.
 *    Elle n'est pas tenue à la main : elle est LUE dans les pages du site —
 *    chaque page de PAGES, plus les feuilles de style et les scripts qu'elle
 *    charge réellement. Une page ajoutée à PAGES y entre toute seule ; une
 *    feuille ajoutée à une page aussi. `npm test` signale une liste qui ne
 *    correspond plus au site.
 * 2. Les icônes, dessinées dans Chromium à partir du pictogramme du site.
 *
 * Les images d'aperçu (assets/og/) n'y sont pas : elles servent aux
 * messageries, jamais à une page, et ne feraient qu'alourdir le
 * téléchargement.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PAGES, RACINE } from './verif/serveur.mjs';

const MANIFESTE = 'manifest.webmanifest';
export const ICONES = [
  { fichier: 'assets/app/icone-192.png', taille: 192, forme: 'arrondie' },
  { fichier: 'assets/app/icone-512.png', taille: 512, forme: 'arrondie' },
  { fichier: 'assets/app/icone-masquable-512.png', taille: 512, forme: 'pleine' },
  /* iOS arrondit lui-même les coins et refuse la transparence : carré plein. */
  { fichier: 'assets/app/icone-180.png', taille: 180, forme: 'pleine' }
];

/* Chemin d'une page, tel que le service worker le demande : relatif à la
   racine du site, le dossier plutôt que index.html. */
const cheminPage = (url) => (url === '/' ? './' : url.replace(/^\//, ''));

export function fichiersHorsLigne() {
  const out = new Set([MANIFESTE, ...ICONES.map((i) => i.fichier)]);
  for (const url of PAGES) {
    out.add(cheminPage(url));
    const dossier = path.join(RACINE, url);
    const html = readFileSync(path.join(dossier, 'index.html'), 'utf8');
    const refs = [
      ...[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
    ];
    for (const r of refs) {
      if (/^(?:[a-z]+:|\/\/)/i.test(r)) continue;   // data:, https:, etc. : rien à garder
      const abs = path.resolve(dossier, r);
      out.add(path.relative(RACINE, abs).split(path.sep).join('/'));
    }
  }
  /* './' d'abord, le reste par ordre alphabétique : un ordre stable, pour
     que sw.js ne change que si la liste change. */
  return [...out].sort((a, b) => (a === './' ? -1 : b === './' ? 1 : a.localeCompare(b)));
}

const BLOC = /const FICHIERS = \[[\s\S]*?\n\];/;
export const blocFichiers = (liste) =>
  'const FICHIERS = [\n' + liste.map((f) => `  '${f}'`).join(',\n') + '\n];';

/* Le pictogramme du site, repris de l'en-tête de l'accueil. */
function pictogramme() {
  const h = readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const m = h.match(/<span class="brand-mark"[^>]*>\s*<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error('index.html : pictogramme introuvable');
  return m[1].trim();
}

function gabaritIcone(taille, forme, traits) {
  /* Forme « pleine » : le fond couvre tout le carré, et le dessin reste dans
     la zone sûre centrale, que les lanceurs ne rognent jamais, quelle que
     soit la forme qu'ils imposent. */
  const dessin = forme === 'pleine' ? 0.5 : 0.6;
  const rayon = forme === 'pleine' ? 0 : Math.round(taille * 0.22);
  return `<!DOCTYPE html><html><head><style>
  * { margin: 0; } html, body { width: ${taille}px; height: ${taille}px; background: transparent; overflow: hidden; }
  .fond { width: ${taille}px; height: ${taille}px; border-radius: ${rayon}px; display: grid; place-items: center;
          background: #0b0b10;
          background-image: radial-gradient(${taille}px ${taille * 0.8}px at 20% 0%, rgba(139,123,255,.30), transparent 65%),
                            radial-gradient(${taille * 0.8}px ${taille * 0.7}px at 100% 100%, rgba(55,214,214,.14), transparent 60%); }
  svg { width: ${Math.round(taille * dessin)}px; height: ${Math.round(taille * dessin)}px; color: #8b7bff; }
</style></head><body><div class="fond">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${traits}</svg>
</div></body></html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  /* 1. La liste. */
  const sw = path.join(RACINE, 'sw.js');
  const liste = fichiersHorsLigne();
  const avant = readFileSync(sw, 'utf8');
  if (!BLOC.test(avant)) throw new Error('sw.js : bloc FICHIERS introuvable');
  writeFileSync(sw, avant.replace(BLOC, blocFichiers(liste)));
  console.log(`✓ sw.js : ${liste.length} fichiers gardés pour le hors connexion`);

  /* 2. Les icônes. */
  const { chromium } = await import('./verif/serveur.mjs');
  const nav = await chromium();
  const traits = pictogramme();
  for (const i of ICONES) {
    const page = await nav.newPage({ viewport: { width: i.taille, height: i.taille } });
    await page.setContent(gabaritIcone(i.taille, i.forme, traits));
    mkdirSync(path.dirname(path.join(RACINE, i.fichier)), { recursive: true });
    await page.screenshot({ path: path.join(RACINE, i.fichier), omitBackground: i.forme !== 'pleine' });
    await page.close();
    console.log(`✓ ${i.fichier} (${i.taille} px, ${i.forme})`);
  }
  await nav.close();

  /* Vérifié après les icônes, puisque ce script les crée. */
  const manquants = liste.filter((f) => !existsSync(path.join(RACINE, f === './' ? 'index.html' : f.endsWith('/') ? f + 'index.html' : f)));
  if (manquants.length) {
    console.error(`✗ fichiers listés mais absents : ${manquants.join(', ')}`);
    process.exit(1);
  }
}
