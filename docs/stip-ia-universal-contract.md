# STIP IA — contrat d’interface universelle v1

## Cible produit

STIP IA doit devenir l’entrée universelle de STIP.

L’utilisateur ne doit pas avoir à connaître le nom des applications, des pages ou des menus. Il peut écrire une phrase complète, une phrase mal écrite, un fragment ou une reprise de contexte. STIP IA comprend l’objectif, interroge uniquement les moteurs STIP autorisés, puis répond ou prépare l’action.

Les applications existantes restent les moteurs métier et les écrans détaillés. Elles ne disparaissent que lorsque la parité conversationnelle est prouvée. Aucune fonction utile ne doit être perdue.

Principe : **surprise utile, jamais invention**.

## Règles non négociables

- Les données métier viennent de STIP/Supabase, jamais du modèle.
- X-STIP-Session et les permissions serveur restent autoritaires.
- Le modèle n’obtient jamais un accès SQL, HTTP arbitraire ou base complète.
- Une formulation courte doit être acceptée : `vacances ?`, `soir mardi`, `son numéro`, `et mercredi ?`, `les mêmes ?`.
- Le contexte doit être conservé quand il aide et oublié dès qu’il devient dangereux ou contradictoire.
- Une ambiguïté réelle produit une clarification courte, pas un fallback générique.
- Une action d’écriture doit être préparée puis confirmée explicitement avant exécution.
- Une réponse doit être courte par défaut et proposer l’étape utile suivante.
- Le moteur déterministe reste prioritaire quand la demande est sûre et connue.
- Le moteur sémantique sert à comprendre les formulations inconnues, les fautes, les fragments et les demandes composées.
- Aucun écran/case n’est supprimé avant validation de parité.

## Parité des cases actuelles

| app_key | Case actuelle | Ce que STIP IA doit savoir faire |
|---|---|---|
| profile_photo | Modifier sa photo | Comprendre « change ma photo », ouvrir directement le bon écran/action. |
| planning_personal | Planning perso | Horaires, périodes, prochain service, prochain repos, CA/RTT, reprise, résumé semaine/mois. |
| planning_team | Planning équipe | Présents, absents, shifts, collègues en même temps, qui commence/finit avec moi. |
| change_app | Changement | Rechercher candidats, comparer, préparer échange/modification, ouvrir le workflow prérempli. |
| calendar_subscribe | Synchroniser mon calendrier | Comprendre « mets mon planning dans mon calendrier » et ouvrir/préparer l’abonnement adapté. |
| agent_dates | Date des agents | Visites médicales, formations, stagiaires, événements et dates autorisées. |
| contacts | Contacts | Téléphone, e-mail, recherche agent, appel/copier/message selon permissions. |
| responsable | Responsable | Questions de pilotage autorisées, effectifs, alertes, puis ouverture du cockpit si détail nécessaire. |
| notes | Prendre des notes | Niveau Pro uniquement ; créer/retrouver une note avec confirmation pour l’écriture. |
| nouveaux_arrivants | Nouvel agent | Ouvrir le parcours, retrouver les éléments utiles, guider l’utilisateur. |
| file_upload | Importer | Comprendre l’intention d’import et ouvrir la bonne fonction avec contraintes explicites. |
| activity | Esprit d’équipe | Répondre aux questions équipe/activité/assistant sans obliger à ouvrir la page. |
| admin | Admin | Comprendre la demande d’administration ; exécuter uniquement les opérations explicitement autorisées et confirmées. |
| places | Visiter les lieux | Recherche lieu, alias, étage, bâtiment, repères, relations, itinéraires, sous-lieux. |
| assistant_enabled | Assistant STIP | Fusionner les recommandations utiles dans STIP IA ; éviter deux assistants concurrents. |
| access_manage | Accès | Lire/guider ; toute modification d’accès reste permissionnée et confirmée. |
| dialog | Demander à STIP | Devient la porte d’entrée centrale. |
| messages | Messages | Trouver destinataire, préparer conversation/groupe, ouvrir messagerie ; envoi confirmé. |
| tomorrow | Actions | « Qu’est-ce que j’ai à faire demain ? », rappels, événements et actions à venir. |
| agent_directory | Équipe | Recherche d’agents, présence, absence, coordonnées et accès à la fiche. |

## Architecture cible

### 1. Compréhension
Entrée libre : texte, fautes, raccourcis, fragments, reprises.

Sortie structurée minimale :
- intention(s) ;
- sujet(s) ;
- période/date(s) ;
- lieu éventuel ;
- objectif final ;
- niveau de confiance ;
- éléments manquants.

### 2. Registre de capacités
Chaque capacité STIP a un contrat serveur strict :
- nom stable ;
- paramètres validés ;
- permission requise ;
- lecture / préparation / écriture ;
- sources de données autorisées ;
- résultat structuré ;
- actions possibles.

Le modèle ne voit pas les tables ; il voit seulement les capacités disponibles pour la session.

### 3. Orchestration
Le moteur doit accepter les demandes composées.

Exemple :
« mes prochains congés et avec qui je reprends ? »

Plan serveur :
1. trouver la prochaine période CA/RTT autorisée ;
2. déterminer la date de reprise ;
3. charger le planning de reprise ;
4. trouver les collègues qui croisent ce shift ;
5. composer une réponse courte.

Les lectures peuvent être chaînées. Une écriture interrompt la chaîne et demande confirmation.

### 4. Contexte conversationnel
Conserver séparément :
- sujet courant ;
- personnes sélectionnées ;
- période/date ;
- lieu ;
- dernier résultat ;
- dernière intention ;
- objectif en cours ;
- suggestions déjà proposées.

Le contexte ne doit pas être une simple accumulation. Chaque nouvelle phrase doit pouvoir :
- reprendre ;
- remplacer ;
- compléter ;
- ou invalider un champ.

### 5. Clarification
Exemples :
- « vacances ? » → Mes prochains CA/RTT · Vacances scolaires · Jours fériés.
- « son numéro » → reprendre la personne courante.
- « mardi soir » après un échange → mardi + shift S.
- « les mêmes mercredi » → même sélection de personnes, nouvelle date.
- « et lui ? » sans référent fiable → demander qui, sans inventer.

### 6. Actions
Trois niveaux :
- **Lecture** : exécution directe.
- **Préparation** : STIP calcule/préremplit, puis montre ce qui va être fait.
- **Écriture** : confirmation explicite juste avant l’action irréversible ou communicante.

## Conditions avant de masquer une case

Une case ne devient optionnelle/masquée que si :
1. au moins 95 % du corpus d’évaluation de cette capacité passe ;
2. aucune permission serveur n’est contournable ;
3. les cas d’erreur/fallback sont explicites ;
4. l’ouverture de l’écran détaillé reste disponible ;
5. le temps de réponse est acceptable ;
6. les usages réels montrent que le dialogue couvre effectivement le besoin.

## Mesure et amélioration continue

Créer une télémétrie technique minimale :
- domaine/intention détecté ;
- moteur utilisé : déterministe / sémantique ;
- capacité(s) appelée(s) ;
- succès / clarification / fallback / erreur ;
- latence ;
- aucune donnée sensible métier inutile.

L’admin doit pouvoir voir les formulations qui produisent le plus de clarifications/fallbacks afin d’améliorer STIP IA à partir des usages réels.

## Stratégie de migration

1. Conserver toutes les cases.
2. Construire le registre de capacités et les évaluations.
3. Brancher le moteur hybride.
4. Ajouter les demandes composées et la gestion robuste du contexte.
5. Couvrire lecture/navigation pour toutes les cases.
6. Ajouter préparation puis écritures confirmées.
7. Mesurer l’usage réel.
8. Réduire progressivement les cases devenues redondantes.
9. Garder un accès « Applications » comme filet de sécurité et vue experte tant que nécessaire.

## Critère final

Un agent doit pouvoir utiliser STIP sans connaître l’architecture de STIP.

Il doit pouvoir écrire :
- « vacances ? »
- « et mercredi ? »
- « son numéro »
- « qui est avec moi à la reprise ? »
- « échange mardi et mercredi pour du soir »
- « où est l’IRM et comment j’y vais ? »
- « qu’est-ce que j’ai demain ? »

et obtenir une réponse correcte, courte, vérifiée et actionnable.
