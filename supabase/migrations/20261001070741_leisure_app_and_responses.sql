begin;
create table public.stip_leisure_events (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 120),
 description text not null default '', location text not null default '', time_label text not null default '',
 dates date[] not null check(cardinality(dates) between 1 and 24),
 family text not null check(family in ('brancardage','hors_brancardage')),
 organizer_agent_id uuid references public.agents(id), status text not null default 'active' check(status in ('active','cancelled')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stip_leisure_responses (
 event_id uuid not null references public.stip_leisure_events(id), agent_id uuid not null references public.agents(id),
 selected_dates date[] not null default '{}', declined boolean not null, revision integer not null,
 updated_at timestamptz not null default now(), primary key(event_id,agent_id),
 check((declined and cardinality(selected_dates)=0) or (not declined and cardinality(selected_dates)>0))
);
create index stip_leisure_events_family_idx on public.stip_leisure_events(family,status);
create index stip_leisure_events_organizer_idx on public.stip_leisure_events(organizer_agent_id);
create index stip_leisure_responses_agent_idx on public.stip_leisure_responses(agent_id);
alter table public.stip_leisure_events enable row level security;
alter table public.stip_leisure_responses enable row level security;
revoke all on public.stip_leisure_events,public.stip_leisure_responses from public,anon,authenticated;
grant select,insert,update on public.stip_leisure_events,public.stip_leisure_responses to service_role;
-- Custom STIP sessions are authenticated by the edge function, never by browser grants.
create function public.stip_leisure_respond(p_event uuid,p_agent uuid,p_family text,p_revision integer,p_dates date[],p_declined boolean)
returns void language plpgsql security invoker set search_path=public as $$
declare e public.stip_leisure_events; ds date[];
begin
 select * into e from public.stip_leisure_events where id=p_event for update;
 if not found or e.family<>p_family then raise exception 'SORTIE_INTROUVABLE'; end if;
 if e.status<>'active' or not exists(select 1 from unnest(e.dates) d where d>=(now() at time zone 'Europe/Paris')::date) then raise exception 'SORTIE_FERMEE'; end if;
 if e.revision<>p_revision then raise exception 'DATES_MODIFIEES'; end if;
 select coalesce(array_agg(distinct d order by d),'{}'::date[]) into ds from unnest(p_dates) d;
 if p_declined is null or (p_declined and cardinality(ds)>0) or (not p_declined and cardinality(ds)=0) or not ds<@e.dates then raise exception 'CHOIX_INVALIDE'; end if;
 if exists(select 1 from unnest(ds) d where d<(now() at time zone 'Europe/Paris')::date and not exists(select 1 from public.stip_leisure_responses r where r.event_id=p_event and r.agent_id=p_agent and d=any(r.selected_dates))) then raise exception 'DATE_PASSEE'; end if;
 insert into public.stip_leisure_responses(event_id,agent_id,selected_dates,declined,revision)
 values(p_event,p_agent,ds,p_declined,e.revision)
 on conflict(event_id,agent_id) do update set selected_dates=excluded.selected_dates,declined=excluded.declined,revision=excluded.revision,updated_at=now();
end $$;
revoke all on function public.stip_leisure_respond(uuid,uuid,text,integer,date[],boolean) from public,anon,authenticated;
grant execute on function public.stip_leisure_respond(uuid,uuid,text,integer,date[],boolean) to service_role;
create function public.stip_leisure_save(p_id uuid,p_actor uuid,p_admin boolean,p_family text,p_expected integer,p_title text,p_description text,p_location text,p_time text,p_dates date[],p_status text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare e public.stip_leisure_events; ds date[]; result uuid;
begin
 select coalesce(array_agg(distinct d order by d),'{}'::date[]) into ds from unnest(p_dates) d;
 if cardinality(ds) not between 1 and 24 or p_status not in ('active','cancelled') then raise exception 'SORTIE_INVALIDE'; end if;
 if p_id is null then
  if p_actor is null or exists(select 1 from unnest(ds) d where d<(now() at time zone 'Europe/Paris')::date) then raise exception 'SORTIE_INVALIDE'; end if;
  insert into public.stip_leisure_events(title,description,location,time_label,dates,family,organizer_agent_id)
  values(p_title,p_description,p_location,p_time,ds,p_family,p_actor) returning id into result;
 else
  select * into e from public.stip_leisure_events where id=p_id for update;
  if not found or e.family<>p_family then raise exception 'SORTIE_INTROUVABLE'; end if;
  if not coalesce(p_admin,false) and e.organizer_agent_id is distinct from p_actor then raise exception 'ACCES_ORGANISATEUR_REQUIS'; end if;
  if e.revision<>p_expected then raise exception 'DATES_MODIFIEES'; end if;
  if exists(select 1 from unnest(ds) d where d<(now() at time zone 'Europe/Paris')::date and not d=any(e.dates)) then raise exception 'DATE_PASSEE'; end if;
  update public.stip_leisure_events set title=p_title,description=p_description,location=p_location,time_label=p_time,dates=ds,status=p_status,
   revision=revision+case when ds<>e.dates then 1 else 0 end,updated_at=now() where id=p_id;
  result:=p_id;
 end if;
 return result;
end $$;
revoke all on function public.stip_leisure_save(uuid,uuid,boolean,text,integer,text,text,text,text,date[],text) from public,anon,authenticated;
grant execute on function public.stip_leisure_save(uuid,uuid,boolean,text,integer,text,text,text,text,date[],text) to service_role;
insert into public.stip_leisure_events(id,title,description,location,time_label,dates,family)
values('ed7f0000-2026-4000-8000-000000000010','Foot indoor · octobre',
 'Choisis toutes les dates auxquelles tu souhaites participer. Le lieu et le créneau seront fixés selon le nombre de joueurs. Proposition reprise du tableau de l’équipe.',
 'Parilly ou Groupama Stadium · lieu à fixer','Créneau à fixer selon le nombre de joueurs',
 array['2026-10-09','2026-10-16','2026-10-23','2026-10-30']::date[],'brancardage');
commit;
