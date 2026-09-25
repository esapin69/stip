-- Restore secure STIP code verification after the access recovery incident.
-- code_key keeps deterministic lookup; bcrypt code_hash remains the proof.

create or replace function public.stip_verify_code(p_code text)
returns table(profile_id uuid, agent_id uuid, permissions jsonb, active boolean)
language sql
security definer
set search_path to 'public','extensions'
as $function$
  select p.id, p.agent_id, p.permissions, p.active
  from public.stip_access_profiles p
  where p.code_key = encode(digest(trim(coalesce(p_code,'')), 'sha256'), 'hex')
    and p.code_hash = crypt(trim(coalesce(p_code,'')), p.code_hash)
    and p.active = true
  limit 1;
$function$;
