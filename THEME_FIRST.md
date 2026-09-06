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
