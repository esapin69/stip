create table if not exists public.stip_operational_broadcasts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.stip_conversations(id) on delete cascade,
  created_by_agent_id uuid not null references public.agents(id) on delete cascade,
  category text not null default 'info',
  title text,
  body text not null,
  location_text text,
  quantity integer check (quantity is null or quantity >= 0),
  status text not null default 'active' check (status in ('active','resolved','expired')),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists stip_operational_broadcasts_status_idx on public.stip_operational_broadcasts(status,updated_at desc);
alter table public.stip_operational_broadcasts enable row level security;
revoke all on table public.stip_operational_broadcasts from anon,authenticated;
