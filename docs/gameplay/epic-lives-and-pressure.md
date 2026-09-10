# Epic: Lives, pressure, and pacing

> **Superseded in Gen 183.** There are no lives (thesis §42.2). The pressure of a run is the **par** and
> the **turn ceiling**: every floor states a par, and a floor not cleared within three times its par
> ends the run; otherwise a run ends when the player stops. A miss resets the chain, counts a try and
> a turn, and costs nothing else (§67, trace 4). The life economy this epic tracked - lives, guard
> tokens, the first-mismatch grace, chain heal, shards to a life, the clean-clear life, the score
> parasite - is recorded in [REMOVED_LIVES.md](../REMOVED_LIVES.md). The rows that survive (memorize
> timing, echo feedback, contracts) are current; the rest are kept below, marked, for the record.

## Scope

Was: life loss and recovery, guard tokens, combo shards, mismatch grace, memorize timing, and parasite-style
pressure. Is: memorize timing, echo feedback, the contract mismatch cap, and the turn ceiling, which is
tracked in [epic-run-session-flow](./epic-run-session-flow.md) and [epic-scoring-objectives](./epic-scoring-objectives.md).
There is no run clock: the game has no timer.

## Implementation status

| Mechanic | Status | Notes |
|----------|--------|--------|
| Lives (max/cap) | **Removed (Gen 183)** | Was `INITIAL_LIVES` 4 / `MAX_LIVES` 5; lost on a mismatch after grace, or absorbed by a guard. |
| Guard tokens | **Removed (Gen 183)** | Were spent before a life on a miss, or to scare off the magpie. |
| Combo shards / chain heal | **Chain heal removed (Gen 183); shards removed (Gen 184)** | Shards banked from the chain, breaks and sparks and converted into nothing once the life they bought was gone; recorded in [REMOVED_LIVES.md](../REMOVED_LIVES.md). |
| Mismatch "grace" | **Removed (Gen 183)** | Only decided whether a life was lost; `mismatch-grace-rules.ts` is deleted. |
| Memorize phase | **Shippable** | `getMemorizeDuration` / `getMemorizeDurationForRun`; mutators and floor residents adjust it. |
| Echo feedback | **Shippable** | User `echoFeedbackEnabled`; extends mismatch visibility window (`ECHO_EXTRA_RESOLVE_MS` path). |
| Score parasite | **Removed (Gen 183)** | Ate a life every four floors and did nothing else; floor 11 of the cycle carries `distraction_channel` now. |
| Contracts (max mismatches) | **Functional** | Scholar / special runs can cap mismatches → game over, `runEndReason: 'contract'`. |
| The turn ceiling | **Shippable (Gen 183)** | `turnCeilingForFloor` = par × 3 (`floor-par.ts`); `applyTurnCeiling` (`board-turn-transition.ts`) ends the run with `runEndReason: 'turn_ceiling'`; the HUD par stat shows the ceiling and marks the last two turns. |

## Rough edges

- None open here. The bad-floor acceptance test (`src/shared/bad-floor-is-quiet.test.ts`) pins that a floor played badly is quiet.

## Primary code

- `src/shared/floor-par.ts` — the par and the ceiling.
- `src/shared/board-turn-transition.ts` — `applyTurnCeiling` after every resolved turn.
- `src/shared/scoring-rules.ts` — memorize helpers.
- `src/renderer/components/RunShell.tsx` — the par stat with its ceiling.

## Refinement

**Superseded.** The pressure loop is the par and the ceiling; nothing in the old life economy is left to refine.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §8.

- [x] Codex or HUD: reinforce **score parasite** for players who skip mutator HUD chips. *(Closed by removal in Gen 183: the parasite is gone.)*
