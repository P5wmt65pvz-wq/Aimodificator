/* Les cinq outils qui n'avaient aucun contrôle de bout en bout.
 *
 * Les autres suites vérifient que les pages sont lisibles, navigables au
 * clavier et qu'elles encaissent des entrées hostiles. Aucune ne vérifiait
 * qu'elles FONCTIONNENT — qu'on dépose une photo et qu'elle rend la bonne
 * position, qu'on saisit deux abonnements et que le total est juste.
 *
 * Un outil peut être parfaitement accessible et donner un résultat faux.
 */
import { servir, chromium, RACINE, rapport } from './serveur.mjs';
import { construitJpeg } from './jpeg.mjs';
import path from 'node:path';

const { srv, base } = await servir(8168);
const nav = await chromium();
const pb = [];
const dire = (ok, quoi) => { console.log((ok ? '  ok   ' : '  ECHEC') + '  ' + quoi); if (!ok) pb.push(quoi); };

/* Chaque page est ouverte dans un contexte neuf : une erreur de console ou une
   requête sortante sur l'une ne doit pas être imputée à la suivante. */
async function ouvrir(chemin) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const erreurs = [], externes = [];
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) externes.push(r.url()); });
  await page.goto(base + chemin, { waitUntil: 'networkidle' });
  return { ctx, page, erreurs, externes };
}

async function fermer(nom, { ctx, page, erreurs, externes }) {
  dire(erreurs.length === 0, `${nom} : aucune erreur console${erreurs.length ? ' → ' + erreurs[0] : ''}`);
  dire(externes.length === 0, `${nom} : aucune requête sortante${externes.length ? ' → ' + externes[0] : ''}`);
  await ctx.close();
}

/* ------------------------------------------------------------------ Photo */
console.log('\n=== Photo propre — une vraie photo géolocalisée ===');
{
  const c = await ouvrir('/outils/photo/');
  /* Un vrai JPEG, pas seulement un bloc EXIF : l'outil lit la structure du
     fichier, il faut donc lui donner un fichier. Position par défaut de la
     fabrique : 48°51'30" N, 2°17'40" E. */
  const jpeg = construitJpeg({ exif: true });
  await c.page.setInputFiles('#fichier', {
    name: 'vacances.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg)
  });
  await c.page.waitForTimeout(400);

  dire(await c.page.locator('#resultat').isVisible(), 'Photo : le résultat apparaît');
  dire(await c.page.locator('#carte').isVisible(), 'Photo : la position est signalée');
  const coord = await c.page.locator('#coord').innerText();
  dire(/48/.test(coord) && /2/.test(coord), `Photo : les coordonnées sont lues (${coord.slice(0, 40)})`);
  const cartes = await c.page.locator('#liste .card').count();
  dire(cartes >= 3, `Photo : les métadonnées sont listées (${cartes} constats)`);
  const tout = await c.page.locator('#liste').innerText();
  dire(/Canon|EOS/i.test(tout), 'Photo : l’appareil est nommé');
  dire(/2024/.test(tout), 'Photo : la date de prise de vue est lue');
  dire(await c.page.locator('#telecharger').isVisible(), 'Photo : la version nettoyée est proposée');
  await fermer('Photo', c);
}

/* ----------------------------------------------------------------- Clause */
console.log('\n=== Clause — une politique qui coche toutes les cases ===');
{
  const c = await ouvrir('/outils/clause/');
  await c.page.fill('#texte', 'Nous pouvons vendre vos données à des partenaires commerciaux. '
    + 'Vos données sont conservées sans limitation de durée et transférées hors de l’Union '
    + 'européenne. En poursuivant votre navigation, vous consentez à ce traitement. Nous nous '
    + 'réservons le droit de modifier cette politique à tout moment sans vous en informer.');
  await c.page.waitForTimeout(300);

  dire(await c.page.locator('#resultat').isVisible(), 'Clause : le résultat apparaît');
  const verdict = await c.page.locator('#verdict').innerText();
  dire(verdict.trim().length > 0, `Clause : un verdict est rendu (${verdict.slice(0, 40)})`);
  const trouves = await c.page.locator('#liste .card').count();
  dire(trouves >= 3, `Clause : les passages qui comptent sont relevés (${trouves})`);
  const texte = await c.page.locator('#liste').innerText();
  dire(/revente|vendre|commercial/i.test(texte), 'Clause : la revente de données est repérée');
  dire(/durée|conservation/i.test(texte), 'Clause : la durée de conservation est repérée');

  /* Un texte anodin ne doit pas déclencher d'alarme : un outil qui crie au
     loup sur tout ne sert à rien. */
  await c.page.fill('#texte', 'Nous ne collectons aucune donnée personnelle et n’utilisons aucun traceur.');
  await c.page.waitForTimeout(300);
  const apres = await c.page.locator('#liste .card').count();
  dire(apres < trouves, `Clause : un texte anodin relève moins de signaux (${apres} contre ${trouves})`);
  await fermer('Clause', c);
}

/* ------------------------------------------------------------ Abonnements */
console.log('\n=== Abonnements — deux entrées, un total vérifiable ===');
{
  const c = await ouvrir('/outils/abonnements/');
  /* La date est exigée par le formulaire, et c'est voulu : sans elle, aucune
     reconduction ne peut être calculée, ce qui est la raison d'être de
     l'outil. On commence par vérifier ce refus, puis on saisit correctement. */
  await c.page.fill('#nom', 'Sans date');
  await c.page.fill('#prix', '5');
  await c.page.click('#ajout button[type=submit]');
  await c.page.waitForTimeout(150);
  dire(await c.page.locator('#erreur').isVisible(),
    'Abonnements : une entrée sans date est refusée, avec un message');
  dire((await c.page.locator('#liste .abo').count()) === 0,
    'Abonnements : rien n’est ajouté quand la saisie est refusée');

  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const ajoute = async (nom, prix, cycle) => {
    await c.page.fill('#nom', nom);
    await c.page.fill('#prix', prix);
    await c.page.selectOption('#cycle', cycle);
    await c.page.fill('#depart', hier);
    await c.page.click('#ajout button[type=submit]');
    await c.page.waitForTimeout(150);
  };
  await ajoute('Streaming', '9.99', 'mensuel');
  await ajoute('Logiciel', '120', 'annuel');

  dire((await c.page.locator('#liste .abo').count()) === 2, 'Abonnements : les deux entrées sont listées');
  const mensuel = await c.page.locator('#total-mensuel').innerText();
  const annuel = await c.page.locator('#total-annuel').innerText();
  /* 9,99 + (120 / 12) = 19,99 € par mois, donc 239,88 € par an. */
  dire(/19[,.]99/.test(mensuel), `Abonnements : total mensuel exact (${mensuel})`);
  dire(/239[,.]88/.test(annuel), `Abonnements : total annuel exact (${annuel})`);

  /* Ce que le stockage local doit faire : survivre à un rechargement. */
  await c.page.reload({ waitUntil: 'networkidle' });
  await c.page.waitForTimeout(200);
  dire((await c.page.locator('#liste .abo').count()) === 2, 'Abonnements : la liste survit au rechargement');
  await fermer('Abonnements', c);
}

/* -------------------------------------------------------------- Empreinte */
console.log('\n=== Empreinte — les sondes tournent vraiment ===');
{
  const c = await ouvrir('/outils/empreinte/');
  await c.page.waitForTimeout(900);
  const cartes = await c.page.locator('#cards .card').count();
  dire(cartes >= 8, `Empreinte : les sondes rendent leurs constats (${cartes} cartes)`);
  const score = await c.page.locator('#score').innerText();
  dire(/\d/.test(score), `Empreinte : un score est calculé (${score.trim()})`);
  const verdict = await c.page.locator('#verdict-label').innerText();
  dire(verdict.trim().length > 0, `Empreinte : un verdict est rendu (${verdict.trim()})`);
  dire((await c.page.locator('#steps li').count()) >= 3, 'Empreinte : des conseils sont proposés');
  const vides = await c.page.locator('#cards .card').evaluateAll(
    (n) => n.filter((e) => !e.innerText.trim()).length);
  dire(vides === 0, 'Empreinte : aucune carte vide');
  await fermer('Empreinte', c);
}

/* -------------------------------------------------------------- Vrai prix */
console.log('\n=== Vrai prix — le calcul affiché est le bon ===');
{
  const c = await ouvrir('/outils/vrai-prix/');
  dire(await c.page.locator('#resultat').isHidden(), 'Vrai prix : rien ne s’affiche avant la saisie');

  await c.page.fill('#prix', '9.99');
  await c.page.waitForTimeout(150);
  dire(await c.page.locator('#resultat').isVisible(), 'Vrai prix : le résultat apparaît à la frappe');
  /* 9,99 × 60 = 599,40 €. Le nombre est vérifiable à la main. */
  dire(/599[,.]40/.test(await c.page.locator('#somme5').innerText()), 'Vrai prix : 5 ans = 599,40 €');
  dire(/119[,.]88/.test(await c.page.locator('#somme1').innerText()), 'Vrai prix : 1 an = 119,88 €');
  dire(await c.page.locator('#bascule').isHidden(), 'Vrai prix : pas de comparaison sans achat unique');

  await c.page.fill('#achat', '249');
  await c.page.waitForTimeout(150);
  dire(await c.page.locator('#bascule').isVisible(), 'Vrai prix : la comparaison apparaît');
  const t = await c.page.locator('#bascule-texte').innerText();
  dire(/2 ans et 1 mois/.test(t), `Vrai prix : bascule exacte (${t.slice(0, 70)})`);

  /* Un achat hors d'atteinte doit basculer le verdict, pas afficher n'importe quoi. */
  await c.page.fill('#achat', '999999');
  await c.page.waitForTimeout(150);
  dire(/cinquante ans|moins cher/.test(await c.page.locator('#bascule-texte').innerText()),
    'Vrai prix : un achat hors d’atteinte est dit comme tel');

  /* Le champ vidé ne doit JAMAIS afficher un total : « 0,00 € sur cinq ans »
     serait faux et rassurant. */
  await c.page.fill('#prix', '');
  await c.page.waitForTimeout(150);
  dire(await c.page.locator('#resultat').isHidden(), 'Vrai prix : champ vidé, aucun total affiché');
  await fermer('Vrai prix', c);
}

await nav.close();
srv.close();
rapport(pb, 'TOUT EST VERT — les cinq outils font ce qu’ils annoncent');
