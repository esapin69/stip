# STIP — Completion discipline

These rules apply to every substantial task in this repository.

## 1. Build the acceptance ledger first
Before editing code, identify every requested change, constraint, previously validated decision, and expected behavior. Convert them into a concrete checklist.

Do not silently drop, reinterpret, postpone, or simplify a requirement.

## 2. Inspect before changing
Read the relevant existing files and understand the current behavior before editing. Reuse the existing architecture and conventions where possible.

For UI work, inspect both the implementation and the user-visible result when tools allow it.

## 3. Execute the whole task
Complete all independent requested changes that can be completed in the current task. Do not stop after the first successful edit or an intermediate milestone.

If one item depends on another, resolve them in the necessary order.

## 4. Verify with evidence
Run the strongest available checks that are relevant to the change, for example:
- build / typecheck / lint
- automated tests
- targeted functional checks
- route and data-flow checks
- responsive/mobile checks
- visual verification when available

Do not claim a check passed unless it was actually executed or directly inspected.

## 5. Check regressions
Verify that existing behavior related to the changed area was not broken, especially navigation, permissions, Supabase access, responsive layout, filtering, loading states, and existing user flows.

## 6. Re-read the original request
Before declaring completion, compare the final result against the original request and the acceptance ledger item by item.

A task is complete only when every item is either:
- verified as done, or
- explicitly reported as blocked / unverifiable with the reason.

## 7. Completion report
When reporting completion, state concisely:
- what changed
- what was verified
- anything still blocked or not verified

Never use “done”, “fixed”, “finished”, or equivalent wording when known requirements remain incomplete.

## 8. No silent assumptions
When a requirement is ambiguous and a wrong assumption could materially change the result, inspect available project context first. If ambiguity still matters, ask instead of inventing.

## 9. Preserve validated decisions
Do not reverse an already validated product or design decision unless the user explicitly approves the change.

## 10. Prefer completion over commentary
For implementation tasks, spend effort on executing and verifying the requested work rather than merely describing what could be done.

## 11. Field intelligence doctrine
Any STIP surface that analyses, summarizes, alerts, recommends, or republishes an analysis must follow the same product rule:

**Reason deeply; speak like the field.**

- Do not present a restatement of visible data as an insight.
- Cross available signals before escalating: staffing by shift, totals, special schedules, events, formations, trainees, requests, and assistant signals when available.
- Look for hidden imbalance, especially when a correct daily total masks a weak shift.
- Prefer one concrete useful conclusion over several generic observations.
- If nothing materially useful is found, say so briefly or stay silent.
- Never turn missing data into a reassuring green state; use an unknown/neutral state.
- Keep decisions human. A proposal is a terrain lead to verify, not an automatic instruction.
- User-facing language has priority over administrative or consultant language: name the moment, the shift, the gap, and what changes in practice.
- Reuse `stip-field-intelligence.js` for shared status, triage and terrain wording instead of creating page-specific scoring rules.
- For the shared three-state signal: `🛑` = critical, `⚠️` = watch, green `✔` = checked/OK. Do not invent a second competing scale without an explicit product decision.


## 12. Chat STIP / Fauteuils — canonical UI contract
The wheelchair workflow lives inside the dedicated routed **Chat STIP** surface.

Current non-negotiable invariants:
- The page header is `Chat STIP` with `Fauteuils` as context; do not add a second large body title.
- The composer exposes two equal compact mode tabs: `J’ai vu` and `Je cherche`. Do not add an `ACTION` heading or explanatory subtitles under those tabs.
- The location chooser stays compact: four building choices around one central `Service / repère` action.
- Do not duplicate direct service/repère search inside every later wizard step. Nested steps are building → quantity/level → place, with short labels.
- Do not render a separate building dashboard above the feed. Building selection exists only in the composer.
- In `Je cherche` mode, selecting a building is sufficient and makes the message ready to send; do not force a level/service/location step.
- Active availability cards use one dominant recovery action plus two compact secondary actions: `Toujours là` and `Pas trouvé`. `Toujours là` stores a timestamped sighting history and shows only the latest sighting inline.
- Every chat message and linked reply supports long-press reactions. Offer a compact quick row (`👍 ❤️ 😂 😮 😢 🙏`) plus an explicit “more” chooser. One reaction per agent per message; choosing the same emoji again removes it, choosing another replaces it.
- Admins can delete any message, regardless of author, through bulk selection and the long-press message sheet. Non-admin server rules remain unchanged.
- The location finder must follow `visualViewport` so the Android/iOS keyboard never covers the search field or traps the results below it.
- Replies such as `Rien trouvé ici` stay visually and structurally attached to their source signalement.
- Message text must never collapse into one-character columns. Preserve `minmax(0,1fr)`, full-width message bodies, and normal word breaking.
- Keep `team-chat.js`, `team-chat.css`, `home-shell.js` and the index asset versions coherent. Mixed versions must self-heal rather than rendering a degraded UI.

## 13. Legend completeness contract
Any STIP surface that contains a legend must explain every informational icon, badge, color marker, or semantic symbol visible on that surface, including symbols that appear in its week, month, digest, or detail sections.

- Do not leave a semantic symbol visible without a matching legend entry.
- Prefer deriving legend entries from the data currently rendered so the legend cannot drift from the page.
- If the same concept appears in multiple sections, explain it once in the page legend.
- Navigation and action controls that are already self-explanatory or labelled (back, refresh, chevrons, phone, calendar action buttons) are controls, not legend entries.
- Keep complete legends compact; completeness must not turn them into oversized one-column blocks.
