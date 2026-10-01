# Notes de réunion — moteur V2

Cette application reste distincte de l’ancienne application `notes`.

## Principe

`meeting_notes` n’est plus un bloc-notes chronologique. Une réunion est un tableau vivant : les éléments sont regroupés par sujet et par colonnes configurables (`Moi / Interlocuteur / Suite`, `App A / App B / Suite`, `6 utilisateurs / Cadre / Suite`, etc.). Les raccourcis de type servent à reconnaître ce qui vient d’être entendu : information, idée, décision, action, question, vérification, attente, test/retour ou point important.

## Accès et confidentialité

- Le créateur est l’organisateur.
- Une personne invitée n’accède à la réunion qu’après **acceptation explicite** de l’invitation.
- Une personne seulement citée dans le texte d’une note n’obtient **jamais** d’accès automatiquement.
- Les éléments sont `private` par défaut. L’organisateur doit explicitement choisir `shared` pour les diffuser.
- Un élément partagé ne peut être destiné qu’à des participants dont l’invitation est déjà acceptée.
- Les tables ne sont pas accessibles directement au navigateur : l’accès passe par `stip-meeting-notes` et la session STIP.

## Finalisation

La finalisation suit cet ordre :

1. générer le fichier complet avec toutes les notes, y compris privées ;
2. envoyer ce fichier uniquement à l’adresse e-mail de l’organisateur via le fournisseur mail configuré ;
3. attendre la confirmation du fournisseur ;
4. purger les blocs privés ;
5. conserver uniquement les éléments explicitement partagés ;
6. afficher ces suites sur l’accueil des participants autorisés jusqu’à traitement / lecture.

Si l’envoi du fichier échoue, la réunion n’est pas finalisée et aucune note privée n’est purgée.

## Composants

- page : `meeting-notes.html`
- interface : `meeting-notes.js`, `meeting-notes.css`
- accueil : `meeting-runtime.js`, `meeting-runtime.css`
- backend : `supabase/functions/stip-meeting-notes/index.ts`
- données : `stip_meeting_notes`, `stip_meeting_invites`, `stip_meeting_items`, `stip_meeting_item_recipients`
