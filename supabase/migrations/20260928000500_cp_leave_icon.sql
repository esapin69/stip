-- CP / CA : l'avion reste libre pour un futur usage métier plus précis.
-- Les congés payés utilisent le repère vacances canonique.
update public.stip_shift_definitions
set icon = '🏝️',
    updated_at = now()
where upper(code) in ('CP','CA');
