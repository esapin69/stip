# Notes de réunion

Application personnelle distincte de l’ancienne permission/app `notes`.

## Contrat
- clé catalogue : `meeting_notes`
- route : `meeting-notes.html`
- backend : Edge Function `stip-meeting-notes`
- stockage canonique : `public.stip_meeting_notes`
- accès : session STIP valide + permission `meeting_notes`
- confidentialité : chaque agent ne lit et ne modifie que ses propres notes ; aucun accès collectif implicite
- aucun accès direct navigateur à la table ; `anon` et `authenticated` sont révoqués

## Champs
Titre, date/heure, participants, notes, décisions, actions à suivre, état actif/archivé.

L’archivage remplace la suppression afin d’éviter une perte involontaire. L’ancienne application `notes` reste active et inchangée jusqu’à décision explicite de fusion/nettoyage.
