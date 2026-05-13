# Pass 02: Board Generation, Determinism, Fairness

## Current Map
- Board generation is centralized in `src/shared/game.ts`; `board-generation.ts` is a re-export.
- RNG uses named hash domains for tile order, findables, dungeon cards, hazards, route specials, layouts, enemies, and shuffles.
- `isBoardComplete` ignores non-decoy singleton utility tiles and permits hidden decoys once real tiles are cleared.
- `inspectBoardFairness` checks malformed pairs, utility counters, exits, wilds, enemy hazards, dungeon metadata, and boss objective reachability.

## Findings
- **P0:** Stray remove can softlock by removing one tile from a normal pair and leaving an orphan that destroy cannot target.
- **P1:** Wild completion and fairness disagree: completion ignores unused hidden wilds, while fairness can flag them.
- **P1:** Shuffle eligibility counts any `pairKey` group with at least two hidden tiles, including non-real singleton utility groups.
- **P2:** `fixedTiles` docs say “copy as-is,” but fixed generation can still add dungeon/layout/enemy systems when called with `gameMode`.

## Task Candidates
- Make stray completion-safe: restrict targets, remove full pair, or add explicit orphan completion logic.
- Align wild completion policy across code, fairness, and docs.
- Split “real hidden full pairs” from “movable hidden tiles.”
- Clarify fixed-board behavior and tests.

## Verification
- Post-action fairness tests for stray, shuffle, destroy, peek, exit, room, shop, and enemy contact.
- Seed sweeps for generated boards and one-step transitions.

## Refinement Notes
- `Confirmed P0`: Stray runtime and preview allow normal hidden pair tiles, and runtime removes only one tile. Current tests encode that as allowed behavior, so this is a deliberate rule contract change.
- `Confirmed P1`: `isBoardComplete` can ignore unused hidden wilds while fairness still flags stranded wilds.
- `Confirmed P1`: shuffle eligibility uses hidden `pairKey` groups, not strictly real hidden full pairs.
- `Confirmed P2`: fixed-tile boards are not always copied as-is when `gameMode` allows dungeon/layout/enemy additions.
- Acceptance should require `inspectRunFairness` to remain green after every legal post-action transition.
