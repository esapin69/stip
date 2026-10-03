# GHE/STIP agent instructions

Read `AGENTS.md` and `ARCHITECTURE_FIRST.md` before substantive work. For UI work also read `VISUAL_MASTERS.md` and `THEME_FIRST.md`.

## Mandatory workflow
1. Build an acceptance ledger from the request.
2. Inspect the canonical source, shared engine/component, consumers and existing tests before editing.
3. Prefer source-of-truth/shared-engine fixes over page-local patches.
4. Preserve validated product decisions and permissions.
5. Remove obsolete layers when they are genuinely replaced.
6. Run the strongest relevant checks and regression checks.
7. Re-read the acceptance ledger before reporting completion.

## Repository constraints
- GitHub source is authoritative. Do not operate Vercel directly.
- Never expose credentials or secrets.
- Do not create a second backend, catalogue, navigation system, notification pipeline, agent directory, shift registry, or other competing source when a canonical mechanism exists.
- Supabase/RLS/auth changes require explicit permission and regression review.
- Never claim a check passed unless it was actually executed.

## Completion
Report: changed / verified / blocked or unverified. A task is complete only when every acceptance item is verified or explicitly reported.
