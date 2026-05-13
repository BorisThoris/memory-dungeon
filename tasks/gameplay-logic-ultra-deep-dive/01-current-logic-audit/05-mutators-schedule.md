# Pass 05: Mutators, Schedule, Replay Drift

## Current Map
- `MutatorId` includes 12 IDs; daily table has 9 and excludes some schedule-only mutators.
- Endless/classic schedule is a 12-floor cycle with tags, objectives, archetypes, and optional boss `distraction_channel`.
- Daily uses UTC date plus current rules version and one daily-table mutator.
- Wild is internally endless but skips the schedule via `wildMenuRun`.

## Findings
- **P0/P1:** `FLOOR_SCHEDULE_RULES_VERSION` is not stored on `RunState` or replay/export data; schedule-only compatibility is fragile.
- **P0/P1:** Docs describe a real run export/import API that is absent; current export is a share/journal string.
- **Closed by GLD-P1-001:** Current key is now presented as a local share key (`mode:rulesVersion:seed`), not a reconstructable replay.
- **P1:** Final summary reports only current/final `activeMutators`, not the mutator timeline.
- **P1:** `score_parasite` counter increments on every floor advance but only life-checks on parasite floors, diverging from “active parasite clears” copy.
- **P2:** Mutator docs still describe findables/spotlight as outside the current schedule.

## Task Candidates
- Add structured replay descriptor or rename current output to share summary.
- Add schedule version to run identity if independent schedule compatibility is intended.
- Decide parasite cadence and update code/copy.
- Update schedule docs.

## Verification
- Replay descriptor tests for Classic, Daily, Wild, Meditation, Gauntlet, Scholar, Pin Vow, and Puzzle.
- Schedule compatibility fixture for future schedule edits.

## Refinement Notes
- `Confirmed`: `FLOOR_SCHEDULE_RULES_VERSION` is separate from `runRulesVersion` and is not stored in run state, summary, replay key, or export descriptor.
- `Confirmed`: `buildRunShareKey` is a seed label with an explicitly local-only flip timeline, not reconstructable replay.
- `Confirmed`: stale docs referencing absent `run-export` APIs were corrected where they described current implementation.
- `Likely`: `parasiteFloors` cadence needs a copy/product decision because it increments globally while drain checks active parasite mutator state.
- `Outdated`: findables/spotlight are now in the schedule; older docs saying they are absent from endless cycle need correction when those docs are touched.
