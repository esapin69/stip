# Refonte STIP — registre d'acceptation

Ce registre traduit les décisions validées du document « STIP — Mes idées » en contrôles exécutables. Une ancienne couche n'est retirée qu'après parité vérifiée.

## Invariants

- Conserver `X-STIP-Session` et les contrôles serveur existants.
- Ne perdre aucune fonction, donnée, trace, permission, action ou retour utilisateur utile.
- Réutiliser les moteurs existants, notamment `stip-calendar` et les vues d'effectifs.
- Tester chaque bascule sur mobile et desktop, puis conserver un retour arrière jusqu'à validation.
- Le thème STIP reste la source visuelle unique.

## Critères produit

- [x] Accueil : date réelle indépendante de la semaine parcourue, flèches sans sélection implicite et sept jours lisibles.
- [x] Accès : applications sélectionnées individuellement ; niveau Visiteur/Pro défini application par application ; Pro absent sans vraie variante.
- [x] Demandes d'accès : parcours minimal, états compréhensibles, actions frontend/backend alignées et traces conservées.
- [x] Cloche : centre unique « À traiter », vue Tout et filtres par catégorie, sans perte des usages actuels.
- [x] Esprit d'équipe : vue globale et volets Équipe, Activité, Assistant sur une même page ; moteurs techniques réutilisés.
- [x] Responsable : cockpit riche affichant directement couverture, écarts, alertes, demandes, événements et recommandations.
- [x] Calendrier : entrée « Synchroniser mon calendrier », raccourcis contextuels intégrés, aucune bulle flottante, moteur `stip-calendar` unique.
- [x] PDF : un clic ouvre un aperçu A4 paysage complet et prêt à imprimer.
- [x] Anciennes couches : retrait uniquement après inventaire, preuve d'absence d'usage et comparaison de parité.

## Couches historiques conservées volontairement

- `assistant.html` et `cadre-activite.html` restent les vues détaillées ouvertes depuis « Esprit d’équipe ».
- `planning/team` reste le moteur détaillé du volet Équipe.
- `print.html`, `planning-ui.js` et `planning-print-fidelity.js` restent disponibles tant que l’absence d’accès direct historique n’est pas prouvée par de la télémétrie.
- `stip_access_profile_models` reste lisible par les fonctions Edge pour la compatibilité ; les nouveaux enregistrements utilisent `stip_access_role_presets` et `stip_app_catalog`.
- Aucune table, donnée métier, trace de demande ou fonction Edge historique n’a été supprimée.

Le CSS de l’ancienne carte « Accès à contrôler » a été retiré après bascule complète vers le centre « À traiter ». Aucun autre retrait n’a été effectué sans preuve de parité.

## Matrice de vérification

- Rôles : agent, responsable Visiteur, responsable Pro, cadre, admin.
- Écrans : 320, 360, 390, 430 px et desktop.
- Données : normales, vides, partielles, anciennes et en erreur.
- Sessions : valide, expirée, révoquée et accès direct interdit.
- Régressions : navigation, permissions, chargements, filtres, actions, feeds calendrier, impression et connexion à six chiffres.
