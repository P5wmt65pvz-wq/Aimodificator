import { servir, chromium, PAGES, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8165);

const nav = await chromium();
const pb=[];
const titres=new Map(), descs=new Map();

for (const url of PAGES) {
  for (const [w,h,theme] of [[390,844,'dark'],[1280,900,'light']]) {
    const ctx=await nav.newContext({viewport:{width:w,height:h},colorScheme:theme});
    const page=await ctx.newPage();
    const erreurs=[],externes=[];
    page.on('console',m=>{if(m.type()==='error')erreurs.push(m.text())});
    page.on('pageerror',e=>erreurs.push('pageerror: '+e.message));
    page.on('request',r=>{const u=r.url();if(!u.startsWith(base)&&!u.startsWith('data:'))externes.push(u)});
    const rep=await page.goto(base+url,{waitUntil:'networkidle'});
    await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
    await page.waitForTimeout(80);

    const ajoute=(m)=>pb.push(`${url} [${theme} ${w}px] ${m}`);
    if(rep.status()!==200) ajoute(`statut ${rep.status()}`);
    if(erreurs.length) ajoute('erreur console : '+erreurs.join(' | '));
    if(externes.length) ajoute('requête externe : '+externes.join(' | '));

    const d=await page.evaluate(()=>({
      debord: document.documentElement.scrollWidth-document.documentElement.clientWidth,
      titre: document.title,
      desc: (document.querySelector('meta[name=description]')||{}).content||'',
      canon: (document.querySelector('link[rel=canonical]')||{}).href||'',
      lang: document.documentElement.lang,
      fond: getComputedStyle(document.body).backgroundColor,
      h1: document.querySelectorAll('h1').length,
      idsDup: (()=>{const v={},d=[];document.querySelectorAll('[id]').forEach(e=>{if(v[e.id])d.push(e.id);v[e.id]=1});return d})(),
      imgSansAlt: [...document.querySelectorAll('img')].filter(i=>!i.hasAttribute('alt')).length,
      btnMuets: [...document.querySelectorAll('button')].filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length,
      liensVides: [...document.querySelectorAll('a')].filter(a=>!a.textContent.trim()&&!a.getAttribute('aria-label')).length,
      internes: [...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>!/^(https?:|mailto:|#)/.test(h)),
    }));
    if(d.debord>0) ajoute(`débordement ${d.debord}px`);
    if(!d.titre||d.titre.length<20) ajoute(`titre court : « ${d.titre} »`);
    if(!d.desc||d.desc.length<60) ajoute(`description courte (${d.desc.length})`);
    if(!d.canon) ajoute('canonical absent');
    if(!d.lang) ajoute('attribut lang absent');
    if(d.fond==='rgba(0, 0, 0, 0)') ajoute('fond de page non défini');
    if(d.h1!==1) ajoute(`${d.h1} balises h1`);
    if(d.idsDup.length) ajoute('identifiants en double : '+d.idsDup.join(', '));
    if(d.imgSansAlt) ajoute(`${d.imgSansAlt} image(s) sans alt`);
    if(d.btnMuets) ajoute(`${d.btnMuets} bouton(s) sans nom`);
    if(d.liensVides) ajoute(`${d.liensVides} lien(s) sans texte`);

    if(theme==='light'&&w===1280){
      if(titres.has(d.titre)) ajoute(`titre identique à ${titres.get(d.titre)}`); else titres.set(d.titre,url);
      if(descs.has(d.desc)) ajoute(`description identique à ${descs.get(d.desc)}`); else descs.set(d.desc,url);
      for(const h of d.internes){
        const cible=new URL(h,base+url).pathname;
        const f=path.join(RACINE,cible.endsWith('/')?cible+'index.html':cible);
        if(!fs.existsSync(f)) ajoute(`lien mort : ${h} -> ${cible}`);
      }
    }
    await ctx.close();
  }
}
// sitemap
const sm=fs.readFileSync(path.join(RACINE,'sitemap.xml'),'utf8');
for(const u of PAGES){ if(!sm.includes('Aimodificator'+u)) pb.push(`sitemap : ${u} absent`); }
const nb=(sm.match(/<loc>/g)||[]).length;
console.log(`sitemap : ${nb} adresses pour ${PAGES.length} pages vérifiées`);

await nav.close(); srv.close();
console.log(pb.length ? `\n${pb.length} DÉFAUT(S) :\n - `+pb.join('\n - ') : '\nAUCUN DÉFAUT TROUVÉ sur les '+PAGES.length+' pages');
process.exit(pb.length?1:0);
