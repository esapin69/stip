-- Horaire de nuit relevé dans le fichier officiel prévisionnel de novembre 2026.
-- Correction du décalage antérieur 21:00 / 20:50 dans le registre d'affichage.
UPDATE public.stip_shift_definitions
SET start_time='20:50'::time,
    end_time='06:50'::time,
    updated_at=now()
WHERE code='N'
  AND start_time='21:00'::time
  AND end_time='06:50'::time;
