# T-est

T-est est l’atelier de reconstruction progressive du site STIP.

## Structure

- `porte-entree/` : première page reconstruite.
- `regles-communes/` : règles permanentes communes aux pages reconstruites.
- `outils-test/` : outils visibles uniquement dans l’univers T-est.

## Contrat obligatoire pour chaque nouvelle page T-est

Toute nouvelle page créée dans T-est charge **par défaut et en permanence** :

```html
<link rel="stylesheet" href="/t-est/regles-communes/global.css" />
<script defer src="/t-est/regles-communes/global.js"></script>
```

Une règle destinée à plusieurs pages ne doit jamais être recopiée localement : elle va dans `regles-communes/`.

Les chemins sont absolus afin que ce branchement continue de fonctionner lorsque la page testée est déplacée pour remplacer sa vraie page.

## Outils T-est qui ne doivent jamais suivre en production

La bulle flottante **T** est un outil de laboratoire. Elle est volontairement séparée :

```html
<link rel="stylesheet" href="/t-est/outils-test/bulle-t.css" />
<script defer src="/t-est/outils-test/bulle-t.js"></script>
```

Quand une page est validée et remplace sa vraie page :

1. la page T-est remplace la page réelle dépassée ;
2. le branchement vers `regles-communes/` reste présent ;
3. les moteurs métier partagés existants restent branchés ;
4. seuls les éléments marqués **T-EST LAB ONLY** sont retirés ;
5. la bulle T et ses fichiers `outils-test/` ne sont jamais copiés dans la page réelle.

Ainsi, les futures corrections globales faites dans `regles-communes/` continuent à atteindre toutes les pages T-est et toutes les pages déjà promues qui y sont branchées.
