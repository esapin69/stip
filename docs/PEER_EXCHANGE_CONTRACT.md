# GHE — Déclaration d'échanges déjà effectués entre collègues

## Objectif

Les personnes ayant accès à leur **planning personnel** peuvent déclarer qu'un ou plusieurs échanges ont déjà eu lieu. Le site demande à l'autre collègue une confirmation avant de modifier **les deux plannings internes STIP**. Cette opération est une déclaration entre agents, **pas une validation officielle de l'employeur**.

## Expérience

1. Depuis l'accueil, bouton visible « J’ai déjà échangé des jours ».
2. Choisir un collègue actif ayant accès à son planning, dans la même équipe.
3. Choisir une ou plusieurs dates, isolées ou sur une période.
4. Mode « Mêmes dates » : inverser les codes du même jour.
5. Mode « Dates différentes » : deux séries de jours, avec association paire par paire libre. Pour chaque paire, le premier jour travaillé change de personne et le second jour travaillé change en sens inverse. Les deux créneaux libérés doivent être R ou RH ; congés et postes déjà occupés ne sont jamais écrasés.
6. Vérifier les codes puis envoyer une confirmation au collègue.
7. À sa prochaine ouverture de GHE, afficher une fenêtre claire avec **Oui, mettre nos plannings à jour** / **Non, refuser**. Les demandes restent accessibles via le bouton, même après fermeture de la fenêtre.
8. En cas d'accord : la base `planning` est modifiée **en une transaction unique** pour toutes les dates et pour les deux collègues. Un historique nominatif en base conserve avant/après. Si les codes ont changé depuis la demande, **ne rien appliquer** et expliquer l'erreur.
9. Les vues personnelles consomment la même base `planning`. Le fichier ICS d'abonnement personnel est produit depuis cette base et son horodatage `LAST-MODIFIED` utilise le dernier changement effectif. Le téléphone met à jour **à sa prochaine synchronisation**, sans délai garanti par le site.
10. Refus et annulation ne modifient aucun shift. Les emails professionnels et circuits de validation cadre existants restent indépendants et inchangés.

## Architecture / sécurité

- Interface : `peer-exchange.js`, `peer-exchange.css`, entrée native `home-shell.js`.
- Authentification : même session STIP serveur que les autres actions `stip-change`. Le navigateur n'utilise **aucune clé service role**.
- Autorisation d'initier : profil actif `planning_personal=true` et agent non chef/cadre. Le destinataire doit être un agent actif du même groupe, doté d'un accès personnel actif.
- Table `stip_peer_exchanges` : stockage privé (RLS activée ; aucun accès anon/authenticated) ; le statut ne peut évoluer vers `completed` que par RPC transactionnelle.
- RPC `stip_peer_exchange_decide` : droits EXECUTE révoqués à PUBLIC/anon/authenticated, service_role seulement, vérification du destinataire et verrouillage `FOR UPDATE`.
- Historique : `stip_planning_change_history` avec référence de déclaration dans `metadata.peer_exchange_id` ; aucun effacement de l'historique antérieur.
- Import officiel : conserve les overrides STIP effectifs selon la politique de réconciliation déjà déployée.
- Aucune modification des connexions, codes d'accès, calendriers autres que celui des deux agents concernés, ou tableaux de bord de cadres.

## Vérifications de recette à réaliser avant publication

| Cas | Résultat attendu |
| --- | --- |
| Même jour M ↔ RH | Changement simultané des deux agents à la confirmation |
| 3 jours non consécutifs | Les trois paires sont appliquées ou aucun changement |
| Période complète | Tous les jours compatibles sélectionnés |
| Deux dates différentes (M/RH et RH/J) | Quatre cases changent, sans écraser un poste travaillé |
| Plusieurs dates croisées associées librement | Association respectée, sans doublon |
| Collègue refuse / demandeur annule | Aucune case planning modifiée |
| Planning modifié après proposition | Refus transactionnel, aucune application partielle |
| Personne non autorisée ou non destinataire | Refus côté serveur |
| Ouverture du site avec échange en attente | Popup + accès permanent depuis le bouton |
| ICS des deux agents | Événements ajoutés, déplacés ou retirés au prochain rafraîchissement |

## Séquence de mise en production

Ne pas fusionner le brouillon avant validation. Pour publier sans erreur d'endpoint :
1. Appliquer la migration SQL `20261102170000_peer_confirmed_exchange.sql` dans le projet Supabase **Stip.eSapin**.
2. Déployer la fonction Supabase `stip-change` avec son fichier `peer-exchanges.ts`.
3. Déployer `stip-calendar` (horodatages ICS).
4. Fusionner la PR GitHub, puis vérifier la disponibilité sur `stip.esapin.com`.
5. Vérifier un échange fictif dans un environnement de test avant toute modification sur des plannings réels.

**Statut : préparation uniquement, aucun changement de planning réel / aucun déploiement production.**
