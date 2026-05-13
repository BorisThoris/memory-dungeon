# Hazard Tile Matrix

## Status
Implemented for the promoted normal-run hazard set.

## V1 Hazards
| Hazard | Family | Trigger | Outcome | Safe-target rule | Objective interaction | UI / a11y surface |
| --- | --- | --- | --- | --- | --- | --- |
| Shuffle Snare | Penalty | Mismatch including a snare tile | Shuffles safe hidden normal tiles and clears stale pins only when it fires | Never moves exits, decoys, dungeon cards, route cards, pickups, other hazards, visible cards, removed cards, or cursed pairs | Preserves scholar/glass/cursed/findables directly; the triggering mismatch can forfeit flip par | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region trigger copy, reduced-motion trigger copy, floor-clear hazard row |
| Cascade Cache | Reward | Successful match of the cache pair | Removes one complete safe hidden normal pair and advances board completion | Never removes exits, decoys, dungeon cards, route cards, pickups, other hazards, visible cards, removed cards, or the cursed pair | Preserves scholar/glass, can help flip par, cannot auto-claim findables, and cannot bypass cursed-last timing | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region trigger copy, reduced-motion trigger copy, floor-clear hazard row |
| Mirror Decoy | Dual | Mismatch involving the singleton mirror decoy | Shows a copied symbol that never forms a pair and may remain face-up; first reveal alone is only information | Targets no other tile; singleton decoy never becomes an exit or valid pair | Can forfeit glass witness and flip par through false-read pressure; preserves scholar/cursed/findables directly | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region trigger copy, floor-clear hazard row |
| Fragile Cache | Reward | Clean match or mismatch involving either cache tile | Clean match adds bonus score; mismatch removes only the cache bonus marker | Targets no other tile; the pair remains matchable and cannot carry exits, decoys, dungeon cards, route cards, pickups, cursed pairs, or other hazards | Preserves scholar/glass/cursed/findables directly; the triggering mismatch can forfeit flip par | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region claim/break copy, floor-clear hazard row |
| Toll Cache | Dual | Successful match of the toll cache pair | Grants 1 shop gold and subtracts a 15-point score toll from that match, floored at 0 | Targets no other tile; never spends shards, guard, keys, lives, or other scarce resources silently | Preserves scholar/glass/cursed/findables directly; can help economy while tightening score goals | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region claim copy, floor-clear hazard row |
| Fuse Cache | Dual | Successful match of the fuse cache pair | Grants full score/gold if claimed in the first three floor resolutions, then consolation gold after the fuse expires | Targets no other tile; it only changes the matched pair payout and never changes board completion | Preserves scholar/glass/cursed/findables directly; rewards fast extraction while normal flip-par pressure still applies | Card-back accent, focused tile ARIA telegraph, HUD hazard count, live-region early/late claim copy, floor-clear hazard row |

## Live Copy Contract
| Hazard | Focus hint | Trigger announcement | Reduced-motion announcement |
| --- | --- | --- | --- |
| Shuffle Snare | Wrong pairs reshuffle safe hidden tiles. | Shuffle Snare fired. Hidden safe tiles reordered. | Shuffle Snare fired. Hidden safe tiles reordered without motion. |
| Cascade Cache | Clean matches clear one safe hidden pair. | Cascade Cache fired. One safe hidden pair cleared. | Cascade Cache fired. One safe hidden pair cleared without motion. |
| Mirror Decoy | Suspicious singleton: copied symbol, no valid pair. | Mirror Decoy misled the mismatch. It cannot form a pair. | Mirror Decoy misled the mismatch. It cannot form a pair. |
| Fragile Cache | Clean match pays a bonus; a mismatch breaks the cache. | Fragile Cache claimed. Bonus score added. / Fragile Cache broke. Its bonus is gone, but the pair still matches. | Same copy without extra motion. |
| Toll Cache | Clean match pays shop gold but takes a small score toll. | Toll Cache claimed. Shop gold gained; score toll paid. | Toll Cache claimed. Shop gold gained; score toll paid. |
| Fuse Cache | Claim in the first three resolutions for full payout. | Fuse Cache claimed early. Full payout gained. / Fuse Cache claimed late. Fuse expired; consolation gold gained. | Same copy without extra motion. |

## Objective Impact Terms
| Term | Meaning |
| --- | --- |
| Preserves | The hazard does not directly break the objective. |
| Can forfeit | Normal play around the hazard can cause the objective to fail. |
| Can help | The hazard can reduce pressure for the objective without granting direct reward credit. |
| Blocked target | The engine must exclude this target so player agency or reward ownership stays intact. |
| Special case | The row needs bespoke review before tuning or expansion. |

## Implementation Anchors
- `src/shared/hazard-tiles.ts` owns labels, trigger scope, target policy, focus hints, live-region copy, memory-tax scores, and board summaries.
- `src/shared/game.ts` owns deterministic assignment and resolution side effects.
- `src/renderer/components/TileBoard.tsx` and `GameplayHudBar.tsx` consume shared read models for player-facing copy.

## Non-Goals
- New hazard expansions must enter through this matrix with memory-tax, objective-impact, live-copy, and softlock coverage.
- No online/server validation or server RNG.
- No new final art or audio assets; existing procedural markers and copy are the v1 surface.
