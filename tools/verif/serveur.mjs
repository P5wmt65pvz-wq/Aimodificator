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

/* Les huit pages du site. Une page ajoutée ici est contrôlée par toutes les
   suites d'un coup. */
export const PAGES = [
  '/', '/outils/empreinte/', '/outils/photo/', '/outils/clause/',
  '/outils/abonnements/', '/outils/passe/', '/en/fingerprint/', '/exemples/'
];

export function rapport(pb, quandCestVert) {
  console.log('\n' + (pb.length
    ? `${pb.length} DÉFAUT(S) :\n - ` + pb.join('\n - ')
    : quandCestVert));
  process.exit(pb.length ? 1 : 0);
}
