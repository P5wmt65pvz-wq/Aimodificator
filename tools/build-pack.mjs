/*
 * Construit le « Pack Pro » : un dossier de prompts finis, prêt à être vendu.
 *
 *   npm run pack
 *
 * Source : les modèles de la bibliothèque, passés dans le moteur du site.
 * Sortie : dist/promptforge-pack/ et dist/promptforge-pack.zip
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const engine = require('../assets/js/engine.js');
const templates = require('../assets/js/templates.js');
const profiles = require('../assets/js/profiles.js');

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist', 'promptforge-pack');
const LANGS = ['fr', 'en'];

const T = {
  fr: {
    dir: 'prompts-fr', request: 'La demande de départ', prompt: 'Le prompt à copier',
    why: 'Pourquoi il fonctionne', score: 'Score', gain: 'gain',
    all: 'tous-les-prompts.md', domain: 'Domaine', index: 'SOMMAIRE.md'
  },
  en: {
    dir: 'prompts-en', request: 'The starting request', prompt: 'The prompt to copy',
    why: 'Why it works', score: 'Score', gain: 'gain',
    all: 'all-prompts.md', domain: 'Domain', index: 'CONTENTS.md'
  }
};

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function forge(tpl, lang) {
  const opts = Object.assign({ lang, domain: tpl.domain, model: 'any' }, tpl.opts || {});
  return engine.build(tpl.request[lang], opts);
}

function why(result, lang) {
  const dims = result.analysis.score.dimensions || [];
  /* dimensions[].label est déjà localisé par le moteur */
  const weak = dims.filter((d) => d.value < 3).map((d) => d.label).filter(Boolean);
  const role = result.analysis.profile.label[lang];
  const lines = lang === 'fr'
    ? [`Le prompt ajoute un rôle spécialisé (${role}), une méthode ordonnée, des critères de qualité vérifiables et un format de sortie décidé.`]
    : [`The prompt adds a specialised role (${role}), an ordered method, verifiable quality criteria and a decided output format.`];
  if (weak.length) {
    lines.push(lang === 'fr'
      ? `Points faibles de la demande brute, comblés par le prompt : ${weak.join(', ')}.`
      : `Weak points of the raw request, filled in by the prompt: ${weak.join(', ')}.`);
  }
  return lines.join('\n\n');
}

rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let count = 0;
const stats = [];

for (const lang of LANGS) {
  const t = T[lang];
  const base = path.join(OUT, t.dir);
  const index = [];
  const combined = [];
  const byDomain = new Map();

  for (const tpl of templates.list) {
    const d = profiles.get(tpl.domain);
    if (!byDomain.has(tpl.domain)) byDomain.set(tpl.domain, []);
    byDomain.get(tpl.domain).push(tpl);
  }

  for (const [domainId, list] of byDomain) {
    const d = profiles.get(domainId);
    const dir = path.join(base, slug(d.label[lang]));
    mkdirSync(dir, { recursive: true });
    index.push(`\n## ${d.icon} ${d.label[lang]}\n`);

    for (const tpl of list) {
      const r = forge(tpl, lang);
      const body = [
        `# ${tpl.title[lang]}`,
        ``,
        `> ${tpl.desc[lang]}`,
        `> **${t.domain} :** ${d.label[lang]} · **${t.score} :** ${r.meta.before} → ${r.meta.after} (${t.gain} +${r.meta.gain})`,
        ``,
        `## ${t.request}`,
        ``,
        '```text',
        tpl.request[lang],
        '```',
        ``,
        `## ${t.prompt}`,
        ``,
        '```markdown',
        r.text,
        '```',
        ``,
        `## ${t.why}`,
        ``,
        why(r, lang),
        ``
      ].join('\n');

      const file = `${slug(tpl.title[lang])}.md`;
      writeFileSync(path.join(dir, file), body, 'utf8');
      index.push(`- [${tpl.title[lang]}](${encodeURI(`${slug(d.label[lang])}/${file}`)}) — ${tpl.desc[lang]}`);
      combined.push(body, '\n---\n');
      count++;
      stats.push(r.meta.gain);
    }
  }

  const head = lang === 'fr'
    ? [`# Pack PromptForge — sommaire`, ``, `${templates.list.length} prompts finis, classés par domaine.`,
       `Chaque fiche contient la demande de départ, le prompt à copier tel quel, et ce qu'il ajoute.`]
    : [`# PromptForge Pack — contents`, ``, `${templates.list.length} finished prompts, sorted by domain.`,
       `Each sheet holds the starting request, the prompt to copy as is, and what it adds.`];
  writeFileSync(path.join(base, T[lang].index), head.concat(index).join('\n') + '\n', 'utf8');
  writeFileSync(path.join(base, T[lang].all), combined.join('\n'), 'utf8');
}

const readme = `# Pack PromptForge

${templates.list.length} prompts professionnels finis, en français et en anglais,
couvrant ${profiles.list.length} domaines d'expertise.

## Comment s'en servir

1. Ouvrez \`prompts-fr/SOMMAIRE.md\` (ou \`prompts-en/CONTENTS.md\`).
2. Trouvez la fiche qui correspond à votre besoin.
3. Copiez le bloc « Le prompt à copier » dans ChatGPT, Claude, Gemini ou Mistral.
4. Remplacez les crochets \`[COMME CECI]\` par vos éléments réels.

Les fichiers \`tous-les-prompts.md\` / \`all-prompts.md\` réunissent tout en un
seul document, pratique pour la recherche plein texte.

## Ce que chaque prompt contient

Un rôle réellement spécialisé, le contexte conservé mot pour mot, une méthode
ordonnée, des critères de qualité vérifiables, une clause contre l'invention de
chiffres et de sources, les pièges du domaine nommés explicitement, et un format
de sortie décidé.

## Mise à jour

Généré avec le moteur de PromptForge — https://p5wmt65pvz-wq.github.io/Aimodificator/

Le générateur et le moteur sont sous licence GPL-3.0.
`;
writeFileSync(path.join(OUT, 'README.md'), readme, 'utf8');

const zip = path.join(ROOT, 'dist', 'promptforge-pack.zip');
try {
  execFileSync('zip', ['-rq', zip, 'promptforge-pack'], { cwd: path.join(ROOT, 'dist') });
} catch {
  console.warn('zip indisponible — le dossier dist/promptforge-pack/ est prêt malgré tout.');
}

const moy = Math.round(stats.reduce((a, b) => a + b, 0) / stats.length);
console.log(`Pack construit : ${count} fiches (${LANGS.length} langues), gain de score moyen +${moy}`);
console.log(`→ ${path.relative(ROOT, OUT)}/`);
