-- Repères fournis par Eddy le 01/10/2026. Aucun arrêt inconnu n'est déduit.
BEGIN;
INSERT INTO public.stip_places(id,display_name,place_type,building_code,parent_id,summary,visibility,evidence_status,source_kind,source_ref,source_date,sort_order)
VALUES
('pw_asc_between_units','Ascenseurs entre les unités x00 et x01','elevator_group','PW','pw','Repère terrain entre les unités x00 et x01.','internal_stip','terrain_validated','terrain','Eddy · repères fauteuils · 01/10/2026','2026-10-01',10),
('pw_asc_units_x02','Ascenseurs côté unité x02','elevator_group','PW','pw','Repère terrain côté unité x02.','internal_stip','terrain_validated','terrain','Eddy · repères fauteuils · 01/10/2026','2026-10-01',11),
('pw_asc_rea_bloc','Ascenseurs côté réanimation / bloc','elevator_group','PW','pw','Repère terrain côté réanimation et bloc.','internal_stip','terrain_validated','terrain','Eddy · repères fauteuils · 01/10/2026','2026-10-01',12)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.stip_places(id,display_name,place_type,building_code,level,parent_id,visibility,evidence_status,source_kind,source_ref,source_date,sort_order)
VALUES ('pw_local_fauteuils_l1','Local à fauteuils','operational_landmark','PW','1','pw_l1','internal_stip','terrain_validated','terrain','Eddy · repères fauteuils · 01/10/2026','2026-10-01',9)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.stip_place_relations(from_place_id,to_place_id,relation_type,visibility,evidence_status,source_ref)
SELECT CASE WHEN id ~ '00$|01$' THEN 'pw_asc_between_units' ELSE 'pw_asc_units_x02' END,id,'near','internal_stip','terrain_validated','Eddy · repères fauteuils · 01/10/2026'
FROM public.stip_places p WHERE building_code='PW' AND place_type='unit' AND id ~ '^pw_u[1-5]0[012]$'
AND NOT EXISTS (SELECT 1 FROM public.stip_place_relations r WHERE r.to_place_id=p.id AND r.from_place_id=CASE WHEN p.id ~ '00$|01$' THEN 'pw_asc_between_units' ELSE 'pw_asc_units_x02' END AND r.relation_type='near')
ON CONFLICT DO NOTHING;
INSERT INTO public.stip_place_relations(from_place_id,to_place_id,relation_type,visibility,evidence_status,source_ref)
SELECT 'pw_asc_rea_bloc',id,'near','internal_stip','terrain_validated','Eddy · repères fauteuils · 01/10/2026'
FROM public.stip_places p WHERE id IN ('pw_block','pw_rea')
AND NOT EXISTS (SELECT 1 FROM public.stip_place_relations r WHERE r.to_place_id=p.id AND r.from_place_id='pw_asc_rea_bloc' AND r.relation_type='near')
ON CONFLICT DO NOTHING;
COMMIT;
