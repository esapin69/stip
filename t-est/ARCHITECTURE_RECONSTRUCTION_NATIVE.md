# T-est — règle de reconstruction native (13/10/2026)

## But
T-est est l'atelier de **reconstruction complète de l'univers T/GHE**, et non un lecteur des pages historiques. L'accueil est une page verticale unique composée de blocs et de carrousels. Une fois tous les parcours vérifiés et approuvés, cette reconstruction pourra remplacer l'ancien site. **Ne jamais promouvoir automatiquement.**

## Contrat technique obligatoire
1. **Aucune ancienne page embarquée** : interdiction de créer des iframes vers `index.html`, `sorties-loisirs.html`, etc. Ne pas copier les en-têtes/menus/onglets/hero HTML historiques dans les blocs.
2. **Réemployer le moteur, pas l'écran** : réutiliser les API Supabase, règles métier, permissions, données, ressources visuelles et modules fonctionnels exportés (ex. `STIPTableau.mount`, `STIPLeisure.setTab`). Créer au besoin un adaptateur de montage natif.
3. **Source de vérité inchangée** : mêmes tables, mêmes contrôles d'accès, même jeton de session. Pas de duplication métier ni de suppression de données.
4. **Un seul contrôleur de sélection global** : cliquer ouvre le contenu sous le carrousel concerné, replie le précédent, aligne ce carrousel sous la barre Accueil; re-cliquer ferme et réouvrir conserve le DOM/draft pendant la session.
5. **Pop-ups non modaux sous le bloc** : même règle de sélection et de défilement; pas de masque superposé.
6. **Swipe natif** : ne pas intercepter touchstart/touchmove/touchend. Carrousels horizontaux, page verticale; seule la bande d'historique est fixe.
7. **Composants réutilisables** : chaque ancienne fonctionnalité devient un module indépendant `mount(root, options)`, avec état, destruction/masquage adaptés. Les pages historiques restent intactes jusqu'à validation.
8. **Performance** : affichage instantané des cartes; chargement des modules à la demande; réutiliser les données en cache pour le même agent; ne pas relancer un bootstrap complet pour un simple clic.
9. **Validation** : contrôler permissions, mobile, création/envoi, repli/réouverture, scroll/swipe, erreurs serveur, sécurité, notifications et régression visuelle avant bascule.

## État de la migration, sans présumer de la réussite mobile
- **Planning** : données et vue hebdomadaire natives dans T-est; l'intégralité des outils du planning historique reste à migrer.
- **DM** : liste, annuaire, ouverture de discussion, lecture/envoi texte natifs via `stip-messages`; fonctions avancées restant à porter.
- **Fauteuils** : montage direct de `STIPTableau.mount` sans page historique.
- **Activités / Trajets / Invitations** : moteur `STIPLeisure` et ses modules associés montés avec les conteneurs requis, sans page historique.
- **Autres espaces de l'univers T** : migration à poursuivre bloc par bloc; ne pas les prétendre finalisés.

## Fichiers T-est
- `accueil/accueil-unifie.js` : orchestrateur unique des cartes et des panneaux.
- `accueil/accueil-modules-natifs.js` : adaptateurs de modules.
- `accueil/accueil-v3.js` : lecture des données de planning.
- `accueil/accueil-v3-canaux.js` : accès et création des canaux existants.
- `accueil/accueil-historique.js` : bande Accueil/historique.
- `accueil/index.html` : shell léger sans composants de l'ancien site.

## Critère de bascule vers le site définitif
**Accord explicite de l'utilisateur et contrôle complet des fonctionnalités, permissions et parcours mobiles.** Tant que ces critères ne sont pas satisfaits, ne modifier que `t-est/`.
