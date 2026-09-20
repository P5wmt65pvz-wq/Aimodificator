# Les contrôles

```
npm test      # la logique et les règles écrites, sans navigateur   ~2 s
npm run verif # le rendu réel dans Chromium                       ~210 s
```

**Les deux sont nécessaires et ne se recouvrent pas.** `npm test` ne sait rien
du rendu : il ne voit ni un contraste insuffisant, ni un débordement quand le
lecteur grossit le texte, ni une pastille devenue illisible. La moitié des
défauts réellement trouvés sur ce site n'étaient visibles qu'à l'écran.

## Les sept suites

| Suite | Ce qu'elle cherche | Durée |
|---|---|---|
| `fuzz` | Entrées hostiles sur les six moteurs : plantage, `NaN`, infini, boucle | 2 s |
| `audit` | Les 8 pages : titre, description, canonical, liens morts, doublons d'identifiant, sitemap | 11 s |
| `contraste` | Contraste réel de **chaque texte affiché**, deux thèmes, fond effectif | 14 s |
| `a11y` | Clavier, hiérarchie des titres, étiquettes, 320 px, texte doublé, zones tactiles | 36 s |
| `corrompu` | 23 formes de stockage local abîmé sur 6 pages | 86 s |
| `accueil` | Chaque valeur de chaque menu, 250 combinaisons, champs hostiles, injections | 58 s |
| `passe` | Passe de bout en bout, deux thèmes, deux largeurs | 6 s |

Chacune se lance seule : `node tools/verif/contraste.mjs`.

## Deux principes, appris à leurs dépens

**Mesurer, pas regarder.** Tous les défauts trouvés jusqu'ici l'ont été par un
script qui les cherchait. Aucun n'a été vu en relisant le code ou en regardant
la page — celui qui a choisi une couleur la voit toujours très bien.

**Une suite qui crie au loup est une suite qu'on cesse de lire.** Une première
version du fuzzer envoyait n'importe quoi à n'importe quelle fonction et
rapportait dix-neuf « défauts », tous inatteignables depuis une page. Chaque
fonction déclare donc maintenant le domaine qui peut réellement lui parvenir.
Le reste est signalé à part, sans faire échouer le contrôle.

## Vérifier qu'un contrôle sert encore

Un test qui n'a jamais échoué ne prouve rien. Avant de faire confiance à un
garde-fou, réintroduire le défaut qu'il surveille et vérifier qu'il se
déclenche — puis remettre en état.

## Playwright

Fourni par l'environnement, pas par le projet. **Ne jamais lancer
`playwright install`.** Le chemin des navigateurs est
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, et `tools/verif/serveur.mjs` s'en
charge. Si l'import échoue, c'est que l'environnement n'a pas Playwright : le
dire, ne pas contourner.

## jpeg.mjs

Pas une suite : une fabrique de vrais fichiers JPEG avec métadonnées EXIF
réelles (GPS, appareil, date, logiciel, commentaire, dans les deux ordres
d'octets), pour éprouver l'outil Photo sur autre chose que des octets au
hasard.
