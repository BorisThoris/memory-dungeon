# Pass 14: Card, Hazard, Pickup Families

## Design Map
- Current layers: findables, dungeon cards, hazard tiles, route specials, enemy overlays, and utility singletons.
- Route specials already cover several earlier card ideas without adding new families.
- Softlock safety is anchored in `isBoardComplete` and `inspectBoardFairness`.

## Weak Spots
- Mirror Decoy trigger copy/spec and runtime disagree.
- Shuffle Snare repeatability is unclear.
- Hazard placement is safe but not strongly floor-archetype expressive.
- Findables are mechanically thin.
- New families risk duplicate vocabulary unless they declare their layer first.

## Safe Expansion Candidates
- `ward_spark` findable: clean match grants one hazard ward.
- `scout_glint` findable: clean match performs limited family-only scout.
- `ward_cache` hazard/reward pair: clean match banks ward, mismatch breaks marker.
- `bounty_snare` dungeon trap variant: match to disarm and gain gold.

## Prototype Only
- Omen Pair, Anchor Seal, Pin Lattice reward.

## Verification
- Tests for Mirror Decoy trigger and Shuffle Snare repeatability.
- Any new family must update rules version, catalog, hazard/objective matrix, HUD live copy, visuals, and fairness tests.

## Refinement Notes
- `Confirmed`: current families are broader than the doc implies: dungeon cards, hazard tiles, findables, route specials, utility singletons, and moving enemy hazards.
- `Confirmed/outdated`: Pin Lattice, Anchor Seal, and Omen Seal are no longer prototype-only ideas; they exist as typed route specials with runtime/result copy.
- `Confirmed`: Mirror Decoy definition says first reveal/flip while runtime/test behavior is mismatch-based.
- `Needs Repro`: Shuffle Snare repeatability and cursed interaction need a second-mismatch/cursed-pair test.
- New family acceptance should include layer ownership, spawn eligibility, power interactions, objective impact, result row, fairness invariant, version gate, and generated-board coverage sample.
