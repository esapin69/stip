-- Central icon architecture: semantic keys in business rows, one canonical SVG catalog.
-- Legacy emoji/text columns are preserved as fallbacks so existing consumers never break.

create table if not exists public.stip_icon_catalog (
  icon_key text primary key,
  label text not null,
  category text not null default 'general',
  fallback_text text,
  view_box text not null default '0 0 24 24',
  paths jsonb not null default '[]'::jsonb,
  stroke_width numeric(3,1) not null default 1.9,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint stip_icon_catalog_key_chk check (icon_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint stip_icon_catalog_paths_chk check (jsonb_typeof(paths) = 'array')
);

alter table public.stip_icon_catalog enable row level security;

comment on table public.stip_icon_catalog is
  'Catalogue canonique des pictogrammes STIP. Les lignes métier stockent seulement icon_key ; le SVG n’est défini qu’une fois ici.';
comment on column public.stip_icon_catalog.paths is
  'Liste de path d SVG. Le client ne rend que des balises path contrôlées, jamais du HTML/SVG arbitraire.';

alter table public.stip_shift_definitions
  add column if not exists icon_key text references public.stip_icon_catalog(icon_key);

alter table public.stip_agent_agenda_items
  add column if not exists icon_key text references public.stip_icon_catalog(icon_key);

alter table public.contacts_ghe
  add column if not exists icon_key text references public.stip_icon_catalog(icon_key);

comment on column public.stip_shift_definitions.icon_key is
  'Clé du pictogramme canonique STIP. icon reste un fallback texte de compatibilité.';
comment on column public.stip_agent_agenda_items.icon_key is
  'Clé du pictogramme canonique STIP. icon reste un fallback texte de compatibilité.';
comment on column public.contacts_ghe.icon_key is
  'Clé du pictogramme canonique STIP. icone reste un fallback texte de compatibilité.';

insert into public.stip_icon_catalog
(icon_key,label,category,fallback_text,view_box,paths,stroke_width,active,updated_at)
values
('rest-home','Repos','planning','🏠','0 0 24 24','["M3 11.5 12 4l9 7.5","M5 10.5V21h14V10.5","M9 21v-6h6v6"]'::jsonb,1.9,true,now()),
('leave-island','Congé / vacances','planning','🏝️','0 0 24 24','["M3 20c2.2-2.1 5.2-3.2 9-3.2s6.8 1.1 9 3.2","M12 16V7","M12 8c-2.1-2-4.5-2.2-6.7-.7","M12 8c2-2 4.5-2.2 6.7-.7","M12 10c-1.8-1.4-3.8-1.6-5.9-.5","M12 10c1.8-1.4 3.8-1.6 5.9-.5"]'::jsonb,1.9,true,now()),
('time-off','RTT / temps récupéré','planning','⏱️','0 0 24 24','["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2","M12 7v5l3.5 2","M9 2h6"]'::jsonb,1.9,true,now()),
('recovery','Récupération','planning','↻','0 0 24 24','["M20 7v5h-5","M20 12a8 8 0 1 1-2.3-5.7"]'::jsonb,1.9,true,now()),
('holiday-rest','Repos férié','planning','📅','0 0 24 24','["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M12 12.2l1.1 2.2 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4z"]'::jsonb,1.75,true,now()),
('training','Formation','event','🎓','0 0 24 24','["M3 9.5 12 5l9 4.5-9 4.5z","M7 12.2v4.1c3 2.2 7 2.2 10 0v-4.1","M21 9.5v6"]'::jsonb,1.9,true,now()),
('trainee','Stagiaire / référent','event','👶','0 0 24 24','["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M5 21c.7-4.2 3.1-6.5 7-6.5s6.3 2.3 7 6.5","M18 6h4","M20 4v4"]'::jsonb,1.9,true,now()),
('medical','Médical','event','🩺','0 0 24 24','["M6 3v6a4 4 0 0 0 8 0V3","M8 3H4","M16 3h-4","M10 13v2a4 4 0 0 0 8 0v-1","M18 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4"]'::jsonb,1.9,true,now()),
('union','Activité syndicale','event','🤝','0 0 24 24','["M4 8l4-3 4 3 4-3 4 3","M3 9l5 5 3-2 2 2 3-2 5-5","M8 14l2 2","M11 12l3 3","M14 12l2 2"]'::jsonb,1.8,true,now()),
('medical-leave','Arrêt / absence médicale','event','✚','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 8v8","M8 12h8"]'::jsonb,1.9,true,now()),
('absence','Absence','event','×','0 0 24 24','["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M9 13l6 6","M15 13l-6 6"]'::jsonb,1.8,true,now()),
('other','Autre repère','event','•','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 11v6","M12 8h.01"]'::jsonb,1.9,true,now()),
('person','Personne','contact','👤','0 0 24 24','["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M5 21c.7-4.2 3.1-6.5 7-6.5s6.3 2.3 7 6.5"]'::jsonb,1.9,true,now()),
('manager','Responsable','contact','★','0 0 24 24','["M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7","M4 21c.6-4 2.8-6.2 6-6.2 1.6 0 3 .5 4.1 1.4","M18 11.5l1.1 2.2 2.4.4-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.4z"]'::jsonb,1.75,true,now()),
('service','Service / unité','contact','▦','0 0 24 24','["M5 21V4h10v17","M15 9h4v12","M8 8h4","M8 12h4","M8 16h4","M18 13h.01","M18 17h.01"]'::jsonb,1.8,true,now()),
('event','Événement','event','📌','0 0 24 24','["M4 5h16v16H4z","M8 3v4","M16 3v4","M4 9h16","M8 13h8","M8 17h5"]'::jsonb,1.8,true,now()),
('meeting','Réunion','event','◎','0 0 24 24','["M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6","M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6","M2.5 20c.5-4 2.4-6 5.5-6 1.7 0 3.1.6 4 1.6","M11.5 20c.5-4 2.4-6 5.5-6 3.1 0 5 2 5.5 6"]'::jsonb,1.8,true,now()),
('info','Information','event','i','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9","M12 11v6","M12 8h.01"]'::jsonb,1.9,true,now()),
('alert','Urgent','state','!','0 0 24 24','["M12 3 2.5 20h19z","M12 9v5","M12 17h.01"]'::jsonb,1.9,true,now()),
('priority','Important','state','!','0 0 24 24','["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2","M12 7v6","M12 16h.01"]'::jsonb,1.9,true,now())
on conflict (icon_key) do update set
  label=excluded.label, category=excluded.category, fallback_text=excluded.fallback_text,
  view_box=excluded.view_box, paths=excluded.paths, stroke_width=excluded.stroke_width,
  active=excluded.active, updated_at=now();

update public.stip_shift_definitions
set icon_key = case upper(code)
  when 'RH' then 'rest-home' when 'OFF' then 'rest-home' when 'REPOS' then 'rest-home'
  when 'CA' then 'leave-island' when 'CP' then 'leave-island'
  when 'RTT' then 'time-off' when 'RTTA' then 'time-off' when 'RTA' then 'time-off'
  when 'RC' then 'recovery' when 'RF' then 'holiday-rest'
  when 'FO' then 'training' when 'ST' then 'trainee' when 'VM' then 'medical'
  when 'SYR' then 'union'
  when 'MA' then 'medical-leave' when 'AM' then 'medical-leave'
  when 'AR' then 'medical-leave' when 'AT' then 'medical-leave'
  when 'AA' then 'absence' when 'ABS' then 'absence'
  else 'other'
end,
icon = case upper(code)
  when 'RH' then '🏠' when 'OFF' then '🏠' when 'REPOS' then '🏠'
  when 'CA' then '🏝️' when 'CP' then '🏝️' else icon end,
updated_at = now()
where active;

update public.contacts_ghe
set icon_key = case
  when lower(coalesce(categorie,'')) = 'chef'
    or lower(coalesce(role_metier,'')) like '%chef%' then 'manager'
  when lower(coalesce(categorie,'')) = 'service' then 'service'
  else 'person'
end;

update public.stip_agent_agenda_items
set icon_key = case
  when source_type = 'mobi_lit_medical' then 'medical'
  when lower(coalesce(event_kind,'')) in ('formation','formateur') then 'training'
  when lower(coalesce(event_kind,'')) in ('reunion','réunion') then 'meeting'
  when lower(coalesce(event_kind,'')) = 'information' then 'info'
  when lower(coalesce(importance,'')) = 'urgent' then 'alert'
  when lower(coalesce(importance,'')) = 'important' then 'priority'
  else 'event'
end;

drop view if exists public.stip_shift_registry;
create view public.stip_shift_registry
with (security_invoker=true) as
select d.code,d.code as base_code,d.label,d.start_time,d.end_time,d.icon,d.icon_key,
  d.sort_order,d.active,d.color_hex,d.soft_color_hex,d.on_color_hex,d.kind,d.family,d.is_working,
  'standard'::text as schedule_mode,null::time as window_start,null::time as window_end,
  null::integer as duration_minutes,null::text as source_label
from public.stip_shift_definitions d where d.active
union all
select s.code,s.base_shift as base_code,coalesce(nullif(s.source_label,''),d.label) as label,
  d.start_time,d.end_time,d.icon,d.icon_key,d.sort_order,s.active,d.color_hex,d.soft_color_hex,
  d.on_color_hex,d.kind,d.family,d.is_working,s.schedule_mode,s.window_start,s.window_end,
  s.duration_minutes,s.source_label
from public.stip_special_shift_definitions s
join public.stip_shift_definitions d on d.code=s.base_shift
where s.active and d.active;
