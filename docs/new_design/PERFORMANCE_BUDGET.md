# PERF-009 — Performance budget (board + shell)

Targets are **guidelines** for mid-range laptops and phones; actual headroom depends on device thermals and OS compositing.

## Frame budget

| Surface | Target steady FPS | Notes |
|---------|-------------------|--------|
| Game WebGL board | 55–60 | Dominated by card meshes, native framebuffer AA, viewport damp |
| Main menu Pixi | 30–60 | Capped resolution via **Graphics quality** (PERF-001 / PERF-006) |
| DOM-only board | 60 | No GL; CSS animations gated by reduce motion |

## Board GPU knobs (`Settings`)

| Setting | Effect |
|---------|--------|
| **Graphics quality** | Caps **tile board DPR** (`getBoardDprCap`) and **menu Pixi renderer resolution** (`getMenuPixiResolutionCap`). |
| **Board bloom** (**FX-015** / **TBF-003**) | Optional CSS board-stage glow. **Default: off** (`save-data` / Settings). **Forced off** on Low quality. On **High** with the toggle on, `GameScreen` adds a small extra CSS `box-shadow` rim under the board (`.boardStageCssBloom`) so the stage reads warmer without a GPU post-processing pass. |
| **Board anti-aliasing** | Native framebuffer AA vs off (`boardScreenSpaceAA` keeps `auto` / `smaa` / `msaa` / `off` saved values; `smaa` falls back to native AA while post-FX is disabled); see `FX_REDUCE_MOTION_MATRIX.md`. |

## FX caps (cross-reference)

| FX | Budget hook |
|----|-------------|
| FX-005 match particles | Cap count; off when reduce motion |
| FX-015 bloom | CSS board-stage glow; tier-gated (**TBF-003**) |

## WebGL resilience (PERF-005)

`TileBoard` listens for `webglcontextlost` / `webglcontextrestored` on the R3F canvas. Loss keeps the board shell and canvas mounted with a recovery alert until restore (or user reload), so the browser can deliver `webglcontextrestored`.
