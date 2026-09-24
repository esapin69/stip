# STIP — VISUAL MASTERS

Ce fichier est le registre des références visuelles validées ou déjà canoniques de STIP.

But : ne plus redemander ni réinventer à chaque discussion quel écran sert de modèle. Avant toute modification UI, vérifier ici si le motif existe déjà.

## Statuts

- **MAÎTRE VALIDÉ UTILISATEUR** : référence explicitement choisie par Eddy et finalisée. Ne pas la remplacer sans validation explicite.
- **MAÎTRE EN COURS DE FINALISATION** : future référence officielle encore en réglage. Corriger uniquement sa base jusqu’à validation finale ; ne pas propager automatiquement.
- **CANONIQUE DÉJÀ ÉTABLI** : référence déjà définie comme officielle dans le dépôt.
- **RÉFÉRENCE FONCTIONNELLE** : modèle de comportement/composition, sans imposer son visuel à tout le site.
- **À CONFIRMER** : bon candidat repéré dans le dépôt, mais pas encore déclaré préféré.

## 1. Semaine / planning personnel

**Statut : MAÎTRE EN COURS DE FINALISATION**

Référence : la semaine de la page **Mon profil / Accueil personnel**.

Cette référence est explicitement choisie par Eddy comme future base maîtresse, mais elle est encore en cours de réglage. Tant qu’Eddy n’a pas déclaré la base finalisée, **ne pas propager automatiquement ses changements aux autres pages**. Les modifications demandées doivent être faites d’abord sur cette base, puis la propagation sera décidée séparément.

Implémentation actuelle :
- `home-shell.js`
- `home-shell.css`
- structure principale : `.hc-planning-primary-head`
- navigation : `.hc-week-nav-global.hc-week-nav-hero`
- ligne des jours : `.hc-home-week-days`
- jours / shifts : génération via `homeDayStrip(...)` et le registre canonique des shifts.

Règle :
- lorsqu’une autre surface a besoin d’une semaine visuellement comparable, partir de ce modèle ;
- ne pas recréer une semaine locale avec une autre géométrie si le besoin métier est compatible ;
- les adaptations autorisées portent sur les informations visibles et les permissions, pas sur une réinvention du composant ;
- si une amélioration du composant semaine est validée à la racine, les consommateurs compatibles doivent pouvoir en hériter.

Note : `agent-agenda-view.css` réutilise déjà plusieurs primitives `hc-*` de semaine, ce qui confirme qu’une mutualisation réelle est possible.

## 2. Navigation temporelle complète mois → semaine → jours

**Statut : RÉFÉRENCE FONCTIONNELLE**

Référence actuelle : **Esprit d’équipe** pour l’enchaînement à 3 niveaux.

Règle :
- Esprit d’équipe reste la référence de composition et de comportement pour le parcours mois/semaine/jour ;
- le **visuel de la semaine elle-même** doit converger vers le maître Mon profil / Accueil personnel quand le contexte le permet ;
- ne pas confondre « référence de composition » et « maître visuel du composant semaine ».

## 3. Calendrier mensuel

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence :
- `.stip-month-calendar`
- `.stip-month-grid`
- `.stip-month-day`
- `.stip-month-day-number`
- `.stip-month-primary`
- `.stip-month-events`

Sources :
- `stip-patterns.css`
- variables `--stip-month-*` dans `stip-theme-base.css`

Règle : aucune page ne redéfinit localement la géométrie du calendrier mensuel.

## 4. Recherche / sélection d’un agent

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence visuelle : **ADMIN > Accès**, mur de portraits.

Moteur :
- `stip-agent-selector.js`
- `stip-agent-selector.css`
- `STIPAgentSelector.mountWall(...)`
- `STIPAgentSelector.openPicker(...)`

Règle : toute nouvelle sélection d’agent se branche sur ce moteur au lieu de recréer cartes, photos, tampons GHE ou séparateurs.

## 5. Filtres courts / onglets

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence : template **6B**.

Sources :
- `stip-patterns.css`
- `.stip-filter-bubbles`
- `.stip-filter-choice`
- `.stip-filter-visual`
- `.stip-filter-copy`

Règle : migrer les anciens filtres compatibles vers 6B et supprimer leur habillage local remplacé.

## 6. Légendes

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence :
- `stip-legend.js`
- classes `.stip-legend*` dans le thème partagé.

Règle : une légende est dérivée des repères réellement présents ; aucune page ne recrée son propre bloc visuel.

## 7. Séparateurs de section

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence : `.stip-section-separator`.

Règle : tous les titres de séparation compatibles doivent utiliser la primitive commune afin qu’une modification racine se propage proprement.

## 8. Bulles d’analyse terrain

**Statut : CANONIQUE DÉJÀ ÉTABLI**

Référence : hiérarchie partagée des bulles ouvertes depuis `⚠️ / 🛑 / ✔ / ➕`.

Sources :
- `stip-theme.css`
- `stip-field-intelligence.js` pour la logique métier.

Règle : titre essentiel lisible/fort, explication normale, détails secondaires séparés ; pas de micro-texte local concurrent.

## 9. Shifts équipe / cartes M J J4 S N

**Statut : À CONFIRMER**

Candidat actuel :
- `esprit-equipe.js`
- `esprit-equipe.css`

État actuel utile :
- carte entière = ouverture de l’équipe ;
- indicateur terrain = action séparée hors de la carte ;
- nombre = information ;
- chevron = indication d’ouverture ;
- couleurs métier venant du registre/thème.

Ne pas déclarer ce modèle maître global tant qu’Eddy ne l’a pas explicitement validé comme référence.

## 10. Identité / carte profil

**Statut : À CONFIRMER**

Plusieurs variantes existent encore dans le dépôt (`home-shell.*`, Mon compte, Responsable, fiches agent).

Ne pas choisir automatiquement une variante comme maître. Comparer les variantes existantes puis faire valider la référence avant mutualisation.

## 11. Cartes événements / agenda

**Statut : À CONFIRMER**

Plusieurs bonnes variantes existent : Accueil personnel, fiche agent, Responsable.

Avant d’unifier :
- inventorier les variantes ;
- distinguer carte compacte, détail et timeline ;
- faire valider le ou les maîtres adaptés à chaque usage.

## Règle générale

Une référence visuelle ne signifie pas que toutes les pages doivent devenir identiques.

Le maître fixe :
- géométrie de base ;
- hiérarchie ;
- comportement tactile ;
- responsive ;
- états communs.

La page conserve :
- ses données ;
- ses permissions ;
- sa densité métier ;
- ses actions spécifiques.

Quand un motif est trouvé dans Git :
1. vérifier s’il est déjà dans ce registre ;
2. s’il est **MAÎTRE** ou **CANONIQUE**, le réutiliser ;
3. s’il est **À CONFIRMER**, ne pas le généraliser sans validation ;
4. supprimer les anciennes couches lorsqu’une migration vers un maître est validée.
