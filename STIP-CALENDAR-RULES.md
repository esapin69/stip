# STIP — Contrat maître calendrier / carte du jour

Version validée : 26/09/2026.

Ce document est la référence fonctionnelle lisible du calendrier STIP. Toute modification du comportement semaine/jour doit modifier **dans le même changement** ce document, `stip-week-engine.js` et les tests calendrier.

## 1. Source de vérité

- `stip-week-engine.js` est l’unique moteur maître pour déterminer la période hebdomadaire visible.
- Accueil personnel, Esprit d’équipe, Responsable et Fiche/Agenda agent consomment ce moteur.
- Une page peut adapter le contenu d’une carte, mais elle ne doit pas recalculer localement les jours visibles, la semaine relative ou le passage au lundi suivant.
- Si le moteur maître n’est pas chargé, une page peut afficher une dégradation simple, mais elle ne doit pas recopier une règle métier du moteur.

### 1.1 Tableau planning « Au mois »

- Le rendu du **tableau mensuel** a une source unique : `stip-month-table.css` pour la géométrie/finition et `stip-month-table.js` pour la composition visuelle des semaines.
- Les pages gardent leur moteur de données et leur navigation métier ; elles exposent seulement les dates ISO au composant commun.
- Le composant commun gère les séparateurs `Sxx`, la ligne LU→DI répétée par semaine, l’alignement du premier jour, les cases jour, les états aujourd’hui/sélectionné et la suppression des espaces réservés inutiles.
- Dans le tableau mensuel, un shift travaillé est toujours rendu comme **badge texte** avec son code visible (`M`, `J`, `J4`, `S`, `N`), jamais comme simple rond de couleur. Une variante étoilée (`J4*`, etc.) conserve l’astérisque affiché mais hérite de la couleur de son shift de base.
- Dans le tableau mensuel, les repos et congés affichent leurs pictogrammes du planning (par exemple canapé pour repos et île pour congé) ; les événements gardent leurs pictogrammes séparés et les jours sans code restent vides. Les badges texte M/J/J4/S/N restent réservés aux postes travaillés.
- `home-shell.js`, `planning-home.js`, `metiers/metiers.js` et le laboratoire T consomment cette même source.
- Une page ne doit pas recréer localement la géométrie ou la finition de `.stip-month-calendar`. Les variations locales restent limitées au contenu métier placé dans `.stip-month-primary` / `.stip-month-events`.
- Chaque calendrier consommateur expose une date ISO par jour (`data-cal-day`, `data-ph-date` ou `data-stip-date`) et appelle le moteur `STIPMonthTable.enhance` après un remplacement de son DOM. Le moteur partagé, et non la page, insère les séparateurs de semaines, les en-têtes des jours et aligne le premier jour ; une page ne génère pas de cases vides artificielles.

## 2. Date et état

- La date réelle est calculée dans le fuseau `Europe/Paris`.
- `today` représente la date réelle. Une sélection utilisateur (`dayFocus`) ne doit jamais transformer un autre jour en « aujourd’hui ».
- L’ouverture normale se fait sur la période contenant aujourd’hui.
- Les semaines réellement précédentes ou suivantes sont des semaines complètes de lundi à dimanche.

## 3. Semaine courante

La semaine courante est progressive :

- lundi : lundi → dimanche ;
- mardi : mardi → dimanche ;
- mercredi : mercredi → dimanche ;
- jeudi : jeudi → dimanche ;
- vendredi : vendredi → samedi → dimanche → **pont LUNDI →** → lundi suivant ;
- samedi : samedi → dimanche → **pont LUNDI →** → lundi suivant ;
- dimanche : dimanche → **pont LUNDI →** → lundi suivant.

Le pont est une **vraie colonne visuelle indépendante**. Le lundi suivant est une vraie carte jour indépendante. Le pont et la carte du lundi occupent donc deux emplacements distincts.

Cette prévisualisation existe uniquement le vendredi, le samedi et le dimanche de la semaine courante en mode normal. Elle ne doit pas apparaître sur une semaine passée, une semaine future ou la partie déjà écoulée de la semaine courante.

### 3.1 Accueil : carte recto-verso Aujourd'hui / Demain (15/10/2026)

Le bloc des deux colonnes est **un seul ensemble retournable**, sur le modèle 3D
de la carte de profil, sans modifier les deux moteurs de données des cartes du jour.

- **Recto** : Aujourd'hui à gauche, Demain à droite, mêmes détails, actions et popups.
- **Verso** : **uniquement la semaine calendaire en cours** (lundi à dimanche) :
  lundi–vendredi sur la première ligne, samedi/dimanche sur la seconde.
  Une seule carte **« Lundi prochain »** occupe la zone restante du verso :
  code du shift et horaires **réellement disponibles** via le planning
  (ou mention explicite si l'horaire est indisponible). Aucune deuxième semaine
  complète, troisième rangée de 7 jours, ni flèches de navigation :
  le tableau mensuel situé dessous assure cette navigation.
- Les sept dates proviennent de `STIPWeekEngine.fullDates({weekOffset:0})`,
  avec la date de référence Europe/Paris. Ne pas recalculer les frontières
  de semaine localement ni modifier l'état de navigation des autres calendriers.
- Chaque jour conserve le code de shift ; les shifts travaillés utilisent
  le même badge texte que le mois via `STIPMonthTable.shiftBadgeHtml`.
  Repos/congés/absences : **code seul, sans icône de repos sur ce verso**.
  Hors calendriers mensuels, les pictogrammes de repos restent inchangés partout ailleurs.
- Les jours travaillés reçoivent une **teinte légère de leur véritable shift**
  (en-tête, filet de contour), tandis que les badges gardent la couleur pleine
  du calendrier mensuel. Les repos restent neutres, sans icône.
- Le recto et le verso ont **exactement la même hauteur** : les faces occupent
  la même cellule CSS Grid et sa hauteur vient de la plus grande face, y compris
  après chargement des cartes météo. Ne jamais réintroduire une mesure et une
  hauteur figée de la seule face active.
- Les événements personnels (rendez-vous, loisirs) sont en dessous, centrés
  verticalement, au maximum deux icônes puis `+N`. Aucune icône de chef
  dans les cartes.
- Un jour du verso ouvre la fenêtre partagée
  `STIPTeamFusion.openDate`, avec les permissions habituelles ; les chefs
  restent dans cette fenêtre, jamais dans la vignette.
- La face inactive est `inert` et masquée aux lecteurs d'écran. Une commande
  discrète sur chacune des faces retourne l'ensemble avec animation, comme
  la carte de profil. Une hauteur partagée évite les sauts sans scroll imbriqué.
- L'ancienne ligne glissante de sept cartes n'est **plus montée à l'accueil**.
  Aucun badge flottant `LUNDI`, aucune répétition artificielle du lundi.
  Les rendez-vous et le bloc mensuel conservent leurs propres sections.
- Au changement de jour Europe/Paris et au retour sur l'accueil, régénérer
  les jours du recto et les semaines du verso, sans toucher aux données métier.
- Ne pas modifier `visibleDates`, `display`, `move` ni les usages
  historiques de `upcomingSevenDates` dans les autres zones du site.

## 4. Navigation

- Depuis la période courante, « précédent » affiche d’abord les jours déjà écoulés de la même semaine lorsqu’ils existent.
- Depuis cette partie passée, « suivant » revient à la période courante avant de passer à la semaine suivante.
- Une semaine passée/future complète reste toujours lundi → dimanche.
- Changer de semaine ne doit pas fabriquer une sélection incohérente ; la sélection reste dans la période visible.
- Le moteur expose `currentState` pour revenir sans ambiguïté à la période courante avec `dayFocus = today`.
- Sur l’Accueil personnel, « Revenir à cette semaine » est proposé dès que l’affichage n’est plus la période courante exacte, y compris lorsqu’on consulte la partie déjà écoulée de la semaine (`weekPast`).
- L’ouverture normale de l’Accueil personnel et le retour vers Mon espace repartent sur la semaine courante et le jour réel. Un saut volontaire vers une date reste possible pendant la consultation en cours.
- Après le traitement ou la clôture d’une action depuis l’Accueil personnel, le prochain affichage du planning revient à la semaine courante.

## 5. Carte du jour commune

La géométrie commune appartient à :
- `stip-calendar-core.css` : structure et alignement ;
- `stip-calendar-visual.css` : apparence commune.

Les pages ne doivent pas recréer localement la géométrie de `.stip-week-line` ou `.stip-week-day`.

La carte peut afficher selon le contexte : jour + numéro, shift, pictogramme principal, événements, état aujourd’hui, état sélectionné et informations métier autorisées.

Les événements restent attachés à leur date ISO. Ajouter le lundi suivant ne doit jamais décaler les événements des autres jours.

## 6. États visuels protégés

- « Aujourd’hui » et « sélectionné » sont deux états différents.
- Nuit reste noire conformément au thème des shifts.
- Le pont `LUNDI →` reste rouge, lisible et distinct d’une carte jour.
- Le pont ne reçoit jamais l’état « aujourd’hui » ou « sélectionné ».

## 7. Interaction

- Le scroll vertical reste prioritaire.
- Les surfaces calendrier conservent `touch-action: pan-y`.
- Aucun listener global bloquant ne doit casser le scroll vertical.
- Une navigation horizontale ne doit pas provoquer un clic accidentel sur une carte jour.

## 8. Consommateurs obligatoires

- Accueil personnel : `home-shell.js`
- Esprit d’équipe : `esprit-equipe.js`
- Fiche / Agenda agent : `agent-agenda-view.js`
- Responsable : `responsable-agenda-home.js`

Aucune de ces vues ne doit contenir sa propre variable ou son propre calcul `liveTail`.

## 9. Protection automatique

- `tools/stip-calendar-contract-test.mjs` protège l’architecture et les consommateurs.
- `tools/stip-calendar-behavior-test.mjs` simule des dates fixes et protège les comportements.
- Le workflow GitHub `STIP design contract` exécute les deux à chaque push et pull request.

## 10. Dette héritée

`home-shell.css` contient encore des sélecteurs historiques `.hc-day`. Ils sont gelés :
- aucun nouveau rendu semaine ne doit les utiliser ;
- leur nombre ne doit pas augmenter ;
- leur suppression se fait par lots vérifiés visuellement, jamais par suppression massive aveugle.

La ligne semaine active utilise `.stip-week-day`.

## Règle de modification

Une règle validée ne doit pas être retirée parce qu’un refactor paraît « plus propre ». Si une nouvelle architecture entre en conflit avec ce contrat, le contrat métier gagne tant qu’une nouvelle décision explicite n’a pas été validée.
