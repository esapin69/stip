create table if not exists public.stip_push_config (
  singleton boolean primary key default true check (singleton),
  public_key text not null,
  created_at timestamptz not null default now()
);
alter table public.stip_push_config enable row level security;
revoke all on table public.stip_push_config from anon,authenticated;

create or replace function public.stip_initialize_push_keys(p_public text,p_private text)
returns boolean
language plpgsql
security definer
set search_path=public,vault
as $$
begin
  if exists(select 1 from public.stip_push_config where singleton=true) then
    return false;
  end if;
  perform vault.create_secret(p_private,'stip_push_vapid_private','STIP Web Push VAPID private key');
  insert into public.stip_push_config(singleton,public_key) values(true,p_public);
  return true;
end
$$;
revoke all on function public.stip_initialize_push_keys(text,text) from public,anon,authenticated;
grant execute on function public.stip_initialize_push_keys(text,text) to service_role;
