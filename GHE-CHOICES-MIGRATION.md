# GHE — parcours unifiés (préparation non publiée)

## Source de vérité
Les trois fenêtres « Discussions », « Covoiturage » et « Créer ou proposer » restent identiques. Elles dirigent vers les modules métier existants sans dupliquer la base de données.

| Action | Module | Destination |
|---|---|---|
| Discussions collègues | Communication, DM | Inbox filtré aux échanges directs et groupes libres |
| Discussions des événements | Communication, DM | Inbox filtré aux discussions liées aux événements |
| Fauteuils | Communication, Fauteuils | Onglet de signalements et échanges |
| J'ai ma voiture | Sorties et trajets | Offre de places après contrôle des préférences |
| Je n'ai pas la voiture | Sorties et trajets | Liste des offres de trajets, demande de place |
| Créer un événement pour quelqu'un | Agenda agent | Choix de la personne, formulaire si droit |
| Proposer une activité | Sorties et trajets | Formulaire et invitations |
| Proposer un covoiturage | Choix GHE | Deux chemins conducteur/passager |

## Compatibilité et pages non supprimées
- `agent-directory.html` reste la page d'annuaire normale ; `?intent=add-event` ajoute l'action directe autorisée.
- `sorties-loisirs.html?tab=agenda`, `?tab=create`, `?tab=trips` restent valides ; `choice` affine l'entrée dans le module.
- `index.html#/communication/dm` et `index.html#/communication/fauteuils` restent valides ; `filter` affine seulement les conversations affichées.
- Les liens directs à une conversation ou activité par ID sont conservés.
- Aucune page héritée n'est supprimée, car les liens entrants extérieurs n'ont pas tous été inventoriés. L'inventaire complet des pages anciennes est une étape distincte **avant suppression**.

## Garde-fous
- Droits d'édition agenda inchangés, contrôlés par les services métiers et par le rendu existant.
- Aucun appel de mutation réalisé lors de la préparation (sauf fichiers de code dans la branche).
- Aucune modification de Supabase, Vercel ou des tables/messages existants.
- Test de contrat `tools/ghe-choices-routing-test.mjs` et contrôles syntaxiques intégrés au CI du dépôt.
- Aucun déploiement ni fusion dans `main` sans validation explicite.
