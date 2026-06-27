# P0–P2 parity closure log

Tracks namespaced task IDs closed during the **2026-04 parity push** (see [`TASKS_CROSSCUTTING.md`](./TASKS_CROSSCUTTING.md) decision log). Rows removed from active tables are listed here so grep stays useful.

## `PLAY-*` namespace (supersedes older closure rows)

Earlier sections of this log listed **`PLAY-*`** IDs as completed during implementation milestones (rail polish, authored SVG cards, staged CSS, etc.). **`PLAY-*` parity vs [`docs/ENDPRODUCTIMAGE.png`](../../ENDPRODUCTIMAGE.png)** is **only** authoritative in [`CURRENT_VS_ENDPRODUCT.md`](../../reference-comparison/CURRENT_VS_ENDPRODUCT.md) **§4** and the backlog in [`PLAYING_ENDPRODUCT/README.md`](./PLAYING_ENDPRODUCT/README.md). Do not infer from historical rows below that every `PLAY-*` ID is closed against the reference still.

## Completed IDs (this push)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **HUD** | `HUD-002`, `HUD-003`, `HUD-004`, `HUD-005` | Centered deck; `GameplayHudBar` extract; daily strip; gauntlet dedupe |
| **SIDE** | `SIDE-002`–`SIDE-007` | IA, abandon, circular chrome, rail order, flyout dedupe |
| **NAV** | `NAV-001`, `NAV-002`, `NAV-003`, `NAV-004`, `NAV-013` | [`NAVIGATION_MODEL.md`](../NAVIGATION_MODEL.md); codex from menu; confirm + pointers; rail exit timer contract |
| **CARD / FX** | `CARD-001`, `FX-004`, `FX-006`, `FX-007`, `FX-016` | DOM check; mismatch motion; hover token doc; policy matrix |
| **DS** | `DS-001`, `DS-008`, `DS-009` | Source Sans 3 + tile fonts; meta tokens in [`theme.ts`](../../../src/renderer/styles/theme.ts) |
| **PERF** | `PERF-001`, `PERF-002` | Quality + bloom + board AA in settings/contracts |
| **META** | `META-001` | `.shellMetaStage` wash |
| **OVR** | `OVR-008` | Z-index ladder in [`App.tsx`](../../../src/renderer/App.tsx) |
| **A11Y** | `A11Y-001`, `A11Y-003`, `A11Y-004`, `A11Y-005` | `<main>`; Tab traps; toast live regions |

## Completed IDs (2026-04 extended — multi-agent implementation pass)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **HUD** | `HUD-007`, `HUD-008`, `HUD-009`, `HUD-010`, `HUD-011`, `HUD-012`, `HUD-014`, `HUD-015`, `HUD-017`, `HUD-018`, `HUD-020` | Parasite art; mutator chip variants; context styling; floor hex + rail chrome; camera viewport preference; narrow wrap; SR announcements; COMPONENT_CATALOG gameplay HUD; e2e testids; distraction vs board stack |
| **SIDE** | `SIDE-008`, `SIDE-010`, `SIDE-013`, `SIDE-014`, `SIDE-018` | Flyout dismiss + layout; freeze/exit parity; power row harmony |
| **CARD / FX** | `CARD-002`, `CARD-003`, `CARD-008`, `CARD-010`, `CARD-012`, `CARD-018`, `CARD-020`, `FX-005`, `FX-006`, `FX-011`, `FX-013`, `FX-017`, `FX-019` | DOM/WebGL flip & lift; resolving order; gambit/pinned stacks; match burst; hover rim; shuffle deal-Z; pair link; score toast timing + rail stack |
| **META** | `META-002`, `META-003`, `META-011` | Game over plate; `MetaFrame`; Choose Your Path frames |
| **OVR** | `OVR-002`, `OVR-005` | Pause/floor header plates; score vs achievement rail stacking |
| **A11Y** | `A11Y-002`, `A11Y-006` | Skip link; `inert` gameplay under blocking overlays |

## Completed IDs (2026-04 continuation — overlays, meta, settings, a11y)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **HUD** | `HUD-001`, `HUD-013` | Wide primary strip `nowrap`; z-index ladder in `App.tsx` + `GameScreen`; short-stacked run settings modal scroll |
| **META** | `META-004`, `META-005`, `META-006`, `META-007`, `META-008` | Main menu primary `MetaFrame`; Codex/Collection/Inventory frames + tiers; Settings rail/header atmosphere |
| **OVR** | `OVR-001`, `OVR-003`, `OVR-004`, `OVR-006`, `OVR-007`, `OVR-009`, `OVR-010`, `OVR-015` | Shared modal tokens + motion; achievement/FTUE surfaces; distraction plate; suppress overlay tests; focus docs; reduceMotion scrim |
| **A11Y / E2E** | `A11Y-007`, `E2E-001` | Heading policy + stacked overlay titles; `e2e/README.md` for `ui-screenshots` |
| **Settings** | *(gap analysis)* | Honest “Gameplay reference” placeholder rows (`SettingsScreen`) + wide-short subsection nav (`subsectionOneAtATime`) for fit-zoom |

## Completed IDs (2026-04 continuation — stage, bloom docs, e2e)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **PERF / FX** | `FX-015` | Bloom docs + high-quality gated CSS rim; post-FX defaults unchanged |
| **E2E** | `E2E-002`, `E2E-003` | `e2e/a11y-intro-pause.spec.ts` — intro dismiss + pause focus/Tab trap |

## Completed IDs (2026-04 — art + overlays + e2e + shell)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **Card textures (implementation milestone)** | shared SVG pipeline | Shipped one shared `authored-card-back.svg` plus face/front texture support; `TILE_TEXTURE_VERSION` 30; motif pivots in `cardArt/constants.ts`. **Open mock parity** remains **`PLAY-007`** in [`PLAYING_ENDPRODUCT/05-cards.md`](./PLAYING_ENDPRODUCT/05-cards.md). |
| **META / OVR** | `META-009`, `OVR-011`, `OVR-012` | Distinct pause / floor / relic header tones + SR copy (`OverlayModal`, `GameScreen`) |
| **E2E** | `E2E-004`, `E2E-005` | `e2e/a11y-toast-gameover.spec.ts`; dev sandbox `unlockAchievements` |
| **HUD** | `HUD-016` | `src/renderer/dev/hudFixtures.ts` + Vitest smoke |
| **App shell** | *(QA)* | In-run **Settings** modal portaled to `document.body` (avoids `zoom` + fixed overlay scroll metrics) |

## Completed IDs (2026-04 — evidence docs, harness, overlays, menu strip, i18n stub)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **Process** | `QA-001`, **HUD-019** (checklist) | `CURRENT_VS_ENDPRODUCT.md` §2/§4/§6 sync; **`VISUAL_REVIEW.md`** HUD-019 / release checklist; ongoing capture gates align with **`PLAY-010`** in [`PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md`](./PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md) |
| **E2E harness** | `visual-screens` reliability | `E2E_USE_SANDBOX_GAMEOVER` + `discoverMismatchPair` / `forceGameOverWithMismatches` settlement polling (`visualScreenHelpers.ts`, `visualScenarioSteps.ts`, `e2e/README.md`) |
| **E2E harness** | `visual-screens` reliability follow-up | Supersedes the game-over sandbox note above: visual smoke now opens deterministic `floorClearWithShop` and `gameOver` fixtures for the shop and game-over captures; live mismatch coverage remains in gameplay-focused specs. |
| **OVR** | `OVR-013`, `OVR-014` | `e2e/overlay-smoke.spec.ts`; achievement toasts after floor-cleared (`GameScreen.tsx`) |
| **META** | `META-010`, `META-012` | In-run inventory/codex desk shell (`App.tsx`, `MetaScreen.module.css`); main menu meta strip `MetaFrame` plaques (`MainMenu.tsx`) |
| **A11Y** | `A11Y-008` (doc) | [`I18N_FOUNDATION.md`](../I18N_FOUNDATION.md) — deferred stack; pointer from `TASKS_A11Y_I18N_E2E.md` |

## Crosswalk (gameplay backlog today)

| Topic | Where |
|-------|--------|
| **`PLAY-*` vs endproduct still** | [`PLAYING_ENDPRODUCT/README.md`](./PLAYING_ENDPRODUCT/README.md) + [`CURRENT_VS_ENDPRODUCT.md`](../../reference-comparison/CURRENT_VS_ENDPRODUCT.md) §4 |
| **Settings reference-only rows** | [`SETTINGS_REFERENCE_CONTROLS_MATRIX.md`](../SETTINGS_REFERENCE_CONTROLS_MATRIX.md) |
| **Deferred asset tasks** | [`TASK-009`](./TASK-009-final-menu-and-gameplay-illustrations.md), [`TASK-010`](./TASK-010-final-logo-and-emblem-lockup.md), [`TASK-018`](./TASK-018-mode-select-card-illustrations.md) |
| **Evidence commands** | [`README.md`](./README.md) parity cadence; detail in [`PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md`](./PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md) |

## Completed IDs (2026-04 — e2e QA hardening)

| Namespace | IDs | Notes |
|-----------|-----|--------|
| **E2E / QA** | touch-target + DOM card fingerprints | `expectMinimumTargetSize` uses layout `offset*` (shell `zoom`); short-landscape **Settings** category rail ≥44px with tightened padding + label-only chips; `tile-card-face-dom.spec.ts` accepts `authored-card-*` + inlined SVG; `yarn test:e2e:visual:smoke` + `yarn test:e2e:renderer-qa` green |

## Still open (optional / process)

- **Ongoing process:** **`PLAY-010`** / **`QA-001`** — backlog and gates in [`PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md`](./PLAYING_ENDPRODUCT/01-evidence-and-working-comps.md); re-run `yarn test:e2e:visual:smoke`, `yarn test:e2e:renderer-qa`, and capture scripts when HUD/board/settings change; **`HUD-019`** — follow [`VISUAL_REVIEW.md`](../VISUAL_REVIEW.md) before release; optional commit of PNGs under `docs/reference-comparison/captures/` per policy.
- **Asset (optional):** **TASK-009** — replace or augment `bg-gameplay-dungeon-ring-v1.png` if art wants a new illustrated arena; vectors + CSS already ship.
- **Backlog tables:** historical P3 rows in [`TASKS_CARDS_VFX_PARITY.md`](./TASKS_CARDS_VFX_PARITY.md), [`TASKS_META_AND_SHELL.md`](./TASKS_META_AND_SHELL.md) (`META-013+`), [`TASKS_DESIGN_SYSTEM.md`](./TASKS_DESIGN_SYSTEM.md) — not blocking Steam demo scope.
- **i18n:** implementation deferred — see [`I18N_FOUNDATION.md`](../I18N_FOUNDATION.md) when scoping v2 locales.

Close by implementation + moving IDs into the tables above.
