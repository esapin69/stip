alter table public.stip_official_document_templates
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

update public.stip_official_document_templates
set storage_bucket='stip-pdf-assets',
    storage_path='official-templates/evaluation-2026.pdf'
where document_key='evaluation_2026' and active=true
  and (storage_bucket is null or storage_path is null);

alter table public.stip_evaluation_history add column if not exists version integer;
alter table public.stip_evaluation_last add column if not exists version integer;

with ranked as (
  select history_id, row_number() over(partition by agent_id order by closed_at, created_at, history_id) as rn
  from public.stip_evaluation_history
)
update public.stip_evaluation_history h
set version=r.rn
from ranked r
where h.history_id=r.history_id and h.version is null;

update public.stip_evaluation_last l
set version=coalesce((
  select max(h.version) from public.stip_evaluation_history h where h.agent_id=l.agent_id
),1)
where l.version is null;

alter table public.stip_evaluation_history alter column version set default 1;
alter table public.stip_evaluation_last alter column version set default 1;
update public.stip_evaluation_history set version=1 where version is null;
update public.stip_evaluation_last set version=1 where version is null;
alter table public.stip_evaluation_history alter column version set not null;
alter table public.stip_evaluation_last alter column version set not null;

create unique index if not exists stip_evaluation_history_agent_version_uidx
  on public.stip_evaluation_history(agent_id,version);

create table if not exists public.stip_evaluation_signature_requests(
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  case_id uuid null,
  requested_by_agent_id uuid not null references public.agents(id),
  evaluator_agent_id uuid not null references public.agents(id),
  token_hash text not null unique,
  content_hash text not null,
  status text not null default 'EN_ATTENTE'
    check (status in ('EN_ATTENTE','SIGNE','ANNULE','EXPIRE','FINALISE')),
  expires_at timestamptz not null,
  signed_at timestamptz null,
  cancelled_at timestamptz null,
  finalized_at timestamptz null,
  signature_bucket text null,
  signature_path text null,
  signature_sha256 text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stip_eval_signature_agent_idx
  on public.stip_evaluation_signature_requests(agent_id,created_at desc);
alter table public.stip_evaluation_signature_requests enable row level security;

create table if not exists public.stip_evaluation_finalization_locks(
  agent_id uuid primary key references public.agents(id) on delete cascade,
  lock_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.stip_evaluation_finalization_locks enable row level security;

create or replace function public.stip_eval_finalize_reserve(p_agent_id uuid,p_token text)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
declare touched integer;
begin
  delete from public.stip_evaluation_finalization_locks
  where agent_id=p_agent_id and expires_at < now();

  insert into public.stip_evaluation_finalization_locks(agent_id,lock_token,expires_at)
  values(p_agent_id,p_token,now()+interval '10 minutes')
  on conflict(agent_id) do nothing;

  get diagnostics touched = row_count;
  if touched <> 1 then
    raise exception 'EVALUATION_VERROUILLEE_FINALISATION';
  end if;
  return true;
end $$;

create or replace function public.stip_eval_finalize_release(p_agent_id uuid,p_token text)
returns boolean
language plpgsql
security definer
set search_path='public'
as $$
begin
  delete from public.stip_evaluation_finalization_locks
  where agent_id=p_agent_id and lock_token=p_token;
  return true;
end $$;

create or replace function public.stip_eval_live_close(p_agent_id uuid, p_closed_by uuid, p_pdf jsonb)
returns public.stip_evaluation_last
language plpgsql
security definer
set search_path='public'
as $$
declare
  l public.stip_evaluation_live;
  r public.stip_evaluation_last;
  next_version integer;
  snap jsonb;
begin
  select * into l from public.stip_evaluation_live where agent_id=p_agent_id for update;
  if l.agent_id is null then raise exception 'EVALUATION_VIVANTE_INTROUVABLE'; end if;

  select coalesce(max(version),0)+1 into next_version
  from public.stip_evaluation_history where agent_id=p_agent_id;

  snap := to_jsonb(l) || jsonb_build_object(
    'version',next_version,
    'signatures',coalesce(p_pdf->'signatures','{}'::jsonb)
  );

  insert into public.stip_evaluation_last(
    agent_id,closed_at,evaluation_date,observations,decision,drive_file_id,drive_url,drive_name,
    snapshot,closed_by_agent_id,case_id,evaluator_agent_id,evaluator_name,criteria,service,grade,
    service_since,agent_nom,agent_prenom,agent_matricule,signature_date,pdf_sha256,model_version,version
  )
  values(
    l.agent_id,now(),l.evaluation_date,l.observation_log,l.decision,p_pdf->>'file_id',p_pdf->>'url',p_pdf->>'name',
    snap,p_closed_by,l.case_id,l.evaluator_agent_id,l.evaluator_name,l.criteria,l.service,l.grade,
    l.service_since,l.agent_nom,l.agent_prenom,l.agent_matricule,l.signature_date,p_pdf->>'sha256',l.model_version,next_version
  )
  on conflict(agent_id) do update set
    closed_at=excluded.closed_at,evaluation_date=excluded.evaluation_date,observations=excluded.observations,
    decision=excluded.decision,drive_file_id=excluded.drive_file_id,drive_url=excluded.drive_url,
    drive_name=excluded.drive_name,snapshot=excluded.snapshot,closed_by_agent_id=excluded.closed_by_agent_id,
    case_id=excluded.case_id,evaluator_agent_id=excluded.evaluator_agent_id,evaluator_name=excluded.evaluator_name,
    criteria=excluded.criteria,service=excluded.service,grade=excluded.grade,service_since=excluded.service_since,
    agent_nom=excluded.agent_nom,agent_prenom=excluded.agent_prenom,agent_matricule=excluded.agent_matricule,
    signature_date=excluded.signature_date,pdf_sha256=excluded.pdf_sha256,model_version=excluded.model_version,
    version=excluded.version
  returning * into r;

  insert into public.stip_evaluation_history(
    agent_id,closed_at,evaluation_date,observations,decision,drive_file_id,drive_url,drive_name,
    snapshot,closed_by_agent_id,created_at,case_id,evaluator_agent_id,evaluator_name,criteria,service,grade,
    service_since,agent_nom,agent_prenom,agent_matricule,signature_date,pdf_sha256,model_version,version
  )
  values(
    r.agent_id,r.closed_at,r.evaluation_date,r.observations,r.decision,r.drive_file_id,r.drive_url,r.drive_name,
    r.snapshot,r.closed_by_agent_id,r.created_at,r.case_id,r.evaluator_agent_id,r.evaluator_name,r.criteria,r.service,r.grade,
    r.service_since,r.agent_nom,r.agent_prenom,r.agent_matricule,r.signature_date,r.pdf_sha256,r.model_version,r.version
  );

  delete from public.stip_evaluation_live where agent_id=p_agent_id;
  return r;
end $$;
