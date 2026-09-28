alter table public.stip_conversations
  add column if not exists communication_family text;

update public.stip_conversations
set communication_family = 'brancardage'
where communication_family is null or btrim(communication_family) = '';

alter table public.stip_conversations
  alter column communication_family set default 'brancardage';

alter table public.stip_conversations
  alter column communication_family set not null;

create index if not exists stip_conversations_family_kind_last_idx
  on public.stip_conversations (communication_family, kind, last_message_at desc);

update public.stip_access_profiles
set permissions = jsonb_set(
  coalesce(permissions, '{}'::jsonb),
  '{communication_family}',
  to_jsonb(
    case
      when role_key in ('brancardier','chef_equipe','stagiaire','admin')
        then 'brancardage'::text
      else 'hors_brancardage'::text
    end
  ),
  true
);

update public.stip_access_role_presets
set permissions =
  coalesce(permissions, '{}'::jsonb)
  || jsonb_build_object(
    'communication_family',
    case
      when role_key in ('brancardier','chef_equipe','stagiaire','admin')
        then 'brancardage'
      else 'hors_brancardage'
    end
  )
  || case
       when role_key = 'metiers'
         then jsonb_build_object('messages', true, 'team_chat_mode', 'write')
       else '{}'::jsonb
     end;
