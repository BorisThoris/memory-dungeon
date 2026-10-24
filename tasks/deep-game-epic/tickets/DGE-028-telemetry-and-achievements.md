# DGE-028: Reach-curve telemetry and Steam achievements

## Status
Done (2026-10-22)

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

2026-10-22 (no rules change).
- Nine achievements (31 in all), API names equal to their ids (`steam-achievement-api-names.ts`), printed by `yarn steam:partner-config` for the Partner site: ACH_REACH_KEEPER, ACH_REACH_CARTOGRAPHER, ACH_REACH_WARDEN (standing on floors 24, 40, 60, read from `DESCENT_ACTS`), ACH_WARDEN_FELLED (`wardenOutcome` cleared), ACH_ENDLESS_ENTERED (felled and descended), ACH_DEPTH_FIVE/TEN/FIFTEEN/TWENTY (the Warden felled at that Depth or deeper). Each reads state a Classic run already carries; the demo flavour and a test-pace run count none (their existing switch).
- Telemetry: `run_complete` now carries the act reached, the outcome, whether the Warden fell, Endless and the Depth. Counts only; the sink stays host-injected and the payload passes the existing PII filter.
- Results: when a power was used the achievements line says Perfect Clear and the no-powers record did not count, and why (the REG lesson).
- Tests: the reach curve played off a Classic run (`achievement-reachability.test.ts`, including that a run with achievements off earns none), the results line, the catalog and save round-trip suites; the Collection lists 31 in the isolated browser. Codex ENCYCLOPEDIA 116.
- Not done: the Partner-site rows are entered by hand (out of the repository); icons for the nine.

2026-10-23, the icons: Steam's achievement icons are uploaded on the Partner site with the rows (none of the first twenty-two has an icon file in the repository either), so the nine join the hand-entered Partner work rather than the repository.

2026-10-24, the icons, made after all: the Partner site still takes them by hand, but they no longer have to be drawn by hand. `scripts/card-pipeline/steam-achievements.zimage.manifest.json` paints one emblem per achievement (Z-Image-Turbo, on this PC's 3090), and `scripts/card-pipeline/steam-achievement-icons.py` cuts each to Steam's two 64x64 JPGs (achieved, and a dimmed grey unachieved) in `project-media/steam/achievements/`, with the Partner rows printed beside them in `achievements.md`. What is left is the typing and the upload on the Partner site.
