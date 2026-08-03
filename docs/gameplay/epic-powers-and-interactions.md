# Epic: Powers and mid-run interactions

## Scope

Player actions beyond flipping: peek, shuffles, tile swap, destroy pair, pinning, stray remove, undo resolving, flash pair; how they interact with arms (`peekModeArmed`, `destroyPairArmed`, `tileSwapArmed`, `boardPinMode`) and `pressTile` ordering.

## Implementation status

| Power / action | Status | Notes |
|----------------|--------|--------|
| Flip (default) | **Shippable** | `pressTile` → `flipTile` after other arms cleared. |
| Gambit third pick | **Shippable** | First branch when resolving + two flips + gambit available. |
| Peek | **Shippable** | `applyPeek`; charges; clears when committing flips per rules. |
| Full shuffle | **Shippable** | `applyShuffle`; weaker shuffle modes; score tax; clears pins. |
| Region / row shuffle | **Shippable** | Row shuffle when enough hidden tiles in row. |
| Tile swap | **Shippable** | `applyTileSwap`; spends row-shuffle accounting to exchange two hidden tiles for trait-position setup; clears pins and locks Perfect Memory. |
| Destroy pair | **Shippable** | `applyDestroyPair`; can clear floor without flip resolution; findable markers stripped; spotlight rotation. |
| Pin mode | **Shippable** | `togglePinnedTile`; does **not** set `powersUsedThisRun` (pins allowed for “perfect” achievement intent). |
| Stray remove | **Functional** | Transient renderer arm + typed `board.stray_remove`; `applyStrayRemove` owns durable legality and consequence. |
| Undo resolving | **Shippable** | `cancelResolvingWithUndo`; sets `powersUsedThisRun`. |
| Flash pair | **Functional** | Practice/Wild-only v1: store calls `applyFlashPair`, game rules no-op outside `practiceMode` / `wildMenuRun`, and UI only exposes usable charges in those modes. |

## Rough edges

- **`powersUsedThisRun`:** Authoritative enumeration is on `RunState.powersUsedThisRun` in [`contracts.ts`](../../src/shared/contracts.ts). Only **ACH_PERFECT_CLEAR** consumes the flag in `achievements.ts` — keep player-facing copy aligned separately.
- **Flash pair:** If product later wants Classic/Daily access, treat it as a balance change rather than a bug fix.

## Primary code

- `src/renderer/store/useAppStore.ts` - `pressTile`, `togglePeekMode`, `shuffleBoard`, `shuffleRegionRow`, `toggleTileSwapArmed`, `toggleDestroyPairArmed`, `toggleBoardPinMode`, `toggleStrayArm`, `undoResolvingFlip`, `applyFlashPairPower`.
- `src/shared/board-power-actions.ts` / `src/shared/game.ts` - `applyPeek`, `applyShuffle`, `applyRegionShuffle`, `applyTileSwap`, `applyDestroyPair`, `applyStrayRemove`, `cancelResolvingWithUndo`, `applyFlashPair`, `canDestroyPair`, etc.

## Refinement

**Shippable** for the main power bar loop. Type contract enumerates achievement disqualifiers; residual risk is **UX copy** (players conflating “power” with achievement text).

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §3.

- [x] Update `powersUsedThisRun` (and any related JSDoc on `RunState`) in `contracts.ts` to enumerate every action that sets the flag (peek, undo, gambit, stray, flash, wild match, shuffle, tile swap, destroy, etc.).
- [x] Audit all UI paths that expose flash pair; ensure only practice/wild-allowed surfaces call `applyFlashPair` (guard mismatch if new entry points appear).
