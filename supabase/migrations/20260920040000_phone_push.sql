create table if not exists public.stip_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stip_push_subscriptions_agent_idx on public.stip_push_subscriptions(agent_id,active);
alter table public.stip_push_subscriptions enable row level security;
revoke all on table public.stip_push_subscriptions from anon,authenticated;

create or replace function public.stip_push_vapid_private()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'stip_push_vapid_private'
  order by created_at desc
  limit 1
$$;
revoke all on function public.stip_push_vapid_private() from public,anon,authenticated;
grant execute on function public.stip_push_vapid_private() to service_role;
comment on function public.stip_push_vapid_private() is 'Service-role only access to the Web Push VAPID private key stored in Supabase Vault.';
