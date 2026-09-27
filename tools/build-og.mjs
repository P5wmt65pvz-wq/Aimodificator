/*
 * Construit l'image d'aperçu de chaque page d'outil : celle qu'affichent une
 * messagerie ou un réseau quand on y colle le lien.
 *
 *   npm run og
 *
 * Sans elle, un lien collé dans une conversation n'est qu'une ligne de texte
 * bleu. Pour Partage, dont le lien est fait pour être envoyé à tout un groupe,
 * c'est la première chose que les autres voient du site.
 *
 * Le texte de l'image n'est pas écrit ici : il est LU dans la page — nom,
 * sous-titre, pictogramme et titre principal. Une image ne peut donc pas
 * promettre autre chose que la page. Si le titre change, `npm test` le
 * signale : le texte alternatif de l'image ne correspond plus, il faut
 * relancer ce script.
 *
 * Chaque nouveau dossier sous outils/ ou en/ reçoit son image sans modifier
 * ce fichier.
 */
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from './verif/serveur.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets', 'og');
const L = 1200, H = 630;

/* Trois affirmations vraies de chaque outil, et de chacun sans exception :
   aucun n'est payant, aucun ne demande de compte, aucun n'a de serveur. */
const PASTILLES = {
  fr: ['Gratuit', 'Sans compte', 'Tout se passe dans votre navigateur'],
  en: ['Free', 'No account', 'Everything happens in your browser']
};

export function pagesOutils() {
  const out = [];
  for (const [racine, prefixe] of [['outils', ''], ['en', 'en-']]) {
    const dir = path.join(ROOT, racine);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, d.name, 'index.html');
      if (d.isDirectory() && existsSync(f)) out.push({ id: `${racine}/${d.name}`, fichier: f, image: `${prefixe}${d.name}.png` });
    }
  }
  /* La page de l'application suit la même structure qu'un outil : elle a
     donc son image, tirée de son titre, comme les autres. */
  const app = path.join(ROOT, 'application', 'index.html');
  if (existsSync(app)) out.push({ id: 'application', fichier: app, image: 'application.png' });
  return out;
}

function lire(fichier) {
  const h = readFileSync(fichier, 'utf8');
  const pris = (re, quoi) => {
    const m = h.match(re);
    if (!m) throw new Error(`${fichier} : ${quoi} introuvable`);
    return m[1].trim();
  };
  return {
    lang: pris(/<html lang="([a-z]+)"/, 'langue'),
    picto: pris(/<span class="brand-mark"[^>]*>\s*(<svg[\s\S]*?<\/svg>)/, 'pictogramme'),
    nom: pris(/<span class="brand-text"><strong>([^<]+)<\/strong>/, 'nom'),
    sous: pris(/<span class="brand-text"><strong>[^<]+<\/strong><small>([^<]+)<\/small>/, 'sous-titre'),
    titre: pris(/<h1>([\s\S]*?)<\/h1>/, 'titre principal')
  };
}

/* Le texte alternatif de l'image : ce qu'elle affiche, mot pour mot. Utilisé
   par les balises de chaque page, et par le test qui vérifie que l'image
   n'a pas vieilli par rapport au titre. */
export function texteAlt(fichier) {
  const p = lire(fichier);
  const titre = p.titre.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return `${p.nom} — ${titre}`;
}

function gabarit(p) {
  const pastilles = PASTILLES[p.lang] || PASTILLES.fr;
  return `<!DOCTYPE html><html lang="${p.lang}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${L}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #f3f3f7; background: #0b0b10;
    background-image: radial-gradient(1100px 520px at 18% -8%, rgba(139,123,255,.16), transparent 62%),
                      radial-gradient(900px 480px at 92% 4%, rgba(55,214,214,.10), transparent 60%);
    padding: 64px 76px; display: flex; flex-direction: column;
  }
  .marque { display: flex; align-items: center; gap: 16px; }
  .picto { width: 56px; height: 56px; border-radius: 13px; display: grid; place-items: center;
           background: rgba(139,123,255,.15); color: #8b7bff; }
  .picto svg { width: 30px; height: 30px; }
  .marque strong { display: block; font-size: 28px; letter-spacing: -.01em; }
  .marque small { display: block; font-size: 18px; color: #a9a9b8; margin-top: 2px; }
  .titre { flex: 1; min-height: 0; display: flex; align-items: center; }
  h1 { font-size: 68px; line-height: 1.12; letter-spacing: -.022em; font-weight: 800; max-width: 1040px; text-wrap: balance; }
  h1 em { font-style: normal; color: #8b7bff; display: block; text-wrap: balance; }
  ul { list-style: none; padding: 0; display: flex; gap: 12px; }
  li { font-size: 20px; padding: 11px 20px; border-radius: 999px;
       border: 1px solid #272733; background: #131319; }
</style></head><body>
  <div class="marque"><span class="picto">${p.picto}</span>
    <span><strong>${p.nom}</strong><small>${p.sous}</small></span></div>
  <div class="titre"><h1>${p.titre}</h1></div>
  <ul>${pastilles.map((t) => `<li>${t}</li>`).join('')}</ul>
</body></html>`;
}

/* Le titre le plus long doit tenir dans son bloc, avec de l'air au-dessus et
   au-dessous : on réduit la taille par pas de 2 px jusqu'à ce qu'il tienne,
   sans jamais descendre sous 40 px. En dessous, il serait illisible en
   vignette, et mieux vaut échouer. `min-height: 0` sur le bloc est ce qui
   rend la mesure honnête : sans lui, le bloc grandit avec le titre et le
   titre « tient » toujours, en poussant les pastilles hors de l'image. */
async function ajuster(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('h1'), bloc = document.querySelector('.titre');
    const tient = () => h1.offsetHeight <= bloc.clientHeight - 140 && h1.scrollWidth <= h1.clientWidth;
    let t = 68;
    while (!tient() && t > 40) { t -= 2; h1.style.fontSize = t + 'px'; }
    return { taille: t, tient: tient() };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  const nav = await chromium();
  const page = await nav.newPage({ viewport: { width: L, height: H } });
  let echecs = 0;
  for (const o of pagesOutils()) {
    await page.setContent(gabarit(lire(o.fichier)));
    const { taille, tient } = await ajuster(page);
    if (!tient) { console.error(`✗ ${o.id} : le titre ne tient pas, même à ${taille} px`); echecs++; continue; }
    await page.screenshot({ path: path.join(OUT, o.image), clip: { x: 0, y: 0, width: L, height: H } });
    console.log(`✓ ${o.id} → assets/og/${o.image} (titre à ${taille} px)`);
  }
  await nav.close();
  process.exit(echecs ? 1 : 0);
}
