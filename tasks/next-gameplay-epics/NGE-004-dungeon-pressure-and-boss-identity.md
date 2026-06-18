# NGE-004 Dungeon Pressure And Boss Identity

## Goal

Add pressure systems that deepen memory decisions without turning the game into unrelated combat.

## Acceptance

- Enemy/trap pressure has clear telegraphing and bounded damage.
- Boss floors change memory rules with readable hooks.
- Hazards interact with traits and board powers.
- Every pressure rule has final-pair and no-softlock tests.

## Implemented Slices

- Stasis traits now interact with mismatch hazards: when no Guard Cache ward charge is available, a Stasis tile in the mismatched pair can absorb one Shuffle Snare or Fragile Cache mismatch through the existing ward pipeline without driving ward charges negative.
- Chapter Compass now improves successful boss preparation by adding a bounded score bonus to claimed boss trophy caches.
