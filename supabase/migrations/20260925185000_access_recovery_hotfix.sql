-- Hotfix accès STIP — 2026-09-25
-- Objectifs:
-- 1. conserver la vérification déterministe du code 6 chiffres via code_key;
-- 2. réaligner acces_site avec les profils STIP actifs;
-- 3. garantir Responsable aux chefs sans leur ouvrir Accès/Admin;
-- 4. purger les échecs temporaires accumulés pendant l'incident réseau.

create or replace function public.stip_verify_code(p_code text)
returns table(profile_id uuid, agent_id uuid, permissions jsonb, active boolean)
language sql
security definer
set search_path to 'public','extensions'
as $function$
  select p.id, p.agent_id, p.permissions, p.active
  from public.stip_access_profiles p
  where p.code_key = encode(digest(trim(coalesce(p_code,'')), 'sha256'), 'hex')
    and p.active = true
  limit 1;
$function$;

update public.agents a
set acces_site = true,
    updated_at = now()
from public.stip_access_profiles p
where p.agent_id = a.id
  and p.active = true
  and a.actif = true
  and coalesce(a.acces_site,false) = false;

update public.stip_access_profiles
set permissions =
      jsonb_set(
        jsonb_set(
          jsonb_set(coalesce(permissions,'{}'::jsonb), '{responsable}', 'true'::jsonb, true),
          '{access_manage}', 'false'::jsonb, true
        ),
        '{admin}', 'false'::jsonb, true
      ),
    permission_overrides =
      jsonb_set(
        jsonb_set(
          jsonb_set(coalesce(permission_overrides,'{}'::jsonb), '{responsable}', 'true'::jsonb, true),
          '{access_manage}', 'false'::jsonb, true
        ),
        '{admin}', 'false'::jsonb, true
      ),
    active = true,
    updated_at = now()
where role_key = 'chef_equipe';

delete from public.stip_access_attempts
where success = false;
