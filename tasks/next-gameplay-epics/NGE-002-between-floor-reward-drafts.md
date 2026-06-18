# NGE-002 Between-Floor Reward Drafts

## Goal

Make between-floor rewards build-defining rather than small stat bumps.

## Acceptance

- Draft choices alter play patterns, not just totals.
- Offers are route-aware and avoid incompatible contracts.
- Multi-pick offers cannot create long accidental pick chains.
- Tests cover deterministic offer contents, rerolls, bans, and upgrade services.

## Candidate Rewards

- Free first swap each floor.
- Echo effects trigger twice near Conduit.
- Heavy no longer blocks peek value but increases miss cost.
- Trait streak reveals a safe pair after three trait matches.
- Cursed becomes a bonus trait if matched before any normal pair.
- One visible hazard can be banished per floor.

## Implemented Slices

- Hazard Banisher is now a durable pressure-control perk: each new floor clears one active hazard marker before play, falling back to +1 destroy charge only when no hazard marker exists and no-destroy contracts do not block it.
- Heavy now has the intended tradeoff: clean matches keep the large score payoff, while misses cost +1 extra try without draining peek charges.
- Shrine Echo now has a bounded treasure payoff: the first claimed treasure chest in a run also grants +1 relic Favor progress, using the existing bonus reward ledger to prevent repeat farming.
