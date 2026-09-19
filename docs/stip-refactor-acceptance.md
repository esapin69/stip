# Refonte STIP — registre d'acceptation

Ce registre traduit les décisions validées du document « STIP — Mes idées » en contrôles exécutables. Une ancienne couche n'est retirée qu'après parité vérifiée.

## Invariants

- Conserver `X-STIP-Session` et les contrôles serveur existants.
- Ne perdre aucune fonction, donnée, trace, permission, action ou retour utilisateur utile.
- Réutiliser les moteurs existants, notamment `stip-calendar` et les vues d'effectifs.
- Tester chaque bascule sur mobile et desktop, puis conserver un retour arrière jusqu'à validation.
- Le thème STIP reste la source visuelle unique.

## Critères produit

- [ ] Accueil : date réelle indépendante de la semaine parcourue, flèches sans sélection implicite et sept jours lisibles.
- [ ] Accès : applications sélectionnées individuellement ; niveau Visiteur/Pro défini application par application ; Pro absent sans vraie variante.
- [ ] Demandes d'accès : parcours minimal, états compréhensibles, actions frontend/backend alignées et traces conservées.
- [ ] Cloche : centre unique « À traiter », vue Tout et filtres par catégorie, sans perte des usages actuels.
- [ ] Esprit d'équipe : vue globale et volets Équipe, Activité, Assistant sur une même page ; moteurs techniques réutilisés.
- [ ] Responsable : cockpit riche affichant directement couverture, écarts, alertes, demandes, événements et recommandations.
- [ ] Calendrier : entrée « Synchroniser mon calendrier », raccourcis contextuels intégrés, aucune bulle flottante, moteur `stip-calendar` unique.
- [ ] PDF : un clic ouvre un aperçu A4 paysage complet et prêt à imprimer.
- [ ] Anciennes couches : retrait uniquement après inventaire, preuve d'absence d'usage et comparaison de parité.

## Matrice de vérification

- Rôles : agent, responsable Visiteur, responsable Pro, cadre, admin.
- Écrans : 320, 360, 390, 430 px et desktop.
- Données : normales, vides, partielles, anciennes et en erreur.
- Sessions : valide, expirée, révoquée et accès direct interdit.
- Régressions : navigation, permissions, chargements, filtres, actions, feeds calendrier, impression et connexion à six chiffres.
