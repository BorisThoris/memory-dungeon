# Deep Game Epic: the Descent

## Status
Delivered (2026-10-24): every ticket from DGE-001 to DGE-032 is built, tested and on main, each with its handoff notes and a ledger row; DGE-027 stays open as the standing coverage ticket while the game adds mechanics. Written as a planning pack on 2026-10-19.

## Purpose
This folder turns the deep game plan into tickets that future sessions can pick up one at a time. It answers the owner's finding that the late game does not change: floor 40 plays like floor 4 with more cards, and adding items has not created the pull to go deeper.

Read in this order:

1. [`00-the-plateau-measured.md`](00-the-plateau-measured.md): the four measurements from the repository that define the problem.
2. [`01-research-findings.md`](01-research-findings.md): what survived two adversarially verified research passes, and what was refuted.
3. [`02-deep-game-plan.md`](02-deep-game-plan.md): the Descent in four acts, Dread, the build ceiling, milestones, unlocks, Endless and the Depths.
4. [`04-mechanic-checklist.md`](04-mechanic-checklist.md): everything a new mechanic in this repo must ship with, with the real file names. Every ticket's acceptance criteria point here.
5. [`03-execution-ledger.md`](03-execution-ledger.md): what has been done, what is next.
6. `tickets/`: `DGE-001` to `DGE-032`.
7. The full research reports behind `01`: [`05-research-report-engineering-addiction.md`](05-research-report-engineering-addiction.md) (retention mechanisms, benchmarks, regulation) and [`06-research-report-late-game-escalation.md`](06-research-report-late-game-escalation.md) (escalation structures, with evidence and votes per finding).

## North Star
A run has a shape: four acts to floor 60, each act adding one verb, one card family, one board transformation, one boss with its own rule and one named Dread tier. The run ends at the Warden unless the player built for it. Endless and the Depths ladder open when the Warden falls. Every clear beat shows the next named milestone as a fraction. Nothing is hidden, nothing is a stat the deep game requires, and nothing is a dark pattern.

## Non-Goals
- No manufactured near misses, no hidden difficulty adjustment, no energy, no paid advantage (thesis §25).
- No softening of the miss bank or the doors; runs stay punishing.
- No required power meta: unlocks are sideways (families, verbs, evolutions, rungs), never a stat.
- No online dependency. Endless, the Depths and unlocks are local.
- No reformatting of `package.json` or the interaction graph JSON; those are append-only edits.

## Phases and order
| Phase | Tickets | What it proves |
| --- | --- | --- |
| 0 · Spine | DGE-001 to DGE-007 | The run has acts, an end, a visible next goal and a reason to return. No new mechanics. |
| 1 · Act II | DGE-008 to DGE-012 | Hold, Wanderers, the Fold, the Keeper. The pop hill is repaired. |
| 2 · Camp | DGE-013, DGE-014 | Four relic slots and six evolutions. The Warden has its condition. |
| 3 · Act III | DGE-015 to DGE-018 | Carve, Masks, Layers, the Cartographer. |
| 4 · Act IV | DGE-019 to DGE-023 | Echo, Sleepers, the Spiral, the dungeon that tells you what it learned, the Warden complete. |
| 5 · Meta | DGE-024 to DGE-026 | Feat unlocks, the Depths ladder, tier-gated boss rewards. |
| Cross-cutting | DGE-027 to DGE-032 | Hall and soak coverage, telemetry and achievements, Codex, art and audio, save migration, balance bars. |

Phase 0 ships first and alone. It is mostly schedule and HUD, and it answers "nothing changes" and "nothing ends" before any new mechanic exists. Cross-cutting tickets run alongside every phase; their acceptance criteria are repeated inside each mechanic ticket so nothing is left to a later sweep.

## How future runs should use this pack
1. Read `03-execution-ledger.md`.
2. Pick one unblocked ticket sized for the context window. Phase 0 tickets are independent of each other except where `Depends on` says otherwise.
3. Probe the real behaviour with a scratch `tsx` script before writing a hall room's expectations (CLAUDE.md, test hall).
4. Implement the ticket, run its focused tests, then the pre-commit list in CLAUDE.md: `yarn docs:system-diagrams`, `yarn ai:model`, `yarn ai:model:check` bare, `yarn gate:systems`, `yarn vitest run`.
5. Look at it in the browser (`/__hall`, `yarn test:e2e:playtest` screenshots).
6. Update the ledger and deliver to `main` per CLAUDE.md.

## Ticket index
| Ticket | Phase | Priority | Title |
| --- | --- | --- | --- |
| [DGE-001](tickets/DGE-001-north-star-scope-and-plateau.md) | 0 | P0 | North star, scope, and the measured plateau |
| [DGE-002](tickets/DGE-002-descent-act-schedule.md) | 0 | P0 | Replace the twelve-floor cycle with the sixty-floor Descent schedule |
| [DGE-003](tickets/DGE-003-dread-coefficient-and-tiers.md) | 0 | P0 | Dread: one coefficient, named tiers on the HUD |
| [DGE-004](tickets/DGE-004-milestones-and-clear-beat.md) | 0 | P0 | Milestone fractions on the run bar and the clear beat |
| [DGE-005](tickets/DGE-005-warden-floor-v1.md) | 0 | P0 | The Warden at floor 60, rule-only first version |
| [DGE-006](tickets/DGE-006-endless-gated-mode.md) | 0 | P1 | Endless as an unlocked mode with its own scaling |
| [DGE-007](tickets/DGE-007-results-and-run-summary.md) | 0 | P1 | Results screen and run export carry act, tier and distance |
| [DGE-008](tickets/DGE-008-hold-verb.md) | 1 | P0 | Hold: stack matches, release one cascade |
| [DGE-009](tickets/DGE-009-wanderers-card-family.md) | 1 | P0 | Wanderers: cards that drift and leave a trail |
| [DGE-010](tickets/DGE-010-the-fold-board.md) | 1 | P1 | The Fold: two rooms joined by a doorway |
| [DGE-011](tickets/DGE-011-keeper-of-halls-boss.md) | 1 | P1 | The Keeper of Halls, floor 24 |
| [DGE-012](tickets/DGE-012-pop-hill-repair-measurement.md) | 1 | P0 | Pop share by act with Hold: the band and the gate |
| [DGE-013](tickets/DGE-013-relic-slot-cap.md) | 2 | P1 | Four relic slots and the replacement choice |
| [DGE-014](tickets/DGE-014-relic-evolutions.md) | 2 | P0 | Six relic evolutions, blueprints as boss drops |
| [DGE-015](tickets/DGE-015-carve-verb.md) | 3 | P1 | Carve: aim which way the cascade walks |
| [DGE-016](tickets/DGE-016-masks-card-family.md) | 3 | P1 | Masks: backs that lie until first flipped |
| [DGE-017](tickets/DGE-017-layers-board.md) | 3 | P0 | Layers: a second deck beneath the first |
| [DGE-018](tickets/DGE-018-cartographer-boss.md) | 3 | P1 | The Cartographer, floor 40 |
| [DGE-019](tickets/DGE-019-echo-verb.md) | 4 | P1 | Echo: replay your last three flips free |
| [DGE-020](tickets/DGE-020-sleepers-card-family.md) | 4 | P1 | Sleepers: matched pairs that return unless chained |
| [DGE-021](tickets/DGE-021-the-spiral-board.md) | 4 | P1 | The Spiral: a floor survived, not finished |
| [DGE-022](tickets/DGE-022-dungeon-learns-you.md) | 4 | P1 | The dungeon learns you, and says so |
| [DGE-023](tickets/DGE-023-warden-complete.md) | 4 | P0 | The Warden complete: Hold condition and the evolved relic |
| [DGE-024](tickets/DGE-024-feat-unlock-tree.md) | 5 | P1 | Thirty sideways feat unlocks |
| [DGE-025](tickets/DGE-025-depths-ladder.md) | 5 | P1 | The Depths: twenty rungs after the Warden |
| [DGE-026](tickets/DGE-026-boss-reward-tier-gating.md) | 5 | P2 | Boss rewards gated by door tier |
| [DGE-027](tickets/DGE-027-hall-soak-and-accountability.md) | X | P0 | Hall rooms, soak invariants and the accountability checklist for every mechanic |
| [DGE-028](tickets/DGE-028-telemetry-and-achievements.md) | X | P1 | Reach-curve telemetry and Steam achievements |
| [DGE-029](tickets/DGE-029-codex-and-copy.md) | X | P1 | Codex entries, encyclopedia version and copy locality |
| [DGE-030](tickets/DGE-030-art-audio-and-preload.md) | X | P1 | Art, audio and the preload for every new surface |
| [DGE-031](tickets/DGE-031-save-schema-and-migration.md) | X | P0 | Save schema: unlocks, Endless, Depths, evolutions |
| [DGE-032](tickets/DGE-032-balance-bars-and-sims.md) | X | P0 | Balance bars: run-ending, Goldilocks, curve to floor 60 |

## Cross-links
- `../../CLAUDE.md` and `../../AGENTS.md`: the rules every ticket obeys.
- `../../docs/THESIS_THE_ADDICTIVE_LOOP.md` §25: the line.
- `docs/BALANCE_NOTES.md` Gen 207 and Gen 211: the measurements in `tasks/deep-game-epic/00-the-plateau-measured.md`.
- `../../docs/MARKET_SURVEY.md`: the reach targets.
- `../refined-experience-gaps/REG-018-endless-mode-shipping-plan.md`, `REG-019-relic-build-archetypes.md`, `REG-020-mutator-chapter-identity.md`: earlier tickets this pack supersedes where they overlap.
