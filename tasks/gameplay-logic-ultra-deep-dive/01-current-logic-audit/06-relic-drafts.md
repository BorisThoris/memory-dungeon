# Pass 06: Relics And Draft Offers

## Current Map
- Relic roster, rarity, weights, filters, archetypes, and contextual reasons live in `relics.ts`.
- Milestone drafts occur every 3 floors unless mode/cap/state gates block them.
- Pick budget stacks base pick, banked picks, generous shrine, Daily, meta upgrades, and Scholar bonus.
- Offer services include reroll/ban-style service state.

## Findings
- **P0/P1:** Exhausted eligible relic pool can create an offer with zero options and positive `picksRemaining`, blocking advancement.
- **P1:** `ban_option` does not persist into later pick rounds.
- **P1:** Service scope conflicts with docs: copy says per round, implementation tracks whole visit.
- **P2:** Reroll after ban can shrink below three options.
- **P2:** Comments/copy drift around milestone visit cap versus total pick cap.
- **P2:** `combo_shard_plus_step` copy says thresholds start closer, but implementation immediately grants +1 shard.

## Task Candidates
- Guard `needsRelicPick`/`openRelicOffer` against empty eligible pools.
- Thread `bannedRelicIds` through later option rolls.
- Decide per-round vs per-visit services and align code/copy/tests.
- Refill after banned reroll or document smaller option count.

## Verification
- Tests for exhausted pool, Daily pool exhaustion, ban persistence, service scope, and reroll option count.

## Refinement Notes
- `Confirmed P1`: initial `openRelicOffer` can produce `options: []` with remaining picks because cadence/cap checks are separate from eligible-pool checks.
- `Refined`: later multi-pick round exhaustion is already handled by closing the offer and advancing; GLD-P1-002 should focus on initial open and service-generated zero-option states.
- `Confirmed`: `ban_option` persists banned IDs, but normal next pick rounds ignore that list; service reroll/upgrade paths do respect it.
- `Confirmed`: service copy says "this draft round" while availability behaves like "this visit".
- `Confirmed`: `combo_shard_plus_step` implementation grants an immediate shard; older encyclopedia copy says thresholds start closer.
