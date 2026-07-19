# Tasks: Performance & graphics pipeline (`PERF-*`)

**Sweep (P2/P3):** PERF-001 `graphicsQuality` + `boardBloomEnabled` in settings/save, DPR cap + optional bloom + menu Pixi resolution cap, PERF-005 WebGL context recovery, PERF-006 Pixi cap, PERF-009 `PERFORMANCE_BUDGET.md`.

**Research pass:** `reduceMotion` (settings + `data-reduce-motion`), `threeEnabled` / `canUseWebGL`, DPR cap in `TileBoard`, `glAntialias` vs `TileBoardPostFx` SMAA, Pixi `MainMenuBackground`, anisotropy in `TileBoardScene`, Canvas `key` remount on motion toggle, StartupIntro WebGL.

**Finding:** **`graphicsQuality`**, **`boardBloomEnabled`**, **`boardScreenSpaceAA`** shipped in settings/contracts (**`PERF-001`**, **`PERF-002`**). Hidden-tab menu animation suspension (**`PERF-003`**), effective saved/OS reduced motion (**`PERF-004`**), TileBoard context-loss recovery (**`PERF-005`**), menu Pixi DPR caps (**`PERF-006`**), quality-tier anisotropy (**`PERF-007`**), native-AA-aware Canvas remounting (**`PERF-008`**), and measurable frame/FX budgets (**`PERF-009`**) are implemented and covered.

**Cross-links:** `TASKS_CARDS_VFX_PARITY.md` (FX-005, FX-015, FX-016), `TASKS_CROSSCUTTING.md`.

---

## Task table

| ID | P | Title | Goal | Acceptance criteria | Deps |
|----|---|--------|------|---------------------|------|
| PERF-010 | P1 | E2E matrix DPR×path | WebGL vs DOM × reduceMotion × quality; extend save helpers. | Documented in QA README. | QA-* |

## Completed

| ID | Result | Evidence |
|----|--------|----------|
| PERF-003 | The menu Pixi ticker remains stopped when initialized in a hidden tab, resumes on visibility, and stops again when hidden. | `MainMenuBackground.tsx`, `MainMenuBackground.test.tsx` |
| PERF-004 | Effective reduced motion is enabled when either the persisted setting or OS preference requests it. The OS preference is a suppressive accessibility override and cannot be disabled by a saved `false`. | `useEffectiveReducedMotion.ts`, `useEffectiveReducedMotion.test.tsx`, `App.tsx`, `GameScreen.tsx`, `GameOverScreen.tsx` |
| PERF-005 | WebGL context loss prevents default disposal, shows recovery UI, and remounts the canvas after restoration; listeners and announcement timers are cleaned up. | `useTileBoardWebglContextRecovery.ts`, `useTileBoardWebglContextRecovery.test.ts`, `TileBoard.tsx` |
| PERF-006 | Menu Pixi resolution is capped by quality tier on high-DPR displays and reapplied when quality changes. | `graphicsQuality.ts`, `graphicsQuality.test.ts`, `MainMenuBackground.tsx`, `MainMenuBackground.test.tsx` |
| PERF-007 | Tile texture anisotropy is capped by both graphics tier and device capability and reapplied through scene resource quality synchronization. | `graphicsQuality.ts`, `tileBoardTextureQuality.ts`, `tileBoardTextureQuality.test.ts`, `useTileBoardSceneResources.ts` |
| PERF-008 | Canvas identity follows immutable native framebuffer AA state rather than semantic `smaa` / `msaa` modes. Equivalent mode transitions keep the GL context and scene mounted; AA on/off and context recovery still remount. | `tileBoardCanvasContext.ts`, `tileBoardCanvasContext.test.ts`, `TileBoard.tsx` |
| PERF-009 | The performance budget records frame-time targets plus concrete match FX, bloom, and menu-particle allocation/draw caps that map to the current renderer implementation. | `PERFORMANCE_BUDGET.md`, `TileBoardEffectOverlays.tsx`, `tileBoardRimVisualState.ts`, `GameScreen.module.css`, `graphicsQuality.ts` |

---

## CARD/FX coordination

Gate new FX behind **`graphicsQuality`** and **`boardBloomEnabled`**; **FX-016** matrix in [`FX_REDUCE_MOTION_MATRIX.md`](../FX_REDUCE_MOTION_MATRIX.md).
