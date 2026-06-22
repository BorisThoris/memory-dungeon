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
- Generated boards now assign traits after final dungeon repair/layout and can layer traits onto findables, hazards, keys, locks, levers, enemies, traps, and treasures, avoiding only singleton utility cards such as exits, shops, and rooms.
- Trait generation now repairs isolated placements into an adjacent interaction pair when possible, and larger boards seed multiple route/loadout combo adjacencies instead of a single decorative trait pair.
- Added second-order combo payoffs for `Conduit + Stasis`, `Sealed + Conduit`, and `Heavy + Mirror`, including board-control, shard, guard, and score outcomes.
- The HUD now surfaces active trait routes as a primary floor mechanic with route count/objective progress, first route text, build label, and routing tools.
- Board readability and accessibility now mark every combo-ready route card, including support-side trait cards, so the visible marker, telemetry, and screen-reader copy agree.
- Trait routing tools now expose proactive swap setup hints when no adjacency exists yet, so row/swap charges can be used to create combo routes instead of only repairing mistakes.
- Balance simulation now tracks floors where a one-swap move can create a match-triggerable trait route, keeping the swap-routing loop visible in generated-board guardrails.
