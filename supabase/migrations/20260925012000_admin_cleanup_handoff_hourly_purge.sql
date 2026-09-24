-- Resynchronise les passerelles GPT temporaires avec la règle métier :
-- expiration à 2 h, puis suppression au prochain passage horaire.

create or replace function public.admin_cleanup_purge_handoffs()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint := 0;
begin
  delete from public.admin_cleanup_handoffs
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.admin_cleanup_purge_handoffs() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'admin-cleanup-handoff-purge'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'admin-cleanup-handoff-purge',
    '17 * * * *',
    'select public.admin_cleanup_purge_handoffs();'
  );
end
$$;
