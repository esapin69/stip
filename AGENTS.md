## Règle de déploiement et de modification
- Travailler uniquement dans le dépôt GitHub existant et modifier les fichiers/mécanismes déjà en place quand ils couvrent le besoin.
- Ne pas lancer d’action directe sur Vercel, ne pas déclencher de déploiement manuel et ne pas modifier la configuration Vercel.
- Éviter de recréer un second système lorsqu’un composant, flux ou mécanisme existant peut être étendu proprement.
- Toute évolution doit passer par le code source GitHub et préserver l’architecture existante sauf nécessité démontrée.

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
- Wheelchair card visual hierarchy is strict: building/hospital first, time second, quantity/status pill third, then floor, service, and optional landmark. Do not repeat the generated sentence when structured wheelchair fields already exist.
- Hospital/building labels are uppercase and visually dominant; the time is intentionally large and immediately readable.
- Message swipe follows the Cloche STIP gesture thresholds. Swipe left on any writable message to open a free reply linked with the existing `reply_to_id` mechanism. Swipe right deletes when the user owns the message or is admin; otherwise it opens the existing reactions picker. Deletion always requires explicit confirmation. Reuse `team_delete`, `team_send`, and the canonical reactions system; do not create duplicate backends.
- Keep wheelchair cards compact and use stronger contrast/saturation. The primary `Je récupère` action must dominate; the two secondary actions stay visually quiet but remain comfortably readable.
- Every chat message and linked reply supports long-press reactions. Offer a compact quick row (`👍 ❤️ 😂 😮 😢 🙏`) plus an explicit “more” chooser. One reaction per agent per message; choosing the same emoji again removes it, choosing another replaces it.
- Keep reactions on the single canonical reaction mechanism. Long-press is primary, with one discreet smile trigger as a mobile fallback; do not create a second reaction store or API.
- Admins can delete any message, regardless of author, through bulk selection and the long-press message sheet. Non-admin server rules remain unchanged.
- Message selection is model-driven: use delegated button controls keyed by message ID, never native checkbox/label state that can race with a rerender. While selection is active, hide the composer and keep the selection bar fixed and tappable above all content.
- Mobile taps must remain stable during live refreshes: signatures use stable stored identifiers (never expiring signed URLs), quiet polling must not rebuild unchanged composer/feed DOM, and a pointer interaction blocks background rerenders until release.
- Opening Chat STIP / Fauteuils lands at the bottom of the conversation so the latest messages are visible above the fixed composer. The primary stock action label is `Je récupère`.
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


- Terrain shortcut rules are curated by the app, not by asking the user to configure every floor. Keep at most four quick spots per level and prefer repeatable physical landmarks over exhaustive service lists.
- Neuro `Bas escalier escargot · salle de pose` exists only on RDC. Cardio uses `Couloir` instead of `Entrée / hall` in the common shortcuts. HFME exposes both elevator sides on every floor; the isolated passerelle stays a 2e shortcut.
- Ice/fire confidence is automatic. Do not ask the user to choose 🧊/🔥 in the publishing flow. Infer persistence from the selected shortcut/free text, then show the existing time-based freshness indicator on the active card; `Toujours là` resets its reference time.

- Optional note dialogs must never autofocus their textarea. Opening `Je n’ai pas trouvé` or the free-reply sheet must not open the mobile keyboard; the keyboard appears only after the user taps the free-text field.
- The secondary presence check is phrased as an action (`Je confirme qu’il/ils sont là`). A successful check must show a visible confirmation beside the freshness timer with the confirmation time, author and `chrono relancé`, because `last_seen_at` resets the freshness reference.
