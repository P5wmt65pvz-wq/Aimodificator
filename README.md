# PromptForge

**Transformez n'importe quelle demande en un prompt professionnel, prêt à envoyer à une IA.**

Écrivez votre demande comme elle vous vient. PromptForge en fait un prompt structuré —
rôle, contexte, méthode, contraintes, format de sortie, critères de qualité — que vous
collez tel quel dans Claude, ChatGPT, Gemini, Mistral ou un modèle de génération d'images.

Site statique, sans dépendance, sans compte, sans traceur. **Le moteur s'exécute
entièrement dans le navigateur : aucune donnée n'est envoyée à un serveur.**

---

## Ce que fait le site

| | |
|---|---|
| **17 domaines d'expertise** | Développement, données, rédaction, marketing, SEO, e-mail, réseaux sociaux, recherche, pédagogie, stratégie, produit/UX, image, vidéo, traduction, juridique, finance, généraliste. Chaque domaine a son propre expert, sa méthode de travail, ses contraintes, ses critères de qualité et ses pièges connus. |
| **Détection automatique** | Le domaine, la langue et les éléments concrets de la demande (volumes, formats, ton, public, chiffres, échéances) sont repérés à la saisie. |
| **5 formats de sortie** | Markdown structuré · balises XML · compact · JSON · système + utilisateur. Le format recommandé pour l'IA cible est signalé par un losange. |
| **Score avant / après** | La demande brute et le prompt généré sont notés sur les **mêmes** 8 dimensions, donc la comparaison est directe. Chaque dimension faible vient avec un conseil concret. |
| **24 modèles de départ** | Des demandes déjà bien formulées à adapter : article, e-mail de prospection, relecture de code, page de vente, spécification produit, prévisionnel, script vidéo, prompt d'image… |
| **Bilingue** | Interface et prompts générés en français ou en anglais, avec une langue de réponse indépendante (11 langues). |
| **Confort** | Thème clair/sombre, historique local, lien de partage, téléchargement `.md`, `⌘/Ctrl + ⏎` pour forger. |
| **Affinage IA (optionnel)** | Une passe de relecture par votre propre compte API. Facultatif : le site est complet sans. |

## Les 8 dimensions du score

Clarté de la demande · Contexte fourni · Précision & détails · Public cible ·
Format attendu · Contraintes & limites · Exemples / références · Critère de réussite.

Le même barème est appliqué à votre demande et au prompt généré. Le gain affiché est
une mesure, pas une promesse commerciale.

## Ce que le moteur ajoute à votre demande

1. **Un rôle réellement spécialisé** — l'expert du domaine détecté, pas un « assistant utile ».
2. **Le contexte conservé mot pour mot** — votre demande d'origine est toujours reprise telle quelle.
3. **Une méthode ordonnée** — les étapes de travail du domaine, explicitées.
4. **Des critères de qualité vérifiables** — que le modèle relit avant de répondre.
5. **Une clause contre l'invention** — interdiction d'inventer chiffres, sources, citations et dates.
6. **Les pièges du domaine, nommés** — les travers connus sont interdits explicitement.
7. **Un format de sortie décidé** — longueur, structure, langue, type de livrable.
8. **Le bon niveau de raisonnement** — direct, équilibré ou approfondi.
9. **Une règle pour ce qui manque** — poser une hypothèse et la signaler, ou poser des questions d'abord.

---

## Utilisation en local

Aucun outil de build. Ouvrez `index.html` dans un navigateur, ou servez le dossier :

```bash
npx http-server -p 8099 .
# puis http://127.0.0.1:8099
```

## Tests

```bash
npm test          # ou : node --test tests/engine.test.mjs
```

29 tests couvrent la détection de domaine et de langue, le nettoyage de la demande,
les cinq formats de sortie, la validité du JSON et des balises XML, la progression du
score, les options, la bibliothèque complète (FR et EN), les entrées hostiles et la
construction des requêtes API.

## Déploiement

Le workflow `.github/workflows/pages.yml` publie le dépôt sur GitHub Pages à chaque
push sur `main`. Il n'y a rien à compiler : les fichiers sont servis tels quels.

## Structure

```
index.html              page unique
assets/css/app.css      feuille de style unique (thème clair + sombre)
assets/js/profiles.js   les 17 profils d'expertise, bilingues
assets/js/templates.js  les 24 modèles de la bibliothèque
assets/js/engine.js     analyse, score et construction des prompts
assets/js/i18n.js       chaînes d'interface FR / EN
assets/js/ai.js         affinage optionnel par API (clé de l'utilisateur)
assets/js/offers.js     offres payantes — liens de paiement à renseigner
assets/js/app.js        interface
tests/engine.test.mjs   suite de tests (node --test)
```

Chaque module fonctionne aussi bien dans le navigateur (variable globale `PF`) que
sous Node (`require`), ce qui permet de tester le moteur sans navigateur.

## Monétisation

Le site peut afficher jusqu'à quatre offres — pourboire, pack payant, prestation
sur-mesure, sponsor — dont les liens de paiement se renseignent uniquement dans
`assets/js/offers.js`.

Une offre dont l'URL est vide, non `https`, ou restée à l'état d'exemple **n'est
jamais montrée aux visiteurs** ; sans aucune offre branchée, la section disparaît
du site public. En local, elle affiche à la place un rappel de configuration.

Marche à suivre complète, prestataires, frais relevés et délais de versement :
[MONETISATION.md](MONETISATION.md).

## Vie privée

- Le moteur d'analyse et de génération est **entièrement local**. Rien n'est transmis.
- L'historique, les réglages et le thème sont stockés dans le `localStorage` de votre
  navigateur, et nulle part ailleurs.
- L'affinage par IA est la **seule** fonction qui émet une requête réseau, uniquement
  si vous la déclenchez, vers le fournisseur que vous avez choisi, avec votre clé.
  Une clé API saisie dans un navigateur est lisible par toute personne ayant accès à
  l'appareil : ne la mémorisez pas sur un poste partagé. La requête part directement
  du navigateur et n'aboutit que si le fournisseur accepte les appels d'origine
  navigateur.

## Licence

GPL-3.0 — voir [LICENSE](LICENSE).
