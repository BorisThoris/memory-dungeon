# Pass 13: Floor, Route, Boss, Encounter Identity

## Design Map
- Floor identity is centered in `floor-mutator-schedule.ts`: 12-floor cycle, floor tags, objectives, archetypes, copy, palette/audio hooks.
- Route/world generation stamps route specials and consumes pending route plans.
- Run map maps route choices to node kinds and can override scheduled floor identity.
- Boss/elite definitions exist separately from schedule and run-map cadence.

## Weak Spots
- Boss cadence is split: schedule uses 4-floor acts with boss tags at cycle floors 7/9; run map uses 6-floor act length.
- Boss-tagged `trap_hall` floors can prioritize `disarm_traps` objective before `defeat_boss`.
- Route profile budgets are not yet the central allocator for hazards, enemies, rewards, rooms, shops, or objective strictness.
- Composition is “assign if empty,” not an explicit encounter grammar arbiter.
- Safe can be both survival and tempo due to double recovery.
- Boss roster has more definitions than schedule exercises.

## Task Candidates
- Reconcile act length, boss floors, and boss distance.
- Tighten boss objective contract.
- Make Safe/Greed/Mystery budgets operational.
- Add encounter composition planner/report.
- Expand boss/elite content hooks.
- Unify route previews with actual next-board inputs.

## Verification
- 12-floor x 3-route matrix for node kind, floor tag, archetype, objective, profile, boss read model, and preview coherence.

## Refinement Notes
- `Confirmed`: boss cadence is split between the 12-floor schedule and 6-floor run-map act length.
- `Confirmed`: boss-tagged `trap_hall` can prioritize `disarm_traps` before `defeat_boss`; fairness already guards unreachable boss objectives.
- `Confirmed`: a floor identity contract layer now exists in `boss-encounters.ts`, so the pass should build on it rather than inventing a new layer.
- `Likely`: boss roster still exceeds scheduled exercised boss floors.
- Acceptance should require route preview boss distance, schedule tag, generated boss id, objective, and boss score copy to agree for floors 1-12 across route choices.
