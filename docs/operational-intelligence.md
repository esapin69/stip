# STIP — Intelligence opérationnelle

## Objectif

Faire évoluer STIP de l'affichage de données vers une chaîne :

Donnée → Contexte → Impact → Anomalie → Options → Recommandation → Action → Suivi.

Le moteur prépare la décision. Il ne remplace pas le responsable.

## Invariants

- Les URL d'abonnement calendrier et leurs tokens sont permanents.
- Un changement de contenu ne doit jamais recréer un flux calendrier.
- Les codes planning sont normalisés avant tout calcul (`M0130` → `M`, `J0464` → `J`, etc.).
- RH, RTT, CA, RF, AT, AR et autres repos/absences ne sont jamais comptés comme agents disponibles.
- Un agent est disponible uniquement si son shift couvre réellement le créneau analysé.
- Les formations simultanées sont déduites de la disponibilité réelle.
- Pour un stagiaire, la couverture du référent est diminuée de ses propres formations simultanées.
- Une situation normale doit rester silencieuse.
- Une information incomplète sans conséquence opérationnelle (ex. lieu non renseigné seul) ne doit pas devenir une alerte Responsable.
- Une recommandation doit rester explicable et ne doit pas devenir automatiquement une décision.

## Composants actifs

### Supabase

- `stip-intelligence` : moteur d'analyse opérationnelle.
- `stip-calendar` : génération des calendriers existants ; conserver les tokens/URL.
- `stip_shift_definitions` : définition canonique des shifts.
- `stip_operational_rules` : règles configurables et paramètres futurs.
- `stip_operational_signals` : anomalies/recommandations actives et résolues.
- `stip_operational_decisions` : mémoire des décisions humaines.
- `stip_normalize_shift(text)` : normalisation SQL des codes planning.

### Front Responsable

- `responsable-intelligence.js` scanne aujourd'hui + 6 jours.
- Les signaux sont classés par gravité.
- Les signaux faibles sans action utile sont masqués.
- Le responsable peut enregistrer `treated` ou `not_needed`.
- Les décisions restent liées au signal source pour l'apprentissage futur.

## Calcul d'impact

Une formation est analysée par segment horaire, selon les bornes de début/fin des shifts qui croisent l'événement. Exemple : un événement 09:00–11:00 doit être capable de produire deux états différents, car J4 commence à 10:10.

Pour chaque segment :

- effectif planifié réellement présent ;
- agents rendus indisponibles par formation ;
- effectif réellement disponible ;
- répartition par shift ;
- anomalies liées aux participants ;
- possibilité éventuelle de rééquilibrage.

Un rééquilibrage mathématiquement possible reste une piste tant que les contraintes terrain, compétences, sectorisation et équité ne sont pas toutes disponibles.

## Couverture stagiaire

Pour chaque stagiaire :

1. lire son horaire réel ;
2. résoudre chaque référent vers un agent ;
3. récupérer le shift du référent ;
4. retirer ses formations simultanées ;
5. fusionner les plages couvertes par plusieurs référents ;
6. signaler uniquement les trous restants ;
7. détecter un même référent attribué simultanément à plusieurs stagiaires.

## Bruit

Ordre de présentation :

- normal : silence ;
- information utile : compacte ;
- anomalie : visible ;
- recommandation concrète : mise en avant ;
- urgence : prioritaire.

Ne jamais afficher une série de validations positives inutiles.

## Mémoire de décision

Chaque décision enregistrée doit conserver :

- signal d'origine ;
- acteur ;
- décision ;
- contexte ;
- éventuel résultat ;
- date.

L'historique doit servir d'indice et non de règle automatique.

## Équité future

Avant de classer des candidats de rééquilibrage, intégrer progressivement :

- changements de shift récents ;
- renforts précédents ;
- autres contraintes ;
- rôle de référent ;
- compétences/autorisations ;
- sectorisation ;
- charge ;
- équité globale.

## Sécurité

Les tables de signaux, décisions, règles et définitions de shifts ont RLS activé. Leur accès applicatif passe par les fonctions serveur. `stip_agent_agenda_items` a également été replacée derrière RLS.

## Références de déploiement au 23 août 2026

- `stip-intelligence` : version 1, active.
- `stip-calendar` : version 26, active.
- Front Responsable : `responsable-intelligence.js?v=20260823-intel2`.

Avant toute évolution : préserver les abonnements calendrier, ne pas remplacer les sources brutes par des données dérivées, tester la normalisation des shifts et vérifier que les situations normales restent silencieuses.
