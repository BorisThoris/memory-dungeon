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
| Steam cloud saves | **Not implemented.** `FEATURE_CLOUD_SAVE` stays false until a real backend exists; saves are local only. Deliberate for a pre-launch demo — Valve's shared cloud will not sync to an unreleased base app. | `src/shared/feature-flags.ts` |
| Localization | **Not implemented.** All player-facing copy is English string literals. The renderer keeps copy in `src/renderer/copy/` and `src/shared/mechanics-encyclopedia.ts`, which is where an i18n layer would attach. | — |
| Rich Presence | **Not implemented.** No status strings are published to Steam. | — |
| Crash reporting | **Not implemented.** A fatal startup failure shows a native dialog and quits; nothing is reported anywhere. | `src/main/fatal-startup.ts` |
| Store page metadata | **Out of repository.** Tracked on the Partner site. | — |

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

- **Cloud saves.** Needs a decision on whether saves move at all before launch.
- **Localization.** Needs a decision on languages before the copy layer is worth building; the cost
  is in extracting the strings, not in the plumbing.
- **Crash reporting.** Nothing is collected today, so a crash in the wild is invisible.
- **Borderless on macOS.** Electron's `setSimpleFullScreen` is the route; untested here.
