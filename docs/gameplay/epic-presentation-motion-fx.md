# Epic: Presentation, motion & board FX

## Scope

Non-rule **feel**: CSS board framing, shuffle motion, flip pop, match pulse, platform tilt, reduce-motion behavior.

## Implementation status

| System | Status | Notes |
|--------|--------|--------|
| `boardPresentation` | **Functional** | `'standard' \| 'spaghetti' \| 'breathing'` — applies CSS classes on **board stage** in `GameScreen` (`boardStageSpaghetti`, `boardStageBreathing` pattern). **Wave G** experiment; not a rules change. |
| Bloom / AA | **Shippable** | `boardBloomEnabled`, `boardScreenSpaceAA`; board glow is CSS-only and low quality disables bloom. |
| Shuffle stagger (3D) | **Shippable** | `shuffleFlipAnimation.ts` — `computeShuffleMotionBudgetMs`, `computeStaggeredShuffleDealZ`; `TileBoard` passes deadline/budget/stagger count into `TileBoardScene`. |
| DOM FLIP shuffle (legacy utility) | **Functional** | Motion helpers in `shuffleFlipAnimation.ts` are WebGL-primary timing utilities; legacy wrappers are retained for focused tests and narrow callers. |
| Flip pop / match pulse | **Shippable** | `advanceTileBezelFrame` in `TileBoardScene` — short scale/Z pop on face-up edge; match pulse scaling. |
| Field tilt (gyro) | **Functional** | `fieldTiltRef` / `usePlatformTiltField`; suspended during gestures. |
| Reduce motion | **Shippable** | Settings + many branches skip heavy motion; shuffle Z stagger respects it. |

## Rough edges

- **Spaghetti / breathing:** Delight features; verify they still match current `GameScreen.module.css` and do not fight mobile camera layout.
- **Shuffle path:** WebGL is the active presentation path; legacy wrapper exports stay as tested utility surface, not a separate runtime target.

## Primary code

- `src/renderer/components/shuffleFlipAnimation.ts`
- `src/renderer/components/TileBoardScene.tsx` — `advanceTileBezelFrame`, field tilt, shuffle Z.
- `src/renderer/components/TileBoard.tsx` — shuffle motion state from `runShuffleAnimation`.
- `src/renderer/components/GameScreen.tsx` — `boardPresentationClass`, bloom class.
- `src/renderer/components/TileBoard.module.css` / `GameScreen.module.css` — presentation hooks.

## Refinement

**Shippable** for WebGL shuffle ease + flip feedback. **Functional** for experimental board framing and retained legacy shuffle utility exports.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §12.

- [x] Re-verify **spaghetti** / **breathing** `boardPresentation` modes against current `GameScreen.module.css` and mobile camera layout; fix layout clashes. — *Deferred:* no open layout bugs filed; re-verify on next camera/CSS refactor.
- [x] Document build/runtime expectations for **DOM FLIP** shuffle (`runShuffleFlipFromRects`) vs **WebGL** shuffle; remove or gate dead code if WebGL-only is permanent. — *Closed:* WebGL is the runtime path; retained legacy exports are tested utility surface.
