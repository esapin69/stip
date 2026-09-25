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

## Registre des références visuelles

Lire `VISUAL_MASTERS.md` avant toute modification UI.

Ce fichier distingue :
- les maîtres explicitement validés par Eddy ;
- les composants déjà canoniques dans le dépôt ;
- les références uniquement fonctionnelles ;
- les candidats qui ne doivent pas être généralisés sans validation.

La semaine de **Mon profil / Accueil personnel** est le maître visuel validé pour le composant semaine. Esprit d’équipe reste la référence fonctionnelle de la composition temporelle complète mois → semaine → jours.

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



## Direction visuelle — lisibilité premium

Cette direction renforce le thème existant sans créer une seconde identité.

- **Inactif n’est jamais désactivé** : un filtre non sélectionné reste net, contrasté et immédiatement lisible.
- La hiérarchie repose sur trois niveaux : **fond calme → surface nette → action expressive**.
- L’état actif doit être identifiable par au moins deux indices : contraste + contour/relief/repère, jamais par la couleur seule.
- Les libellés principaux n’utilisent pas la couleur `muted`; celle-ci est réservée à l’information secondaire.
- Les pictogrammes fonctionnels ont une présence réelle. Ils peuvent devenir plus expressifs dans l’état actif, sans transformer tout le bouton en aplats criards.
- Une page ne doit pas être « blanche sur blanc » : séparation par bordure, profondeur ou variation de surface, avec sobriété.
- La profondeur est courte et précise : ombre douce pour une surface, ombre plus franche uniquement pour l’élément actif ou prioritaire.
- Les accents métier restent contextuels ; la géométrie, la typographie et le comportement restent STIP.
- Sur mobile et tablette, on gagne d’abord de l’espace en supprimant les wrappers et doublons, jamais en rendant le texte principal minuscule.
- Toute évolution globale se fait dans les tokens/primitives avant les CSS de page.

## Garde-fou — stabilité visuelle

STIP est considéré comme visuellement validé par défaut. Une amélioration locale ne doit pas devenir une refonte générale implicite.

- Ne jamais modifier les tokens racine `--stip-bg`, `--stip-surface`, `--stip-ink`, `--stip-accent`, les ombres, rayons, typographies ou primitives globales sans validation explicite préalable.
- Par défaut, corriger le composant concerné à sa source commune, sans modifier l’apparence des composants qui ne sont pas concernés.
- Avant toute modification réellement globale, créer un checkpoint Git identifiable et isoler le changement pour permettre un retour arrière propre.
- Une propagation à plusieurs pages est autorisée uniquement lorsqu’elles utilisent volontairement le même composant partagé.
- Ne jamais « améliorer » une page déjà validée en changeant son esthétique par opportunité pendant un autre chantier.
- Conserver les couleurs métier et conventions déjà validées tant qu’une demande explicite ne les remet pas en cause.
- En cas de doute entre retoucher le thème maître et retoucher un composant partagé, préférer le composant partagé.

## Familles visuelles communes

STIP garde **un seul thème maître**. Les catégories ci-dessous ne sont pas des thèmes séparés : ce sont des familles de composants communes chargées par `stip-theme.css` via `stip-patterns.css`.

1. **Temps** — planning personnel/équipe, semaine, jour, agenda, navigation temporelle.
2. **Personnes** — recherche et sélection d’agents, groupes présents/absents, fiches de sélection. Le moteur commun est `stip-agent-selector.js/.css`.

### Page modèle canonique — « Rechercher un agent »

Toute interface dont l’objectif principal est de **choisir un agent** appartient à ce modèle. Un ancien `<select>` natif doit être retiré à la source et remplacé par le sélecteur partagé ; il ne doit jamais être simplement recouvert.

Contrat validé :
- ouverture dans une vraie vue STIP via `STIPAgentSelector.openPicker(...)` ; plein écran sur téléphone, surface adaptée sur écran large ;
- en-tête simple avec retour + **Rechercher un agent** ; aucun sous-titre inutile ;
- grande barre `Rechercher…` ; tous les agents sont visibles au départ et le filtrage commence dès le premier caractère, sans afficher de mention « dès 1 lettre » ;
- séparateur officiel **FILTRE**, puis trois onglets : `Prénoms`, `Noms`, `GHE` ;
- filtre initial : `Prénoms` ; le filtre actif zoome légèrement et passe en gras + majuscules ;
- `Prénoms` et `Noms` regroupent le mur par séparateurs `A`, `B`, `C`… et ne rendent jamais de groupe vide ;
- `GHE` regroupe dynamiquement en `SANS GHE`, puis par numéro réel `GHE 1`, `GHE 2`, etc., avec `AUTRE GHE` uniquement si une valeur existe mais n’est pas interprétable ;
- affichage sous forme de **mur de portraits** : photo ronde importante, initiales en secours, tampon GHE superposé au bas du portrait sans masquer le visage ;
- le **mur de portraits d’ADMIN > Accès est la référence visuelle canonique**. Il est rendu par `STIPAgentSelector.mountWall(...)` et consommé par ADMIN comme par `Rechercher un agent` ; aucun des deux écrans ne possède une copie locale des cartes, séparateurs, photos ou tampons GHE ;
- filtre `Prénoms` : prénom prioritaire en gras/majuscules puis nom ; filtre `Noms` : nom prioritaire puis prénom ; filtre `GHE` : tampon GHE visuellement renforcé puis identité ;
- toute la vignette est cliquable ; l’agent déjà sélectionné possède un repère commun ;
- une sélection ferme la vue et restitue immédiatement l’agent à la page appelante sans perdre les autres champs déjà saisis ;
- aucun autofocus à l’ouverture : le clavier apparaît seulement après un toucher explicite dans la recherche.
- pendant la saisie, le champ de recherche est **stable** : il ne doit jamais être détruit/recréé à chaque caractère ; seul le mur de résultats est actualisé, afin de ne jamais fermer/réouvrir le clavier mobile ;
- pour les écrans Responsable, la sélection d’agent utilise en priorité la source métier déjà fiable `stip-actions · manager_agents` ; cette source porte nom, prénom, GHE et photo. Une vue de sélection ne doit jamais dépendre d’un second appel facultatif pour afficher la liste de base.

Exemple :

```js
STIPAgentSelector.openPicker({
  items: agents,
  selectedId: currentAgentId,
  onSelect(agent) {
    // La page appelante ne garde que son action métier.
  },
});
```

Lorsqu’une ancienne page de choix d’agent est repérée, la correction attendue est : **la brancher sur « Rechercher un agent »**, pas recréer localement une liste, des radios, des cartes ou un autre moteur.
- pour un écran qui a déjà ses propres contrôles de recherche/filtre, utiliser uniquement `STIPAgentSelector.mountWall(...)` pour le mur ; `openPicker(...)` reste le modèle complet avec en-tête, recherche et filtres.
- depuis Responsable, ouvrir « Ajouter » doit rester dans la page courante : activer l’onglet Agenda puis ouvrir la feuille d’ajout en mémoire. La navigation vers une nouvelle URL n’est qu’un secours si le runtime inline n’est pas disponible.

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

La page **Esprit d’équipe** reste la référence fonctionnelle de la composition complète à 3 niveaux (mois → semaine → jours). En revanche, le **visuel canonique d’une ligne de semaine** vient de **Mon profil / Accueil personnel** et vit désormais dans le composant partagé `.stip-week-line` / `.stip-week-day` de `stip-patterns.css`.

Toute page qui affiche une ligne de jours compatible doit utiliser ce composant partagé. Elle peut adapter les données du corps de chaque jour (shift personnel, indicateur terrain, événements, lecture seule), mais pas recréer sa propre géométrie de semaine.

Sur **Esprit d’équipe**, la ligne **Cette semaine / 7 jours** reste placée avant les cartes de shifts. Les informations destinées aux agents utilisent un langage terrain ; les cibles, écarts chiffrés et consignes de pilotage restent dans l’espace Responsable.

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

## Calendrier 1 mois canonique

Tous les tableaux calendrier affichant un mois complet utilisent obligatoirement le même contrat :
`stip-month-calendar` → `stip-month-grid` → `stip-month-day`, avec
`stip-month-day-number`, `stip-month-primary` et `stip-month-events`.

La géométrie, les espacements, le rouge des chiffres de week-end, l’état Aujourd’hui et le zoom de sélection sont définis uniquement dans `stip-patterns.css` et les variables `--stip-month-*` de `stip-theme-base.css`.
Une page peut définir son contenu et ses couleurs métier, mais ne doit pas redéfinir localement la hauteur des cases, les lignes internes, les gaps, la transformation de sélection ou la taille des pictogrammes. Les pastilles de shift sont la seule exception de taille.

Toute nouvelle page contenant un calendrier mensuel doit se brancher sur ce contrat avant d’être considérée terminée.
