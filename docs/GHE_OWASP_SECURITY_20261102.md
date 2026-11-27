# GHE — OWASP security hardening (preparation, NOT deployed)

Status: **draft security PR; production left unchanged.** Audit date: 2026-11-02. Supabase: Stip.eSapin (`yzsrmuxghlengnkyphxj`). GitHub repo: `esapin69/stip`.

## Verified baseline (read-only)

- **A01 / A02 — confirmed exposure:** `public.stip_staffing_live` is owned by `postgres`, has no `security_invoker` option, and `anon` / `authenticated` have `SELECT`. A `SET LOCAL ROLE anon` read-only SQL permission check confirmed the view is readable without a STIP session. At the time of the audit the view contained **398 staffing reference records**. No individual rows were retrieved.
- **A02 — confirmed broad privileges:** Supabase Security Advisor reports **18 SECURITY DEFINER functions** executable by `anon` and `authenticated`. **14** are maintenance/trigger routines restricted by the proposed migration; **4** token-gated compatibility endpoints are deliberately unchanged pending integration review.
- **Access protections already present:** RLS is enabled on the exposed base tables, many sensitive tables have zero public policies, private Supabase Storage buckets exist, the main STIP session APIs validate session hash, expiration, revocation, and profile, and PIN login tracks failed attempts. An RLS-enabled table with no policies is generally default-deny, **not** evidence of public data exposure.
- **Supabase Auth leaked-password protection** is disabled; this applies to Supabase Auth passwords, not necessarily to custom STIP PINs.
- **49/68 deployed Edge Functions** have `verify_jwt=false`. Some deliberately use custom STIP session enforcement; each endpoint must be reviewed separately. It would be incorrect to label all 49 vulnerable from this flag alone.
- The GitHub repository is public; no secret exposure was established in this review.

## Proposed scope

`supabase/migrations/20261102211000_ghe_owasp_privilege_hardening.sql`:

1. Set `security_invoker=true` on `public.stip_staffing_live`.
2. Revoke public and authenticated direct privileges on that view; explicitly preserve `service_role` access.
3. Revoke public EXECUTE on fourteen internal SECURITY DEFINER RPCs, including avatar refresh, staffing import/refresh, access reconciliation, and internal triggers. Explicitly preserve `service_role` EXECUTE for server-side jobs.
4. Fail the migration if any resulting direct anonymous access remains, or if the privileged service role loses its required permissions.
5. **Never touches** agents, shifts, peer-exchange rows, sessions, PINs, roles, tokens, or storage objects.

The deployed `stip-staffing` Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` server-side and checks STIP sessions; the migrated view should therefore remain functional for the legitimate server. This is **architectural evidence**, not an executed production regression test.

The four intentionally preserved privileged RPCs are `ghe_read_v2`, `dudy_ghe_bridge`, `trading_lab_claim_command` and `trading_lab_complete_command`. Their bearer-token guards need independent tests for exposure, token entropy, rotation and replay prevention before attempting any permission change. Do **not** revoke them blindly: existing integrations could rely on anonymous-RPC + application-token authorization.

## Automated checks (no database writes)

`tools/ghe-owasp-privilege-test.mjs` checks least-privilege migration clauses, all fourteen function signatures, service-role grant retention, non-destructive scope, the staffing Edge's server-session checks, and existing peer-exchange invariants.

`.github/workflows/ghe-full-audit.yml` runs this test on security migration changes, while retaining all existing GHE UI, exchange, planning-import and navigation tests.

These are **static / contract regressions**. They cannot prove DB migration execution, authenticated flows, browser XSS/CSRF hardening, dynamic injection safety or security against an external attacker.

## Required release gate (not authorized by this PR)

1. Obtain **new, separate approval** for any deployment, database change, merge, or nonzero cost. Do not apply SQL merely because a draft PR exists.
2. Review the 14 RPC consumers and privileged job identities. Verify that all authorized callers use `service_role` on the server. Review the deployed version, not only the repository copy.
3. Use a disposable local Postgres/Supabase environment to apply the migration, verify zero anonymous SELECT / EXECUTE, and test service-role callers. No staging project should be provisioned if it would incur credits or charges without approval.
4. Review regression results: anonymous view denied; server staffing reads allowed for a legitimate STIP profile; denied for an unprivileged profile; existing personal planning and ICS untouched; peer swaps remain atomic; admin import, avatars and background staffing jobs still work.
5. Only after that gate, apply in one approved transaction and re-run Supabase Security Advisor, inspect errors, run UI flows, and verify that the view is no longer readable as `anon`.
6. Prefer **fix-forward** for an accidental permission regression. Never restore public SELECT on the staffing view just to restore an app screen: it would reintroduce the confirmed exposure.

## Residual issues / subsequent batches

- Audit all 49 JWT-unverified Edge Functions for actual server-side session checks, CORS, input validation, abuse throttles and authorization by ownership / role.
- Review custom six-digit STIP PIN storage, rate limits and brute-force protection separately. Changing PIN storage needs data migration and compatible login logic; **not included** in this no-risk PR.
- Review session persistence in browser storage, XSS entry points, storage signed-URL expiry, PDF/ICS sharing, data minimization and audit logging. Privileged operations should remain server-side.
- Switch on Supabase Auth leaked-password protection only after verifying account compatibility and with separate approval.
- Track A03 dependencies and lockfiles, A05 injection, A08 integrity, A09 detection and A10 errors with code scanning and dynamic functional testing.

Official background: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/observability/advisors and https://owasp.org/Top10/2025/.
