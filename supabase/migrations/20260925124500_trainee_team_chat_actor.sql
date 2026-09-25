-- Allow a selected trainee session to participate in the shared Fauteuils chat.
alter table public.stip_messages
  alter column sender_agent_id drop not null;

alter table public.stip_messages
  add column if not exists sender_stagiaire_key text;

alter table public.stip_conversations
  alter column created_by_agent_id drop not null;

alter table public.stip_conversations
  add column if not exists created_by_stagiaire_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='stip_messages_sender_present'
  ) then
    alter table public.stip_messages
      add constraint stip_messages_sender_present
      check (sender_agent_id is not null or nullif(trim(sender_stagiaire_key),'') is not null);
  end if;
  if not exists (
    select 1 from pg_constraint where conname='stip_conversations_creator_present'
  ) then
    alter table public.stip_conversations
      add constraint stip_conversations_creator_present
      check (created_by_agent_id is not null or nullif(trim(created_by_stagiaire_key),'') is not null);
  end if;
end $$;

create index if not exists stip_messages_sender_stagiaire_idx
  on public.stip_messages(sender_stagiaire_key)
  where sender_stagiaire_key is not null;
