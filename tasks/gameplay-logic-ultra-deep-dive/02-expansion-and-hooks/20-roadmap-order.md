# Pass 20: Roadmap Order

## P0 Fixes And Gates
1. Keep the core-loop/memory-tax gate mandatory before new mechanics.
2. Lock pair-resolution clarity around gambit, wild, decoy, cursed-last, hazards, destroy, stray, and route anchors.
3. Preserve last-pair/trap/decoy softlock regressions.
4. Make consequence copy unmissable for destroy, Perfect Memory, lives, flip par, and hazards.
5. Treat hazard vocabulary as a release gate.
6. Enforce offline/local v1 scope.
7. Route generation, scoring, save, daily, and schedule changes through version review.

## P1 Product Expansions
1. Action dock polish before more mechanics.
2. Route-world generation depth.
3. Safe card suite first.
4. Floor identity: banners, route promises, objective previews, boss/elite payoff.
5. Relic archetype payoff.
6. Shop/rest/event/treasure hooks with bounded economy.
7. Secondary objective clarity.
8. Symbol-band and distractor readability audit.

## P2 Defer Or Sandbox
- Prototype only: Mimic Cache, Omen Pair, Anchor Seal, Catalyst Altar, Loaded Gateway, Pin Lattice, Parasite Vessel.
- Defer: Time Loop, Mirror, Gravity Row, Living Door, Relic Echo, Shop Debt, Fog Bank, Chain Reactor.
- Reject for v1: Invisible Trap, Random Card Swap, Permanent Blind Card, Mandatory Sacrifice Exit, Infinite Copy Mirror, Silent Score Tax.
- Do not add separate talent/player-facing trait layer for v1.
- Keep free/extra undo rejected unless it has real cost and Perfect Memory impact.

## Recommended Order
1. P0 consequence-copy and preview sweep.
2. Pair-resolution matrix tests.
3. Hazard v1 tuning pass.
4. Route profile board generation and preview copy.
5. Safe card suite vertical slices.
6. Shop/rest/event/treasure hooks and economy exploit checks.
7. Relic archetype draft/payoff pass.
8. Floor/encounter identity and boss/elite presentation pass.
9. Balance simulation/playtest baseline refresh.
10. Prototype sandbox only after stability.
11. Release packaging, Steam smoke, final assets, acceptance report.

## Refinement Notes
- `Confirmed`: keeping P0 stability gates before feature expansion matches the rollup and current test routing.
- `Design Proposal`: move balance simulation/playtest baseline refresh before or directly adjacent to shop/rest/event/treasure expansion, because economy tuning gates are already weak.
- `Confirmed`: release packaging scripts exist, but there is no single gameplay release-gate script bundling CI, balance, renderer QA, visual smoke, and packaging smoke.
- `Outdated`: prototype-only list should treat Pin Lattice, Anchor Seal, and Omen Seal as already partially implemented route-special concepts rather than purely hypothetical.
