# ECC-inspired workflow for GHE/STIP

This repository adopts the useful engineering discipline of Everything Claude Code without coupling GHE/STIP to one AI vendor.

The existing contracts remain authoritative: `AGENTS.md`, `ARCHITECTURE_FIRST.md`, `THEME_FIRST.md`, `VISUAL_MASTERS.md`, `COMMUNICATION_RULES.md`, and domain contracts.

## Pipeline
DISCOVER → PLAN → IMPLEMENT → VERIFY → REVIEW → LEARN

### DISCOVER
Read the applicable contracts. Identify the source of truth, shared engine/component, consumers, permissions, tests, deployment path, and regression surface.

### PLAN
Write a small acceptance ledger. Separate requested behavior from implementation. Mark risky changes: auth/RLS, destructive data operations, public contracts, navigation, service worker/cache, shared components.

### IMPLEMENT
Make the smallest architectural change that solves the whole requirement. Prefer canonical fixes. Do not stack temporary overrides or duplicate mechanisms.

### VERIFY
Use relevant automated tests, syntax/build checks, route/data-flow checks, mobile/responsive checks, permissions/RLS checks, and visual inspection when available. Record what was actually run.

### REVIEW
Review the diff for regressions, duplication, secrets, unsafe permissions, stale layers, cache/build-version coherence, and deviations from validated decisions.

### LEARN
If a task reveals a reusable invariant, update the appropriate existing contract rather than creating scattered notes. Do not promote an experimental pattern to a canonical rule without explicit product validation.

## Agent roles
These are responsibilities, not separate mandatory tools:
- Planner: acceptance ledger, architecture map, risk.
- Implementer: minimal coherent change.
- Reviewer: regression, security, duplication, consistency.
- Verifier: tests and user-visible evidence.
- Librarian: durable rules in canonical documentation.

One agent may perform all roles, but must not skip them.

## Definition of done
Every acceptance item is either verified or explicitly blocked/unverified. No completion claim based only on code edits.
