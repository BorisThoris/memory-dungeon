# Gameplay Logic Ultra Deep Dive

## Status
Research pack complete and refined with source-backed evidence statuses.

## Purpose
This pack captures 20 scoped AI research passes over gameplay logic. It does not replace the mechanics catalog, gameplay epics, REG tickets, or source code. It is a consolidation layer for:

- bugs and softlock risks found by current-logic audits,
- doc/code drift that affects gameplay trust,
- hookier expansion ideas that preserve the memory core,
- implementation-ready task specs for the highest-leverage follow-up work.

## Source Rules
- No code implementation was part of these passes.
- Findings should be verified before implementation.
- New mechanics must pass the memory-tax gate from `tasks/gameplay-theorycrafting-epic/README.md`.
- Rule, generation, scoring, save, and schedule changes must follow `docs/agent/GAMEPLAY_RULES_EDIT_MAP.md` and the version-gate policy.

## Evidence Labels
- `Confirmed` means a research pass found a concrete source/test/doc reference.
- `Likely` means source shape supports the concern, but a targeted repro should be added before implementation.
- `Needs Repro` means the issue is plausible but should not be promoted without a failing test or seed.
- `Design Proposal` means the item is an expansion/refactor direction, not a current bug.

## Pass Index

### Current Logic Audit
| Pass | Topic | Output |
| --- | --- | --- |
| 01 | Run lifecycle, timers, pause, advance | `01-current-logic-audit/01-run-lifecycle.md` |
| 02 | Board generation, determinism, fairness | `01-current-logic-audit/02-board-generation-fairness.md` |
| 03 | Flip/match/mismatch resolution | `01-current-logic-audit/03-resolution-matrix.md` |
| 04 | Powers and action economy | `01-current-logic-audit/04-powers-action-economy.md` |
| 05 | Mutators, schedule, replay/export drift | `01-current-logic-audit/05-mutators-schedule.md` |
| 06 | Relics and draft offers | `01-current-logic-audit/06-relic-drafts.md` |
| 07 | Routes, shops, side rooms | `01-current-logic-audit/07-route-world-and-shops.md` |
| 08 | Objectives, scoring, economy | `01-current-logic-audit/08-objectives-economy.md` |
| 09 | Modes, puzzles, replay semantics | `01-current-logic-audit/09-modes-puzzles-replay.md` |
| 10 | Save, achievements, stats | `01-current-logic-audit/10-save-achievements-stats.md` |

### Expansion And Hooks
| Pass | Topic | Output |
| --- | --- | --- |
| 11 | Core memory-tax doctrine | `02-expansion-and-hooks/11-memory-tax-doctrine.md` |
| 12 | First-run-to-first-win | `02-expansion-and-hooks/12-first-run-onboarding.md` |
| 13 | Floor, route, boss identity | `02-expansion-and-hooks/13-floor-route-boss-identity.md` |
| 14 | Card, hazard, pickup families | `02-expansion-and-hooks/14-card-hazard-pickup-families.md` |
| 15 | Relic archetype payoff | `02-expansion-and-hooks/15-relic-archetypes.md` |
| 16 | Objectives, quests, dailies | `02-expansion-and-hooks/16-objectives-quests-dailies.md` |
| 17 | Shop, economy, inventory | `02-expansion-and-hooks/17-shop-economy-inventory.md` |
| 18 | Feedback language and causality | `02-expansion-and-hooks/18-feedback-language.md` |
| 19 | Test, simulation, release gates | `02-expansion-and-hooks/19-test-simulation-matrix.md` |
| 20 | Roadmap ordering | `02-expansion-and-hooks/20-roadmap-order.md` |

## Rollup And Task Specs
- `00-master-rollup.md` ranks the consolidated findings.
- `task-specs/` contains implementation-ready specs for the highest-priority work.
- P0/P1 implementers should start from `00-master-rollup.md`, then read the linked pass and task spec.
