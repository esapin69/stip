# STIP — Contrat de saisie native (14 octobre 2026)

## Décision commune

Tous les champs du site GHE/STIP utilisent désormais le comportement **natif du navigateur et du système** (Android, iOS, ordinateur).
Les anciennes interactions de saisie plein écran, séquences question par question, défilements programmés,
verrouillages de la page, faux sélecteurs, recalculs de `visualViewport` et historique à chaque champ sont supprimés.

## Comportement obligatoire

- Toucher un champ active ce champ et le clavier **du système** ; aucune fenêtre ou réorganisation déclenchée par le focus.
- Le champ conserve son emplacement dans le formulaire. Le navigateur gère le défilement si nécessaire.
- Les champs `input`, `textarea`, `select` et recherche conservent les interactions standard du navigateur.
- Entrée/Tab respectent les comportements HTML. Un formulaire possède un vrai bouton de soumission.
- Le champ `textarea` accepte normalement plusieurs lignes.
- Les menus `select` ouvrent le sélecteur natif Android/iOS.
- On ne crée **aucune entrée d'historique** au focus ou au changement de champ.
- On n'empêche pas le défilement de la page en réponse au focus et on ne recentre pas artificiellement les champs.
- Le navigateur peut utiliser ses fonctions d'autoremplissage et d'accessibilité.

## Conserver les fonctions métier

- `required`, `pattern`, `maxlength`, validation HTML et gestion des soumissions JS préexistantes.
- Codes d'accès de six chiffres : chiffres seulement, masque avec bouton Voir/Masquer, sans changement de disposition.
- Formulaires conditionnels : les champs requis apparaissent en fonction du choix d'utilisateur.
- Recherche et sélecteurs d'agents métier, messages, notifications et fichiers joints restent fonctionnels.
- `STIPFormUX` expose les méthodes de compatibilité utilisées ailleurs ; celles relatives au clavier ne repositionnent plus rien.
- Les fenêtres de dialogue restent des fenêtres de dialogue métier ; ouvrir une fenêtre peut créer **une** entrée d'historique, jamais une entrée par champ.

## Architecture

- `t-est/regles-communes/global.js` : primitives non intrusives, autoremplissage, PIN, compatibilité.
- `t-est/regles-communes/global.css` : styles PIN et conteneurs scrollables sans plein écran de saisie.
- `communication-hub.js` / `.css` : plus de recalage clavier ni de défilement programmé dans les DM.
- `public-access-request-legacy.js` : dialogue avec une seule entrée d'historique, sans historique par champ.
- `tools/stip-form-contract-test.mjs` : contrat automatisé.

Les attributs HTML historiques `data-stip-keyboard-*` restent tolérés tant que des pages les utilisent,
mais ne provoquent plus aucune modification de la présentation.
