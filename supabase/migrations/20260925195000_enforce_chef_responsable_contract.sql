-- Canonical access invariant for chef_equipe.
-- A chef always owns Responsable Pro, but never Admin or Accès & sécurité.
-- This prevents future UI/admin writes from silently breaking the role contract.

create or replace function public.stip_sync_permission_levels()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  p jsonb := coalesce(new.permissions, '{}'::jsonb);
  o jsonb := coalesce(new.permission_overrides, '{}'::jsonb);
  levels jsonb := coalesce(p->'__levels', '{}'::jsonb);
  lv_change text;
  lv_personal text;
  lv_contacts text;
  lv_resp text;
  lv_assistant text;
  lv_team text;
begin
  if coalesce(new.role_key,'') = 'chef_equipe' then
    levels := jsonb_set(levels,'{responsable}',to_jsonb('pro'::text),true);
    p := jsonb_set(p,'{__levels}',levels,true);
    p := jsonb_set(p,'{responsable}','true'::jsonb,true);
    p := jsonb_set(p,'{access_manage}','false'::jsonb,true);
    p := jsonb_set(p,'{admin}','false'::jsonb,true);
    o := o || jsonb_build_object(
      'responsable',true,
      'access_manage',false,
      'admin',false,
      'depth_responsable','pro',
      'workflow_responsible',true
    );
  end if;

  levels := coalesce(p->'__levels', '{}'::jsonb);
  lv_change := lower(coalesce(levels->>'change_app',''));
  lv_personal := lower(coalesce(levels->>'planning_personal',''));
  lv_contacts := lower(coalesce(levels->>'contacts',''));
  lv_resp := lower(coalesce(levels->>'responsable',''));
  lv_assistant := lower(coalesce(levels->>'assistant_enabled',''));
  lv_team := lower(coalesce(levels->>'planning_team',''));

  if lv_change <> '' then
    p := jsonb_set(p,'{day_exchange}',to_jsonb(lv_change='pro'),true);
    o := o || jsonb_build_object('day_exchange',lv_change='pro');
  end if;
  if lv_personal <> '' then
    p := jsonb_set(p,'{day_absence}',to_jsonb(lv_personal='pro'),true);
    p := jsonb_set(p,'{day_delay}',to_jsonb(lv_personal='pro'),true);
    o := o || jsonb_build_object('day_absence',lv_personal='pro','day_delay',lv_personal='pro');
    o := o || jsonb_build_object('depth_planning',case when lv_personal='pro' or lv_team='pro' then 'pro' else 'basic' end);
  elsif lv_team <> '' then
    o := o || jsonb_build_object('depth_planning',case when lv_team='pro' then 'pro' else 'basic' end);
  end if;
  if lv_contacts <> '' then
    o := o || jsonb_build_object('depth_contacts',case when lv_contacts='pro' then 'pro' else 'basic' end);
  end if;
  if lv_resp <> '' then
    p := jsonb_set(p,'{workflow_responsible}',to_jsonb(lv_resp='pro'),true);
    o := o || jsonb_build_object(
      'workflow_responsible',lv_resp='pro',
      'depth_responsable',case when lv_resp='pro' then 'pro' else 'basic' end
    );
  end if;
  if lv_assistant <> '' then
    o := o || jsonb_build_object('depth_assistant',case when lv_assistant='pro' then 'pro' else 'basic' end);
  end if;

  new.permissions := p;
  new.permission_overrides := o;
  return new;
end
$function$;

drop trigger if exists trg_stip_sync_permission_levels on public.stip_access_profiles;

create trigger trg_stip_sync_permission_levels
before insert or update of role_key, permissions, permission_overrides
on public.stip_access_profiles
for each row execute function public.stip_sync_permission_levels();

update public.stip_access_profiles
set permissions=permissions,
    permission_overrides=permission_overrides,
    updated_at=now()
where role_key='chef_equipe';
