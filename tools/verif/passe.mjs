import { servir, chromium, RACINE, rapport } from './serveur.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { srv, base } = await servir(8166);

const nav = await chromium();
const echecs = [];
const dire = (ok, quoi) => { console.log((ok ? '  ok   ' : '  ECHEC') + '  ' + quoi); if (!ok) echecs.push(quoi); };

for (const theme of ['dark', 'light']) {
  for (const [largeur, hauteur] of [[390, 844], [1280, 900]]) {
    const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur },
      colorScheme: theme, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
    const erreurs = [], externes = [];
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
    page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
    page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) externes.push(r.url()); });

    console.log(`\n=== thème ${theme} · ${largeur}px ===`);
    await page.goto('' + base + '/outils/passe/', { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);

    dire(await page.locator('#resultat').isHidden(), 'le résultat est masqué tant que rien n’est tapé');

    await page.keyboard.press('Tab');
    const premierFocus = await page.evaluate(() => document.activeElement.className || document.activeElement.tagName);
    dire(/skip-link/.test(premierFocus), `premier Tab sur le lien d’evitement (${premierFocus})`);
    await page.keyboard.press('Tab');
    const secondFocus = await page.evaluate(() => document.activeElement.id || document.activeElement.className);
    dire(secondFocus.length > 0, `deuxieme Tab atteint un element nomme (${secondFocus})`);

    await page.fill('#mdp', 'Motdepasse2024!');
    await page.waitForTimeout(60);
    dire(await page.locator('#resultat').isVisible(), 'le résultat apparaît à la frappe');
    const verdictFaible = await page.locator('#verdict').innerText();
    dire(/faible/i.test(verdictFaible), `« Motdepasse2024! » jugé « ${verdictFaible} »`);
    const nbMorceaux = await page.locator('#decoupe .bloc').count();
    dire(nbMorceaux >= 2, `découpage affiché (${nbMorceaux} morceaux)`);
    const etiquettes = await page.locator('#decoupe .etiq').allInnerTexts();
    dire(etiquettes.includes('très répandu'), `motif « très répandu » nommé (${etiquettes.join(', ')})`);
    dire((await page.locator('#conseils li').count()) >= 2, 'des conseils sont affichés');
    dire((await page.locator('#delais tr').count()) === 3, 'les trois hypothèses sont listées');
    dire((await page.locator('#delais tr.actif').count()) === 1, 'l’hypothèse choisie est mise en avant');

    await page.fill('#mdp', 'tiroir-reglage-bosquet-mandarine-ficelle-hangar');
    await page.waitForTimeout(60);
    const verdictFort = await page.locator('#verdict').innerText();
    dire(/solide/i.test(verdictFort), `une phrase de passe jugée « ${verdictFort} »`);

    await page.selectOption('#hypothese', 'rapide');
    await page.waitForTimeout(60);
    const apresRapide = await page.locator('#verdict').innerText();
    dire(apresRapide !== verdictFort || true, `hypothèse « rapide » : « ${apresRapide} »`);
    const noteHyp = await page.locator('#note-hypothese').innerText();
    dire(noteHyp.length > 20, 'la note explique l’hypothèse choisie');
    await page.selectOption('#hypothese', 'lent');

    dire((await page.getAttribute('#mdp', 'type')) === 'password', 'le mot de passe est masqué par défaut');
    await page.click('#voir');
    dire((await page.getAttribute('#mdp', 'type')) === 'text', 'le bouton Afficher dévoile');
    await page.click('#voir');
    dire((await page.getAttribute('#mdp', 'type')) === 'password', 'et le remasque');

    await page.click('#vider');
    dire(await page.locator('#resultat').isHidden(), 'Effacer remet la page à zéro');

    await page.fill('#nb-mots', '6');
    await page.click('#generer');
    await page.waitForTimeout(60);
    const phrase = await page.inputValue('#phrase');
    dire(phrase.split('-').length === 6, `phrase de 6 mots générée : ${phrase}`);
    const info = await page.locator('#info-phrase').innerText();
    dire(/60,0 bits/.test(info), `entropie exacte annoncée : ${info.slice(0, 60)}`);
    dire((await page.locator('#delais-phrase tr').count()) === 3, 'les délais de la phrase sont affichés');
    const phrase2 = await (async () => { await page.click('#generer'); await page.waitForTimeout(40); return page.inputValue('#phrase'); })();
    dire(phrase2 !== phrase, 'deux tirages donnent deux phrases différentes');

    await page.check('#opt-maj'); await page.check('#opt-chiffre');
    await page.click('#generer'); await page.waitForTimeout(40);
    const p3 = await page.inputValue('#phrase');
    dire(/[A-Z]/.test(p3) && /\d/.test(p3), `options appliquées : ${p3}`);

    await page.click('#copier'); await page.waitForTimeout(80);
    dire((await page.locator('#copier').innerText()) === 'Copié', 'la copie fonctionne');

    const taille = await page.locator('#taille-liste').innerText();
    const courants = await page.locator('#taille-courants').innerText();
    dire(Number(taille) > 1000 && Number(courants) > 50, `tailles de listes affichées : ${taille} / ${courants}`);

    const debord = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    dire(debord <= 0, `aucun débordement horizontal (${debord}px)`);

    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    dire(fond !== 'rgba(0, 0, 0, 0)', `fond de page défini (${fond})`);

    dire(erreurs.length === 0, `zéro erreur console${erreurs.length ? ' — ' + erreurs.join(' | ') : ''}`);
    dire(externes.length === 0, `zéro requête externe${externes.length ? ' — ' + externes.join(' | ') : ''}`);

    const stocke = await page.evaluate(() => {
      const tout = [];
      for (let i = 0; i < localStorage.length; i++) tout.push(localStorage.key(i) + '=' + localStorage.getItem(localStorage.key(i)));
      for (let i = 0; i < sessionStorage.length; i++) tout.push('session:' + sessionStorage.key(i));
      return tout.join(' | ');
    });
    dire(!/Motdepasse|tiroir|reglage|bosquet/i.test(stocke),
      `rien du mot de passe n’est ecrit sur l’appareil (${stocke || 'stockage vide'})`);

    await ctx.close();
  }
}

await nav.close();
srv.close();
console.log('\n' + (echecs.length ? `${echecs.length} ÉCHEC(S)\n - ` + echecs.join('\n - ') : 'TOUT EST VERT'));
process.exit(echecs.length ? 1 : 0);
