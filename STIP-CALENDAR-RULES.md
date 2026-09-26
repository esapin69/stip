# STIP — Contrat maître calendrier / carte du jour

Version validée : 26/09/2026.

Ce document est la référence fonctionnelle lisible du calendrier STIP. Toute modification du comportement semaine/jour doit modifier **dans le même changement** ce document, `stip-week-engine.js` et les tests calendrier.

## 1. Source de vérité

- `stip-week-engine.js` est l’unique moteur maître pour déterminer la période hebdomadaire visible.
- Accueil personnel, Esprit d’équipe, Responsable et Fiche/Agenda agent consomment ce moteur.
- Une page peut adapter le contenu d’une carte, mais elle ne doit pas recalculer localement les jours visibles, la semaine relative ou le passage au lundi suivant.
- Si le moteur maître n’est pas chargé, une page peut afficher une dégradation simple, mais elle ne doit pas recopier une règle métier du moteur.

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

## 4. Navigation

- Depuis la période courante, « précédent » affiche d’abord les jours déjà écoulés de la même semaine lorsqu’ils existent.
- Depuis cette partie passée, « suivant » revient à la période courante avant de passer à la semaine suivante.
- Une semaine passée/future complète reste toujours lundi → dimanche.
- Changer de semaine ne doit pas fabriquer une sélection incohérente ; la sélection reste dans la période visible.

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
