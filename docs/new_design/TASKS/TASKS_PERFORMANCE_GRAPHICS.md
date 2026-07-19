# Tasks: Performance & graphics pipeline (`PERF-*`)

**Sweep (P2/P3):** PERF-001 `graphicsQuality` + `boardBloomEnabled` in settings/save, DPR cap + optional bloom + menu Pixi resolution cap, PERF-005 WebGL context recovery, PERF-006 Pixi cap, PERF-009 `PERFORMANCE_BUDGET.md`.

**Research pass:** `reduceMotion` (settings + `data-reduce-motion`), `threeEnabled` / `canUseWebGL`, DPR cap in `TileBoard`, `glAntialias` vs `TileBoardPostFx` SMAA, Pixi `MainMenuBackground`, anisotropy in `TileBoardScene`, Canvas `key` remount on motion toggle, StartupIntro WebGL.

**Finding:** **`graphicsQuality`**, **`boardBloomEnabled`**, **`boardScreenSpaceAA`** shipped in settings/contracts (**`PERF-001`**, **`PERF-002`**). TileBoard context-loss recovery and lifecycle coverage shipped in `useTileBoardWebglContextRecovery` (**`PERF-005`**). OS `prefers-reduced-motion` is only partially used; menu Pixi cap exists via **`getMenuPixiResolutionCap`**; remaining gaps are below.

**Cross-links:** `TASKS_CARDS_VFX_PARITY.md` (FX-005, FX-015, FX-016), `TASKS_CROSSCUTTING.md`.

---

## Task table

| ID | P | Title | Goal | Acceptance criteria | Deps |
|----|---|--------|------|---------------------|------|
| PERF-003 | P2 | Low-power / idle policy | Tab hidden: pause ticker; optional `powerPreference: default`. | Measurable CPU drop. | — |
| PERF-004 | P2 | Match system reduced motion | Offer sync `prefers-reduced-motion` on first run or settings. | Document override. | — |
| PERF-006 | P1 | Menu Pixi DPR cap | Align with tile board policy on 3x/4x displays. | No huge backing store. | PERF-001 |
| PERF-007 | P2 | Anisotropy tier | Tie max anisotropy to quality preset. | — | PERF-001 |
| PERF-008 | P2 | Canvas remount on toggle | Avoid full context loss when toggling SMAA-only; evaluate composer-only mount. | Fewer GL leaks. | PERF-002 |
| PERF-009 | P2 | Perf budget doc | Frame budget, particle caps for FX-005/015; dev overlay optional. | Doc in `docs/new_design/`. | — |
| PERF-010 | P1 | E2E matrix DPR×path | WebGL vs DOM × reduceMotion × quality; extend save helpers. | Documented in QA README. | QA-* |

## Completed

| ID | Result | Evidence |
|----|--------|----------|
| PERF-005 | WebGL context loss prevents default disposal, shows recovery UI, and remounts the canvas after restoration; listeners and announcement timers are cleaned up. | `useTileBoardWebglContextRecovery.ts`, `useTileBoardWebglContextRecovery.test.ts`, `TileBoard.tsx` |

---

## CARD/FX coordination

Gate new FX behind **`graphicsQuality`** and **`boardBloomEnabled`**; **FX-016** matrix in [`FX_REDUCE_MOTION_MATRIX.md`](../FX_REDUCE_MOTION_MATRIX.md).
