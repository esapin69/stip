alter table public.stip_access_profiles
  drop constraint if exists stip_access_profiles_role_key_check;

alter table public.stip_access_profiles
  add constraint stip_access_profiles_role_key_check
  check (
    role_key = any (
      array[
        'visiteur'::text,
        'stagiaire'::text,
        'brancardier'::text,
        'chef_equipe'::text,
        'responsable'::text,
        'cadre'::text,
        'metiers'::text,
        'admin'::text
      ]
    )
  );

insert into public.stip_access_role_presets(role_key,label,permissions,updated_at)
values (
  'metiers',
  'Autres métiers',
  jsonb_build_object(
    'places', true,
    '__levels', jsonb_build_object('places','visitor')
  ),
  now()
)
on conflict (role_key) do update
set label = excluded.label,
    permissions = excluded.permissions,
    updated_at = now();
