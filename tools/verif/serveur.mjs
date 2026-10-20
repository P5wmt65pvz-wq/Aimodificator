/* Petit serveur de fichiers pour les contrôles dans Chromium.
   Ouvrir les pages en file:// ne convient pas : les règles d'origine du
   navigateur y diffèrent, et un défaut passerait inaperçu ou apparaîtrait
   à tort. On sert donc le site comme il l'est en ligne. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const RACINE = path.resolve(import.meta.dirname, '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

export async function servir(port) {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RACINE, p);
    /* Un chemin qui remonte hors du dossier n'est jamais servi. */
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      r.writeHead(404); return r.end('404');
    }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    r.end(fs.readFileSync(f));
  });
  await new Promise((r) => srv.listen(port, r));
  return { srv, base: 'http://127.0.0.1:' + port };
}

/* Playwright n'est pas une dépendance du projet : il est fourni par
   l'environnement. Un import par défaut sur le chemin complet est la seule
   forme qui fonctionne des deux côtés (module et CommonJS). */
export async function chromium() {
  const pw = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default;
  return pw.chromium.launch();
}

/* Les pages du site. Une page ajoutée ici est contrôlée par toutes les
   suites d'un coup — et une page OUBLIÉE ici vit sans filet : elle passe au
   travers du contraste, du clavier et du redimensionnement. */
export const PAGES = [
  '/', '/outils/empreinte/', '/outils/photo/', '/outils/clause/',
  '/outils/abonnements/', '/outils/passe/', '/outils/vrai-prix/', '/outils/partage/', '/outils/humain/',
  '/en/fingerprint/', '/exemples/', '/application/'
];

/* Un texte tel qu'une IA le rend, avec de quoi déclencher chaque famille de
   règles de Humain (restes de conversation, ouvertures creuses, connecteurs
   en rafale, tirets, mise en forme, phrase interminable) et un signalement. */
export const TEXTE_HUMAIN = "Bien sûr ! Voici un article sur le télétravail :\n\n## Le télétravail en 2026\n\n"
  + "Dans le monde d'aujourd'hui, le télétravail est un véritable game-changer — il transforme la façon dont les entreprises fonctionnent. "
  + "Il est important de noter que de nombreuses équipes ont adopté ce modèle afin de gagner en flexibilité. "
  + "De plus, les salariés économisent du temps. Par ailleurs, ils gagnent en autonomie. En outre, les coûts de bureau baissent. "
  + "Cependant, il convient de rester vigilant : l'isolement est un enjeu **crucial**.\n\n"
  + "À l'heure actuelle, un grand nombre d'entreprises mettent en place des chartes qui précisent les jours de présence, les règles de joignabilité, les outils autorisés et les modalités d'évaluation du travail à distance ; elles s'appuient sur des accords collectifs au sein des équipes pour que chacun sache ce qu'on attend de lui.\n\n"
  + "En conclusion, le télétravail est ici pour rester. N'hésitez pas à me demander si vous souhaitez approfondir ! 🚀";

export function rapport(pb, quandCestVert) {
  console.log('\n' + (pb.length
    ? `${pb.length} DÉFAUT(S) :\n - ` + pb.join('\n - ')
    : quandCestVert));
  process.exit(pb.length ? 1 : 0);
}
