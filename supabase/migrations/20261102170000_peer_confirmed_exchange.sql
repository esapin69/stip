-- STIP GHE - self-reported colleague exchanges, independent of the official cadre approval flow.
-- Migration is prepared on a feature branch; do not apply to production until approved.
create table if not exists public.stip_peer_exchanges (
  id uuid primary key default gen_random_uuid(),
  requester_agent_id uuid not null references public.agents(id),
  target_agent_id uuid not null references public.agents(id),
  pairs jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','completed','refused','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  applied_at timestamptz,
  constraint stip_peer_exchanges_distinct_people check (requester_agent_id <> target_agent_id),
  constraint stip_peer_exchanges_pairs_valid check (jsonb_typeof(pairs) = 'array' and jsonb_array_length(pairs) between 1 and 93)
);
create index if not exists stip_peer_exchanges_requester_idx on public.stip_peer_exchanges(requester_agent_id,created_at desc);
create index if not exists stip_peer_exchanges_target_pending_idx on public.stip_peer_exchanges(target_agent_id,created_at desc) where status='pending';
alter table public.stip_peer_exchanges enable row level security;
revoke all on public.stip_peer_exchanges from public, anon, authenticated;
grant select,insert,update on public.stip_peer_exchanges to service_role;

create or replace function public.stip_peer_exchange_decide(
  p_exchange_id uuid,
  p_target_agent_id uuid,
  p_accept boolean
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  e public.stip_peer_exchanges%rowtype;
  pair jsonb;
  am public.planning%rowtype;
  bm public.planning%rowtype;
  ax public.planning%rowtype;
  bx public.planning%rowtype;
  changes jsonb := '[]'::jsonb;
  item jsonb;
  v_my date;
  v_their date;
  v_code text;
  v_new text;
  v_id uuid;
  v_now timestamptz := now();
  v_keys text[] := array[]::text[];
  v_key text;
  v_modified integer := 0;
begin
  select * into e from public.stip_peer_exchanges
    where id=p_exchange_id for update;
  if not found then raise exception 'ECHANGE_INTROUVABLE'; end if;
  if e.target_agent_id is distinct from p_target_agent_id then
    raise exception 'ACCES_ECHANGE_REFUSE';
  end if;
  if e.status <> 'pending' then raise exception 'ECHANGE_DEJA_TRAITE'; end if;
  if not exists(select 1 from public.agents where id=e.requester_agent_id and actif=true)
     or not exists(select 1 from public.agents where id=e.target_agent_id and actif=true)
  then raise exception 'AGENT_INACTIF'; end if;
  if not coalesce(p_accept,false) then
    update public.stip_peer_exchanges set status='refused',responded_at=v_now
      where id=e.id;
    return jsonb_build_object('status','refused','count',0);
  end if;

  -- Lock all candidate planning rows in deterministic order before checking snapshots.
  perform 1 from public.planning
   where agent_id in (e.requester_agent_id,e.target_agent_id)
     and date in (
       select (x.value->>'my_date')::date from jsonb_array_elements(e.pairs) x
       union
       select (x.value->>'their_date')::date from jsonb_array_elements(e.pairs) x
     )
   order by agent_id,date for update;

  for pair in select value from jsonb_array_elements(e.pairs) loop
    v_my := (pair->>'my_date')::date;
    v_their := (pair->>'their_date')::date;
    if v_my is null or v_their is null then raise exception 'DATES_ECHANGE_INCOMPLETES'; end if;
    select * into am from public.planning where agent_id=e.requester_agent_id and date=v_my limit 1;
    select * into bm from public.planning where agent_id=e.target_agent_id and date=v_my limit 1;
    if am.id is null or bm.id is null then raise exception 'PLANNING_DATE_MANQUANTE'; end if;
    if upper(coalesce(am.code,'')) <> upper(coalesce(pair->>'my_code',''))
      or upper(coalesce(bm.code,'')) <> upper(coalesce(pair->>'their_other_code',case when v_my=v_their then pair->>'their_code' else '' end))
    then raise exception 'PLANNING_MODIFIE_DEPUIS_PROPOSITION'; end if;

    if v_my=v_their then
      changes := changes || jsonb_build_array(
        jsonb_build_object('id',am.id,'agent',e.requester_agent_id,'other',e.target_agent_id,'date',v_my,'before',am.code,'after',bm.code),
        jsonb_build_object('id',bm.id,'agent',e.target_agent_id,'other',e.requester_agent_id,'date',v_my,'before',bm.code,'after',am.code)
      );
    else
      select * into ax from public.planning where agent_id=e.requester_agent_id and date=v_their limit 1;
      select * into bx from public.planning where agent_id=e.target_agent_id and date=v_their limit 1;
      if ax.id is null or bx.id is null then raise exception 'PLANNING_DATE_MANQUANTE'; end if;
      if upper(coalesce(ax.code,'')) <> upper(coalesce(pair->>'my_other_code',''))
        or upper(coalesce(bx.code,'')) <> upper(coalesce(pair->>'their_code',''))
      then raise exception 'PLANNING_MODIFIE_DEPUIS_PROPOSITION'; end if;
      if upper(coalesce(am.code,'')) not in ('M','J','J4','S','N')
        or upper(coalesce(bx.code,'')) not in ('M','J','J4','S','N')
        or upper(coalesce(ax.code,'')) not in ('R','RH')
        or upper(coalesce(bm.code,'')) not in ('R','RH')
      then raise exception 'JOURS_CROISES_INCOMPATIBLES'; end if;
      changes := changes || jsonb_build_array(
        jsonb_build_object('id',am.id,'agent',e.requester_agent_id,'other',e.target_agent_id,'date',v_my,'before',am.code,'after',bm.code),
        jsonb_build_object('id',bm.id,'agent',e.target_agent_id,'other',e.requester_agent_id,'date',v_my,'before',bm.code,'after',am.code),
        jsonb_build_object('id',ax.id,'agent',e.requester_agent_id,'other',e.target_agent_id,'date',v_their,'before',ax.code,'after',bx.code),
        jsonb_build_object('id',bx.id,'agent',e.target_agent_id,'other',e.requester_agent_id,'date',v_their,'before',bx.code,'after',ax.code)
      );
    end if;
  end loop;
  -- A dated slot cannot appear twice in one batch; a partial exchange is forbidden.
  for item in select value from jsonb_array_elements(changes) loop
    v_key := (item->>'agent') || ':' || (item->>'date');
    if v_key=any(v_keys) then raise exception 'JOURS_CHEVAUCHANTS'; end if;
    v_keys := array_append(v_keys,v_key);
  end loop;
  for item in select value from jsonb_array_elements(changes) loop
    v_code := item->>'before';
    v_new := item->>'after';
    if coalesce(v_code,'') = coalesce(v_new,'') then continue; end if;
    v_id := (item->>'id')::uuid;
    update public.stip_planning_change_history set effective=false,
      superseded_at=v_now,superseded_reason='peer_exchange'
      where agent_id=(item->>'agent')::uuid
        and change_date=(item->>'date')::date and effective=true;
    update public.planning set code=v_new where id=v_id and code is not distinct from v_code;
    if not found then raise exception 'PLANNING_MODIFIE_PENDANT_VALIDATION'; end if;
    insert into public.stip_planning_change_history(
      planning_id,agent_id,counterpart_agent_id,change_date,base_code,
      previous_code,new_code,scenario,change_kind,applied_by_agent_id,
      applied_at,effective,metadata
    ) select p.id,p.agent_id,(item->>'other')::uuid,p.date,
      coalesce(p.source_value,v_code),v_code,v_new,
      'peer_recorded_exchange','peer_accepted_exchange',p_target_agent_id,
      v_now,true,jsonb_build_object('peer_exchange_id',e.id,'peer_confirmed',true)
    from public.planning p where p.id=v_id;
    v_modified := v_modified+1;
  end loop;
  if v_modified=0 then raise exception 'AUCUN_CHANGEMENT'; end if;
  update public.stip_peer_exchanges
    set status='completed',responded_at=v_now,applied_at=v_now where id=e.id;
  return jsonb_build_object('status','completed','count',v_modified,'applied_at',v_now);
end;
$$;
revoke all on function public.stip_peer_exchange_decide(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.stip_peer_exchange_decide(uuid,uuid,boolean) to service_role;
