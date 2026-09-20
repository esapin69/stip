-- Communication STIP: Demander à STIP + Messages
insert into public.stip_app_catalog(app_key,label,help,route_key,level_mode,sort_order,active,updated_at)
values
  ('dialog','Demander à STIP','MINI : réponses avec les données usuelles autorisées. MAXI : données organisationnelles étendues, toujours filtrées côté serveur.','index.html?quick=notifications','visitor_pro',26,true,now()),
  ('messages','Messages','Échanger avec les autres professionnels disposant d’un accès STIP.','index.html?quick=notifications','single',27,true,now())
on conflict (app_key) do update set
  label=excluded.label, help=excluded.help, route_key=excluded.route_key,
  level_mode=excluded.level_mode, sort_order=excluded.sort_order, active=true, updated_at=now();

do $$
declare
  r record;
  p jsonb;
  lvl text;
  enabled boolean;
begin
  for r in select role_key,permissions from public.stip_access_role_presets loop
    enabled := r.role_key <> 'visiteur';
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    p := coalesce(r.permissions,'{}'::jsonb);
    p := jsonb_set(p,'{dialog}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{messages}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{__levels}',coalesce(p->'__levels','{}'::jsonb),true);
    p := jsonb_set(p,'{__levels,dialog}',to_jsonb(lvl),true);
    update public.stip_access_role_presets set permissions=p,updated_at=now() where role_key=r.role_key;
  end loop;

  for r in select model_key,role_key,permissions from public.stip_access_profile_models loop
    enabled := r.role_key <> 'visiteur';
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    p := coalesce(r.permissions,'{}'::jsonb);
    p := jsonb_set(p,'{dialog}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{messages}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{__levels}',coalesce(p->'__levels','{}'::jsonb),true);
    p := jsonb_set(p,'{__levels,dialog}',to_jsonb(lvl),true);
    update public.stip_access_profile_models set permissions=p,updated_at=now() where model_key=r.model_key;
  end loop;

  for r in select id,role_key,permissions,permission_overrides from public.stip_access_profiles loop
    enabled := r.role_key <> 'visiteur';
    lvl := case when r.role_key in ('chef_equipe','responsable','admin') then 'pro' else 'visitor' end;
    p := coalesce(r.permissions,'{}'::jsonb);
    p := jsonb_set(p,'{dialog}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{messages}',to_jsonb(enabled),true);
    p := jsonb_set(p,'{__levels}',coalesce(p->'__levels','{}'::jsonb),true);
    p := jsonb_set(p,'{__levels,dialog}',to_jsonb(lvl),true);
    update public.stip_access_profiles
       set permissions=p,
           permission_overrides=jsonb_set(
             jsonb_set(
               jsonb_set(coalesce(r.permission_overrides,'{}'::jsonb),'{dialog}',to_jsonb(enabled),true),
               '{messages}',to_jsonb(enabled),true
             ),
             '{__levels}',
             coalesce(r.permission_overrides->'__levels',p->'__levels','{}'::jsonb) || jsonb_build_object('dialog',lvl),
             true
           ),
           updated_at=now()
     where id=r.id;
  end loop;
end $$;

create table if not exists public.stip_message_profiles (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  nickname text,
  notification_preview boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.stip_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group','broadcast')),
  direct_key text unique,
  title text,
  created_by_agent_id uuid not null references public.agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.stip_conversation_members (
  conversation_id uuid not null references public.stip_conversations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key(conversation_id,agent_id)
);

create table if not exists public.stip_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.stip_conversations(id) on delete cascade,
  sender_agent_id uuid not null references public.agents(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists stip_conversation_members_agent_idx on public.stip_conversation_members(agent_id,conversation_id);
create index if not exists stip_messages_conversation_created_idx on public.stip_messages(conversation_id,created_at desc);
create index if not exists stip_conversations_last_message_idx on public.stip_conversations(last_message_at desc);

alter table public.stip_message_profiles enable row level security;
alter table public.stip_conversations enable row level security;
alter table public.stip_conversation_members enable row level security;
alter table public.stip_messages enable row level security;
revoke all on table public.stip_message_profiles from anon,authenticated;
revoke all on table public.stip_conversations from anon,authenticated;
revoke all on table public.stip_conversation_members from anon,authenticated;
revoke all on table public.stip_messages from anon,authenticated;
