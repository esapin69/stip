begin;
CREATE OR REPLACE FUNCTION public.stip_purge_expired_leisure()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare entry record; conversations uuid[]; finished integer:=0; deleted_chats integer:=0;
begin
 for entry in
  select ev.id from public.stip_leisure_events ev
  where (select max(d) from unnest(ev.dates) d) <=
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
end $function$
;
commit;
