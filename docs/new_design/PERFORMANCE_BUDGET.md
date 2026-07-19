# PERF-009 — Performance budget (board + shell)

Targets are **guidelines** for mid-range laptops and phones; actual headroom depends on device thermals and OS compositing.

## Frame budget

| Surface | Target steady FPS | Notes |
|---------|-------------------|--------|
| Game WebGL board | 55–60 (18.2–16.7 ms/frame) | Dominated by card meshes, native framebuffer AA, viewport damp |
| Main menu Pixi | 30–60 (33.3–16.7 ms/frame) | Capped resolution and particle count via **Graphics quality** (PERF-001 / PERF-006) |
| DOM-only board | 60 (16.7 ms/frame) | No GL; CSS animations gated by reduce motion |

## Board GPU knobs (`Settings`)

| Setting | Effect |
|---------|--------|
| **Graphics quality** | Caps **tile board DPR** (`getBoardDprCap`) and **menu Pixi renderer resolution** (`getMenuPixiResolutionCap`). |
| **Board bloom** (**FX-015** / **TBF-003**) | Optional CSS board-stage glow. **Default: off** (`save-data` / Settings). **Forced off** on Low quality. On **High** with the toggle on, `GameScreen` adds a small extra CSS `box-shadow` rim under the board (`.boardStageCssBloom`) so the stage reads warmer without a GPU post-processing pass. |
| **Board anti-aliasing** | Native framebuffer AA vs off (`boardScreenSpaceAA` keeps `auto` / `smaa` / `msaa` / `off` saved values; `smaa` falls back to native AA while post-FX is disabled); see `FX_REDUCE_MOTION_MATRIX.md`. |

## FX allocation and draw caps (cross-reference)

| FX | Runtime cap |
|----|-------------|
| FX-005 / TBF-005 match burst | **Zero objects allocated per trigger.** Each card owns two pre-mounted resolving meshes (crisp rim + glow) and one pre-mounted persistent matched-edge shader mesh. At resolve time, at most the two resolving meshes are active; after resolution, at most the one matched-edge mesh is active. Low quality uses the crisp-rim fallback instead of the persistent shader. Reduced motion keeps a static resolving cue and near-static matched edge. |
| FX-015 bloom | **Zero particles and no additional canvas/pass.** One existing board-glow DOM layer receives an extra CSS shadow only on High quality when enabled; Low and Medium add no bloom layer work. |
| Main menu atmosphere | Particle count comes from `getMenuAtmosphereParticleCount`; the largest current tier is **36 particles** (High at 1440×820 or larger), with lower viewport and quality tiers capped below it. |

## Reduced motion (PERF-004)

Renderer motion is suppressed when either the persisted **Reduce motion** setting or the OS/browser `prefers-reduced-motion: reduce` preference is active. Both inputs are suppressive: a saved `false` does not override an OS accessibility preference.

## WebGL resilience (PERF-005)

`TileBoard` listens for `webglcontextlost` / `webglcontextrestored` on the R3F canvas. Loss keeps the board shell and canvas mounted with a recovery alert until restore (or user reload), so the browser can deliver `webglcontextrestored`.
