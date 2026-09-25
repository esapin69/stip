-- STIP shared trainee access: session-scoped identity + trainee inbox.
alter table public.stip_access_sessions
  add column if not exists selected_stagiaire_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stip_access_sessions_selected_stagiaire_key_len'
  ) then
    alter table public.stip_access_sessions
      add constraint stip_access_sessions_selected_stagiaire_key_len
      check (selected_stagiaire_key is null or char_length(selected_stagiaire_key) between 1 and 120);
  end if;
end $$;

create table if not exists public.stip_trainee_messages (
  id uuid primary key default gen_random_uuid(),
  target_key text not null,
  sender_agent_id uuid not null references public.agents(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.stip_trainee_messages enable row level security;

create index if not exists stip_trainee_messages_target_created_idx
  on public.stip_trainee_messages (target_key, created_at desc);

insert into public.stip_access_role_presets(role_key,label,permissions,updated_at)
values (
  'stagiaire',
  'Stagiaire',
  '{
    "planning_personal": true,
    "messages": true,
    "places": true,
    "team_chat_mode": "write",
    "trainee_session": true,
    "__levels": {
      "planning_personal": "visitor",
      "places": "visitor"
    }
  }'::jsonb,
  now()
)
on conflict (role_key) do update set
  label = excluded.label,
  permissions = excluded.permissions,
  updated_at = now();
