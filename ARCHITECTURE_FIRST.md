# STIP — ARCHITECTURE FIRST

Ce document est le contrat d’architecture transverse de STIP.

Il doit être lu avant toute modification substantielle du site, quel que soit le module concerné.

## Principe directeur

**Une information métier = une source de vérité = un moteur commun = plusieurs vues adaptées.**

Les pages STIP ne doivent pas devenir des mini-systèmes autonomes. Elles doivent composer des moteurs, référentiels et composants partagés.

Une correction doit être faite **au cœur du problème**, puis propagée par les consommateurs existants. Ne pas corriger en surface lorsqu’une source de vérité, un moteur ou un composant commun peut être corrigé.

## Règles obligatoires avant de coder

Avant toute modification :

1. Identifier la donnée ou le comportement réellement concerné.
2. Chercher sa source de vérité actuelle.
3. Chercher un moteur, registre ou composant partagé existant.
4. Lister les pages/apps qui consomment déjà cette information.
5. Vérifier si la demande révèle une duplication ou une divergence existante.
6. Corriger la source commune en priorité.
7. Ne créer un nouveau moteur que si aucun mécanisme partagé ne couvre proprement le besoin.
8. Si un concept apparaît sur au moins deux surfaces, préférer un composant ou moteur commun.
9. Supprimer les anciennes couches remplacées au lieu d’en ajouter une nouvelle.
10. Vérifier les régressions sur les autres consommateurs de la même source.

## Hiérarchie de décision

Quand plusieurs solutions sont possibles, respecter cet ordre :

1. Corriger la donnée canonique.
2. Corriger le moteur partagé.
3. Corriger le composant partagé.
4. Corriger l’intégration d’une page.
5. Ajouter une adaptation locale uniquement si le besoin est réellement spécifique à cette page.

Une adaptation locale ne doit jamais masquer une incohérence globale.

## Sources et moteurs déjà canoniques

### Visuel
- `stip-theme.css` : point d’entrée visuel officiel.
- `stip-theme-base.css` : tokens et primitives.
- `stip-patterns.css` : motifs partagés.
- `stip-shell.css` : shell commun.
- `stip-loading.css` : états de chargement.
- `THEME_FIRST.md` : contrat visuel.

### Navigation
- Réutiliser le moteur de navigation STIP existant et ses états de reprise.
- Ne pas créer de logique retour/reprise propre à une page lorsque le moteur commun peut la porter.

### Continuité de session et retour navigateur
- Une session déjà valide ne doit jamais réafficher provisoirement l’écran « Accès direct » pendant un rafraîchissement ou un retour navigateur.
- Le client réhydrate immédiatement le dernier instantané de session valide, puis revalide silencieusement côté serveur.
- Seuls les refus serveur explicites d’authentification/autorisation (`401`/`403`) peuvent invalider la session locale. Une coupure réseau, un timeout ou une erreur serveur transitoire ne doit pas déconnecter l’utilisateur.
- `stip-session-continuity.js` est la source commune pour l’instantané et la revalidation de session. Ne pas recréer un appel `me` concurrent lorsqu’un instantané frais est disponible.
- Le bouton retour doit préférer l’historique navigateur réel. Un fallback par nouvelle navigation n’est utilisé que lorsqu’aucune entrée STIP exploitable n’existe.
- Les navigations HTML normales utilisent une réponse mise en cache immédiatement disponible puis une actualisation silencieuse. Un rafraîchissement explicite reste autorisé à demander la version réseau.
- Le retour navigateur doit conserver l’écran, le scroll et les données déjà rendues quand le navigateur peut restaurer la page ; ne pas forcer un rechargement complet sur `pageshow`, `focus` ou `visibilitychange`.
- Les contrôles de version ne doivent pas déclencher plusieurs requêtes au simple retour sur une page. La vérification se fait au chargement initial puis à faible fréquence en arrière-plan.
- Tous les caches de continuité restent versionnés, liés à la session courante et invalidés au logout, au changement de session ou à un refus serveur explicite.

### Agents
- `stip-agent-selector.js/.css` : sélection/recherche partagée.
- Les pages doivent consommer les données agent fiables existantes au lieu de recréer une seconde liste.

### Planning / shifts
- `shift-registry.js` : registre canonique des shifts.
- Toute page qui interprète des codes de shift doit utiliser ce registre.
- Ne pas recréer localement les horaires, couleurs, variantes ou codes de base.

### Intelligence terrain
- `stip-field-intelligence.js` : moteur partagé d’analyse terrain.
- Les pages consomment ses états et raisons ; elles ne créent pas leur propre scoring concurrent.

### Légendes
- Utiliser le composant de légende partagé.
- Les légendes doivent dériver des repères réellement visibles.

### Visite des lieux
- Supabase `stip_places` et tables liées = référentiel canonique.
- Aucun catalogue parallèle dans une page, export ou module de chat.

### Chat STIP / Fauteuils
- Conserver les contrats canoniques documentés dans `AGENTS.md`.
- Ne pas recréer backends, catalogues ou moteurs de réactions concurrents.

## Moteurs à consolider progressivement

Ces moteurs peuvent être extraits au fil des chantiers quand une duplication réelle est rencontrée.

### DaySnapshot
Objectif : produire un état canonique d’une journée à partir du planning, des shifts, horaires adaptés, chefs, stagiaires, événements, cibles et signaux.

Toutes les vues affichant des effectifs ou un état de journée doivent à terme lire ce même snapshot.

### Time Engine
Objectif : unifier mois, semaine, jour, sélection, événements et navigation temporelle.

Accueil, Esprit d’équipe, Responsable et fiche agent ne doivent pas maintenir quatre calendriers indépendants.

### Permission Engine
Objectif : exposer un contrat unique de permissions côté interface, toujours adossé à une vérification serveur.

Masquer un bouton ne constitue jamais une sécurité.

### Notification/Event model
Objectif : unifier cloche, demandes, changements, alertes et événements autour d’un modèle commun.

### Export Engine
Objectif : séparer la sélection de données du format de sortie.

Affichage, impression, PDF et Sheet doivent être des sorties du même modèle, pas quatre moteurs.

### Form Engine
Objectif : mutualiser questionnaires, évaluations, validations, signatures et génération finale lorsque plusieurs workflows suivent la même structure.

## Contrat des pages

Une page doit idéalement ne posséder que :

- sa composition ;
- ses permissions d’affichage ;
- sa sélection de données ;
- ses actions métier spécifiques ;
- les adaptations strictement propres à son contexte.

Elle ne doit pas posséder une copie locale :

- d’un référentiel ;
- d’un moteur de planning ;
- d’un registre de shifts ;
- d’un système de permissions ;
- d’un moteur d’analyse ;
- d’un composant visuel déjà partagé ;
- d’un système de chargement global ;
- d’un moteur d’export ;
- d’une logique de navigation déjà disponible.

## Chargement et stabilité

Règle générale :

**premier rendu cohérent, puis actualisation silencieuse.**

- Éviter les rendus complets successifs provoqués par plusieurs appels réseau.
- Réserver la géométrie des zones qui seront enrichies après chargement.
- Pendant une actualisation, conserver l’écran courant.
- Une donnée secondaire ne doit pas déplacer une action sous le doigt.
- Les erreurs partielles doivent dégrader uniquement la zone concernée.
- Le cache doit être versionné et invalidé lors des changements de session, rôle ou schéma.

## Données et cohérence

Quand plusieurs nombres ou états décrivent la même réalité :

- ils doivent provenir du même modèle ;
- un écart doit être impossible ou explicitement expliqué ;
- ajouter un invariant automatique dès qu’une incohérence a déjà été observée.

Exemples :
- total présents = somme des catégories réellement comptées ;
- compteur de shift = population utilisée par l’analyse de ce shift, sauf différence explicitement définie ;
- un code de shift inconnu ne doit jamais être silencieusement ignoré.

## Interaction

Une action = une zone tactile.

- Ne pas imbriquer deux actions différentes dans le même bouton.
- Séparer physiquement analyse, ouverture, suppression, sélection, etc.
- Cibles tactiles principales : au moins 44 px.
- Les indicateurs peuvent rester visuellement discrets tout en gardant une cible tactile suffisante.
- Un chevron peut être indicatif ; ne pas créer une troisième action inutile si la carte entière est déjà cliquable.

## CSS et composants

- Pas d’empilement de correctifs successifs quand une règle commune peut être consolidée.
- Après validation d’un nouveau composant, supprimer les anciennes variantes remplacées.
- Éviter les gros blocs CSS injectés par JavaScript.
- Le JavaScript porte données et comportement ; le thème/composant CSS porte le visuel.
- Une future page doit réutiliser les composants communs avant d’introduire une nouvelle variante.

## Permissions et sécurité

- Le serveur est l’autorité.
- L’interface reflète les permissions mais ne les remplace pas.
- Tout nouvel outil IA ou action sensible doit revalider rôle et permissions côté serveur.
- Aucune donnée sensible ne doit être envoyée à un modèle externe si le besoin peut être satisfait localement/déterministement.
- Les fonctions IA ne doivent pas ouvrir de voie d’administration ou de contournement.

## Nouvelle fonctionnalité : question obligatoire

Avant de créer une nouvelle app/page, répondre :

1. Quelle donnée canonique utilise-t-elle ?
2. Quels moteurs existants peut-elle réutiliser ?
3. Quels composants existants peut-elle réutiliser ?
4. Pourquoi une nouvelle page est-elle nécessaire plutôt qu’une nouvelle vue d’un moteur existant ?
5. Quelles parties deviendraient dupliquées si on la codait localement ?
6. Quels tests empêcheront une divergence future ?

Si ces réponses ne sont pas claires, ne pas commencer par coder une nouvelle couche.

## Garde-fous attendus

Étendre progressivement la CI pour bloquer :

- références JS/CSS inexistantes ;
- pages qui utilisent des shifts sans le registre canonique ;
- nouveaux composants interactifs imbriqués ;
- nouveaux catalogues hard-codés concurrents ;
- nouveaux styles globaux injectés localement ;
- duplications évidentes d’un composant canonique ;
- incohérences de compteurs connues ;
- régressions de navigation/cache/loading ;
- nouvelles pages qui ignorent les contrats `ARCHITECTURE_FIRST.md` et `THEME_FIRST.md`.

## Règle de clôture

Un chantier n’est pas réellement terminé si :

- le correctif fonctionne seulement sur une page alors que le même concept existe ailleurs ;
- une ancienne couche contradictoire reste active ;
- deux sources de vérité continuent à coexister ;
- les autres consommateurs du moteur n’ont pas été vérifiés ;
- aucun garde-fou n’empêche le même problème de revenir.

Le résultat attendu n’est pas seulement « ça marche ici ».

Le résultat attendu est : **la règle correcte vit au bon niveau et toutes les vues compatibles en héritent.**
