-- Email delivery + one-time action tokens; final cadre decisions are the only planning-writing route.
-- The Edge Function retains raw tokens in memory only; the database stores SHA-256 hashes.
create table if not exists public.stip_change_mail_actions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.stip_change_requests(id) on delete cascade,
 contact_id bigint references public.contacts_ghe(id) on delete set null,
 recipient_email text not null,
 recipient_name text not null,
 recipient_role text not null check (recipient_role in ('chef','cadre')),
 token_hash text not null unique,
 state text not null default 'prepared' check (state in ('prepared','sending','sent','failed','advised','decided','superseded')),
 sent_at timestamptz,
 provider_id text,
 sent_error text,
 expires_at timestamptz not null,
 opened_at timestamptz,
 responded_at timestamptz,
 response_action text,
 response_comment text,
 response_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint stip_change_mail_request_contact_unique unique(request_id,contact_id)
);
create index if not exists stip_change_mail_actions_request_idx on public.stip_change_mail_actions(request_id,state);
alter table public.stip_change_mail_actions enable row level security;
revoke all on public.stip_change_mail_actions from anon,authenticated;
CREATE OR REPLACE FUNCTION public.stip_change_mail_decide(p_token_hash text, p_action text, p_new_code text DEFAULT NULL::text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_request_id uuid;
 v_mail public.stip_change_mail_actions%rowtype;
 v_req public.stip_change_requests%rowtype;
 v_result jsonb;
 v_code text;
 v_kind text;
 v_now timestamptz := now();
 v_comment text;
begin
 if p_token_hash is null or length(p_token_hash) <> 64 then raise exception 'LIEN_INVALIDE'; end if;
 if p_action not in ('chef_favorable','chef_defavorable','accept','refuse','modify') then raise exception 'ACTION_INVALIDE'; end if;
 select request_id into v_request_id
 from public.stip_change_mail_actions
 where token_hash=p_token_hash;
 if v_request_id is null then raise exception 'LIEN_INVALIDE'; end if;
 select * into v_req from public.stip_change_requests where id=v_request_id for update;
 if not found then raise exception 'DEMANDE_INTROUVABLE'; end if;
 select * into v_mail from public.stip_change_mail_actions where token_hash=p_token_hash for update;
 if not found then raise exception 'LIEN_INVALIDE'; end if;
 if v_mail.state <> 'sent' then
  if v_mail.state in ('decided','advised','superseded') then
   return jsonb_build_object('ok',false,'already_processed',true,'message','Ce lien a déjà été traité.');
  end if;
  raise exception 'MAIL_NON_EMIS';
 end if;
 if v_mail.expires_at<=v_now then raise exception 'LIEN_EXPIRE'; end if;
 if v_req.status not in ('awaiting_responsible','submitted') or
    v_req.decided_at is not null or
    coalesce(v_req.context->>'mail_decision','')<>'' then
  update public.stip_change_mail_actions set state='superseded',updated_at=v_now where id=v_mail.id;
  return jsonb_build_object('ok',false,'already_processed',true,'message','Cette demande a déjà été traitée.');
 end if;
 v_comment:=left(btrim(coalesce(p_comment,'')),1000);
 if v_mail.recipient_role='chef' then
  if p_action not in ('chef_favorable','chef_defavorable') then raise exception 'AVIS_CHEF_SEULEMENT'; end if;
  update public.stip_change_mail_actions set state='advised',responded_at=v_now,
    response_action=p_action,response_comment=v_comment,updated_at=v_now
  where id=v_mail.id;
  perform public.stip_request_event_add(v_req.id,'chef_mail_advice',null,'chef_mail',
    v_mail.recipient_name,v_req.status,v_req.status,jsonb_build_object(
      'recipient_contact_id',v_mail.contact_id,
      'recipient_email',v_mail.recipient_email,
      'advice',p_action,'comment',v_comment
    ));
  return jsonb_build_object('ok',true,'outcome','advice_saved','request_id',v_req.id);
 end if;
 if v_mail.recipient_role<>'cadre' then raise exception 'ROLE_NON_AUTORISE'; end if;
 if p_action not in ('accept','refuse','modify') then raise exception 'ACTION_CADRE_INVALIDE'; end if;
 if p_action='modify' then
  if v_req.scenario<>'simple_change' then raise exception 'MODIFICATION_MANUELLE_REQUISE'; end if;
  v_code:=upper(btrim(coalesce(p_new_code,'')));
  if v_code='' or not exists (select 1 from public.stip_shift_definitions where code=v_code and active=true)
    then raise exception 'SHIFT_INCONNU'; end if;
  if v_code=upper(btrim(coalesce(v_req.requester_code,''))) then raise exception 'SHIFT_IDENTIQUE'; end if;
  update public.stip_change_requests set desired_code=v_code,updated_at=v_now where id=v_req.id;
 end if;
 if p_action='refuse' then
  update public.stip_change_requests set status='refused',official_state='refused',
    decision_actor_email=v_mail.recipient_email,decision_comment=nullif(v_comment,''),
    decided_at=v_now,closed_at=v_now,updated_at=v_now,
    context=coalesce(context,'{}'::jsonb)||jsonb_build_object('mail_decision','refused','mail_contact_id',v_mail.contact_id)
  where id=v_req.id;
  v_kind:='refused';
 elsif v_req.scenario in ('simple_change','same_day_exchange') then
  v_result:=public.stip_apply_change_request(v_req.id,null,v_mail.recipient_email);
  update public.stip_change_requests set
    decision_comment=nullif(v_comment,''),
    context=coalesce(context,'{}'::jsonb)||jsonb_build_object(
      'mail_decision',case when p_action='modify' then 'modified' else 'accepted' end,
      'mail_contact_id',v_mail.contact_id
    )
  where id=v_req.id;
  v_kind:='applied';
 else
  update public.stip_change_requests set official_state='approved_pending_manual',
    decision_actor_email=v_mail.recipient_email,decision_comment=nullif(v_comment,''),
    decided_at=v_now,updated_at=v_now,
    context=coalesce(context,'{}'::jsonb)||jsonb_build_object('mail_decision','approved_pending_manual','mail_contact_id',v_mail.contact_id)
  where id=v_req.id;
  v_kind:='manual_followup_required';
 end if;
 update public.stip_change_mail_actions set state='decided',response_action=p_action,
   response_comment=v_comment,response_code=case when p_action='modify' then v_code else null end,
   responded_at=v_now,updated_at=v_now
 where id=v_mail.id;
 update public.stip_change_mail_actions set state='superseded',updated_at=v_now
 where request_id=v_req.id and id<>v_mail.id and state in ('sent','prepared','sending','failed');
 perform public.stip_request_event_add(v_req.id,'cadre_mail_decision',null,'cadre_mail',
   v_mail.recipient_name,v_req.status,
   case when v_kind='applied' then 'completed' when v_kind='refused' then 'refused' else v_req.status end,
   jsonb_build_object('recipient_contact_id',v_mail.contact_id,'recipient_email',v_mail.recipient_email,
     'action',p_action,'outcome',v_kind,'new_code',v_code,'comment',v_comment));
 return jsonb_build_object('ok',true,'outcome',v_kind,'request_id',v_req.id);
end
$function$

revoke all on function public.stip_change_mail_decide(text,text,text,text) from public,anon,authenticated;
grant execute on function public.stip_change_mail_decide(text,text,text,text) to service_role;
revoke all on function public.stip_apply_change_request(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.stip_apply_change_request(uuid,uuid,text) to service_role;
