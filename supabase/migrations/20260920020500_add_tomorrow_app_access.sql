insert into public.stip_app_catalog(
  app_key,label,help,route_key,level_mode,sort_order,active,updated_at
)
values (
  'tomorrow',
  'Pour demain',
  'Prépare les jours à venir à partir du planning, des événements et des notes personnelles.',
  'index.html?quick=tomorrow',
  'single',
  25,
  true,
  now()
)
on conflict (app_key) do update set
  label=excluded.label,
  help=excluded.help,
  route_key=excluded.route_key,
  level_mode=excluded.level_mode,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

update public.stip_access_role_presets
set permissions = jsonb_set(
      coalesce(permissions,'{}'::jsonb),
      '{tomorrow}',
      to_jsonb(coalesce((permissions->>'planning_personal')::boolean,false)),
      true
    ),
    updated_at = now();

update public.stip_access_profile_models
set permissions = jsonb_set(
      coalesce(permissions,'{}'::jsonb),
      '{tomorrow}',
      to_jsonb(coalesce((permissions->>'planning_personal')::boolean,false)),
      true
    ),
    updated_at = now();

update public.stip_access_profiles
set permissions = jsonb_set(
      coalesce(permissions,'{}'::jsonb),
      '{tomorrow}',
      to_jsonb(coalesce((permissions->>'planning_personal')::boolean,false)),
      true
    ),
    permission_overrides = jsonb_set(
      coalesce(permission_overrides,'{}'::jsonb),
      '{tomorrow}',
      to_jsonb(coalesce((permissions->>'planning_personal')::boolean,false)),
      true
    ),
    updated_at = now();

comment on column public.stip_access_profiles.permissions is
  'Permissions effectives STIP. Le droit tomorrow pilote l’application Pour demain.';
