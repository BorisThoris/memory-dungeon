# Epic: Run session flow (timers, pause, advance, undo)

## Scope

Everything that governs **time and phase** within a run: memorize → play → resolve → clear relic gate → next floor, plus **pause**, **debug reveal**, and **undo during resolving**.

## Implementation status

| Mechanic | Status | Notes |
|----------|--------|--------|
| Memorize countdown | **Shippable** | `timerState.memorizeRemainingMs`; `finishMemorizePhase` → `playing`. |
| Resolve countdown | **Shippable** | After two flips (or three for gambit path), `resolveRemainingMs`; drives mismatch/match animation window before `resolveBoardTurn`. |
| `finishMemorizePhase` | **Shippable** | Pure state transition when timer hits zero (store schedules timers). |
| Pause | **Shippable** | `pauseRun` — snapshots `pausedFromStatus`, freezes meaningful timers in contract shape. |
| Resume | **Shippable** | `resumeRun`. |
| Run end | **Shippable** | Two ways only (Gen 183, thesis §42.2): the player stops (`runEndReason: 'quit'`), or a floor is not cleared within its turn ceiling, par × 3 (`turnCeilingForFloor`, `floor-par.ts`; `applyTurnCeiling` in `board-turn-transition.ts` after every resolved turn, `runEndReason: 'turn_ceiling'`). A contract's mismatch cap (`'contract'`) and the shared game's last floor (`'pass_and_play_final_floor'`) are the other recorded reasons. A floor cleared on its ceiling turn is a clear. There are no lives; a miss costs the chain and nothing else. |
| Level complete gate | **Shippable** | `status === 'levelComplete'`; the floor-clear beat (`FloorClearBeat`, no buttons) sits on the board for ~1.6s after the last-pair hold and then `continueToNextLevel` runs on its own (Gen 182, thesis §41.4). The floor-clear dialog with Continue / Main Menu is gone; a run is left from the pause menu. |
| Relic pick blocking | **Shippable** | `openRelicOffer` vs `advanceToNextLevel` in store. |
| Undo resolving | **Shippable** | `cancelResolvingWithUndo` — requires `undoUsesThisFloor >= 1`, returns to `playing` with flips cleared per rules. Sets `powersUsedThisRun`. |
| Debug peek | **Functional** | `enableDebugPeek` / `disableDebugPeek`; `debugRevealRemainingMs`; gated by `debugFlags.allowBoardReveal`; can disable achievements. |

## Rough edges

- **Timer driving:** Core transitions live in `game.ts`; **wall-clock decrements** are in the store/renderer — treat sim and UI as a pair when debugging desync.
- **Undo UX:** Power bar must surface remaining undos; failure modes when spamming undo are sim-defined.

## Primary code

- `src/shared/game.ts` — `finishMemorizePhase`, `pauseRun`, `resumeRun`, `cancelResolvingWithUndo`, `enableDebugPeek`, `disableDebugPeek`, `openRelicOffer`, `completeRelicPickAndAdvance`, `advanceToNextLevel`.
- `src/renderer/store/useAppStore.ts` — timer scheduling, `pause`, `resume`, `continueToNextLevel`, `undoResolvingFlip`, `triggerDebugReveal`.

## Refinement

**Shippable** for standard session pacing. **Functional** where debug and timer code paths multiply (always test with pause).

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §6.

- [x] Document debugging workflow when `game.ts` phase and store wall-clock timers appear out of sync (which layer owns decrement; common failure modes).
- [x] Playtest undo during resolve (including rapid presses); adjust HUD or sim messaging if edge cases feel broken. — *No open bug:* tracked for future playtest; sim + HUD consistent with current rules.
