-- Pour demain: MINI/MAXI + notes partagées
update public.stip_app_catalog
set level_mode = 'visitor_pro',
    help = 'MINI : journée personnelle et notes reçues. MAXI : organisation, effectifs et notes aux autres agents.',
    updated_at = now()
where app_key = 'tomorrow';

do $$
declare
  r record;
  next_permissions jsonb;
  lvl text;
begin
  for r in select role_key, permissions from public.stip_access_role_presets loop
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    next_permissions := jsonb_set(coalesce(r.permissions,'{}'::jsonb), '{__levels}', coalesce(r.permissions->'__levels','{}'::jsonb), true);
    next_permissions := jsonb_set(next_permissions, '{__levels,tomorrow}', to_jsonb(lvl), true);
    update public.stip_access_role_presets
       set permissions = next_permissions, updated_at = now()
     where role_key = r.role_key;
  end loop;

  for r in select model_key, role_key, permissions from public.stip_access_profile_models loop
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    next_permissions := jsonb_set(coalesce(r.permissions,'{}'::jsonb), '{__levels}', coalesce(r.permissions->'__levels','{}'::jsonb), true);
    next_permissions := jsonb_set(next_permissions, '{__levels,tomorrow}', to_jsonb(lvl), true);
    update public.stip_access_profile_models
       set permissions = next_permissions, updated_at = now()
     where model_key = r.model_key;
  end loop;

  for r in select id, role_key, permissions, permission_overrides from public.stip_access_profiles loop
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    next_permissions := jsonb_set(coalesce(r.permissions,'{}'::jsonb), '{__levels}', coalesce(r.permissions->'__levels','{}'::jsonb), true);
    next_permissions := jsonb_set(next_permissions, '{__levels,tomorrow}', to_jsonb(lvl), true);
    update public.stip_access_profiles
       set permissions = next_permissions,
           permission_overrides = jsonb_set(
             jsonb_set(coalesce(r.permission_overrides,'{}'::jsonb), '{__levels}', coalesce(r.permission_overrides->'__levels', next_permissions->'__levels','{}'::jsonb), true),
             '{__levels,tomorrow}', to_jsonb(lvl), true
           ),
           updated_at = now()
     where id = r.id;
  end loop;
end $$;

create table if not exists public.stip_tomorrow_notes (
  id uuid primary key default gen_random_uuid(),
  owner_agent_id uuid not null references public.agents(id) on delete cascade,
  author_agent_id uuid not null references public.agents(id) on delete cascade,
  target_date date not null,
  title text not null check (char_length(title) between 1 and 160),
  body text,
  note_time time,
  note_kind text not null default 'personal' check (note_kind in ('personal','assigned')),
  status text not null default 'active' check (status in ('active','done','archived')),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stip_tomorrow_notes_owner_date_idx
  on public.stip_tomorrow_notes(owner_agent_id,target_date,status,sort_order,created_at);
create index if not exists stip_tomorrow_notes_author_date_idx
  on public.stip_tomorrow_notes(author_agent_id,target_date,created_at desc);

alter table public.stip_tomorrow_notes enable row level security;
revoke all on table public.stip_tomorrow_notes from anon, authenticated;
comment on table public.stip_tomorrow_notes is
  'Notes de préparation Pour demain. Accès applicatif uniquement via la fonction stip-tomorrow et la session STIP.';
