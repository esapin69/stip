create or replace function public.stip_leisure_save(p_id uuid,p_actor uuid,p_admin boolean,p_family text,p_expected integer,p_title text,p_description text,p_location text,p_time text,p_dates date[],p_status text)
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
  if not coalesce(p_admin,false) and (p_actor is null or e.organizer_agent_id is distinct from p_actor) then raise exception 'ACCES_ORGANISATEUR_REQUIS'; end if;
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

insert into public.stip_app_catalog(app_key,label,help,route_key,level_mode,sort_order,active) values('leisure','Sorties & loisirs','Proposer une sortie, choisir plusieurs dates ou décliner ; accès limité à son équipe.','sorties-loisirs.html','single',36,true) on conflict(app_key) do update set label=excluded.label,help=excluded.help,route_key=excluded.route_key,active=true;
