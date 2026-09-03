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
| Localization | **Not implemented.** All player-facing copy is English string literals. The renderer keeps copy in `src/renderer/copy/` and `src/shared/mechanics-encyclopedia.ts`, which is where an i18n layer would attach. | — |
| Rich Presence | **Not implemented.** No status strings are published to Steam. | — |
| Crash reporting | **Local.** Uncaught throws, unhandled rejections, renderer deaths and helper-process deaths write a bounded, redacted record beside the save; the ten newest are kept and the next launch reports how many are waiting. Nothing is sent anywhere — there is no backend and transmitting would need consent. | `src/main/crash-log.ts`, `src/main/crash-reporter.ts` |
| Store page metadata | **Out of repository.** Tracked on the Partner site. | — |
| Colour-blind safety | **Done for the four palettes that carry rules.** Trait, enemy-hazard, hazard-tile, trap-state and interaction-lane colours are each gated against protanopia, deuteranopia and tritanopia. | `src/shared/color-vision.ts`, `tile-trait-palette.test.ts`, `tileBoardThreatColors.test.ts` |

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
- `yarn gate:gameplay` — includes a 1000-floor endless simulation and the balance profile bounds.
- `yarn gate:systems` — module graph, dungeon topology, simulation health, and a 16-seed x
  1000-floor softlock sweep.

## Not yet answered

- **Cloud saves.** The configuration is derived and the exclusions are decided, but nobody has
  entered the rows on the Partner site or packaged a build with the flag on, so no save has ever
  actually round-tripped between two machines. That is the step that proves it.
- **Localization.** Needs a decision on languages before the copy layer is worth building; the cost
  is in extracting the strings, not in the plumbing.
- **Crash telemetry.** Records are written locally and never leave the machine, so a crash is
  invisible until a player volunteers the file. Sending them needs a backend and a consent flow.
- **Borderless on macOS.** Electron's `setSimpleFullScreen` is the route; untested here.
- **A second channel for trait identity.** Trait colours are now measurably distinct under every
  simulated vision, but on a hidden tile the colour is still the only per-trait signal — the
  interaction lanes carry a pattern, traits do not. The board renders glyphs as geometry and has no
  text layer, so this needs new marker shapes rather than a label.
