-- RH : repos hors congés payés.
-- CP / CA conservent 🏝️ ; RH utilise le repère repos distinct 🛌.
update public.stip_shift_definitions
set icon = '🛌',
    updated_at = now()
where upper(code) = 'RH';
