# End-product parity — research-backed task index

This folder holds **refined implementation tasks** derived from **multi-agent codebase audits** (parallel read-only exploration) plus manual consolidation. Use these as the working backlog for closing the gap to `docs/ENDPRODUCTIMAGE.png` and `docs/reference-comparison/CURRENT_VS_ENDPRODUCT.md`.

**Gameplay endproduct backlog:** open **`PLAY-*`** work lives only in [`PLAYING_ENDPRODUCT/README.md`](./PLAYING_ENDPRODUCT/README.md) (aligned with [`CURRENT_VS_ENDPRODUCT.md`](../../reference-comparison/CURRENT_VS_ENDPRODUCT.md) §4). **Deferred asset holdouts** remain in numbered docs **[`TASK-009`](./TASK-009-final-menu-and-gameplay-illustrations.md)** (menu/gameplay illustrations), **[`TASK-010`](./TASK-010-final-logo-and-emblem-lockup.md)** (logo/emblem), **[`TASK-018`](./TASK-018-mode-select-card-illustrations.md)** (mode posters). Asset drop-ins: [`DROP_IN_ASSET_CHECKLIST.md`](../DROP_IN_ASSET_CHECKLIST.md).

## How these tasks were produced

### Pass 1 (four agents)

Gameplay **HUD**, **sidebar** / `gameplayIcons`, **TileBoard** DOM+WebGL / shuffle, **`assets/ui`** & core Playwright specs.

### Pass 2 (six agents)

**Meta screens** (non–GameScreen shell), **Zustand view navigation** & freeze/timer contract, **overlays** / FTUE / toasts / distraction, **design tokens** vs `VISUAL_SYSTEM_SPEC`, **graphics performance** (DPR, SMAA, Pixi), **a11y / i18n / full e2e inventory** & flakes.

### Consolidation rules

- Normalized **ID namespaces** (no collisions).
- Added **acceptance criteria** and **deps** per task.
- **Cross-linked** overlapping work (e.g. `META-009` ↔ `OVR-002`, `SIDE-003` ↔ `NAV-003` / `NAV-013`).

## Parity evidence cadence (`PLAY-010` / `QA-001`)

Use this whenever gameplay HUD, sidebar, or tile chrome changes, or before a release that claims endproduct parity.

| Step | Command | Output / gate |
|------|---------|----------------|
| 1 — HUD + board crops | `yarn playwright test e2e/hud-inspect.spec.ts e2e/visual-endproduct-parity.spec.ts --workers=1` | `test-results/endproduct-parity/` (`hud-element.png`, `hud-metrics.json`, `hud-fragment.html`, tile crops). Override dir: `cross-env VISUAL_CAPTURE_ROOT=<dir> ...` |
| 2 — Full scenario stills | `cross-env VISUAL_CAPTURE_ROOT=docs/reference-comparison/captures yarn playwright test e2e/visual-screens.standard.spec.ts --workers=1` (Windows: `npx cross-env …` or PowerShell `$env:VISUAL_CAPTURE_ROOT=…`) | Desktop + tablet captures for `CURRENT_VS_ENDPRODUCT.md` map; `08-game-over` uses the deterministic game-over fixture. |
| 3 — Doc sync | Edit `docs/reference-comparison/CURRENT_VS_ENDPRODUCT.md` if §4 rows are stale; link artifacts in PR | **`QA-001`** satisfied when baselines match team policy (`VISUAL_REVIEW.md` § Recorded default) |

**Owner:** whoever merges the visual change (author runs steps 1–2 locally; CI may run subset). **Frequency:** every PR touching `GameScreen`, `GameLeftToolbar`, or `TileBoard` / WebGL tile FX; at minimum before parity milestone tags.

### Specs in repo

- `docs/new_design/SCREEN_SPEC_GAMEPLAY.md`
- `docs/new_design/VISUAL_SYSTEM_SPEC.md`
- `docs/new_design/COMPONENT_CATALOG.md`
- `docs/reference-comparison/CURRENT_VS_ENDPRODUCT.md`
- [`PLAYING_ENDPRODUCT/README.md`](./PLAYING_ENDPRODUCT/README.md) — **`PLAY-*`** gameplay parity vs `ENDPRODUCTIMAGE.png` §4 (HUD/sidebar/stage/cards/evidence); namespaced **`HUD-*` / `SIDE-*` / `CARD-*`** tables remain in their parity docs below

---

## Task files

### Pass 1

| File | Scope | Primary IDs |
|------|--------|-------------|
| [TASKS_HUD_PARITY.md](./TASKS_HUD_PARITY.md) | Top status bar, mutator meters, layout centering | `HUD-*` |
| [TASKS_SIDEBAR_PARITY.md](./TASKS_SIDEBAR_PARITY.md) | Left rail, icons, exit affordance | `SIDE-*` |
| [TASKS_CARDS_VFX_PARITY.md](./TASKS_CARDS_VFX_PARITY.md) | DOM/WebGL tiles, flip, match/mismatch FX | `CARD-*`, `FX-*` |
| [TASKS_ASSETS_QA.md](./TASKS_ASSETS_QA.md) | Asset paths, manifests, e2e/visual regression | `AST-*`, `QA-*` |
| [`PLAYING_ENDPRODUCT/README.md`](./PLAYING_ENDPRODUCT/README.md) · thin landing [`TASKS_PLAYING_ENDPRODUCT.md`](./TASKS_PLAYING_ENDPRODUCT.md) | Playing screen vs `ENDPRODUCTIMAGE.png` (top-left): rail IA, HUD density, stage, cards, interactions, evidence | `PLAY-*` |
| [TASKS_ARCHIVE_PARITY.md](./TASKS_ARCHIVE_PARITY.md) | Completed `HUD-*` / `SIDE-*` rows removed from active tables | archive only |

**Endproduct HUD/board crops (local):** `yarn playwright test e2e/hud-inspect.spec.ts e2e/visual-endproduct-parity.spec.ts --workers=1` → `test-results/endproduct-parity/` (`hud-element.png`, `hud-metrics.json`, `hud-fragment.html`, `tile-board-*.png`). Set `VISUAL_CAPTURE_ROOT` to write elsewhere.

### Pass 2

| File | Scope | Primary IDs |
|------|--------|-------------|
| [TASKS_META_AND_SHELL.md](./TASKS_META_AND_SHELL.md) | Main menu, mode select, codex/collection/inventory, game over, meta frames | `META-*` |
| [TASKS_NAVIGATION_STATE.md](./TASKS_NAVIGATION_STATE.md) | `ViewState`, return pointers, codex-from-menu, abandon confirm | `NAV-*` |
| [TASKS_OVERLAYS_FTUE.md](./TASKS_OVERLAYS_FTUE.md) | Pause/floor/relic modal, settings modal, toasts, z-index, distraction | `OVR-*` |
| [TASKS_DESIGN_SYSTEM.md](./TASKS_DESIGN_SYSTEM.md) | Tokens, typography, rgba dedupe, spec alignment | `DS-*` |
| [TASKS_PERFORMANCE_GRAPHICS.md](./TASKS_PERFORMANCE_GRAPHICS.md) | Quality presets, DPR, WebGL lifecycle, motion vs GPU cost | `PERF-*` |
| [TASKS_A11Y_I18N_E2E.md](./TASKS_A11Y_I18N_E2E.md) | Landmarks, focus traps, live regions, i18n, extra e2e specs | `A11Y-*`, `E2E-*` |

### WebGL tile board FX (post–canvas-only)

| File | Scope | Primary IDs |
|------|--------|-------------|
| [TASKS_TILE_BOARD_WEBGL_FX_V2.md](./TASKS_TILE_BOARD_WEBGL_FX_V2.md) | Dual-layer rims, bloom, rounded bezels, burst/check/focus polish, quality + regression | `TBF-*` |

### Cross-cutting

| File | Purpose |
|------|---------|
| [TASKS_CROSSCUTTING.md](./TASKS_CROSSCUTTING.md) | Epic order, shared risks, duplicate-task matrix, **decision log** |
| [ULTRA_REFINE_OPEN_QUEUE.md](./ULTRA_REFINE_OPEN_QUEUE.md) | Compact **P0/P1** index + **PLAY-010** capture commands for focused visual refinement |
| [TASKS_COMPLETION_LOG.md](./TASKS_COMPLETION_LOG.md) | P0–P2 IDs closed in milestone pushes (rows removed from active tables) |
| [NAVIGATION_MODEL.md](../NAVIGATION_MODEL.md) | `NAV-001` view + pointer model (`App.tsx` / store) |

---

## Master ID map (quick grep)

`HUD-*` `SIDE-*` `PLAY-*` `CARD-*` `FX-*` `TBF-*` `AST-*` `QA-*` `META-*` `NAV-*` `OVR-*` `DS-*` `PERF-*` `A11Y-*` `E2E-*`

---

## Suggested implementation order (high level)

1. **DS-008**, **DS-009**, **DS-010** — cheap token cleanup reduces rework before big visual passes.
2. **PERF-002** — unblocks honest **reduceMotion** vs quality before **FX-005** / **FX-015**.
3. **PLAY-010** then **PLAY-001 → PLAY-002** with remaining **SIDE-***; **HUD-001** (residual) / **HUD-002** with **PLAY-003** for HUD density vs mock.
4. **NAV-002**, **NAV-003**, **NAV-004** — IA and safety before promoting sidebar exit (**SIDE-003**).
5. **META-001 → META-003** then **OVR-001 → OVR-002** — shared chrome for meta + in-run modals.
6. **A11Y-003**, **A11Y-004**, **A11Y-005** — alongside overlay work.
7. **CARD/FX** with **FX-016** before particles/bloom; **AST-** / **QA-** continuous.

See [TASKS_CROSSCUTTING.md](./TASKS_CROSSCUTTING.md) for the phased table and deduplication notes.

## Priority legend

- **P0** — Blocks parity, data already in game with no UI, or dangerous conflation (e.g. motion vs GPU).
- **P1** — Strong mockup alignment, navigation safety, or major a11y gap.
- **P2** — Polish, optional product, Storybook, telemetry.
- **P3** — Future (i18n stack, deep links).

## Agent provenance (internal)

**Pass 1:** HUD; sidebar/icons; TileBoard + shuffle; assets + e2e.  
**Pass 2:** Meta shell screens; `useAppStore` / `App` routing; overlays & FTUE; theme vs VISUAL_SYSTEM_SPEC; TileBoard/Pixi/PostFX/settings; a11y+i18n+e2e inventory.
