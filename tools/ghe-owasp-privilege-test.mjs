import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = file => readFileSync(resolve(root, file), 'utf8');
const sql = load('supabase/migrations/20261102211000_ghe_owasp_privilege_hardening.sql');
const expectedInternalRpcs = [
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
  'public.sync_agent_avatar_media()',
];

const grant = sql.match(/GRANT EXECUTE ON FUNCTION([\s\S]+?)TO service_role;/i)?.[1] ?? '';
const revoke = sql.match(/REVOKE EXECUTE ON FUNCTION([\s\S]+?)FROM PUBLIC, anon, authenticated;/i)?.[1] ?? '';

test('OWASP A01: staffing view is invoker-only and not readable by anonymous roles', () => {
  assert.match(sql, /ALTER VIEW public\.stip_staffing_live SET \(security_invoker = true\);/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.stip_staffing_live FROM PUBLIC, anon, authenticated;/i);
  assert.match(sql, /GRANT SELECT ON TABLE public\.stip_staffing_live TO service_role;/i);
  assert.match(sql, /has_table_privilege\('anon','public\.stip_staffing_live','SELECT'\)/i);
  assert.match(sql, /has_table_privilege\('authenticated','public\.stip_staffing_live','SELECT'\)/i);
  assert.match(sql, /has_table_privilege\('service_role','public\.stip_staffing_live','SELECT'\)/i);
});

test('OWASP A02: all identified internal privileged RPCs are restricted, with server access preserved', () => {
  assert.equal(expectedInternalRpcs.length, 14);
  for (const name of expectedInternalRpcs) {
    assert.ok(grant.includes(name), 'missing service_role grant for ' + name);
    assert.ok(revoke.includes(name), 'missing public revocation for ' + name);
    assert.ok(sql.includes("'" + name + "'"), 'missing postcondition for ' + name);
  }
  assert.match(sql, /has_function_privilege\('anon',protected_rpc,'EXECUTE'\)/i);
  assert.match(sql, /has_function_privilege\('authenticated',protected_rpc,'EXECUTE'\)/i);
  assert.match(sql, /has_function_privilege\('service_role',protected_rpc,'EXECUTE'\)/i);
});

test('auth-gated compatibility RPCs are not disabled without an integration review', () => {
  for (const authGated of [
    'ghe_read_v2', 'dudy_ghe_bridge', 'trading_lab_claim_command', 'trading_lab_complete_command'
  ]) {
    assert.ok(!grant.includes(authGated), authGated + ': unexpected grant rewrite');
    assert.ok(!revoke.includes(authGated), authGated + ': unexpected public revoke');
  }
});

test('migration cannot silently change real users, sessions, shifts or storage', () => {
  const statements = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP)\b/i);
  assert.doesNotMatch(statements, /\b(?:ALTER|CREATE)\s+TABLE\b/i);
  assert.doesNotMatch(statements, /\bstip_access_sessions\b/i);
  assert.doesNotMatch(statements, /\bstip_peer_exchanges\b/i);
  assert.doesNotMatch(statements, /\bstip_planning_change_history\b/i);
  assert.match(statements, /RAISE EXCEPTION 'GHE security guard/i);
});

test('staffing service remains server-side using service role and active-session checks', () => {
  const src = load('supabase/functions/stip-staffing/index.ts');
  assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(src, /from\('stip_access_sessions'\)/);
  assert.match(src, /revoked_at/);
  assert.match(src, /expires_at/);
  assert.match(src, /from\('stip_staffing_advice'\)/);
});

test('existing peer swap guarantees remain in place', () => {
  const peer = load('supabase/functions/stip-change/peer-exchanges.ts');
  const migration = load('supabase/migrations/20261102170000_peer_confirmed_exchange.sql');
  assert.match(peer, /stip_peer_exchange_decide/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /FOR UPDATE/i);
  assert.match(migration, /revoke\s+all\s+on\s+function\s+public\.stip_peer_exchange_decide/i);
  assert.match(migration, /grant\s+execute\s+on\s+function\s+public\.stip_peer_exchange_decide\([^)]*\)\s+to\s+service_role/i);
});
