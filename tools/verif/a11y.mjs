import { servir, chromium, PAGES, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8162);

const nav = await chromium();
const pb = [];
const note = (q) => { pb.push(q); console.log('  DÉFAUT  ' + q); };

for (const url of PAGES) {
  console.log('\n=== ' + url + ' ===');
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

  /* --- structure lue par un lecteur d'écran --- */
  const st = await page.evaluate(() => {
    const titres = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(h => h.offsetParent !== null || h.tagName === 'H1')
      .map(h => ({ n: +h.tagName[1], t: h.innerText.trim().slice(0, 40) }));
    const sauts = [];
    for (let i = 1; i < titres.length; i++) {
      if (titres[i].n > titres[i-1].n + 1) sauts.push(`h${titres[i-1].n} -> h${titres[i].n} avant « ${titres[i].t} »`);
    }
    return {
      h1: document.querySelectorAll('h1').length,
      sauts,
      main: document.querySelectorAll('main').length,
      header: document.querySelectorAll('header').length,
      footer: document.querySelectorAll('footer').length,
      lang: document.documentElement.lang,
      titresVides: titres.filter(t => !t.t).length,
      /* Un champ sans étiquette est un champ qu'un lecteur d'écran annonce
         comme « zone de saisie », sans dire ce qu'on doit y mettre. */
      champsSansNom: [...document.querySelectorAll('input,select,textarea')].filter(e => {
        if (e.type === 'hidden' || e.hasAttribute('hidden')) return false;
        /* Un champ que personne ne voit n'est pas annoncé non plus : le champ
           fichier de Photo est masqué derrière une zone de dépôt qui porte,
           elle, son rôle et son étiquette. */
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;
        if (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title')) return false;
        if (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) return false;
        return !e.closest('label');
      }).map(e => e.id || e.name || e.tagName)
    };
  });
  if (st.h1 !== 1) note(`${url} : ${st.h1} balise(s) h1`);
  if (st.sauts.length) note(`${url} : niveau de titre sauté — ${st.sauts.join(' ; ')}`);
  if (st.main !== 1) note(`${url} : ${st.main} balise(s) <main>`);
  if (!st.header) note(`${url} : pas de <header>`);
  if (!st.footer) note(`${url} : pas de <footer>`);
  if (!st.lang) note(`${url} : attribut lang absent`);
  if (st.titresVides) note(`${url} : ${st.titresVides} titre(s) vide(s)`);
  if (st.champsSansNom.length) note(`${url} : champ(s) sans étiquette — ${st.champsSansNom.join(', ')}`);
  if (st.h1 === 1 && !st.sauts.length && st.main === 1 && !st.champsSansNom.length) {
    console.log(`  structure : 1 h1, hiérarchie continue, lang=${st.lang}, tout champ étiqueté`);
  }

  /* --- navigation au clavier : chaque arrêt doit se voir --- */
  const nbFocus = await page.evaluate(() =>
    document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])').length);
  let sansMarque = [], vus = new Set(), piege = null, precedent = null, repet = 0;
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < Math.min(nbFocus + 4, 70); i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const st = getComputedStyle(e);
      const id = (e.id || '') + '|' + e.tagName + '|' + (e.className || '').toString().slice(0, 30) + '|' + (e.innerText || '').slice(0, 15);
      /* Un contour visible, une ombre portée ou une bordure changée : il faut
         AU MOINS un signe que le focus est là. */
      const marque = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0)
        || (st.boxShadow && st.boxShadow !== 'none');
      return { id, marque, tag: e.tagName };
    });
    if (!f) continue;
    /* Trois fois de suite sur le même élément : la tabulation n'avance plus. */
    if (f.id === precedent) { if (++repet >= 2) { piege = f.id; break; } } else { repet = 0; }
    precedent = f.id;
    if (vus.has(f.id)) break;   /* le cycle a bouclé : c'est le comportement attendu */
    vus.add(f.id);
    if (!f.marque) sansMarque.push(f.id.split('|').slice(0, 2).join(' '));
  }
  if (sansMarque.length) note(`${url} : ${sansMarque.length} arrêt(s) de tabulation sans marque visible — ${[...new Set(sansMarque)].slice(0, 4).join(', ')}`);
  if (piege) note(`${url} : la tabulation tourne en rond sur ${piege.split('|')[1]}`);
  if (!sansMarque.length && !piege) console.log(`  clavier   : ${vus.size} arrêts, tous visibles, aucun blocage`);
  await ctx.close();

  /* --- écrans étroits et texte grossi --- */
  for (const [larg, zoom, nom] of [[320, 1, '320 px'], [360, 1, '360 px'], [390, 1, '390 px'],
                                    [390, 2, '390 px + texte doublé'], [768, 1.5, 'tablette + 150 %']]) {
    const c2 = await nav.newContext({ viewport: { width: larg, height: 800 }, deviceScaleFactor: 1 });
    const p2 = await c2.newPage();
    await p2.goto(base + url, { waitUntil: 'networkidle' });
    if (zoom !== 1) await p2.evaluate(z => { document.documentElement.style.fontSize = (100 * z) + '%'; }, zoom);
    await p2.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await p2.waitForTimeout(90);
    const r = await p2.evaluate(() => {
      const de = document.documentElement;
      const coupables = [];
      if (de.scrollWidth > de.clientWidth) {
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width > 0 && b.right > de.clientWidth + 1) {
            coupables.push(el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' dépasse de ' + Math.round(b.right - de.clientWidth) + 'px');
            if (coupables.length >= 3) break;
          }
        }
      }
      /* Zone tactile : 24x24 px est le plancher WCAG 2.2. */
      const zone = (e) => {
        /* Cliquer le texte d'un label actionne la case : la cible est donc le
           label entier, pas le petit carré. */
        const lab = (e.tagName === 'INPUT') ? e.closest('label') : null;
        return (lab || e).getBoundingClientRect();
      };
      const petits = [...document.querySelectorAll('a[href],button,input[type=checkbox],input[type=radio],summary')]
        .filter(e => {
          const b = zone(e);
          if (b.width < 1 || b.height < 1) return false;           /* replié ou masqué */
          if (getComputedStyle(e).display === 'inline') return false; /* lien dans un paragraphe */
          return b.width < 24 || b.height < 24;
        })
        .map(e => { const b = zone(e); return (e.id || e.tagName.toLowerCase()) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height); });
      return { debord: de.scrollWidth - de.clientWidth, coupables, petits: [...new Set(petits)] };
    });
    if (r.debord > 0) note(`${url} [${nom}] : débordement de ${r.debord}px — ${r.coupables.join(' ; ') || 'coupable non identifié'}`);
    if (r.petits.length) note(`${url} [${nom}] : ${r.petits.length} zone(s) tactile(s) sous 24px — ${r.petits.slice(0, 3).join(', ')}`);
    await c2.close();
  }
  if (!pb.some(x => x.startsWith(url + ' ['))) {
    console.log('  écrans    : 320, 360, 390 px, texte doublé, tablette à 150 % — rien ne déborde');
  }
}

/* --- animations réduites --- */
console.log('\n=== respect de « animations réduites » ===');
for (const url of PAGES) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + url, { waitUntil: 'networkidle' });
  const anim = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
    const s = getComputedStyle(e);
    const d = parseFloat(s.transitionDuration) + parseFloat(s.animationDuration);
    return d > 0.08;
  }).length);
  if (anim > 0) note(`${url} : ${anim} élément(s) animé(s) malgré « animations réduites »`);
  await ctx.close();
}
if (!pb.some(x => x.includes('animation'))) console.log('  ok — toutes les pages respectent la préférence');

await nav.close(); srv.close();
console.log('\n' + (pb.length ? `${pb.length} DÉFAUT(S)` : 'AUCUN DÉFAUT — accessibilité et adaptation à l’écran'));
process.exit(pb.length ? 1 : 0);
