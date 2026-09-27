insert into public.stip_icon_catalog
(icon_key,label,category,fallback_text,view_box,paths,stroke_width,active,updated_at)
values
('work-morning','Matin','planning','🔵','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"]'::jsonb,2.2,true,now()),
('work-day','Journée','planning','🟢','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"]'::jsonb,2.2,true,now()),
('work-late','J4','planning','🟠','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"]'::jsonb,2.2,true,now()),
('work-evening','Soir','planning','🟡','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"]'::jsonb,2.2,true,now()),
('work-night','Nuit','planning','⚫','0 0 24 24','["M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9"]'::jsonb,2.2,true,now())
on conflict (icon_key) do update set
 label=excluded.label,category=excluded.category,fallback_text=excluded.fallback_text,
 view_box=excluded.view_box,paths=excluded.paths,stroke_width=excluded.stroke_width,
 active=excluded.active,updated_at=now();

update public.stip_shift_definitions
set icon_key=case upper(code)
 when 'M' then 'work-morning'
 when 'J' then 'work-day'
 when 'J4' then 'work-late'
 when 'S' then 'work-evening'
 when 'N' then 'work-night'
 else icon_key end,
 updated_at=now()
where upper(code) in ('M','J','J4','S','N');
