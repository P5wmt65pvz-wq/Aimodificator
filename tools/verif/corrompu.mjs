import { servir, chromium, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8164);

const nav = await chromium();
const pb = [];
const dire = (ok, quoi) => { console.log((ok?'  ok   ':'  ECHEC') + '  ' + quoi); if (!ok) pb.push(quoi); };

/* Valeurs qu'on peut réellement trouver dans un stockage local abîmé. */
const POISONS = [
  ['chaîne vide', ''],
  ['espace', ' '],
  ['JSON invalide', '{{{'],
  ['JSON tronqué', '[{"nom":"Netflix","prix":'],
  ['nombre', '42'],
  ['chaîne JSON', '"bonjour"'],
  ['null', 'null'],
  ['true', 'true'],
  ['objet au lieu de tableau', '{"a":1}'],
  ['tableau de nombres', '[1,2,3]'],
  ['tableau de null', '[null,null]'],
  ['entrées sans nom', '[{"prix":10,"cycle":"mensuel"}]'],
  ['prix non numérique', '[{"nom":"X","prix":"beaucoup","cycle":"mensuel"}]'],
  ['prix négatif', '[{"nom":"X","prix":-5,"cycle":"mensuel"}]'],
  ['prix infini', '[{"nom":"X","prix":1e999,"cycle":"mensuel"}]'],
  ['cycle inventé', '[{"nom":"X","prix":10,"cycle":"lunaire"}]'],
  ['date absurde', '[{"nom":"X","prix":10,"cycle":"mensuel","depart":"pas une date"}]'],
  ['date de l’an 9999', '[{"nom":"X","prix":10,"cycle":"mensuel","depart":"9999-12-31"}]'],
  ['date de l’an 0001', '[{"nom":"X","prix":10,"cycle":"mensuel","depart":"0001-01-01"}]'],
  ['nom géant', '[{"nom":"' + 'A'.repeat(50000) + '","prix":10,"cycle":"mensuel"}]'],
  ['injection HTML dans le nom', '[{"nom":"<img src=x onerror=window.__PWN=1>","prix":10,"cycle":"mensuel"}]'],
  ['mille entrées', JSON.stringify(Array.from({length:1000},(_,i)=>({nom:'Abo '+i,prix:i%97,cycle:['mensuel','annuel','hebdomadaire','trimestriel'][i%4],depart:'2025-0'+(1+i%9)+'-15'})))],
  ['champs inattendus', '[{"nom":"X","prix":10,"cycle":"mensuel","__proto__":{"pollue":true},"constructor":1}]'],
];

const CIBLES = [
  ['/outils/abonnements/', 'abonnements.liste'],
  ['/outils/abonnements/', 'abonnements.theme'],
  ['/outils/passe/', 'passe.theme'],
  ['/outils/clause/', 'clause.theme'],
  ['/outils/photo/', 'photo.theme'],
  ['/outils/empreinte/', 'empreinte.theme'],
  ['/outils/vrai-prix/', 'vraiprix.theme'],
  ['/outils/partage/', 'partage.theme'],
];

for (const [url, cle] of CIBLES) {
  console.log(`\n=== ${url} — clé « ${cle} » ===`);
  for (const [nom, valeur] of POISONS) {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });
    page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));

    /* On empoisonne AVANT que le script de la page tourne. */
    await page.addInitScript(([c, v]) => { try { localStorage.setItem(c, v); } catch (e) {} }, [cle, valeur]);
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(60);

    const etat = await page.evaluate(() => ({
      h1: !!document.querySelector('h1'),
      texte: (document.body.innerText || '').length,
      pwn: !!window.__PWN,
      nan: /NaN|Infinity|undefined|\[object/.test(document.body.innerText || ''),
      debord: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));

    const souci = [];
    if (erreurs.length) souci.push('console: ' + erreurs[0].slice(0, 80));
    if (!etat.h1) souci.push('la page ne s’affiche plus');
    if (etat.texte < 200) souci.push('page quasi vide (' + etat.texte + ' car.)');
    if (etat.pwn) souci.push('INJECTION HTML EXECUTEE');
    if (etat.nan) souci.push('« NaN / Infinity / undefined / [object » visible à l’écran');
    if (etat.debord > 0) souci.push('débordement ' + etat.debord + 'px');
    dire(souci.length === 0, `${nom} : ${souci.length ? souci.join(' ; ') : 'la page tient'}`);
    await ctx.close();
  }
}

await nav.close(); srv.close();
console.log('\n' + (pb.length ? `${pb.length} DÉFAUT(S) :\n - ` + pb.join('\n - ') : 'AUCUN DÉFAUT — le stockage corrompu ne casse aucune page'));
process.exit(pb.length ? 1 : 0);
