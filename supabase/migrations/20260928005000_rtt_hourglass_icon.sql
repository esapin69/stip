-- RTT / RTTA / RTA : repère temps récupéré plus lisible que le chronomètre.
update public.stip_shift_definitions
set icon = '⌛',
    updated_at = now()
where upper(code) in ('RTT','RTTA','RTA');

update public.stip_icon_catalog
set fallback_text = '⌛',
    updated_at = now()
where icon_key = 'time-off';
