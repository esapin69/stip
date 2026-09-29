create or replace function public.stip_apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  access_days integer := 90;
  session_grace_days integer := 30;
  notification_days integer := 30;
  message_days integer := 15;
  import_days integer := 7;
  n_activity bigint := 0;
  n_sessions bigint := 0;
  n_notifications bigint := 0;
  n_messages bigint := 0;
  n_admin_import bigint := 0;
  n_contact_import bigint := 0;
  n_onboarding_import bigint := 0;
begin
  select retention_days into access_days
  from public.stip_retention_policies
  where policy_key='access_history' and enabled;

  select retention_days into session_grace_days
  from public.stip_retention_policies
  where policy_key='expired_session_grace' and enabled;

  select retention_days into notification_days
  from public.stip_retention_policies
  where policy_key='notifications' and enabled;

  select retention_days into message_days
  from public.stip_retention_policies
  where policy_key='messages' and enabled;

  select retention_days into import_days
  from public.stip_retention_policies
  where policy_key='import_rows' and enabled;

  if exists (select 1 from public.stip_retention_policies where policy_key='access_history' and enabled) then
    delete from public.stip_access_activity
    where occurred_at < now() - make_interval(days => access_days);
    get diagnostics n_activity = row_count;
  end if;

  if exists (select 1 from public.stip_retention_policies where policy_key='expired_session_grace' and enabled) then
    delete from public.stip_access_sessions
    where created_at < now() - make_interval(days => access_days)
      and (
        (revoked_at is not null and revoked_at < now() - make_interval(days => session_grace_days))
        or expires_at < now() - make_interval(days => session_grace_days)
      );
    get diagnostics n_sessions = row_count;
  end if;

  if exists (select 1 from public.stip_retention_policies where policy_key='notifications' and enabled) then
    delete from public.stip_notifications
    where created_at < now() - make_interval(days => notification_days);
    get diagnostics n_notifications = row_count;
  end if;

  if exists (select 1 from public.stip_retention_policies where policy_key='messages' and enabled) then
    delete from public.stip_messages
    where created_at < now() - make_interval(days => message_days)
      and not (
        coalesce(payload->'wheelchair'->>'status','') = 'active'
        and coalesce(payload->'wheelchair'->>'type','spot') = 'spot'
      );
    get diagnostics n_messages = row_count;
  end if;

  if exists (select 1 from public.stip_retention_policies where policy_key='import_rows' and enabled) then
    delete from public.admin_import_rows
    where created_at < now() - make_interval(days => import_days);
    get diagnostics n_admin_import = row_count;

    delete from public.contact_import_rows
    where created_at < now() - make_interval(days => import_days);
    get diagnostics n_contact_import = row_count;

    delete from public.stip_onboarding_import_rows
    where created_at < now() - make_interval(days => import_days);
    get diagnostics n_onboarding_import = row_count;
  end if;

  return jsonb_build_object(
    'access_activity', n_activity,
    'access_sessions', n_sessions,
    'notifications', n_notifications,
    'messages', n_messages,
    'admin_import_rows', n_admin_import,
    'contact_import_rows', n_contact_import,
    'onboarding_import_rows', n_onboarding_import,
    'ran_at', now()
  );
end;
$$;

update public.stip_retention_policies
set description='Messages éphémères 15 jours. Les signalements fauteuil actifs sont conservés sans expiration automatique jusqu’à résolution.',
    updated_at=now()
where policy_key='messages';
