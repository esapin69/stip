-- 2026-10-16 : une absence mensuelle de planning ne prouve pas un départ.
-- Préserve les accès et sessions existants ; trace uniquement une revue d'identité.
CREATE OR REPLACE FUNCTION public.stip_reconcile_access_with_planning()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_scope text;
  v_batch record;
  v_has boolean;
  v_prev_status text;
  v_prev_note text;
begin
  for r in
    select p.id as profile_id,p.agent_id,p.role_key,p.active,a.equipe,a.type_planning
    from public.stip_access_profiles p
    join public.agents a on a.id=p.agent_id
    where p.role_key in ('brancardier','chef_equipe')
  loop
    if r.role_key='chef_equipe' then v_scope:='chefs';
    elsif lower(coalesce(r.type_planning,'')||' '||coalesce(r.equipe,'')) like '%nuit%' then v_scope:='nuit';
    else v_scope:='jour'; end if;

    select b.id,b.file_name,b.max_date into v_batch
    from public.admin_import_batches b
    where b.kind='planning' and b.scope=v_scope and b.status='committed'
      and b.max_date >= current_date + 7
    order by b.max_date desc, coalesce(b.committed_at,b.created_at) desc
    limit 1;

    if v_batch.id is null then
      continue;
    end if;

    select exists(select 1 from public.planning p where p.agent_id=r.agent_id and p.sync_batch_id=v_batch.id) into v_has;
    select status,note into v_prev_status,v_prev_note from public.stip_access_identity_reviews where profile_id=r.profile_id;

    if v_has then
      insert into public.stip_access_identity_reviews(profile_id,agent_id,status,planning_match,planning_last_date,planning_source_file,planning_source_sheet,source_url,note,last_checked_at,resolved_at,updated_at)
      select r.profile_id,r.agent_id,'linked_active',true,max(p.date),v_batch.file_name,max(p.source_sheet),l.url,
        'Présence confirmée dans le planning de référence actuel.',now(),now(),now()
      from public.planning p left join public.stip_source_file_links l on l.file_name=v_batch.file_name and l.active=true
      where p.agent_id=r.agent_id and p.sync_batch_id=v_batch.id
      group by l.url
      on conflict(profile_id) do update set status='linked_active',planning_match=true,planning_last_date=excluded.planning_last_date,planning_source_file=excluded.planning_source_file,planning_source_sheet=excluded.planning_source_sheet,source_url=excluded.source_url,note=excluded.note,last_checked_at=now(),resolved_at=now(),updated_at=now();
      if r.active=false and v_prev_status='to_review' and coalesce(v_prev_note,'') like 'SUSPENSION AUTOMATIQUE:%' then
        update public.stip_access_profiles set active=true,updated_at=now() where id=r.profile_id;
      end if;
    else
      insert into public.stip_access_identity_reviews(profile_id,agent_id,status,planning_match,planning_source_file,note,first_flagged_at,last_checked_at,updated_at)
      values(r.profile_id,r.agent_id,'to_review',false,v_batch.file_name,'REVUE SANS SUSPENSION: personne absente du planning de référence actuel. Vérification humaine requise.',coalesce((select first_flagged_at from public.stip_access_identity_reviews where profile_id=r.profile_id),now()),now(),now())
      on conflict(profile_id) do update set status='to_review',planning_match=false,planning_source_file=excluded.planning_source_file,note=excluded.note,first_flagged_at=coalesce(public.stip_access_identity_reviews.first_flagged_at,now()),last_checked_at=now(),resolved_at=null,updated_at=now();
      -- Absence du planning d'un mois = revue humaine, PAS suspension du compte.
      -- Ne jamais révoquer une session active par le seul fait d'une absence au planning.
    end if;
  end loop;
end;
$function$
;
