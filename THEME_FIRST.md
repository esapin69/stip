# STIP — THEME FIRST

## Source de vérité visuelle

La priorité actuelle du projet est le thème STIP. Toute nouvelle page ou refonte visuelle doit se brancher sur `stip-theme.css` et suivre cette règle : **le thème possède le visuel ; la page possède seulement sa structure et sa logique métier.**

Branche de travail prioritaire : `theme/stip-master`.

## Règle obligatoire avant toute modification visuelle

Avant de modifier une page :

1. Lire `stip-theme.css`.
2. Réutiliser les variables et composants du thème existants.
3. Si un composant visuel manque, l'ajouter d'abord au thème, puis l'utiliser dans la page.
4. Quand une ancienne règle CSS locale contredit le thème, la supprimer ou la fusionner ; ne pas ajouter une nouvelle surcouche `!important` pour gagner le conflit.
5. Ne jamais créer un second système de design propre à une page.
6. Ne pas modifier le moteur métier uniquement pour résoudre un problème visuel.

## Nettoyage attendu lors de chaque intervention

Quand une page est migrée vers le thème, profiter de l'intervention pour retirer les anciennes couches devenues inutiles : styles inline, CSS injecté par JavaScript, variantes dupliquées, breakpoints contradictoires, anciens wrappers visuels et composants remplacés.

Une migration réussie doit donc réduire le nombre de règles concurrentes, pas l'augmenter.

## ADN visuel actuel

Référence : interface STIP claire et mobile, fond très léger, bleu pétrole pour la structure, cyan pour l'action, surfaces blanches aérées, gros titres courts, avatars humains, icônes colorées fonctionnelles, information métier dense mais lisible, interactions adaptées au pouce.

Principes :

- Le fond est l'écran : éviter l'effet « page dans une page ».
- La couleur forte indique une fonction ou un état, jamais une décoration gratuite.
- Une surface blanche = contenu consultable.
- Une surface douce = information secondaire.
- Un contour/accent cyan = sélection ou action courante.
- Un élément atténué + `🚫` = fonction existante mais non autorisée.
- Les anomalies doivent rompre volontairement la tranquillité visuelle.
- Les dimensions doivent découler de la largeur disponible et des tokens du thème, pas d'une collection de valeurs fixes par téléphone.

## Architecture visuelle

Ordre de responsabilité :

`stip-theme.css` → composants communs → pages métier → données/moteurs.

Les pages ne doivent pas redéfinir : couleurs de marque, rayons, ombres, espaces standards, tailles de titres principales, états verrouillés, loaders, surfaces standards ou règles mobiles communes.

## Performance visuelle

Le thème doit également aider la vitesse perçue :

- préférer skeleton/état local discret à un grand écran « Chargement… » ;
- conserver l'écran courant pendant une actualisation réseau ;
- éviter les animations lourdes et les effets coûteux inutiles ;
- ne charger un composant lourd que lorsqu'il est réellement utilisé.

## Accueil STIP — zones partagées à préserver

Ne jamais créer une quatrième zone concurrente et ne jamais écraser ces trois espaces :

- Intelligence / À retenir → `STIPRetain`
- Planning / À venir → `STIPTimeline`
- Échanges & changements → `STIPExchange`

Un sujet peut apparaître dans plusieurs espaces uniquement s'il produit réellement des informations différentes.

## Règle pour les autres discussions / branches

Toute discussion qui travaille sur une page STIP doit considérer `theme/stip-master` comme référence visuelle prioritaire. Elle peut travailler sur sa logique métier séparément, mais avant finalisation elle doit :

- rebaser ou reprendre la dernière version du thème ;
- brancher la page sur le thème ;
- supprimer les couches visuelles contradictoires qu'elle remplace ;
- vérifier qu'elle n'introduit pas un nouveau langage visuel local.

En cas de conflit entre une ancienne règle visuelle et le thème, **le thème gagne**, sauf décision explicite de modifier le thème lui-même.

## Composant pilote

Le Planning perso / calendrier est le premier composant de référence migré sous le thème. Sa géométrie doit servir de précédent : adaptation calculée à la largeur réelle, pas de tailles bricolées pour chaque appareil.
