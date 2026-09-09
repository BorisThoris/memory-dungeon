# Epic: Lives, pressure, and pacing

## Scope

Life loss and recovery, guard tokens, combo shards, mismatch grace, memorize timing, and parasite-style pressure. There is no run clock: the game has no timer.

## Implementation status

| Mechanic | Status | Notes |
|----------|--------|--------|
| Lives (max/cap) | **Shippable** | `INITIAL_LIVES` / `MAX_LIVES`; loss on mismatch after grace; guard can absorb. |
| Guard tokens | **Shippable** | Consumed before life on some mismatch paths. |
| Combo shards / chain heal | **Shippable** | Match rewards; **meditation** disables chain-heal life per game rules. |
| Mismatch “grace” | **Functional** | First-mismatch behavior tied to tries / stats — tune with care. |
| Memorize phase | **Shippable** | `getMemorizeDuration` / `getMemorizeDurationForRun`; mutators and relics adjust; meditation lengthens. |
| Echo feedback | **Shippable** | User `echoFeedbackEnabled`; extends mismatch visibility window (`ECHO_EXTRA_RESOLVE_MS` path). |
| Score parasite | **Shippable** | Mutator + `parasiteFloors` / ward relic; advance-level life hit. |
| Contracts (max mismatches) | **Functional** | Scholar / special runs can cap mismatches → game over. |

## Rough edges

- **Parasite + UX:** HUD shows progress, ward stock, and screen-reader lines via `useHudPoliteLiveAnnouncement`; Codex covers mutator + relic.

## Primary code

- `src/shared/game.ts` — life/guard/combo/parasite checks, memorize helpers, `advanceToNextLevel`.
- `src/renderer/components/RunShell.tsx`, `GameScreen.tsx` — parasite messaging.

## Refinement

**Shippable** for core pressure loops.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §8.

- [x] Codex or HUD: reinforce **score parasite** for players who skip mutator HUD chips. *(HUD: accurate drain/ward tooltip, `aria-label`, **Ward ×N** when `parasiteWardRemaining` > 0; Codex already documents mutator + relic.)*
