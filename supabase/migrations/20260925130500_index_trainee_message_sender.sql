-- Cover trainee message sender FK used by management/audit lookups.
create index if not exists stip_trainee_messages_sender_agent_idx
  on public.stip_trainee_messages(sender_agent_id);
