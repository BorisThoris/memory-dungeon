# Completion check (2026-10-24)

The closing audit of the pack: every ticket's acceptance criteria, each with the evidence that meets it.
Each criterion has one of three verdicts:

- **Met**: the evidence named meets it.
- **Owner**: the owner chose otherwise during the build. The choice is recorded in the ticket's notes and the ledger.
- **Superseded**: a later ticket or rule replaced the thing the criterion was about.

Two criteria repeat in every ticket and are checked once here:

- *The checklist rows ticked.* Every ticket's handoff notes carry their `04-mechanic-checklist.md` rows.
- *The CLAUDE.md pre-commit list.* Every delivery ran it: diagrams, model, `ai:model:check` bare, `gate:systems`, the full vitest suite.

Commands are run from the repository root. `soak` means `yarn soak`; the deep soak is `yarn soak --seeds=200 --floors=62`.

| Ticket | Criterion | Verdict | Evidence |
|---|---|---|---|
| DGE-001 | Plateau numbers with their commands; three decisions answered; REG tickets linked | Met | `00-the-plateau-measured.md`; "Open decisions" in the ledger (defaults stand as built); REG-018/019/020 superseded notes |
| DGE-002 | Something new every act | Met | Schedule test over `DESCENT_ACTS` |
| DGE-002 | Floors 1-12 byte-identical | Met | Golden snapshot test |
| DGE-002 | Floors 1-60 reachable | Superseded | Rules 93: the Descent is forty floors picked from the sixty (`descent-length-rules.test.ts`); the sixty stay reachable on the classic numbering (`floor-schedule-reachability.test.ts`) |
| DGE-002 | Codex progression rows list four acts | Met | `progressionRowForEntry` test |
| DGE-003 | Dread monotonic to floor 1000 | Met | `dread-rules.test.ts` |
| DGE-003 | One tier table read by the HUD, the Codex and the results screen | Met | `DREAD_TIERS`; RunShell, Codex and GameOver tests |
| DGE-003 | Dread 80 deals no item under 4; Dread 10 does | Met | `dread-composition-rules.test.ts` (rules 87, the priced table) |
| DGE-003 | Chip fits every viewport | Met | `ui-fit-contract.spec.ts` |
| DGE-004 | Next milestone on every clear | Met | FloorClearBeat tests; playtest screenshots |
| DGE-004 | Next milestone on every camp | Superseded | The camp is automatic, with no screen to show it on |
| DGE-004 | Proportional fraction (0.5 at 6/12 and 32 of 24-40) | Met | `milestone-rules.test.ts` |
| DGE-004 | Every track ends | Met | `milestone-rules.test.ts` |
| DGE-005 | Half of 15%-miss runs end at the Warden | Met | `gate:warden-reach` (bar 50), the Warden on floor 40 from rules 93 |
| DGE-005 | A careful run clears it | Met | Deep soak (careful player felled 26/30) |
| DGE-005 | The re-deal keeps a way to finish | Met | Soak invariant `a way left to finish`, 0 violations |
| DGE-005 | Both rules on the HUD and in the Codex | Met | Crown line test; Codex coverage test |
| DGE-005 | The forgetful player's measurement | Owner | `sim:memory-survival` recorded in BALANCE_NOTES; the owner kept the omniscient bar (2026-10-23) |
| DGE-006 | Endless only after `warden_cleared` | Met | `descendIntoEndless` tests |
| DGE-006 | Deep floors and every board size inspected | Met | `sim:endless --deep-floors` (768 to 4096 pairs); `gate:difficulty-curve-endless` to 120 |
| DGE-006 | Rent shown as the milestone fraction | Met | Milestone cell test |
| DGE-007 | Act, tier and distance on every end; firsts shown | Met | GameOverScreen tests; ui-fit gameOver |
| DGE-007 | Old export strings still import | Met | `run-export` schema test |
| DGE-008 | A release of n pairs is one cascade | Met | `hold-rules.test.ts`; three hall rooms |
| DGE-008 | Pop share 0.6 in Acts II-IV | Owner | Accepted shortfall (BALANCE_NOTES, the Hold probe); `gate:pop-by-act` guards today's numbers |
| DGE-008 | A miss halves the stack, never empties it; the last pair can be held | Met | `hold-rules.test.ts` |
| DGE-008 | Keyboard, controller and touch | Met | `e2e/tools-usable.spec.ts` (Hold, Carve, Reprise) |
| DGE-009 | A Wanderer never steps onto a forbidden cell | Met | `wanderer-rules.test.ts`; soak invariant |
| DGE-009 | A footprint lasts exactly one turn | Met | Wanderer hall room at three seeds |
| DGE-009 | The inspector holds over 200 seeds | Met | Soak 200 x 5, 0 violations |
| DGE-009 | A mark on the back, spoken in the label | Owner | No back mark (nothing face down sets a pair apart). The soles show on the face and are spoken in the label |
| DGE-010 | The doorway gates the cascade | Met | `board-fold-rules.test.ts` |
| DGE-010 | Every Fold floor finishable | Met | Soak; inspector `foldCutsEdge` |
| DGE-010 | Fits every viewport | Met | 6x6 Fold at phone, landscape and desktop (isolated look, 2026-10-23) |
| DGE-011 | The Keeper's swap keeps pairs and pins | Met | Unit tests; soak (1817 swaps) |
| DGE-011 | Rule stated, and in the Codex | Met | Crown line; Codex coverage test |
| DGE-012 | Report in `gate:systems` | Met | `gate:pop-by-act` |
| DGE-012 | Reproduces Gen 211's hill | Met | 0.34 on floors 1-24 |
| DGE-012 | 0.6 after Hold | Owner | As DGE-008 |
| DGE-013 | Never five relics | Met | Soak invariant |
| DGE-013 | Replacing reversible until Descend | Met | Purse choice modal: backing out of the choice is the undo (notes) |
| DGE-014 | Offered only with two rank-3 relics and the blueprint | Met | `relic-evolution-rules.test.ts` |
| DGE-014 | Evolutions occur in average runs | Met | Soak count (117); deep census `deep.evolutions` fires |
| DGE-014 | Each effect unit-tested on its real rule | Met | `relic-evolution-rules.test.ts`, mask and Reprise tests |
| DGE-014 | The camp e2e | Met | `e2e/tools-usable.spec.ts` camp test (2026-10-24) |
| DGE-014 | Six icons | Met | Inline glyphs, `EvolutionGlyph.tsx` and its test (2026-10-24) |
| DGE-015 | A carved pop reaches exactly the predicted cells | Met | `carve-rules.test.ts` on both pop paths |
| DGE-015 | Costs links, never a miss or a turn | Met | `carve-rules.test.ts`; swipe unit test and e2e |
| DGE-016 | A masked card casts its true element | Met | `mask-rules.test.ts` |
| DGE-016 | Never both cards of a pair masked | Met | `mask-rules.test.ts`; soak (7478 masks) |
| DGE-017 | Finishable over both layers | Met | Inspector; soak (964 floors) |
| DGE-017 | A risen card is face down and unknown to the pop | Met | `board-layers-rules.test.ts` |
| DGE-017 | Fits the viewport; type-size audit | Met | ui-fit; tile type audit |
| DGE-018 | The turn keeps pairs and pins; inspector; rule stated | Met | Unit tests (square and odd shapes); soak; crown line |
| DGE-019 | A Reprise replays the same outcomes | Met | `reprise-rules.test.ts` determinism test |
| DGE-019 | No turn beyond the replay | Met | `reprise-rules.test.ts` |
| DGE-020 | Chained Sleepers stay down; the rest wake within four turns | Met | `sleeper-rules.test.ts`; deep soak |
| DGE-020 | Sleepers-only floors finishable | Met | Inspector test; a cleared board wakes them |
| DGE-021 | The Spiral always ends | Met | Deep soak (24 survived, 0 violations); full played-Spiral test |
| DGE-021 | Survive-N and its fraction on the HUD | Met | Crown test |
| DGE-022 | A table of rules, shown before the first flip | Met | `learned-rule-rules.test.ts`; crown line |
| DGE-022 | Same stats give the same rule; never easier or harder by stealth | Met | Same-run test; the told-nothing deal is unchanged |
| DGE-023 | Planned player clears it most often; average sometimes; sloppy rarely | Met | Deep soak (careful 26/30, planned 4/6); BALANCE_NOTES; raging-door playtest fells it |
| DGE-023 | Dying at 58-59 shows distance and condition | Met | Results-line unit test |
| DGE-024 | No unlock changes a number the deep game needs | Met | Unlock-kind test |
| DGE-024 | Every feat has a hall room and a Codex entry | Met | Thirty feat rooms at both seeds; Codex coverage test |
| DGE-025 | Each rung one rule, named on the HUD | Met | Unit test per rung; crown line |
| DGE-025 | Every rung played twice; death Depth recorded | Met | Deep soak at every Depth; survival by Depth; deep census `depthFor` |
| DGE-026 | Deterministic reward; blueprints in order | Met | `boss-reward-rules.test.ts` |
| DGE-027 | Every pack mechanic: room, two walks, ledger, census, writes read | Met | Hall coverage test; `gate:deep-census` (18 counters); `mechanic-accountability.ts` |
| DGE-027 | `gate:systems` green at every phase's end | Met | Every delivery's ship log |
| DGE-028 | Each achievement falls out of Classic | Met | Reach curve played off a Classic run |
| DGE-028 | Results say what disqualifies "perfect" | Met | Results-line test |
| DGE-028 | Partner rows and icons | Met | 62 icons (achieved and locked) and the rows in `project-media/steam/achievements/` (2026-10-24). The upload itself is by hand on the Partner site |
| DGE-029 | Copy-locality and health-claims hold | Met | Both audits at 0 |
| DGE-029 | Every act, tier, evolution, feat and rung in the Codex | Met | Codex coverage test |
| DGE-030 | Asset streaming holds | Met | `e2e/asset-streaming.spec.ts` |
| DGE-030 | Each boss room has drift, mist, light and one event | Met | Boss room and life tests |
| DGE-030 | Reduced motion has a still for every new motion | Met | Reduced-motion tests (seals, seeds, rise, unmask) |
| DGE-030 | The cues are heard and nothing clips | Met | `e2e/deep-cue-levels.spec.ts`: each cue rendered offline from the game's code and held to a band against a match (2026-10-24; four were raised to it) |
| DGE-031 | A save from main loads and keeps the new fields | Met | Schema 10 migration round trip |
| DGE-031 | Save-field policy; cloud config | Met | `audit:save-field-policy`; `steam:cloud-config` |
| DGE-032 | All four bars are gates | Met | `gate:warden-reach`, `gate:pop-by-act`, `gate:goldilocks`, the curve gate (and `gate:difficulty-curve-endless`) |
| DGE-032 | Bar 3 decides which families share a floor | Met | Rules 74: Layers stay off the restless hall; the Spiral is held to the band |

## Outside the pack's bar

The accountability audit has 89 mechanics: 57 answer to a census counter and 32 carry an argued exemption.
All 32 exemptions belong to mechanics that predate the pack (2026-10-19), and every one the pack added has a counter (DGE-027).
The CLAUDE.md checklist and its gates hold any new mechanic to the same bar.

## Not in the repository

- The Steam Partner-site entry: type the rows and upload the icons. It needs the owner's Steamworks sign-in; everything it takes is in `project-media/steam/achievements/`.

The cues' levels are measured and held by a test (DGE-030); whether they please the ear stays the owner's to judge.
