# Suite T — porte 1

Cette branche ouvre une nouvelle suite à partir de la page d’accueil STIP sans créer de second moteur métier.

Contrat de cette première porte :

- `t/index.html` reprend exactement le `<body>` de l’accueil courant afin de conserver boutons, liens, textes, icônes, zones et moteurs.
- Aucun stylesheet du site n’est chargé dans cette page.
- `data-stip-visual="none"` empêche aussi `stip-loader.js` de charger des CSS à la demande.
- Les moteurs existants restent partagés ; aucune copie de données, planning, permissions, notifications ou chat n’est créée.
- L’accès direct à `t/index.html` est contrôlé par le serveur et réservé à `permissions.admin === true`.
- La porte `T` est visible uniquement pour un admin.
- Sur la porte 1, le second `T` est volontairement sans destination : la page suivante sera branchée plus tard, sans placeholder visuel.
