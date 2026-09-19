-- STIP uses service-role Edge Functions behind X-STIP-Session.
-- These operational sources must not bypass that application security layer.

alter view public.stip_staffing_advice
  set (security_invoker = true);

alter view public.stip_assistant_output
  set (security_invoker = true);

revoke all on public.stip_staffing_advice from anon, authenticated;
revoke all on public.stip_assistant_output from anon, authenticated;

alter table public.stip_referent_aliases enable row level security;
revoke all on public.stip_referent_aliases from anon, authenticated;

grant select on public.stip_staffing_advice to service_role;
grant select on public.stip_assistant_output to service_role;
grant all on public.stip_referent_aliases to service_role;
