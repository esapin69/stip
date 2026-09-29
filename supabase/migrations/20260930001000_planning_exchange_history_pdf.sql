-- Planning STIP: preserve the cadre baseline, apply approved site changes to the effective code,
-- and retain a durable exchange/change history for exports and future information engines.

create table if not exists public.stip_planning_change_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid null references public.stip_change_requests(id) on delete set null,
  planning_id uuid null references public.planning(id) on delete set null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  counterpart_agent_id uuid null references public.agents(id) on delete set null,
  change_date date not null,
  base_code text null,
  previous_code text null,
  new_code text null,
  scenario text not null,
  change_kind text not null default 'planning_update',
  applied_by_agent_id uuid null references public.agents(id) on delete set null,
  applied_by_email text null,
  applied_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists stip_planning_change_history_agent_date_idx
  on public.stip_planning_change_history(agent_id, change_date desc, applied_at desc);

create index if not exists stip_planning_change_history_request_idx
  on public.stip_planning_change_history(request_id);

create unique index if not exists stip_planning_change_history_request_agent_date_uidx
  on public.stip_planning_change_history(request_id, agent_id, change_date)
  where request_id is not null;

alter table public.stip_planning_change_history enable row level security;
revoke all on table public.stip_planning_change_history from anon, authenticated;

create or replace function public.stip_apply_change_request(
  p_request_id uuid,
  p_actor_agent_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.stip_change_requests%rowtype;
  p_req public.planning%rowtype;
  p_target public.planning%rowtype;
  v_now timestamptz := now();
  v_target_snapshot text;
begin
  select *
    into r
  from public.stip_change_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'DEMANDE_INTROUVABLE';
  end if;

  if r.applied_at is not null then
    return jsonb_build_object(
      'ok', true,
      'already_applied', true,
      'request_id', r.id,
      'applied_at', r.applied_at
    );
  end if;

  if r.status not in ('awaiting_responsible','submitted') then
    raise exception 'DEMANDE_NON_APPLICABLE';
  end if;

  if r.scenario = 'simple_change' then
    if r.date_from is null or nullif(btrim(coalesce(r.desired_code,'')),'') is null then
      raise exception 'DONNEES_CHANGEMENT_INCOMPLETES';
    end if;

    select *
      into p_req
    from public.planning
    where agent_id = r.requester_agent_id
      and date = r.date_from
    order by imported_at desc
    limit 1
    for update;

    if not found then
      raise exception 'PLANNING_DEMANDEUR_INTROUVABLE';
    end if;

    if nullif(btrim(coalesce(r.requester_code,'')),'') is not null
       and upper(coalesce(p_req.code,'')) <> upper(coalesce(r.requester_code,'')) then
      raise exception 'PLANNING_MODIFIE_DEPUIS_DEMANDE';
    end if;

    update public.planning
    set code = r.desired_code
    where id = p_req.id;

    insert into public.stip_planning_change_history(
      request_id, planning_id, agent_id, change_date,
      base_code, previous_code, new_code, scenario, change_kind,
      applied_by_agent_id, applied_by_email, applied_at,
      metadata
    ) values (
      r.id, p_req.id, r.requester_agent_id, r.date_from,
      p_req.source_value, p_req.code, r.desired_code, r.scenario, 'simple_change',
      p_actor_agent_id, p_actor_email, v_now,
      jsonb_build_object(
        'requester_code_snapshot', r.requester_code,
        'source_sheet', p_req.source_sheet,
        'source_row', p_req.source_row,
        'source_column', p_req.source_column
      )
    )
    on conflict do nothing;

  elsif r.scenario = 'same_day_exchange' then
    if r.date_from is null or r.target_agent_id is null then
      raise exception 'DONNEES_ECHANGE_INCOMPLETES';
    end if;

    select *
      into p_req
    from public.planning
    where agent_id = r.requester_agent_id
      and date = r.date_from
    order by imported_at desc
    limit 1
    for update;

    if not found then
      raise exception 'PLANNING_DEMANDEUR_INTROUVABLE';
    end if;

    select *
      into p_target
    from public.planning
    where agent_id = r.target_agent_id
      and date = r.date_from
    order by imported_at desc
    limit 1
    for update;

    if not found then
      raise exception 'PLANNING_CIBLE_INTROUVABLE';
    end if;

    if nullif(btrim(coalesce(r.requester_code,'')),'') is not null
       and upper(coalesce(p_req.code,'')) <> upper(coalesce(r.requester_code,'')) then
      raise exception 'PLANNING_DEMANDEUR_MODIFIE_DEPUIS_DEMANDE';
    end if;

    v_target_snapshot := nullif(btrim(coalesce(r.context->>'target_shift','')),'');
    if v_target_snapshot is not null
       and upper(coalesce(p_target.code,'')) <> upper(v_target_snapshot) then
      raise exception 'PLANNING_CIBLE_MODIFIE_DEPUIS_DEMANDE';
    end if;

    update public.planning set code = p_target.code where id = p_req.id;
    update public.planning set code = p_req.code where id = p_target.id;

    insert into public.stip_planning_change_history(
      request_id, planning_id, agent_id, counterpart_agent_id, change_date,
      base_code, previous_code, new_code, scenario, change_kind,
      applied_by_agent_id, applied_by_email, applied_at,
      metadata
    ) values
    (
      r.id, p_req.id, r.requester_agent_id, r.target_agent_id, r.date_from,
      p_req.source_value, p_req.code, p_target.code, r.scenario, 'exchange',
      p_actor_agent_id, p_actor_email, v_now,
      jsonb_build_object(
        'side','requester',
        'source_sheet',p_req.source_sheet,
        'source_row',p_req.source_row,
        'source_column',p_req.source_column
      )
    ),
    (
      r.id, p_target.id, r.target_agent_id, r.requester_agent_id, r.date_from,
      p_target.source_value, p_target.code, p_req.code, r.scenario, 'exchange',
      p_actor_agent_id, p_actor_email, v_now,
      jsonb_build_object(
        'side','target',
        'source_sheet',p_target.source_sheet,
        'source_row',p_target.source_row,
        'source_column',p_target.source_column
      )
    )
    on conflict do nothing;

  else
    raise exception 'SCENARIO_NON_AUTOMATIQUE';
  end if;

  update public.stip_change_requests
  set status = 'completed',
      official_state = 'completed',
      decision_actor_email = coalesce(p_actor_email, decision_actor_email),
      decided_at = coalesce(decided_at, v_now),
      completed_at = coalesce(completed_at, v_now),
      applied_at = v_now,
      updated_at = v_now,
      context = coalesce(context,'{}'::jsonb) || jsonb_build_object(
        'planning_applied', true,
        'planning_applied_at', v_now
      )
  where id = r.id
  returning * into r;

  return jsonb_build_object(
    'ok', true,
    'already_applied', false,
    'request_id', r.id,
    'scenario', r.scenario,
    'status', r.status,
    'official_state', r.official_state,
    'applied_at', r.applied_at
  );
end;
$$;

revoke all on function public.stip_apply_change_request(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.stip_apply_change_request(uuid,uuid,text) to service_role;
