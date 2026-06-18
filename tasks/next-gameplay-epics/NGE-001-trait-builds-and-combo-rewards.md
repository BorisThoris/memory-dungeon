# NGE-001 Trait Builds And Combo Rewards

## Goal

Make tile traits feel like a third core mechanic: players should route matches around trait adjacency, then draft relics and buy tools that meaningfully change those trait outcomes.

## Acceptance

- Trait interactions are present from early floors and remain deterministic.
- Existing relics create direct trait payoffs without introducing save-schema churn.
- Trait combo rewards are tested at the shared rules layer.
- Reward text and interaction tags stay unique and player-facing.
- New trait payoffs cannot softlock the board or bypass the memory game outright.

## Implementation Notes

- Keep trait math in `src/shared/tile-trait-rules.ts`.
- Prefer additive resource/score bonuses over new hidden state.
- Use existing relic IDs for this slice:
  - `chapter_compass` improves readable Echo/Conduit/Mirror routing.
  - `combo_shard_plus_step` improves Sealed/Echo shard engines.
  - `region_shuffle_free_first` improves Drift board-shaping.
  - `guard_token_plus_one` improves Mirror/Stasis guard builds.
  - `wager_surety` keeps Volatile/Cursed pressure playable.
  - `parasite_ledger` keeps Cursed greed builds profitable.

## Implemented Coverage

- Balance simulation now tracks `traitComboOpportunityPairs` and the `avg_trait_combo_opportunity_pairs_per_floor` guardrail row, so generated floors are checked for actionable trait adjacency instead of raw trait presence only.
- Shops now offer a trait-focused `trait_routing_kit` service when a floor has actionable trait adjacency; it grants existing peek and row/swap tools without save-schema churn.
- Route side-room reward drafts now expose trait build archetype tags such as Drift Routing, Conduit Cartographer, and Cursed Greed on relevant durable rewards.
- Starting loadouts now bias generated trait interaction pairs toward their intended build paths, making trait routing a run-defining board mechanic instead of only a later reward layer.
