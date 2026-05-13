# Gameplay Logic Ultra Deep Dive: Master Rollup

## Executive Summary
The 20-pass audit found a mature gameplay system with strong unit coverage and rich design vocabulary, but several high-risk gameplay contracts are not tight enough for broad expansion. The most urgent items are not new features: they are softlock prevention, lifecycle guards, replay/export honesty, daily/puzzle persistence, save hardening, and player-facing consequence clarity.

The repeated pattern is clear: many systems are structurally present, but contracts are split between rule helpers, UI fixtures, docs, and read models. Before adding more card families, relic complexity, or economy hooks, the repo should harden the current dungeon loop.

## P0 Fix Now
| ID | Evidence | Finding | Source Area | Acceptance Bar | Primary Spec |
| --- | --- | --- | --- | --- | --- |
| GLD-P0-001 | Confirmed | Stray remove can orphan a normal pair | `applyStrayRemove`, `tileIsStrayEligiblePreview`, fairness inspection | Legal Stray never leaves `real_pair_missing_actionable_tile`; preview and runtime legality match | `task-specs/GLD-P0-001-stray-remove-softlock.md` |
| GLD-P0-002 | Confirmed | Fatal trap reveal can bypass store game-over handling | `flipTile`, `pressTile`, `applyResolvedRun` | One-life fatal trap goes through normal summary/save/achievement handling with no duplicate terminal effects | `task-specs/GLD-P0-002-immediate-trap-gameover.md` |
| GLD-P0-003 | Confirmed | Non-complete runs can be advanced by direct action calls | `continueToNextLevel`, `advanceToNextLevel` | Every non-`levelComplete` status is a no-op; route/relic/shop/side-room advancement still works | `task-specs/GLD-P0-003-lifecycle-advance-guards.md` |
| GLD-P0-004 | Confirmed | Puzzle completion is read but not written | `puzzleCompletions`, puzzle completion/store flow | Clearing a built-in puzzle writes a durable best record and does not continue into procedural floors | `task-specs/GLD-P0-004-puzzle-completion-persistence.md` |
| GLD-P0-005 | Confirmed | Daily completion increments on game over, not clear | `applyResolvedRun`, `mergeDailyComplete`, `ACH_SEVEN_DAILIES` | Failed daily attempts with zero clear do not increment completion, streak, archive, or seven-daily achievement | `task-specs/GLD-P0-005-daily-completion-semantics.md` |
| GLD-P0-006 | Confirmed | Save normalization trusts corrupted values | `normalizeSaveData`, renderer hydration, fallback save client | Bad numeric/object/achievement/puzzle/summary inputs clamp safely; read failure cannot silently overwrite | `task-specs/GLD-P0-006-save-normalization-hardening.md` |

## P1 Stabilize Next
| ID | Evidence | Finding | Acceptance Bar / Follow-Up Note |
| --- | --- | --- | --- |
| GLD-P1-001 | Done | Replay/export is a seed label, not replay | Renamed current behavior to local share key; true replay remains future structured descriptor work |
| GLD-P1-002 | Confirmed | Relic draft can initially open with zero options | Initial open and service-generated offers must never block with `options: []` and `picksRemaining > 0` |
| GLD-P1-003 | Confirmed | Dungeon objective counters leak across floors | Per-floor objective and level-result tags must not read cumulative gateway/treasure counters unless explicitly intended |
| GLD-P1-004 | Done | Floor-clear shops appear fixture-driven | Floor-clear opens only with existing offers; board/shop and route/shop are the natural stock sources |
| GLD-P1-005 | Confirmed | Gauntlet can expire while paused | Either paused time extends deadline or paused gauntlet time burn is explicitly shown and tested |
| GLD-P1-006 | Confirmed | Destroy-charge policy conflicts across code/docs/UI | One stack/cap policy must apply to events, shop, rooms, inventory, clean-clear reward, HUD copy, and tests |
| GLD-P1-007 | Confirmed / Needs Repro | Hazard trigger contracts drift | Mirror Decoy copy/runtime must agree; Shuffle Snare repeat/cursed behavior needs targeted tests |
| GLD-P1-008 | Confirmed / Needs Repro | First-run board and onboarding can overexpose mechanics | First-run targets must filter hazards/exits/decoys/specials/findables unless scripted; E2E should reach floor 2 |
| GLD-P1-009 | Confirmed | Daily archive/objective/quest registries split | Decide one registry or explicit adapters with parity tests; daily archive needs per-date records if presented as history |
| GLD-P1-010 | Confirmed | Balance simulation undercounts live economy | Sim gate must model route/event/room/reward inflow or clearly limit itself to schedule sampling |

## Do Not Expand Before Stable
- New card/hazard/relic/shop families should wait on GLD-P0-001 through GLD-P0-006.
- Route, boss, and economy expansion should wait on GLD-P1-006 and GLD-P1-010.
- True replay, dailies, and puzzle-facing features should treat GLD-P1-001 as a share-key baseline; structured replay remains a separate future contract.

## P2 Expand After Stabilization
- Route profile budgets should become operational generation policy, not only metadata.
- Safe card suite can expand, but only after pair-resolution and hazard contracts are locked.
- Relic archetypes need decision-changing payoffs, not more resource bumps.
- Shop/rest/event/treasure systems need stock pools, source/sink ledgers, and exploit gates.
- Feedback needs in-run causality chips, Perfect Memory cause attribution, and touch-accessible detail.

## Recommended Implementation Order
1. Fix P0 softlock/lifecycle/persistence issues.
2. Add pair-resolution and transition fairness matrix tests.
3. Align replay/export naming or implement structured replay descriptor.
4. Resolve destroy-charge and Daily completion product truth.
5. Tighten hazard contracts and first-run profile.
6. Wire natural shop/side-room/economy loops and objective counters.
7. Upgrade balance simulation and gameplay release gates before economy expansion.
8. Then implement route budget depth, safe cards, relic archetype payoffs, and feedback causality.

## Verification Baseline
Fast gameplay work should run:

```powershell
yarn typecheck:shared
yarn vitest run src/shared/game.test.ts src/shared/softlock-fairness.test.ts
yarn test
```

Economy/route/relic work should add:

```powershell
yarn vitest run src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts
yarn sim:endless --floors=1000 --seed=42001
```

Interlude/UI work should add:

```powershell
yarn test:e2e:playable-path:full
yarn test:e2e:renderer-qa
```

## Implementation Closeout
- Done: GLD-P0-001 through GLD-P0-006 and GLD-P1-001 through GLD-P1-004.
- GLD verification command bundle:

```powershell
yarn typecheck:shared
yarn vitest run src/shared/run-history.test.ts src/shared/game.test.ts src/renderer/store/useAppStore.test.ts src/shared/playable-path-fixtures.test.ts
yarn test
```

- Verified with `yarn typecheck:shared`, focused Vitest coverage for gameplay/save/relic/objective/store/contracts, and full `yarn test`.
