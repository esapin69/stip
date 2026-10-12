# GHE ↔ Render — préparation sans déploiement

Ce dossier prépare un **service Render distinct** pour GHE/STIP, sans changer le site actuel.

## État initial

- Branche de préparation : `render-ghe-standby` (non fusionnée).
- Service Render : **pas encore créé**.
- Accès à Supabase/GHE : **désactivé**.
- Aucune mission, automatisation ou appel sortant.
- Aucune clé API, donnée d'agent, message ou dossier médical.
- Un seul endpoint autorisé : `GET /health`; toutes les autres requêtes donnent 404.

## Vérification locale

Node 20+ :

```sh
node --test render-ghe/handler.test.mjs
PORT=10000 node render-ghe/server.mjs
```

## Configuration envisagée seulement après validation explicite des quotas/coûts

Render web service : `ghe-render-bridge`
- Source : `https://github.com/esapin69/stip`
- Branche : `render-ghe-standby`
- Runtime : Node
- Region : Frankfurt
- Plan : Free
- Build : `node --version`
- Start : `node render-ghe/server.mjs`
- Auto-deploy : no
- Secrets : none

**Important :** provisionner un service utilise des heures gratuites, du temps de build et de la bande passante. Ne pas lancer sa création avant accord explicite. Les dépassements de quotas peuvent avoir des conséquences (suspension ou facturation selon la ressource et le compte).

## Plan de responsabilité à définir avec l'utilisateur

Aucune tâche n'est présumée. Les futures fonctions devront être définies une par une. Ne jamais transmettre de données personnelles hospitalières au bridge avant validation sécurité (RGPD, rôle du sous-traitant, hébergement, authentification, minimisation et accès). Ne pas rediriger le site web vers Render sans contrat validé et tests.

Ce dossier ne modifie aucun mécanisme existant de STIP : les fonctions Supabase restent la source opérationnelle.
