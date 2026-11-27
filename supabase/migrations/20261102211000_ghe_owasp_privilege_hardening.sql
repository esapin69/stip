-- GHE / STIP — OWASP A01 + A02 : least-privilege patch (2026-11-02).
-- PREPARATION ONLY. Never run this against production without a separate approval.
-- This migration is intentionally additive / non-destructive: no row changes,
-- no auth-code rotation, no session invalidation, no user or planning updates.
-- Supabase diagnostic (2026-11-02): public.stip_staffing_live used
-- SECURITY DEFINER view-owner privileges and had SELECT for anon/authenticated.
-- The GHE staffing Edge Function uses a service-role server client.

-- 1. Close the anonymous view bypass. Both controls are deliberate:
--    security_invoker prevents bypassing underlying table RLS;
--    REVOKE closes direct Data API access even if underlying RLS changes.
ALTER VIEW public.stip_staffing_live SET (security_invoker = true);
REVOKE ALL PRIVILEGES ON TABLE public.stip_staffing_live FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stip_staffing_live TO service_role;

-- 2. Restrict unsafe definer RPCs that are internal maintenance or trigger
--    functions. Re-grant to service_role explicitly before removing PUBLIC:
--    PostgreSQL service_role may currently inherit EXECUTE from PUBLIC.
--    Trigger execution is internal and does not require anonymous RPC grants.
GRANT EXECUTE ON FUNCTION
  public.on_agent_avatar_identity_change(),
  public.on_avatar_storage_change(),
  public.refresh_agent_avatars(),
  public.resolve_agent_avatar_for_object(text),
  public.stip_apply_staffing_refs_for_batch(uuid),
  public.stip_cleanup_action_notifications(),
  public.stip_cleanup_signature_action_notifications(),
  public.stip_reconcile_access_trigger(),
  public.stip_reconcile_access_with_planning(),
  public.stip_refresh_staffing_signals(date, date, text),
  public.stip_staffing_batch_committed_trg(),
  public.stip_sync_active_app_to_admin(),
  public.stip_sync_calendar_feeds(),
  public.sync_agent_avatar_media()
TO service_role;
REVOKE EXECUTE ON FUNCTION
  public.on_agent_avatar_identity_change(),
  public.on_avatar_storage_change(),
  public.refresh_agent_avatars(),
  public.resolve_agent_avatar_for_object(text),
  public.stip_apply_staffing_refs_for_batch(uuid),
  public.stip_cleanup_action_notifications(),
  public.stip_cleanup_signature_action_notifications(),
  public.stip_reconcile_access_trigger(),
  public.stip_reconcile_access_with_planning(),
  public.stip_refresh_staffing_signals(date, date, text),
  public.stip_staffing_batch_committed_trg(),
  public.stip_sync_active_app_to_admin(),
  public.stip_sync_calendar_feeds(),
  public.sync_agent_avatar_media()
FROM PUBLIC, anon, authenticated;

-- Deliberately NOT touched: public.ghe_read_v2 / public.dudy_ghe_bridge /
-- public.trading_lab_* have application-specific bearer-token gates; removing
-- their RPC grants without confirming each external caller could break GHE.
-- Follow-up review must verify token strength, rotation, and caller identity.
-- Also not touched: password/PIN vault, storage buckets, or live sessions.

-- 3. Transactional postcondition checks. An unsafe partial migration must fail.
DO $owasp_guard$
DECLARE
  protected_rpc regprocedure;
  protected_rpcs text[] := ARRAY[
    'public.on_agent_avatar_identity_change()',
    'public.on_avatar_storage_change()',
    'public.refresh_agent_avatars()',
    'public.resolve_agent_avatar_for_object(text)',
    'public.stip_apply_staffing_refs_for_batch(uuid)',
    'public.stip_cleanup_action_notifications()',
    'public.stip_cleanup_signature_action_notifications()',
    'public.stip_reconcile_access_trigger()',
    'public.stip_reconcile_access_with_planning()',
    'public.stip_refresh_staffing_signals(date, date, text)',
    'public.stip_staffing_batch_committed_trg()',
    'public.stip_sync_active_app_to_admin()',
    'public.stip_sync_calendar_feeds()',
    'public.sync_agent_avatar_media()'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='stip_staffing_live'
      AND c.relkind='v' AND 'security_invoker=true'=ANY(c.reloptions)
  ) THEN
    RAISE EXCEPTION 'GHE security guard: staffing view must be security_invoker';
  END IF;
  IF has_table_privilege('anon','public.stip_staffing_live','SELECT')
    OR has_table_privilege('authenticated','public.stip_staffing_live','SELECT') THEN
    RAISE EXCEPTION 'GHE security guard: public staffing view remains readable';
  END IF;
  IF NOT has_table_privilege('service_role','public.stip_staffing_live','SELECT') THEN
    RAISE EXCEPTION 'GHE security guard: service_role lost staffing view access';
  END IF;

  FOR protected_rpc IN
    SELECT signature::regprocedure
      FROM unnest(protected_rpcs) AS rpc_list(signature)
  LOOP
    IF has_function_privilege('anon',protected_rpc,'EXECUTE')
      OR has_function_privilege('authenticated',protected_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'GHE security guard: unintended public RPC access to %',protected_rpc;
    END IF;
    IF NOT has_function_privilege('service_role',protected_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'GHE security guard: service_role lost RPC access to %',protected_rpc;
    END IF;
  END LOOP;
END
$owasp_guard$;
