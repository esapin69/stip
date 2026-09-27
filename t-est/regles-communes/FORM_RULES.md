# STIP — Règles communes des formulaires

Ce document est le **contrat canonique** des formulaires STIP.

Il décrit les comportements qui doivent être partagés par tous les formulaires compatibles. Une page peut adapter son contenu métier, mais elle ne doit pas recréer localement une autre logique de clavier, de navigation, d’autoremplissage ou de progression.

## 1. Source de vérité

Le moteur commun est :

- `t-est/regles-communes/global.js` : comportement `STIPFormUX`;
- `t-est/regles-communes/global.css` : géométrie et présentation du mode formulaire/clavier.

Les fichiers :

- `form-engine-v2.js`;
- `form-engine-v2.css`;

ne sont **pas** le moteur général des formulaires. Ils ne servent qu’au retour visuel de la connexion par code (`Vérification…` + indicateur de chargement) et restent un adaptateur de compatibilité ciblé.

## 2. Mode explicite obligatoire

Tout vrai `<form>` STIP doit déclarer `data-stip-form-mode`. Le mode est visible dans le HTML : il ne doit pas dépendre d’une déduction silencieuse.

Modes autorisés :

- `sequential` : formulaire question par question utilisant le moteur commun, le plein écran clavier et, lorsqu’il y a plusieurs étapes, Précédent / Suivant / action terminale / Vue complète ;
- `standard` : formulaire classique conservant sa mise en page normale ; STIP garde seulement les normalisations communes utiles, notamment autoremplissage et codes compatibles ;
- `search` : formulaire ou surface dédiée à la recherche ; la saisie suit le mode recherche et non le questionnaire séquentiel ;
- `composer` : chat, message ou saisie libre ; le compositeur garde son interaction native ;
- `native` : formulaire volontairement géré par sa logique propre, tout en pouvant conserver les normalisations communes compatibles ;
- `exempt` : aucune intervention FormUX, y compris les normalisations automatiques.

Les anciens attributs `data-stip-keyboard-native` et `data-stip-keyboard-exempt` restent compris pour compatibilité, mais ils ne remplacent pas le mode explicite sur un nouveau formulaire.

Un formulaire créé dynamiquement doit recevoir son mode **avant** d’être inséré dans le DOM.


## 3. Règle fondamentale

**Un champ actif = une question claire = une action cohérente.**

Le moteur détermine la progression à partir des contrôles réellement utilisables du formulaire.

Ne comptent jamais comme étape suivante :

- les champs désactivés ;
- les champs en lecture seule ;
- les contrôles `hidden` ;
- les éléments sous `.hidden` ;
- les éléments sous `aria-hidden="true"` ;
- les éléments sous `inert` ;
- les boutons techniques `submit`, `reset`, `button`, `image` ;
- les recherches gérées par le mode recherche ;
- les éléments explicitement exclus avec `data-stip-keyboard-native` ou `data-stip-keyboard-exempt`.

## 4. Navigation entre les étapes

### Étape intermédiaire

- afficher **Suivant →** lorsqu’un autre champ de saisie compatible existe réellement après ;
- afficher **Continuer →** lorsqu’un autre contrôle exploitable existe après mais qu’il n’est pas un champ de saisie géré par le moteur.

### Dernière étape

- ne jamais afficher **Suivant** s’il n’existe plus d’étape ;
- utiliser l’action métier réelle du bouton de soumission lorsqu’elle existe ;
- si l’action terminale s’appelle seulement `Suivant` ou `Continuer`, afficher **Valider ✓** ;
- s’il n’existe aucun bouton de soumission, afficher **Terminer ✓** ;
- une action terminale ne doit jamais conserver une flèche `→` laissant croire qu’une autre étape existe.

Le clic et la touche **Entrée** doivent utiliser le même calcul de progression.

## 5. Validation

Avant de quitter un champ, le moteur respecte la validation native du navigateur.

Si `reportValidity()` échoue :

- rester sur le champ courant ;
- ne pas ouvrir l’étape suivante ;
- ne pas soumettre le formulaire.

## 6. Touche Entrée

Pour un champ simple :

- `Entrée` déclenche la même progression que l’action affichée ;
- sur la dernière étape, `Entrée` déclenche donc l’action terminale réelle.

Pour un `textarea` :

- `Entrée` reste une saisie de texte ;
- elle ne doit pas valider ni changer d’étape.

## 7. Précédent et vue complète

Sur un formulaire séquentiel :

- **← Précédent** revient à l’étape précédente réelle ;
- lorsqu’aucune étape précédente n’existe, le flux peut revenir à la vue d’ensemble ;
- **Vue complète** quitte le mode question plein écran sans perdre les données saisies.

Une page peut intercepter l’événement `stip:form-previous-request` uniquement lorsqu’elle doit préserver un historique métier ou navigateur spécifique.

## 8. Question affichée

Le texte de la question active est déterminé dans cet ordre :

1. `data-stip-question` ;
2. le texte du `label` ;
3. `aria-label` ;
4. `placeholder` ;
5. le nom du champ ;
6. `Votre réponse` en dernier recours.

Une question importante ne doit donc pas dépendre d’un placeholder ambigu.

## 9. Clavier mobile et plein écran

Quand le clavier réduit réellement la zone visible :

- utiliser `visualViewport` lorsqu’il est disponible ;
- caler le formulaire sur la hauteur réellement visible ;
- afficher uniquement la question active, son champ et les actions utiles ;
- éviter qu’un champ ou un bouton soit caché derrière le clavier ;
- conserver une largeur de lecture raisonnable sur grand écran ;
- ne pas casser le geste natif de rafraîchissement de la porte d’entrée.

Le mode plein écran est une présentation du même formulaire, pas un second formulaire.

## 10. Recherche

Les champs `input[type="search"]` utilisent le mode recherche commun :

- champ visible dans le viewport clavier ;
- résultats/suggestions du bloc conservés ;
- bouton `×` pour quitter le mode plein écran ;
- pas de transformation en questionnaire séquentiel classique.

## 11. Chats et compositeurs

Les formulaires identifiés comme chat, message, composer ou dialogue de saisie libre gardent leur comportement natif.

Ils ne doivent pas être transformés automatiquement en questionnaire à étapes.

## 12. Nom, prénom et autoremplissage

Règle d’identité :

**l’ordre du DOM est la seule source d’ordre visuel.**

- ne jamais inverser Nom et Prénom en JavaScript ;
- `first_name`, `given_name`, `prenom` correspondent à `given-name` ;
- `last_name`, `family_name`, `surname`, `nom` correspondent à `family-name` ;
- conserver des attributs `autocomplete` explicites lorsque la sémantique est connue ;
- ne jamais masquer une inversion de champs par une logique d’ordre cachée.

## 13. Codes personnels à 6 chiffres

Un code STIP à 6 chiffres n’est pas un mot de passe navigateur classique.

Le contrat commun est :

- type texte côté navigateur ;
- `inputmode="numeric"` ;
- six chiffres maximum ;
- caractères non numériques supprimés ;
- `autocomplete="off"` ;
- masquage visuel par le moteur STIP ;
- possibilité d’afficher/masquer sans changer la sémantique du champ.

## 14. Inscription automatique des formulaires

Le moteur peut enrôler automatiquement les champs standards ajoutés au DOM.

Un nouveau formulaire ne doit donc pas recréer localement :

- son propre gestionnaire Entrée/Suivant ;
- son propre plein écran clavier ;
- son propre moteur Nom/Prénom ;
- son propre moteur de code à 6 chiffres.

Une exception locale doit être explicitement déclarée et justifiée.

## 15. Règles d’évolution

Toute modification du comportement commun d’un formulaire doit respecter cet ordre :

1. modifier le moteur commun si la règle est universelle ;
2. mettre à jour ce document ;
3. mettre à jour le test `tools/stip-form-contract-test.mjs` ;
4. vérifier les formulaires consommateurs ;
5. ne créer une adaptation locale que si le besoin est réellement spécifique.

Une correction n’est pas considérée comme complète si elle fonctionne sur une seule page alors que le comportement est commun.

## 16. Invariants à ne pas casser

- pas de **Suivant** sans vraie étape suivante ;
- dernière étape = action terminale explicite ;
- Entrée = même progression que le bouton, sauf `textarea` ;
- champs invisibles/techniques exclus de la progression ;
- Nom et Prénom jamais inversés par le moteur ;
- clavier mobile jamais au-dessus du champ ou de l’action principale ;
- `Vue complète` ne perd pas les données ;
- recherche et chat gardent leurs comportements spécialisés ;
- un seul moteur commun pour les formulaires compatibles.
