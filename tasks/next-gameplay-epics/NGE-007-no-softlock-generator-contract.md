# NGE-007 No-Softlock Generator Contract

## Goal

Make "never softlocked" a generator contract instead of a bug-by-bug patch cycle.

## Acceptance

- Seeded simulations cover locks, shops, keys, levers, traits, exits, hazards, enemies, and final-pair states.
- Tests fail on unreachable exits, unavailable required keys, impossible remaining pairs, or unsafe blocking effects.
- Dev diagnostics explain the failing seed, floor, required resource, and blocked tile/card state.
