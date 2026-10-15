/*
 * Construit exemples/index.html à partir du moteur du site.
 *
 *   npm run exemples
 *
 * Les prompts affichés sont la sortie EXACTE d'engine.build(), sans retouche.
 * Regénérer cette page après toute modification du moteur : c'est la seule
 * façon de garantir que la vitrine montre ce que le site produit vraiment.
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const engine = require('../assets/js/engine.js');
const profiles = require('../assets/js/profiles.js');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'exemples');

/* Six demandes ordinaires, telles qu'on les écrit vraiment : pas de cas
   idéalisé, pas de client inventé. Ce sont des demandes, pas des témoignages. */
const DEMANDES = [
  { domaine: 'writing',
    texte: "rédiger un article de blog de 1 200 mots sur le télétravail pour des responsables RH, avec des exemples concrets et une conclusion qui donne une chose à faire" },
  { domaine: 'code',
    texte: "relis cette fonction Python qui lit un CSV et dis-moi ce qui casse si le fichier est vide ou mal encodé" },
  { domaine: 'email',
    texte: "écris un email pour relancer un client qui ne répond plus depuis trois semaines, ton courtois mais ferme, 150 mots maximum" },
  { domaine: 'data',
    texte: "analyse ces données de ventes trimestrielles et sors un tableau avec les trois écarts les plus importants et leur cause probable" },
  { domaine: 'image',
    texte: "génère une image d'un phare isolé sous un ciel d'orage, ambiance cinématographique, cadrage large" },
  { domaine: 'education',
    texte: "explique la photosynthèse à un enfant de 8 ans, sans jargon, avec une comparaison de la vie courante" }
];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const resultats = DEMANDES.map((d) => {
  const r = engine.build(d.texte, { lang: 'fr', domain: d.domaine, model: 'any' });
  return { ...d, r, profil: profiles.get(r.analysis.domain.id) };
});

const blocs = resultats.map((e, i) => `
      <article class="exemple">
        <header class="exemple-head">
          <span class="exemple-domaine"><span aria-hidden="true">${esc(e.profil.icon)}</span> ${esc(e.profil.label.fr)}</span>
          <span class="exemple-score">
            <b>${e.r.meta.before}</b> → <b class="apres">${e.r.meta.after}</b>
            <span class="muted">sur 100</span>
          </span>
        </header>

        <h3>La demande, écrite comme elle vient</h3>
        <pre class="demande">${esc(e.texte)}</pre>

        <details${i === 0 ? ' open' : ''}>
          <summary>Le prompt produit — ${e.r.meta.words} mots, ~${e.r.meta.tokens} jetons</summary>
          <pre class="prompt">${esc(e.r.text)}</pre>
        </details>
      </article>`).join('\n');

const gainMoyen = Math.round(resultats.reduce((a, e) => a + e.r.meta.gain, 0) / resultats.length);

const html = `<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Exemples — ce que PromptForge produit réellement</title>
<meta name="description" content="Six demandes ordinaires et les prompts que le moteur en tire, sortis tels quels, sans retouche. Le score avant et après est mesuré sur les mêmes huit dimensions.">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0b0b10">
<link rel="canonical" href="https://p5wmt65pvz-wq.github.io/Aimodificator/exemples/">
<meta property="og:title" content="Exemples — ce que PromptForge produit réellement">
<meta property="og:description" content="Six demandes ordinaires et les prompts obtenus, sans retouche.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://p5wmt65pvz-wq.github.io/Aimodificator/exemples/">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="https://p5wmt65pvz-wq.github.io/Aimodificator/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="PromptForge — transformez n'importe quelle demande en prompt professionnel.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://p5wmt65pvz-wq.github.io/Aimodificator/assets/og.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="apple-touch-icon" href="../assets/app/icone-180.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='26' font-size='26'%3E%E2%9A%92%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="exemples.css">
<link rel="stylesheet" href="../assets/css/verre.css">
</head>
<body>
<a class="skip-link" href="#liste">Aller aux exemples</a>

<header class="site-header">
  <a class="brand" href="../">
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19h16"/><path d="M7 19l3-8"/><path d="M17 19l-3-8"/><path d="M9 11h6"/><path d="M12 3v4"/><path d="M9.5 5.5L12 7l2.5-1.5"/>
      </svg>
    </span>
    <span class="brand-text"><strong>Exemples</strong><small>Sorties brutes du moteur</small></span>
  </a>
  <nav class="barre barre-haut" aria-label="Navigation du site">
    <a href="../#workshop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 14.5 9.5"/><path d="m13 8 3 3"/><path d="M17 3v3M15.5 4.5h3"/><path d="M20 9v2M19 10h2"/><path d="M9 4v2M8 5h2"/></svg><span>Atelier</span></a>
    <a href="../#outils"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg><span>Outils</span></a>
    <a href="../exemples/" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M10 12h5M10 15.5h5"/></svg><span>Exemples</span></a>
    <a href="../application/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M12 7v6"/><path d="M9.5 10.5 12 13l2.5-2.5"/></svg><span>Application</span></a>
  </nav>
  <button type="button" id="theme-toggle" class="icon-btn" aria-label="Changer de thème">
    <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
  </button>
</header>

<main>
  <section class="hero">
    <h1>Voici ce que le moteur produit.<br><em>Sans retouche.</em></h1>
    <p class="lede">
      Six demandes ordinaires, écrites comme on les écrit vraiment, et le prompt que
      le moteur en tire. Ces sorties ne sont ni choisies ni retravaillées : elles sont
      générées par le script <code>tools/build-exemples.mjs</code>, présent dans le dépôt,
      qui appelle exactement le même moteur que le site.
    </p>
    <p class="pledge">
      <b>Pas de client inventé, pas de témoignage.</b> Ce qui est montré ici, vous
      pouvez le reproduire vous-même en collant la demande dans
      <a href="../">l'atelier</a> — vous obtiendrez le même résultat.
    </p>
  </section>

  <section class="mesure">
    <h2>Le score, et ce qu'il vaut</h2>
    <p>
      Chaque demande est notée sur huit dimensions — clarté, contexte, précision,
      public, format, contraintes, exemples, critère de réussite — puis le prompt
      produit est noté sur <b>les mêmes</b> huit dimensions. La comparaison est donc
      directe. Sur ces six exemples, le gain moyen est de <b>${gainMoyen} points</b>.
    </p>
    <p class="muted">
      C'est une mesure de complétude, pas une promesse de qualité de réponse : un prompt
      complet aide un modèle, il ne garantit pas son résultat.
    </p>
  </section>

  <section id="liste">
${blocs}
  </section>
</main>

<footer class="site-footer">
  <p>Page générée depuis le moteur du site. Aucune sortie n'est écrite à la main.</p>
  <p class="muted"><a href="../">PromptForge</a> · <a href="../outils/empreinte/">Empreinte</a> · <a href="../outils/photo/">Photo propre</a> · <a href="../outils/clause/">Clause</a> · <a href="../outils/passe/">Passe</a> · <a href="../outils/abonnements/">Abonnements</a> · <a href="../outils/vrai-prix/">Vrai prix</a> · <a href="../outils/partage/">Partage</a> · <a href="../application/">Application</a> · <a href="https://github.com/P5wmt65pvz-wq/Aimodificator" rel="noopener">Code source ouvert</a></p>
</footer>


<nav class="barre barre-bas" aria-label="Navigation du site">
  <a href="../#workshop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20 14.5 9.5"/><path d="m13 8 3 3"/><path d="M17 3v3M15.5 4.5h3"/><path d="M20 9v2M19 10h2"/><path d="M9 4v2M8 5h2"/></svg><span>Atelier</span></a>
  <a href="../#outils"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg><span>Outils</span></a>
  <a href="../exemples/" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M10 12h5M10 15.5h5"/></svg><span>Exemples</span></a>
  <a href="../application/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M12 7v6"/><path d="M9.5 10.5 12 13l2.5-2.5"/></svg><span>Application</span></a>
</nav>
<script src="../assets/js/installation.js"></script>
<script src="../assets/js/effets.js"></script>
<script src="exemples.js"></script>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log(`exemples/index.html — ${resultats.length} exemples, gain moyen +${gainMoyen}`);
resultats.forEach((e) => console.log(`  ${e.profil.label.fr.padEnd(26)} ${e.r.meta.before} → ${e.r.meta.after}`));
