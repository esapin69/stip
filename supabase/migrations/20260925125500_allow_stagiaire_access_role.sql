-- Allow the shared session-scoped trainee access role.
alter table public.stip_access_profiles
  drop constraint if exists stip_access_profiles_role_key_check;

alter table public.stip_access_profiles
  add constraint stip_access_profiles_role_key_check
  check (role_key = any (array[
    'visiteur'::text,
    'stagiaire'::text,
    'brancardier'::text,
    'chef_equipe'::text,
    'responsable'::text,
    'cadre'::text,
    'admin'::text
  ]));
