-- Notes de réunion : application personnelle privée, distincte de l'ancienne app "notes".
create table if not exists public.stip_meeting_notes (
  id uuid primary key default gen_random_uuid(),
  owner_agent_id uuid not null references public.agents(id) on delete cascade,
  meeting_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 160),
  participants text not null default '' check (char_length(participants) <= 1000),
  notes text not null default '' check (char_length(notes) <= 20000),
  decisions text not null default '' check (char_length(decisions) <= 10000),
  actions text not null default '' check (char_length(actions) <= 10000),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stip_meeting_notes_owner_date_idx
  on public.stip_meeting_notes(owner_agent_id, status, meeting_at desc);

alter table public.stip_meeting_notes enable row level security;
revoke all on table public.stip_meeting_notes from public, anon, authenticated;
grant select, insert, update on table public.stip_meeting_notes to service_role;

comment on table public.stip_meeting_notes is
  'Notes de réunion privées par agent. Accès uniquement via stip-meeting-notes et une session STIP valide.';

insert into public.stip_app_catalog(app_key,label,help,route_key,level_mode,sort_order,active)
values (
  'meeting_notes',
  'Notes de réunion',
  'Préparer, saisir et retrouver ses notes de réunion personnelles.',
  'meeting-notes.html',
  'single',
  92,
  true
)
on conflict (app_key) do update set
  label=excluded.label,
  help=excluded.help,
  route_key=excluded.route_key,
  level_mode=excluded.level_mode,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

update public.stip_access_role_presets
set permissions=jsonb_set(coalesce(permissions,'{}'::jsonb),'{meeting_notes}','true'::jsonb,true),
    updated_at=now()
where role_key in ('brancardier','chef_equipe','responsable','cadre','admin','metiers');

update public.stip_access_profile_models
set permissions=jsonb_set(coalesce(permissions,'{}'::jsonb),'{meeting_notes}','true'::jsonb,true),
    updated_at=now()
where role_key in ('brancardier','chef_equipe','responsable','cadre','admin','metiers');

update public.stip_access_profiles
set permissions=jsonb_set(coalesce(permissions,'{}'::jsonb),'{meeting_notes}','true'::jsonb,true),
    updated_at=now()
where role_key in ('brancardier','chef_equipe','responsable','cadre','admin','metiers');
