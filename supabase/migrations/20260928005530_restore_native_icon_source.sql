-- Retour au dernier état natif validé avant la bascule SVG.
-- Les pastilles de travail restent pilotées par stip_shift_definitions.icon.
-- RH reprend le canapé validé ; CP/CA restent sur l'île.
-- Le catalogue SVG est conservé uniquement pour compatibilité de schéma, mais désactivé.

update public.stip_shift_definitions
set icon = case upper(code)
  when 'RH' then '🛋️'
  when 'OFF' then '🏝️'
  when 'REPOS' then '🏝️'
  when 'CA' then '🏝️'
  when 'CP' then '🏝️'
  else icon
end,
updated_at = now()
where upper(code) in ('RH','OFF','REPOS','CA','CP');

update public.stip_icon_catalog
set active = false,
    fallback_text = case icon_key
      when 'rest-home' then '🛋️'
      when 'leave-island' then '🏝️'
      else fallback_text
    end,
    updated_at = now();
