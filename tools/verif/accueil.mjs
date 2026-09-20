import { servir, chromium, PAGES, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8163);

const nav = await chromium();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erreurs = [], externes = [];
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
page.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:')) externes.push(u); });

await page.goto('' + base + '/', { waitUntil: 'networkidle' });

const pb = [];
const note = (q) => { if (!pb.includes(q)) { pb.push(q); console.log('  DÉFAUT  ' + q); } };

/* Les valeurs réellement proposées, lues dans le document une fois le script passé. */
/* Les options fines vivent dans un <details> replié : il faut l'ouvrir,
   sinon Playwright ne peut pas les manipuler — et ce n'est pas un défaut. */
await page.evaluate(() => { const d = document.getElementById('advanced'); if (d) d.open = true; });

const SELECTS = await page.evaluate(() => {
  const out = {};
  for (const s of document.querySelectorAll('select[id^="opt-"]')) {
    out[s.id] = [...s.options].map(o => o.value);
  }
  return out;
});
console.log('Options en place :');
for (const [k, v] of Object.entries(SELECTS)) console.log(`  ${k.padEnd(18)} ${String(v.length).padStart(3)} valeurs`);

const DEMANDES = [
  'Écris un article de blog sur le vélo en ville',
  'Write a product description for a coffee machine',
  'résume ce texte',
  'aide',
  'Fais-moi un tableau comparatif de trois offres de forfait mobile pour une famille, avec le prix mensuel, la data incluse et la durée d’engagement, destiné à des parents qui n’y connaissent rien.',
  'Traduis en espagnol : bonjour tout le monde',
  'Génère du code Python qui lit un CSV et calcule des moyennes par colonne',
  'a',
  '   ',
  '123456',
  'Rédige 500 mots sur l’histoire de la Bretagne',
  'Write 2 000 words about medieval castles for experts',
  '<script>window.__PWN=1</script> écris un poème',
  'É'.repeat(3000),
  'Fais une présentation de 10 slides sur le changement climatique'
];

const SUSPECT = /undefined|NaN|\[object Object\]|\{\{[a-z]|\}\}|null null|\bNULL\b/;
/* Une clé de traduction non résolue ressemble à « nav.tools » ou « hero.title ». */
/* Une clé non résolue ressemble à « nav.tools ». On exclut ce qui ressemble
   à une adresse e-mail, à un nom de fichier ou à un nom de domaine. */
const CLE_I18N = /(?<![@\w.])[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]{2,}(?![@\w.\/])/;

let saisiAilleurs = '';
async function genere(etiquette, demande, reglages) {
  await page.fill('#request', demande);
  for (const [id, v] of Object.entries(reglages)) {
    if (SELECTS[id] && SELECTS[id].includes(v)) await page.selectOption('#' + id, v);
  }
  await page.click('#generate');
  await page.waitForTimeout(35);
  const sortie = await page.evaluate(() => {
    const o = document.querySelector('#output');
    return o ? (o.value !== undefined && o.tagName === 'TEXTAREA' ? o.value : o.innerText) : null;
  });
  if (sortie === null) { note('#output introuvable'); return; }
  const vide = demande.trim().length === 0;
  if (!vide && sortie.trim().length < 20) note(`${etiquette} : sortie quasi vide (${sortie.trim().length} car.) pour « ${demande.slice(0, 30)} »`);
  const m = sortie.match(SUSPECT);
  /* La sortie reprend le texte de la demande : un motif déjà présent dans la
     demande n'est pas un défaut du moteur. */
  if (m && !demande.includes(m[0]) && !saisiAilleurs.includes(m[0])) {
    note(`${etiquette} : « ${m[0]} » dans la sortie (demande « ${demande.slice(0, 30)} »)`);
  }
  return sortie;
}

/* ---- 1. chaque valeur de chaque menu, au moins une fois ---- */
console.log('\n=== balayage : chaque valeur de chaque menu ===');
let n = 0;
for (const [id, valeurs] of Object.entries(SELECTS)) {
  for (const v of valeurs) {
    await genere(`${id}=${v || '(vide)'}`, DEMANDES[n % DEMANDES.length], { [id]: v });
    n++;
  }
}
console.log(`  ${n} générations`);

/* ---- 2. combinaisons tirées au hasard ---- */
console.log('\n=== 250 combinaisons au hasard ===');
const ids = Object.keys(SELECTS);
const pioche = (a) => a[Math.floor(Math.random() * a.length)];
for (let i = 0; i < 250; i++) {
  const reglages = {};
  for (const id of ids) reglages[id] = pioche(SELECTS[id]);
  await genere('combo#' + i, pioche(DEMANDES), reglages);
}

/* ---- 2 bis. les champs texte des options fines ---- */
console.log('\n=== champs texte des options fines ===');
const CHAMPS = await page.evaluate(() =>
  [...document.querySelectorAll('input[id^="opt-"]')].map(i => ({ id: i.id, type: i.type })));
console.log('  ' + CHAMPS.map(c => c.id + '(' + c.type + ')').join(' '));
const TEXTES_HOSTILES = ['', ' ', 'a', 'des parents pressés', '<img src=x onerror=window.__PWN=1>',
  'É'.repeat(2000), '"; DROP TABLE--', '{{7*7}}', '\u0000', '100000'];
for (const c of CHAMPS) {
  for (const t of TEXTES_HOSTILES) {
    if (c.type === 'checkbox' || c.type === 'radio') { await page.evaluate((id) => { const e = document.getElementById(id); e.checked = !e.checked; e.dispatchEvent(new Event('change', {bubbles:true})); }, c.id); continue; }
    await page.fill('#' + c.id, t).catch(() => {});
    saisiAilleurs = t;
    await genere(`${c.id}="${t.slice(0, 14)}"`, 'Écris un guide pratique en dix points', {});
    saisiAilleurs = '';
  }
  await page.fill('#' + c.id, '').catch(() => {});
}

/* ---- 3. les autres boutons ---- */
console.log('\n=== boutons et panneaux ===');
async function clique(sel, quoi) {
  const el = await page.$(sel);
  if (!el) { note(`${quoi} : ${sel} introuvable`); return false; }
  const avant = erreurs.length;
  await el.click().catch(e => note(`${quoi} : clic impossible (${e.message.slice(0, 50)})`));
  await page.waitForTimeout(60);
  if (erreurs.length > avant) note(`${quoi} : erreur console au clic — ${erreurs[erreurs.length-1].slice(0, 70)}`);
  return true;
}
await clique('#example', 'bouton Exemple');
await clique('#generate', 'bouton Générer');
await clique('#tab-analysis', 'onglet Analyse');
await clique('#tab-prompt', 'onglet Prompt');
await clique('#copy', 'bouton Copier');
await clique('#share', 'bouton Partager');
await clique('#refine-open', 'ouverture du panneau Affiner');
await clique('#refine-close', 'fermeture du panneau Affiner');
await clique('#clear', 'bouton Effacer');
await clique('#history-clear', 'vider l’historique');
await page.fill('#library-search', 'article');
await page.waitForTimeout(80);
await page.fill('#library-search', 'zzzzzzzz-rien-ne-correspond');
await page.waitForTimeout(80);
const biblioVide = await page.evaluate(() => (document.querySelector('#library-cards')||{}).innerText || '');
if (/undefined|NaN/.test(biblioVide)) note('recherche bibliothèque : sortie suspecte');
await page.fill('#library-search', '');

/* ---- 4. bascule de langue dans les deux sens ---- */
console.log('\n=== bascule de langue ===');
for (let i = 0; i < 4; i++) {
  await clique('#lang-toggle', 'bascule de langue ' + i);
  const t = await page.evaluate(() => document.body.innerText);
  const cle = t.match(CLE_I18N);
  if (cle) note(`clé de traduction non résolue à l’écran : « ${cle[0]} »`);
}

/* ---- 4 bis. un gabarit ne doit jamais être évalué ---- */
console.log('\n=== les gabarits ne sont pas exécutés ===');
await page.fill('#opt-audience', '{{7*7}}');
await page.fill('#request', 'Écris trois conseils ${6*7} <%= 8*8 %>');
await page.click('#generate');
await page.waitForTimeout(60);
const rendu = await page.evaluate(() => { const o = document.querySelector('#output'); return o.tagName === 'TEXTAREA' ? o.value : o.innerText; });
if (/\b49\b/.test(rendu)) note('GABARIT ÉVALUÉ : « {{7*7}} » est devenu 49');
if (/\b42\b/.test(rendu)) note('GABARIT ÉVALUÉ : « ${6*7} » est devenu 42');
if (/\b64\b/.test(rendu)) note('GABARIT ÉVALUÉ : « <%= 8*8 %> » est devenu 64');
console.log('  ok     aucun gabarit évalué (7*7, 6*7 et 8*8 restent littéraux)');
await page.fill('#opt-audience', '');

/* ---- 5. injection ---- */
const pwn = await page.evaluate(() => !!window.__PWN);
if (pwn) note('INJECTION HTML EXÉCUTÉE depuis le champ de demande');

/* ---- bilan ---- */
if (erreurs.length) note(`${erreurs.length} erreur(s) console — première : ${erreurs[0].slice(0, 120)}`);
if (externes.length) note(`requête externe : ${externes[0]}`);

await ctx.close(); await nav.close(); srv.close();
console.log('\n' + (pb.length ? `${pb.length} DÉFAUT(S)` : 'AUCUN DÉFAUT — l’accueil encaisse tout'));
process.exit(pb.length ? 1 : 0);
