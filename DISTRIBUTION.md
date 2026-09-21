# Feuille de route — distribution

`OUTILS.md` dit **quoi construire**. Ce fichier dit **comment on est trouvé** et
comment une vente devient possible. Sans lui, le dépôt produit sans jamais
diffuser : c'est exactement l'état dans lequel il se trouvait avant d'écrire ces
lignes.

Règle qui tient tout le reste : **un outil de plus ne remplace pas un lecteur de
plus.** Construire est la partie facile, et elle est déjà bien tenue.

---

## Le constat, au 20 septembre 2026

Chiffres relevés dans le dépôt lui-même, pas estimés.

- **Le site a trois jours.** Dépôt créé le 17 septembre 2026. Aucune conclusion
  sur l'audience ne peut être tirée à cette échéance : il ne s'est rien passé
  parce qu'il n'y a pas eu le temps qu'il se passe quelque chose.
- **En ligne :** PromptForge, six outils, la page d'exemples. Le déploiement
  GitHub Pages se déclenche à chaque push et la dernière exécution a réussi ;
  l'onglet Actions du dépôt en donne le compte et l'état à jour.
- **Rien n'est achetable.** Les quatre `url` d'`offers.js` sont vides : la règle
  de sûreté du fichier masque alors la section entière. Le code se comporte
  comme prévu — mais un visiteur convaincu n'a aucun bouton à cliquer.
- **Le produit payant, lui, existe déjà.** `npm run pack` construit 48 fiches
  bilingues — le générateur annonce le compte à chaque exécution, c'est de là
  que vient ce chiffre. Ce n'est pas le produit qui manque, c'est le lien de
  paiement.
- **Un seul point de contact :** le lien `mailto:` de `liste.js`.
- **Une seule mesure possible :** la règle 3 interdit tout traceur, donc le site
  ne compte rien. Google Search Console est la seule source de chiffres, et sa
  balise de propriété est en place depuis le 20 septembre 2026.
- **Le sitemap couvre toutes les pages**, et `robots.txt` le déclare. Le
  compte exact grandit à chaque outil : `grep -c '<loc>' sitemap.xml`. Un
  garde-fou de `npm test` vérifie qu'aucune page n'en manque.

## Ce que ce dépôt ne peut pas faire

À écrire une fois pour ne plus y revenir :

- **Pas de publicité, pas d'affiliation à script, pas de pixel.** La règle
  « aucune requête réseau après chargement » les exclut toutes. La monétisation
  par l'audience n'est pas une piste ici, quel que soit le trafic atteint.
- **Pas de formulaire d'inscription.** Pas de serveur pour le recevoir. Le
  `mailto:` est la seule voie, et `liste.js` explique déjà pourquoi.
- **Pas de statistiques de visite.** Tout chiffre de fréquentation vient de
  Search Console, ou n'existe pas. Ne jamais en écrire un qui vienne d'ailleurs.

---

## Ordre de priorité

Ces cinq points passent **avant** l'ordre de construction d'`OUTILS.md`.

### 1. Rendre le Pack Pro achetable

Le produit est construit et rapporte zéro tant qu'aucune URL n'est collée dans
`offers.js`. Marche à suivre complète : **`ACTIVER-PAIEMENT.md`**. Le choix du
prestataire est traité dans **`MONETISATION.md`, section 2** — et le point qui
décide n'est pas le taux de commission mais la TVA.

Un vendeur officiel (*merchant of record*) devient le vendeur légal à la place
du titulaire du site : c'est ce qui simplifie le plus l'administratif sur une
première vente à des particuliers européens. Les obligations qui restent
dépendent du statut et du pays ; elles ne sont volontairement chiffrées nulle
part dans ce dépôt. Sources officielles listées en fin de `MONETISATION.md`.

### 2. Faire indexer ce qui existe déjà

Le sitemap existe et `robots.txt` le déclare. Il reste à **le soumettre dans
Search Console**. Tant que ce n'est pas fait, l'indexation ne dépend que de la
découverte spontanée, qui est lente pour un domaine sans historique.

C'est une action de quelques minutes, à faire dans l'interface de Search
Console. Aucune ligne de code n'est concernée.

### 3. Une page doit répondre à une question réellement tapée

Aujourd'hui les pages **décrivent l'outil**. Elles n'expliquent pas le
**problème**. Une page qui pose le problème, cite ses sources et propose l'outil
comme réponse a bien plus de raisons d'être trouvée qu'une page qui n'est qu'une
interface.

Règle, non négociable et identique à celle du reste du dépôt : **aucune page de
contenu n'est publiée sans source citable.** Pas de texte de remplissage, pas de
chiffre de mémoire, pas de loi paraphrasée. Une page sans source ne sort pas.

### 4. Les outils doivent se renvoyer les uns aux autres

`OUTILS.md` le pose déjà comme principe — « les outils se renvoient les uns aux
autres, donc l'autorité du domaine se concentre ». Reste à le vérifier page par
page : chaque outil pointe vers les deux ou trois qui servent au même moment.
Quelqu'un qui nettoie une photo se demande aussi ce que son navigateur révèle.

### 5. La liste vaut plus que le passage

Une adresse e-mail garde de la valeur quand le visiteur est reparti, ce que le
trafic de passage ne fait pas. Le lien de `liste.js` est en place ; ce qui
manque, c'est **une raison de s'inscrire, énoncée sur chaque page d'outil** et
pas seulement sur l'accueil.

---

## L'adresse du site

Le site est servi sur `p5wmt65pvz-wq.github.io/Aimodificator/`. Une adresse de
ce type se retient mal et inspire peu confiance sur une page qui demande un
paiement. Un nom de domaine propre corrige les deux.

Ce n'est pas une décision de code : elle engage une dépense annuelle et le choix
d'un bureau d'enregistrement. Tarifs et options de confidentialité des données
d'enregistrement varient d'un bureau à l'autre — aucun chiffre n'est cité ici,
à vérifier au moment de décider. GitHub Pages accepte un domaine personnalisé
via un fichier `CNAME`, ce qui rend le changement réversible.

---

## Ce qu'on arrête

Construire un onzième outil avant que les six existants soient trouvables ne
fait pas grandir le site : **ça répartit la même absence de trafic sur davantage
de pages.** L'ordre de construction d'`OUTILS.md` reste valable et sera repris —
après les points 1 à 3 ci-dessus.

## Ce qui pilote la suite

Un seul indicateur : **les impressions et les clics rapportés par Search
Console**, relevés une fois par semaine. Avant d'avoir ce chiffre, toute
décision d'acquisition est une supposition, et sera traitée comme telle.

Quand il existera, il tranchera la seule question qui compte pour la suite :
les pages sont-elles **affichées mais pas cliquées** (le titre et la description
sont en cause), ou **pas affichées du tout** (le contenu et l'indexation sont en
cause) ? Les deux ne se corrigent pas de la même façon.
