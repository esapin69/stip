# T-est

Ce dossier est la racine de l’univers de test visuel **T-est**.

Structure minimale actuelle :

- `porte-entree/index.html` : première page, construite à partir du squelette et des moteurs de l’accueil STIP courant, sans reprendre son thème visuel.
- `regles-communes/global.css` : règles visuelles communes à toutes les pages T-est.
- `regles-communes/global.js` : comportements communs à toutes les pages T-est.

Règle d’architecture : lorsqu’une règle doit s’appliquer à plusieurs pages T-est, elle vit dans `regles-communes/` et n’est pas recopiée page par page.

Première règle commune : chaque page T-est affiche une bulle flottante avec un **T dessiné**. La bulle est injectée par `global.js` et son dessin est défini dans `global.css`.

Les autres pages seront ajoutées une par une à partir des pages STIP existantes. Aucun thème ou comportement visuel supplémentaire n’est importé tant qu’il n’est pas demandé explicitement.
