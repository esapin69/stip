# GHE / STIP — Contrat maître d'import des plannings (15 octobre 2026)

**Statut :** contrat métier approuvé pour lecture et validation des nouveaux fichiers. Il complète `ARCHITECTURE_FIRST.md`, `STIP-CALENDAR-RULES.md` et `docs/operational-intelligence.md`.

## Principe non négociable

**Ce qui est stable, c'est le sens métier. L'emplacement d'une colonne, le nom d'un onglet, la couleur et l'apparence d'Excel ne sont jamais des sources de vérité suffisantes.** Une évolution de mise en page ne doit pas modifier les plannings historiques ni dégrader une information déjà fiable.

## Reconnaissance fiable et traçable

1. **Période et dates** : identifier chaque colonne par ses en-têtes calendaires (jour + mois + année), pas par sa position. Rejeter ou mettre en revue une période contradictoire, inconnue ou incomplète. Ne pas inventer l'année depuis la seule date système lorsqu'elle est décidable par la source.
2. **Agents et identité** : relier les noms à l'identité canonique et aux alias validés. Un changement d'orthographe, un retour, une nouvelle arrivée, un départ temporaire et le passage jour ↔ nuit ne créent pas automatiquement une anomalie métier ni un doublon. Le passage de mois n'efface ni fiche, ni historique, ni accès.
3. **Vrais agents vs gabarits** : ignorer les intitulés `NOM`, `Nom/Prénom`, les en-têtes, lignes de total et espaces réservés. Une ligne générique ne crée jamais une fiche agent.
4. **Codes et horaires** : lire le **code exact** (`J4` ≠ `J`, `J0965` ≠ `J` en matière d'horaires), la famille de shift, les heures, la durée et le mode `Fixe` ou `Libre`. La couleur n'est qu'un indice. Les informations nouvelles s'ajoutent au registre canonique `stip_shift_definitions` / `stip_special_shift_definitions`, sans écraser sans examen les anciennes versions utiles aux périodes passées.
5. **CUMUL PAR HORAIRE** : indique les **effectifs prévus** et peut fournir les libellés d'horaires. Il ne prouve pas à lui seul le besoin de service.
6. **ATTENDU** : indique les **références d'effectif**. Ce tableau peut se déplacer, changer de forme et être présent ou absent suivant les mois. Les comparaisons se font **par jour et par shift**, jamais avec un seuil universel inventé.
7. **Colonne sans titre** : en novembre 2026, `ATTENDU` a des totaux `35` (colonne « Semaine ») et `32` (colonne sans titre), ainsi que des variantes par horaire. **On ignore quand utiliser 35 plutôt que 32**. Tant que cette règle métier n'est pas clarifiée, **aucun de ces deux seuils de semaine ne doit générer un signal de sous/sureffectif**. Les références explicites des samedis/dimanches demeurent exploitables. Afficher une incertitude neutre.
8. **Décomptes** : recouper codes individuels, `CUMUL` et `ATTENDU` : différence détectée ≠ erreur certaine. Séparer incohérence de formule, vacance réelle, changement d'équipe et variante contractuelle `*` ou horaire libre.
9. **Version et provenance** : conserver fichier, onglet, date, ligne, colonne, valeur initiale, date d'import et lot. Ne pas confondre une correction d'un mois avec un remplacement des mois précédents.
10. **Sécurité des imports** : lecture/aperçu d'abord ; aucune publication, suppression d'agent, désactivation d'accès, création de compte ni écriture du planning officiel sans validation explicite de l'import. Les conflits restent en revue humaine.

## Exemple documentaire réel : novembre 2026

Source : pièces jointes du mail du 15 octobre 2026, `2026 11 STIP Jour Planning prévisionnel.xlsx` et `2026 11 STIP Nuit Planning prévisionnel.xlsx`.

- Le planning de jour présente `Planning collectif`, des effectifs par date, `Cumul par Horaire`, des shifts `M/J/J4/S`, des variantes `J0464/J0965/M0026/S0113` et un bloc `ATTENDU` inférieur.
- `Fixe` et `Libre` décrivent le type d'horaire ; `J0965` est une fenêtre libre `07:00–20:00` avec `04:30` indiquées ; ne pas l'assimiler à `J` classique pour les heures.
- `ATTENDU` affiche **samedi 12** (`M5/J3/S4`), **dimanche 9** (`M5/S4`) et deux références de semaine **35 / 32** dont la sélection n'est pas établie.
- La ligne `NOM` est un emplacement générique, pas une arrivée réelle.
- Le planning de nuit peut proposer `Planning collectif MODIF` et `Planning collectif V0` : choisir la version explicitement modifiée pour une prévisualisation, sans sommer les deux.
- Les plannings **chefs** ne sont pas encore disponibles sous forme Excel. Ne pas les synthétiser à partir des deux autres.

## Architecture concrète

- **Moteur d'import existant :** `supabase/functions/admin-ghe-import/index.ts`.
- **Lecture des références CUMUL/ATTENDU :** `supabase/functions/_shared/planning-import-references.mjs`, consommé directement par l'importeur.
- **Définitions horaires :** `stip_shift_definitions`, `stip_special_shift_definitions`, `shift-registry.js`.
- **Références datées :** `stip_staffing_references`, **jamais** confondues avec `stip_staffing_thresholds` historiques désactivés.
- **Historique et lots :** `planning`, `admin_import_batches` et les mécanismes d'override officiels existants.
- **Test automatique :** `tools/stip-planning-import-semantics-test.mjs`, déclenché par `.github/workflows/stip-planning-import-contract.yml`.

## Régressions à empêcher

- Un tableau `CUMUL` ne devient pas une cible `ATTENDU`.
- Un titre déplacé ne transforme pas 35/32 en une seule valeur arbitraire.
- Un week-end n'hérite pas des seuils de semaine.
- Un code `J4` ne se réduit pas à `J` ; une variante `J0965` ne perd pas ses heures `Libre`.
- La ligne `NOM` ne crée pas d'agent.
- Les fichiers `MODIF` et `V0` ne sont pas additionnés.
- Un agent absent d'un mois n'est ni supprimé, ni automatiquement désactivé.
- Les effectifs manquants sont affichés « inconnus », jamais « OK ».
- **Les tests documentent une règle et l'exécutent sur le vrai code d'extraction**, pas sur une simulation déconnectée.

## Points encore à développer ou confirmer

1. Sens exact de la colonne **32** et conditions de la double référence de semaine.
2. Reconnaissance des onglets totalement renommés et fichiers d'autres structures : la reconnaissance métier complète requiert des tests additionnels avant tout déploiement.
3. Retour des variations individuelles (arrivée, départ, mutation) sous forme de propositions non destructives avec rapprochement d'identités.
4. Validation bout en bout sur Excel d'autres mois et sur le backend Supabase déployé, distincte des tests du module.
5. Analyse des différences entre comptes présents et cumuls Excel selon conventions du service (notamment codes `*` et temps libre).

**Aucun fichier de novembre n'est importé du seul fait de l'enregistrement de ce contrat.**
