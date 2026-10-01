# STIP — Règles communes Communication

Ce document est le contrat commun de l’univers **Communication**.

## 1. Une seule application, trois vues

L’application canonique est **Communication** avec exactement trois onglets :

1. **Chat équipe**
2. **DM & groupes**
3. **Fauteuils**

Les raccourcis ne créent jamais une autre page ou un autre moteur. Ils ouvrent la même application directement sur le bon onglet.

Routes canoniques :
- `communication/chat`
- `communication/dm`
- `communication/fauteuils`

L’ancienne route `fauteuils` reste uniquement une compatibilité d’entrée et doit rejoindre `communication/fauteuils`.

## 2. Moteurs et sources de vérité

- Shell et navigation : `communication-app.js/.css`.
- Chat équipe + Fauteuils : `team-chat.js/.css`.
- DM, groupes, fils privés et réglages messages : `communication-hub.js/.css`.
- Backend unique messages : Edge Function `stip-messages`.
- Notifications téléphone : `stip-push` + `stip-sw.js`.
- Recherche/sélection d’agents : `STIPAgentSelector`.
- Permissions : toujours revalidées côté serveur.

Aucun onglet ne doit recréer un backend, un annuaire agents, un moteur de réactions, une logique de session ou un second système de notifications.

## 2 bis. Familles STIP

Communication reste une seule application et un seul backend, mais les données sont cloisonnées par **famille STIP**.

Règles actuelles :
- `brancardage` = brancardiers, chefs d’équipe brancardiers, stagiaires rattachés au brancardage et administration opérationnelle ;
- `hors_brancardage` = type temporaire « pas brancardier » tant qu’un autre corps de métier n’a pas sa propre famille ;
- un futur métier (par exemple les manipulateurs) recevra sa propre clé de famille sans créer une seconde application Communication.

Invariants :
- la ligne **Communication** reste visible dans Accès ;
- l’accès peut être coché/décoché par profil, mais la famille détermine qui peut se voir, se rechercher et communiquer ;
- Chat équipe et DM & groupes sont communs à toutes les familles, mais restent cloisonnés par famille ;
- **Fauteuils est un module métier du brancardage uniquement** ; il n’est pas affiché ni utilisable hors de la famille `brancardage` ;
- pour un futur métier, son éventuel troisième module opérationnel sera défini au moment où ce métier sera branché, sans lui imposer Fauteuils ;
- annuaire, groupes, DM, conversations collectives et notifications sont limités à la famille côté serveur ;
- aucun simple masquage UI ne remplace ce cloisonnement serveur ;
- les conversations existantes restent classées dans `brancardage`.

## 3. Séparation des trois onglets

**Chat équipe**
- messages d’équipe libres ;
- n’affiche pas les cartes Fauteuils ;
- compositeur libre en bas.

**DM & groupes**
- conversations `direct` et `group` ;
- un destinataire ouvre un DM ;
- plusieurs destinataires proposent d’abord :
  - **Créer un groupe** ;
  - **Envoyer séparément**.
- « Envoyer séparément » envoie le même texte dans des DM individuels, sans créer un groupe commun.

**Fauteuils**
- conserve le moteur opérationnel Fauteuils et son workflow guidé ;
- n’affiche que les signalements/recherches structurés Fauteuils ;
- les règles métier canoniques de `AGENTS.md` restent applicables.

## 4. Recherche et sélection d’agents

Toute recherche « Rechercher un agent » dans Communication réutilise le composant partagé `STIPAgentSelector`.

La sélection multiple est un état du sélecteur commun, jamais une seconde liste locale.

Quand le clavier est ouvert :
- champ, filtres et résultats restent ensemble ;
- le moteur de recherche commun suit `visualViewport` ;
- une fermeture explicite permet de quitter la recherche sans perdre la sélection.

## 5. Formulaires et compositeurs

Communication consomme les règles communes de `FORM_RULES.md` :

- message Chat équipe : `data-stip-form-mode="composer"` ;
- message DM / groupe : `composer` ;
- envoi séparé : `composer` ;
- saisie IA de dialogue : `composer` ;
- réglages/profil et formulaires structurés non séquentiels : `standard` ;
- recherche agent : moteur de recherche commun / `STIPAgentSelector`.

Un compositeur ne devient jamais un questionnaire séquentiel. Entrée dans un `textarea` reste une nouvelle ligne ; l’action d’envoi reste explicite.

## 6. Notifications

Un seul moteur de notifications est utilisé pour les trois onglets.

Événements canoniques :
- `team_chat_received` → Chat équipe ;
- `dm_received` → DM & groupes ;
- `wheelchair_received` → Fauteuils.

Chaque notification transporte son `event_key`, utilise l’icône de son univers et ouvre directement :
- le bon onglet ;
- la conversation ou le message concerné lorsqu’un identifiant est disponible.

Les préférences personnelles sont centralisées dans **Mon profil > Paramètres > Notifications** :
- la liste est dérivée de `stip_notification_types` / `stip_notification_preferences` ;
- chaque type actif est coché ou décoché depuis cette seule surface ;
- l’aperçu du contenu des messages y est réglé au même endroit ;
- Chat équipe, DM & groupes, Fauteuils, la Cloche et « Réglages messages » ne portent aucun interrupteur de notification concurrent ;
- l’autorisation téléphone est demandée uniquement quand l’utilisateur active un type nécessitant le push depuis ce panneau central.

La Cloche peut agréger les événements, mais elle ne doit pas effacer leur origine.

## 7. Navigation et raccourcis

- Le bouton Retour utilise `STIPRouter` et l’historique STIP.
- Le raccourci Fauteuils ouvre `Communication > Fauteuils`.
- Tout futur raccourci Chat ou DM doit ouvrir le même shell sur son onglet.
- Les inscriptions Sorties & loisirs alimentent automatiquement un groupe canonique par date via `stip_leisure_chats`. Une désinscription retire la personne du groupe concerné. Les raccourcis ouvrent DM & groupes sur la conversation ; le backend messages et les permissions existants restent communs.
- Changer d’onglet ne recharge pas la session et ne passe pas par une page HTML autonome.

## 8. Stabilité mobile

- Aucun rafraîchissement silencieux ne remplace le DOM sous le doigt ou pendant une saisie.
- Les compositeurs restent visibles au-dessus du clavier.
- Les signatures de rendu reposent sur des identifiants stables.
- Un push ou un retour d’application actualise silencieusement la donnée sans perdre le brouillon.

## 9. Permissions et confidentialité

- Masquer un bouton n’est jamais une sécurité.
- Lecture/écriture/admin sont revalidés par `stip-messages`.
- Un agent ne peut lire qu’un DM dont il est membre.
- Les règles Chat équipe/Fauteuils continuent à respecter `team_chat_mode`.
- Les préférences de notification sont propres à chaque `event_key`.

## 10. Invariants de non-régression

Une évolution Communication est valide seulement si :
- les trois onglets restent dans le même shell ;
- aucun nouveau backend parallèle n’est créé ;
- la recherche agent utilise `STIPAgentSelector` ;
- tous les vrais formulaires ont un `data-stip-form-mode` explicite ;
- le raccourci Fauteuils et les anciennes entrées compatibles aboutissent au bon onglet ;
- une notification DM/Chat/Fauteuil ouvre le bon contexte ;
- le clavier mobile ne masque ni le champ ni l’action principale ;
- Chat équipe et Fauteuils ne mélangent pas leurs messages racine ;
- DM individuel, groupe et envoi séparé restent trois comportements distincts.
