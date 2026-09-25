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

**Statut : MAÎTRE PARTAGÉ EN COURS DE FINALISATION**

Référence d’origine : la semaine active de **Mon profil / Accueil personnel**.

Architecture commune désormais :
- `stip-calendar-core.css` = **socle brut structurel** : ordre, grille, centrage, retours à la ligne et emplacements ; aucune décoration ;
- `stip-calendar-visual.css` = **visuel commun** : couleurs, bordures, typographie et états ; aucune géométrie ;
- `stip-patterns.css` ne contient plus la géométrie semaine/mois
- conteneur : `.stip-week-line`
- jour : `.stip-week-day`
- en-tête jour : `.stip-week-day-head`
- corps jour : `.stip-week-day-body`
- code : `.stip-week-code`
- repère principal : `.stip-week-main`
- événements : `.stip-week-events`
- navigation : `.stip-week-master-nav`

La géométrie et les états communs ont été extraits de la semaine réellement affichée dans Mon profil / Accueil personnel. La page d’origine consomme maintenant elle-même ce contrat : elle n’est plus une copie locale servant seulement de référence.

Propagation explicitement autorisée par Eddy :
- Mon profil / Accueil personnel ;
- fiche / agenda agent ;
- Esprit d’équipe ;
- Responsable > Dates ;
- Agenda Responsable autonome ;
- vues semaine du hub planning et fallback fiche agent.

Règle :
- toute future ligne de semaine compatible doit utiliser ce contrat avant d’être considérée terminée ;
- les pages gardent leurs données propres (shift personnel, indicateur terrain, événements, lecture seule, permissions) mais ne redéfinissent plus la géométrie de la semaine ;
- une modification validée sur la base maîtresse doit être faite dans `stip-patterns.css` pour se propager aux consommateurs ;
- les anciennes règles locales peuvent rester temporairement pour d’anciens écrans non migrés, mais elles ne doivent plus être utilisées par une ligne déjà branchée ;
- la base reste « en cours de finalisation » tant qu’Eddy a encore des réglages à faire : ces réglages doivent désormais être faits sur le composant commun, puisque les lignes compatibles sont volontairement branchées dessus.
- **socle brut obligatoire** : même si une couche locale ou décorative ne charge pas, chaque code, pictogramme et événement reste centré sur un axe unique dans un emplacement carré stable ; aucune page ne dépend d’un décalage de baseline, d’une marge corrective ou d’un calcul local pour obtenir l’alignement de base.

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
- `stip-calendar-core.css` pour la structure brute ;
- `stip-calendar-visual.css` pour l'apparence commune ;
- `stip-theme-base.css` uniquement pour les variables de thème

Règle : aucune page ne redéfinit localement la géométrie du calendrier mensuel.
Le socle brut du mois doit rester lisible sans couche de finition : numéro, repère principal et événements utilisent des lignes dédiées centrées ; les pictogrammes ont un emplacement stable et les pastilles de shift restent volontairement légèrement plus petites que les pictogrammes.

## 4. Recherche / sélection d’un agent

**Statut : MAÎTRE VALIDÉ UTILISATEUR**

Référence visuelle validée : le module de recherche d’agents visible dans **ACCÈS & SÉCURITÉ > Accès** au 25/09/2026 :
- barre de recherche ;
- filtres de tri `Nom / Prénom / GHE` ;
- séparateurs alphabétiques ou GHE ;
- mur de portraits ;
- photo ronde avec initiales en secours ;
- tampon GHE superposé ;
- identité hiérarchisée selon le filtre actif.

Le maître ne comprend **pas** les éléments propres à la page Accès & Sécurité (onglets `Accès / Historique / Contrôle`, filtres `Avec accès / Sans accès`, éditeur de droits). Seul le composant de recherche/sélection d’une personne et son comportement sont enregistrés comme référence globale.

Moteur maître :
- `stip-agent-selector.js`
- `stip-agent-selector.css`
- `STIPAgentSelector.mountWall(...)` pour intégrer le mur dans une page existante ;
- `STIPAgentSelector.openPicker(...)` pour ouvrir la page complète « Rechercher un agent » ;
- `STIPAgentSelector.mountPicker(...)` pour une intégration complète embarquée.

Règles :
- toute nouvelle sélection d’agent se branche sur ce moteur au lieu de recréer cartes, photos, tampons GHE, séparateurs, recherche ou logique de tri ;
- les corrections visuelles communes se font dans `stip-agent-selector.css` et les corrections de comportement dans `stip-agent-selector.js` ;
- une page appelante fournit seulement ses agents, sa sélection et son action métier ;
- ce maître ne doit pas être remplacé par une autre variante sans validation explicite d’Eddy.

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


## 12. Bloc contextuel adaptatif — parent → séparateur → détail

**Statut : MAÎTRE VALIDÉ UTILISATEUR**

Référence de comportement :
- semaine → `JOUR SÉLECTIONNÉ` → détail du jour ;
- mois → `À RETENIR CE MOIS` → résumé du mois.

Contrat partagé :
- parent : `.stip-context-master`
- séparateur rattaché : `.stip-context-attached-separator`
- contenu rattaché : `.stip-context-attached`
- source visuelle : `stip-patterns.css`

Règle :
- un détail qui explique directement le bloc situé au-dessus reste dans le même contexte visuel ;
- son séparateur est collé logiquement au parent et ne doit pas donner l’impression d’ouvrir une nouvelle application ou un module indépendant ;
- le contenu reste adaptatif : il peut être vide, court, long, une liste, une carte ou plusieurs groupes sans changer cette relation ;
- les vrais modules indépendants restent hors de `.stip-context-master` et conservent une respiration forte ;
- toute page compatible doit consommer ce contrat plutôt que recréer localement marges, séparateur et rattachement.


## 13. Contrat brut calendrier — règle d'architecture

**Statut : CANONIQUE ET PROTÉGÉ PAR CI**

Pour toute vue semaine ou mois :
1. le HTML fournit les mêmes emplacements logiques ;
2. `stip-calendar-core.css` suffit à obtenir un rendu brut propre, centré et lisible ;
3. aucune page locale ne recalcule la position d'un pictogramme, n'utilise de `translate`, marge négative ou taille locale pour corriger un alignement ;
4. `stip-calendar-visual.css` habille ensuite cette base sans toucher à sa géométrie ;
5. les pages peuvent changer les données et les actions, pas la structure de base.

Le core est placé dans une couche CSS prioritaire pour les propriétés structurelles : une ancienne règle locale ne doit plus pouvoir déplacer ou réduire la base commune. Le test `tools/stip-calendar-contract-test.mjs` bloque les régressions connues.
