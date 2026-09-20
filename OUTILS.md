# Feuille de route — suite d'outils

> **Construction en cours.** Prochain outil à construire : voir l'ordre de
> construction en bas de ce fichier.

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
| 2 | **Photo propre** | Déposez une photo : l'outil affiche ce qu'elle révèle (GPS, appareil, date, logiciel) et vous la rend nettoyée. Rien ne quitte l'appareil. | ✅ en ligne |
| 3 | **Clause** | Collez une politique de confidentialité : l'outil surligne ce qui compte vraiment — revente de données, durée de conservation, transferts hors UE, consentement présumé. | ✅ en ligne |
| 4 | **Passe** | Test de résistance d'un mot de passe, calculé hors ligne, avec le raisonnement affiché. Générateur de phrases de passe en français. | ✅ en ligne |
| 5 | **Traces** | Ce que votre historique et vos cookies révèlent : explication concrète du pistage inter-sites, et comment cloisonner. | à faire |
| 6 | **Conformité** | Checklist RGPD interactive pour un petit site (artisan, association) : ce qui est obligatoire, ce qui ne l'est pas, et les sanctions réelles. | à faire |
| 7 | **Lisible** | Analyse de lisibilité d'un texte français : phrases trop longues, jargon, voix passive, tics d'écriture d'IA. Pour rédacteurs. | à faire |
| 8 | **Minutage** | Convertit un script en durée de vidéo réelle selon le débit de parole, et découpe en séquences. Pour créateurs. | à faire |
| 9 | **TJM** | Calculateur de tarif journalier freelance : revenu net visé, jours réellement facturables, charges. Public qui paie. | à faire |
| 10 | **Partage** | Répartiteur de dépenses de groupe, partageable par simple lien, sans compte ni application. | à faire |

## Vague 2 — l'argent du quotidien

Issue d'une recherche sur les avis négatifs récurrents (sept. 2026) : la plainte
la plus transversale dans les avis d'utilisateurs français porte sur les
**abonnements reconduits automatiquement** sans que la personne l'ait compris,
devant le service client et les bugs. C'est un besoin réel, documenté, et
traitable sans serveur.

| # | Outil | Ce qu'il fait | État |
|---|---|---|---|
| 11 | **Abonnements** | Recensez vos abonnements : coût annuel réel, prochaine reconduction, alerte avant la date. Stocké dans votre navigateur uniquement. | ✅ en ligne |
| 12 | **Résiliation** | Génère la lettre de résiliation correcte selon le type de contrat. **Toute référence juridique doit être vérifiée et sourcée dans la page — ne rien citer de mémoire.** | à faire |
| 13 | **Vrai prix** | Le coût réel d'un abonnement sur 1, 3 et 5 ans, comparé à l'achat unique équivalent. | à faire |
| 14 | **Engagement** | Décryptage d'une offre : ce que « sans engagement », « offre découverte » et « préavis » veulent dire concrètement. Sourcé. | à faire |
| 15 | **Partage d'abonnements** | Répartition du coût d'un abonnement familial entre plusieurs personnes, avec rappel des dates. | à faire |

## Vague 3 — écrire et publier

| # | Outil | Ce qu'il fait | État |
|---|---|---|---|
| 16 | **Tics** | Détecte et corrige les tics d'écriture d'IA dans un texte : formules creuses, listes artificielles, transitions vides. | à faire |
| 17 | **Titre** | Teste un titre : longueur, promesse, clarté. Pour articles, vidéos, pages. | à faire |
| 18 | **Alt** | Aide à écrire les textes alternatifs d'images correctement, avec les règles d'accessibilité. | à faire |
| 19 | **Extrait** | Génère les balises de partage d'une page et montre l'aperçu obtenu sur les réseaux. | à faire |
| 20 | **Relecture** | Passe de relecture structurée : répétitions, phrases trop longues, incohérences de ton. | à faire |

## Vague 4 — travailler à son compte

| # | Outil | Ce qu'il fait | État |
|---|---|---|---|
| 21 | **Devis** | Construit un devis présentable à partir de lignes de prestation. Export imprimable. | à faire |
| 22 | **Retard** | Calcule ce qu'une facture impayée coûte réellement, et génère la relance. Sourcé. | à faire |
| 23 | **Charge** | Répartit une charge de travail sur un calendrier réel, jours fériés et congés déduits. | à faire |
| 24 | **Tarif horaire** | Convertit un objectif de revenu en tarif horaire tenable, jours non facturables inclus. | à faire |
| 25 | **Brief** | Transforme une demande client floue en cahier des charges exploitable. | à faire |

## Vagues suivantes

Les entrées 26 à 30 ne sont pas fixées d'avance : elles seront choisies par la
session de recherche hebdomadaire, à partir de plaintes réellement observées,
pas d'intuitions. **Une idée n'entre dans ce tableau que si elle s'appuie sur une
source citable.**

## Ordre de construction

16 → 7 → 12 → 6 → 9 → 5 → 13 → 21 → 8 → 17 → 24 → 10 → puis le reste du tableau.

L'outil 2 (**Photo propre**) est prioritaire : le plus démonstratif, le plus
partageable, et il renforce le même thème que l'outil 1.
