create table if not exists public.stip_agent_identity_aliases (
  incoming_source_key text primary key,
  canonical_agent_id uuid not null references public.agents(id) on delete cascade,
  public_nom text not null,
  public_prenom text not null,
  suppress_public_email boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stip_agent_identity_aliases enable row level security;

comment on table public.stip_agent_identity_aliases is
'Private canonical identity mapping used server-side so incoming documents can match an agent without exposing a non-public name in application outputs.';

create or replace function public.stip_identity_alias_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stip_identity_alias_touch on public.stip_agent_identity_aliases;
create trigger stip_identity_alias_touch
before update on public.stip_agent_identity_aliases
for each row execute function public.stip_identity_alias_touch();

create index if not exists stip_agent_identity_aliases_agent_idx
on public.stip_agent_identity_aliases(canonical_agent_id)
where active;
