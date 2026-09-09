# Run session: timers and debugging

**Audience:** engineers debugging “wrong phase,” pause, or HUD countdown quirks.

## Model

- **Pure rules** (`src/shared/game.ts`): `RunStatus`, `finishMemorizePhase`, `pauseRun`, `resumeRun`, `resolveBoardTurn`, etc.
- **Wall-clock** (`src/renderer/store/useAppStore.ts`): schedules `setInterval` / `requestAnimationFrame` style updates that decrement `timerState.memorizeRemainingMs` and `resolveRemainingMs`. There is no run-wide clock: the game has no timer.

When investigating desync, inspect **both**: the `run` object after a `game.ts` transition and the store’s timer fields **after** the next tick.

## Undo

`cancelResolvingWithUndo` is authoritative in `game.ts`; the toolbar shows `undoUsesThisFloor`. Rapid presses should be bounded by sim guards—if not, capture a replay with `run` + timer state.
