# STIP — THEME FIRST

## Source de vérité visuelle

STIP possède **un seul système visuel**.

- Point d’entrée CSS officiel : `stip-theme.css`.
- Tokens et primitives internes : `stip-theme-base.css`.
- Shell commun : `stip-shell.css`.
- États de chargement : `stip-loading.css`.
- Ce fichier (`THEME_FIRST.md`) est le contrat de conception à lire avant toute création ou modification d’interface.

Règle absolue : **le thème possède le visuel ; la page possède seulement sa structure et sa logique métier.**

Source active de production : `main`. Une branche ou une ancienne feuille de style ne doit jamais devenir une seconde source de vérité.

## Avant toute modification visuelle

1. Lire ce fichier.
2. Lire `stip-theme.css` et, si nécessaire, `stip-theme-base.css`.
3. Réutiliser les tokens et primitives existants.
4. Si un composant visuel manque, l’ajouter au thème ou au composant commun avant de l’utiliser dans une page.
5. Supprimer les anciennes règles locales remplacées au lieu d’ajouter une nouvelle couche par-dessus.
6. Ne jamais modifier le moteur métier uniquement pour résoudre un problème visuel.

## Ce qu’une page a le droit de définir

Une page métier peut définir :

- sa grille ou sa structure propre ;
- l’ordre de ses blocs ;
- ses variantes strictement métier ;
- les dimensions nécessaires à un composant réellement spécifique ;
- ses états fonctionnels si aucun composant commun ne les couvre encore.

Une page ne doit pas redéfinir :

- couleurs de marque ;
- typographie globale ;
- rayons standards ;
- ombres standards ;
- espacements standards ;
- tailles des titres principaux ;
- boutons génériques ;
- champs génériques ;
- surfaces/cartes génériques ;
- états verrouillés ;
- loaders ;
- règles mobiles communes ;
- navigation globale.

## Tokens officiels

Toujours préférer les variables `--stip-*` aux valeurs visuelles locales.

Familles principales :

- fonds : `--stip-bg`, `--stip-bg-strong` ;
- surfaces : `--stip-surface`, `--stip-surface-soft`, `--stip-surface-tint` ;
- texte : `--stip-ink`, `--stip-ink-2`, `--stip-muted`, `--stip-muted-2` ;
- action : `--stip-accent`, `--stip-accent-soft` ;
- séparateurs : `--stip-line`, `--stip-line-soft` ;
- états : `--stip-danger`, `--stip-warning`, `--stip-success` ;
- rayons : `--stip-radius-xs` à `--stip-radius-xl` ;
- ombres : `--stip-shadow-soft`, `--stip-shadow`, `--stip-shadow-strong` ;
- mise en page : `--stip-page-pad`, `--stip-gap` ;
- interaction : `--stip-motion`, `--stip-tap`.

Une couleur métier exceptionnelle reste possible, mais elle doit avoir un sens fonctionnel stable. Une couleur purement décorative locale est à éviter.

## Primitives officielles

Réutiliser en priorité :

- `.stip-page` : conteneur principal responsive ;
- `.stip-surface` : carte/surface principale ;
- `.stip-surface-soft` : surface secondaire ;
- `.stip-kicker` : petit libellé de section ;
- `.stip-title` : titre principal ;
- `.stip-subtitle` : sous-titre ;
- `.stip-search` : recherche ;
- `.stip-btn` et `.stip-btn.secondary` : actions ;
- `.stip-icon-tile` : tuile d’icône ;
- `.stip-locked` : état non autorisé ;
- `.stip-skeleton` : chargement local.

Quand un motif est utilisé au moins deux fois, il doit devenir un composant commun plutôt que deux copies CSS.



## Familles visuelles communes

STIP garde **un seul thème maître**. Les catégories ci-dessous ne sont pas des thèmes séparés : ce sont des familles de composants communes chargées par `stip-theme.css` via `stip-patterns.css`.

1. **Temps** — planning personnel/équipe, semaine, jour, agenda, navigation temporelle.
2. **Personnes** — recherche et sélection d’agents, groupes présents/absents, fiches de sélection. Le moteur commun est `stip-agent-selector.js/.css`.

### Page modèle canonique — « Rechercher un agent »

Toute interface dont l’objectif principal est de **choisir un agent** appartient à ce modèle, y compris lorsqu’elle remplace un ancien `<select>` natif.

Contrat commun :
- ne pas afficher la grande liste native du navigateur pour choisir un agent ;
- utiliser le moteur partagé `STIPAgentSelector.mountPicker(...)` dans une page, ou `STIPAgentSelector.openPicker(...)` pour une sélection plein écran / modale ;
- recherche à partir de **2 lettres** par nom, prénom ou GHE ;
- identité affichée au format `PRÉNOM nom`, GHE très lisible, avatar puis initiales en secours ;
- téléphone et statut du jour masqués par défaut dans ce mode : ils ne sont ajoutés que si le contexte métier les justifie ;
- sélection visible par un marqueur commun, sans recréer des radios, cartes ou listes locales ;
- aucun autofocus imposé à l’ouverture : le clavier apparaît lorsque l’utilisateur touche réellement le champ de recherche ;
- la logique métier de la page conserve seulement la source des agents et l’action exécutée après sélection.

Exemple d’intégration :

```js
STIPAgentSelector.openPicker({
  items: agents,
  selectedId: currentAgentId,
  onSelect(agent) {
    // La page garde uniquement son action métier.
  },
});
```

Lorsqu’une ancienne page de choix d’agent est repérée, la correction attendue est : **la brancher sur « Rechercher un agent »**, pas refaire son visuel localement.

3. **Actions** — À traiter, demandes, rappels, signatures, filtres et listes d’actions.
4. **Catalogue** — applications, favoris, gestion des accès, niveaux MINI/MAXI.
5. **Pilotage** — cockpit Responsable/Cadre, métriques, alertes et recommandations.

Règle : deux écrans utilisant le même motif doivent prendre leur base visuelle dans la même famille. Une page ne recrée pas localement sa propre version d’un sélecteur d’agent, d’une navigation de semaine, d’un panneau d’actions ou d’un catalogue d’applications.

La hiérarchie reste :
`stip-theme-base.css` = tokens → `stip-patterns.css` = familles de composants → CSS de page = structure métier uniquement.



## Filtres et onglets — template 6B officiel

Les filtres, onglets de vue et sélecteurs courts utilisent désormais le composant partagé **6B** défini dans `stip-patterns.css`.

Classes canoniques :

- conteneur : `.stip-filter-bubbles` avec `data-count="2|3|4|5|6"` ;
- choix : `.stip-filter-choice` ;
- visuel : `.stip-filter-visual` ;
- petit indice visuel éventuel : `.stip-filter-visual-badge` ;
- texte : `.stip-filter-copy` ;
- état actif : `aria-selected="true"` ; la classe `.active` reste tolérée pour compatibilité avec les moteurs existants.

Règles visuelles obligatoires :

1. Un filtre doit ressembler à une **bulle cliquable**, jamais à un bouton rectangulaire banal.
2. L’ensemble reste discret dans la page, mais jamais timide : présence nette, contour, profondeur légère et état sélectionné visible.
3. Chaque choix possède son propre univers visuel. Deux choix opposés ne réutilisent pas mécaniquement le même dessin.
4. Le pictogramme doit apporter du sens. Exemple : « Avec accès » peut montrer une clé ; « Sans accès » peut ajouter un signe d’interdiction discret.
5. Un nouvel univers fonctionnel appelle un visuel original : historique, calendrier, suivi, équipe, notification, proposition, etc. ne sont pas représentés par le même symbole générique.
6. La composition dépend du nombre de choix :
   - 2 choix : visuels placés vers les extrémités ;
   - 3 choix : centre différencié, extrémités miroir ;
   - 4 choix : composition symétrique alternée ;
   - 5/6 choix : grille plus compacte et composition adaptée, sans recopier six fois le même bouton.
7. La couleur suit le contexte. Le composant utilise `--stip-filter-accent` et peut recevoir un accent métier par choix via `data-tone`, sans créer une nouvelle identité graphique.
8. Une page ne redéfinit pas localement couleurs, rayons, ombres, états actifs ou iconographie de base du composant. Elle ne conserve que son positionnement et sa logique métier.
9. Les filtres restent tactiles, lisibles au pouce, sans débordement horizontal et sans information portée uniquement par la couleur.
10. Quand un ancien filtre est migré vers 6B, supprimer ses anciennes règles visuelles locales au lieu d’empiler une nouvelle couche.

## Navigation temporelle canonique

Le visuel de référence pour les filtres temporels STIP est un empilement de cartes interactives de la famille **Temps**.

La hiérarchie canonique est :

1. **Mois / année** — contexte principal, avec le mois fortement mis en évidence et une action éventuelle seulement si la page possède réellement une vue mensuelle.
2. **Semaine** — flèche précédente, période centrale, numéro de semaine en information secondaire, flèche suivante.
3. **Jours** — sept boutons de lundi à dimanche. Un clic ne masque pas la semaine : il déplace directement vers la journée choisie et conserve la semaine complète.

Deux variantes sont autorisées :
- **2 niveaux** : mois + semaine, lorsque la page n’a pas besoin de choisir directement un jour ;
- **3 niveaux** : mois + semaine + jours, lorsque le jour doit être accessible directement.

La page **Esprit d’équipe** est la référence officielle de la variante complète à 3 niveaux. Toute autre page qui a besoin des trois niveaux doit réutiliser les classes partagées `.stip-time-stack`, `.stip-time-month`, `.stip-time-week` et `.stip-time-days`, et ne pas recréer sa propre version locale.

Sur **Esprit d’équipe**, la ligne **Cette semaine / 7 jours** est placée avant les cartes de shifts. Les informations destinées aux agents utilisent un langage terrain ; les cibles, écarts chiffrés et consignes de pilotage restent dans l’espace Responsable.

Le clic sur un jour doit produire un état sélectionné visible, être mémorisé dans le contexte de navigation quand cela est pertinent et rester cohérent avec la semaine affichée.

## Bloc canonique — « LÉGENDE »

Toute légende STIP doit être branchée sur le composant partagé du thème, jamais redessinée localement.

Contrat commun :
- conteneur : `.stip-legend` ;
- titre : toujours le séparateur racine `.stip-section-separator` avec le libellé `LÉGENDE` ; si le séparateur officiel change, la légende change automatiquement ;
- carte : `.stip-legend-surface` puis `.stip-legend-list` ;
- chaque ligne est un vrai contrôle cliquable `.stip-legend-item` et utilisable au doigt ;
- le **groupe complet des lignes** est centré dans la carte, mais toutes les lignes partagent la même grille interne : icône → `•` → texte ;
- les icônes et surtout les `•` restent donc alignés sur les mêmes axes verticaux d’une ligne à l’autre ; le texte est aligné à gauche dans sa colonne ;
- structure d’une ligne : `.stip-legend-icon` → `.stip-legend-bullet` contenant `•` → libellé ; une information secondaire éventuelle reste après le libellé ;
- aucune page ne redéfinit localement l’alignement, la géométrie, le fond, le rayon ou l’état pressé de la légende ;
- une page peut seulement fournir ses icônes, ses libellés et l’action métier déclenchée au clic ;
- les entrées doivent être dérivées des symboles réellement visibles afin de respecter le contrat de complétude des légendes ;
- une légende de page doit expliquer **tous les repères informationnels visibles sur la page ouverte** : icônes, dessins, pastilles, couleurs, badges et symboles d’état, y compris ceux présents dans la semaine, le mois, les synthèses et les détails ;
- un même concept n’est expliqué qu’une fois dans la légende, même s’il apparaît plusieurs fois dans la page ;
- les contrôles de navigation ou d’action (flèches, téléphone, fermeture, ajout, menu, etc.) ne sont pas des entrées de légende.

Exemple :

```html
<section class="stip-legend">
  <div class="stip-section-separator"><span>LÉGENDE</span></div>
  <div class="stip-legend-surface">
    <div class="stip-legend-list">
      <button class="stip-legend-item" type="button">
        <span class="stip-legend-icon" aria-hidden="true">🩺</span>
        <span class="stip-legend-bullet" aria-hidden="true">•</span>
        <b>Visite médicale</b>
      </button>
    </div>
  </div>
</section>
```

Lorsqu’une ancienne légende est repérée, la correction attendue est : **la brancher sur ce bloc officiel**, supprimer son habillage local remplacé, puis conserver uniquement sa logique métier.

## Structure d’une page STIP

Une nouvelle page doit suivre ce principe :

```html
<link rel="stylesheet" href="stip-theme.css">
<link rel="stylesheet" href="stip-shell.css">

<main class="stip-page">
  <header>
    <span class="stip-kicker">SECTION</span>
    <h1 class="stip-title">Titre</h1>
    <p class="stip-subtitle">Information utile.</p>
  </header>

  <section class="stip-surface">
    <!-- contenu métier -->
  </section>
</main>
```

Les feuilles locales sont chargées pour la structure métier, pas pour recréer l’identité visuelle.

## Rôles

Agent, Responsable, Cadre et Admin sont **quatre contextes du même produit**, pas quatre thèmes différents.

Ils peuvent varier par :

- densité d’information ;
- navigation ;
- actions disponibles ;
- priorité des données ;
- accent fonctionnel ponctuel.

Ils conservent toujours la même base : typographie, surfaces, géométrie, interactions, composants et langage visuel STIP.

## ADN visuel

STIP doit être clair, mobile d’abord et immédiatement lisible : fond très léger, bleu pétrole pour la structure, cyan pour l’action, surfaces blanches aérées, titres courts, avatars humains, icônes fonctionnelles, information métier dense mais hiérarchisée, interactions adaptées au pouce.

Principes :

- Le fond est l’écran : éviter l’effet « page dans une page ».
- La couleur forte indique une fonction ou un état, jamais une décoration gratuite.
- Une surface blanche = contenu consultable.
- Une surface douce = information secondaire.
- Un contour/accent cyan = sélection ou action courante.
- Un élément atténué + `🚫` = fonction existante mais non autorisée.
- Les anomalies doivent rompre volontairement la tranquillité visuelle.
- Les dimensions découlent de la largeur disponible et des tokens, pas d’une collection de valeurs fixes par téléphone.

## Mobile et accessibilité

- cible tactile recommandée : au moins 44 px ;
- aucune information essentielle uniquement par couleur ;
- texte lisible sans zoom ;
- les informations métier et actions principales ne doivent jamais être reléguées dans la plus petite taille typographique ;
- lorsqu’il faut gagner de la place, réduire d’abord wrappers, marges, doublons, sous-titres et surfaces inutiles avant de réduire le texte ;
- une hausse de lisibilité ne doit pas augmenter mécaniquement la hauteur de page : récupérer l’espace par la hiérarchie, la révélation progressive et la suppression des éléments redondants ;
- réserver les tailles les plus petites aux métadonnées réellement secondaires (heure, aide, précision courte) ;
- pas de débordement horizontal involontaire ;
- `prefers-reduced-motion` respecté ;
- safe areas iOS/Android respectées ;
- focus visible sur les éléments interactifs ;
- priorité à une seule colonne lorsque la largeur devient insuffisante.

## Performance visuelle

- préférer skeleton/état local discret à un grand écran « Chargement… » ;
- conserver l’écran courant pendant une actualisation réseau ;
- éviter les animations lourdes ;
- ne charger un composant lourd que lorsqu’il est utilisé ;
- ne pas multiplier les feuilles CSS concurrentes pour corriger un détail.

## Nettoyage obligatoire

Lorsqu’une page est migrée vers le thème :

- retirer les styles inline remplacés ;
- retirer le CSS injecté par JavaScript devenu inutile ;
- fusionner les variantes dupliquées ;
- supprimer les breakpoints contradictoires ;
- supprimer les anciens wrappers visuels remplacés.

Une migration réussie **réduit** le nombre de règles concurrentes.

## Anciennes couches

`stip-ui.css` et les anciennes feuilles de style locales peuvent encore exister pour compatibilité historique. Elles ne sont pas des sources de vérité et ne doivent pas être utilisées comme base d’un nouveau développement.

Aucun nouveau fichier ne doit introduire un second jeu de variables globales ou une seconde identité STIP.

## Contrôle automatique

Le dépôt contient `tools/stip-design-audit.mjs` et la vérification GitHub `STIP design contract`.

Sur les changements futurs, le contrôle bloque notamment :

- une nouvelle page HTML qui n’importe pas `stip-theme.css` ;
- un nouvel import de `stip-ui.css` ;
- un nouveau bloc `<style>` dans une page HTML ;
- un nouveau style inline `style="…"` ;
- une nouvelle déclaration `:root` en dehors des fichiers autorisés du thème.

Les exceptions doivent être explicites dans l’audit, rares et justifiées.

## Accueil STIP — zones partagées à préserver

Ne jamais créer une quatrième zone concurrente et ne jamais écraser ces trois espaces :

- Intelligence / À retenir → `STIPRetain`
- Planning / À venir → `STIPTimeline`
- Échanges & changements → `STIPExchange`

Un sujet peut apparaître dans plusieurs espaces uniquement s’il produit réellement des informations différentes.

## Composant pilote

Le Planning perso / calendrier reste le premier composant de référence migré sous le thème. Sa géométrie sert de précédent : adaptation calculée à la largeur réelle, pas de tailles bricolées pour chaque appareil.

## Règle finale

En cas de conflit entre une ancienne règle visuelle et le thème : **le thème gagne**.


## Bulles d’analyse liées aux indicateurs

Les bulles ouvertes depuis un indicateur métier (`⚠️`, `🛑`, `✔`, `➕`) utilisent une hiérarchie typographique commune sur tout STIP.

- conserver le même langage de surface et de couleur déjà validé ;
- ne jamais mettre l’analyse métier en micro-texte ;
- titre / conclusion essentielle : gras, lisible, en MAJUSCULES ;
- explication : taille de lecture normale, interligne aéré ;
- proposition / précision secondaire : nouvelle ligne distincte, séparée visuellement du constat ;
- chiffres clés et verdict doivent être identifiables en un coup d’œil ;
- privilégier les retours à la ligne sémantiques plutôt qu’un paragraphe compact ;
- les feuilles Responsable, Esprit d’équipe et les aides d’effectif partagent cette même hiérarchie via `stip-theme.css` ;
- une page ne doit pas recréer localement une version plus petite de cette typographie.
