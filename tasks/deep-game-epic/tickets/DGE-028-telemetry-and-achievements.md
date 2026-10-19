# DGE-028: Reach-curve telemetry and Steam achievements

## Status
Not started

## Priority
P1

## Phase
Cross-cutting

## Subsystem
Meta

## Depends on
- `DGE-002`
- `DGE-005`

## Current repo context
- `achievements.ts` (Partner API names, off in the demo flavour), `telemetry.ts` (privacy-first, no-op in production unless a host injects a sink), `docs/STEAM_READINESS.md`, `docs/MARKET_SURVEY.md` (the ladder-top and daily-reach figures).

## Problem
The plan sets reach targets (floor 24 by ~40% of owners, floor 40 by ~15%, the Warden by ~8%, Depth 20 by ~1 in 12). They are only checkable if they are achievements.

## Target experience
Achievements for reaching each act boss, beating the Warden, entering Endless, and each fifth Depth, so Steam's global stats publish our reach curve in the same table as the comparables. Telemetry counts completions only, never ranks players.

## Implementation notes
- New rows in `achievements.ts` with Partner API names; demo flavour keeps them off.
- `trackEvent` payloads for act reached and outcome; no PII; the sink stays host-injected.

## Acceptance criteria
- Each new achievement falls out of playing Classic (no mode required).
- The results screen explains what disqualifies "perfect" style achievements (REG lesson).
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `achievements.test.ts`; save round-trip.

## Risks and edge cases
- Partner-site rows are out of repository; the steam cloud config script pattern (`yarn steam:cloud-config`) could print them.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
