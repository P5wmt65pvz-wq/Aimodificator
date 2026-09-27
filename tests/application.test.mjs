/* L'application installable : manifeste, icônes, service worker.
   Ce que ce fichier ne peut pas voir — que le site s'ouvre réellement sans
   réseau — est vérifié dans Chromium par la suite `hors-ligne`. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PAGES } from '../tools/verif/serveur.mjs';
import { fichiersHorsLigne, blocFichiers, ICONES } from '../tools/build-app.mjs';

const BASE = path.resolve(import.meta.dirname, '..');
const lire = (f) => readFileSync(path.join(BASE, f), 'utf8');
const fichierDe = (rel) => path.join(BASE, rel === './' ? 'index.html' : rel.endsWith('/') ? rel + 'index.html' : rel);
const dimensionsPng = (f) => {
  const b = readFileSync(f);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${f} n'est pas un PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

const manifeste = JSON.parse(lire('manifest.webmanifest'));

test('le manifeste décrit une application installable', () => {
  for (const champ of ['name', 'short_name', 'description', 'start_url', 'scope', 'id']) {
    assert.ok(typeof manifeste[champ] === 'string' && manifeste[champ].length > 0, `manifeste : « ${champ} » absent`);
  }
  assert.equal(manifeste.display, 'standalone');
  /* Relatifs au manifeste, lui-même à la racine du site : l'application
     couvre tout le site, et s'ouvre sur l'accueil. */
  assert.equal(manifeste.start_url, './');
  assert.equal(manifeste.scope, './');
  assert.equal(manifeste.lang, 'fr');
  assert.match(manifeste.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifeste.background_color, /^#[0-9a-f]{6}$/i);
});

test('chaque icône du manifeste existe, au format annoncé', () => {
  const tailles = new Set();
  for (const i of manifeste.icons) {
    const f = path.join(BASE, i.src);
    assert.ok(existsSync(f), `icône introuvable : ${i.src}`);
    const [l, h] = dimensionsPng(f);
    assert.equal(`${l}x${h}`, i.sizes, `${i.src} : annoncée ${i.sizes}, mesurée ${l}x${h}`);
    tailles.add(`${i.sizes}/${i.purpose}`);
  }
  for (const attendu of ['192x192/any', '512x512/any', '512x512/maskable']) {
    assert.ok(tailles.has(attendu), `aucune icône ${attendu}`);
  }
  for (const i of ICONES) {
    const [l, h] = dimensionsPng(path.join(BASE, i.fichier));
    assert.deepEqual([l, h], [i.taille, i.taille], `${i.fichier} : ${l}x${h}`);
  }
});

test('chaque raccourci du manifeste mène à une page qui existe', () => {
  assert.ok(Array.isArray(manifeste.shortcuts) && manifeste.shortcuts.length > 0);
  for (const r of manifeste.shortcuts) {
    assert.ok(r.name && r.url, 'raccourci incomplet');
    assert.ok(existsSync(fichierDe(r.url)), `raccourci « ${r.name} » : ${r.url} n'existe pas`);
  }
});

test('chaque page déclare l\'application et charge son installation', () => {
  for (const url of PAGES) {
    const dossier = path.join(BASE, url);
    const h = readFileSync(path.join(dossier, 'index.html'), 'utf8');
    const lien = (re, quoi) => {
      const m = h.match(re);
      assert.ok(m, `${url} : ${quoi} absent`);
      return path.resolve(dossier, m[1]);
    };
    assert.equal(lien(/<link rel="manifest" href="([^"]+)"/, 'lien vers le manifeste'),
      path.join(BASE, 'manifest.webmanifest'), `${url} : le manifeste pointe ailleurs`);
    const icone = lien(/<link rel="apple-touch-icon" href="([^"]+)"/, 'icône d\'écran d\'accueil');
    assert.ok(existsSync(icone), `${url} : icône d'écran d'accueil introuvable`);
    assert.equal(lien(/<script src="([^"]*installation\.js)"/, 'script d\'installation'),
      path.join(BASE, 'assets/js/installation.js'), `${url} : script d'installation mal pointé`);
  }
});

test('la liste hors connexion de sw.js correspond aux pages du site', () => {
  const sw = lire('sw.js');
  assert.ok(sw.includes(blocFichiers(fichiersHorsLigne())),
    'sw.js : la liste des fichiers ne correspond plus aux pages — relancer npm run app');
  for (const f of fichiersHorsLigne()) {
    assert.ok(existsSync(fichierDe(f)), `sw.js garde un fichier qui n'existe pas : ${f}`);
  }
  for (const url of PAGES) {
    assert.ok(fichiersHorsLigne().includes(url === '/' ? './' : url.slice(1)), `${url} absente de la liste hors connexion`);
  }
});

/* Les promesses écrites sur la page « Application » tiennent à ces lignes :
   si l'une disparaît, la page ment. */
test('le service worker ne touche qu\'aux fichiers du site, et ne télécharge rien de lui-même', () => {
  const sw = lire('sw.js');
  assert.doesNotMatch(sw, /https?:\/\//, 'sw.js : aucune adresse externe');
  assert.match(sw, /req\.method !== 'GET'/, 'seules les lectures passent par le service worker');
  assert.match(sw, /url\.origin !== self\.location\.origin/, 'les requêtes vers un autre domaine doivent être ignorées');
  /* Le seul endroit où il télécharge sans que la page l'ait demandé
     elle-même : la copie complète, déclenchée par un message. */
  const hors = sw.replace(/async function toutPrendre\(\)[\s\S]*?\n\}/, '').replace(/self\.addEventListener\('fetch'[\s\S]*?\n\}\);/, '');
  assert.doesNotMatch(hors, /fetch\(/, 'sw.js : téléchargement hors de la copie demandée et des requêtes de la page');
  assert.doesNotMatch(sw, /self\.addEventListener\('install'[^\n]*caches/, 'rien n\'est copié à l\'installation du service worker');
});

test('les scripts de l\'application n\'envoient rien', () => {
  for (const f of ['assets/js/installation.js', 'application/application.js']) {
    const s = lire(f);
    for (const interdit of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource']) {
      assert.ok(!s.includes(interdit), `${f} : ${interdit} interdit`);
    }
  }
});
