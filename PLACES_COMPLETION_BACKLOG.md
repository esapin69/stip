# Visiter les lieux — backlog de complétion terrain

Dernier audit : 25/09/2026.

Ce fichier est un **registre de collecte**, pas une source de vérité publiée. Le catalogue canonique des champs attendus est `stip_place_dictionary_field_defs`. Une mention `à compléter`, `à confirmer`, `à préciser`, `provisoire` ou un `evidence_status=to_confirm` sert uniquement au suivi interne et ne doit jamais devenir un fait exporté.

## 1. Lacunes explicitement repérées dans Visiter les lieux

### CARDIO / Louis Pradel
- **Ascenseur du bloc** (`hlp_elev_block`) : emplacement précis à compléter.
- **Hélistation** (`hlp_helipad`) : points de retrait de la clé d’ascenseur à valider.
- **PTI — Plateau technique interventionnel** (`hlp_tm_pti`) : localisation/intitulé provenant du tableur, encore `to_confirm`.
- **Salle Monet** (`hlp_tm_salle_monet`) : orthographe du repère de salle à valider.

### NEURO / Pierre Wertheimer
- **Centrale des respirateurs** (`pw_centrale_respirateurs`) : emplacement précis à compléter.
- **Gare EMT Neuro** (`pw_gare_emt_neuro`) : emplacement précis à compléter.
- **Plateau de recherche en neurosciences** (`pw_plateau_recherche_neuro`) : emplacement précis à compléter.
- **Pôle des spécialités neurologiques** (`pw_pole_specialites_neuro`) : emplacement précis à compléter.
- **Salle de réveil Neuro** (`pw_reveil`) : niveau 1 / aile A issu du tableur, encore `to_confirm`.
- **Radiothérapie depuis Neuro** : point exact de raccord de la liaison à compléter.

### HFME
- **Entrée principale HFME** (`hfme_entry_main`) : organisation du hall et directions immédiatement après l’entrée à compléter.
- **Ascenseurs professionnels côté gynéco-obstétrique** (`hfme_pro_elev_obst`) : dessertes et chemin précis à compléter.
- **Ascenseurs professionnels côté urgences pédiatriques / UHCD** (`hfme_pro_elev_ped`) : dessertes précises à compléter.
- **5e étage HFME** (`hfme_l5`) : chambres 31–36 et répartition Gynéco A/B à valider.

### Annexes
- **TEP-CT B14** (`b14_tep_ct`) : donnée tableur encore `to_confirm`.

## 2. Référence de richesse informationnelle : NEURO U301 / U302

Le MASTER actuel montre qu’une entrée de service peut contenir beaucoup plus que nom + étage + téléphone.

### U301 — informations utiles observées dans le MASTER
- unité et spécialité ;
- étage / code unité ;
- PTAH multiples ;
- UF multiples ;
- distinction de secteurs internes ;
- équipe / fonctions utiles ;
- neuropsychologues ;
- contacts et responsables du secteur vidéo-EEG ;
- utilité terrain pour distinguer deux destinations portant la même unité ;
- source terrain et date de confirmation.

### U302 — informations utiles observées dans le MASTER
- unité et spécialité ;
- étage / entrée ;
- téléphones d’accueil ;
- adresse ;
- transport en commun / arrêt ;
- adresse mail ;
- horaires d’accueil téléphonique ;
- horaires de rendez-vous ;
- secrétariat ;
- équipe médicale / IDE avec périmètres ;
- contacts associés ;
- collaboration (service social, psychologue du travail, ergonome, etc.) ;
- utilité terrain ;
- source terrain.

## 3. Écart actuellement visible entre le site et le MASTER

Le site contient déjà pour U302 : unité, spécialité, 3e étage, Entrée B, téléphones, horaires, mail, alias et activité.

Le MASTER contient en plus plusieurs informations non encore structurées dans `stip_places` : adresse / transport, secrétariat, composition d’équipe, contacts associés, collaborations et texte d’utilité terrain.

Même constat pour U301 : le site porte surtout unité, activité, PTAH/UF et alias, alors que le MASTER contient une richesse terrain beaucoup plus grande.

## 4. Catalogue canonique des champs attendus

Le catalogue est désormais enregistré dans Supabase : `stip_place_dictionary_field_defs`.

Il contient actuellement **38 possibilités de champs**, réparties en :
- Identification : nom officiel, alias/nom de mission, activité, codes, PTAH, UF.
- Localisation : bâtiment, étage, aile/secteur, unité/salle/chambre, plages de chambres, adresse, transport/arrêt.
- Accès & transport : itinéraire, ascenseur, badge/accès pro, lit/fauteuil/brancard, accessibilité, repère d’arrivée, proximité, organisation interne, raccourcis/liaisons.
- Contacts & horaires : téléphone public, contacts internes, secrétariat, e-mail, horaires d’accueil, rendez-vous, équipe/fonctions utiles, contacts associés, collaborations.
- Opérationnel : vigilance, particularités, prise en charge particulière, informations temporaires, notes terrain, repères/équipements.
- Qualité : source/date/niveau de confirmation.

Dans l’interface professionnelle, une destination peut afficher ces champs comme **Renseigné** ou **À compléter**.

Dans le PDF généré et lors du partage, un champ vide ou un simple marqueur `À compléter / À confirmer / À préciser / Information non renseignée` est **omis automatiquement**. Le PDF montre donc uniquement ce qui est réellement renseigné.

## 5. Catégories à prévoir dans le futur dictionnaire

Le futur modèle doit pouvoir afficher, quand elles existent et sont utiles :
- localisation : bâtiment, étage, entrée, aile, secteur, unité, salle/chambre ;
- identifiants : PTAH, UF, codes de mission et alias ;
- accès : ascenseur, badge, passerelle, itinéraire, sens de circulation ;
- transport : restriction lit/fauteuil, accès professionnel, clé, procédure particulière ;
- contact : téléphone, accueil, secrétariat, mail ;
- temporalité : horaires utiles ;
- repérage : signalétique, repère visuel, raccourci terrain ;
- distinction : activité, fonction ou différence avec un service voisin/homonyme ;
- contacts associés / collaboration seulement s’ils aident réellement à joindre, identifier ou atteindre la destination ;
- utilité terrain ;
- source, date et niveau de confirmation.

## 6. Règle de densité

Aucune information opérationnelle utile ne doit être retirée pour gagner de la place.

Une entrée de service ne doit cependant pas monopoliser visuellement plus d’environ une demi-page. Le futur template doit résoudre les cas riches par :
- hiérarchie de champs ;
- lignes compactes ;
- blocs courts ;
- deux colonnes si utile ;
- regroupement de contacts ;
- libellés abrégés mais non ambigus ;
- continuation structurée uniquement si nécessaire.

La richesse de U301/U302 doit devenir **compressible**, pas disparaître.
