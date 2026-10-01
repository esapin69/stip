begin;
-- Membership is derived from registrations; messages remain in the canonical backend.
create table public.stip_leisure_chats (
 event_id uuid not null references public.stip_leisure_events(id),
 event_date date not null,
 conversation_id uuid not null unique references public.stip_conversations(id) on delete cascade,
 primary key(event_id,event_date)
);
alter table public.stip_leisure_chats enable row level security;
revoke all on public.stip_leisure_chats from public,anon,authenticated;
grant select,insert on public.stip_leisure_chats to service_role;
create function public.stip_leisure_sync_chats(p_event uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare e public.stip_leisure_events; d date; creator uuid; cid uuid;
begin
 select * into e from public.stip_leisure_events where id=p_event for update;
 if not found then return; end if;
 for d in select distinct x.d from public.stip_leisure_responses r
  cross join lateral unnest(r.selected_dates) x(d)
  where r.event_id=e.id and not r.declined and r.revision=e.revision
   and x.d=any(e.dates) and e.status='active'
 loop
  select conversation_id into cid from public.stip_leisure_chats where event_id=e.id and event_date=d;
  if cid is null then
   select agent_id into creator from public.stip_leisure_responses
    where event_id=e.id and not declined and revision=e.revision and d=any(selected_dates)
    order by updated_at,agent_id limit 1;
   insert into public.stip_conversations(kind,title,communication_family,created_by_agent_id)
    values('group',left(e.title,100)||' · '||to_char(d,'DD/MM/YYYY'),e.family,creator) returning id into cid;
   insert into public.stip_leisure_chats values(e.id,d,cid);
  end if;
 end loop;
 update public.stip_conversations c set title=left(e.title,100)||' · '||to_char(l.event_date,'DD/MM/YYYY'),updated_at=now()
  from public.stip_leisure_chats l where l.event_id=e.id and c.id=l.conversation_id;
 delete from public.stip_conversation_members m using public.stip_leisure_chats l
  where l.event_id=e.id and m.conversation_id=l.conversation_id
  and not exists(select 1 from public.stip_leisure_responses r where r.event_id=e.id and r.agent_id=m.agent_id
   and not r.declined and r.revision=e.revision and l.event_date=any(r.selected_dates)
   and l.event_date=any(e.dates) and e.status='active');
 insert into public.stip_conversation_members(conversation_id,agent_id)
  select l.conversation_id,r.agent_id from public.stip_leisure_chats l
  join public.stip_leisure_responses r on r.event_id=l.event_id
  where l.event_id=e.id and not r.declined and r.revision=e.revision
   and l.event_date=any(r.selected_dates) and l.event_date=any(e.dates) and e.status='active'
  on conflict(conversation_id,agent_id) do nothing;
end $$;
revoke all on function public.stip_leisure_sync_chats(uuid) from public,anon,authenticated;
grant execute on function public.stip_leisure_sync_chats(uuid) to service_role;
create function public.stip_leisure_chats_changed()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_TABLE_NAME='stip_leisure_events' then
  perform public.stip_leisure_sync_chats(NEW.id);
 else
  perform public.stip_leisure_sync_chats(NEW.event_id);
 end if;
 return NEW;
end $$;
revoke all on function public.stip_leisure_chats_changed() from public,anon,authenticated;
grant execute on function public.stip_leisure_chats_changed() to service_role;
create trigger leisure_response_chat_sync after insert or update on public.stip_leisure_responses
 for each row execute function public.stip_leisure_chats_changed();
create trigger leisure_event_chat_sync after update on public.stip_leisure_events
 for each row execute function public.stip_leisure_chats_changed();
select public.stip_leisure_sync_chats(id) from public.stip_leisure_events;
commit;
