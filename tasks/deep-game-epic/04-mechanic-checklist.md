# Everything a new mechanic ships with

This is CLAUDE.md's testing and accountability rules written as a checklist with the real file names, so a ticket can point here instead of restating it. A ticket is not done until every row that applies is ticked in its handoff notes.

## Rules code
- [ ] A rules module in `src/shared/<name>-rules.ts`, pure, deterministic, picking random indexes with `pickRngIndex` from `rng.ts`, never `Math.floor(rng() * n)`.
- [ ] Hooked in the right seam. Match seam order today: restless drift, looking glass, lantern, realm cast, anchor, sticky fingers (`MUTATORS.md`). Mismatch seam: skittish first, then spotlight, magpie, restless. A new hook states where it sits and why, in the module's header comment.
- [ ] `RunState` and `BoardState` fields in `src/shared/contracts.ts`, with a JSDoc line each; a run counter for the census (`<thing>ThisFloor`, `<thing>ThisRun`).
- [ ] `GAME_RULES_VERSION` bumped only when generation, scoring, or seeded offers change (never for a schedule-only change: it reseeds every baseline). `FLOOR_SCHEDULE_RULES_VERSION` for schedule changes, with its bump checklist in `floor-mutator-schedule.ts`.
- [ ] Pinned cards exempt from any movement; the floor's last pair never taken by anything that is not a match (`board-inspection.ts` "a way left to finish").
- [ ] A beat module for the words the board cannot show (`src/renderer/.../<name>Beat.ts`), the way `restlessFloorBeat.ts` and `skittishCardsBeat.ts` do it.

## Player-facing
- [ ] HUD read: a chip, a count, or a rail mark; player-visible writes joined to `feedback.gameplay_hud` by a `displays` edge in the interaction graph.
- [ ] Codex entry in `src/shared/mechanics-encyclopedia.ts`; `ENCYCLOPEDIA_VERSION` bumped when player-facing Codex text changes.
- [ ] Copy centralised in `src/renderer/copy/` or the shared catalogs; `yarn audit:copy-locality` does not grow.
- [ ] Keyboard, controller (`src/shared/gamepad-input.ts`, directional focus driver), touch, reduced motion and screen-reader label considered; a new dock tool joins `runShellToolCatalog.ts` and `e2e/tools-usable.spec.ts`.
- [ ] Colour never says it alone; a new mark on the rail has a shape and is spoken in the tile's accessible label (`color-vision.ts` gates).
- [ ] Fits the viewport contract: `e2e/ui-fit-contract.spec.ts` at 1280x800, 1440x900, 1024x768, 834x1112, 390x844, 812x375.

## Accountability (the gate refuses it otherwise)
- [ ] A node in `src/shared/gameplay-interaction-graph-data.json` (4-space indent, append-only; every `writes` read by some node).
- [ ] A `system-refinement-ledger.ts` entry with `present` tokens that exist in source.
- [ ] A census counter, or an argued exemption over 40 characters ending with a full stop, in `scripts/mechanic-accountability.ts`; the mechanic count in `mechanic-accountability.test.ts`.
- [ ] If it is a `src/shared` module that ships nowhere yet: a runtime importer or a named exemption in `scripts/shared-reach.ts`.
- [ ] A new package script that is a gate is run by a composite gate or declared in `STANDALONE_GATES` (`scripts/gate-reachability.ts`).

## Tests
- [ ] A test hall room in `src/shared/test-hall-rooms.ts`: one authored room, a scripted walkthrough the rules must agree with, naming at least one graph node. Walked at its own seed and at `TEST_HALL_RESEEDS`; a room that reads a random draw says why in `seedPinned`. A step that cannot be played fails the room, never no-ops. Probe the real behaviour with a scratch `tsx` script first and treat a mismatch between rule text and probe as a bug to chase.
- [ ] A soak invariant in `src/shared/run-soak.ts` for any new rule about run state; a new economy item or power counted in the report and required by `run-soak.test.ts`.
- [ ] `yarn sim:endless` plays it on at least two floors; `--deep-floors` for anything that scales with board size.
- [ ] Unit tests beside the rules module; a focused renderer test for a new HUD element.
- [ ] `yarn test:e2e:hall` loads the room; `yarn test:e2e:playtest` after any change a player sees, and **look at the screenshots** in `test-results/playtest/`.
- [ ] Every mechanic checked at least twice, or `TEST_HALL_CHECKED_ELSEWHERE` names where.

## Assets
- [ ] Every new asset a run uses joins `src/renderer/assets/preloadRunAssets.ts`; `e2e/asset-streaming.spec.ts` holds post-board requests at zero.
- [ ] Art from the local models (Z-Image-Turbo or SDXL), positive-only prompts, relightable layers, no backdrops on the ink-and-paper screens. Audio stingers from ACE-Step through `.venv-audio`, chosen by measurement, levelled to -19.3 LUFS, recorded in the jobs file.
- [ ] A painted room is never still: a new room ships with its drift, mist, light and one event (AGENTS.md §3).
- [ ] Anything the combo drives reads `comboDepth` or goes through `comboSoftCap` and is tested out to thousands of links (AGENTS.md §2).

## Before every commit (CLAUDE.md)
1. `yarn docs:system-diagrams`, then `yarn ai:model`, then `yarn ai:model:check` run bare.
2. Graph or encyclopedia changed: `yarn docs:mechanics-appendix`, then `yarn vitest run src/shared/mechanics-catalog-appendix-builder.test.ts -u`.
3. `yarn gate:systems` exits 0, and `yarn vitest run` (re-run `ai-repo-model.test.ts`, `release-checklist.test.ts`, `gate-changed.test.ts`, `gameplay-journal-cost.test.ts` alone if they time out on a loaded machine).
4. A new `docs/**/*.md` needs a row in `docs/internal-wiki/DOCS_CATALOG.md`.
5. Deliver to `main`: commit, fetch and merge `origin/main`, refresh the repo model, re-run the gate, `git push origin HEAD:main` and the branch.
