
begin;
create table if not exists public.stip_leisure_date_decisions (
 event_id uuid not null references public.stip_leisure_events(id) on delete cascade,
 agent_id uuid not null references public.agents(id) on delete cascade,
 event_date date not null,
 revision integer not null,
 decision text not null check(decision in ('yes','no')),
 updated_at timestamptz not null default now(),
 primary key (event_id,agent_id,event_date)
);
create index if not exists stip_leisure_date_decisions_event_idx
 on public.stip_leisure_date_decisions(event_id,revision);
alter table public.stip_leisure_date_decisions enable row level security;
revoke all on public.stip_leisure_date_decisions from anon,authenticated;
grant select,insert,update,delete on public.stip_leisure_date_decisions to service_role;

create table if not exists public.stip_leisure_event_changes (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.stip_leisure_events(id) on delete cascade,
 change_kind text not null check(change_kind in ('date','cancelled')),
 old_dates date[] not null,
 new_dates date[] not null,
 old_responses jsonb not null default '[]'::jsonb,
 changed_at timestamptz not null default now()
);
create index if not exists stip_leisure_event_changes_idx on public.stip_leisure_event_changes(event_id,changed_at desc);
alter table public.stip_leisure_event_changes enable row level security;
revoke all on public.stip_leisure_event_changes from anon,authenticated;
grant select,insert on public.stip_leisure_event_changes to service_role;

create or replace function public.stip_leisure_answer_day(
 p_event uuid,p_agent uuid,p_family text,p_revision integer,p_day date,p_decision text
) returns text language plpgsql set search_path='public' as $body$
declare e public.stip_leisure_events; yes_days date[]; answered integer; total integer; final_status text;
begin
 select * into e from public.stip_leisure_events where id=p_event for update;
 if not found or e.family is distinct from p_family then raise exception 'SORTIE_INTROUVABLE'; end if;
 if e.status<>'active' or e.revision<>p_revision then raise exception 'DATES_MODIFIEES'; end if;
 if p_agent=e.organizer_agent_id then raise exception 'ORGANISATEUR_NON_INVITE'; end if;
 if not exists(select 1 from public.stip_leisure_invites where event_id=p_event and agent_id=p_agent)
 then raise exception 'ACCES_INVITATION_REQUIS'; end if;
 if p_day is null or not p_day=any(e.dates) then raise exception 'DATE_INVALIDE'; end if;
 if p_day<(now() at time zone 'Europe/Paris')::date then raise exception 'DATE_PASSEE'; end if;
 if p_decision not in ('yes','no','neutral') then raise exception 'CHOIX_INVALIDE'; end if;
 -- Preserve pre-existing selected dates when a colleague first uses per-date answers.
 insert into public.stip_leisure_date_decisions(event_id,agent_id,event_date,revision,decision)
 select p_event,p_agent,day,p_revision,'yes'
 from public.stip_leisure_responses r cross join lateral unnest(r.selected_dates) day
 where r.event_id=p_event and r.agent_id=p_agent and r.revision=p_revision and not r.declined
 on conflict(event_id,agent_id,event_date) do nothing;
 if p_decision='neutral' then
   delete from public.stip_leisure_date_decisions where event_id=p_event and agent_id=p_agent and event_date=p_day;
 else
   insert into public.stip_leisure_date_decisions(event_id,agent_id,event_date,revision,decision)
   values(p_event,p_agent,p_day,p_revision,p_decision)
   on conflict(event_id,agent_id,event_date) do update
    set decision=excluded.decision,revision=excluded.revision,updated_at=now();
 end if;
 select coalesce(array_agg(event_date order by event_date),'{}'::date[]),count(*)
 into yes_days,total
 from public.stip_leisure_date_decisions
 where event_id=p_event and agent_id=p_agent and revision=p_revision
  and event_date=any(e.dates) and decision='yes';
 select count(*) into answered from public.stip_leisure_date_decisions
 where event_id=p_event and agent_id=p_agent and revision=p_revision
  and event_date=any(e.dates);
 if cardinality(yes_days)>0 then
  perform public.stip_leisure_respond(p_event,p_agent,p_family,p_revision,yes_days,false);
  final_status='accepted';
 elsif answered=cardinality(e.dates) and answered>0 then
  perform public.stip_leisure_respond(p_event,p_agent,p_family,p_revision,'{}'::date[],true);
  final_status='declined';
 else
  delete from public.stip_leisure_responses where event_id=p_event and agent_id=p_agent;
  final_status='pending';
 end if;
 update public.stip_leisure_invites set status=final_status,
   responded_at=case when final_status='pending' then null else now() end
 where event_id=p_event and agent_id=p_agent;
 perform public.stip_leisure_sync_series_chat(p_event);
 return final_status;
end $body$;
revoke all on function public.stip_leisure_answer_day(uuid,uuid,text,integer,date,text) from public,anon,authenticated;
grant execute on function public.stip_leisure_answer_day(uuid,uuid,text,integer,date,text) to service_role;

create or replace function public.stip_leisure_dates_changed_log()
returns trigger language plpgsql set search_path='public' as $body$
declare previous jsonb;
begin
 if old.dates is not distinct from new.dates and old.status is not distinct from new.status then return new; end if;
 -- Recurring dates are reconciled automatically; do not send mass re-invitations for rolling additions.
 if new.status='active' and exists(select 1 from public.stip_leisure_recurring where event_id=new.id and active) then return new; end if;
 select coalesce(jsonb_agg(jsonb_build_object('agent_id',agent_id,'selected_dates',selected_dates,'declined',declined,'revision',revision)),'[]'::jsonb)
 into previous from public.stip_leisure_responses where event_id=new.id;
 insert into public.stip_leisure_event_changes(event_id,change_kind,old_dates,new_dates,old_responses)
 values(new.id,case when new.status='cancelled' then 'cancelled' else 'date' end,old.dates,new.dates,previous);
 if old.dates is distinct from new.dates then
   delete from public.stip_leisure_date_decisions where event_id=new.id;
   delete from public.stip_leisure_responses where event_id=new.id;
   update public.stip_leisure_invites set status='pending',responded_at=null where event_id=new.id;
 end if;
 insert into public.stip_notifications(agent_id,type,title,body,source_type,source_ref)
 select i.agent_id,'leisure_invite',
   case when new.status='cancelled' then 'Événement annulé' else 'Date modifiée · À reconfirmer' end,
   left(new.title||' · '||case when new.status='cancelled' then 'Annulé' else 'Toutes les participations sont à reconfirmer.' end,200),
   'stip_leisure_events',new.id
 from public.stip_leisure_invites i where i.event_id=new.id;
 return new;
end $body$;
drop trigger if exists ghe_leisure_date_change_log on public.stip_leisure_events;
create trigger ghe_leisure_date_change_log after update of dates,status on public.stip_leisure_events
for each row execute function public.stip_leisure_dates_changed_log();
commit;
