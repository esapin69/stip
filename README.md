# Fauteuils — paquet de site séparé (PRÉPARATION NON PUBLIÉE)

Ce dossier contient les **fichiers à placer à la racine d'un hébergement autonome**. Le dépôt GHE n'est **pas** la cible finale. Ne pas fusionner ce dossier sur `main` pour le publier : la mise en ligne requiert une validation distincte et un hébergement séparé, après contrôle des accès. Aucune zone DNS, projet, table, fonction, autorisation ni donnée GHE n'est modifiée par cette préparation.

## Décision d'architecture

- **Deux interfaces, une base métier** : le chat Fauteuils continue à demander son catalogue via `wheelchair_catalog` au backend existant `stip-messages`, qui le construit depuis `stip_places`. Les ajouts/changements de services faits dans « Visiter les lieux » sont donc repris automatiquement, sans deuxième catalogue à maintenir.
- **Mêmes conversations** : `stip-messages` conserve les messages, signalements, récupérations, rôles et règles de famille brancardage. Aucun nouvel identifiant de salon ni table parallèle.
- **Moteur d'interface commun** : `team-chat.js`, `team-chat.css` et le style commun sont chargés depuis `https://ghe.esapin.com/`. Les correctifs de moteur faits sur GHE sont réutilisés sans copie, tant que cette adresse sert les fichiers. C'est une dépendance résiduelle assumée : *l'adresse de Fauteuils est séparée, mais son fonctionnement reste dépendant de ces fichiers du GHE*.
- **Connexion indépendante** : le même code à six chiffres et les mêmes autorisations serveur, mais session navigateur propre à l'origine `Fauteuils` ; pas de transfert silencieux du jeton GHE vers un autre domaine.
- **Gestion des pannes** : les refus explicites 401/403 invalident la session ; les coupures réseau et réponses serveur temporaires la préservent.
- **Confidentialité** : accès limité à la famille `brancardage` et permission `messages`, revalidés par `stip-messages`. Le fait de ne pas afficher de nom de patient ne suffit pas à rendre l'ensemble du référentiel hospitalier public ; ne pas supprimer l'authentification.

## Contenu

- `index.html` : interface autonome et point d'entrée.
- `fauteuil-app.js` : connexion, sessions et montage du moteur partagé.
- `fauteuil.css` : style de la seule interface autonome.
- `manifest.webmanifest` : installation comme application indépendante.
- `contract-test.mjs` : contrôle statique de la connexion au catalogue et de l'absence de duplication.

## Mise en ligne ultérieure (ne pas exécuter sans validation)

1. Utiliser un **dépôt/hébergement distinct** pour ce paquet, pas la publication `ghe.esapin.com`.
2. Garder le `CNAME` du dépôt STIP et toutes les ressources GHE inchangés. Si un sous-domaine est prévu, vérifier propriété DNS, HTTPS et coût réel avant création. Ne pas supposer que `fauteuil.esapin.com` est déjà actif.
3. Vérifier en ligne le chargement du moteur `team-chat.js` et des styles depuis `ghe.esapin.com`; vérifier également CORS sur les fonctions Supabase.
4. Tester avec un vrai profil autorisé, un refusé, un stagiaire, un code incorrect, un 401 et une panne réseau ; vérifier « J'ai vu », « Je cherche », récupération, messages existants et affichage d'un service modifié dans « Visiter les lieux ».
5. Vérifier mobile/clavier et les liens des notifications push. Les notifications mobiles pourraient nécessiter une adaptation propre à la nouvelle origine ; ne **pas** annoncer leur prise en charge avant test.
6. Surveiller le risque d'information interne (lieux détaillés, contacts, photos, messages libres) avant ouverture à des tiers.

**Coût supplémentaire engagé : 0 € par cette préparation.**
