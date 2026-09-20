import { servir, chromium, PAGES, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8161);

/* Amène chaque page dans l'état où elle affiche ses couleurs sémantiques. */
async function reveler(page, url) {
  const tape = async (sel, v) => { const e = await page.$(sel); if (e) await e.fill(v).catch(() => {}); };
  const clic = async (sel) => { const e = await page.$(sel); if (e) await e.click({ timeout: 2000 }).catch(() => {}); };
  if (url === '/') {
    await tape('#request', 'Rédige un court article sur le vélo en ville pour des débutants');
    await clic('#generate');
    await clic('#tab-analysis');
  } else if (url.includes('passe')) {
    /* Les cinq niveaux de verdict, l'un après l'autre : chacun a sa couleur. */
    for (const mdp of ['123456', 'Sophie2008', 'Motdepasse2024!azerty', 'tiroir-reglage-bosquet', 'Xk9$mQ2vLp7w-tiroir-reglage-bosquet-hangar']) {
      await tape('#mdp', mdp);
      await page.waitForTimeout(40);
      const v = await page.evaluate(() => { const e = document.querySelector('#verdict'); return e ? { t: e.innerText, c: e.className } : null; });
      if (v) await page.evaluate((cl) => { window.__vus = (window.__vus || []); window.__vus.push(cl); }, v.c);
    }
    await clic('#generer');
  } else if (url.includes('abonnements')) {
    await tape('#nom', 'Un service'); await tape('#prix', '9,99');
    const d = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    await tape('#depart', d);
    await clic('#ajout button[type=submit]');
    await page.evaluate(() => { const f = document.getElementById('ajout'); if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true})); });
  } else if (url.includes('clause')) {
    await tape('#texte', 'Nous pouvons vendre vos données à des partenaires commerciaux. Vos données sont conservées sans limitation de durée et transférées hors de l\u2019Union européenne. En poursuivant votre navigation, vous consentez à ce traitement. Nous nous réservons le droit de modifier cette politique à tout moment sans vous en informer.');
    await page.waitForTimeout(120);
  }
}

const nav = await chromium();
const fautes = [];

for (const url of PAGES) {
  for (const theme of ['dark', 'light']) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    /* Ouvrir les panneaux repliés : leur contenu compte aussi. */
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));

    /* Faire APPARAÎTRE les éléments dynamiques. Les pastilles de verdict,
       les constats et les scores n'existent pas au chargement : un balayage
       de la page nue ne les mesure jamais, et c'est exactement là que les
       pires contrastes se cachaient. */
    await reveler(page, url);
    await page.waitForTimeout(150);

    const mauvais = await page.evaluate(() => {
      const lum = (c) => {
        const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
      };
      const rgb = (s) => {
        const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
        const p = m[1].split(',').map(x => parseFloat(x));
        return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
      };
      /* Fond effectif : on remonte les ancêtres jusqu'à un fond opaque. */
      const fondDe = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const b = rgb(getComputedStyle(n).backgroundColor);
          if (b && b.a > 0.85) return b.c;
          n = n.parentElement;
        }
        const b = rgb(getComputedStyle(document.body).backgroundColor);
        return b ? b.c : [255, 255, 255];
      };
      const ratio = (a, b) => {
        const l1 = lum(a), l2 = lum(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        /* Seulement les éléments qui portent eux-mêmes du texte visible. */
        const propre = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        if (!propre) continue;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.1) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const av = rgb(st.color); if (!av) continue;
        const px = parseFloat(st.fontSize);
        const gras = parseInt(st.fontWeight, 10) >= 700;
        const grand = px >= 24 || (gras && px >= 18.66);
        const exige = grand ? 3 : 4.5;
        const obtenu = ratio(av.c, fondDe(el));
        if (obtenu < exige) {
          out.push({
            sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
            txt: propre.slice(0, 40), px: Math.round(px * 10) / 10,
            obtenu: Math.round(obtenu * 100) / 100, exige
          });
        }
      }
      return out;
    });

    if (mauvais.length) {
      console.log(`\n${url} [${theme}] — ${mauvais.length} texte(s) sous la norme`);
      const vus = new Set();
      for (const m of mauvais) {
        const cle = m.sel + '|' + m.obtenu;
        if (vus.has(cle)) continue; vus.add(cle);
        console.log(`  ${String(m.obtenu).padStart(5)}:1 (exigé ${m.exige}) ${m.px}px  ${m.sel}  « ${m.txt} »`);
        fautes.push(`${url} [${theme}] ${m.sel} ${m.obtenu}:1 < ${m.exige}`);
      }
    }
    await ctx.close();
  }
}
await nav.close(); srv.close();
console.log('\n' + (fautes.length ? `${fautes.length} texte(s) sous la norme de contraste` : 'AUCUN DÉFAUT — tous les textes respectent le contraste WCAG AA'));
process.exit(fautes.length ? 1 : 0);
