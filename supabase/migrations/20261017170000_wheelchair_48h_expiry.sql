begin;

-- Fauteuil signals are ephemeral field information, not durable conversations.
-- One fixed limit from original publication: subsequent confirmations do NOT renew it.
create or replace function public.stip_purge_expired_wheelchairs()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $wheelchairs$
declare
  cutoff timestamptz := now() - interval '48 hours';
  deleted_count bigint := 0;
  affected_conversations uuid[];
begin
  with recursive expired as (
    select m.id, m.conversation_id
    from public.stip_messages m
    join public.stip_conversations c on c.id = m.conversation_id
    where c.kind = 'team_chat'
      and m.payload ? 'wheelchair'
      and m.created_at <= cutoff
    union
    select child.id, child.conversation_id
    from public.stip_messages child
    join expired parent
      on child.conversation_id = parent.conversation_id
     and child.payload->>'reply_to_id' = parent.id::text
  ), removed as (
    delete from public.stip_messages m
    where m.id in (select id from expired)
    returning m.conversation_id
  )
  select count(*), array_agg(distinct conversation_id)
    into deleted_count, affected_conversations
  from removed;

  if coalesce(array_length(affected_conversations, 1), 0) > 0 then
    -- Force the polling API to refresh stale counters on other devices.
    update public.stip_conversations
    set updated_at = now()
    where id = any(affected_conversations);
  end if;

  return jsonb_build_object(
    'expired_wheelchair_messages_and_replies', deleted_count,
    'ran_at', now()
  );
end;
$wheelchairs$;

revoke all on function public.stip_purge_expired_wheelchairs()
from public, anon, authenticated;

-- Keep the daily general retention and event-chat J+7 semantics intact.
CREATE OR REPLACE FUNCTION public.stip_apply_retention()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- A daily fallback complements the dedicated five-minute wheelchair cleanup.
  perform public.stip_purge_expired_wheelchairs();

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
      -- Event chats follow event end + 7 days, not message creation time.
      and not exists (
        select 1 from public.stip_leisure_series_chat lc
        join public.stip_leisure_events ev on ev.id=lc.event_id
        where lc.conversation_id=public.stip_messages.conversation_id
          and (select max(event_day) from unnest(ev.dates) event_day) >=
              (now() at time zone 'Europe/Paris')::date - 7
      )
      and not exists (
        select 1 from public.stip_leisure_chats lc
        join public.stip_leisure_events ev on ev.id=lc.event_id
        where lc.conversation_id=public.stip_messages.conversation_id
          and (select max(event_day) from unnest(ev.dates) event_day) >=
              (now() at time zone 'Europe/Paris')::date - 7
      )
      -- Active wheelchair reports are now bounded by the 48-hour cleanup.;
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
$function$

;

update public.stip_retention_policies
set description = 'Messages généraux : 15 jours selon leur cycle propre ; Fauteuils : suppression automatique après 48 heures maximum depuis la création, statut actif inclus.',
    updated_at = now()
where policy_key = 'messages';

do $wheelchair_schedule$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'stip-wheelchair-expiry-5min'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'stip-wheelchair-expiry-5min',
    '*/5 * * * *',
    'select public.stip_purge_expired_wheelchairs();'
  );
end;
$wheelchair_schedule$;

commit;
