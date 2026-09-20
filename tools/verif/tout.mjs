/* Lance toutes les suites de contrôle, l'une après l'autre, et rend un état
   unique. Utilisé avant un push, et par les sessions programmées.
 *
 * Pourquoi en plus de `npm test` : `npm test` tourne sans navigateur. Il
 * vérifie la logique et les règles écrites, pas le rendu. Or la moitié des
 * défauts réellement trouvés jusqu'ici n'étaient visibles qu'à l'écran —
 * un contraste, un débordement à texte grossi, une pastille illisible.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

const ICI = import.meta.dirname;

const SUITES = [
  ['fuzz',      'entrées hostiles sur les sept moteurs',              false],
  ['audit',     'les 9 pages : titres, liens, sitemap, doublons',    true],
  ['contraste', 'contraste de chaque texte, deux thèmes',            true],
  ['a11y',      'clavier, structure, 320 px, texte doublé',          true],
  ['corrompu',  'stockage local abîmé sur sept pages',                true],
  ['accueil',   'toutes les options, 250 combinaisons, injections',  true],
  ['passe',     'Passe de bout en bout, deux thèmes',                true]
];

function lance(nom, navigateur) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (navigateur) env.PLAYWRIGHT_BROWSERS_PATH = env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const p = spawn(process.execPath, [path.join(ICI, nom + '.mjs')], { env });
    let sortie = '';
    p.stdout.on('data', (d) => { sortie += d; });
    p.stderr.on('data', (d) => { sortie += d; });
    p.on('close', (code) => resolve({ code, sortie }));
  });
}

const debut = Date.now();
const rouges = [];
for (const [nom, quoi, navigateur] of SUITES) {
  const t = Date.now();
  const { code, sortie } = await lance(nom, navigateur);
  const dernier = sortie.trim().split('\n').filter((l) => /AUCUN DÉFAUT|DÉFAUT|TOUT EST VERT|Error/.test(l)).pop() || '';
  const s = ((Date.now() - t) / 1000).toFixed(0);
  console.log(`${code === 0 ? ' OK   ' : ' ROUGE'} ${nom.padEnd(10)} ${(s + 's').padStart(5)}  ${quoi}`);
  if (code !== 0) {
    rouges.push(nom);
    console.log(sortie.split('\n').filter((l) => /DÉFAUT|ECHEC|Error/.test(l)).slice(0, 12).map((l) => '        ' + l.trim()).join('\n'));
  } else if (dernier) {
    console.log('        ' + dernier.trim());
  }
}
const total = ((Date.now() - debut) / 1000).toFixed(0);
console.log(`\n${rouges.length ? rouges.length + ' suite(s) en échec : ' + rouges.join(', ') : 'TOUT EST VERT'} — ${total}s`);
process.exit(rouges.length ? 1 : 0);
