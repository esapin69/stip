# STIP IA — registre de capacités cible

Ce document complète `stip-ia-universal-contract.md`.

Le but n'est pas de transformer STIP IA en accès direct à toutes les tables. Le dialogue doit devenir la porte d'entrée ; les moteurs métier restent séparés et gardent leurs règles.

## Niveaux d'action

### READ
Lecture sans effet de bord.

Exemples :
- lire mon planning ;
- trouver un collègue ;
- obtenir des coordonnées autorisées ;
- trouver un lieu ou un itinéraire ;
- voir les effectifs ;
- voir mes prochains CA/RTT/repos ;
- lire les actions de demain.

Exécution directe si la permission serveur est présente.

### PREPARE
Prépare une action ou un écran sans modifier les données.

Exemples :
- préremplir un échange ;
- préparer une demande de congé ;
- préparer un groupe de messages ;
- préparer un abonnement calendrier ;
- sélectionner un fichier à importer ;
- préremplir une modification d'accès.

STIP IA doit afficher ce qu'il a compris et permettre l'ouverture du workflow existant.

### COMMIT
Effet réel : envoi, création, modification, suppression, validation.

Exemples :
- envoyer un message ;
- soumettre une demande de congé ;
- soumettre un échange ;
- créer une note ;
- modifier un droit ;
- importer effectivement un fichier ;
- action administrative.

Une capacité COMMIT :
1. n'est jamais exécutée directement par le modèle ;
2. est revérifiée côté serveur ;
3. exige une confirmation utilisateur explicite ;
4. réutilise le moteur métier existant ;
5. retourne un résultat vérifiable.

## Domaines et capacités

### Identité
- `profile.get_self` — READ
- `profile.open_photo_editor` — PREPARE

### Planning personnel
- `planning.get_day` — READ
- `planning.get_period` — READ
- `planning.get_next_workday` — READ
- `planning.get_next_rest` — READ
- `planning.get_next_leave` — READ
- `planning.get_return_after_leave` — READ

### Équipe
- `team.on_duty` — READ
- `team.by_shift` — READ
- `team.overlap_with_subject` — READ
- `team.same_start` — READ
- `team.same_end` — READ
- `team.find_person` — READ

### Contacts
- `contacts.get` — READ
- `contacts.open_call` — PREPARE
- `contacts.copy` — PREPARE

### Échanges / modifications
- `change.find_candidates` — READ
- `change.compare` — READ
- `change.prepare_request` — PREPARE
- `change.submit_request` — COMMIT

### Congés / absences
- `leave.analyze` — READ
- `leave.prepare_request` — PREPARE
- `leave.submit_request` — COMMIT
- `absence.prepare_notice` — PREPARE
- `absence.submit_notice` — COMMIT

### Lieux
- `places.search` — READ
- `places.get_details` — READ
- `places.get_relations` — READ
- `places.get_route` — READ
- `places.open` — PREPARE

### Messages
- `messages.recipients` — READ
- `messages.prepare_direct` — PREPARE
- `messages.prepare_group` — PREPARE
- `messages.send` — COMMIT

### Calendrier
- `calendar.get_subscriptions` — READ
- `calendar.prepare_subscription` — PREPARE
- `calendar.create_subscription` — COMMIT

### Dates / événements agents
- `agent_dates.get` — READ
- `agent_dates.get_self` — READ

### Actions / demain
- `actions.get_upcoming` — READ
- `actions.get_day` — READ
- `actions.open_item` — PREPARE

### Pilotage
- `staffing.get_day` — READ
- `staffing.get_shift` — READ
- `staffing.get_alerts` — READ
- `responsable.open` — PREPARE

### Notes
- `notes.search` — READ
- `notes.prepare_create` — PREPARE
- `notes.create` — COMMIT
- `notes.prepare_update` — PREPARE
- `notes.update` — COMMIT

### Accès / administration
- `access.inspect` — READ
- `access.prepare_change` — PREPARE
- `access.commit_change` — COMMIT
- `admin.open` — PREPARE

### Import
- `import.describe` — READ
- `import.prepare` — PREPARE
- `import.commit` — COMMIT

### Nouvel agent
- `onboarding.get_status` — READ
- `onboarding.open` — PREPARE

## Orchestration multi-capacités

La limite « un seul domaine / un seul outil » est suffisante pour sécuriser un premier hybride, mais elle n'est pas suffisante pour l'objectif final de STIP IA.

La cible autorise :
- plusieurs READ en chaîne, dans une limite serveur courte ;
- un PREPARE après les READ ;
- jamais de COMMIT dans une chaîne automatique.

Exemple :
`mes prochains congés et avec qui je reprends ?`

1. `planning.get_next_leave`
2. `planning.get_return_after_leave`
3. `team.overlap_with_subject`
4. réponse

Exemple :
`mardi et mercredi en soir, écris aux compatibles`

1. `change.find_candidates`
2. affichage des candidats
3. clarification/sélection éventuelle
4. `messages.prepare_group`
5. confirmation utilisateur
6. seulement ensuite `messages.send`

## Règle de suppression des cases

Le dialogue remplace progressivement la case dans l'usage, pas son moteur.

Tant qu'une capacité n'atteint pas la parité :
- la case reste visible ;
- STIP IA peut y rediriger intelligemment ;
- la télémétrie mesure les manques.

Quand la parité est atteinte :
- la case peut quitter l'accueil principal ;
- elle reste accessible dans Applications / vue experte ;
- STIP IA devient le chemin principal.

## Ce qu'il ne faut jamais faire

- supprimer un écran avant d'avoir son équivalent ;
- donner au modèle des données Supabase brutes inutiles ;
- laisser le modèle construire une requête SQL ;
- laisser le modèle décider d'un droit ;
- laisser une ancienne date/personne contaminer silencieusement un nouveau sujet ;
- transformer toutes les erreurs en « je n'ai pas compris » ;
- créer une deuxième logique métier dans STIP IA alors que le moteur existe déjà ailleurs.
