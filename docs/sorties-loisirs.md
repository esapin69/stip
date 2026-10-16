# On se retrouve — sorties, événements de loisirs et disponibilités

## Décision produit (16 octobre 2026)

Une seule page utilisateurs : `sorties-loisirs.html`, nom public **On se retrouve**. Son unique moteur interactif est `ensemble-v3.js` et son style `ensemble-v3.css`. Accès depuis Applications, tiroir d'accueil, raccourci de proposition et liens d'invitation ; les anciennes URL `sorties-loisirs.html?tab=agenda|create|trips|invitations|dispos` continuent de fonctionner.

Les quatre rubriques sont des vues **de la même page** : Sorties, Dispos, Invitations et Trajets. « Proposer une activité » ouvre le formulaire unique existant, jamais un nouveau système d'événements.

L'accueil utilise seulement `ensemble-home.js` comme **adaptateur de lecture et de notifications** (fenêtres de journée, tiroir, cloche) : ce fichier ne recrée pas d'événement ni de stockage. Les sources métier du backend sont conservées.

## Sources et droits

- Événements, invités, réponses : `stip_leisure_events`, `stip_leisure_invites`, `stip_leisure_responses`. API existante : `supabase/functions/stip-leisure/index.ts`, auth via `x-stip-session` et famille.
- Calendrier, horaires et couleurs de travail : `planning` et `stip_shift_registry`. L'action `matches` compare les fins de service sur 31 jours, sans divulguer les horaires d'autres collègues. Un créneau compatible **n'est pas** un accord de participation. L'heure libre (fixed) reste possible.
- Un événement sur invitation est privé ; un événement « ouvert à l'équipe » est visible dans la famille autorisée. Seul l'organisateur ou un acteur autorisé gère ses invités.
- Les conversations liées sont des groupes canoniques de Communication (DM & groupes), via `stip_leisure_sync_series_chat`, `stip_conversations`, `stip_conversation_members`, et `stip-messages`. Aucun chat parallèle.
- Chaque invitation conserve sa réponse au niveau du serveur. Une date modifiée incrémente la révision ; une réponse ancienne ne vaut plus confirmation. Une annulation ne devient jamais une sortie confirmée.
- Les propositions ne sont pas des rendez-vous confirmés. `ensemble-home.js` exige la présence effective de l'organisateur et l'accord d'au moins un collègue pour alimenter les jours/semaine avec une sortie confirmée. Les invitations non répondues restent à traiter sans polluer les rendez-vous.
- L'agenda des événements **professionnels** demeure distinct : il ne faut ni confondre ces données avec les sorties personnelles ni répliquer leurs enregistrements.

## Mise au propre

Les anciens moteurs non chargés (ancien `leisure-runtime.js`, ancien compositeur `ensemble-create.js`, anciennes variantes Afterwork et iframe d'essai) ont été retirés après vérification des points d'entrée. Les CSS orphelins associés ont été retirés. Aucun changement de schéma ni suppression de données Supabase.

`tools/stip-leisure-test.mjs` teste désormais l'adaptateur actif ; `tools/stip-ensemble-mobile-test.mjs` et `tools/stip-on-se-retrouve-interaction-test.mjs` couvrent la page et les créneaux.

## Règle de maintenance

Toute prochaine évolution Loisirs se fait dans l'API canonique, `ensemble-v3.js` et l'adaptateur `ensemble-home.js`. Ne pas recréer un autre mini-site, composant de création ou stockage de réponses. Ne pas emprunter les noms de l'ancien écran pour les raccourcis. Publications : GitHub Pages uniquement, jamais Vercel.
