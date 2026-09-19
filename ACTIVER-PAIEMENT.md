# Activer le paiement

Fiche destinée au **titulaire du compte de paiement**. À suivre dans l'ordre.
Compter une trentaine de minutes, dont l'essentiel en attente de vérification.

Le site est déjà prêt : il ne reste qu'à créer les liens et à les coller.
Activer le paiement doit rester **un seul commit, qui ne modifie que
`assets/js/offers.js`**. Si vous devez toucher à autre chose, quelque chose
s'est cassé ailleurs — ne contournez pas, signalez-le.

---

## 1. Choisir le prestataire

Quatre options sont comparées dans **[MONETISATION.md](MONETISATION.md), section 2** :
tarifs relevés, gestion de la TVA, et pour quel type d'offre chacun convient.
Ce document ne les recopie pas : les tarifs bougent, une seule source doit faire foi.

Le point qui décide vraiment n'est pas le taux mais la TVA. Relisez ce passage
avant de créer quoi que ce soit.

## 2. Créer le compte

Sur le site du prestataire retenu. Prévoir une adresse e-mail, un numéro de
téléphone et l'IBAN du compte qui recevra les virements.

## 3. Faire vérifier le compte

Tout prestataire de paiement vérifie l'identité du titulaire avant d'autoriser
le premier virement. **Les pièces exactes dépendent du prestataire et du pays,
et changent régulièrement.** Elles ne sont pas listées ici de mémoire : à
vérifier sur la page officielle du prestataire concerné.

| Prestataire | Pièces à fournir |
|---|---|
| Stripe | à vérifier sur <https://docs.stripe.com/acceptable-verification-documents?country=FR> |
| Gumroad | à vérifier sur <https://gumroad.com/help> |
| Lemon Squeezy | à vérifier sur <https://www.lemonsqueezy.com/help> |
| Ko-fi | à vérifier sur <https://help.ko-fi.com> |

Ces quatre pages étaient inaccessibles depuis l'environnement où cette fiche a
été écrite : leur contenu n'a pas pu être lu ni résumé. Ouvrez-les vous-même.

La vérification prend en général un délai court mais non garanti. Attendez
qu'elle soit validée avant l'étape suivante : un lien créé sur un compte non
vérifié peut accepter des paiements sans pouvoir les reverser.

## 4. Créer un lien par offre

Le site expose quatre emplacements d'offre, indépendants. Vous pouvez n'en
activer qu'un : les autres resteront invisibles.

| Offre | Ce qu'elle propose | Type de lien à créer |
|---|---|---|
| `support` | pourboire libre | page de pourboire |
| `pack` | produit téléchargeable payant | fiche produit avec fichier |
| `service` | prestation sur mesure | lien de paiement à montant fixe |
| `sponsor` | soutien mensuel | abonnement récurrent |

Créez le lien, **ouvrez-le dans un navigateur** et vérifiez qu'il affiche bien
votre page de paiement. Copiez l'URL affichée dans la barre d'adresse.

## 5. Coller les liens

Ouvrir `assets/js/offers.js`. Chaque offre a un champ `url`, vide par défaut :

```js
{
  id: 'service',
  url: '',        // ← coller l'URL ici, entre les guillemets
  ...
}
```

Les quatre champs `url` sont aux lignes 25, 37, 54 et 66, dans l'ordre
`support`, `pack`, `service`, `sponsor`.

**Ne modifiez rien d'autre dans ce fichier.** La fonction `isLive()`, en bas,
est une protection : elle refuse toute URL qui n'est pas en `https://`, ainsi
que les adresses d'exemple. Elle est couverte par les tests. Y toucher
ouvrirait la porte à un lien mort ou dangereux en production.

Vous pouvez aussi ajuster `price`, `title`, `desc` et `cta` de chaque offre :
ce sont vos mots, et les deux langues (`fr` et `en`) sont obligatoires.

## 6. Vérifier avant de publier

```bash
npm test      # doit être vert, sans exception
npm start     # puis ouvrir http://127.0.0.1:8099
```

Trois contrôles :

1. La section « Soutenir l'atelier » apparaît en bas de l'accueil.
2. Seules les offres dont vous avez rempli l'`url` y figurent.
3. Chaque bouton mène bien à votre page de paiement.

Pour voir la page **telle qu'un visiteur la voit** — en local, un rappel de
configuration s'affiche exprès, invisible en ligne :

```bash
chromium --host-resolver-rules="MAP visiteur.test 127.0.0.1"
# puis ouvrir http://visiteur.test:8099/
```

## 7. Publier

```bash
git add assets/js/offers.js
git commit -m "Active les liens de paiement"
git pull --rebase origin main
git push origin main
```

Le déploiement part tout seul, à condition que les tests passent. Vérifiez
ensuite que le site en ligne affiche bien la section, et cliquez chaque bouton
une dernière fois depuis l'adresse publique.

---

## Si quelque chose ne s'affiche pas

Une offre dont l'URL est absente, mal formée, en `http://` simple, ou restée à
l'état d'exemple **n'est jamais montrée**. C'est voulu : le site ne peut pas
publier un bouton mort par oubli. Si une offre reste invisible, c'est presque
toujours l'URL qui est en cause — vérifiez qu'elle commence bien par `https://`.
