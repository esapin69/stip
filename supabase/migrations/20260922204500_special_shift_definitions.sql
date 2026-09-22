create table if not exists public.stip_special_shift_definitions (
  code text primary key,
  base_shift text not null check (base_shift in ('M','J','J4','S','N')),
  schedule_mode text not null check (schedule_mode in ('fixed','flexible')),
  window_start time not null,
  window_end time not null,
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 1440),
  source_label text,
  source_file text,
  source_sheet text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.stip_special_shift_definitions enable row level security;

insert into public.stip_special_shift_definitions
  (code,base_shift,schedule_mode,window_start,window_end,duration_minutes,source_label,source_file,source_sheet,active,updated_at)
values
  ('J0464','J','fixed','08:30','16:20',450,'08.30-16.20 (07.30) Fixe','2026 09 STIP Jour Planning prévisionnel.xlsx','Planning collectif Modif',true,now()),
  ('M0130','M','flexible','06:00','21:30',225,'06.00-21.30 (03.45) Libre','2026 09 STIP Jour Planning prévisionnel.xlsx','Planning collectif Modif',true,now()),
  ('M0131','M','flexible','06:30','21:15',450,'06.30-21.15 (07.30) Libre','2026 09 STIP Jour Planning prévisionnel.xlsx','Planning collectif Modif',true,now()),
  ('M0177','M','flexible','06:25','21:35',450,'06.25-21.35 (07.30) Libre','2026 09 STIP Jour Planning prévisionnel.xlsx','Planning collectif Modif',true,now()),
  ('S0113','S','fixed','13:30','21:00',450,'13.30-21.00 (07.30) Fixe','2026 09 STIP Jour Planning prévisionnel.xlsx','Planning collectif Modif',true,now())
on conflict (code) do update set
  base_shift=excluded.base_shift,
  schedule_mode=excluded.schedule_mode,
  window_start=excluded.window_start,
  window_end=excluded.window_end,
  duration_minutes=excluded.duration_minutes,
  source_label=excluded.source_label,
  source_file=excluded.source_file,
  source_sheet=excluded.source_sheet,
  active=true,
  updated_at=now();
