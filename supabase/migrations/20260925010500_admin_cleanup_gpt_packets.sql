create table if not exists public.admin_cleanup_gpt_packets (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.admin_cleanup_cases(id) on delete cascade,
  token_hash text not null unique,
  packet_text text not null,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  open_count integer not null default 0
);

create index if not exists admin_cleanup_gpt_packets_expiry_idx
  on public.admin_cleanup_gpt_packets(expires_at);

alter table public.admin_cleanup_gpt_packets enable row level security;
revoke all on public.admin_cleanup_gpt_packets from anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'admin-cleanup-gpt-packet-purge'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'admin-cleanup-gpt-packet-purge',
    '17 */6 * * *',
    'delete from public.admin_cleanup_gpt_packets where expires_at < now();'
  );
end
$$;
