# Feuille de route — suite d'outils

## Le positionnement

Pas dix outils au hasard : **une suite d'outils de confidentialité qui tournent
entièrement dans le navigateur.** « Rien n'est envoyé » n'est pas un argument
marketing ici, c'est une contrainte technique du dépôt — il n'y a pas de serveur.
C'est précisément ce que les concurrents ne peuvent pas promettre.

Pourquoi ce créneau, après recherche :
- les agrégateurs d'outils génériques en français (200 à 1000 outils chacun) sont
  saturés ; une calculatrice de plus ne se classera jamais contre eux ;
- l'analyse de vie privée en français n'a quasiment que des références anglophones ;
- le sujet est intemporel : il marchera encore dans dix ans, contrairement à un
  outil greffé sur une mode ;
- les outils se renvoient les uns aux autres, donc l'autorité du domaine se
  concentre au lieu de se diluer sur dix domaines séparés.

## Règles pour chaque outil

1. **Tout en local.** Aucune requête réseau après le chargement. Vérifié au test.
2. **Aucune dépendance.** Pas de framework, pas de CDN.
3. **Utile seul.** Chaque outil doit valoir une visite même si on ignore le reste.
4. **Honnête.** Pas de score gonflé, pas de peur vendue. Si un signal est neutre,
   on le dit.
5. **Vérifié.** Thème clair et sombre, lisible à 390 px, aucune erreur console,
   tests sur la logique pure.
6. **Référencé.** Ajouté au `sitemap.xml`, lié depuis les autres pages.

## État

| # | Outil | Ce qu'il fait | État |
|---|---|---|---|
| 1 | **Empreinte** | Ce qu'un site lit sur vous sans rien demander : canvas, polices, carte graphique, matériel. Score d'identifiabilité. | ✅ en ligne |
| 2 | **Photo nue** | Déposez une photo : l'outil affiche ce qu'elle révèle (GPS, appareil, date, logiciel) et vous la rend nettoyée. Rien ne quitte l'appareil. | à faire |
| 3 | **Clause** | Collez une politique de confidentialité : l'outil surligne ce qui compte vraiment — revente de données, durée de conservation, transferts hors UE, consentement présumé. | à faire |
| 4 | **Passe** | Test de résistance d'un mot de passe, calculé hors ligne, avec le raisonnement affiché. Générateur de phrases de passe en français. | à faire |
| 5 | **Traces** | Ce que votre historique et vos cookies révèlent : explication concrète du pistage inter-sites, et comment cloisonner. | à faire |
| 6 | **Conformité** | Checklist RGPD interactive pour un petit site (artisan, association) : ce qui est obligatoire, ce qui ne l'est pas, et les sanctions réelles. | à faire |
| 7 | **Lisible** | Analyse de lisibilité d'un texte français : phrases trop longues, jargon, voix passive, tics d'écriture d'IA. Pour rédacteurs. | à faire |
| 8 | **Minutage** | Convertit un script en durée de vidéo réelle selon le débit de parole, et découpe en séquences. Pour créateurs. | à faire |
| 9 | **TJM** | Calculateur de tarif journalier freelance : revenu net visé, jours réellement facturables, charges. Public qui paie. | à faire |
| 10 | **Partage** | Répartiteur de dépenses de groupe, partageable par simple lien, sans compte ni application. | à faire |

## Ordre de construction

2 → 3 → 4 → 7 → 6 → 9 → 5 → 8 → 10.

L'outil 2 (**Photo nue**) est prioritaire : le plus démonstratif, le plus
partageable, et il renforce le même thème que l'outil 1.
