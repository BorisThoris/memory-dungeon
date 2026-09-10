# Mutator spec (D1)

Hooks in `src/shared/game.ts` consult `activeMutators` via `hasMutator` / `src/shared/mutators.ts`. **Rules version** `GAME_RULES_VERSION` in `contracts.ts` must bump when generation or mutator math changes.

## Hook matrix

| Phase | Mutators may affect |
|--------|---------------------|
| **Memorize** | `short_memorize`, `category_letters` (symbol set), `findables_floor` (spawn 0–2 bonus pair markers on generation), `shifting_spotlight` (ward/bounty pair keys on `BoardState`) |
| **Playing / flip** | `sticky_fingers` (block index after match) |
| **Powers** | Contracts (`activeContract`) gate shuffle — combine with mutators in tests (`game.test.ts` also has an `it.each` matrix over `noShuffle` vs `canShuffleBoard`, plus wild-run contract rows). Destroy and Stray were removed in Gen 200; see [REMOVED_POWERS.md](./REMOVED_POWERS.md) |
| **Scoring / floor advance** | `category_letters`, `n_back_anchor` (anchor cadence), `findables_floor` (flat score on match claim), `shifting_spotlight` (bounty/ward match score delta; rotates after each flip resolution), `wide_recall` / `silhouette_twist` / `distraction_channel` (flat per-match penalty stacked with presentation—see `getPresentationMutatorMatchPenalty` in `game.ts`) |
| **Presentation** | `wide_recall` (label-first play on flipped tiles), `silhouette_twist` (silhouette styling), `distraction_channel` (optional **numeric** HUD overlay in `GameScreen`—cyclically changing digit for visual noise; local React tick, **not** `RunState`; **off** in settings by default; disabled when reduced motion), `shifting_spotlight` (ward/bounty tile highlights when face-up / memorize) |

## Shipped IDs (`MutatorId`)

Ten, and this list is the ten in `MUTATOR_IDS`. `score_parasite` was here until Gen 183 took it out
with the lives it drained; the row went with it rather than being left to describe nothing.

- `sticky_fingers` — `stickyBlockIndex` on match path.
- `category_letters` — forces the letter symbol band for generation (overrides floor-based `getSymbolSetForLevel` rotation).
- `short_memorize` — reduced memorize window (`getMemorizeDurationForRun`).
- `wide_recall` — play phase shows **labels** primarily (symbols de-emphasized in renderer); **rules:** flat match-score penalty per match.
- `silhouette_twist` — silhouette / reduced-face styling during play (CSS / materials); **rules:** flat match-score penalty per match.
- `n_back_anchor` — every 2 successful matches, surface an “anchor” pair key for recall pressure (`nBackAnchorPairKey` on `RunState`).
- `distraction_channel` — optional numeric HUD (settings `distractionChannelEnabled`, **off** by default; no mandatory audio); **rules:** flat match-score penalty per match while the mutator is active (`getPresentationMutatorMatchPenalty` in `game.ts`; HUD is cosmetic).
- `findables_floor` — seeded pickup pairs carry `findableKind` on tiles; matching claims the reward (score) and increments `findablesClaimedThisFloor` on `RunState`. A marker can only be cleared by claiming it; Destroy used to clear one without paying, and Destroy is gone (Gen 200).
- `shifting_spotlight` — `wardPairKey` / `bountyPairKey` on `BoardState` (distinct from `cursedPairKey` “match last” objective). Bounty adds `SHIFTING_BOUNTY_MATCH_BONUS`, ward subtracts `SHIFTING_WARD_MATCH_PENALTY` (match score floored at 0). Keys re-roll from unresolved pairs after each two-flip resolution (match or miss) and gambit resolution (`shiftingSpotlightNonce` on `RunState`).
- `magpie_thief` — every third miss re-hides a pair the player already cleared somewhere they have not looked; score keeps the points; a held guard token scares it off (`chunk-break-rules.ts` / `magpie` rules).

## Adding a mutator

1. Extend `MutatorId` in `contracts.ts` and bump `GAME_RULES_VERSION` if layout or scoring semantics change.  
2. Implement hooks in `game.ts` (single code path).  
3. Register in `mutators.ts` (`hasMutator`) and schedule it in `floor-mutator-schedule.ts`; content nothing schedules is content that does not exist.  
4. Add `game` tests under `src/shared/` for the new behavior.
