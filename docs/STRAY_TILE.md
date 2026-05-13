# Remove stray tile (power)

**Goal:** Remove **one** completion-safe hidden singleton from play without scoring a pair - distinct from **Destroy pair** (removes a full hidden pair for no score).

## Rules

1. **Charge** - consumes `strayRemoveCharges` (earned like destroy or granted at run start for testing).
2. **Target** - player arms **Stray**, then taps a legal hidden singleton/special tile such as a wild joker, shop marker, or room marker. Normal real-pair tiles, the decoy (`DECOY_PAIR_KEY`), exits, Keystone Pair, Final Ward, and Omen Seal are blocked.
3. **Effect** - that tile becomes `state: 'removed'` (invisible / inert). Normal pairs are never split, so Stray cannot create an orphaned partner.
4. **Win** - `matchedPairs === pairCount` and no unfinished business. Legal Stray use must preserve board completion fairness.
5. **Achievements** - counts as **power used** (`powersUsedThisRun`).

## vs Destroy

| Power | Target | Result |
|-------|--------|--------|
| Destroy | Hidden pair | Both matched, no score |
| Stray | Completion-safe hidden singleton/special | One removed, normal pairs remain intact |
