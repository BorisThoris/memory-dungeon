# Pass 11: Memory-Tax Doctrine

## Design Map
- The core loop remains memory-led: explicit memorize phase, two-card resolution, and limited gambit exception.
- Powers are mostly classified correctly: pin is Perfect Memory-safe; peek/shuffle/destroy/undo/flash/gambit are blockers.
- Hazard tiles are the clearest current doctrine example: named outcomes, target policies, reduced-motion copy, and objective impacts.
- The engine can represent many ideas; the bottleneck is readability and preserving the memory game.

## Weak Spots
- Stray remove violates the softlock/fairness gate.
- Clean-clear destroy refill rewards strong memory with more future bypass.
- Pair-distance hints are default-on and expose meaningful partner information without Perfect Memory tracking.
- Face-down hazard telegraph parity may reveal more to screen readers than sighted players, or reveal too much to everyone.
- Perfect Memory is a boolean, not a causal ledger.

## Expansion Principles
- Prefer mechanics that create remembered priorities.
- Exact information must be scarce, charged, and Perfect Memory-locking.
- Spatial disruption must be constrained, animated, and remembered afterward.
- Hidden punishment needs visible tells and counterplay.
- Recovery should stabilize, not solve.
- Singleton/removal/transform mechanics require fairness proof.

## Task Candidates
- Add Perfect Memory blocker ledger.
- Reclassify pair-distance hints as comfort assist or explicitly exclude from purity.
- Audit face-down hazard telegraph parity.
- Require memory-tax rows for new powers, hazards, and relic actives.

## Refinement Notes
- `Confirmed`: memory-tax infrastructure exists for powers, dungeon cards, and hazards; the remaining gap is relic actives/services and any future family.
- `Confirmed`: Perfect Memory is still a boolean lock via `powersUsedThisRun`, not a causal ledger.
- `Confirmed`: pair-proximity hints are default-on and reveal partner distance without touching Perfect Memory tracking.
- `Likely`: face-down hazard telegraph parity needs an invariant test rather than more copy review.
- Acceptance should require every shipped mechanic family to declare memory-tax metadata or be explicitly exempt.
