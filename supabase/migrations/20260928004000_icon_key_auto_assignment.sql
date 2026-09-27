
create or replace function public.stip_assign_shift_icon_key()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_key text := nullif(btrim(coalesce(new.icon_key,'')), '');
begin
  if current_key is null or current_key in (
    'work-morning','work-day','work-late','work-evening','work-night',
    'rest-home','leave-island','time-off','recovery','holiday-rest',
    'training','trainee','medical','union','medical-leave','absence','other'
  ) then
    new.icon_key := case upper(coalesce(new.code,''))
      when 'M' then 'work-morning'
      when 'J' then 'work-day'
      when 'J4' then 'work-late'
      when 'S' then 'work-evening'
      when 'N' then 'work-night'
      when 'RH' then 'rest-home'
      when 'OFF' then 'rest-home'
      when 'REPOS' then 'rest-home'
      when 'CA' then 'leave-island'
      when 'CP' then 'leave-island'
      when 'RTT' then 'time-off'
      when 'RTTA' then 'time-off'
      when 'RTA' then 'time-off'
      when 'RC' then 'recovery'
      when 'RF' then 'holiday-rest'
      when 'FO' then 'training'
      when 'ST' then 'trainee'
      when 'VM' then 'medical'
      when 'SYR' then 'union'
      when 'MA' then 'medical-leave'
      when 'AM' then 'medical-leave'
      when 'AR' then 'medical-leave'
      when 'AT' then 'medical-leave'
      when 'AA' then 'absence'
      when 'ABS' then 'absence'
      else case lower(coalesce(new.kind,''))
        when 'work' then coalesce(current_key,'other')
        when 'rest' then coalesce(current_key,'rest-home')
        when 'leave' then coalesce(current_key,'leave-island')
        when 'training' then coalesce(current_key,'training')
        when 'medical' then coalesce(current_key,'medical')
        when 'absence' then coalesce(current_key,'absence')
        when 'union' then coalesce(current_key,'union')
        else coalesce(current_key,'other')
      end
    end;
  end if;
  return new;
end
$$;

drop trigger if exists stip_shift_icon_key_auto on public.stip_shift_definitions;
create trigger stip_shift_icon_key_auto
before insert or update of code, kind, icon_key
on public.stip_shift_definitions
for each row execute function public.stip_assign_shift_icon_key();

create or replace function public.stip_assign_contact_icon_key()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_key text := nullif(btrim(coalesce(new.icon_key,'')), '');
begin
  if current_key is null or current_key in ('person','manager','service') then
    new.icon_key := case
      when lower(coalesce(new.categorie,'')) = 'chef'
        or lower(coalesce(new.role_metier,'')) like '%chef%' then 'manager'
      when lower(coalesce(new.categorie,'')) = 'service' then 'service'
      else 'person'
    end;
  end if;
  return new;
end
$$;

drop trigger if exists stip_contact_icon_key_auto on public.contacts_ghe;
create trigger stip_contact_icon_key_auto
before insert or update of categorie, role_metier, icon_key
on public.contacts_ghe
for each row execute function public.stip_assign_contact_icon_key();

create or replace function public.stip_assign_agenda_icon_key()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  current_key text := nullif(btrim(coalesce(new.icon_key,'')), '');
begin
  if current_key is null or current_key in ('medical','training','meeting','info','alert','priority','event') then
    new.icon_key := case
      when new.source_type = 'mobi_lit_medical' then 'medical'
      when lower(coalesce(new.event_kind,'')) in ('formation','formateur') then 'training'
      when lower(coalesce(new.event_kind,'')) in ('reunion','réunion') then 'meeting'
      when lower(coalesce(new.event_kind,'')) = 'information' then 'info'
      when lower(coalesce(new.importance,'')) = 'urgent' then 'alert'
      when lower(coalesce(new.importance,'')) = 'important' then 'priority'
      else 'event'
    end;
  end if;
  return new;
end
$$;

drop trigger if exists stip_agenda_icon_key_auto on public.stip_agent_agenda_items;
create trigger stip_agenda_icon_key_auto
before insert or update of source_type, event_kind, importance, icon_key
on public.stip_agent_agenda_items
for each row execute function public.stip_assign_agenda_icon_key();

update public.stip_shift_definitions set icon_key = icon_key;
update public.contacts_ghe set icon_key = icon_key;
update public.stip_agent_agenda_items set icon_key = icon_key;
