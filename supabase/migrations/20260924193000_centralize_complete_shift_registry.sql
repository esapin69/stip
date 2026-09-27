alter table public.stip_shift_definitions
  alter column start_time drop not null,
  alter column end_time drop not null,
  add column if not exists kind text not null default 'other',
  add column if not exists family text not null default 'other',
  add column if not exists is_working boolean not null default false;

comment on column public.stip_shift_definitions.kind is
  'Nature métier canonique : work, rest, leave, training, medical, absence, union ou other.';
comment on column public.stip_shift_definitions.family is
  'Famille visuelle canonique consommée par les interfaces STIP.';
comment on column public.stip_shift_definitions.is_working is
  'Indique si le code correspond à une présence planifiée en travail.';

insert into public.stip_shift_definitions
(code,label,start_time,end_time,icon,sort_order,active,color_hex,soft_color_hex,on_color_hex,kind,family,is_working,updated_at)
values
('M','Matin','06:50','14:40','🔵',1,true,'#087CFF','#DCEBFF','#FFFFFF','work','m',true,now()),
('J','Journée','08:30','16:20','🟢',2,true,'#00B85A','#DCF8E8','#FFFFFF','work','j',true,now()),
('J4','J4','10:10','18:00','🟠',3,true,'#FF9500','#FFF0D6','#FFFFFF','work','j4',true,now()),
('S','Soir','13:30','21:00','🟡',4,true,'#FFD500','#FFF3A3','#3A2B00','work','s',true,now()),
('N','Nuit','21:00','06:50','⚫',5,true,'#000000','#ECEFF1','#FFFFFF','work','n',true,now()),
('RH','Repos',null,null,'🏝️',10,true,'#748594','#EEF1F4','#FFFFFF','rest','rh',false,now()),
('CA','Congé payé',null,null,'✈️',20,true,'#748594','#EEF1F4','#FFFFFF','leave','off',false,now()),
('CP','Congé payé',null,null,'✈️',21,true,'#748594','#EEF1F4','#FFFFFF','leave','off',false,now()),
('RTT','RTT',null,null,'⏱️',30,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('RTTA','RTTA',null,null,'⏱️',31,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('RTA','RTA',null,null,'⏱️',32,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('RC','Récupération',null,null,'↻',33,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('RF','Repos férié',null,null,'•',34,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('OFF','Repos',null,null,'🏝️',35,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('REPOS','Repos',null,null,'🏝️',36,true,'#748594','#EEF1F4','#FFFFFF','rest','off',false,now()),
('FO','Formation',null,null,'🎓',40,true,'#748594','#EEF1F4','#FFFFFF','training','training',false,now()),
('ST','Référent stagiaire',null,null,'👶',41,true,'#748594','#EEF1F4','#FFFFFF','training','training',false,now()),
('VM','Visite médicale',null,null,'🩺',42,true,'#748594','#EEF1F4','#FFFFFF','medical','medical',false,now()),
('SYR','Activité syndicale',null,null,'🤝',43,true,'#748594','#EEF1F4','#FFFFFF','union','union',false,now()),
('MA','Maladie',null,null,'•',50,true,'#748594','#EEF1F4','#FFFFFF','medical','medical',false,now()),
('AM','Arrêt médical',null,null,'•',51,true,'#748594','#EEF1F4','#FFFFFF','medical','medical',false,now()),
('AR','AR',null,null,'•',52,true,'#748594','#EEF1F4','#FFFFFF','medical','medical',false,now()),
('AT','AT',null,null,'•',53,true,'#748594','#EEF1F4','#FFFFFF','medical','medical',false,now()),
('AA','Absence autorisée',null,null,'•',60,true,'#748594','#EEF1F4','#FFFFFF','absence','absence',false,now()),
('ABS','Absence',null,null,'•',61,true,'#748594','#EEF1F4','#FFFFFF','absence','absence',false,now()),
('AI','AI',null,null,'•',70,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('AJPP','AJPP',null,null,'•',71,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('CAR','CAR',null,null,'•',72,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('CMJ','CMJ',null,null,'•',73,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('CSN','CSN',null,null,'•',74,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('F0','F0',null,null,'•',75,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('INI','INI',null,null,'•',76,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('R-','R-',null,null,'•',77,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now()),
('T?','T?',null,null,'•',78,true,'#748594','#EEF1F4','#FFFFFF','other','other',false,now())
on conflict (code) do update set
  label=excluded.label,
  start_time=excluded.start_time,
  end_time=excluded.end_time,
  icon=excluded.icon,
  sort_order=excluded.sort_order,
  active=excluded.active,
  color_hex=excluded.color_hex,
  soft_color_hex=excluded.soft_color_hex,
  on_color_hex=excluded.on_color_hex,
  kind=excluded.kind,
  family=excluded.family,
  is_working=excluded.is_working,
  updated_at=now();

drop view if exists public.stip_shift_registry;
create view public.stip_shift_registry
with (security_invoker=true) as
select
  d.code,
  d.code as base_code,
  d.label,
  d.start_time,
  d.end_time,
  d.icon,
  d.sort_order,
  d.active,
  d.color_hex,
  d.soft_color_hex,
  d.on_color_hex,
  d.kind,
  d.family,
  d.is_working,
  'standard'::text as schedule_mode,
  null::time as window_start,
  null::time as window_end,
  null::integer as duration_minutes,
  null::text as source_label
from public.stip_shift_definitions d
where d.active
union all
select
  s.code,
  s.base_shift as base_code,
  coalesce(nullif(s.source_label,''), d.label) as label,
  d.start_time,
  d.end_time,
  d.icon,
  d.sort_order,
  s.active,
  d.color_hex,
  d.soft_color_hex,
  d.on_color_hex,
  d.kind,
  d.family,
  d.is_working,
  s.schedule_mode,
  s.window_start,
  s.window_end,
  s.duration_minutes,
  s.source_label
from public.stip_special_shift_definitions s
join public.stip_shift_definitions d on d.code=s.base_shift
where s.active and d.active;
