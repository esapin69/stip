comment on table public.stip_agent_agenda_items is
  'Agenda personnel STIP. Les imports GPT/automatisations doivent utiliser public.stip_import_event(jsonb). Un trigger serveur normalise aussi les écritures directes.';

comment on column public.stip_agent_agenda_items.feedback_question is
  'Question personnalisée facultative, courte et formulée pour une réponse Oui/Non. Le retour universel fonctionne sans elle.';
