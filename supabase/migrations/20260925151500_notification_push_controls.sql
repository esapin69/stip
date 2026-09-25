create table if not exists public.stip_notification_types (
  event_key text primary key,
  label text not null,
  description text not null default '',
  push_enabled boolean not null default false,
  default_user_enabled boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.agents(id) on delete set null
);

create table if not exists public.stip_notification_preferences (
  agent_id uuid not null references public.agents(id) on delete cascade,
  event_key text not null references public.stip_notification_types(event_key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key(agent_id,event_key)
);

create index if not exists stip_notification_preferences_agent_idx
  on public.stip_notification_preferences(agent_id,event_key);

alter table public.stip_notification_types enable row level security;
alter table public.stip_notification_preferences enable row level security;
revoke all on table public.stip_notification_types from anon,authenticated;
revoke all on table public.stip_notification_preferences from anon,authenticated;

insert into public.stip_notification_types(
  event_key,label,description,push_enabled,default_user_enabled,active,sort_order
)
values(
  'dm_received',
  'Message privé (DM)',
  'Notification native quand un nouveau message privé ou de groupe est reçu. Chaque personne peut la désactiver pour elle-même.',
  true,
  true,
  true,
  10
)
on conflict (event_key) do update set
  label=excluded.label,
  description=excluded.description,
  default_user_enabled=excluded.default_user_enabled,
  active=true,
  sort_order=excluded.sort_order,
  updated_at=now();
