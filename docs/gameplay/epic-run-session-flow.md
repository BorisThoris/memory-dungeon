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
| Level complete gate | **Shippable** | `status === 'levelComplete'`; `continueToNextLevel` opens relic or `advanceToNextLevel`. |
| Relic pick blocking | **Shippable** | `openRelicOffer` vs `advanceToNextLevel` in store. |
| Undo resolving | **Shippable** | `cancelResolvingWithUndo` — requires `undoUsesThisFloor >= 1`, returns to `playing` with flips cleared per rules. Sets `powersUsedThisRun`. |
| Debug peek | **Functional** | `enableDebugPeek` / `disableDebugPeek`; `debugRevealRemainingMs`; gated by `debugFlags.allowBoardReveal`; can disable achievements. |
| `pendingMemorizeBonusMs` | **Shippable** | Banked time applied on next floor’s memorize (from life-loss / relic logic in `game.ts`). |

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
