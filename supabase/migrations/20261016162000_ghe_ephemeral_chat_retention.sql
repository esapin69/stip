begin;
-- Protect active chats while event is pending or recently finished.
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
$function$

;

create or replace function public.stip_purge_expired_leisure()
returns jsonb language plpgsql security definer set search_path='public' as $clean$
declare entry record; conversations uuid[]; finished integer:=0; deleted_chats integer:=0;
begin
 for entry in
  select ev.id from public.stip_leisure_events ev
  where (select max(d) from unnest(ev.dates) d) <
    (now() at time zone 'Europe/Paris')::date - 7
    and not exists(select 1 from public.stip_leisure_recurring r where r.event_id=ev.id and r.active)
  order by ev.id limit 100
 loop
  select coalesce(array_agg(distinct z.conversation_id),'{}'::uuid[]) into conversations from (
    select conversation_id from public.stip_leisure_series_chat where event_id=entry.id
    union
    select conversation_id from public.stip_leisure_chats where event_id=entry.id
  ) z;
  delete from public.stip_leisure_chats where event_id=entry.id;
  delete from public.stip_leisure_series_chat where event_id=entry.id;
  delete from public.stip_leisure_responses where event_id=entry.id;
  delete from public.stip_leisure_invites where event_id=entry.id;
  delete from public.stip_notifications where source_type='stip_leisure_events' and source_ref=entry.id;
  delete from public.stip_leisure_recurring where event_id=entry.id;
  delete from public.stip_leisure_events where id=entry.id;
  delete from public.stip_conversations where id=any(conversations);
  finished:=finished+1;
  deleted_chats:=deleted_chats+cardinality(conversations);
 end loop;
 return jsonb_build_object('deleted_events',finished,'deleted_event_chats',deleted_chats,'timestamp',now());
end $clean$;
revoke all on function public.stip_purge_expired_leisure() from public,anon,authenticated;

do $schedule$
declare job bigint;
begin
 select jobid into job from cron.job where jobname='stip-leisure-expiry-daily' limit 1;
 if job is not null then perform cron.unschedule(job); end if;
 perform cron.schedule('stip-leisure-expiry-daily','5 3 * * *',
  'select public.stip_purge_expired_leisure();');
end $schedule$;

-- The canonical series chat supersedes the old chat-per-date triggers.
-- Existing legacy conversations are preserved until normal retention expires.
drop trigger if exists leisure_response_chat_sync on public.stip_leisure_responses;
drop trigger if exists leisure_event_chat_sync on public.stip_leisure_events;

commit;
