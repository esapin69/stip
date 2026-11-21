# Fauteuils Pro — préparation commerciale (21 novembre 2026)

## Statut exact

**Vitrine + démonstration interactive : préparées sur une branche isolée, non publiées sur Render.**
**SaaS exploitable par un établissement tiers : non prêt.** La préparation d'une démo vendable ne remplace ni l'isolation des données, ni les contrats, ni la validation sécurité.

## Parcours livrés

- \`presentation.html\` : page vitrine premium avec valeur d'usage, parcours métier, présentation et CTA de démonstration. Sans témoignage, chiffre de rentabilité ou affiliation fabriqués.
- \`demo.html\` + \`demo.js\` + \`premium.css\` : simulation 100 % locale, sans API professionnelle. Recherche, filtres, création, clôture et remise à zéro. Tous les lieux, profils et messages sont inventés.
- \`index.html\` + \`fauteuil-premium.css\` : refonte de l'interface professionnelle **sans modifier** \`fauteuil-app.js\`, les identifiants, les sessions, les permissions ou les données métier.
- \`commercial-quality.test.mjs\`, \`commercial-browser.mjs\` : tests d'intégrité et d'interface. Si une CI est déclenchée, contrôler son résultat et les logs.
- Aucun nouveau site Render, aucune modification de Supabase, GHE ou de l'accès réel; pas de paiement ni de fonctionnalité de vente activée.

## Séparation des données

**Démo :**
- Les données fictives sont initialisées en mémoire JavaScript et perdues au rechargement.
- Aucun compte, aucun stockage, aucun envoi vers un serveur, aucune lecture de \`stip_messages\`, \`stip_places\` ou de l'environnement GHE.
- Aucun nom de patient, d'agent réel ou d'établissement réel.
- Ne pas recopier les noms des services, discussions ou données d'un établissement dans la vitrine ou la démo.

**Espace professionnel existant :**
- Continue à dépendre des API \`stip-access\` et \`stip-messages\` du projet Supabase STIP.
- Continue à charger le moteur \`team-chat.js\` et les styles historiques depuis \`ghe.esapin.com\`.
- Ne doit pas être présenté comme une version multi-établissement / multiclient. Les autorisations des agents restent propres à l'instance d'origine.
- Affichage de l'expiration « 48 h » côté site, à vérifier sur toutes les surfaces avec le backend en place avant publication.

## Vrais prérequis avant un contrat de vente ou une mise en service tierce

1. **Isolation par client :** instance / projet tenant séparé ou architecture multitenant démontrablement cloisonnée, tests d'accès croisés et contrôle systématique des identifiants.
2. **Indépendance :** aucun code dynamique/feuille de style d'un site hospitalier tiers chargé au runtime commercial. Extraire, auditer, versionner et tester localement le moteur UI.
3. **Confidentialité :** finalité, minimisation, effacement, journaux, habilitations; processus de suppression et d'export, gestion des incidents et sauvegardes. Ne jamais permettre la saisie de données patient sans cadre adapté.
4. **RGPD :** identifier responsable de traitement et sous-traitant, définir DPA, registre, durées, localisation, sous-traitants, mentions de confidentialité et droits. Faire valider les clauses avant vente.
5. **Exploitation :** disponibilité, monitoring, journalisation sans PII, sauvegardes, restauration testée, revue des dépendances, contrôle des quotas et coûts, procédures support.
6. **Commercial :** identité et propriété intellectuelle clarifiées; disponibilité du nom/du domaine; CGV/CGU et facturation; offre et prix *validés*, coordonnées commerciales *approuvées avant publication*; circuit de contractualisation.
7. **Tests métier réels :** appareil mobile, accessibilité, erreurs 401/403, droits et comptes professionnels, notifications, déplacements entre sites, mises à jour du catalogue, expiration 48 h, périmètre exact de la purge et protection du Chat équipe.
8. **Validation d'établissement :** si le produit est issu d'un développement réalisé pour ou dans un établissement, vérifier les autorisations et droits avant toute réutilisation commerciale de données, code, marque ou infrastructure.

## Déploiement

Ne pas fusionner cette branche dans \`main\` GHE. Ne pas basculer l'ancien service \`fauteuils-entraide-ghe\` sans validation explicite de la version et test authentifié. La branche de préparation sert à vérification / prévisualisation.

Toute mise en ligne publique, exposition de coordonnées, collecte de prospect ou dépense requiert la validation du propriétaire. Les nouvelles pages peuvent être publiées sur une destination commerciale isolée quand ces conditions sont remplies.

## Coût

Aucune nouvelle ressource cloud ou abonnement n'est créée par ce travail. **Coût fixe additionnel engagé = 0 €**. La facture liée aux quotas, à l'hébergement commercial futur, au domaine, au support et aux obligations d'exploitation n'est pas chiffrée ici et ne doit pas être considérée comme garantie à 0 €.
