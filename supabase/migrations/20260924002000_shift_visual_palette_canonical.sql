alter table public.stip_shift_definitions
  add column if not exists color_hex text,
  add column if not exists soft_color_hex text,
  add column if not exists on_color_hex text;

comment on column public.stip_shift_definitions.color_hex is
  'Couleur canonique du shift pour les repères et contours STIP.';
comment on column public.stip_shift_definitions.soft_color_hex is
  'Teinte claire canonique du shift pour les surfaces secondaires STIP.';
comment on column public.stip_shift_definitions.on_color_hex is
  'Couleur de texte/icone à utiliser sur la couleur principale du shift.';

update public.stip_shift_definitions
set
  icon = case code
    when 'M' then '🔵'
    when 'J' then '🟢'
    when 'J4' then '🟠'
    when 'S' then '🟡'
    when 'N' then '⚫'
    else icon
  end,
  color_hex = case code
    when 'M' then '#087CFF'
    when 'J' then '#00B85A'
    when 'J4' then '#FF9500'
    when 'S' then '#FFD500'
    when 'N' then '#000000'
    else color_hex
  end,
  soft_color_hex = case code
    when 'M' then '#DCEBFF'
    when 'J' then '#DCF8E8'
    when 'J4' then '#FFF0D6'
    when 'S' then '#FFF3A3'
    when 'N' then '#ECEFF1'
    else soft_color_hex
  end,
  on_color_hex = case code
    when 'S' then '#3A2B00'
    when 'M' then '#FFFFFF'
    when 'J' then '#FFFFFF'
    when 'J4' then '#FFFFFF'
    when 'N' then '#FFFFFF'
    else on_color_hex
  end,
  updated_at = now()
where code in ('M','J','J4','S','N');
