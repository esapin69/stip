-- GPT handoff temporaire pour Admin cleanup
create table if not exists public.admin_cleanup_handoffs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.admin_cleanup_cases(id) on delete cascade,
  token_hash text not null unique,
  payload jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  view_count integer not null default 0,
  last_viewed_at timestamptz
);

create index if not exists admin_cleanup_handoffs_expiry_idx
  on public.admin_cleanup_handoffs(expires_at);

alter table public.admin_cleanup_handoffs enable row level security;
revoke all on public.admin_cleanup_handoffs from anon, authenticated;

create or replace function public.admin_cleanup_purge_handoffs()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n bigint := 0;
begin
  delete from public.admin_cleanup_handoffs
  where expires_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_cleanup_purge_handoffs() from public, anon, authenticated;


do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='admin-cleanup-handoff-purge'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'admin-cleanup-handoff-purge',
    '37 3 * * *',
    'select public.admin_cleanup_purge_handoffs();'
  );
end
$$;
