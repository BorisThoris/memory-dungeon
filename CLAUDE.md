# Memory Dungeon: rules for Claude sessions in this repo

A React + three.js memory-card roguelike (TypeScript, zustand, vitest, Playwright, Vite, Electron).
Rules here are the owner's decisions and the lessons that cost real time. They override defaults.

## Delivery

- Finished work goes to `main`: commit on the working branch, `git fetch` and merge `origin/main`,
  refresh the repo model, re-run the gate, then `git push origin HEAD:main` (and the branch). If the
  push is rejected because main moved (the meta-bot commits often), merge again and retry.
- Never reformat `package.json` or the graph JSON by rewriting the whole file: insert lines. The
  graph (`src/shared/gameplay-interaction-graph-data.json`) is 4-space indented and append-only in
  practice; a diff that is not pure additions is a formatting accident.
- Shell edits that contain backticks, `${}` or quotes: write a `.cjs` script to the scratchpad and
  run it with `node`, rather than a heredoc.

## Before every commit

1. `yarn docs:system-diagrams` (new files or import edges change the counts), then `yarn ai:model`
   (it hashes the diagrams, so this order). Check with `yarn ai:model:check` run bare, not piped
   through `grep`/`tail`, whose exit code would hide a stale model.
2. If the interaction graph or the encyclopedia changed: `yarn docs:mechanics-appendix`, then
   `yarn vitest run src/shared/mechanics-catalog-appendix-builder.test.ts -u`.
3. `yarn gate:systems` must exit 0. It does not run the whole unit suite, so also run
   `yarn vitest run` (or `yarn verify`). `ai-repo-model.test.ts`, `release-checklist.test.ts` and
   `gate-changed.test.ts` time out when the machine is loaded: re-run them alone before believing it.
4. Player-facing Codex text changed: bump `ENCYCLOPEDIA_VERSION` in `mechanics-encyclopedia.ts`.
   A new `docs/**/*.md` file needs a row in `docs/internal-wiki/DOCS_CATALOG.md`.
5. Do not bump `GAME_RULES_VERSION` for a schedule-only change: it reseeds every baseline.

## Testing and bug avoidance (the tooling to use, not just to keep green)

- **Test hall** (`src/shared/test-hall-rooms.ts`): one authored room per mechanic with a scripted
  walkthrough the rules must agree with. Dev route `/__hall` (Play, Run all, graph coverage),
  `/?hallRoom=<id>` boots a room, `window.__memoryDungeonE2e.startTestHallRoom(id)` is the seam,
  `yarn test:e2e:hall` loads every room in a browser. **A new or changed mechanic gets a room
  first**; probe the real behaviour with a scratch `tsx` script before writing the expectations,
  and treat a mismatch between the rule text and the probe as a bug to chase (that is how Heavy's
  dead miss penalty was found). A step that cannot be played must fail the room, never no-op.
- **Soak** (`yarn soak [--seeds=200]`, `src/shared/run-soak.ts`): whole runs by four players
  (careful, average, sloppy, and one on the Wild setup who plays the joker), every action checked
  against named invariants, including the board inspector's "a way left to finish" (it caught the
  wild softlock). A new rule about run state gets an invariant there, and a new economy item or
  power gets counted in the report and required by `run-soak.test.ts`.
- **Every mechanic in the graph** must also have: a `system-refinement-ledger.ts` entry with
  `present` tokens that exist in source; a census counter or an argued exemption (over 40
  characters, ending with a full stop) in `scripts/mechanic-accountability.ts`; the mechanic count
  in `mechanic-accountability.test.ts`; every `writes` read by some node; player-visible writes
  joined to `feedback.gameplay_hud` by a `displays` edge. Every hall room names at least one
  node (tested); the hall's coverage panel lists the mechanics still without a room - shrink it.
- Shared rule code picks random indexes with `pickRngIndex` (`rng.ts`), never `Math.floor(rng() * n)`.
- A new `src/shared` module that ships nowhere needs a runtime importer or a named exemption in
  `scripts/shared-reach.ts`; one reached only by tests needs a script (`audit:test-only-modules`).
- A new package script that is a gate must be run by a composite gate or declared in
  `STANDALONE_GATES` (`scripts/gate-reachability.ts`).

## Driving the app

- Playwright's config serves on 5173. Headless probing: `page.evaluate` with
  `(await import('/src/renderer/store/useAppStore.ts')).useAppStore`, pass real functions (the CSP
  forbids `new Function`), give a cold Vite load `goto` timeouts of 180s. Restart the dev server
  after editing source: HMR serves a second store instance.
- The desktop Browser pane: `requestAnimationFrame` does not fire and a hidden pane is 0x0; front the
  tab and `resize_window` before measuring. If it will not navigate, fall back to headless Playwright.
- Known pre-existing e2e failure on this machine: `e2e/gameplay-hud-layout.spec.ts` at 620x900 and
  560x900.
- A fresh worktree needs `node_modules` junctioned to the main checkout's; if it looks half
  installed, another session is running `yarn install` - wait, do not reinstall over it.

## Game design decisions (the owner's, do not re-litigate)

- **Runs are punishing.** The miss bank (`miss-bank.ts`): 3 to open, +1 per floor clear, +1 per
  fifth link of a chain, each grant good for 3 floors, cap 4 (5 with Deep Pockets). A miss costs
  what the turn charged in tries (two on a Heavy card); a miss on an empty bank ends the run. Do
  not soften survival by appeal to an older "a bad floor is never punishing" thesis.
- **The store is a stop**, opened on the floor-clear beat every third floor
  (`STORE_STOP_EVERY_FLOORS`), continued with Descend. It sells misses, peeks, shuffles, bombs and
  three relics (Deep Pockets, Gilded Chain, Long Look). Not a pause-menu screen, not a door.
- **Bombs** are aimed at the one face-up card, take its pair with no turn, miss or score, and never
  take the floor's last pair.
- **Mutators iterate during play** on a clock the player winds (turns, misses, matches) and show on
  the board; static generation swaps were rejected.
- Before tuning the pop, measure the matched vs popped share of a floor, not pairs per match.
- Only `classic` and `pass_and_play` ship; do not restore removed modes or their art.

## Local models (see the global CLAUDE.md for the full inventory)

This PC's RTX 3090 runs them offline; prefer them to paid APIs and to inventing content by hand,
and say which one was used.

- Summaries of files, logs and diffs, per-item batch work, first drafts, and **composition as data**
  (a test hall room layout, a palette, copy variants): the `local-llm` MCP (`delegate`,
  `delegate_batch`). Its output is untrusted: validate it and run the tests.
- Music and stingers: ACE-Step 1.5 through the repo's `.venv-audio` (evict the Ollama model first).
- Art: Z-Image-Turbo or SDXL; TTS: Kokoro; 3D: Hunyuan3D. Art rules: positive-only prompts,
  relightable layers, and no backdrops on the ink-and-paper screens (Collection, Codex, Profile,
  Inventory, Settings).
