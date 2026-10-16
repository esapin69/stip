-- Personnalisation des alertes terrain, persistée par agent.
create table if not exists public.stip_message_notification_rules (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  wheelchair_buildings text[] not null default array['neuro','cardio','hfme','a4','b14','ghe']::text[],
  wheelchair_work_only boolean not null default false,
  team_chat_work_only boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint stip_message_notification_buildings_valid
    check (wheelchair_buildings <@ array['neuro','cardio','hfme','a4','b14','ghe']::text[])
);
alter table public.stip_message_notification_rules enable row level security;
revoke all on public.stip_message_notification_rules from anon, authenticated;
comment on table public.stip_message_notification_rules is
  'Préférences individuelles des notifications du chat équipe et des signalements fauteuils; écriture uniquement via stip-messages et session STIP.';

