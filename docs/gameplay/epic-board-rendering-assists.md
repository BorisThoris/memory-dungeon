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

`boardParticleSystem.ts` owns fixed typed buffers shared by two instanced quad layers. Use its
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

The same pool drives rim trails on hovered or keyboard-focused cards, visibly charged
trait routes, and successful resolving pairs. A rounded-perimeter sweep releases sparks
when a match lands; chain heat increases their density and reach. Card-local transforms
keep emission aligned with tilt, flip and departure scale. Ambient trails consume only
free slots and stop while paused, suppressed or under reduced motion. Their emission is
limited to 2 / 4 / 6 cards per tick across quality levels, with round-robin coverage.
Reduced-motion rim bands use a frozen shader clock rather than a slowly moving flame.

The aura uses a separate wide, hollow rounded-card envelope, leaving trait-marker geometry
and card art readable. Flowing amber tongues signal focus, deeper orange signals charged
routes, and mint-white fire signals a successful pair. A match lifts for 65 ms, accelerates
into contact at 140 ms, briefly compresses, and recovers as it leaves. Three staggered
elliptical rings spread across the board at contact (two on low quality). Rings reuse the
particle buffers and a second rendering layer behind card chrome. The board and particles
share a bounded visual clock, frozen on pause. Reduced motion omits the slam and expanding
rings, retaining the stationary confirmation fade.

The styling principles are anticipation → contact → dissipation, a clear focal point,
coherent fire/ember shapes and colors, and intensity proportional to the earned outcome.
These follow [Riot's VFX guidance](https://www.riotgames.com/en/artedu/visual-effects) on
balancing satisfaction with gameplay clarity, and the layered feedback approach in
[Juice It or Lose It](https://gdcvault.com/play/1016487/Juice-It-or-Lose).
The quieter setting follows the control offered by
[Candy Crush's effects settings](https://candycrush.zendesk.com/hc/en-us/articles/27184207521565-Discover-the-Settings-Menu).
`boardMatchImpact.test.ts` covers the contact trajectory and reduced-motion suppression;
the particle and browser tests cover staggered rings, shared buffers, budgets and expiry.

**Group lightning.** A match arcs a bolt between its two cards at contact, and every card
its break takes is struck by a bolt from the nearest card already hit - same suit first, so
the charge visibly runs through the clump; a Fever bridge takes its bolt from whatever was
struck nearest (`boardGroupArcs.ts`). Each bolt strikes just ahead of its card's break-wave
burst, is drawn tip-first so the charge is seen travelling, and strobes as it fades. Bolts
are instanced segment quads (particle kind 7) in the same bounded pool, which grew to
640 / 320 / 128 slots for high / medium / low. Reduced motion draws none.

**Combo scaling.** The combo carries across floors until a miss, and the board's effects
read it through `comboEffectIntensity` (saturating: 3 links ≈ 0.28, 10 ≈ 0.67, 20 ≈ 0.89).
It sets each bolt's strands (one to three), forks, width, life and colour (cyan, gold,
amber, rose-white), and floors the energy of match and chain bursts and contact rings, so a
long combo makes every match and pop visibly bigger. The canvas reports
`data-particle-arc-bursts` and `data-particle-combo`.

`boardParticleSystem.test.ts` checks bounds, reuse, lifetime, reduced motion and cleanup;
`boardGroupArcs.test.ts` checks bolt routing, replay safety, seeding and combo scaling;
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
