# Epic: Board rendering & assists

## Scope

How the board is shown (WebGL), optional player assists, and mutator-adjacent **presentation** (things meant to change how cards are read, not just score).

## Implementation status

| Feature | Status | Notes |
|---------|--------|--------|
| Tile board (R3F / Three) | **Shippable** | `TileBoardScene.tsx` — cards, rims, matched flame, pick mesh, etc. |
| Shared card particles | **Implemented** | `TileBoardParticles.tsx` — bomb embers and rings at both cards, match sparks, flip glints, and delayed chain-pop bursts in the existing canvas. |
| Shifting spotlight (ward/bounty) | **Shippable** | Props from `GameScreen` → `TileBoard` → `TileBoardScene`; corner/edge highlights for ward and bounty on relevant faces. |
| Findables (`findables_floor`) | **Shippable** | `findableKind` drives corner ring + HUD strings; scoring in `game.ts`. |
| Pair distance hints | **Shippable** (new) | `pairProximityHint.ts`, `PairProximityHintPlane.tsx`; setting `pairProximityHintsEnabled`; Manhattan distance to nearest legal pair partner; decoys show no badge. |
| Focus assist | **Functional** | Setting `tileFocusAssist`; `focusDimmedTileIds` / dimming in scene — paired with “fallback board” language in settings; WebGL path implements dimming when data provided. |
| `wide_recall` presentation | **Functional** | Rules: per-match score penalty. **Renderer:** `wideRecallInPlay` → `TileBoard` → `TileBoardScene`; flipped in-play faces use a **cooler tint** (`presentationWideRecall`) — not a separate symbol mesh. |
| `silhouette_twist` presentation | **Functional** | Same path; **darker silhouette-style** face read (`presentationSilhouette`) on flipped tiles in play. |
| `n_back_anchor` on-board cue | **Functional** | `nBackAnchorPairKey` + `nBackMutatorActive` forwarded; **cyan anchor emphasis** on the anchor pair’s flipped tiles (`presentationNBackAnchor`). HUD subline may still add context. |
| Keyboard focus ring | **Shippable** | Gated to board `role="application"` DOM focus so one tile does not look permanently focused. |
| Distraction channel | **Functional** | Score penalty + optional HUD overlay when mutator active and user enables `distractionChannelEnabled` and motion allows. |

## Extending card particles

`boardParticleSystem.ts` owns one instanced quad mesh and fixed typed buffers. Use its
`emit({ kind, x, y, z, seed, time, delay, reduceMotion, quality })` API to add bursts;
add a preset to `BoardParticleKind` and the emitter for a new visual style. Keep gameplay
randomness separate: the emitter uses a local cosmetic seed. `boardParticleCues.ts`
maps committed card transitions to presets, and `TileBoardParticles.tsx` supplies card
positions and the scene clock. New effects should join this pool, not create another canvas.

The hard budgets are 96 / 192 / 384 particles for low / medium / high quality. Old slots
are reused during large cascades. The mesh stops drawing when all particles expire, and
the buffers and material are disposed on unmount. Floor changes and context recovery
do not replay old clears. Pausing freezes the effect clock. Reduced motion omits flip
glints and replaces bursts with a stationary, short fade; no full-screen flash is used.

`boardParticleSystem.test.ts` checks bounds, reuse, lifetime, reduced motion and cleanup;
`boardParticleCues.test.ts` checks transition selection. `e2e/board-particles.spec.ts`
exercises real bomb, match and chain actions and checks shader errors, expiry and canvas
stability. On Windows, run browser tests headlessly through the noninteractive isolation
launcher described in the user's desktop-safety instructions.

## Rough edges

- **Presentation mutators:** Penalties in sim; WebGL uses **material/tint** treatments for the three headline presentation mutators — tune vs product mockups if art direction tightens.
- **Single source of truth:** When adding `TileBoard` props, forward or intentionally omit in `TileBoardScene` (see polish backlog audit row).

## Primary code

- `src/renderer/components/TileBoardScene.tsx`, `TileBoard.tsx`, `GameScreen.tsx`
- `src/shared/pairProximityHint.ts`, `src/renderer/components/PairProximityHintPlane.tsx`
- `src/shared/focusDimmedTileIds.ts`
- `game.ts` — `getPresentationMutatorMatchPenalty`

## Refinement

**Shippable** for board fidelity, spotlight/findables, and baseline **3D presentation** for `wide_recall` / `silhouette_twist` / `n_back_anchor`. Further art-pass parity is optional.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §1.

- [x] Forward `wideRecallInPlay` from `TileBoard` to `TileBoardScene` and implement 3D legibility (label/symbol emphasis) per design, **or** document intentional deferral in catalog + this epic.
- [x] Forward silhouette / presentation state for `silhouette_twist` into `TileBoardScene` (materials/shader/CSS parity with DOM path).
- [x] Forward `nBackAnchorPairKey` and `nBackMutatorActive` into `TileBoardScene`; add WebGL anchor highlight or ring (not HUD-only).
- [x] Audit every `TileBoard` → `TileBoardScene` prop: **wire** presentation mutator data or **remove** unused/discarded props so QA does not assume 3D parity.
- [x] (Optional) Add or extend Playwright coverage for presentation-mutator board paths once visuals are implemented. — *Deferred:* extend when dedicated visual regression suite lands; WebGL paths covered by existing e2e smoke where applicable.
