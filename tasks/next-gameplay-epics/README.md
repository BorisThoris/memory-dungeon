# Next Gameplay Epics

This track turns the current memory-card dungeon into a deeper roguelite loop without losing board readability.

## Epic Order

1. **Trait Builds And Combo Rewards**
   - Make traits a normal floor layer from the opener onward.
   - Make relics, shops, and rewards modify trait routing decisions.
   - Add visible previews and test coverage for trait adjacency payoffs.

2. **Between-Floor Reward Drafts**
   - Replace low-impact numeric picks with build-defining choices.
   - Keep drafts deterministic, route-aware, and capped against runaway loops.
   - Add reward categories: build relic, consumable, risk bargain, shop service.

3. **Shop And Run Economy**
   - Make shops common enough to solve route needs without becoming mandatory.
   - Add board-tool purchases, key insurance, trait services, and rerolls.
   - Verify locked exits always have a route to keys, shops, or alternative spends.

4. **Dungeon Pressure And Boss Identity**
   - Add floor pressure that interacts with memory instead of replacing it.
   - Expand enemy, trap, objective, and boss rules with readable telegraphs.
   - Keep every new hazard covered by softlock and final-pair tests.

5. **Run Identity And Archetypes**
   - Add starting loadouts/classes and route archetype weighting.
   - Make early choices steer trait density, rewards, and shop stock.
   - Surface current build identity in inventory and results.

6. **3D Board Value**
   - Keep 3D where it improves state readability: card depth, locks, levers, shops, hazards, route mood.
   - Avoid spectacle that obscures symbols, trait chips, or click targets.
   - Validate desktop and mobile framing with screenshots before shipping major presentation changes.

7. **No-Softlock Generator Contract**
   - Promote fairness checks into a generator contract.
   - Simulate thousands of seeded floors with legal actions, locks, shops, traits, and exits.
   - Fail tests on unreachable exits, impossible remaining pairs, or required resources with no source.

## Current Slice

Implemented vertical slices:

- Epic 1: trait builds and combo rewards.
- Epic 2: between-floor reward drafts with durable perks.
- Epic 3: shop economy, rerolls, key insurance, and trait cleanse.
- Epic 4: boss identity pressure hooks for memorize timing, mismatch pressure, shop prep, and dungeon read models.
- Epic 5: starting loadouts and inventory-visible run identity.
- Epic 7: reusable seeded no-softlock generator contract with final-pair projections and diagnostics.

Remaining work is mostly Epic 6 presentation polish and broader tuning passes on the new systems.
