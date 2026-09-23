# Importer un événement STIP

Tous les nouveaux événements génériques doivent passer par le point d’entrée Supabase `public.stip_import_event(jsonb)`.

Ce point d’entrée est la règle commune, quel que soit le compte ChatGPT, l’automatisation ou l’outil qui réalise l’import. Il valide et normalise l’événement, évite les doublons grâce à `import_key`, et active par défaut le retour universel après l’événement.

## Contrat minimal

Champs attendus :

- `agent_id` ou `agent_source_key`
- `title`
- `event_date` au format `YYYY-MM-DD`
- `all_day`, `start_time`, `end_time` si connus
- `location` si connue
- `source_type` pour identifier l’origine
- `import_key` : identifiant stable de la source, fortement recommandé
- `feedback_enabled` : `true` par défaut
- `feedback_question` : facultative, courte, et formulée pour une réponse Oui/Non

Les autres champs utiles sont `body`, `importance`, `event_kind` et `icon`.

Exemple SQL :

```sql
select public.stip_import_event(
  jsonb_build_object(
    'agent_source_key', 'agent_exemple',
    'title', 'Journée découverte bloc opératoire',
    'event_date', '2026-10-14',
    'start_time', '09:00',
    'end_time', '12:00',
    'location', 'Bloc opératoire',
    'source_type', 'gpt_import',
    'import_key', 'gpt:journee-bloc:2026-10-14:agent_exemple',
    'feedback_question', 'Cette journée doit-elle entraîner une action particulière ?'
  )
);
```

## Retour après événement

Sans aucune personnalisation, STIP utilise toujours le formulaire universel :

1. présence : absent / présent avec problème / tout s’est bien déroulé ;
2. note sur 5 uniquement si l’agent était présent ;
3. « Une suite est-elle nécessaire ? » ;
4. une question personnalisée facultative si `feedback_question` existe ;
5. une précision facultative.

Le retour devient disponible une heure après l’heure de fin connue. Si seule l’heure de début est connue, STIP utilise cette heure + 1 h. Pour un événement sans horaire, le retour devient disponible à 19:00 le jour de fin.

Pour une visite médicale, ne jamais demander ni stocker de diagnostic, résultat médical ou détail clinique dans le retour.
