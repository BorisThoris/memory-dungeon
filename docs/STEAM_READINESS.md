# Steam readiness

Written against the repository, not against a wish list. Every "done" row names the code or the
gate that makes it true; every gap says what is missing rather than when it will land. Update this
file in the same change that moves a row.

The neighbouring documents cover other ground: `STEAM_DEMO_CYCLE.md` is the demo-scoping research
and the demo/full content matrix, `MARKET_SIMILAR_GAMES_RESEARCH.md` the genre comparables. This
file is only about whether the build clears a launch checklist.

## Platform surface

| Item | State | Where |
|---|---|---|
| Full controller support | **Done.** A directional focus driver runs every screen from a pad. Directions move the focus ring by geometry rather than tab order; the board region keeps first refusal on a direction and hands it back at its edge, so the ring is never trapped. | `src/shared/gamepad-input.ts`, `src/renderer/input/`, `src/renderer/hooks/useGamepadNavigation.ts`, `e2e/controller-navigation.spec.ts` |
| Steam Deck resolution | **Verified.** 1280x800 is one of the fit contract's viewports, so all 22 surfaces are held to fitting it with no scrollbar, no sub-12px text, no clipped text and nothing below the fold. | `e2e/ui-fit-contract.spec.ts` |
| Every other resolution | **Verified** at 1440x900, 1024x768, 834x1112, 390x844 and 812x375 by the same contract. | `e2e/ui-fit-contract.spec.ts` |
| Window size and position | **Done.** Restored across launches, clamped back onto a display that still exists, and never stored below the size floor. | `src/main/window-bounds.ts`, `src/main/index.ts` |
| Window modes | **Partial.** Windowed and fullscreen, switchable from Settings and remembered. There is no separate borderless mode; on Windows and Linux Electron's fullscreen is already borderless, so the gap is a macOS one. | `src/main/ipc.ts`, `src/main/startup-display-mode.ts` |
| Steam achievements | **Done.** Twenty, each mapped to a Partner API Name, and switched off in the demo flavour on Valve's own recommendation. | `src/shared/achievements.ts`, `src/main/steam.ts` |
| Steam cloud saves | **Ready to switch on.** Auto-Cloud needs no code in the game, so what was missing was a path that will not drift and a decision about what must not sync. `yarn steam:cloud-config` prints the Partner-site rows from the same constant the save is written with; crash logs are explicitly excluded. `VITE_FEATURE_CLOUD_SAVE=1` at packaging time makes the Settings copy match, and should only be set once the rows are actually saved. | `src/shared/save-location.ts`, `scripts/steam-cloud-config.ts` |
| Localization | **Not implemented, but scoped.** Copy is centralised in `src/renderer/copy/` and the shared catalogs, which is the expensive half. `yarn audit:copy-locality` counts what is still hardcoded in components — **54**, down from 67 — and a gated baseline stops it growing. No lookup layer and no second language yet. | `scripts/copy-locality.ts` |
| Rich Presence | **Done.** A run publishes its mode and floor; anything else reads as in the menus. Pushed only when it changes, never awaited, and a no-op outside Steam. The `#Status_*` tokens still need defining on the Partner site — until then Steam has nothing to render them with. | `src/shared/rich-presence.ts`, `src/renderer/hooks/useRichPresence.ts` |
| Crash reporting | **Local.** Uncaught throws, unhandled rejections, renderer deaths and helper-process deaths write a bounded, redacted record beside the save; the ten newest are kept and the next launch reports how many are waiting. Nothing is sent anywhere — there is no backend and transmitting would need consent. | `src/main/crash-log.ts`, `src/main/crash-reporter.ts` |
| Store page metadata | **Out of repository.** Tracked on the Partner site. | — |
| Colour-blind safety | **Done for the five palettes that carry rules, plus a non-colour channel for traits.** Each trait draws a distinct mark (shape and count) on its rail, listed in the Codex and spoken in the tile's accessible label. Trait, enemy-hazard, hazard-tile, trap-state and interaction-lane colours are each gated against protanopia, deuteranopia and tritanopia. | `src/shared/color-vision.ts`, `tile-trait-palette.test.ts`, `tileBoardThreatColors.test.ts` |

## Content

Counts a player can actually reach, not counts declared somewhere:

| Axis | Count | Note |
|---|---|---|
| Modes | 5 | Classic/Endless, Daily, Puzzle, Gauntlet, Meditation |
| Relics | 22 | 16 pay once at pickup; 6 put a standing rule in force — see `RELIC_ROSTER.md` |
| Mutators | 12 | one full endless cycle |
| Run events | 26 | |
| Floor archetypes | 11 | |
| Wardens | 4 | all four reachable inside a single endless run |
| Achievements | 20 | seven fall out of playing Classic; thirteen point at the rest of the game |

## Dependency advisories

`yarn gate:security` runs `yarn audit` through `scripts/audit-summary.mjs`. It reported **64**
advisories; it now reports **30**, and none of the remaining ones reach a shipped build.

What was fixed, and why each mattered:

| Change | Why |
|---|---|
| electron 41.1.0 -> 41.10.7 | Two advisories patched in 41.2.1. Same major, so no API risk. |
| `**/fast-uri` -> 3.1.7 | Six advisories via `electron-store > conf > ajv`, which validates the save file. 3.1.4 patches them and stays inside ajv's `^3.0.1`, so no major bump. |
| `**/@xmldom/xmldom` -> 0.8.15 | Reached the renderer through `pixi.js`. Patch-level move inside 0.8.x. |
| `axios` resolution 1.16.0 -> 1.20.0 | Nine advisories. The pin was added to fix an older one and had become the thing holding the fix back. |
| `**/fflate` -> 0.8.3 | Appeared upstream under `@types/three` after the baseline was set, and the ratchet caught it. Types-only, so it never shipped; fixed rather than absorbed into a higher baseline. |
| wait-on 9.0.4 -> 9.1.0 | Dev-only; its newer range wants the patched axios. |

The 30 that remain all sit under `eslint`, `vite`, `electron-builder`, `depcheck`, `concurrently`,
`svgo` and `@vitejs/plugin-react` — build-time tools that never ship. Two runtime packages,
`electron-store` and `pixi.js`, used to appear in that list and no longer do.

The gate now says which is which. It fails if **any** advisory reaches a runtime dependency, and
separately if the build-only count grows past a recorded baseline of 30. Before, it failed on any
advisory at all, so it failed permanently, so nobody ran it — which is how 64 accumulated behind a
red light. Lower the baseline whenever a bump clears some; raising it should be a decision written
down in `scripts/audit-summary.mjs` rather than a shrug.

Electron itself is **not** on the newest major (44). Moving three majors is a release-sized change
and is not what a colour-palette or crash-log pass should be dragging along.

## What the gates actually prove

- `yarn test:e2e:ui-fit` (`e2e/ui-fit-contract.spec.ts`) — 22 surfaces x 6 viewports. Four failure modes:
  a scrollbar, text under 12px, text cut off behind a clamp or ellipsis, and content laid out past
  the bottom edge.
- `yarn test:e2e:controller` (`e2e/controller-navigation.spec.ts`) — a stubbed pad against the real screens: the focus ring
  walks the menu, A opens what it lands on, the board flips a tile and the ring can leave it again.
- `yarn test:e2e:startup` — cold load to a pressable main menu at the Steam Deck's 1280x800, plus a
  check that nothing threw during startup. Measured against the **dev server**, so the figure is
  several times a packaged build's and is a regression tripwire rather than a shipping load time.
- `yarn gate:gameplay` — includes a 1000-floor endless simulation and the balance profile bounds.
- `src/shared/floor-schedule-reachability.test.ts` and `achievement-reachability.test.ts` — the
  content census: every mutator, floor archetype, featured objective and relic must be reachable,
  and no achievement threshold may exceed the content that exists. Both were written after finding
  real unreachable content, twice each.

**On e2e flakiness.** The Playwright suite is single-worker because each test drives a real WebGL
board, and on a loaded machine individual specs time out during navigation and pass when re-run
alone — observed here on `controller-navigation` and `gameplay-readability`, both green in
isolation. The helpers already retry with 30-second `toPass` budgets, so this is machine load
rather than a product defect, and the timeouts were deliberately **not** raised to suit one
environment. CI sets `retries: 2`; a local run sets none, so a developer sees the flake and CI
hides it, which is worth knowing before trusting a green CI badge.
- `yarn gate:systems` — module graph, dungeon topology, simulation health, and a 16-seed x
  1000-floor softlock sweep.

## Not yet answered

- **Cloud saves.** The configuration is derived and the exclusions are decided, but nobody has
  entered the rows on the Partner site or packaged a build with the flag on, so no save has ever
  actually round-tripped between two machines. That is the step that proves it.
- **Localization.** Needs a decision on languages before the copy layer is worth building; the cost
  is in extracting the strings, not in the plumbing. Copy is already largely centralised in
  `src/renderer/copy/` and `src/shared/mechanics-encyclopedia.ts`, which is the hard part done.
- **Rich Presence tokens.** The game sends `#Status_Menu`, `#Status_Run`, `#Status_Endless`,
  `#Status_Daily` and `#Status_Puzzle`. Those are localization keys; until they exist on the
  Partner site under Application > Rich Presence, Steam receives them and displays nothing.
- **Crash telemetry.** Records are written locally and never leave the machine, so a crash is
  invisible until a player volunteers the file. Sending them needs a backend and a consent flow.
- **Borderless on macOS.** Electron's `setSimpleFullScreen` is the route; untested here.
- **Legibility of the trait marks at final art scale.** Each trait now draws a distinct mark on
  its rail (three shapes across three counts), measured to fit the rail and to contrast with it on
  all nine colours, and captured on a running board to confirm it renders. Whether one, two and
  three marks are countable at a glance on a 7-inch Deck screen is a judgement to make on real
  hardware, not from a desktop capture.
