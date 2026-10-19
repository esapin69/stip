# Fauteuil GHE — site autonome

Site dédié au module Fauteuils : `fauteuil.esapin.com` (domaine cible).

## Fonctionnement

- Interface autonome sans onglets Planning, Chat équipe ou DM.
- Le moteur canonique `team-chat.js/.css` est chargé depuis `https://ghe.esapin.com/`.
- L’Edge Function existante `stip-messages` reste la source unique pour signalements, recherches, récupération, réactions et notifications.
- Connexion par code GHE existant via `stip-access` ; session stockée pour le seul domaine courant.
- Session, permissions `messages`, famille `brancardage` et identité stagiaire vérifiées côté backend.
- Pas de donnée locale métier, pas d’IA ni de nouveaux services Supabase, aucun nouveau secret.

## Prévisualisation et mise en ligne

Une fois la PR fusionnée et le workflow GitHub Pages de GHE terminé, l’interface est disponible sur
`https://ghe.esapin.com/fauteuil/`. **Ne pas annoncer le domaine cible comme actif avant vérification DNS/TLS et déploiement.**

### Domaine autonome : points de configuration distincts

Le dépôt `esapin69/stip` publie déjà GitHub Pages sous `ghe.esapin.com` (son fichier `CNAME` unique).
**Ne surtout pas changer ce `CNAME` : cela casserait GHE.**

Pour servir l’adresse exacte `https://fauteuil.esapin.com/` avec GitHub Pages et conserver GHE :
1. Utiliser un dépôt public GitHub Pages **distinct** dédié à Fauteuil (par ex. `esapin69/fauteuil`) avec les fichiers de ce dossier à sa racine, en conservant les URLs absolues du moteur partagé GHE.
2. Dans ce dépôt autonome, ajouter un `CNAME` contenant uniquement `fauteuil.esapin.com` et activer GitHub Pages / HTTPS pour cette source.
3. Dans la zone **Cloudflare** du domaine `esapin.com`, enregistrer `fauteuil` comme `CNAME` vers `esapin69.github.io`, en mode **DNS only**.
4. Vérifier TLS, identité GHE, famille brancardage et affichage/récupération en lecture/écriture avec un profil de test habilité.

Le connecteur GitHub actuellement disponible ne propose pas la création de dépôt ni la configuration GitHub Pages. Aucune opération sur la zone Cloudflare n’a été effectuée. Cette PR n’effectue donc **aucun changement DNS ni publication du sous-domaine**.

### Contrôles

- Vérifier qu’aucun écran Fauteuil n’est visible sans session active.
- Code incorrect, session expirée, profil non habilité, familles hors brancardage.
- Stagiaire avec sélection du profil.
- Réutilisation des mêmes messages avec le lien GHE, sans duplication.
- Envoi, recherche, prise partielle, confirmation de disparition, mise à jour.
- Clavier sur mobile, tablette portrait et ordinateur.
- Absence de contenu nominatif de patients et politiques d’accès revalidées côté serveur.

Le dossier n’a aucun lien technique avec Vercel ou les autres projets Supabase.
