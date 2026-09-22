-- Admins inherit every active STIP application automatically.
-- Existing explicit choices can still be changed later; newly activated apps default to enabled.

create or replace function public.stip_sync_active_app_to_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  level_patch jsonb := '{}'::jsonb;
begin
  if new.active is distinct from true then
    return new;
  end if;

  if new.level_mode in ('visitor_pro','pro_only') then
    level_patch := jsonb_build_object(new.app_key, 'pro');
  end if;

  update public.stip_access_role_presets
  set permissions =
        (coalesce(permissions, '{}'::jsonb) || jsonb_build_object(new.app_key, true))
        || jsonb_build_object(
             '__levels',
             coalesce(permissions->'__levels', '{}'::jsonb) || level_patch
           ),
      updated_at = now()
  where role_key = 'admin';

  update public.stip_access_profiles
  set permissions =
        (coalesce(permissions, '{}'::jsonb) || jsonb_build_object(new.app_key, true))
        || jsonb_build_object(
             '__levels',
             coalesce(permissions->'__levels', '{}'::jsonb) || level_patch
           ),
      permission_overrides =
        (coalesce(permission_overrides, '{}'::jsonb) || jsonb_build_object(new.app_key, true))
        || jsonb_build_object(
             '__levels',
             coalesce(permission_overrides->'__levels', '{}'::jsonb) || level_patch
           ),
      updated_at = now()
  where role_key = 'admin';

  return new;
end;
$$;

drop trigger if exists stip_app_catalog_admin_defaults on public.stip_app_catalog;
create trigger stip_app_catalog_admin_defaults
after insert or update of active, level_mode
on public.stip_app_catalog
for each row
when (new.active = true)
execute function public.stip_sync_active_app_to_admin();

do $$
declare
  app_patch jsonb;
  level_patch jsonb;
begin
  select
    coalesce(jsonb_object_agg(app_key, true), '{}'::jsonb),
    coalesce(
      jsonb_object_agg(app_key, 'pro') filter (where level_mode in ('visitor_pro','pro_only')),
      '{}'::jsonb
    )
  into app_patch, level_patch
  from public.stip_app_catalog
  where active = true;

  update public.stip_access_role_presets
  set permissions =
        (coalesce(permissions, '{}'::jsonb) || app_patch)
        || jsonb_build_object(
             '__levels',
             coalesce(permissions->'__levels', '{}'::jsonb) || level_patch
           ),
      updated_at = now()
  where role_key = 'admin';

  update public.stip_access_profiles
  set permissions =
        (coalesce(permissions, '{}'::jsonb) || app_patch)
        || jsonb_build_object(
             '__levels',
             coalesce(permissions->'__levels', '{}'::jsonb) || level_patch
           ),
      permission_overrides =
        (coalesce(permission_overrides, '{}'::jsonb) || app_patch)
        || jsonb_build_object(
             '__levels',
             coalesce(permission_overrides->'__levels', '{}'::jsonb) || level_patch
           ),
      updated_at = now()
  where role_key = 'admin';
end
$$;
