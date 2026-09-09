# Mutator spec (D1)

Hooks in `src/shared/game.ts` consult `activeMutators` via `hasMutator` / `src/shared/mutators.ts`. **Rules version** `GAME_RULES_VERSION` in `contracts.ts` must bump when generation or mutator math changes.

## Hook matrix

| Phase | Mutators may affect |
|--------|---------------------|
| **Memorize** | `short_memorize`, `category_letters` (symbol set), `glass_floor` (extra decoy in pair list), `findables_floor` (spawn 0–2 bonus pair markers on generation), `shifting_spotlight` (ward/bounty pair keys on `BoardState`) |
| **Playing / flip** | `sticky_fingers` (block index after match), `glass_floor` (decoy mismatch handling) |
| **Powers** | Contracts (`activeContract`) gate shuffle/destroy — combine with mutators in tests (`game.test.ts` also has an `it.each` matrix over `noShuffle` × `noDestroy` vs `canShuffleBoard` / `applyDestroyPair`, plus wild-run contract rows) |
| **Scoring / floor advance** | `score_parasite` (life drain on cadence), `category_letters`, `n_back_anchor` (anchor cadence), `findables_floor` (flat score on match claim; destroy forfeits pickup), `shifting_spotlight` (bounty/ward match score delta; rotates after each flip resolution / destroy), `wide_recall` / `silhouette_twist` / `distraction_channel` (flat per-match penalty stacked with presentation—see `getPresentationMutatorMatchPenalty` in `game.ts`) |
| **Presentation** | `wide_recall` (label-first play on flipped tiles), `silhouette_twist` (silhouette styling), `distraction_channel` (optional **numeric** HUD overlay in `GameScreen`—cyclically changing digit for visual noise; local React tick, **not** `RunState`; **off** in settings by default; disabled when reduced motion), `shifting_spotlight` (ward/bounty tile highlights when face-up / memorize) |

## Shipped IDs (`MutatorId`)

- `glass_floor` — decoy `pairKey` (`DECOY_PAIR_KEY`); destroy/peek rules in `applyDestroyPair` / flip flow.
- `sticky_fingers` — `stickyBlockIndex` on match path.
- `score_parasite` — `parasiteFloors` increments in `advanceToNextLevel` toward life loss every **four** clears; **`applyDestroyPair` resets `parasiteFloors` to `0`** while this mutator is active (counts as parasite “pressure relief”).
- `category_letters` — forces the letter symbol band for generation (overrides floor-based `getSymbolSetForLevel` rotation).
- `short_memorize` — reduced memorize window (`getMemorizeDurationForRun`).
- `wide_recall` — play phase shows **labels** primarily (symbols de-emphasized in renderer); **rules:** flat match-score penalty per match.
- `silhouette_twist` — silhouette / reduced-face styling during play (CSS / materials); **rules:** flat match-score penalty per match.
- `n_back_anchor` — every 2 successful matches, surface an “anchor” pair key for recall pressure (`nBackAnchorPairKey` on `RunState`).
- `distraction_channel` — optional numeric HUD (settings `distractionChannelEnabled`, **off** by default; no mandatory audio); **rules:** flat match-score penalty per match while the mutator is active (`getPresentationMutatorMatchPenalty` in `game.ts`; HUD is cosmetic).
- `findables_floor` — seeded pickup pairs carry `findableKind` on tiles; matching claims the reward (score); `applyDestroyPair` clears the marker without reward (`findablesClaimedThisFloor` on `RunState`).
- `shifting_spotlight` — `wardPairKey` / `bountyPairKey` on `BoardState` (distinct from `cursedPairKey` “match last” objective). Bounty adds `SHIFTING_BOUNTY_MATCH_BONUS`, ward subtracts `SHIFTING_WARD_MATCH_PENALTY` (match score floored at 0). Keys re-roll from unresolved pairs after each two-flip resolution (match or miss), gambit resolution, and `applyDestroyPair` (`shiftingSpotlightNonce` on `RunState`).
- `magpie_thief` — every third miss re-hides a pair the player already cleared somewhere they have not looked; score keeps the points; a held guard token scares it off (`chunk-break-rules.ts` / `magpie` rules).

## Adding a mutator

1. Extend `MutatorId` in `contracts.ts` and bump `GAME_RULES_VERSION` if layout or scoring semantics change.  
2. Implement hooks in `game.ts` (single code path).  
3. Register in `mutators.ts` (`hasMutator`) and schedule it in `floor-mutator-schedule.ts`; content nothing schedules is content that does not exist.  
4. Add `game` tests under `src/shared/` for the new behavior.
