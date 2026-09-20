# Conventions de travail sur ce dépôt

## Compte rendu

À la fin de **chaque** tâche, terminer par un résumé court — une dizaine de
lignes maximum — de tout ce qui a été fait. Pas de pavé explicatif : ce qui a
été construit, ce qui a été corrigé, ce qui est en ligne, ce qui reste.

Si quelque chose n'a pas pu être fait, le dire en une ligne avec la marche à
suivre pour que le propriétaire le fasse lui-même.

## Le projet

Site statique, sans dépendance, sans serveur, sans traceur. Tout tourne dans le
navigateur. C'est une contrainte technique, pas un argument marketing : il n'y a
pas de serveur.

- `index.html` + `assets/` — PromptForge, le générateur de prompts
- `outils/<nom>/` — la suite d'outils de confidentialité (voir `OUTILS.md`)
- `exemples/` — vitrine des sorties du moteur, **générée** par
  `npm run exemples` ; ne jamais l'écrire à la main, la régénérer après toute
  modification du moteur
- `tools/` — les générateurs : page d'exemples, Pack Pro
- `tools/verif/` — les contrôles dans Chromium (`npm run verif`), ce que
  `npm test` ne peut pas voir : contraste, débordement, clavier, rendu.
  Voir `tools/verif/LISEZ-MOI.md`
- `MONETISATION.md` — comment encaisser, et ce qui bloque
- `ACTIVER-PAIEMENT.md` — la marche à suivre pour le titulaire du compte de
  paiement, le jour venu
- `OUTILS.md` — feuille de route des outils, source de vérité sur ce qui
  se construit
- `DISTRIBUTION.md` — feuille de route de la distribution : comment le site
  est trouvé et comment une vente devient possible. Ses priorités passent
  avant l'ordre de construction d'`OUTILS.md`

## Règles

- `npm test` doit être vert avant tout push. Ne jamais pousser du rouge.
- Vérifier le rendu dans Chromium : thème clair et sombre, 390 px sans
  débordement, zéro erreur console.
- Aucune requête réseau après chargement, sur aucune page.
- N'inventer aucun chiffre, aucune loi, aucune date. Vérifier et citer la
  source, ou écrire la règle sans le chiffre.
- Ne jamais inscrire d'identifiant de modèle dans un message de commit.
