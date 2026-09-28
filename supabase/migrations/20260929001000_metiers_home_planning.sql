update public.stip_access_role_presets
set permissions =
  coalesce(permissions, '{}'::jsonb)
  || jsonb_build_object(
    'planning_personal', true,
    'messages', true,
    'team_chat_mode', 'write'
  ),
  updated_at = now()
where role_key = 'metiers';

update public.stip_access_profiles
set permissions =
  coalesce(permissions, '{}'::jsonb)
  || jsonb_build_object(
    'planning_personal', true,
    'messages', true,
    'team_chat_mode', 'write'
  )
where role_key = 'metiers';
