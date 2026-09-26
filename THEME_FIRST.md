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

## Moteur de conception — de l’intention au détail

Toute demande visuelle doit être traitée comme une **intention à traduire**, pas comme une liste littérale de propriétés CSS. Avant de modifier l’interface, déterminer le rôle de l’élément, ses relations avec son environnement et le résultat perceptible recherché.

Ordre de raisonnement obligatoire :

**intention → contexte → invariants → hiérarchie → relations → géométrie → rendu → interactions → états → contraintes négatives → cohérence → vérification réelle.**

### 1. Intention
Comprendre ce que l’utilisateur cherche réellement à obtenir. Une formulation comme « plus discret », « premium », « naturel », « trop collé », « moche » ou « on sent une séparation » décrit un effet perçu ; elle ne prescrit pas à elle seule une propriété CSS. Traduire cet effet en causes vérifiables avant de modifier.

### 2. Contexte et invariants
Identifier explicitement ce qui fonctionne déjà, ce qui est validé et ce qui ne doit pas bouger. Une correction locale ne donne jamais l’autorisation de redessiner les éléments voisins, changer une icône, inverser des actions ou modifier un comportement métier non demandé.

### 3. Hiérarchie et relations
Définir avant les valeurs CSS :
- ce qui doit être vu en premier ;
- ce qui est secondaire ;
- ce qui doit être discret mais découvrable ;
- ce qui doit sembler appartenir au même bloc ;
- ce qui doit au contraire être clairement séparé ;
- les rapports de dominance entre titre, contenu, action principale, action secondaire et information d’état.

La qualité d’une interface vient d’abord de ces relations. Ne jamais réduire une demande visuelle à une accumulation de tailles, couleurs ou ombres indépendantes.

### 4. Géométrie
Traiter consciemment dimensions, proportions, marges, espacements, alignements, centrage, densité, rayon, épaisseur, rythme vertical, zones tactiles et occupation de l’écran. Éviter les décalages correctifs locaux lorsqu’un axe, une grille ou un composant commun peut exprimer la géométrie proprement.

### 5. Rendu perceptible
Les mots abstraits doivent être traduits en propriétés observables. Par exemple, « premium » peut nécessiter une hiérarchie plus nette, une profondeur courte, des séparations précises, une typographie mieux pondérée et un état actif mieux marqué — pas davantage de décoration. Contraste, surface, bordure, relief, profondeur, typographie et densité doivent servir le rôle de l’élément.

### 6. Interactions et états
Pour tout élément interactif, considérer au minimum : repos, pression/touch, focus si pertinent, sélection, chargement, succès, erreur et retour/navigation. Sur mobile, vérifier aussi scroll vertical, swipe horizontal, clavier ouvert, `visualViewport`, focus, zoom navigateur, safe areas et stabilité des zones tactiles.

### 7. Contraintes négatives
Avant une modification sensible, formuler ce qu’elle ne doit pas provoquer : aucun déplacement parasite, aucune régression, aucune nouvelle couche inutile, aucune modification d’icône non demandée, aucune rupture de navigation, aucun changement métier caché, aucune duplication d’un composant déjà commun.

### 8. Cohérence
Comparer d’abord avec `VISUAL_MASTERS.md`, les composants canoniques et les consommateurs déjà validés. Réutiliser la règle commune lorsqu’elle existe. Une similitude visuelle seule n’autorise pas la propagation : respecter les statuts maître/canonique/référence fonctionnelle.

### 9. Vérification réelle
Ne jamais considérer une modification visuelle comme correcte uniquement parce que le code paraît cohérent. Quand les outils le permettent, inspecter le rendu réel dans le viewport concerné, exercer les interactions touchées et contrôler les composants voisins susceptibles d’avoir régressé. Une vérification non exécutée doit être signalée comme telle.

### Principe de précision
Préférer des descriptions causales et relationnelles aux adjectifs vagues. Décrire **pourquoi** un élément doit paraître juste, **par rapport à quoi**, **dans quel état** et **ce qui doit rester stable**. Les valeurs CSS viennent ensuite comme moyen d’obtenir ce résultat.

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

### MAÎTRE VALIDÉ — « Rechercher un agent »

Toute interface dont l’objectif principal est de **choisir un agent** appartient à ce modèle. Un ancien `<select>` natif doit être retiré à la source et remplacé par le sélecteur partagé ; il ne doit jamais être simplement recouvert.

Référence enregistrée : le module actuel de **ACCÈS & SÉCURITÉ > Accès** est la source visuelle validée du maître. Les contrôles propres à Accès & Sécurité restent hors du maître ; seuls la recherche, les filtres Nom/Prénom/GHE, le mur, les séparateurs, portraits, tampons GHE et la logique de sélection appartiennent au composant partagé.

Contrat validé :
- ouverture dans une vraie vue STIP via `STIPAgentSelector.openPicker(...)` ; plein écran sur téléphone, surface adaptée sur écran large ;
- en-tête simple avec retour + **Rechercher un agent** ; aucun sous-titre inutile ;
- grande barre `Rechercher…` ; tous les agents sont visibles au départ et le filtrage commence dès le premier caractère, sans afficher de mention « dès 1 lettre » ;
- séparateur officiel **FILTRE**, puis trois onglets : `Prénoms`, `Noms`, `GHE` ;
- filtre initial : `Prénoms` ; le filtre actif zoome légèrement et passe en gras + majuscules ;
- `Prénoms` et `Noms` regroupent le mur par séparateurs `A`, `B`, `C`… et ne rendent jamais de groupe vide ;
- `GHE` regroupe dynamiquement en `SANS GHE`, puis par numéro réel `GHE 1`, `GHE 2`, etc., avec `AUTRE GHE` uniquement si une valeur existe mais n’est pas interprétable ;
- affichage sous forme de **mur de portraits ovales verticaux (4:5)** : photo importante, initiales en secours, tampon GHE superposé au bas du portrait sans masquer le visage ; les images utilisent `object-fit: cover` afin de conserver leurs proportions sans jamais les étirer ;
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

### MAÎTRE — Actions agent contextuelles

Le clic sur une personne peut ouvrir un **pop commun d’actions** via `STIPPersonActions.open(...)` lorsque la page propose plusieurs suites possibles.

Règles :
- le pop est un bottom-sheet sur mobile et une fenêtre centrée sur écran large ;
- son en-tête réutilise le portrait ovale, l’identité et le tampon GHE du maître Personnes ;
- la page appelante fournit uniquement les actions pertinentes et déjà autorisées ; le composant visuel ne décide jamais lui-même des permissions métier ;
- une action sensible reste revalidée côté métier/serveur au moment de son exécution ;
- **Rechercher un agent dans un formulaire reste une exception volontaire** : le clic sélectionne immédiatement l’agent et revient au formulaire, sans pop intermédiaire ;
- dans **ADMIN > Accès**, le pop propose selon les données disponibles : gérer/créer l’accès, voir le planning, appeler ;
- dans **Équipe / annuaire**, le pop propose : voir le planning et appeler lorsque le téléphone est disponible ;
- une action indisponible n’est pas affichée plutôt que grisée inutilement ;
- aucune page ne recrée localement son propre bottom-sheet d’actions agent.

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
7. La couleur suit le contexte. Le composant utilise `--stip-filter-accent` et `--stip-filter-accent-soft`, surchargeables par choix/page si le sens métier le demande.
8. L’état actif est nettement plus présent : relief, saturation et échelle augmentent légèrement ; les choix inactifs restent parfaitement lisibles.
9. Le texte reste sous le visuel et centré ; ne pas transformer le composant en liste de gros boutons texte.
10. Sur mobile, les bulles restent tactiles et lisibles ; réduire d’abord les espaces avant de réduire fortement les pictogrammes ou les libellés.

Règle de réutilisation : lorsqu’une page propose **2 à 6 choix courts de même niveau** (filtre, onglet, vue, statut), vérifier 6B en premier. Ne créer une autre géométrie que si le besoin métier l’exige réellement.

## Formulaires — contrat commun mobile-first

Tous les formulaires STIP, publics comme authentifiés, doivent suivre le même moteur d’interaction mobile. Une page ne recrée pas localement une navigation clavier différente.

### Clavier et viewport

- Un champ ne doit jamais provoquer de zoom navigateur au focus : sur mobile, les `input`, `textarea` et `select` éditables utilisent une taille calculée d’au moins `16px`.
- L’ouverture du clavier n’a pas le droit de rendre le champ actif ou l’action suivante inaccessible.
- Le moteur commun doit suivre `window.visualViewport` quand il existe et raisonner sur la hauteur réellement visible, pas uniquement sur `100vh`.
- Le contenu du formulaire reste naturellement scrollable ; ne pas figer la page entière pour compenser le clavier.
- Les zones fixes ou sticky tiennent compte de `env(safe-area-inset-bottom)`.

### Progression champ par champ

- Quand un champ reçoit le focus, le formulaire l’amène dans la zone visible sans zoom artificiel et sans animation excessive.
- Tant que le clavier est ouvert, l’écran réduit doit prioriser dans cet ordre : **contexte immédiat du champ → champ actif → action de progression**.
- Les grands titres, textes d’introduction et décorations situés au-dessus peuvent sortir naturellement du viewport ; ne pas les recopier dans une seconde interface spéciale clavier.
- Les champs texte simples utilisent une action clavier cohérente (`next` quand une étape éditable suit, `done` à la dernière saisie pertinente).
- `Enter` / l’action « suivant » du clavier avance vers le prochain champ éditable lorsqu’il existe ; elle ne soumet pas prématurément un formulaire multi-étapes.
- Une zone de texte multiligne conserve le retour à la ligne naturel sauf règle métier explicite contraire.

### Action de progression

- Une action visuelle compacte peut accompagner le champ actif quand cela améliore réellement la progression, mais elle doit être dérivée du moteur commun et non dessinée différemment par formulaire.
- Cette action doit rester clairement distincte du champ, suffisamment tactile, et ne doit jamais recouvrir le texte saisi.
- Ne pas transformer la flèche/validation intermédiaire en bouton principal surdimensionné ; la validation finale reste visuellement distincte.

### États et validation

- La validation se fait au plus près du champ concerné ; une erreur ne doit pas faire perdre le focus ni renvoyer arbitrairement en haut de page.
- Après correction, l’état d’erreur disparaît sans laisser une couche visuelle résiduelle.
- Une étape désactivée ou non applicable n’entre pas dans la chaîne `next`.
- Au retour arrière dans le formulaire, conserver les valeurs déjà saisies tant que le métier ne demande pas explicitement de les réinitialiser.

### Règle de propagation

Le premier consommateur de référence est le formulaire public **Demander un accès**. Les comportements validés sur ce formulaire doivent être implémentés dans le moteur/formulaire commun avant propagation aux autres formulaires compatibles. Tant que ce formulaire est encore en réglage, ne pas copier ses correctifs localement dans toutes les pages : corriger la base commune puis brancher progressivement les consommateurs.
