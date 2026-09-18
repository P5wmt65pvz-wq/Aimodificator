# Encaisser avec PromptForge

Ce document décrit la seule chaîne qui, à ma connaissance, amène réellement de
l'argent sur un compte à partir de ce dépôt : **un visiteur paie un prestataire
de paiement, le prestataire vire la somme sur votre compte bancaire.**

Aucune ligne de code ne peut créer d'argent. Ce qui suit crée la *possibilité*
d'en recevoir. Le reste dépend de votre trafic et de votre offre.

---

## 1. Ce que le code fait déjà

Le fichier `assets/js/offers.js` contient quatre emplacements d'offre :
pourboire, pack payant, prestation sur-mesure, sponsor mensuel.

Chacun attend une **URL de paiement**. Règle appliquée par le code :

- une offre dont l'`url` est vide ou n'est pas une URL `https://` absolue
  **n'est jamais affichée aux visiteurs** ;
- en local (`localhost`, `127.0.0.1`, `file://`), la section affiche à la place
  un rappel de configuration, invisible en ligne ;
- si aucune offre n'est branchée, la section et son lien de menu disparaissent
  complètement du site public.

Conséquence : vous ne pouvez pas publier un bouton mort par oubli.

---

## 2. Choisir qui encaisse

Quatre options tenables pour un site statique sans serveur. Les tarifs ci-dessous
ont été relevés en **septembre 2026** et changent régulièrement : **vérifiez-les
sur la page officielle avant de vous engager.**

| | Pour quoi | Frais relevés (sept. 2026) | TVA |
|---|---|---|---|
| **Stripe Payment Links** | Prestation, produit, abonnement | France : 1,5 % + 0,25 € (carte européenne standard), 1,9 % + 0,25 € (carte commerciale européenne), ~3,15 % (carte hors Europe) | À votre charge |
| **Gumroad** | Produit numérique téléchargeable | 10 % + 0,50 $, **plus** les frais carte de Stripe répercutés (~12,9 % + 0,80 $ au total selon les comparatifs) | Gumroad est vendeur officiel et s'en occupe |
| **Lemon Squeezy** | Produit numérique, abonnement logiciel | Voir la page tarifs | Vendeur officiel, collecte et reverse la TVA européenne |
| **Ko-fi** | Pourboire | 0 % sur les pourboires ponctuels, 5 % sur boutique/adhésions ; les nouveaux comptes démarrent avec l'option « Contributor » qui applique aussi 5 % aux pourboires — désactivable. Frais Stripe/PayPal en plus | À votre charge |

Pages officielles à vérifier : [stripe.com/pricing](https://stripe.com/pricing) ·
[gumroad.com](https://gumroad.com) · [lemonsqueezy.com](https://www.lemonsqueezy.com) ·
[ko-fi.com](https://ko-fi.com)

**Le choix qui compte vraiment, ce n'est pas le taux, c'est la TVA.** Vendre un
produit numérique à des particuliers dans l'Union européenne oblige normalement
à collecter la TVA du pays de l'acheteur. Gumroad et Lemon Squeezy se déclarent
« merchant of record » : ils deviennent le vendeur légal et gèrent cette
obligation. Avec Stripe, vous restez le vendeur et l'obligation reste la vôtre.
Pour un premier produit vendu à des particuliers européens, un merchant of
record vous épargne beaucoup d'administratif, même s'il prend davantage.

---

## 3. Créer le lien de paiement

**Stripe** (prestation, sur-mesure) : créez un compte, vérifiez votre identité
et votre IBAN, puis Dashboard → Paiements → **Payment Links** → nouveau lien.
Aucun code, aucun serveur : le lien mène à une page de paiement hébergée par
Stripe. Copiez l'URL, elle ressemble à `https://buy.stripe.com/…`.

**Gumroad / Lemon Squeezy** (pack téléchargeable) : créez le produit, téléversez
le fichier, fixez le prix, publiez. Copiez l'URL publique du produit.

**Ko-fi** (pourboire) : créez la page, désactivez l'option « Contributor » si
vous ne voulez pas des 5 % sur les pourboires, copiez l'URL de votre page.

---

## 4. Brancher les liens

Ouvrez `assets/js/offers.js` et collez chaque URL dans le champ `url` de
l'offre correspondante :

```js
{
  id: 'pack',
  url: 'https://votrenom.gumroad.com/l/promptforge-pro',   // ← ici
  ...
}
```

Ajustez aussi `price`, `title`, `desc` et `cta` : ce sont vos mots, pas les
miens. Les textes sont bilingues (`fr` / `en`), les deux sont obligatoires.

Vérifiez en local :

```bash
npm start          # http://127.0.0.1:8099
npm test           # les offres sont couvertes par la suite de tests
```

Puis publiez : un `git push` sur `main` déclenche le déploiement GitHub Pages
configuré dans `.github/workflows/pages.yml`.

---

## 5. Où arrive l'argent, et quand

Le paiement n'atterrit **pas** directement sur une carte bancaire. Le circuit
réel est : acheteur → prestataire → **virement sur votre compte bancaire (IBAN)**.

- **Stripe** : après vérification du compte et de l'IBAN, les virements en mode
  réel prennent typiquement **1 à 3 jours ouvrés** selon la documentation Stripe.
  Stripe propose aussi des *Instant Payouts* (versement en quelques minutes,
  1 % de frais, vers une carte de débit éligible ou un compte bancaire) — **je
  n'ai pas pu confirmer l'éligibilité en France** : la documentation Stripe est
  inaccessible depuis cet environnement. Vérifiez sur
  [la page Instant Payouts](https://docs.stripe.com/payouts/instant-payouts)
  avant de compter dessus.
- **Gumroad / Lemon Squeezy / Ko-fi** : versements périodiques sur compte
  bancaire ou PayPal, selon le calendrier propre à chaque plateforme.

Autrement dit : même dans le meilleur des cas, comptez **plusieurs jours entre
la première vente et l'argent disponible**, et plus encore avant la première
vente elle-même.

---

## 6. Côté légal

Encaisser de façon répétée des paiements pour une prestation ou un produit, en
France, suppose un statut qui vous permet d'émettre des factures (micro-
entreprise / auto-entrepreneur, par exemple), et les revenus sont imposables.
Je ne cite volontairement aucun seuil ni taux ici : ils évoluent et je ne veux
pas vous transmettre un chiffre périmé. Sources officielles :

- [service-public.fr](https://www.service-public.fr) — statut et obligations
- [autoentrepreneur.urssaf.fr](https://www.autoentrepreneur.urssaf.fr) — déclaration et cotisations
- [impots.gouv.fr](https://www.impots.gouv.fr) — fiscalité, TVA

Un pourboire reçu à titre occasionnel et un chiffre d'affaires récurrent ne se
traitent pas de la même façon : si vous visez le second, renseignez-vous avant
la première vente, pas après.

---

## 7. La partie que le code ne résout pas

Un bouton de paiement sur un site sans visiteurs rapporte zéro euro. C'est la
contrainte principale, et aucune ligne de JavaScript ne la lève.

Ce qui fait la différence, dans l'ordre :

1. **Que le site existe publiquement** — vérifiez que GitHub Pages sert bien
   l'adresse, et qu'elle est indexable.
2. **Qu'on le trouve** — l'outil répond à une recherche précise (« générateur
   de prompt », « améliorer un prompt ChatGPT »). Le contenu de la page compte
   plus que le code.
3. **Qu'on ait une raison de payer** — le moteur est gratuit et le code est sous
   GPL-3.0 : personne ne paiera pour ce qui est déjà accessible. On paie pour
   du temps gagné (un pack prêt à l'emploi), pour du sur-mesure (votre travail),
   ou pour soutenir. D'où les quatre emplacements proposés.
4. **Que l'offre soit visible sans être pénible** — la section est en bas de
   page, après la méthode. C'est délibéré.

Un ordre de grandeur honnête : un site neuf, sans audience et sans promotion,
fait très peu de ventes les premiers mois. La prestation sur-mesure (point 3)
est de loin la ligne la plus rentable au départ, parce qu'elle ne dépend pas du
volume de trafic — un seul client sérieux vaut des centaines de pourboires.

---

*Tarifs et délais relevés en septembre 2026 auprès de sources publiques, y
compris des comparatifs tiers pour Gumroad et Ko-fi. Ils changent : vérifiez
les pages officielles avant toute décision engageante.*
