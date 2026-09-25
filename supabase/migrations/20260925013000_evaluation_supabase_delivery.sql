alter table public.stip_evaluation_last
  add column if not exists pdf_storage_bucket text,
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_storage_name text;

alter table public.stip_evaluation_history
  add column if not exists pdf_storage_bucket text,
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_storage_name text;

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
    service_since,agent_nom,agent_prenom,agent_matricule,signature_date,pdf_sha256,model_version,version,
    pdf_storage_bucket,pdf_storage_path,pdf_storage_name
  )
  values(
    l.agent_id,now(),l.evaluation_date,l.observation_log,l.decision,null,null,null,
    snap,p_closed_by,l.case_id,l.evaluator_agent_id,l.evaluator_name,l.criteria,l.service,l.grade,
    l.service_since,l.agent_nom,l.agent_prenom,l.agent_matricule,l.signature_date,p_pdf->>'sha256',l.model_version,next_version,
    p_pdf->>'storage_bucket',p_pdf->>'storage_path',p_pdf->>'name'
  )
  on conflict(agent_id) do update set
    closed_at=excluded.closed_at,evaluation_date=excluded.evaluation_date,observations=excluded.observations,
    decision=excluded.decision,drive_file_id=null,drive_url=null,drive_name=null,
    snapshot=excluded.snapshot,closed_by_agent_id=excluded.closed_by_agent_id,
    case_id=excluded.case_id,evaluator_agent_id=excluded.evaluator_agent_id,evaluator_name=excluded.evaluator_name,
    criteria=excluded.criteria,service=excluded.service,grade=excluded.grade,service_since=excluded.service_since,
    agent_nom=excluded.agent_nom,agent_prenom=excluded.agent_prenom,agent_matricule=excluded.agent_matricule,
    signature_date=excluded.signature_date,pdf_sha256=excluded.pdf_sha256,model_version=excluded.model_version,
    version=excluded.version,pdf_storage_bucket=excluded.pdf_storage_bucket,
    pdf_storage_path=excluded.pdf_storage_path,pdf_storage_name=excluded.pdf_storage_name
  returning * into r;

  insert into public.stip_evaluation_history(
    agent_id,closed_at,evaluation_date,observations,decision,drive_file_id,drive_url,drive_name,
    snapshot,closed_by_agent_id,created_at,case_id,evaluator_agent_id,evaluator_name,criteria,service,grade,
    service_since,agent_nom,agent_prenom,agent_matricule,signature_date,pdf_sha256,model_version,version,
    pdf_storage_bucket,pdf_storage_path,pdf_storage_name
  )
  values(
    r.agent_id,r.closed_at,r.evaluation_date,r.observations,r.decision,null,null,null,
    r.snapshot,r.closed_by_agent_id,r.created_at,r.case_id,r.evaluator_agent_id,r.evaluator_name,r.criteria,r.service,r.grade,
    r.service_since,r.agent_nom,r.agent_prenom,r.agent_matricule,r.signature_date,r.pdf_sha256,r.model_version,r.version,
    r.pdf_storage_bucket,r.pdf_storage_path,r.pdf_storage_name
  );

  delete from public.stip_evaluation_live where agent_id=p_agent_id;
  return r;
end $$;

revoke execute on function public.stip_eval_finalize_reserve(uuid,text) from public, anon, authenticated;
revoke execute on function public.stip_eval_finalize_release(uuid,text) from public, anon, authenticated;
revoke execute on function public.stip_eval_live_close(uuid,uuid,jsonb) from public, anon, authenticated;

grant execute on function public.stip_eval_finalize_reserve(uuid,text) to service_role;
grant execute on function public.stip_eval_finalize_release(uuid,text) to service_role;
grant execute on function public.stip_eval_live_close(uuid,uuid,jsonb) to service_role;
