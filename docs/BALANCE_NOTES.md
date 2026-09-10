# Balance notes (K2)

Post-relic / post-mutator tuning. Constants live in `src/shared/contracts.ts` unless noted.

## Recent intent

- **Gen 170 two simulations disagreed about Fever by five times, and the one that was wrong was the one everything was tuned against (`cascade-balance-simulation.ts`, `chain-tier-rules.ts`):** `sim:cascade` said a clean player reached Fever on 26% of floors; `sim:occupancy`, reading the run's own `feverBreaksThisFloor`, said 4%. The cascade sim was counting a break as Fever when `runChainTier(run)` read fever **after** the turn resolved - which is the tier the break's own pairs had just bought, not the tier the break happened at. The game increments the counter when the break itself resolves at Fever, and that is the honest reading. A simulation that re-derives a rule instead of reading the ledger the game keeps is the exact mistake the occupancy census exists to catch, one level up, and it is fixed the same way. With the counter read straight, a clean player's Fever share falls 0.26 → 0.14 and **every Fever band in the file turns out to have been tuned against an inflated number.** Then the real question, which is task 152's: a clean player's momentum reaches the Fever rung on 61% of floors but a Fever *break* lands on 8%, because at two thirds of a floor the rung arrives on the last match or two - when the board is nearly empty and there is nothing left for a Fever break to take. The halo, the celebration and the shard burst are all break-time effects, so Fever was content the game almost never showed. `CHAIN_TIER_FEVER_SHARE` moves 0.65 → 0.5: Fever is now "you ran half this floor clean". Measured across the share - 0.65 leaves a clean player at 0.08 of floors, 0.55 at 0.20, 0.5 at 0.27, 0.45 at 0.28 but takes the clean-over-reference separation to 1.88 against a band of 2, because half a floor is a run a sloppy player also puts together. At 0.5 the separation is 2.64, the relic loadout sits inside its bands at 0.13 clean against 0.037 reference, and the occupancy census at its own 15% miss rate goes 0.050 → 0.119, over the 0.1 bar a `common` system has to clear. **`feverBreaksThisFloor` leaves the thin list, which is now empty.** The census ratchet also moves from twelve floors to sixteen - `simulateSystemOccupancy`'s own default - so the ratchet and the aspirational check read the same census instead of two different ones; twelve held the ratchet to the first act, where floors are small, and Fever cleared its bar at sixteen (0.119) while still reading thin at twelve (0.050). Two more sample-size fixtures widened for the reason Gen 168 recorded: the release checklist's cascade row ran three seeds where the Fever bands are shares of a few dozen floors, so one floor either way moved the ratio past its band with nothing about the game changed.
- **Gen 169 the census could only see the dead half (`system-occupancy-simulation.ts`):** every bar in the occupancy census was a minimum, so it could name a system that never happens and nothing else. A system fails its own design just as completely from the other side: something written to be occasional that fires on a third of floors is not a flourish a player notices, it is part of the floor, and something written as one system among several that fires on nearly all of them has quietly become the loop while its neighbours went quiet. Each cadence now carries a ceiling as well as a floor - `rare` 0.005-0.25, `common` 0.1-0.9, `core` 0.9-1 - the report has a **Dominant systems** section beside its silent and thin ones, and the ratchet baseline records the dominant set the same way it records the other two. Run against the ceilings for the first time, two rows breached and **both were mislabels rather than generation faults**, which is worth stating because it is the answer a good diagnostic gives most often: `dungeonGatewaysUsedThisFloor` at 0.369 was filed `rare` and `findablesClaimedThisFloor` at 0.944 was filed `common`, and taking a route gateway or claiming a findable is something this game means to happen on most floors. They are relabelled `common` and `core` rather than tuned, and the dominant baseline ships empty - a result, not a placeholder. The table also prints per-floor intensity beside floor share now, because a system firing five times a floor and one firing once read identically as a share: matches resolve 5.31 times a floor, a chunk breaks 1.94, a findable is claimed 1.34. The test that proves the ceiling is wired hands the judge a census with a `rare` row pushed to 0.8, because everything real passes today and a bar nothing has ever failed is a bar nobody has checked.
- **Gen 168 the chain ladder had no middle, and the suits were why (`chunk-break-rules.ts`, `tile-suit-rules.ts`, `pop-reach-simulation.ts`):** measured at the rung each tier actually sits on - not at a fixed chain, which on a small floor is already Fever - the ladder paid 1.67 pairs per match at chain one, 1.91 at Clean, 1.92 at Sharp and 3.34 at Fever. **Sharp was worth one hundredth of a pair over Clean**, and the entire payoff sat at Fever, whose payoff is the halo: the neighbourhood of the clump whatever its suit, which is width, not depth. Two causes, and the second is the one the task named. (1) Every wave walked the whole connected same-suit region whatever the chain behind it - the reach ladder the design doc has described since Gen 143 was never in the code - so the tier decided only how many times that happened. (2) A suit averaged four and a half pairs, of which about half can break, so Clean's two waves swept everything a suit had and Sharp arrived at a clump already gone. Fixed together: a bounded wave stops two steps in (`BOUNDED_BREAK_REACH`, reach one was measured and takes the chain-one pop to 0.26 pairs, which is Gen 148's regression), the ripple moves from Clean to Sharp so each rung buys one thing, and the palette deals one suit per six pairs instead of one per two. The ladder now reads **1.18 / 2.32 / 2.71 / 3.71**, spread 1.66 → 2.53, thinnest rung 0.01 → 0.39, and `yarn sim:pop --check` bands both so it cannot flatten again. The chain-one pop is deliberately smaller - 1.67 → 1.18 pairs, and the early floors pop on 0.63-1.00 of matches where they used to pop on 0.94-1.00 - because a match with no chain behind it was taking most of what a Fever break takes, which is what left the ladder nothing to sell. **The drop came off the occupancy silent list**, exactly as Gen 151 predicted it would when a suit was big enough to leave a remnant; that baseline is updated and the two silences the reserve was supposed to wake keep their own tasks. Two relics needed repair, both because they were written against the flat ladder. Suit Lens capped a floor at three suits, which under the new palette is almost never binding - dead content - so it now deals one suit fewer than the floor would have, down to two; taking it to one was measured and is worse than dead, because a board with no map clears in 4.8 turns instead of 8.4 and Fever fell to zero across every band. Tuning Fork's partner reach at chain one makes floors clear faster (5.2 turns against 5.8) while the Fever rung is a share of the floor's pairs, so with the chain loadout held a clean player's Fever share on big floors fell to 0.08 against a 0.15 band - the chain build's centrepiece relic was buying width at the bottom of the ladder by taking the top away. It now sustains a Sharp or Fever break, whose pop feeds the chain in full rather than at half: clean 0.13, reference 0.05, separation 2.8. Full credit at every tier (separation 1.9) and from Clean up (1.81) were both measured and rejected - a chain of three is well within a sloppy player's reach, which is Gen 145's finding reproduced. Three test fixtures were widened rather than re-pointed, because in each case the sample was what disagreed and not the band: the clumped-deal control needed eight seeds rather than four (a shuffle landed at 0.56 against a 0.48 mean), the cascade bands six seeds rather than three, and the shop's trait-build preview was reading whichever traits the generated board happened to deal beside the two it sets up.
- **Gen 167 the reserve, third attempt and shipped (`dungeon-blueprint-policy-rules.ts`, `dungeon-card-recipe-rules.ts`):** the dungeon's paired-card capacity was the identical expression to the one deciding how many pairs the floor has at all, so a key, a lever, a gateway and an enemy could take every pair. It now keeps `LOOP_RESERVE_SHARE = 0.25` of the floor's pairs back, expressed as a ratio against the floor's own count the way Dead Cells derives its monster budget from combat-tile length, floored by `DUNGEON_MIN_PAIRS = 2` so no floor is reserved out of its own content. Per floor: 3 pairs keeps 1, 6 keeps 2, 13 keeps 3. Pop rate by floor moved 0.52 → 0.94 on floor 4, 0.90 → 1.00 on floor 7, 1.00 → 1.00 on 8 with pairs-per-match 1.80 → 2.60, and suits per floor came back from 1 to 2-4 on floors 9-11 because there are finally enough breakable pairs to spread a palette over. `sim:cascade --check` passes with every band held and rating drift 0. **What the reserve did NOT do, against the earlier prediction: nothing came off the silent list.** The Gen 149 note measured shuffle snares and the safe-hazard ward returning at a 40% share; at the 25% that shipped they do not, and neither does the drop (0.006 at 16 floors, 0 at the census's 12 — unchanged from before the reserve). Those three keep their own tasks rather than being counted as solved here. The two earlier attempts failed on the trim, not the reserve, and `capDungeonCardRecipeForBudget` needed four passes it did not have. (1) `pacify_floor` and `defeat_boss` were not in the objective-protection list at all, so an elite lost the enemies it exists to pacify. (2) A boss floor overrides its archetype's objective, so a boss `trap_hall` lost its traps; the trim now protects the live objective and the archetype's own. (3) Threat is protected in full before anything optional, because paying the reserve out of enemies and traps took `routeRiskRejections` to zero across all nine builds of `build-strategy-playthrough-simulation` — a route the risk policy would refuse had stopped existing, so the reserve was buying loop material by quietly disarming the dungeon and would have shown up later as a whole system going silent. (4) An objective made of several kinds now keeps one of each before any gets a second copy: `loot_cache` is the cache, the lock and the key, the recipe writes the treasures first, and a straight take filled a treasure gallery with three caches and no lock and no key while its exit still asked for a treasure key — the floor's own objective trimmed into something uncompletable. That is the same breadth-before-depth rule the generic fill uses, applied one level earlier. Reading `objectiveContributions` off the card definitions instead was tried and is worse: `find_exit` is contributed to by nearly every card, so that take swallows the whole capacity. Three assertions moved with the change and are recorded as layout shifts rather than losses: the capacity numbers, the deterministic shop stock (six items still, a different six), and the boss-overlay test, which was asserting a damage-per-turn rate that was never its point and now matches safe pairs until the boss falls. Nothing else in 4064 tests moved: the blueprint recipe and the dungeon-routing fixtures both went back to passing untouched once the four passes were in, which is the check that the trim is protecting content rather than the fixtures being rewritten around it.
- **Gen 151 the drop is subsumed by the ripple, and `sim:pop` was measuring a board nobody plays (`chunk-break-rules.ts`, `pop-reach-simulation.ts`):** the census said the drop fires on no floor. Probing 1053 matches through the real turn path over 120 generated floors says why, and it is two things. The small one is the drop's own: a pair with a job - the exit, a key, an enemy, a treasure - left in the matched suit used to veto the whole drop, and that refused 483 of 501 Sharp and Fever breaks. A key is not what holds the plain tiles up, so it no longer stops them falling; it simply is not taken. The large one is not the drop's to fix: at Sharp the ripple runs until a wave takes nothing, so it has already swept the suit - 0 plain pairs left on 92-98% of breaks at *every* tier (none 92%, clean 98%, sharp 98%, fever 97%). The drop was written for a break that took only the touching clump, and Gens 143-145 gave the break the whole suit. Two ways out were measured and rejected. Letting it run at the bounded tiers takes it to 11.3% of floors and Fever from 4% to 6.9%, but on a four-pair suit it hands a chain-one match the whole suit - the tier ladder collapsing, and three ripple tests said so. Tightening the census's `rare` band from 0.005 to 0.02 so the fixed drop's 0.6% would register honestly as thin called three hazard caches thin too, which sit at 4-7% over 160 floors: the bar was measuring the sample, not the game. So the drop stays a Sharp reward and stays on the silent list, with one of its two reasons gone, and `ACH_NOTHING_HELD_IT` stays unearnable until a suit is big enough to leave a remnant. That is the task. Separately, `sim:pop` was asking `buildBoard` for a bare floor - no tag, archetype, objective or mutators - which is the same mistake one level up as the one it exists to catch. It now builds floors through `pickFloorScheduleEntry` like a run does. Measured both ways the scheduled floors pop at least as often (0.52-1.00 against 0.50-1.00), so no band moved; the number now describes the game.
- **Gen 149 the occupancy census, and the reserve measured then set down (`system-occupancy-simulation.ts`, `dungeon-card-recipe-rules.ts`):** the run's own per-floor counters, played over 120 generated floors, say which systems ever happen to a player. Twelve never fire at all (the drop, roaming hazard hits, shuffle snares, mirror decoys, mimic caches, the magpie's theft, anchor seals, catalyst altars, parasite vessels, pin lattices, lantern wards, safe-hazard wards) and one is thin (a break lands at Fever on 4% of floors against a 10% bar). Four of the twelve are route specials the census cannot reach because it plays floors rather than runs, which is its own task. Reserving pairs from the dungeon's budget for the loop was implemented and measured twice and then reverted: at a 40% share it lifted floors 3-6 of the pop rate by about a tenth and woke shuffle snares and the safe-hazard ward, but gutted floor identity (an elite floor paid no reward, a treasure gallery held no treasure); at 25% it kept most of the gain and still cost a long tail of floors the card their archetype is named for. It is worth doing with the recipe taught to cut optional content before identity, and that is its own change. The attempt also proposed a trim order for `capDungeonCardRecipeForBudget` - one key of each kind before anything optional, so a floor that hands you a key and a lock still hands you both after a cut. That belongs with the reserve rather than ahead of it, for two reasons found by measuring it: with the capacity still equal to the floor's whole pair count nothing is ever cut, so it buys nothing today; and the order of `selected` is the order the cards are laid, so reordering it moves cards between board slots - it took the locksmith build's master-key uses to zero across every seed, because the locks that build buys a master key for are the ones the recipe writes keyless on purpose. A keyless lock is not a softlock: a master key opens any of them, the exit included, and the shop sells one.
- **Gen 148 the pop, on floors a player actually plays (`tile-suit-rules.ts`, `chunk-break-rules.ts`, `pop-reach-simulation.ts`):** the live pop from Gens 143-145 fired on nothing for the first six floors of a real run. Measured per floor with the new `yarn sim:pop`: floors 1-3 popped on 0% of matches on every seed, floor 5 on 19%. Two generation causes, both fixed. (1) The suit palette was four suits however small the floor, so on a two- or three-pair floor no two pairs shared a suit and a pop was impossible; the palette now scales with the floor's *breakable* pairs (`suitCountForPairs`: one suit under four, four at eight). (2) Caches and snares (`tileHazardKind`) were excluded from breaking alongside keys and levers, and they were one to two of the three to seven pairs on early floors; a pop now takes them without springing them, losing their reward. After: floors 1-6 pop on 50/79/56/90/94/100% of matches, floors 7-12 on 61-85%. The dungeon's paired-card budget was left alone - reserving pairs from it moved the rate by a few points and broke 13 tests across the dungeon, route and simulation layers, so it is a batch of its own. Consequences: a floor clears in 6.3 turns rather than 9.2, so the ladder was re-tuned - the pop's own wave feeds momentum at half credit and every wave the chain bought at full (measured against full credit, where a 25%-miss player reached Fever on 22% of floors against a clean player's 35%, and against no credit, where the ladder starved at 4%). Final: Fever on 20% of clean floors against 6% at the reference miss rate, chunk share of score 0.15, cleared 1.00, rating drift 0. One band moved with the design: `cleanFeverShareOnBigFloors` 0.5 → 0.15, because Fever is now the celebration on a loop that already pays, and a new band `feverCleanOverReference ≥ 2` carries what the old one protected. Design doc §10.
- **Gens 143–145 the live pop (`chunk-break-rules.ts`, `tile-suit-rules.ts`):** every match now pops the whole same-suit clump touching it, chain or no chain — a pair goes when both its halves touch — and the chain buys the ripple: from Clean, a partner pulled from across the board takes its own clump (two waves), Sharp runs the reaction until a wave takes nothing, Fever adds the halo. The deal lays every suit of three pairs or more as two islands seeded apart (1.7–1.9 islands per suit, ~30% of pairs straddling), which is what gives the ripple something to bridge. Cascade pay gains ×(1 + 0.2·(waves−1)), capped ×2. Measured on the same 6 seeds × 24 floors × 3 miss rates: miss 0 → 8.3 turns (9.2 before), 5.15 pairs a floor from breaks (4.13), chunk share of score 0.16, Fever on 50% of floors (59%), a second wave on 14%; miss 0.1 → 14.0 turns, Fever 34%; miss 0.25 → cleared 0.92, 20.1 turns, Fever 19%, rippled 10%. Every band holds; rating drift 0. Two variants were measured and rejected: a ladder fed by the ripple alone (Fever 4% of clean floors — partners rarely sit outside their clump) and one clump per suit (the ripple fired on about 5% of floors). Design doc §8.
- **Gen 137 the drop (`chunk-break-rules.ts`, `DROP_MAX_PAIRS = 2`):** a Sharp or Fever break that leaves the matched suit with two plain pairs or fewer takes them too. Measured on the same 6 seeds × 24 floors × 3 miss rates: miss 0 → 4.13 pairs a floor (4.2 before), chunk share of score 0.12 (unchanged), Fever on 59% of floors; miss 0.1 → 3.74 pairs, Fever 33%; miss 0.25 → 2.81 pairs, Fever 15%. Every bare band and every relic-loadout band holds without change. The drop moves pairs from the end of a suit into the break that emptied it rather than adding pairs: a suit's remnant was going to be matched anyway, so the sim's clear rate and rating drift (0) are untouched.

- **Gen 132 closing sweep:** `yarn sim:cascade --check` and `--relics --check` re-run after Gens 127–131; every band holds and the report numbers are those recorded under Gen 130 and Gen 126 — nothing in the clump read, the feel layer, the records, the relic registrations or the chain's carry into daily and shared play touched the cascade's pay.

- **Gen 130 chain relics (`relics.ts`, `chunk-break-rules.ts`, `tile-suit-rules.ts`):** Tuning Fork (`tuning_fork`, Clean depth 2), Magpie's Ledger (`magpie_ledger`, spilled treasure gold ×2) and Suit Lens (`suit_lens`, three suits a floor). Measured alone on 6 seeds × 24 floors, each keeps every bare band: 25%-miss Fever share 0.14 / 0.15 / 0.19, clean chunk share of score 0.14 / 0.12 / 0.13. Held together the reference Fever share is 0.23 and the clean chunk share 0.14, so the full loadout is held to `CASCADE_RELIC_BANDS` (reference Fever ≤ 0.3) rather than the bare 0.2 — a build of three chain relics is meant to move that number, and the relaxation is written down rather than absorbed into the bare bands.

- **Gen 126 deal profiles (`tile-suit-rules.ts`):** the floor archetype now chooses how suits are dealt — clumped (breather, treasure gallery, gate, shadow read, anchor chain, script room, parasite tithe), scattered (speed trial, trap hall, rush recall) or two-suit (spotlight hunt). Clean-player sim on 6 seeds × 24 floors: clumped floors cascade 4.25 pairs a floor with Fever on 60%; scattered 2.07 and 50%; two-suit 7.83 and 75%. Overall bands unchanged and green (chunk share of score 0.12 clean, 0.10 at 25% misses; Extreme Fever 0.75 / 0.45 / 0.21).

- **Gen 125 Extreme Fever (`floor-clear-momentum-bonus-rules.ts`):** the floor's end pays the momentum still standing when the last pair goes — one gold at Clean or Sharp, a shard (capped at `MAX_COMBO_SHARDS`) and two gold at Fever, tagged `extreme_fever`; never score or rating. Sized against the floor's own gold (three to eight, `getShopGoldRewardForFloor`) and the vendor's prices (two to five) so it reads as a tip, not a wage. Measured on 6 seeds × 24 floors: Extreme Fever share 0.76 at zero misses, 0.47 at 10%, 0.19 at 25%; the band `extremeFeverCleanOverReference ≥ 1.5×` holds at 4×. The per-floor counters it reads (`feverBreaksThisFloor`, `bestChainThisFloor`) also feed the floor-clear recap.

- **Gen 121 cascade balance (`cascade-balance-simulation.ts`, `yarn sim:cascade`):** the chain → chunk → Fever loop is now tuned against a report, not a feel. The sim plays a fresh endless floor at each level with a player who attempts a miss on a stated share of turns (a miss is a real mismatch: two hidden tiles from different pairs, never the shop or the exit), records turns to clear, mistakes as the game counted them, the rating, the score and the share of it the chunks paid (`chunkScoreThisFloor`, a run ledger, not a re-derivation), how many pairs the chunks took, and whether a Fever break happened. Bands live in `CASCADE_BALANCE_BANDS` and are gated by `cascade-balance-simulation.test.ts` (3 seeds × floors 1–18) and `yarn sim:cascade --check`. What the first runs found, and what changed: (1) with the rungs fixed at ×6/×10, Fever arrived on 0% of floors for a player who never missed, because chunks shorten the floor — Sharp and Fever are now shares of the floor's pairs (`max(4, 40%)`, `max(7, 65%)`); (2) with floor-relative rungs but a streak-only ladder, a 0%-miss player reached Fever *less* often than a 10%-miss player (0.22 vs 0.33) — the ladder now climbs on momentum, streak plus pairs cascaded since the chain last dropped, and a miss zeroes the cascade part; (3) on floors 3–9 the chunk broke on almost nothing (1–3 plain tiles, the rest dungeon cards, mostly treasure) — treasure pairs now spill with the chunk and pay as matched; (4) a Fever rung with no breakable neighbour was a Fever with nothing to show — Fever takes the clump's halo; (5) `settledShare` 0.94 turned out to be the sim player flipping the shop as a "miss", not a softlock. Final report on 6 seeds × 24 floors: miss 0 → cleared 1.00, 9.2 turns, chunk share of score 0.12, 2.4 breaks / 4.2 pairs per floor, Fever on 59% of floors; miss 0.1 → cleared 0.99, 15.0 turns, Fever 36%; miss 0.25 → cleared 0.90 (the rest died, none stuck), 21.7 turns, chunk share 0.10, Fever 14%. Rating equalled `calculateRating(mistakes)` on every one of 432 floors: a chunk never moved a rating. Cascade pay: 60% of a base match per pair plus `6·n·(n−1)` for size, ×1.5 at Fever; shards one per two pairs, one per pair at Fever. Not done: per-floor clustering profiles on the cycle (no authored per-floor table to hang them on), and the milestone copy (`x6`/`x10`) still names the fixed score rungs, not the floor's tier rungs.

- **V4 cycle 47 first-run/onboarding stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current first screen, fresh Classic recommendation, first-room playable prompt, first reward/floor-clear route-choice setup, Safe / Greed / Mystery teaching, and onboarding persistence remain integrated. No runtime code, score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flow changed. Verification is green on May 27, 2026 for the focused first-run slice (8 files / 120 tests), shared typecheck, adjacent GameScreen/HUD/gameplay reward-choice slice (4 files / 338 tests), full typecheck, scoped ESLint, anchored conflict-marker scan, diff whitespace check with only existing LF-to-CRLF normalization warnings, and isolated renderer build with the known large-chunk/media warnings. Remaining proof is quiet-server/manual actual fresh Classic first miss/recovery, full first-room clear without fixture injection, all three Safe / Greed / Mystery route branches, mobile-width line length, and rerunning standard playable-path e2e on a quiet server.

- **V4 cycle 8 first-run/onboarding stabilization:** continuation stayed verification-, browser-smoke-, and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current first screen, fresh Classic recommendation, first-room playable prompt, first reward/floor-clear route-choice setup, Safe / Greed / Mystery teaching, and onboarding persistence remain integrated. No runtime code, score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flow changed. Verification is green on May 27, 2026 for the focused first-run slice (8 files / 119 tests), shared typecheck, adjacent GameScreen/HUD/gameplay reward-choice slice (4 files / 338 tests), full typecheck, scoped ESLint, balance-note drift test, diff whitespace check with only existing LF-to-CRLF normalization warnings, isolated Edge first-screen-to-Classic-level-1 smoke, isolated Edge floor-clear route-choice smoke, and isolated renderer build with the known large-chunk/media warnings. Standard Playwright proof remains blocked by local harness contention: the compact Classic helper exceeded a 5-minute outer timeout and the reporter hit `EPIPE` after termination. Remaining manual proof is actual fresh Classic first miss/recovery, full first-room clear without fixture injection, all three Safe / Greed / Mystery route branches, mobile-width line length, and rerunning standard playable-path e2e on a quiet server.

- **V4 cycle 17 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused on May 27, 2026 after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain inside guardrails, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants changed. Verification passed: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, balance-note drift test (1 file / 3 tests), scoped ESLint for balance-adjacent shared files, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining proof is still quiet-server/manual fresh Classic through floor-1 clear into Safe / Greed / Mystery, with route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density checked before threshold changes.

- **V4 cycle 16 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, focused long-run/balance slice (6 files / 44 tests), and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 7 first-run/onboarding stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree. Current first screen, first-room playable prompts, miss-recovery copy, first reward/final-pair setup, route-choice teaching, and onboarding persistence remain green under focused first-run tests, adjacent GameScreen/gameplay prompt checks, shared and full typecheck, full Vitest, lint, strict conflict-marker scan, diff whitespace check, and isolated renderer build on May 27, 2026. No runtime code changed. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flows changed. Browser proof remains blocked before app assertions: the bounded Classic Playwright helper timed out at `page.goto('/', waitUntil: 'domcontentloaded')` on `127.0.0.1:5173` with the known artifact ENOENT noise. Remaining proof is quiet-server/manual active-onboarding Classic through first miss/recovery, first room clear, Safe / Greed / Mystery route selection, and mobile-width line length.

- **V4 cycle 15 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1337 tests), full lint, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof remains blocked locally: `yarn playwright test e2e/navigation-flow.spec.ts --grep "Play opens Choose Your Path" --workers=1 --reporter=list` exceeded the outer timeout before useful runner output amid many concurrent Node/Chrome sessions. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 13 combat stabilization:** continuation stayed stabilization-focused after inspecting the dirty `main` worktree. One scoped test-fixture integration fix landed in `src/shared/game.test.ts`: the paused zero-health stale shop fixture now uses the current `heal_life` shop item shape, including compatibility fields, so shared typecheck covers the existing death/resume guard without weakening the contract. Focused combat tests, the broad combat slice, shared and full typecheck, balance-note drift, 1000-floor endless schedule smoke, full Vitest, lint, conflict-marker scan, diff whitespace check, and isolated renderer build are green on May 27, 2026. No enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop price, scoring, hazard-cadence, combat-read, patrol-movement, save-schema, or economy constants changed. The bounded `e2e/gameplay-readability.spec.ts` Playwright attempt reached the runner but failed all 11 cases before app assertions because `127.0.0.1:5173` reset/refused connections after `page.goto`. Remaining proof is quiet-server browser/manual combat QA for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, fatal/invalid armed-power contact feedback, guard-spent contact, trap mismatch with and without ward, boss HP chip updates, and death/retry flow on desktop/mobile.

- **V4 cycle 6 first-run/onboarding stabilization:** continuation stayed focused on first screen, first room, first choice, first reward/failure, and goal clarity after inspecting the dirty `main` worktree. Current first-run launcher/help-center split, playable first-pair prompts, miss-recovery copy, final-pair reward setup, route-choice teaching, and onboarding persistence remained green under focused first-run tests, adjacent GameScreen/gameplay prompt checks, shared and full typecheck, full Vitest, lint, strict conflict-marker scan, diff whitespace check, and isolated renderer build on May 27, 2026. One scoped build-gate fix aligned ESLint ignores with generated artifact directories already ignored by git so `yarn lint` no longer fails when `test-results/` is absent. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, or balance constants changed. Remaining proof is quiet-server browser/manual active-onboarding Classic through first miss/recovery, first room clear, Safe / Greed / Mystery route selection, and mobile-width line length.

- **V4 cycle 14 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree. Current balance/resource/reward diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 360 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1334 tests), full lint after a concurrent test cleanup landed, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof remains blocked before app assertions: `e2e/navigation-flow.spec.ts` still times out on `page.goto('/', waitUntil: 'domcontentloaded')` against `127.0.0.1:5173` and reports Playwright artifact ENOENT noise. Remaining manual proof is fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 5 first-run/onboarding wrap-up:** continuation stayed stabilization- and verification-focused after inspecting the dirty `main` worktree. Focused shared first-run, renderer onboarding/menu, app/store, full typecheck, full Vitest, lint, isolated renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. Production preview browser smoke passed main menu -> Choose Your Path -> Classic level 1 with screenshot `output/playwright/first-run-v4c5-level1.png`; full guided floor-clear browser proof remains a quiet-server follow-up because standard `127.0.0.1:5173` Playwright failed before app assertions and isolated Vite dev servers timed out serving `/`, while production preview lacks the DEV-only board-pick hook used by the floor-clear helper. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, economy, or balance constants changed.

- **V4 cycle 13 balance/difficulty stabilization:** fixed one integration breakage from the current dirty worktree without changing runtime balance math: a stale renderer store test side-room fixture now uses `rest_shrine`, matching the shared `RouteSideRoomKind` contract while preserving `nodeKind: 'rest'`. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 360 tests), shared and full typecheck, affected store + balance simulation tests (2 files / 71 tests), 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1329 tests), lint, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof is still blocked: an isolated `127.0.0.1:5193` Vite server became reachable but the in-app browser timed out on `domcontentloaded` and exposed an empty accessibility tree, and the existing `e2e/navigation-flow.spec.ts` smoke also exceeded the outer timeout. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, save schema, or gameplay constants changed. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 12 balance/difficulty wrap-up:** added one reporting-only long-run gate row for the existing stranded low-life diagnostic: `max_profile_unhealed_low_life_streak`. The 48-floor gate now prints both worst-seed unhealed low-life share and the longest unhealed low-life streak, making recovery cliffs visible in standard balance output without changing score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, or gameplay constants. Verification is green on May 27, 2026: focused balance/resource/gameplay slice, shared and full typecheck, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest, lint, isolated renderer build, conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 10 memory mechanic depth wrap-up:** continuation stayed stabilization- and verification-focused after inspecting the dirty `main` worktree. Focused memory/HUD checks, shared and full typecheck, broader shared recall gameplay checks, lint, isolated renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No recall scoring, focus cap, clue bonus, burden threshold, route readiness logic, life, route payout, shop cost, assist charge, reward, economy, memory-pressure, or gameplay constants were changed. Remaining work is quiet-server/manual browser proof for fresh Classic through floor-1 clear into Safe / Greed / Mystery, checking the memory read panel, route readiness labels, polite recall announcements, capped focus display, burden line length, repeated-copy cadence, patrol-only strained recall copy, compact HUD recent-action priority, and desktop/mobile density.

- **V4 cycle 4 first-run/onboarding wrap-up:** continuation stayed stabilization- and verification-focused on the dirty `main` worktree. Focused shared, renderer, app/store, full Vitest, full typecheck, diff hygiene, conflict-marker scan, and alternate renderer build are green on May 27, 2026. A custom real Chromium smoke on an isolated `127.0.0.1:5183` Vite server passed main menu -> Choose Your Path -> guided Classic level 1 -> floor clear -> Safe / Greedy / Mystery route-choice setup, confirming the first screen, first room, first reward, and first choice path in-browser. The standard Playwright config path on reusable `127.0.0.1:5173` still failed before app assertions with a `page.goto('/')` `domcontentloaded` timeout and artifact ENOENT noise, so repo-spec browser proof remains a quiet-server follow-up. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants changed.

- **V4 cycle 11 balance/difficulty wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, lint, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, economy, or gameplay constants were changed. Remaining manual proof is still live Classic route-choice readability for Safe / Greed / Mystery, low-life recovery reads, boss pressure reads, reward overflow messaging, wallet clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 9 memory mechanic depth wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused memory/HUD checks, shared and full typecheck, broader shared recall gameplay checks, full Vitest, lint, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No recall scoring, focus cap, clue bonus, burden threshold, route readiness logic, life, route payout, shop cost, assist charge, reward, economy, memory-pressure, or gameplay constants were changed. Remaining work is quiet-server/manual browser proof for fresh Classic through floor-1 clear into Safe / Greed / Mystery, checking the memory read panel, route readiness labels, polite recall announcements, capped focus display, burden line length, repeated-copy cadence, patrol-only strained recall copy, and desktop/mobile density.

- **V4 cycle 9 combat stabilization:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared/renderer combat checks, shared/full typecheck, full Vitest, balance-note drift, conflict-marker scan, diff whitespace checks, and an isolated renderer build are green on May 27, 2026. No enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop, scoring, hazard-cadence, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser attempt did not reach app assertions because the local Vite web server exited with code `4294967295`, followed by goto timeout/reset/refused connection failures. Remaining work is still live browser/manual proof for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, invalid/fatal armed-power contact feedback, boss HP chip updates, and death/retry flow on desktop/mobile.

- **V4 cycle 10 balance/difficulty wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, full Vitest, lint, the 48-floor long-run gate, the 1000-floor endless schedule smoke, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, economy, or gameplay constants were changed. Remaining manual proof is still live Classic route-choice readability for Safe / Greed / Mystery, low-life recovery reads, boss pressure reads, wallet clarity, and desktop/mobile density.

- **V4 cycle 3 first-run/onboarding wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. The current fresh-profile Classic launcher, guided first-room target prompts, first miss recovery, first reward/final-pair setup, route-choice teaching, and app/store onboarding persistence remain green under focused tests, full typecheck, full Vitest, and the alternate renderer build on May 27, 2026. Browser proof is now partially green on a fresh healthy Vite server: the first-screen-to-level-1 navigation smoke and compact Classic helper passed, while the heavier floor-clear playable-path browser case still exceeded a six-minute outer timeout during concurrent local reloads. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants changed.

- **V4 cycle 9 balance/difficulty diagnostics:** added stranded low-life profile diagnostics without changing runtime balance constants. Balance profiles now track low-life floors that do not have immediate shop healing access, expose max unhealed low-life streaks, gate worst-seed unhealed low-life exposure, and print the worst-seed unhealed-low-life row in the 48-floor long-run gate. The current greedy profile still reaches low-life pressure but remains fall-free, with worst-seed unhealed low-life share at 0.29 against the 0.45 bound.
- **V4 cycle 8 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, balance-note drift, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, or economy constants were changed.
- **V4 cycle 2 first-run/onboarding wrap-up:** stabilization preserved the current first-screen Classic launch, guided first-room prompt flow, first miss recovery copy, and first route-choice teaching without changing score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants. The only runtime hardening was startup raster preload fail-open behavior so a stuck image decode cannot block boot. Focused first-run checks, full typecheck, full Vitest, and alternate renderer build are green on May 27, 2026; live playable-path browser proof remains blocked by local Vite connection resets/refusals and needs a quiet-server rerun.
- **Rules v16 higher tension rebalance:** objective and boss rewards are larger, but missed objective streaks decay faster, first-mismatch grace narrows after floor 1, mistake recovery grants less memorize time, clean clears no longer award destroy charges, and shop / relic services cost more.
- **V4 cycle 1 combat stabilization:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, balance-note drift, the 1000-floor endless schedule smoke, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, status-effect, or patrol movement constants were changed. The closest browser gameplay-readability smoke exceeded a 10-minute local timeout without runner output, and broad `yarn test` is blocked outside combat by startup asset preload tests, so live fatal-patrol/boss-pressure proof and full-suite signoff remain pending.
- **Rules v29 long-run balance pass:** floor-clear shop gold starts at 2 and caps at 8 per floor so long runs cannot outgrow shop sinks indefinitely; boss floors keep a single moving patrol overlay and carry an explicit guard shrine utility pair to reduce late-cycle survivability cliffs without removing boss pressure.
- **Cycle 1 difficulty-ramp refinement:** generated dungeon runs keep floor 1 free of runtime hazard tiles, then introduce deterministic hazard tiles from floor 2 onward. Moving enemies were already gated off floor 1; this makes the first playable floor a true onboarding floor without reducing later resource pressure.
- **Cycle 2 survivability diagnostics:** balance profiles now carry lives, heal purchases, run falls, healing-spend share, and repeated at-risk streaks per seed. Greedy profiles still claim more reward value, but they must buy healing before last-life collapse so long-run averages cannot hide run-ending survivability cliffs.
- **Cycle 3 safe-route sustain sink:** Safe-route rest side rooms still rescue damaged runs, but no longer bypass scarcity for free when the wallet has value; claiming the heal spends 1 shop gold if available. This keeps Safe as the recovery route while preventing repeated safe rests from becoming a dominant no-cost sustain loop.
- **Cycle 4 direct safe-route sink:** The immediate Safe route recovery/guard payout now also spends 1 shop gold when the run has any gold, while remaining free when broke and free when already capped. Safe remains the survival route, but choosing it repeatedly no longer preserves a growing wallet for later shop spikes.
- **Cycle 5 destroy-charge scarcity:** Floor advancement no longer grants destroy charges for clean/perfect clears. Destroy remains an uncapped run bank, but inflow now comes from explicit economy sources (shops, relics, events, rooms, and pickups), so clean-clear skill rewards do not snowball into a dominant assist loop.
- **Cycle 6 route dominance diagnostics:** balance profiles now model Safe, Greed, and Mystery route choices, including Safe toll spend and Greed life costs. Bounds fail when any profile leans too hard on one route or when greed cadence creates run falls, keeping route rewards from becoming a single dominant strategy.
- **Cycle 7 wallet-carry diagnostics:** balance profiles now report discretionary shop spend, ending shop gold, and peak gold held. Long-run gates fail if survivable profiles are also carrying runaway unspent wallets, so scarcity checks cover both healing pressure and late-run purchasing power.
- **Cycle 8 recovery-debt diagnostics:** pressure floors now report local guard/shop/room/key relief and max net-pressure streaks. Profile bounds fail when pressure clusters outrun nearby recovery even if total lives, wallet, and boss win rates still look healthy.
- **Cycle 9 low-life exposure diagnostics:** profile simulations now count floors ending at 2 or fewer lives, plus max low-life streaks. Bounds fail when a run survives on paper but spends too much time near collapse, covering survivability cliffs that do not show up as deaths.
- **Cycle 10 seed-variance diagnostics:** balance profiles now retain per-seed outcomes and gate worst-seed clear share, worst-seed low-life exposure, per-seed run falls, max seed wallet, and best-vs-worst clear spread. Aggregate averages can no longer hide one rough seed inside an otherwise healthy profile.
- **V3 cycle 10 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance, difficulty, combat-adjacent shared checks, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, or difficulty constants were changed.
- **V3 cycle 11 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, endless schedule smoke, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 12 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, endless schedule smoke, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 13 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, difficulty ramp, floor-mutator schedule, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 14 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, difficulty ramp, floor-mutator schedule, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 1 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/gameplay checks, shared and full typecheck, full Vitest, alternate renderer build, long-run gate metrics, 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 2 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/reward checks, shared and full typecheck, 48-floor long-run gate metrics, 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026. Full Vitest is blocked by two startup-asset preload test timeouts outside this lane; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 4 balance/difficulty wrap-up:** continuation pass added focused regression coverage for existing Safe-route toll and Greed life-cost diagnostics in `src/shared/balance-simulation.test.ts`, then reran balance profile, long-run, endless schedule, shared/full typecheck, and diff-whitespace verification. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, or economy constants were changed. Full Vitest remains load-sensitive outside this lane: the full run timed out in one renderer app-flow test at the default 5s timeout, while `src/renderer/App.test.tsx` passed alone with a 10s timeout.
- **V4 cycle 5 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only. Focused balance/resource/gameplay checks, balance-note drift, long-run depth, economy ledger, shared/full typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, route-share, wallet, or profile-bound constants were changed.
- **V4 cycle 6 balance/difficulty wrap-up:** continuation pass added one focused dominant-strategy regression in `src/shared/balance-simulation.test.ts`: Greedy profiles must still pay Greed life costs, remain fall-free, and keep their long-run reward premium at or below 1.6x the cautious profile. Focused balance/resource/gameplay checks, shared typecheck, the 48-floor long-run gate, and the 1000-floor endless schedule smoke are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, or economy constants were changed.
- **V4 cycle 5 combat stabilization:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared/renderer combat checks, shared/full typecheck, full Vitest, balance-note drift, alternate renderer build, the 1000-floor endless schedule smoke, conflict-marker scan, and diff whitespace checks are green on May 27, 2026; no enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop, scoring, hazard-cadence, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser smoke exceeded an 8-minute local timeout without useful runner output, so remaining work is quiet-server browser/manual proof for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, fatal-contact game-over transition, guard-token spend reads, boss HP chip updates, and death/retry flow on desktop/mobile.
- **V3 cycle 1 memory mechanic depth wrap-up:** memory recall feedback is covered as a read-only presentation layer over existing run state: focus tier, forgotten markers, remembered clues, route choice readiness, patrol pressure, symbol-map counters, active memory taxes, and owned recall assists. No score, life, charge, or route outcome constants were changed in this stabilization lane.
- **V3 cycle 1 progression/meta stabilization:** profile progression now exposes capped honor-mark sources, profile difficulty tiers, milestone copy, deferred-upgrade handling, and per-run meta delta rows. Challenge gates can reference the active profile tier without making online services or paid skips part of progression.
- **V3 cycle 1 first-run/onboarding wrap-up:** playable onboarding remains a presentation/targeting layer over the real first-floor board. The harness regression now asserts two actual target tile ids plus the current split between title copy and action prompt copy; no score, life, route, hazard, or economy constants were changed.
- **V3 cycle 2 first-run/onboarding wrap-up:** first-run guidance now covers the miss-recovery beat, final-pair route-choice setup, ordered scenario completion, and Main Menu help-center room-choice copy. No score, life, route payout, hazard cadence, reward, shop, relic, or economy constants were changed.
- **V3 cycle 3 first-run/onboarding wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer checks, save persistence, shared typecheck, full typecheck, diff whitespace, and balance-note drift are green on May 27, 2026; browser playable-path/navigation smoke timed out locally and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, or economy constants were changed.
- **V3 cycle 4 first-run/onboarding wrap-up:** final one-hour lane stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer/app/store checks, shared typecheck, full typecheck, balance-note drift, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser smoke exceeded a five-minute outer timeout under concurrent local load and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V3 cycle 5 first-run/onboarding wrap-up:** final one-hour lane stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer/app/store/save checks, shared typecheck, full typecheck, balance-note drift, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser slice exceeded a five-minute outer timeout and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V4 cycle 1 first-run/onboarding wrap-up:** stabilization kept the existing first screen, first room, first choice, and first reward/failure guidance intact while removing a full-suite startup preload test isolation failure. Focused first-run checks, shared typecheck, full typecheck, full Vitest, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser slice still exceeded a 10-minute outer timeout under heavy local Node/Playwright process load. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V3 cycle 2 progression/meta stabilization:** no new economy or pressure constants were changed. The wrap-up verified that local-only honor marks, profile tier copy, reward-ready versus reward-owned states, post-run meta deltas, challenge progression, save normalization, collection projections, core run results, and balance profile diagnostics still agree after concurrent V3 edits.
- **V3 cycle 3 progression/meta wrap-up:** no new progression economy constants were changed. Focused verification is green for profile honor marks, tier/milestone copy, deferred upgrade handling, challenge gates, save normalization, collection projection, and game-over next-run delta surfacing.
- **V3 cycle 4 progression/meta wrap-up:** no new progression, reward, honor-mark, challenge-gate, save-schema, route, or economy constants were changed. Focused shared and renderer-facing progression verification is green on May 26, 2026; remaining work is broader typecheck/build/e2e after the active renderer/audio/content edits settle.
- **V3 cycle 5 progression/meta wrap-up:** no new progression, reward, honor-mark, challenge-gate, save-schema, route, shop, relic, or economy constants were changed. Focused shared and renderer-facing progression verification remains green on May 26, 2026; remaining work is full repo typecheck/test/build/e2e once concurrent renderer/audio/content edits settle.
- **V3 cycle 6 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared progression, renderer-facing profile/collection/game-over surfaces, shared typecheck, and full typecheck are green on May 26, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, or balance constants were changed.
- **V3 cycle 7 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, and full typecheck checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, or balance constants were changed.
- **V3 cycle 8 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed.
- **V3 cycle 9 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work stays in browser/manual profile-to-post-run smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 10 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work stays in live browser/manual profile-to-post-run smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 11 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 12 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 13 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 14 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks remain green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V4 cycle 2 progression/meta wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge gates, collection, game-over, profile renderer, shared typecheck, full typecheck, full Vitest, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is live browser/manual post-run-to-profile smoke plus the product decision on whether the seven-daily relic-shrine upgrade remains save-normalized or moves to explicit claim UI.
- **V4 cycle 6 progression/meta wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge gates, collection, game-over, profile/main-menu renderer surfaces, shared/full typecheck, full Vitest, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, score/life, or difficulty constants were changed. Remaining work is live browser/manual post-run-to-profile smoke plus the explicit-claim versus auto-activation product decision for the seven-daily relic-shrine upgrade.
- **V3 cycle 1 combat stabilization:** fatal direct contact with a moving enemy now reveals the patrol state but does not advance enemy movement after the run has already reached `gameOver`. This keeps terminal combat boards deterministic and avoids post-death patrol drift in retry/results surfaces.
- **V3 cycle 3 combat stabilization:** added renderer coverage for fatal patrol contact so the game-over combat read keeps the occupied card hidden, keeps patrol movement frozen, and surfaces the revealed-patrol status plus terminal next-step copy. No combat, life, guard, route, or reward constants were retuned.
- **V3 cycle 4 combat stabilization:** focused combat verification is green on May 26, 2026. No enemy damage, guard-token, boss, route, reward, hazard-cadence, or scoring constants were changed; remaining combat work is browser/e2e proof of the fatal moving-patrol game-over path and manual boss-floor playtest notes.
- **V3 cycle 5 combat stabilization:** final wrap-up stayed verification- and documentation-only on May 26, 2026. Focused shared combat, boss, balance, drift, renderer game-screen, and store checks remain green; no combat, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, or scoring constants were changed.
- **V3 cycle 6 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared combat, boss identity, softlock, exploit, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, or scoring constants were changed.
- **V3 cycle 7 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck plus focused combat, boss identity, softlock, exploit, balance drift, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 8 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared combat, boss identity, softlock, exploit, balance, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 9 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck plus focused combat, boss identity, softlock, exploit, balance, renderer store, GameScreen, and TileBoard checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 10 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck, full typecheck, diff whitespace, and focused combat, boss identity, softlock, exploit, balance drift, renderer store, GameScreen, and TileBoard checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 11 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, or patrol movement constants were changed. Remaining work is browser/e2e proof for the fatal moving-patrol game-over path plus manual boss-floor playtest notes on a quiet local server.
- **V3 cycle 12 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser smoke exceeded the five-minute local timeout, so browser proof for fatal moving-patrol game-over and manual boss-floor playtest notes remain pending on a quiet local server.
- **V3 cycle 8 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build are green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 9 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build remain green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Existing Vite chunk-size warnings remain for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB); remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 10 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build remain green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Existing Vite chunk-size warnings remain for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.15 kB); remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 1 closeout:** balance/difficulty stabilization is test-green for the current shared simulation lane (`balance-simulation`, core `game`, bonus reward, and boss encounter tests). Remaining balance work should stay data-driven: expand the seed set beyond the current smoke seeds, capture real playtest floor-6/floor-12 outcomes, and tune only one economy or pressure constant per pass.
- **V3 cycle 2 final wrap-up:** no balance constants were retuned in the deadline lane. The existing shared balance and docs drift guards are green for `balance-simulation` plus `balance-notes-drift` on May 26, 2026; keep remaining changes focused on verification, wider seed coverage, and manual playtest notes rather than last-minute economy math.
- **V3 cycle 2 core gameplay loop closeout:** no new gameplay, economy, score, life, route, shop, or assist constants were changed in the final wrap-up lane. Current `main` is typecheck-clean and unit-test-clean after the concurrent V3 edits: shared typecheck, full renderer/shared typecheck, focused core gameplay checks, balance-note drift, and the full Vitest suite all passed on May 26, 2026.
- **V3 cycle 3 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/softlock/exploit checks, balance-note drift, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 26, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, or reward constants were changed.
- **V3 cycle 4 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, or reward constants were changed.
- **V3 cycle 5 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, or map-generation constants were changed.
- **V3 cycle 6 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed.
- **V3 cycle 7 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work stays in browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 8 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work stays in browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 9 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work is still browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 10 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work is still browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 2 memory mechanic depth wrap-up:** the recall-focus loop and feedback ledger are stable under focused shared checks. No additional score, life, route, shop, or assist constants were retuned in the final hour; remaining work is renderer surfacing, route-choice e2e coverage, and playtest calibration of diagnostic burden labels.
- **V3 cycle 3 memory mechanic depth wrap-up:** focused memory-depth verification is green on May 26, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, shop, assist, or reward constants were retuned; the lane remains safe stabilization plus documentation while concurrent renderer/audio/content edits settle.
- **V3 cycle 4 memory mechanic depth wrap-up:** focused shared verification is still green on May 26, 2026, and the route-choice renderer unit path now covers the memory read panel plus Safe / Greed / Mystery recall copy. No recall scoring, focus cap, burden threshold, life, route, shop, assist, or reward constants were retuned in this final hour.
- **V3 cycle 5 memory mechanic depth wrap-up:** focused shared and renderer verification remains green on May 26, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned; final work stayed on verification and remaining-work documentation while preserving unrelated concurrent edits.
- **V3 cycle 6 memory mechanic depth wrap-up:** focused memory-depth verification remains green on May 27, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned; this pass stayed on safe stabilization, route-choice/read-panel verification, and remaining-work documentation.
- **V3 cycle 7 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared and renderer memory-depth checks remain green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 8 memory mechanic depth wrap-up:** copy-only stabilization now distinguishes enemy/patrol-only strained recall from forgotten-marker strain, with focused shared verification green on May 27, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 9 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, focused recall-feedback tests, and the renderer route-choice memory-read assertion remain green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 10 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, route-choice memory read, shared typecheck, and diff whitespace checks are green on May 27, 2026 with only existing CRLF normalization warnings; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 11 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, Choose Path first-run route setup, renderer GameScreen route-choice memory read, store integration, and shared typecheck are green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 12 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, renderer route-choice memory read, balance-note drift, shared typecheck, and diff whitespace checks are green on May 27, 2026 with only existing LF-to-CRLF normalization warnings; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 7 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, and TypeScript checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service hooks, or economy constants were changed.
- **V3 cycle 11 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, full TypeScript, balance-note drift, and diff hygiene checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, or economy constants were changed.
- **V3 cycle 12 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, full TypeScript, balance-note drift, and diff hygiene checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, or economy constants were changed.
- **V3 cycle 3 dungeon navigation / room-flow wrap-up:** focused navigation and side-room checks are green on May 26, 2026. No route payouts, side-room rewards, life costs, shop costs, or map cadence constants were retuned in this final lane; current stabilization stays scoped to route graph repair, first-room launch flow, disabled Greed copy, side-room feedback clarity, and documentation.
- **V3 cycle 4 dungeon navigation / room-flow wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, store, side-room, choose-path, and app navigation checks remain green on May 26, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, or map-generation constants were changed.
- **V3 cycle 5 dungeon navigation / room-flow wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, store, side-room, choose-path, app navigation, and shared typecheck checks remain green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, or economy math were changed.
- **V3 cycle 7 dungeon navigation / room-flow wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, route foundation, store, side-room, choose-path, app navigation, and shared typecheck checks remain green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, or economy math were changed.
- **V3 cycle 10 dungeon navigation / room-flow wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, route rules, core game, renderer navigation, side-room, choose-path, store, shared typecheck, full typecheck, and diff hygiene checks are green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, or economy math were changed.
- **V4 cycle 1 dungeon navigation / room-flow wrap-up:** stabilized the dirty `main` worktree's in-progress route graph and side-room work. Focused route-map, route foundation, core game, store, Choose Path, and Side Room checks are green on May 27, 2026, along with shared/full TypeScript and diff hygiene; browser navigation/playable-path smoke still times out locally before useful runner output. No route payouts, side-room rewards, life costs, shop costs, boss cadence, score rules, reward math, or economy math were changed in this lane.
- **V3 cycle 2 narrative / atmosphere / content wrap-up:** no new content systems or balance math were added in the deadline lane. The authored event room, memory recall feedback, copy-tone, and long-run feedback contracts are green on May 26, 2026; remaining work should be integration polish, visual/audio pairing, and localization readiness rather than late copy expansion.
- **V3 cycle 3 narrative / atmosphere / content wrap-up:** no new content systems, reward math, route consequences, or memory thresholds were changed in the final stabilization lane. Focused narrative/content verification is green on May 26, 2026; remaining work stays in renderer surfacing, audio/visual pairing, and localization cleanup.
- **V3 cycle 4 narrative / atmosphere / content wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. The authored event atmosphere catalog, memory recall feedback beats, copy-tone audit, and long-run feedback rows are green on May 26, 2026; no content systems, reward math, route consequences, recall thresholds, or relic-offer behavior were changed.
- **V3 cycle 5 narrative / atmosphere / content wrap-up:** final stabilization kept `main` on the existing dirty worktree and made no runtime retune. Focused narrative/content verification is green on May 26, 2026 across memory recall feedback, event atmosphere rows, copy-tone rules, long-run feedback, and Choose Path first-run copy; remaining work stays in browser smoke, final audio/visual pairing, and localization extraction.
- **V3 cycle 6 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification remains green on May 27, 2026 across memory recall feedback, authored event atmosphere rows, copy-tone rules, long-run feedback, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, or economy constants were changed.
- **V3 cycle 7 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification remains green on May 27, 2026 across memory recall feedback, authored event atmosphere rows, copy-tone rules, long-run feedback, dungeon card labels, relic copy/eligibility, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, or economy constants were changed.
- **V3 cycle 8 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, balance-note drift, and whitespace checks remain green on May 27, 2026 across copy-tone rules, dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run feedback, authored event atmosphere rows, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 9 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 10 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 11 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, localization architecture, or economy constants were changed.
- **V3 cycle 12 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across recall feedback, event atmosphere, copy-tone, long-run feedback, first-run help, encyclopedia glossary, dungeon card labels, relic copy, Choose Path first-run copy, and Game Over copy; no content systems, route consequences, reward math, recall thresholds, relic-offer behavior, card taxonomy semantics, localization architecture, or economy constants were changed.
- **V3 cycle 1 performance / polish wrap-up:** startup-critical preload now keeps heavyweight card illustrations and mode posters on idle/fallback warmup, image warmup dedupes pending decodes with bounded concurrency, UI SFX preload uses shared buffer loading, viewport resize commits are animation-frame throttled, and platform tilt avoids redundant CSS variable writes.
- **V3 cycle 2 performance / polish wrap-up:** no additional performance code changes were needed after focused verification. The current preload, image warmup, audio buffer preload, viewport resize, and platform tilt guards are test-green with renderer TypeScript on May 26, 2026; remaining work is browser trace capture and lower-end device smoke rather than late behavior changes.
- **V3 cycle 3 performance / polish wrap-up:** focused preload, image warmup, audio buffer, viewport resize, and platform tilt checks remain green on May 26, 2026. No additional runtime behavior changes were made in this deadline lane; remaining work stays in measured browser trace capture, lower-end device smoke, and bundle profiling.
- **V3 cycle 4 performance / polish wrap-up:** final one-hour pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, or economy behavior was retuned.
- **V3 cycle 5 performance / polish wrap-up:** final one-hour pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance constants were retuned.
- **V3 cycle 6 performance / polish wrap-up:** final pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance behavior was retuned.
- **V3 cycle 7 performance / polish wrap-up:** final pass made one test-only stabilization so startup background warmup timers do not leak raster requests between preload tests. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks are green on May 27, 2026. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance behavior was retuned.
- **V3 cycle 3 balance/difficulty wrap-up:** focused shared balance verification is green on May 26, 2026, so no deadline-lane economy, life, route, boss, hazard, or reward constants were retuned. Current stabilization should remain documentation and verification only unless a reproducible seed/profile failure appears.
- **V3 cycle 4 balance/difficulty wrap-up:** focused shared, long-run, and endless schedule checks are green on May 26, 2026. No economy, life, route, boss, hazard, reward, or memory-pressure constants were changed in this final hour; remaining work stays in seed expansion and manual playtest calibration.
- **V3 cycle 2 bug and edge-case hunt wrap-up:** current `main` stayed code-stable under broad verification on May 26, 2026. No gameplay, economy, reward, route, audio, rendering, or balance constants were changed; full TypeScript, full Vitest, and lint all pass, with only the pre-existing `GameScreen.tsx` Fast Refresh warnings still open.
- **V3 cycle 5 balance/difficulty wrap-up:** focused shared balance, long-run profile, and endless schedule checks remain green on May 26, 2026. No economy, life, route, boss, hazard, reward, assist, or memory-pressure constants were retuned; final work stayed on verification and remaining-work documentation.
- **V3 cycle 6 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run, endless schedule, and balance-doc drift checks remain green on May 26, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, or memory-pressure constants were retuned.
- **V3 cycle 7 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, endless schedule, and balance-doc drift checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, or shop constants were retuned.
- **V3 cycle 8 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, endless schedule, and balance-doc drift checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, shop, or relic constants were retuned.
- **V3 cycle 9 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, core game, exploit, economy-ledger, endless schedule, and shared TypeScript checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, shop, relic, or difficulty constants were retuned.

- **V3 cycle 4 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, bonus reward, prep, meta reward signal, balance simulation, and renderer inventory checks are green on May 26, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, or inventory UI behavior were retuned.
- **V3 cycle 5 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, bonus reward, prep, meta reward signal, balance simulation, renderer inventory checks, shared typecheck, and full typecheck are green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, or inventory UI behavior were retuned.

- **Memorize:** the window is a per-tile budget × tile count (`MEMORIZE_PER_TILE_BASE_MS` 325ms at floor 1, −12ms per floor, floor 110ms; total clamped to 600–6000ms). Floor 1 (4 tiles) still gets 1300ms; a 42-tile floor 20 gets ~4.6s instead of the old 850ms, because the old total-only curve ran opposite to board growth and collapsed to 20ms per tile. `getLegacyMemorizeDuration` keeps the old shape for simulation comparisons. Mutator `short_memorize` stacks with relic memorize bonus — floor 1 should never feel instant-fail.  
- **Lives:** `INITIAL_LIVES` / `MAX_LIVES` — `score_parasite` drain must not kill from full health in a single floor transition without telegraph (floors advanced counter).  
- **Powers:** `INITIAL_SHUFFLE_CHARGES`; destroy charges are uncapped run-local pickups. Relics and shops that add charges should not trivialize **Scholar** contract runs; contract still hard-disables shuffle/destroy where set.  
- **Gauntlet:** Menu presets **5 / 10 / 15** minutes; default factory still **10m** when unspecified. Each cleared floor extends the deadline by **+30s**, rewarding pace without removing the timer fail state.
- **Routes:** Floor clears expose **Safe / Greed / Mystery** choices. Shared rules can now apply outcomes: Safe recovers life or guard, Greed pays gold/score for life risk, Mystery rolls deterministic local gold/shard/Favor rewards.
- **Wild joker identity:** `BoardState.tiles` and `WILD_PAIR_KEY` are authoritative; `getWildTileIdFromBoard` derives the tile id when an inspection surface needs it. Matching remains `pairKey`-driven.

## V3 cycle 1 progression/meta wrap-up

- Stabilized scope: `src/shared/meta-progression.ts`, `src/shared/meta-progression-delta.ts`, `src/shared/challenge-progression.ts`, `src/shared/profile-summary.ts`, honor unlocks, save-data migration, and collection gallery projections now agree on local-only profile level, honor marks, owned cosmetics, deferred upgrades, and reward-ready versus reward-owned states.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Remaining work: wire the meta delta result into the post-run/profile UI if it is not already surfaced by concurrent UI work; add a focused renderer assertion for the tier/milestone copy once that surface lands; run `yarn typecheck:shared` and the full shared progression cluster before release freeze.
- Product/balance follow-up: keep `upgrade_scholar_prep_slot` deferred until its feature flag and balance pass exist. Do not let fully progressed deferred rows become the short-term next reward, and do not count unclaimed ready rewards as owned.

## V3 cycle 2 progression/meta wrap-up

- Stabilized scope: no code changes were needed in this final lane after inspecting the dirty worktree. Existing progression/meta changes were left intact, and unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/game-over-next-run.test.ts src/shared/run-history.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts` passed on May 26, 2026 (325 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Remaining work: surface `buildMetaProgressionRunDelta` in the renderer post-run/profile flow if concurrent UI work has not already done so; add renderer assertions for profile tier, milestone, next-goal, and claim feedback copy; keep the deferred `upgrade_scholar_prep_slot` excluded from short-term next-reward selection until its feature flag and balance pass exist.

## V3 cycle 3 progression/meta wrap-up

- Stabilized scope: no balance constants, reward costs, honor-mark caps, route outcomes, or economy math were changed in this final lane. The current main worktree already carries the progression/meta implementation, and unrelated concurrent renderer/audio/content edits were left intact.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Verified integration point: `src/shared/game-over-next-run.ts` consumes `buildMetaProgressionRunDelta`, and `src/renderer/components/GameOverScreen.tsx` passes `runStartSaveData` into the next-run row builder, so post-run delta copy has a renderer path.
- Remaining work: add focused renderer assertions for game-over delta copy, profile tier/milestone copy, collection next-milestone copy, and claim feedback copy; run the broader `yarn typecheck`, game-over next-run tests, and renderer screen tests after concurrent edits settle.

## V3 cycle 4 progression/meta wrap-up

- Stabilized scope: documentation and verification only. No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, or shop/relic reward math were changed in this final lane.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts` passed on May 26, 2026 (57 tests).
- Verification run: `yarn vitest run src/renderer/components/GameOverScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (11 tests).
- Current integration read: Collection and Profile already expose tier/milestone/progression motivation copy; Game Over has a post-run delta path through `buildMetaProgressionRunDelta`; Choose Path challenge gates can consume profile tier state without online services or paid skips.
- Remaining work: run full `yarn typecheck`, `yarn test`, `yarn build`, and the navigation/playable-path e2e lane after concurrent renderer/audio/content edits settle. Add a browser smoke that completes a run, lands on Game Over, and verifies the same meta-delta copy with the full UI shell.

## V3 cycle 5 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, or reward math were changed in this final lane.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts` passed on May 26, 2026 (57 tests).
- Verification run: `yarn vitest run src/renderer/components/GameOverScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (11 tests).
- Remaining work: run full `yarn typecheck`, `yarn test`, `yarn build`, and the navigation/playable-path e2e lane after concurrent edits settle. Add a live browser smoke that completes a run into Game Over and verifies meta-delta copy, profile tier/milestone copy, collection next-goal copy, and challenge gate copy through the full UI shell.

## V3 cycle 7 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, and local-only wording across Profile, Collection, Choose Your Path, and Game Over. Keep `upgrade_scholar_prep_slot` deferred until its feature flag and balance pass ship, and keep unclaimed ready rewards distinct from owned rewards.

## V3 cycle 8 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 10 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (52 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 11 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 13 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (65 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 14 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (65 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 1 first-run / onboarding wrap-up

- Stabilized scope: first-run help center rows, menu/Choose Path onboarding entry, playable onboarding prompt derivation, first-floor safe target selection, and `GameScreen` prompt rendering. This pass only corrected the renderer harness regression for the current title/action-prompt copy contract.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/MainMenu.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (46 tests). `yarn typecheck` also passed on May 26, 2026.
- E2E note: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` was attempted on May 26, 2026, but exceeded a 10-minute local command timeout before returning runner output. Treat this as not verified, not as a product failure.
- Remaining work: rerun the renderer navigation/playable-path E2E lane on a quiet machine before release freeze; add a persisted-dismissal/reload E2E assertion for onboarding completion; manually smoke a fresh profile from menu help through first clear and first route choice on desktop and short mobile viewports.

## V3 cycle 2 first-run / onboarding wrap-up

- Stabilized scope: safe deadline-lane hardening only. Existing first-run work now covers Main Menu help-center room-choice copy, Choose Path first-run entry, action-gated playable prompts, first-miss recovery copy, final-pair route-choice setup, ordered scenario completion, and app/store onboarding dismissal persistence.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/MainMenu.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (50 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn vitest run src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 26, 2026 (89 tests).
- Remaining work: run `yarn test:e2e:playable-path:full` or the smaller `e2e/navigation-flow.spec.ts` plus `e2e/playable-path-navigation.spec.ts` browser slice after concurrent renderer/audio edits settle; add a persisted-dismissal/reload e2e assertion; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## V3 cycle 3 first-run / onboarding wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing first-run help-center, Choose Path entry, playable prompts, route-choice setup, and onboarding dismissal persistence changes were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 27, 2026 (137 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- E2E note: `yarn test:e2e:playable-path:audit` and a navigation-flow browser smoke were attempted on May 27, 2026, but both exceeded a five-minute local command timeout while other Playwright lanes were active. Treat this as not verified, not as a product failure.
- Remaining work: rerun `yarn test:e2e:playable-path:full` or the smaller navigation/playable-path browser slice on a quiet machine; add a persisted-dismissal/reload e2e assertion; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## V3 cycle 5 first-run / onboarding wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing first-run help-center, split help/onboarding dismissal, Choose Path entry, playable prompts, route-choice setup, and onboarding persistence changes were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, onboarding persistence behavior, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 27, 2026 (137 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- E2E note: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` was attempted on May 27, 2026, but exceeded a five-minute outer command timeout before useful runner output. Treat this as not verified, not as a product failure.
- Remaining work: rerun `yarn test:e2e:playable-path:full` or the smaller `e2e/navigation-flow.spec.ts` plus `e2e/playable-path-navigation.spec.ts` browser slice on a quiet server; add a persisted-dismissal/reload e2e assertion for both help-center and playable onboarding dismissal; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## Process

After meaningful mutator/relic changes: run three scripted seeds (arcade, daily, scholar) to floor 6 and record score, lives, powers used. Adjust one constant at a time.

## V3 cycle 3 balance/difficulty wrap-up

- Stabilized scope: no balance constants were changed in the final wrap-up lane. The current difficulty curve keeps the existing floor-1 hazard grace, Safe / Greed / Mystery route diagnostics, wallet-carry gates, low-life exposure gates, recovery-debt gates, and per-seed variance checks intact.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts` passed on May 26, 2026 (309 tests).
- Remaining work: expand the profile seed bucket beyond the current smoke set, capture manual floor-6 and floor-12 runs for cautious / average / greedy / high-skill play, and only retune one pressure or economy constant at a time after a failing seed or playtest pattern is recorded.
- Release risk: broad renderer, e2e, and full `yarn test` coverage are still outside this balance-only wrap-up while concurrent UI/audio/content edits are active.

## V3 cycle 4 balance/difficulty wrap-up

- Stabilized scope: no balance constants or gameplay reward rules were changed in this deadline lane. Current main already has the floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, and seed-variance gates needed for the balance curve.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts` passed on May 26, 2026 (309 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 26, 2026. Key bounds remained within range: minimum profile lives remaining 1, run falls 0, max at-risk streak 3, worst-seed clear share 1, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: widen the profile seed set before any release retune; add a manual floor-6 and floor-12 playtest ledger for cautious, average, greedy, and high-skill play; keep future changes limited to one pressure or economy constant per measured failure.
- Release risk: broad renderer, e2e, build, and full `yarn test` coverage remain outside this balance-only stabilization lane while unrelated concurrent edits are active.

## V3 cycle 5 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, and endless schedule cadence were preserved without retuning economy, life, route, boss, hazard, reward, assist, or memory-pressure constants.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts src/shared/long-run-depth.test.ts src/shared/sim-endless-output.test.ts` passed on May 26, 2026 (316 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 26, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, worst-seed clear share 1, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: expand deterministic profile seeds and add manual floor-6/floor-12 playtest rows before any new retune; capture cautious, average, greedy, and high-skill outcomes with score, lives, route choice, shop-gold carry, assist use, and the highest perceived pressure point.
- Release risk: full renderer typecheck, full `yarn test`, build, and browser/e2e coverage remain outside this balance-only wrap-up while unrelated renderer/audio/content edits are still active in the dirty worktree.

## V3 cycle 6 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 26, 2026 (6 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Remaining work: promote the wider release-freeze seed set from notes into a checked-in balance artifact; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; then compare worst-seed clear share, low-life floor share, route mix, and ending wallet before changing any shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 7 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, and peak wallet before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 8 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 9 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, endless schedule cadence, and current Cycle 9 low-life exposure diagnostics were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/game.test.ts src/shared/exploit-surface.test.ts src/shared/sim-endless-output.test.ts src/shared/economy-ledger.test.ts` passed on May 27, 2026 (306 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 4 combat system wrap-up

- Stabilized scope: verification and documentation only. Existing fatal patrol-contact handling, guard-token-first contact damage, last-pair hazard softlock relief, boss patrol lifecycle reads, and renderer store game-over routing were preserved without retuning combat constants.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/softlock-fairness.test.ts src/shared/boss-encounters.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (412 tests).
- Remaining work: add a browser/e2e smoke that reaches a real moving-patrol game-over through input and verifies the terminal board read with the full `TileBoard` implementation; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, and boss exit-block copy before any pressure retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 5 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, boss encounter identity/read models, deterministic balance guardrails, and renderer store game-over routing were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 26, 2026 (378 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 6 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, and renderer game-over routing were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (405 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 8 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, and GameScreen combat reads were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (412 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, occupied-card keyboard/controller selection, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: shared typecheck, full renderer typecheck, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 9 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, GameScreen combat reads, and TileBoard occupied-patrol accessibility reads were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/TileBoard.test.tsx` passed on May 27, 2026 (440 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, occupied-card keyboard/controller selection, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full renderer typecheck, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 10 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, GameScreen combat reads, and TileBoard occupied-patrol accessibility reads were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/TileBoard.test.tsx` passed on May 27, 2026 (443 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser/e2e proof for fatal moving-patrol game-over, occupied-card keyboard/controller selection, and boss-floor pressure readability; capture manual floor-6/floor-12 combat playtest rows before changing enemy damage, guard-token, patrol, boss, or reward constants.
- Release risk: broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## Remaining balance work

- Expand deterministic balance profiles to a wider seed bucket before changing shipped pressure constants; current smoke coverage is good for regression detection, not final win-rate calibration.
- Add a release-freeze seed set that includes at least eight seeds across Classic, Daily, Scholar, Endless, and Gauntlet starts; record worst-seed clear share, low-life floor share, and ending wallet before any V3 balance retune.
- Add a small manual playtest ledger for floor 6 and floor 12 runs covering cautious, average, greedy, and high-skill behavior; use it to validate whether low-life exposure feels tense or punitive.
- Convert the manual ledger into a tiny checked-in fixture once the team agrees on target bands for floor-6 lives, floor-12 boss clears, route choice mix, and shop-gold carry.
- Capture the V3 cycle 2 smoke output as a release artifact if this branch proceeds to freeze: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (10 tests), `yarn typecheck:shared` passed, `yarn typecheck` passed, `yarn test` passed (179 files, 1301 tests), and `yarn build` passed. Browser e2e checks are still pending while concurrent edits settle.
- Revisit Safe / Greed / Mystery route payout after manual runs. The simulation now guards route dominance, but player-facing route appeal still needs qualitative confirmation.
- Keep boss pressure changes paired with nearby recovery checks. Recovery-debt and seed-variance diagnostics should be updated whenever boss cadence, moving enemy damage, guard rewards, shop healing cost, or rest services change.
- Combat follow-up: broaden from the now-covered fatal patrol renderer assertion into a browser/e2e smoke that reaches a real moving-patrol game-over from input and verifies the same stable terminal read with the full `TileBoard` implementation.

## V3 cycle 2 core gameplay loop closeout

- Stabilized scope: no additional code changes were required after inspection. Existing concurrent changes around game state, route flow, memory recall feedback, balance diagnostics, UI/audio, and docs were preserved.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/shared/memory-recall-feedback.test.ts` passed on May 26, 2026 (350 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/game-over-next-run.test.ts src/shared/long-run-feedback.test.ts src/shared/run-history.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn test` passed on May 26, 2026 (179 test files, 1301 tests).
- Verification run: `yarn build` passed on May 26, 2026; Vite reported the existing large-chunk warning for bundled renderer chunks, but the renderer and Electron builds completed successfully.
- Remaining work: run the highest-value browser/e2e lane (`yarn test:e2e:renderer-qa` or at least navigation/playable-path/gameplay-readability) after concurrent UI/audio edits settle. Keep any follow-up tuning data-driven from wider seed buckets and floor-6/floor-12 playtest notes.

## V3 cycle 3 core gameplay loop closeout

- Stabilized scope: documentation and verification only. The current dirty `main` worktree already carries the core-loop stabilization work, and unrelated concurrent renderer/audio/content/progression edits were preserved.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (360 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026 and produced the expected long-run floor tag / mutator / dungeon objective schedule summary.
- Verification run: `yarn test` passed on May 26, 2026 (179 test files, 1302 tests).
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially route selection, playable path navigation, gameplay readability, side-room reward claim/skip, fatal patrol game-over, boss-floor pressure, and mobile HUD density. Keep any future retune tied to expanded seed buckets and manual floor-6/floor-12 playtest notes.

## V3 cycle 4 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, route outcomes, balance diagnostics, inventory rewards, boss pressure, and run-map flow was preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/exploit-surface.test.ts src/shared/route-foundation.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts` passed on May 27, 2026 (352 tests).
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (4 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density. Keep future gameplay-loop retunes tied to expanded seed buckets and floor-6/floor-12 manual playtest notes.

## V3 cycle 5 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, recall feedback, post-run recap, balance diagnostics, inventory rewards, boss pressure, run-map flow, softlock guards, and exploit guards was preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (383 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density. Keep future gameplay-loop retunes tied to expanded seed buckets, checked-in seed artifacts, and floor-6/floor-12 manual playtest notes.

## V3 cycle 6 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, recall feedback, post-run recap, balance diagnostics, inventory rewards, boss pressure, run-map flow, softlock guards, exploit guards, and route/economy drift checks was preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (383 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Verification run: `yarn test` passed on May 27, 2026 (179 test files, 1302 tests).
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, mobile HUD density, and gameplay-readability smoke. Keep future gameplay-loop retunes tied to expanded seed buckets, checked-in seed artifacts, and floor-6/floor-12 manual playtest notes.

## Remaining memory-depth work

- Current V3 cycle 2 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (298 tests), and `yarn typecheck:shared` passed. Broader renderer/e2e/build verification is still pending while concurrent edits settle.
- Current V3 cycle 3 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (298 tests), and `yarn typecheck:shared` passed. No code changes were needed in this lane after inspection.
- Current V3 cycle 4 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (291 tests). The renderer route-choice unit test already asserts the memory read panel pressure, focus, bonus, learned clue, recall lapse, and Safe / Greed / Mystery readiness copy.
- Current V3 cycle 7 verification: `yarn typecheck:shared` passed on May 27, 2026. `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (329 tests).
- Keep the current recall scoring constants (`RECALL_FOCUS_MATCH_SCORE` 8, `RECALL_CLUE_MATCH_SCORE` 12, focus cap 3) unchanged until real playtest data shows the bonus is either invisible or dominant.
- Keep `getMemoryRecallFeedback` read-only in renderer surfaces; any further HUD / room-result expansion should reuse the same helper instead of adding scoring side effects.
- Add a small e2e smoke that reaches a route-choice screen with remembered clues and verifies the displayed safe/greed/mystery readiness copy.
- Playtest whether `burden.score` thresholds (`loaded` at 3, `taxed` at 5, `breaking` at 7) need adjustment after the UI lands; current thresholds are diagnostic labels only.
- Expand assist copy if future relics or powers create new recall-safe tools; update `memory-recall-feedback.test.ts` alongside any new mutator/relic memory tax.
- Release risk: memory feedback has shared and renderer unit coverage, but is still not proven by browser e2e or manual route-choice playtest. Do not change diagnostic wording or thresholds until the route-choice e2e smoke and real playtest notes exist.

## V3 cycle 1 dungeon navigation / room-flow wrap-up

- Stabilized scope: route graph repair now prefers a single current node, dedupes duplicate node ids, closes stale revealed backtracks/future rooms, preserves skipped sibling branches after selection, and rebuilds missing next-room choices from deterministic local rules.
- Room-flow guardrails: stale side-room actions no-op when a side-room has already transitioned, invalid event choices leave the room open, no-run side-room actions recover to menu, and relic-pick feedback is tested only from a valid level-complete relic-offer state.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (84 tests).
- Remaining work: run the renderer navigation e2e lane before release freeze (`yarn test:e2e:renderer-qa` or at least `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`), then manually smoke a floor-1 clear into Safe / Greed / Mystery selection and a floor-5-to-boss transition to confirm the room copy reads correctly in the live shell.

## V3 cycle 2 dungeon navigation / room-flow wrap-up

- Stabilized scope: no additional balance constants, route payouts, or economy math were changed in this deadline pass. Current main already contains the route graph repair and side-room presentation guardrails needed for the final navigation/room-flow lane.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (84 tests); `yarn vitest run src/renderer/App.test.tsx` passed on May 26, 2026 (23 tests); `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: the branch still needs the heavier browser navigation lane before release freeze: `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`. Manual QA should still cover a fresh Classic first room into route choice, last-life Greed disabled copy, side-room claim/skip transitions, and floor-5-to-boss approach copy in the live shell.

## V3 cycle 3 dungeon navigation / room-flow wrap-up

- Stabilized scope: no code retune was needed after inspecting the dirty `main` worktree. Existing route-map repair, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, and side-room reward feedback changes were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 26, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, visual mobile captures, and the Playwright navigation lane remain outside this final focused verification while concurrent edits are active.

## V3 cycle 4 dungeon navigation / room-flow wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route graph repair, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, side-room reward feedback, and run-surface reset behavior were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- No route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, objective values, score rules, or economy math were changed in this final hour.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 26, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `git diff --check` passed on May 26, 2026 with only existing CRLF normalization warnings.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, route-choice return from pause/menu surfaces, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, build, visual mobile captures, and the Playwright navigation lane remain outside this focused deadline verification while concurrent edits are active.

## V3 cycle 5 dungeon navigation / room-flow wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route graph repair, persistent route-choice recovery, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, side-room reward feedback, and run-surface reset behavior were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- No route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, objective values, score rules, reward math, or economy math were changed in this final hour.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, route-choice return from pause/menu surfaces, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, build, visual mobile captures, and the Playwright navigation lane remain outside this focused deadline verification while concurrent edits are active.

## V3 cycle 1 narrative / atmosphere / content wrap-up

- Stabilized scope: authored run-event outcome copy, atmosphere-family catalog rows, memory-recall pressure beats, relic draft labels, and game-over copy. No score, life, route, hazard, wallet, or relic-offer math was changed in this lane.
- Verification focus: keep `memory-recall-feedback`, `run-events`, `copy-tone`, and `long-run-feedback` as the fast narrative/content gate before broader shared or renderer checks.
- Remaining work: pair event atmosphere families with distinct visual/audio hooks, audit long-run UI line length once recall feedback is visible in renderer surfaces, and migrate late-copy strings into localization keys when the i18n pass resumes.

## V3 cycle 2 narrative / atmosphere / content final wrap-up

- Stabilized scope: no mechanics or constants changed. The final lane verified the existing authored room-event atmosphere catalog, memory recall feedback beats, copy-tone guardrails, and long-run feedback rows after concurrent edits landed in the working tree.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests). `yarn typecheck:shared` also passed on May 26, 2026.
- Remaining work: wire recall and event atmosphere rows into the final renderer surfaces, then run a manual floor-clear-to-route-choice smoke to check line length and repeated-copy cadence. Pair each event atmosphere family with final audio/visual cues before release freeze, and move late-stage strings into localization keys when the i18n pass resumes.
- Release caution: do not add new event-room rewards, route consequences, or memory-burden thresholds during final copy polish unless the balance simulation and the focused narrative/content gate are rerun together.

## V3 cycle 3 narrative / atmosphere / content final wrap-up

- Stabilized scope: no additional content systems, event outcomes, route consequences, scoring rules, life rules, reward values, memory-burden thresholds, or relic-offer math were changed in this final lane. Existing copy/catalog edits were preserved, and unrelated concurrent renderer/audio/progression changes were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: surface `getMemoryRecallFeedback` and event atmosphere families in final renderer screens, manually smoke floor-clear-to-route-choice copy for line length and repeated phrasing, pair each atmosphere family with final audio/visual cues, and migrate late-stage narrative strings into localization keys when the i18n pass resumes.
- Release caution: keep further narrative edits data- and screen-driven. Any new event reward, route consequence, recall threshold, or relic-offer behavior must rerun this focused narrative gate plus the relevant balance simulation checks.

## V3 cycle 4 narrative / atmosphere / content final wrap-up

- Stabilized scope: no code or content retune was needed after inspecting the current dirty `main` worktree. Existing authored event atmosphere profiles, memory recall feedback beats, copy-tone guardrails, and long-run feedback rows were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: wire `getMemoryRecallFeedback` and `RUN_EVENT_ATMOSPHERE_PROFILES` into the final renderer surfaces, then manually smoke floor-clear-to-route-choice copy for line length, repeated phrasing, and Safe / Greed / Mystery readiness clarity. Pair each atmosphere family with final audio/visual hooks before release freeze, and migrate late-stage narrative strings into localization keys when the i18n pass resumes.
- Release caution: keep any follow-up screen-driven. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, or reward values remain out of scope unless the focused narrative/content gate and relevant balance checks are rerun together.

## V3 cycle 5 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, relic/game-over copy edits, and fresh-profile Choose Path first-room copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (33 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: run a browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, line length, and repeated phrasing in the live shell. Pair each `RUN_EVENT_ATMOSPHERE_PROFILES` family with final audio/visual hooks before release freeze, then migrate late-stage narrative, recall, and event-result strings into localization keys.
- Release caution: keep follow-up copy screen-driven. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, or economy constants remain out of scope unless the focused narrative/content gate and relevant balance checks are rerun together.

## V3 cycle 6 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, relic/game-over copy edits, and first-run Choose Path copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (33 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, line length, repeated phrasing, and audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, or economy constants remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 7 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing expanded event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, dungeon card labels, relic/game-over copy edits, and first-run Choose Path copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (71 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, route-choice line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 8 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, and authored event atmosphere profiles were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (40 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card label clarity, route-choice line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 9 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (73 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card label clarity, relic-offer phrasing, game-over line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 10 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (73 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 11 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/first-run-help-center.test.ts src/shared/mechanics-encyclopedia.test.ts` passed on May 27, 2026 (44 tests).
- Verification run: `yarn vitest run src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, localization architecture, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 12 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, encyclopedia glossary copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/first-run-help-center.test.ts src/shared/mechanics-encyclopedia.test.ts --reporter=dot` passed on May 27, 2026 (44 tests).
- Verification run: `yarn vitest run src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (47 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, encyclopedia, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, localization architecture, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 5 memory mechanic depth final wrap-up

- Stabilized scope: no code retune was needed after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker, remembered-clue, symbol-map, route-readiness, memory-tax, and recall-assist feedback stayed intact; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/GameplayHudBar.test.tsx` passed on May 26, 2026 (60 tests).
- Remaining work: add a browser route-choice smoke that clears a floor and verifies the live memory read panel, Safe / Greed / Mystery readiness copy, and long-line behavior at mobile and desktop widths. Follow with manual playtest calibration for burden labels (`light`, `loaded`, `taxed`, `breaking`) before changing thresholds.
- Release caution: keep future memory-depth edits presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, or shop pressure should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 6 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker repair, remembered clues, symbol-map counts, patrol pressure rows, route-choice readiness, first-run route setup, memory-tax copy, and recall-assist feedback were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (51 tests).
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 7 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker repair, remembered clues, symbol-map counters, patrol pressure rows, route-choice readiness, first-run route setup, memory-tax copy, and recall-assist feedback were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (329 tests).
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 8 memory mechanic depth final wrap-up

- Stabilized scope: safe copy-only hardening after inspecting the dirty `main` worktree. Strained recall feedback now distinguishes enemy/patrol-only memory strain from forgotten-marker recovery, while preserving existing recall focus, score, route-readiness, burden threshold, assist, life, route, shop, reward, and memory-pressure behavior.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts --reporter=dot` passed on May 27, 2026 (9 tests).
- Verification run: `yarn vitest run src/renderer/components/GameScreen.test.tsx -t "featured objective" --reporter=dot` passed on May 27, 2026 (1 test; 34 skipped), covering the route-choice memory read panel path.
- Verification note: the combined shared plus renderer memory lane was attempted but timed out locally at 120s before returning useful runner output; rerun the full renderer route-choice check after concurrent renderer edits settle.
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 10 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (12 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 11 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, first-run route setup, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 27, 2026 (97 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 12 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts --reporter=dot` passed on May 27, 2026 (9 tests).
- Verification run: `yarn vitest run src/renderer/components/GameScreen.test.tsx -t "featured objective" --reporter=dot` passed on May 27, 2026 (1 test; 34 skipped), covering the route-choice memory read panel path.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 13 memory mechanic depth final wrap-up

- Stabilized scope: added defensive Recall Focus normalization at the match-score and recall-feedback read boundaries so stale or migrated run state cannot award or preview more than the shipped focus cap. The shipped cap, score-per-focus value, clue bonus, burden thresholds, route readiness language, and memory-pressure thresholds were not retuned; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts --reporter=dot` passed on May 27, 2026 (290 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, capped focus display, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, memory-pressure constants, or recall scoring constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 1 performance / polish wrap-up

- Stabilized scope: startup asset loading, card illustration image warmup, UI SFX buffer preload, viewport resize handling, and platform tilt field writes. No balance constants, route outcomes, scoring, life, shop, or reward values were changed in this lane.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests). `yarn typecheck` also passed on May 26, 2026.
- Remaining work: capture a browser startup trace to confirm first interactive paint is no longer contending with full card illustration and mode poster decodes; run a lower-end mobile visual smoke before changing warmup concurrency; revisit audio preload breadth only if real-device memory pressure appears in profiling.

## V3 cycle 2 performance / polish final wrap-up

- Stabilized scope: no code retune was made in the final hour after inspecting the dirty `main` worktree. Existing concurrent changes to startup preload, card illustration warmup, shared audio buffer loading, viewport resize throttling, and platform tilt CSS writes were preserved.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 26, 2026. Vite still reports existing large chunk warnings for the `three`, `pixi`, and main bundles.
- Remaining work: capture a browser startup trace on the live app to confirm first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing preload concurrency or audio preload breadth; profile whether the large renderer chunks need code-splitting after the release lane settles; keep any follow-up scoped to measured regressions rather than new presentation or economy behavior.

## V3 cycle 3 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 26, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke; profile the large renderer chunks before deciding on code-splitting or preload breadth changes.

## V3 cycle 4 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks before deciding on code-splitting.

## V3 cycle 5 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks before deciding on code-splitting or asset preload breadth changes.

## V3 cycle 6 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay/combat/balance edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks and large raster/audio assets before deciding on code-splitting, compression, or asset preload breadth changes.

## V3 cycle 7 performance / polish final wrap-up

- Stabilized scope: test-only startup preload isolation after inspecting the dirty `main` worktree. The runtime startup-critical preload deferral, bounded card illustration warmup, background mode-poster warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay/combat/balance/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts --reporter=dot` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing LF-to-CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, audio preload breadth, code-splitting, compression, or asset payloads; keep follow-up tied to measured regressions.

## Automated sanity (REF-098 / schedule)

- `yarn sim:endless --floors=1000 --seed=42001` — CSV summary of `floorTag` and mutator counts over a long endless slice; use after edits to `floor-mutator-schedule.ts` or `FLOOR_SCHEDULE_RULES_VERSION`. Spot-check that `breather` / `boss` tags appear at expected cadence for the cycle.
- REG-086 lightweight balance snapshot lives in `src/shared/balance-simulation.ts`. It is offline-only and checks floor schedule, shop wallet pacing, findable target ranges, and relic draft rarity mix without server authority or competitive leaderboard data.

## V3 cycle 1 wrap-up verification

- 2026-05-26 core gameplay loop stabilization: shared typecheck passed; focused core gameplay, memory recall feedback, game-over, balance, softlock, and exploit regression tests passed.
- `yarn gate:gameplay` passed `typecheck:shared`, the shared gameplay gate suite (378 tests), and `yarn sim:endless --floors=1000 --seed=42001`.
- Follow-up broad `yarn test` drift from this note was resolved in the bug-and-edge-case hunt: startup preload timer isolation, tile-board viewport margin expectations, gauntlet pressure audio coverage, and encyclopedia snapshot version 15 now pass under the full Vitest run.

## V3 cycle 10 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing seed-variance diagnostics, low-life exposure bounds, recovery-debt checks, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss pressure, shop sinks, and reward inflow diagnostics were preserved; unrelated concurrent renderer/audio/content/progression/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/difficulty-profile.test.ts src/shared/game.test.ts src/shared/softlock-fairness.test.ts src/shared/boss-encounters.test.ts` passed on May 27, 2026 (323 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Long-run rows stayed within range, including `min_profile_lives_remaining=1`, `max_profile_run_falls=0`, `max_profile_ending_gold_per_floor=4.71`, `max_profile_gold_held_per_floor=4.98`, `min_profile_worst_seed_clear_share=1`, and route shares Safe `0.33`, Greed `0.39`, Mystery `0.28`.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026. The schedule smoke reported `normal=584`, `breather=250`, and `boss=166`, with findable target weights still `35/15/35/15`.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: expand the deterministic balance seed set beyond `[42001, 42077, 42123]`; capture manual floor-6 and floor-12 Classic, Daily, Scholar, and Gauntlet playtest outcomes; add browser/e2e proof for route-choice pressure reads and boss-floor survivability; keep score, life, route payout, hazard cadence, shop, relic, reward, and economy constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 11 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing seed-variance diagnostics, low-life exposure bounds, recovery-debt checks, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss pressure, shop sinks, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Tooling note: direct `tsx scripts/gate-long-run.ts --floors=48` failed in PowerShell because `tsx` was not on PATH outside Yarn; `yarn tsx scripts/gate-long-run.ts --floors=48` is the working local command.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads and boss-floor survivability; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants.

## V3 cycle 12 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 13 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, difficulty-profile coverage, floor-mutator schedule coverage, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/difficulty-profile.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts --reporter=dot` passed on May 27, 2026 (42 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Tooling note: direct `tsx scripts/gate-long-run.ts --floors=48` still fails in this PowerShell shell because `tsx` is not on PATH outside Yarn; `yarn tsx scripts/gate-long-run.ts --floors=48` is the working command.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 14 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, difficulty-profile coverage, floor-mutator schedule coverage, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/difficulty-profile.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts --reporter=dot` passed on May 27, 2026 (42 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`, with findable target weights still `35/15/35/15`.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## Release playtest script (quick bar)

Use three fixed seeds or saves (e.g. classic/new run, daily of the day, Scholar from the main menu). For each: reach **floor 6** (or fail honestly), then jot **final score**, **lives remaining**, **shuffle / destroy charges used**, and **highest pain point** (memorize window, symbol band, mutator combo). Re-run after any change to `contracts.ts`, `game.ts` match/scoring paths, or presentation mutator penalties.

## V3 cycle 1 wrap-up - Inventory, Items, Rewards

- Stabilized run-only inventory reward handling around capped pickups, malformed reward amounts, and stale reward-room ledgers. Capped inventory rewards now report feedback instead of pretending the pickup was gained, and all-capped pickup rewards convert to small overflow score so bonus rooms do not feel empty.
- Verified the current scope with `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx`, `yarn typecheck:shared`, and `yarn typecheck`.
- Remaining balance work: run floor-6 manual playtest seeds for Classic, Daily, and Scholar after the concurrent UI/audio lanes settle; confirm overflow score values (`+5` partial, `+10` all-capped) feel like compensation rather than a new farm; add an end-to-end claim path once bonus-room UI is wired beyond shared services.

## V3 cycle 2 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no reward math or stack limits were retuned. The final pass kept the existing capped-pickup and stale-ledger behavior intact, corrected stale inventory source copy so destroy charges no longer imply clean-clear farming, and left unrelated concurrent renderer/audio/content edits untouched.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add an end-to-end claim path for bonus-room rewards once the UI wiring is final; manual-playtest the `+5` partial and `+10` all-capped overflow score compensation before changing those constants.

## V3 cycle 3 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no additional reward math, stack limits, source/sink constants, or inventory UI behavior were changed in the final-hour lane. Current capped-pickup feedback, malformed reward amount guards, stale reward-room ledger checks, and overflow-score compensation remain intact while unrelated concurrent renderer/audio/content edits are preserved.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values before any retune.

## V3 cycle 4 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no code retune was needed after inspecting the current dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, and overflow-score compensation were preserved while unrelated concurrent renderer/audio/content/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging plus the `+5` partial and `+10` all-capped overflow score values; avoid retuning reward values, stack limits, or source/sink constants until those playtest notes or a reproducible seed failure justify it.

## V3 cycle 5 wrap-up - Inventory, Items, Rewards

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, and route payouts unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 6 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, and relic/service reward hooks unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 7 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 8 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final wrap-up pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 9 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 10 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 11 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 12 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 6 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route progression repair, duplicate node/edge guards, stale current-floor repair, first-run Classic launcher copy, and side-room reward feedback stayed intact; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip and stale-room recovery, route-choice return from pause/menu surfaces, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 8 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route progression repair, duplicate node/edge guards, stale current-floor repair, first-run Classic launcher copy, last-life Greed disablement, side-room reward feedback, and exhausted bonus-room single-action behavior stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip and stale-room recovery, route-choice return from pause/menu surfaces, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 9 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route choice presentation, map progression invariants, side-room action flow, shop handoff, stale-room recovery, and store-level navigation transitions were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-rules.test.ts src/shared/game.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 27, 2026 (379 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Browser note: `yarn playwright test e2e/playable-path-interludes.spec.ts --workers=1 --reporter=list` exceeded a six-minute outer command timeout while many pre-existing local Node/browser processes were active, so the route/shop/side-room browser contract remains unverified in this pass rather than a confirmed regression.
- Remaining work: rerun `e2e/playable-path-interludes.spec.ts`, `e2e/playable-path-navigation.spec.ts`, and `e2e/navigation-flow.spec.ts` on a quiet local server; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room primary/choice/skip, side-room-to-shop handoff, route-choice return from pause/menu surfaces, relic draft into next floor, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 10 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route choice presentation, map progression repair, duplicate node/edge guards, side-room action flow, shop handoff, stale-room recovery, boss-approach copy, and store-level navigation transitions were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/shared/route-rules.test.ts src/shared/game.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/store/useAppStore.test.ts src/renderer/App.test.tsx --reporter=dot` passed on May 27, 2026 (421 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `git diff --check` passed on May 27, 2026; diff hygiene reported only the existing LF-to-CRLF normalization warnings.
- Browser note: `yarn playwright test e2e/navigation-flow.spec.ts --workers=1 --reporter=list` passed the first three navigation cases, then the local Vite server stopped responding and the remaining cases failed at `page.goto('/')` with `net::ERR_CONNECTION_REFUSED`. Treat this as unresolved local browser-server stability, not a confirmed navigation assertion regression. The combined `e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts` command also exited early with code `4294967295` before useful spec output.
- Remaining work: rerun `e2e/navigation-flow.spec.ts`, `e2e/playable-path-navigation.spec.ts`, and `e2e/playable-path-interludes.spec.ts` on a quiet local server; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room primary/choice/skip, side-room-to-shop handoff, stale-room recovery, route-choice return from pause/menu surfaces, relic draft into next floor, daily launch from Choose Your Path, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## Symbol band thresholds (`tile-symbol-catalog.ts`)

Current defaults (floor level = run floor):

| Band | Level range | Notes |
|------|-------------|--------|
| Numeric two-digit ranks | 1–`SYMBOL_BAND_LAST_LEVEL_NUMERIC` (8) | Dense, readable on small tiles. |
| Letter / digit hybrid | 9–`SYMBOL_BAND_LAST_LEVEL_LETTER` (16) | Step up in discrimination load before callsigns. |
| Callsign pairs | 17+ | Longer labels; keep bracket jumps playtested for “first callsign floor” feel. |

`category_letters` mutator still forces the letter hybrid set regardless of level. Changing the two `SYMBOL_BAND_*` constants requires updating [`tile-symbol-catalog.test.ts`](../src/shared/tile-symbol-catalog.test.ts) bracket expectations and bumping `GAME_RULES_VERSION` if pair generation semantics change.

REG-047 readability guardrails now live in `tile-symbol-catalog.ts`: each band exposes a readability purpose, target difficulty, max label length, and confusable-token denylist. Current catalog tests assert labels stay within each band limit, symbols remain unique, and common distractors (`O`, `0`, `I`, `1`, `l`) do not appear together in a band.

## Relic roster (cross-check `src/shared/relics.ts` + `game.ts`)

Shipped pool ids: `extra_shuffle_charge`, `first_shuffle_free_per_floor`, `memorize_bonus_ms`, `destroy_bank_plus_one`, `combo_shard_plus_step`, `memorize_under_short_memorize`, `parasite_ward_once`, `region_shuffle_free_first`, `peek_charge_plus_one`, `stray_charge_plus_one`, `pin_cap_plus_one`, `guard_token_plus_one`, `shrine_echo`, `chapter_compass`, `wager_surety`, `parasite_ledger`.

**Standing-rule relics.** The ids above pay out once, when they are taken. These six pay on a condition the board keeps offering, so they change which tiles a player goes for rather than only which number the floor starts on. Each is one `relic.active` content definition applied from the live trait path in `tile-trait-rules.ts` (`STANDING_RULE_RELIC_DEFINITIONS` in `gameplay-core-contracts.ts`):

| Relic | Rarity | Fires when | Pays |
|-------|--------|-----------|------|
| `opening_ledger` | common | the first match resolved on any floor | +25 score |
| `tithe_conduit` | common | any Conduit match | +1 shop gold, +8 score |
| `bulwark_plate` | uncommon | any Heavy match | +1 guard token, or +18 score at the guard cap |
| `stasis_broker` | uncommon | any Stasis match | +1 full-board shuffle charge (barred under `noShuffle`) |
| `echo_relay` | rare | an Echo match with an adjacent Heavy tile | +1 flash pair |
| `drift_appraiser` | rare | a Drift match with an adjacent Cursed tile | +2 shop gold, +15 score |

Their draft weights sit a notch under the equivalent-rarity charge relics, because a rule that fires all run is worth more than a number that fires once. `opening_ledger` and `tithe_conduit` are in the demo pool so the demo still shows what the class is; the other four are full-game only.

Milestone offers: first at floor **3**, then every **3** floors (**3, 6, 9, 12, …**); max **12** milestone **visits** per run (`RELIC_FIRST_MILESTONE_FLOOR`, `RELIC_MILESTONE_STEP`, `MAX_RELIC_PICKS_PER_RUN` in `relics.ts`). **Puzzle** runs skip relic drafts. Each offer rolls **three** distinct relics using `RELIC_DRAFT` weights (common / uncommon / rare) with **tier scaling** so later drafts relatively favor higher rarities (`effectiveRelicDraftWeight`, `rollRelicOptions`, `weightedPick.ts`). **Pick budget** per visit stacks: `shrine_echo` relic (bank for next shrine), **Daily** mode (+1), **generous_shrine** mutator (+1), claimed Week of Archives meta unlock after 7 dailies (`relicShrineExtraPickUnlocked` → `metaRelicDraftExtraPerMilestone`), Scholar contract (`bonusRelicDraftPick`) — see `computeRelicOfferPickBudget` in `game.ts`.

Scheduled Endless drafts guarantee one contextual option when an eligible relic answers the current/next chapter, active wager, or near-complete Favor bank; Daily / gauntlet / meditation use the base picker. Hard contract filters remove shuffle relics under `noShuffle` and `destroy_bank_plus_one` under `noDestroy`.

Memorize modifiers (see `getMemorizeDurationForRun` in `game.ts`): **`+280ms`** with `memorize_bonus_ms`; **`+220ms`** when `memorize_under_short_memorize` and `short_memorize` mutator are both active.

## Endless cycle reachability (`floor-mutator-schedule.ts`)

The twelve-floor cycle is the only thing that schedules mutators in Endless, so a mutator absent
from it is absent from the game. Two problems, both found by walking the schedule rather than
reading it:

- `generous_shrine` appeared in `MUTATOR_IDS`, had working rules in `relic-offer-open-rules.ts` and
  `relic-offer-rules.ts` granting **+1 relic pick per milestone draft**, and had a Codex entry — and
  no floor scheduled it. It had never reached a player. It now sits on floor 10.
- Floors 3 and 10 were byte-for-byte identical (`treasure_gallery` / `scholar_style` /
  `findables_floor`), so one cycle showed the same room twice. Floor 10 is now the shrine breather.

`distraction_channel` remains deliberately occasional: a seeded roll on roughly a quarter of boss
floors, so it is reachable but not guaranteed inside the first cycle. That is a design choice, and
`floor-schedule-reachability.test.ts` encodes it as the one mutator allowed to miss cycle one —
every other mutator must appear on every seed, and no two floors in a cycle may be identical.

## Board colour and colour vision (`color-vision.ts`)

Five palettes on the board carry rules rather than decoration: tile traits, enemy hazards, hazard
tiles, trap state, and trait interaction lanes. Each is gated against normal vision plus the three
dichromacies at a CIE76 floor of dE 25, roughly ten times the just-noticeable step.

As shipped, every one of them had pairs a player could not separate — the worst by palette:

| Palette | Worst pair as shipped | After |
|---|---|---|
| Tile trait | Sealed vs Stasis, dE **2.1** (deuteranopia) | 29.8 |
| Trait lane | Guard vs fallback, dE **1.0** (protanopia) | 27.2 |
| Enemy hazard | Boss vs Warden, dE **5.5** (tritanopia) | 42.6 |
| Hazard tile | dE **7.6** | 45.2 |
| Trap state | Resolved vs Armed, dE **16.1** (deuteranopia) | 51.1 |

Each hue stayed within 16-20 degrees of the colour it replaced, so the board still reads the way a
returning player learned it. Lightness is doing most of the separation work, because lightness is
the one axis every dichromat keeps — so an edit that only adjusts hue will not move the gate.

## Honor mark ceiling (`meta-progression.ts`)

Honor marks come from four capped sources: achievements (`earned x 2`), the daily archive (7),
no-powers mastery (5) and relic mastery (5). The profile ladder charges `META_MARKS_PER_LEVEL = 5`
per level and its top milestone is level **8**, so **40** marks are needed to reach Legend.

With seven achievements the ceiling across all four sources was **31**, and Legend was therefore
unreachable — the milestone existed in `META_PROGRESS_MILESTONES` and no save could ever satisfy it.
Widening the achievement set to twenty raises the ceiling to **57**, which makes Legend reachable for
the first time and still requires most of the roster. The two permanent upgrades cost 7 and 12 marks,
so the meta track keeps a real spend-versus-save decision against that ceiling.

Recheck this arithmetic whenever `ACHIEVEMENT_IDS`, a source cap, `META_MARKS_PER_LEVEL`, or the top
milestone level changes; `meta-progression.test.ts` pins the per-source rows but not the ceiling.

## Presentation mutator match penalties (`game.ts`)

Flat per-match score subtractions from `getPresentationMutatorMatchPenalty` (stack additively when multiple are active):

| Mutator | Penalty per successful match |
|---------|------------------------------|
| `wide_recall` | 5 |
| `silhouette_twist` | 5 |
| `distraction_channel` | 4 |

These are defined next to `getPresentationMutatorMatchPenalty` in `game.ts` (not `contracts.ts`). Tuning them affects endless/daily runs that stack presentation mutators; keep `game.test.ts` presentation penalty test in sync when values change.

## V3 cycle 1 UI / HUD / feedback wrap-up

- 2026-05-26 final stabilization pass found the scoped HUD feedback lane stable after the current active changes. Focused verification passed for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx`, covering visual HUD follow-up copy, compact recent-action feedback, polite live-announcement priority, and UI/audio feedback contracts.
- 2026-05-26 V3 cycle 2 final wrap-up kept the lane documentation-only after verification: `yarn typecheck` passed; focused HUD feedback checks passed (89 tests); focused renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests).
- 2026-05-26 V3 cycle 3 final wrap-up fixed one renderer test fixture to use the current `DungeonObjectiveId` vocabulary (`pacify_floor` instead of stale `defeat_enemies`) and made no runtime UI, HUD, scoring, life, route, or reward changes.
- V3 cycle 3 verification passed: `yarn typecheck`; `yarn vitest run src/renderer/components/GameScreen.test.tsx src/renderer/components/GameplayHudBar.test.tsx src/renderer/hooks/useHudPoliteLiveAnnouncement.test.ts src/renderer/audio/uiSfx.test.ts` (90 tests); and `yarn vitest run src/renderer/App.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx src/renderer/components/InventoryScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx` (42 tests).
- Full renderer TypeScript also passed after a longer run. The first `yarn typecheck` attempt timed out at two minutes without diagnostics; rerun with a five-minute window completed successfully.
- 2026-05-26 V3 cycle 4 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed, the focused HUD feedback slice passed (90 tests), and the adjacent renderer screen slice passed (42 tests). No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 5 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, and `useHudPoliteLiveAnnouncement` passed (84 tests); adjacent UI/audio screen checks passed for `uiSfx`, app navigation, route choice, collection, game over, inventory, profile, and side room surfaces (48 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 6 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx` passed (90 tests); adjacent renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 7 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx` passed (90 tests); adjacent renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 7 browser smoke: `yarn playwright test e2e/long-run-feedback-hud.spec.ts --workers=1` passed both phone HUD viewport cases, but the desktop case timed out while dismissing the startup intro before HUD layout assertions. A desktop-only rerun exceeded the outer command timeout without useful runner output, so desktop browser HUD proof remains unproven rather than a confirmed HUD regression.
- Browser follow-up: `yarn playwright test e2e/long-run-feedback-hud.spec.ts --workers=1` did not produce HUD layout assertions in this local pass. The first run timed out at `page.goto('/')` before `domcontentloaded` for all three cases; a warmed rerun exceeded the outer command timeout. Keep this as pending browser infrastructure/manual verification, not a confirmed HUD regression.
- Remaining work: rerun the heavier browser visual/a11y slice on a clean server (`e2e/long-run-feedback-hud.spec.ts`, mobile HUD density checks, and a fresh screenshot sweep), then manually smoke floor clear into Safe / Greed / Mystery with recent-action feedback, compact recent-action chip priority, live-announcement cadence, and audio feedback visible.

## V3 cycle 1 bug and edge-case hunt wrap-up

- 2026-05-26 final one-hour stabilization kept the repo on `main` and preserved concurrent edits. Fixed stale verification edges only: isolated startup preload tests from cross-file timer bleed, aligned tile-board viewport tests to the current mobile/desktop fit margins, added `gauntlet_pressure` to the gameplay audio coverage expectation, and refreshed the mechanics appendix snapshot for `ENCYCLOPEDIA_VERSION` 15.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1301 tests), and `yarn lint`. Lint has two warnings in `src/renderer/components/GameScreen.tsx` for `react-refresh/only-export-components`; no lint errors.
- Remaining work: run the browser/e2e stabilization lane before release signoff (`yarn test:e2e:renderer-qa` or a smaller navigation plus visual smoke slice), manually smoke floor clear into Safe / Greed / Mystery and gauntlet final countdown audio, and decide whether the `GameScreen.tsx` Fast Refresh warnings are worth splitting into a constants/helper module before freeze.

## V3 cycle 2 bug and edge-case hunt wrap-up

- 2026-05-26 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Remaining work: run the browser/e2e stabilization lane before release signoff (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path plus gameplay-readability smoke), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## V3 cycle 3 bug and edge-case hunt wrap-up

- 2026-05-27 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, navigation, inventory, balance, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Browser smoke attempt: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` exceeded a 10-minute outer command timeout while other Codex lanes and Vite/Vitest/build processes were active, so it remains unproven rather than a confirmed navigation regression.
- Remaining work: rerun the browser/e2e stabilization lane on a quiet server (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path/gameplay-readability), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## V3 cycle 4 bug and edge-case hunt wrap-up

- 2026-05-27 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, navigation, inventory, balance, performance, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `git diff --check` with only existing LF-to-CRLF normalization warnings, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Browser smoke attempt: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` exceeded a 15-minute outer command timeout without useful assertion output. The timed-out navigation/playable-path process tree from this pass was stopped; other local processes were left untouched as likely concurrent lanes or existing servers.
- Remaining work: rerun the browser/e2e stabilization lane on a quiet server (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path/gameplay-readability), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## Gen 171: one mode

`GameMode` is now `'endless'` and nothing else. The daily, the puzzle set, the gauntlet and the
meditation run are gone; `docs/REMOVED_MODES.md` holds what each of them was, generated from the
catalogs on the commit before they were deleted.

Nothing a player could set up was lost. The setup sheet (`classic-run-setup.ts`) had already
absorbed every one of them as an option on the one mode: the gauntlet's clock is **Pressure**
(`timed_5 / timed_10 / timed_15`), the meditation's slower window is **Calm pacing**, the wild run
is **Chaos**, practice is **Unrecorded**, and both contracts are **Vows**. What went with the modes
is what only they had: the daily's shared seed and its streak, and the three authored puzzle boards.

Three balance terms moved as a result, and each is a real change to what the one mode pays:

- **Memorize window.** The 1.55× stretch was `gameMode === 'meditation'`; it now reads
  `resolveDelayMultiplier > 1`, which only Calm pacing sets. Same window, reachable from the sheet.
- **Streak rewards.** Meditation suppressed the guard token, the combo shard and the chain heal on
  a streak. That was a mode rule with nowhere to live, so it is gone: every run pays the streak.
- **Recall focus.** The puzzle branch returned 0 from `calculateRecallMatchBonus`, and a great many
  score units were written against runs built with `gameMode: 'puzzle'` for exactly that quiet. Those
  fixtures now say `recallFocus: 0` outright; a real run still opens at `INITIAL_RECALL_FOCUS`, so
  every match in the one mode pays `RECALL_FOCUS_MATCH_SCORE` on top of the terms those units name.

The bands did not move and did not need to: `sim:pop --check`, `sim:cascade --check`,
`sim:cascade --check --relics` and `sim:occupancy` all pass unchanged after the collapse, which is
the point of the exercise — what the simulations measure is now what everyone plays.

The daily's meta layer was re-sourced rather than deleted, because the reward at the end of it is
real. **Week of Archives** (+1 relic pick at every milestone shrine) asked for seven daily clears; it
now asks for seven floors whose chain reached **Sharp** (`playerStats.sharpFloors`), a counter the
one mode moves and the chain quest already keeps. The honor that carried the bronze crest was
re-pointed the same way (`honor_sharp_initiate`). Four achievements and four honors that only a
removed mode could earn were deleted outright rather than left standing unearnable — which is the
failure `achievement-reachability.test.ts` exists to catch.

## Gen 172: the floor is pairs

Board generation stopped placing the dungeon layer. Every generated floor is now a board of pairs
dealt in clumps and nothing else — no card recipe, no filler pass, no exit tile, no shop, no room,
no hazard pass, no layout plan that pinned them. `board-build-rules.test.ts` asserts it over 768
boards, across four seeds, sixteen floors, four archetypes and three floor tags.

### What it did to the cascade

The thesis's central claim was that the dungeon budget was starving the pop of pairs to reach, and
this is the first measurement of it rather than an argument for it:

| | before | after |
|---|---|---|
| Fever share, clean player (`sim:cascade`) | ~0.13 | **0.51** |
| Pop ladder spread (`sim:pop --check`) | — | 4.74, every rung rising |
| Silent systems (`sim:occupancy`) | 11 | **0** |

The occupancy census passes its aspirational check outright for the first time since it was written.
Its silent list did not empty because eleven quiet systems woke up; it emptied because they were
deleted. That distinction is written into `system-occupancy-simulation.ts` so the next reader does
not mistake one for the other.

### The bands that moved, and why each moved

Two retunes, both measured, neither a widening to get past a red test:

- **`avg_guard_reward_potential_per_floor` min 0.1 → 0.05** (measured 0.08). Guard used to come from
  shrine pairs and rest nodes as well as the ward-spark findable; only the findable is left. Guard is
  still reachable, just scarcer, which is a real change to how safe a floor feels.
- **`trait_board_power_interaction_floor_share` min 0.5 → 0.4** (measured 0.42). A swap or block
  wants two traited tiles adjacent, and the dungeon cards padding a floor out were carrying traits
  too.

Five rows left the balance report rather than sitting at nought against a minimum forever: the
moving-hazard average, the hazard-tile average, the floor-1 hazard opener, the contact-risk average,
and recovery relief on high-pressure floors. `max_pressure_step_up` and `max_recovery_debt_streak`
stay, because a ceiling passes honestly at nought.

### The finding this surfaced: the route offer has gone flat

The profile simulation's own guardrail caught something worth keeping in front of whoever picks up
Phase 1's remaining tasks. It exists so that "one route cannot silently become the default answer",
and for the greedy profile that is now exactly what has happened — five faces of one cause:

1. `dominantRouteShare = 1`. Greedy takes the greedy route on all 144 floors.
2. `endingShopGold = 801/144` (5.56/floor, ceiling 5). A player who never takes a safe route never
   pays a safe route's toll, so gold goes in and nothing takes it out.
3. `greedy.rewardClaims / cautious.rewardClaims` 1.60 → 1.68. The denominator moved: cautious used
   to take greed when a floor made safe unattractive, and no floor does that any more.
4. `lowLifeFloorShare` is nought for both greedy and high skill.
5. `greedy.minLivesRemaining` 1 → 4. A greedy player can no longer get into trouble.

Greed used to be withheld on the floors the dungeon layer shaped — a boss floor, an elite node — and
with those gone the offer is the same three doors twelve times over. The answer is the between-floor
layer going too (Phase 1, T1.9–T1.17), not a wider bound. Each of the five is asserted exactly, with
the reasoning at the assertion, so a sixth face fails rather than blending in.

### A softlock the exit tile had been hiding

`selectStasisBlockIndex` refuses to place a Stasis block when one pair is left, but it decided
against the board as it stood at the moment of the match — and the pop that follows that match can
take pairs off the board after the decision is made. Two pairs at decision time, one once the cascade
settles, and the survivor is the blocked one: the floor never ends.

It was live and invisible for as long as every floor carried an exit, because a stranded player could
still leave through it. Seed 172707 floor 3 is where it surfaced, and that is an ordinary floor, not
a corner. `releaseStrandedStasisBlock` re-checks the block against the board the turn actually
produced and drops it when there is nothing else to play.

### The cascade after the cut, and one debt it exposed

`sim:cascade --check` and `sim:pop --check` both pass. Two numbers moved and one band had to move
with them, and one band moved for a reason that is a debt rather than a recalibration.

**Recalibrated.** `referenceFeverShare` max 0.2 → 0.25, measured 0.201. The ceiling was set against a
floor whose pair count the dungeon budget was eating; a floor of pairs deals 9.5 of them, so there
are more matches and more chances to climb. Every rung rose together — clean 0.13 → 0.51, reference
0.08 → 0.20 — and `feverCleanOverReference` came out at 2.54 against a floor of 2, essentially where
it was. A ladder whose rungs all rise by the same factor is the same ladder held higher.

**A debt, recorded not hidden.** `CASCADE_RELIC_BANDS.feverCleanOverReference` min 2 → 1.6, measured
1.65. With all three chain relics held, the ladder barely separates a clean player from a sloppy
one, and the cause is in the same output:

| | bare | holding Tuning Fork + Magpie Ledger + Suit Lens |
|---|---|---|
| turns to clear, clean | 4.1 | **2.9** |
| Fever share, clean | 0.51 | **0.19** |
| clean/reference Fever ratio | 2.54 | **1.65** |

Three relics bought specifically to serve the chain cut the chain's best payoff to a third. They
extend the pop's reach, the floor empties sooner, and there are not enough matches left to climb a
chain with — they work against the thing they exist for. This was masked while the dungeon budget
kept floors small for everyone; on a floor of pairs the reach finally has room to matter, and what
it does with it is end the floor.

The bare bands are untouched. Only the relic path is relaxed, only to the measurement, so any
further flattening fails immediately. The fix is the relics' own numbers, and it belongs with Phase
2, where the shape of a floor is being decided anyway.

## Gen 173: no door between floors

The route offer is gone. A cleared floor goes straight to the next one: no safe, greedy or mystery
door, no gateway pair that picked the door for you, no side room behind it, no run event, no route
card or route special dealt onto the next board. Cut at the source — `generateRouteChoices` and the
route-special layer of board generation no longer exist — and the seven route modules, `run-events`
and the side-room surface went with them (`docs/REMOVED_DUNGEON_LAYER.md` lists them). A
`route.choose` or `side_room.resolve` command in an old journal is rejected with a reason instead of
being replayed; the command types themselves stay in the schema until the journal migration in T1.14.

### The debt list is empty

Gen 172 recorded three findings in `KNOWN_LONG_RUN_DEBT`, each asserted exactly, each answered "by
the between-floor layer going, not by moving a bound". It went, and all three went with it:

| finding (Gen 172) | Gen 173 |
|---|---|
| `greedy … dominantRouteShare=1` | no route to dominate |
| `greedy … endingShopGold=801/144` | gone — it was the toll a never-taken safe route never collected |
| `max_profile_ending_gold_per_floor:5.56 outside 0-5` | inside the band |

`gate:long-run`, `balance-simulation.test.ts` and `long-run-depth.test.ts` now assert an empty issue
list, and the greedy profile's five faces collapse to one line: it loses no life at all over 48
floors and three seeds, because nothing between floors costs one and nothing on the floor does
either. That is the gap Phase 2 exists to fill, and it is asserted exactly.

### The build catalog: seventeen became twelve, and moved

`build-strategy-playthrough-simulation.test.ts` asserts its viability issues exactly. The count went
17 → 12, but not by subtraction:

- **Gone with the metric.** Route risk assessments, route risk rejections, adaptive route selections
  and side-room resource assessments read zero on every build with no route to assess, so the four
  columns were removed rather than baselined, and the two "greed policy with nothing to decline"
  rows with them.
- **Gone with the route, unexpectedly.** Eight hazard-pressure rows. The safe route every policy was
  taking had been keeping the hazard-pressure mutators off the schedule; with no route, one lands
  on one floor a seed. Every matchup is sampled again and The Saboteur's region shuffle fires — the
  Gen 172 note that "its gate never opens" is no longer true, and the assertion says so.
- **Arrived.** The Engine short of shard conversions (2 of 3; seed 42077 never converts, because a
  run that never loses a life has nothing to convert for), one seed with no scout glint for The
  Cartographer, and four more turn-ratio breaches — seven now, all The Cartographer against
  everyone else at 1.53–1.65 — as the last thing that made builds' floors differ in length went.

### Smaller things the cut moved

- **Memory burden.** The same strained board reads 6 ("taxed") → 4 ("loaded"): three route
  decisions no longer weigh on it.
- **The payoff stack.** A route card was one of four reward channels; the same match now cashes
  three and reads "Stack cashout" rather than "Super stack". The build lane behind it becomes
  visible in the four-lane map.
- **The interaction graph** drops `route.choice`, `route.mystery` and `progression.route_side_room`
  (26 edges) and gains a declared reader for `peekRevealedTileIds`, which only the mystery route
  had been reading on paper; the peek power reads it in fact.
- **Bands.** None moved. `sim:cascade`, `sim:pop` and `sim:occupancy` hold exactly where Gen 172
  left them.

## Gen 174: nothing purchasable

Gold is gone, and the shop with it. A cleared floor pays no gold; a match pays none, whatever it
touched — the route card, the dungeon treasure, the toll cache and the fuse cache all paid into the
same wallet, and the wallet is closed; the momentum ladder pays none at Clean and Sharp; the relic
draft's services, still priced on the card, take none. The floor-clear vendor, the vendor a shop
card opened from the board, the store dock button, the shop view, the shop rules and the economy
ledger are deleted (`docs/REMOVED_DUNGEON_LAYER.md`). A `shop.purchase` or `shop.reroll` command in
an old journal is rejected with a reason, like a route choice. `shopGold` stays on the run shape
reading nought until the save migration in T1.14.

### What it did to the numbers

Nothing moved. `sim:cascade`, `sim:pop` and `sim:occupancy` hold exactly where Gen 172 and 173
left them (Fever 0.51 clean, ladder spread 4.74, no silent system), which is the measurement of
the thesis's claim that the wallet was never part of the loop: it was a number the loop fed and
nothing on the board ever read back.

### What left the reports rather than being baselined at nought

The balance profile simulation was a wallet model — gold in from the floor, healing bought when
lives ran low, the rest spent on stock — and with no gold there is no wallet to carry. Gone from it:
the shop-sink row, the gold-per-seed row, the live gold-inflow row, the consumable and power-charge
inflow rows (keys and the vendor's stock), the healing-purchase share, the unhealed low-life
exposure (low life *without healing to buy* is now just low life), the ending and peak wallet
ceilings, and the `shopVisitBias` profile knob. The long-run soak drops the currency-inflow fatigue
row, the two unhealed rows and the wallet rows, and the economy ledger — whose every source was a
dungeon card or the shop — is deleted rather than summarised at nought.

The build catalog loses The Vaultbreaker: its signature was a purchase, its favourable matchup a
treasure floor, its every input gone. Seven builds remain and the `economy` axis, which only it
scored on, goes with it. The viability issue list is asserted exactly as before, one build shorter.
The relic archetype of the same name stays in `relics.ts`, and so does its graph node, because six
relics and the Vaultbreaker definitions still declare it; it reads no gold and enables no shop, and
it goes with the rest of the relic layer in Gen 175.

The lint pass that closed this commit also cleared the last of Gen 173's leftovers: the route
readiness copy in `memory-recall-feedback.ts`, the gateway route resolver
(`loaded-gateway-rules.ts`, deleted), and the side-room assessment helpers in the playthrough
simulation, none of which anything called any more.

### One thing that got slightly worse, and is recorded as such

The Extreme Fever ladder paid a gold at Clean and Sharp and two at Fever, and a shard at Fever. With
gold gone, Clean and Sharp pay nothing: a name on the floor-clear line and no reward behind it. That
is a real loss to the floor-end beat and it is not fixed here. Phase 2's floor-end bonus (T2.7) is
where the tiers get paid again, in score with a tier multiplier, which is what the thesis wanted the
ladder to be in the first place.

## Gen 175: no draft, no loadout

The milestone relic draft never opens. The floor clear used to stop every third floor for it; now
a cleared floor goes straight to the next one, whatever floor it is. The draft surface, its store
slice and its copy are deleted, and so are the offer rules, the pick transition, the sealed fourth
option and the draft services (`docs/REMOVED_DUNGEON_LAYER.md`). A `relic.offer_open`,
`relic.pick` or `relic.offer_service_use` command in an old journal is rejected with a reason, like
a route choice or a purchase. `relicOffer` stays on the run shape reading null until T1.14.

The four starting loadouts are gone from run creation: a run starts with what every run starts
with. `startingLoadoutId` stays on the run and the summary reading null until T1.14, and the
loadout line leaves the game-over build recap and the inventory model.

The build-strategy simulations are deleted rather than emptied: their subject was which relic to
draft, and there is nothing to draft. The build viability issue list (12 rows, asserted exactly
since Gen 173) goes with them. Nothing else that reads a relic moved yet: the relic definitions,
their in-play effects, the favor counters and the relic graph nodes come out in the second half of
this generation, and the reports that count them are re-baselined there.

### What it did to the numbers

Nothing moved. `sim:cascade --check` holds at Fever 0.38 (miss 0.1) / 0.20 (miss 0.25), Extreme
Fever 0.58 / 0.43, ripple 1.09 / 1.06; `sim:pop --check` holds the ladder spread at 4.74; the
occupancy census reports no silent system. The draft was a stop between floors, not a thing on
the board.

### The second half: nothing feeds a draft that never opens

Favor existed to bank relic picks. With no draft it was a counter on the HUD and the floor-clear
line that climbed toward nothing, so it is no longer earned anywhere: not from a featured
objective, not from a boss floor, not from a cursed match, not from a secret room. The counters
stay on the run shape reading nought until T1.14, and a `relic_favor.grant` effect in an old
journal is recorded as changing nothing. The Endless risk wager staked an objective streak for
Favor and paid nothing else, so it is gone from the floor-clear dialog, the rules and the core; a
`risk_wager.accept` in an old journal is rejected with a reason. A featured objective still builds
its streak and pays its score kicker; a miss still decays it.

Everything that counted relic picks across runs is gone with it: the Collection's relic section,
the three relic achievements (Steam has never seen them), the Relic Habit honor, the Relic
Apprentice quest, the relic-mastery honor-mark source and the Week of Archives permanent upgrade,
which bought an extra pick at a shrine that no longer opens. The Profile's next-reward slot now
falls to the cosmetic tracks. The relic loadout leaves the run inventory.

Nothing on the board moved: `sim:cascade --check`, `sim:pop --check` and the occupancy census hold
exactly where the first half left them.

## Gen 176: the dungeon modules go

The thirty `dungeon-*` modules, the hazard-tile and roaming-hazard modules, the dungeon run map,
the relic definitions and their in-play effects, the bonus rewards, the build perks and the
between-floor exit transition are deleted, with their tests (`docs/REMOVED_DUNGEON_LAYER.md` names
every file). Gen 172 had already made all of it unreachable from a generated floor; this is the
commit that stops the turn path asking. A flip is a flip: it no longer clears a roaming enemy off
the last pair, reveals an exit, a vendor or a room, or springs a trap. A match no longer damages
an enemy, scouts a hidden card, pays a key or spills a treasure; a miss no longer wakes one. The
chunk break takes plain pairs and nothing else, and the Tuning Fork and Magpie's Ledger branches,
relics no run has carried since Gen 175, go with the relic pool. A `dungeon.exit_activate`,
`enemy_hazard.contact` or `floor.hazard_banish` command in an old journal is rejected with a
reason.

What stays for one more half-generation is the shape: the run, board and tile fields that carried
the layer (`dungeonRun`, `dungeonKeys`, `enemyHazards`, `tileHazardKind`, the `hazard*ThisFloor`
counters, `relicIds`) are still declared and read nought, so the occupancy diff below is readable
against Gen 175. The second half strips them with the save shape and a one-way upgrade for
existing profiles (T1.14).

The save-field policy table survives the module it lived in. `dungeon-save-migration.ts` was
never about the dungeon; it is the list of which persisted fields need a migration when they
change, `audit:save-field-policy` holds every `SaveData` field to it, and it is now
`save-field-policy.ts`.

The interaction graph loses every relic, build, reward, perk, boss, exit, lock, room and topology
node (version 30); the repo model loses the relic, build-archetype and bonus-reward content
registries; the topology audit and its gate are gone from `gate:systems`, and `gate:softlock-full`
is the softlock stress sweep alone.

### The second half: the shape goes with the modules

The fields are gone from the contract. `RunState` loses the relic, shop, wager, route, side-room,
dungeon-map, ledger, perk, key and enemy fields and the twenty-two hazard, scout, mimic, seal,
gateway, altar, vessel and lattice counters; `BoardState` loses the exit, shop, key, lever, boss,
objective and roaming-hazard fields; `Tile` loses the route, dungeon, hazard and scout marks;
`LevelResult` and `RunSummary` lose the rows that reported them; `PlayerStatsPersisted` loses the
relic pick counts and the shrine unlock. The command core loses the eleven commands and
twenty-four events the layer issued, the twelve content definition sets it drafted from and every
condition and effect that fed them; what the effects engine still resolves is one trait interaction
and two pickups.

Two pickups go with it. The ward spark armed a ward against hazard tiles and the scout glint
revealed a hidden dungeon card; with neither on any floor, both paid nothing, and a pickup that
pays nothing is a stop by the same rule that removed the cards. `FindableKind` is `shard_spark`
and `score_glint`, weighted evenly. That is a generation change, so `GAME_RULES_VERSION` is 34.

The save schema is 7. The upgrade is one-way and it is the normalizer: a schema-6 profile loads
with its best score, achievements, run history and chain records intact and none of the removed
fields; a journal entry naming a command this build no longer has fails its schema and is dropped;
`save-data.test.ts` proves both. The save-field policy table is `save-176-v6`, with the run-local
rows for the dungeon fields gone because the fields are.

## Gen 177: the HUD, the book, and the bands

Phase 1 closes here: what the dungeon left on the screen, in the Codex and in the bands.

### The bar

`RunShell` carries numbers and nothing about which run this is. The line that named the run
(Classic, Practice, Wild, a vow) and the perfect-memory badge move into the pause menu, which is a
menu and not the HUD; the floor number gains the one thing the thesis asked for that was missing, a
marker once the run passes the profile's deepest floor (`profileDeepestFloor`, the greater of the
last summary, the run history and the no-powers record, because `SaveData` never kept one number
for it). The trait-route objective - "trigger two trait routes this floor" for a shard or a score
kicker - was an objective, and objectives go with the dungeon; it is removed with its six run
fields, its floor-clear rows, its inventory row and its SFX accent, and `GAME_RULES_VERSION` is 35.
What stays on the bar still has a rule behind it: lives, shards and guards leave with T2.9, turns
against par arrives with T2.6, the clock with Gen 178, and the mutator name goes when the §33.4
profile rotation replaces the schedule's mutator output.

### The book

`generous_shrine` leaves the mutator roster: its only effect was an extra relic pick. Floor 10 of
the cycle keeps its pickup breather and takes `flip_par` as its objective so it is not floor 3
again, and the guard that forbids a repeated room is back. The Codex loses sixteen glossary terms
and nine entries that described relics, Favor, shop gold, routes, side rooms, wagers, enemies,
keys, exits and the daily challenge; every surviving entry is rewritten to the game that exists
(`ENCYCLOPEDIA_VERSION` 28), and a test now greps every term, topic, mode, mutator and achievement
for the vocabulary of the removed layer. Fourteen trait-interaction tags that named relics and
perks nothing produces any more are gone from the interaction copy, the locked "Endless Mode"
Codex card for a mode that does not exist is gone, and so are the relic overlay tone, the
relic-draft overlay policy row and the three sampled cues nothing played.

### The bands, re-baselined

Every simulation, run on this commit:

| | Gen 176 (six seeds) | Gen 177 (forty-eight seeds) |
|---|---|---|
| Fever share, clean / 10% miss / reference (`sim:cascade`) | 0.48 / 0.39 / 0.24 | **0.46 / 0.37 / 0.20** |
| clean/reference Fever ratio | 2.00 | **2.30** |
| Turns to clear, clean / reference | 4.1 / 6.1 | 4.1 / 6.3 |
| Chunk share of score, clean | 0.31 | 0.31 |
| Extreme Fever, clean / reference | 0.72 / 0.47 | 0.71 / 0.41 |
| Pop ladder (`sim:pop --check`) | 1.93 / 3.22 / 3.58 / 6.82, spread 4.71 | 1.93 / 3.22 / 3.58 / 6.82, spread **4.89** |
| Silent / thin / dominant systems (`sim:occupancy`) | 0 / 0 / 0 | **0 / 0 / 0** |
| `sim:endless --floors=200`, fairness and playable issues | 0 / 0 | 0 / 0 |
| Rating drift from a chunk | 0 | 0 |

**The sample was the finding.** On the six seeds the check used to run, the rules-version bump
alone - the same code, different boards - moved the clean/reference Fever ratio from 2.00 to 1.67
against a band of 2, and the twelve-seed gate read 1.83. The reference player's share is the noisy
half: 0.24 at six and twelve seeds, 0.22 at twenty-four, 0.20 from forty-eight to ninety-six,
where it stops moving. `sim:cascade` and `cascade-balance-simulation.test.ts` both run forty-eight
seeds now (six seconds), and the number they agree on is 2.3.

**Ratcheted, both toward the measurement.** `cleanFeverShareOnBigFloors` min 0.15 → 0.3 (measured
0.45; the 0.15 was set when the dungeon budget kept floors small, and a band at a third of the
measurement would let half the loop's payoff go unnoticed). `referenceFeverShare` max 0.25 → 0.22
(measured 0.20). `feverCleanOverReference` stays at 2 with 0.3 of margin. The pop bands and the
occupancy ratchet were already at their measurements.

### The three recorded debts

- `KNOWN_LONG_RUN_DEBT` emptied in Gen 173 and stays empty; `gate:long-run` asserts it.
- The build-catalog issue list (`build-strategy-playthrough-simulation.test.ts`, seventeen then
  twelve exact issues) went with the builds in Gen 175: there is no catalog to have issues.
- The relic ladder debt - `CASCADE_RELIC_BANDS.feverCleanOverReference` relaxed 2 → 1.6 in Gen 172
  because three chain relics cut the clean player's Fever to a third - went with the relics in
  Gen 175. The bare band it was relaxed from is the only one left, and it holds at 2.3.

## Gen 178: no timer

The Gauntlet card went in Gen 171; its clock did not. The setup sheet's Pressure option could still
start a run against five, ten or fifteen minutes and end it by the wall clock with lives left, which
is the one thing the thesis rules out in so many words (§43.4, §23.5(b)). The clock is gone end to
end: the run and timer fields, the expire command and event, the pause extension that shifted the
deadline, the HUD Clock stat, the polite countdown announcements, the countdown music layer and its
sampled cue, the timed-run identity, the gauntlet quest and the share-key variant. `GAME_RULES_VERSION`
is 36. The last run summary and the run history recorded the clock's length, so the save schema is 8
and the normalizer drops the field on load, one-way, with every record kept; a journal entry naming
the expire command fails its schema and is dropped. The save-field policy table is `save-178-v7`.

No balance constant changed. Every band, re-run on rules 36 with the Gen 177 sample sizes:

| | Gen 177 | Gen 178 |
|---|---|---|
| Fever share, clean / 10% miss / reference (`sim:cascade`, 48 seeds) | 0.46 / 0.37 / 0.20 | 0.48 / 0.35 / 0.20 |
| clean/reference Fever ratio | 2.30 | 2.40 |
| Turns to clear, clean / reference | 4.1 / 6.3 | 4.1 / 6.3 |
| Pop ladder spread (`sim:pop --check`) | 4.89 | 4.79 |
| Silent / thin / dominant systems (`sim:occupancy`) | 0 / 0 / 0 | 0 / 0 / 0 |
| `sim:endless --floors=200`, fairness and playable issues | 0 / 0 | 0 / 0 |

The rules-version bump alone moves the Fever shares by a few hundredths and the ladder by a tenth,
which is the seed noise Gen 177 measured; every band holds with the margin it was given.

## Gen 179: the tempered curve, the three authored floors, four traits

Phase 2 opens with the floor itself (thesis T2.1, T2.2, T2.11).

### The curve

`pairsForFloor(n) = clamp(round(3 + 2.6 * sqrt(n - 1)), 2, 24)` in `pair-curve.ts`, replacing
`level + 1`. Floors 1–6 deal 3, 6, 7, 8, 8, 9 pairs where they dealt 2–7; floor 12 deals 12 where it
dealt 13; floor 30 deals 17 where the old line had already hit its cap of 24. Larger early because a
two-pair board cannot pop and a three-pair board barely can; slower deep because interference makes
memory difficulty superlinear in board size (§23.3). The memorize window follows the same curve.

### The authored floors

Floors 1–3 are laid once, the same for everyone, with the symbols still dealt from the seed
(`authored-floors.ts`). Floor 1 is six tiles of one suit in a 3×2 grid, so any correct match pops
at least one other pair; floor 2 is six pairs in two solid clumps with one boundary line, so a break
stops at a colour; floor 3 is seven pairs with one pair split, its far half touching only the other
suit, so a Clean chain pulls a tile out of nowhere. `authored-floors.test.ts` drives the real break
rule over eight seeds and asserts the three teaching moments (N6, N7) and the board invariants
(N1, N2) on every one. Traits start on floor 4.

### The traits

The roster is the thesis's four: echo, heavy, conduit, stasis. Mirror, cursed, sealed, volatile and
drift go with their effects, copy, marks, colours, interaction tags, counters and simulation metrics
(§32.4's verdicts: a board that changes under the player's reading, a rule you must read, a stop).
The four surviving interaction tags are conduit's three and stasis's block; the effects engine's one
trait definition is now the conduit–echo peek. The interaction graph loses five nodes and fifteen
edges (version 32) and gains the two heavy–stasis synergies and a swap counterplay for the stasis
block. `ACH_TRAIT_SCHOLAR` asks for all four kinds; it asked for five of nine and was unreachable.

### The bands, on the new floors

`GAME_RULES_VERSION` is 37. Forty-eight seeds on the cascade as before:

| | Gen 178 | Gen 179 |
|---|---|---|
| Pairs per floor over floors 1–24, clean | 9.4 | **7.7** |
| Turns to clear, clean / reference | 4.1 / 6.3 | **3.6 / 5.2** |
| Fever share, clean / 10% miss / reference | 0.48 / 0.35 / 0.20 | **0.37 / 0.29 / 0.17** |
| clean/reference Fever ratio | 2.40 | 2.18 |
| Extreme Fever, clean / reference | 0.71 / 0.38 | 0.78 / 0.47 |
| Chunk share of score, clean | 0.31 | 0.30 |
| Pop ladder none / clean / sharp / fever | 1.98 / 3.31 / 3.63 / 6.77 | 1.95 / 3.27 / 3.57 / 7.06 |
| Pop ladder spread | 4.79 | **5.10** |
| Fever breaks on the census (15% miss, 160 floors) | 0.18 | **0.11** |
| Silent / thin / dominant systems | 0 / 0 / 0 | 0 / 0 / 0 |
| `sim:endless --floors=200`, fairness / playable issues | 0 / 0 | 0 / 0 |

Two things moved and both are the curve. Floors are smaller over the first twenty-four (7.7
pairs against 9.4) because the tempered line is below the linear one from floor seven on, and a
floor with fewer pairs has fewer matches to climb a ladder whose Fever rung is half the floor's
pairs: the clean player's Fever share reads 0.37 where it read 0.48, and the census at its 15%
miss rate reads 0.11 where it read 0.18, just over the `common` floor of 0.1. The separation the
band cares about holds at 2.18, the big-floor share holds at 0.35 against 0.3, and floors clear
faster with the same chunk share. This is §52's finding reproduced: Fever is rarer on small floors,
and the thesis's answer is to show the ladder before the player climbs it (option C), not to
lower the rung. The severance drop (T2.3) and multiplicative scoring (T2.5) are the next two
generations and both change what a floor is worth, so the Fever bands are re-read then rather
than moved now.

**One band recalibrated.** `POP_REACH_BANDS.ladderMinStep` 0.3 → 0.25: Sharp pays 0.30 over
Clean on the tempered curve where it paid 0.33 on the linear one. The early floors are bigger but
still one or two suits, so Clean's two waves sweep most of what Sharp's full reaction could reach;
the ladder still rises at every rung (spread 5.10, up from 4.79). The severance drop is the rung
that gives Sharp something back, and this band is re-read there.

## Gen 180: the severance drop

**A pair drops when its suit can no longer pop** (thesis §37.3, T2.3). A suit can pop while two
whole pairs of it sit within a chain-zero pop's reach of each other; when a match or a break
leaves a suit that fails that test, its plain pairs fall, at any tier. `suitCanStillPop` in
`chunk-break-rules.ts` is the test, and it is the pop rule's own reach, so it cannot drift from
the thing it derives from. That replaces Gen 137's remnant threshold (`DROP_MAX_PAIRS`: at Sharp or
better, two plain pairs or fewer left in the matched suit), which fired on 0.6% of floors because
a threshold on a remnant fires when a numeric accident occurs and cannot be aimed at.

### The distribution, and the cap (T2.4)

Measured before any cap, with the pop-reach simulation's new `drop` report over eight seeds and
twelve floors:

| | uncapped | capped at a two-pair remnant |
|---|---|---|
| Chain-one matches that dropped something | 0.284 | **0.250** |
| Pairs a drop takes | 1.44 | **1.20** |
| Drops by pairs taken | 1: 167 · 2: 41 · 3: 21 · 4: 7 | 1: 167 · 2: 41 |
| Floors a drop touched, census at 15% miss | 0.456 | **0.444** (24 floors: 0.508) |

One drop in eight took three or four pairs - F.7's own example, a clump that was cut off rather
than a remnant that was nearly gone. `SEVERANCE_DROP_MAX_PAIRS = 2`: a severed suit down to two
plain pairs falls; with more left it stands, and those pairs are matched from memory like any
other. Two is the remnant §41.2's last-pair problem is about. N8 asked for the drop on at least a
quarter of floors; it is on half.

### What the drop is worth to the chain

Dropped pairs feed momentum in full, as a later wave does. Measured the other way - the drop
feeding the ladder nothing, on the argument that structure giving way is not the chain's work -
Fever on the census fell from 0.11 to 0.05 of floors: a floor the drop clears faster leaves too
few matches to climb. The severance is aimable, and in Puzzle Bobble's economy what falls pays
more than what pops; the credit stays. The ladder itself is now read on the waves alone
(`sim:pop` subtracts dropped pairs), because the drop fires at every tier and was inflating the
chain-one rung by 0.4 pairs while adding nothing to the separation between rungs.

### The census horizon

The occupancy census plays twenty-four floors, matching `sim:cascade`, for the reason Gen 170 gave
when it moved from twelve to sixteen: on the tempered curve floors seven to sixteen are smaller
than the linear ones were, and the drop clears their tails, so sixteen was the shallow half again.
Fever read 0.094 at sixteen floors and 0.233 at twenty-four on the same code, against a `common`
floor of 0.1.

### The bands

| | Gen 179 | Gen 180 |
|---|---|---|
| Turns to clear, clean / reference (`sim:cascade`, 48 seeds) | 3.6 / 5.2 | **3.1 / 4.3** |
| Fever share, clean / 10% miss / reference | 0.37 / 0.29 / 0.17 | 0.38 / 0.32 / 0.19 |
| clean/reference Fever ratio | 2.18 | 2.00 |
| Extreme Fever, clean / reference | 0.78 / 0.47 | 0.78 / 0.50 |
| Chunk share of score, clean | 0.30 | 0.33 |
| Pop ladder none / clean / sharp / fever (waves only) | 1.95 / 3.27 / 3.57 / 7.06 | 1.95 / 3.27 / 3.56 / 7.05 |
| Drop: share of matches / pairs per drop / max | 0.006 of floors | **0.25 / 1.20 / 2** |
| Fever breaks on the census | 0.11 (16 floors) | **0.23** (24 floors) |
| Silent / thin / dominant systems | 0 / 0 / 0 | 0 / 0 / 0 |

A floor clears half a turn faster for everyone, because the last pairs of a severed suit no longer
have to be found by hand, and the chunk's share of score rises with the pairs it takes. The
clean/reference Fever ratio sits on its floor of 2: the drop is worth the same to a sloppy player
as to a clean one, which is the price of a rule that fires at chain zero, and the ladder above it
still separates. `ACH_NOTHING_HELD_IT`, unearnable since Gen 141, is earnable on most floors.

## Gen 181: multiplicative scoring, the floor par, the floor-end bonus

Thesis §40.2, §40.5 and §41.3, implemented as specified and then measured (`sim:cascade`, 48 seeds,
floors 1-24, three miss rates), with two constants set from the measurement rather than the page.

### The break's score

`chunkBreakScore = perPair × pairs × CHAIN_MULT[tier] × waveMult(waves)`, with `CHAIN_MULT` none 1,
Clean 2, Sharp 4, Fever 8 and `waveMult(w) = min(6, 1 + 0.75 (w - 1))`. The per-pair figure stays
derived from the base match score (`floor(match × 0.6)`), so a change to match scoring still
propagates. The size bonus (`6 × n × (n - 1)`), the Fever lift of 1.5 and the ripple lift of 0.2 a
wave capped at 2 are gone, not zeroed. A twelve-pair Fever reaction over seven waves is worth 528
chain-one pops; it was worth 27.

| Break | Old | New |
|---|---|---|
| A chain-one pop, one pair | perPair | perPair |
| Three pairs at Clean | 3 perPair + 36 | 6 perPair |
| Four pairs at Sharp, three waves | (4 perPair + 72) × 1.4 | 40 perPair |
| Twelve pairs at Fever, seven waves | (12 perPair + 792) × 1.5 × 2 | 528 perPair |

### The par

`parTurnsForFloor(pairs) = ceil(pairs × 0.4)`, not the thesis's 0.85. A turn is a pair of flips
resolved, match or miss (the gambit's three are one), counted on a new `turnsThisFloor` ledger the
run bar shows as `turns / par`. The thesis wrote 0.85 assuming a twelve-pair floor takes about ten
turns; measured, with every match popping, it takes 3.5 for a player who never misses and 4.6 for
one who misses a quarter of their flips, so a par of eleven was under on every floor at every miss
rate and said nothing. Per-floor means (clean / 25% miss): 8 pairs 3.0 / 4.5, 12 pairs 3.5 / 4.6,
15 pairs 3.9 / 5.2. At 0.4 a twelve-pair floor pars at five: the clean player is under par on 0.99
of floors, the reference player on 0.78, and that gap is what makes it a goal. Both are bands now.

The `flip_par` objective read the same par. It used to compare matches resolved to
`ceil(pairs × 1.25) + 2`, and a floor of N pairs cannot resolve more than N matches, so it had
never once been failed.

### The floor-end bonus

`100 × floor × {none 1, Clean 1.5, Sharp 2.5, Fever 5}[tier at clear] + 50 × floor × max(0, par - turns)`,
where the tier is the momentum still standing when the last pair went (the Extreme Fever reading,
which used to pay a shard and a name and now multiplies the clear). The flat 50 × floor and the
perfect clear's 25 are gone; a perfect floor is a rating, not a payment. `LevelResult` carries the
par, the turns, the play score, the bonus and its two terms, and the floor-clear dialog says
`Floor 12 · 4 turns, par 5` and `Floor bonus +6,600: Fever ×5 · 1 under par +600.`

Measured, the bonus is a multiple of the floor's play on most floors: at floor 12 the play (matches
and breaks) pays about 1,500 and a Fever clear 6,000 plus efficiency. That is the thesis's own
proportion - its worked table puts a floor-12 Fever clear (6,000) beside a huge Fever reaction
(5,280) - but our real breaks are smaller than its examples (the largest break on a clean floor 12
is about 700), so the ceremony pays eight times the best thing that happened rather than about the
same. Recorded here, not changed: Phase 3's scoring re-read (§40.4, the score built term by term)
is where the proportion gets looked at with the presentation in place. The score shares below are
read against the play score for that reason; against the total they measure the bonus.

### The bands

| | Gen 180 | Gen 181 |
|---|---|---|
| Chunk share of play score, clean | 0.33 (of level score) | **0.71** |
| Largest break's share of play score, clean (N5, 0.25-0.70) | - | **0.50** |
| Under par, clean / reference | - | **0.99 / 0.78** |
| Turns to clear, clean / reference | 3.1 / 4.3 | 3.1 / 4.2 |
| Fever share, clean / reference | 0.38 / 0.19 | 0.33 / 0.19 |
| clean/reference Fever ratio | 2.00 | **1.70** |
| Extreme Fever, clean / reference | 0.78 / 0.50 | 0.78 / 0.52 |

`cleanChunkShareOfScore` moves from 0.08-0.4 to 0.5-0.85: the break is the score now, by design,
and N5 is the band that keeps the small ones from being decoration.

The score milestones are a new record season, as the design doc said a new scoring regime would
be: Gold Mind moves from 1,000 to 10,000 and Vault Mind from 10,000 to 100,000. A clean player
banks a thousand by floor two now and ten thousand by about floor seven; a hundred thousand is
floor fifteen or so for the clean player and later for the reference one. The ids stay, because
they are Steam API names.

Two bands moved for a reason that is not this generation's. Scoring cannot touch the ladder, yet
the clean/reference Fever ratio fell 2.00 → 1.70 and Extreme Fever's 1.56 → 1.49. The rules version
went 37 → 38, which re-deals every seed's board, and that alone is the movement:

| | 48 seeds v37 | 48 seeds v38 | 96 seeds v37 | 96 seeds v38 |
|---|---|---|---|---|
| Fever clean / reference | 0.364 / 0.187 | 0.327 / 0.193 | 0.368 / 0.190 | 0.349 / 0.199 |
| ratio | 1.95 | 1.70 | 1.94 | 1.75 |
| Extreme Fever ratio | 1.55 | 1.49 | 1.53 | 1.48 |

Forty-eight seeds settle the reference player's share (Gen 177's finding still holds: 0.19-0.20
everywhere) but not the ratio of two shares, and doubling the seeds does not close the gap between
versions. A version's boards are one draw, and a band at 2 or 1.5 sat inside the spread between
two draws of the same rules. `feverCleanOverReference` moves 2 → 1.5 and
`extremeFeverCleanOverReference` 1.5 → 1.3, under the worse draw with the margin the old floors had
over the better one. What the bands are for - the clean player reaches Fever and finishes at it
markedly more often than the sloppy one - holds on both draws; a ratio near 1 is the failure they
exist to catch.

## Gen 183: lives out, the turn ceiling in

Thesis §42.2 and §67. There are no lives. A run ends when the player stops, when a contract's
mismatch limit is passed, when a shared game's last floor is done, or when a floor is not cleared
within its turn ceiling, `parTurnsForFloor(pairs) × 3`. A miss is still a try against the rating
and a turn against the par, and it still drops the chain's momentum; it costs nothing else.

### What went with the lives

Lives (4 to start, 5 at most), the life lost on a miss, the first-mismatch grace, guard tokens
(one every fourth chain step, two at most, spent on a miss or on the magpie), the chain heal (a
life every eighth step), three combo shards for a life, the clean and perfect clear's life, the
memorize time banked for a lost life, and the score parasite - a mutator that ate a life every
four floors and did nothing else. The magpie cannot be scared off any more; the off-duty guard
lends a peek instead of a token. Combo shards stay one more generation, banked to their cap and
buying nothing, so this diff reads; Gen 184 takes them. The history is in
`docs/REMOVED_LIVES.md`.

### The ceiling, measured

`sim:cascade`, 48 seeds, floors 1-24, the share of floors the ceiling ended:

| Miss rate | Cleared | Ceiling | Turns to clear | Under par |
|---|---|---|---|---|
| 0 | 1.000 | 0.000 | 3.1 | 0.99 |
| 0.10 | 1.000 | 0.000 | 3.5 | 0.93 |
| 0.25 (reference) | 1.000 | 0.000 | 4.2 | 0.77 |
| 0.40 | 0.996 | 0.004 | 5.6 | 0.57 |
| 0.50 | 0.971 | 0.029 | 6.6 | 0.45 |
| 0.60 | 0.914 | 0.086 | 8.3 | 0.31 |
| 0.70 | 0.764 | 0.236 | 10.0 | 0.23 |

The reference player never meets it, and a player missing half their flips meets it on three
floors in a hundred: a floor under competence, as the thesis asked, not a gate. It is a band now
(`referenceCeilingShare`, max 0.02). The reference player's cleared share moved 0.99 → 1.00 - the
one floor in a hundred they used to die on was a life lost to a miss, and there is no such floor.

Every other band is where Gen 181 left it, within the deal's noise: rules version 38 → 39 re-deals
the boards (Fever clean 0.35 / reference 0.21, ratio 1.67; Extreme Fever 0.79 / 0.54; chunk share
0.70; largest break 0.49; under par 0.99 / 0.77).

## Gen 184: combo shards out

Thesis §44.4 and §40. The combo shard was the life economy's bank and, after Gen 183, a number that
filled to two on the first chain and never moved. It is gone: from the streak, the chunk break, the
Extreme Fever finish and the board, where the **Shard Spark** findable went with it and the Score
Glint takes the whole spawn roll. `GAME_RULES_VERSION` 39 → 40 for the changed roll. The record is in
`docs/REMOVED_LIVES.md`.

### The findable census

`sim:occupancy --ratchet`, 240 floors, the reward row before and after:

| | Floors with a claim | Claims a floor |
|---|---|---|
| Gen 183 (two kinds, 50/50) | 1.000 | 1.54 |
| Gen 184 (one kind) | 1.000 | 1.54 |

Unmoved, as expected: the number of findable pairs a floor deals is decided before the kind roll, and
every claim pays score now rather than half of them paying a shard.

### The bands

`sim:cascade --check`, 48 seeds, after: clean player Fever 0.34 / reference 0.20 (ratio 1.70), Extreme
Fever 0.78 / 0.52, chunk share 0.70, largest break 0.49, under par 0.99 / 0.75, ceiling 0.000 at every
miss rate the bands watch. `sim:pop --check` and `sim:endless --check` pass. The rules-version re-deal
moves the reference player's Fever share 0.21 → 0.20 and under-par share 0.77 → 0.75, inside the
noise Gen 181 measured for a re-deal; nothing was retuned.

## Gen 186: what a rung is worth, measured and shown

Thesis §30.3(a). The chain meter said where the player stood on the ladder and never what standing
there bought, so the pairs a rung takes are now a cluster of pips beside the tier - one per pair -
and the whole ladder sits in the hover hint and the meter's accessible label.

### The ladder, re-measured

`simulatePopReach()`, eight seeds, twelve levels, each tier measured at its own rung:

| Rung | Pairs a break takes | Step over the rung below |
|---|---|---|
| A lone match | 1.91 | — |
| Clean | 3.19 | 1.28 |
| Sharp | 3.50 | **0.32** |
| Fever | 6.95 | 3.44 |

Spread 5.04 against a band floor of 2.2, so the climb as a whole is worth making. The constants the
HUD draws (2 / 3 / 4 / 7) are pinned to this measurement by `chain-rung-value-rules.test.ts`, which
re-runs the simulation and fails if a rung walks more than 0.6 of a pair away from what it promises.
A meter that says three pairs while the rule pays one is worse than a meter that says nothing.

### The finding: the middle rung is thin again — **corrected at Gen 189, see below**

**Sharp pays 0.32 pairs over Clean.** The band floor is 0.25, so this passes, but it is the same
failure Gen 168 existed to fix: measured then at 0.01, repaired to 0.39, and the Phase 1 and 2 board
changes have walked it back to 0.32. Clean's partner reach already sweeps most of what Sharp's
unbounded reaction could find, and the floors are bigger now, which helps Clean more than Sharp.

The pips make it visible for the first time - the cluster barely changes when a player reaches Sharp
- which is the honest outcome of putting a number on an interface: it showed the design something it
had been hiding from itself. Not retuned here, because an interface generation is the wrong place to
move a rule: it has its own task.

## Gen 189: the ladder was not thin, the measurement was

Gen 186 put the pairs a rung takes on the HUD and reported Sharp finding 0.32 of a pair more than
Clean, against a band floor of 0.25 - the same failure Gen 168 existed to repair. That finding was
measured on the wrong quantity, and this generation says so rather than acting on it.

**Pairs are the ladder's input. Score is its payoff.** The tier multiplies what a break finds
(`CHAIN_MULT` = ×1 / ×2 / ×4 / ×8), so a rung that finds barely more pairs still pays twice as much
for every pair it finds. Measured both ways over eight seeds and twelve levels:

| Rung | Pairs a break takes | Step in pairs | Score a break pays | Step in score |
|---|---|---|---|---|
| A lone match | 1.91 | — | 70 | — |
| Clean | 3.19 | 1.28 | 226 | **×3.24** |
| Sharp | 3.50 | **0.32** | 506 | **×2.24** |
| Fever | 6.95 | 3.44 | 2036 | **×4.02** |

Every rung more than doubles what the rung below pays. The ladder is healthy; the pair column is
what made it look otherwise, and Gen 186's pips inherited that. `scorePerMatch` and `scoreStep` are
now in the pop simulation's report and banded (`ladderScoreMinStep`, min 1.8×), so from here the
thing that is guarded is the thing the player feels. The pairs band stays as a secondary guard: it
caught a real failure at Gen 168, when a rung bought literally nothing.

### The reach experiment, and why it was rejected

Before measuring the payoff I tried to widen Sharp's step by shrinking the rungs below it, since the
pop had grown fat (1.18 pairs at Gen 168, 1.91 now). Measured, with the wave's reach as a per-tier
record and the drop's reach decoupled from it:

| Reach (pop / Clean) | Pairs ladder | Sharp's step | Verdict |
|---|---|---|---|
| 2 / 2 (shipped) | 1.91 / 3.19 / 3.50 / 6.95 | 0.32 | — |
| 1 / 1 | 0.63 / 2.43 / 3.50 / 6.95 | **1.07** | **rejected** |
| 1 / 2 | 0.63 / 3.19 / 3.50 / 6.95 | 0.32 | no gain |
| 1 / 3 | 0.63 / 3.35 / 3.50 / 6.95 | 0.15 | worse |
| 2 / ∞, partner at Sharp | 1.91 / 2.95 / 3.50 / 6.95 | 0.56 | breaks floor 3 |
| 2 / 2, partner at Sharp | 1.91 / **1.91** / 3.50 / 6.95 | 1.60 | Clean buys nothing |

Reach 1 gives much the best pair ladder and fails twice over: a player missing a quarter of their
flips reaches Fever on **0.326** of floors against a band of 0.22, because a weaker pop means more
matches per floor and the Fever rung is a share of the floor's pairs - so shrinking the pop hands
Fever to everyone and destroys the clean-over-reference separation the tier exists to create. It
also breaks all three authored floors: floor 1's guarantee is that on a 3×2 no cell is further than
the pop's reach from the nearer half of any pair, and at reach 1 a deal exists where the first match
pops nothing, which is the one thing §51 authored those floors to prevent.

The last row is the useful one for whoever tunes this next: with the partner reach moved off Clean,
Clean buys **exactly nothing** over a lone match. Clean's entire value is the partner reach, and
Sharp's problem is that a reach-2 region on a six-pair suit is already most of the suit. Making
Sharp find more pairs means changing the *boards* - suits that spread past reach 2 - not the reach.
Nothing was retuned: the rules are as they shipped, and `BREAK_CLUMP_REACH` / `BREAK_PARTNER_REACH`
are now records so the next attempt is a one-line change with the numbers above to check it against.

## Gen 190: the settle — the board packs toward the middle

Every card a match or a break takes now leaves the board, and the cards left behind fall in toward
the centre to close the gap (`board-settle-rules.ts`, wired into the turn at
`turn-match-board-resolution-rules.ts`). The rule is one move repeated: take the closest gap-and-card
pair on the board and put the card in the gap, where a card may only ever move to a cell nearer the
middle than the one it is in. Because the pair is chosen globally, a card moves as short a distance
as the settle allows and the gap walks outward, rather than one card being flung across the grid.

Measured over the same forty-eight seeds the cascade simulation always uses, with everything else
held still:

| Reference player | Turns a floor takes | Pairs a floor pays | Fever share | Score | Ripple mean | Breaks that rippled |
|---|---|---|---|---|---|---|
| No settle, miss 0 | 3.1 | 8.13 | 0.37 | 9668 | 1.08 | 0.07 |
| Settle, miss 0 | 3.0 | 8.19 | 0.34 | 9608 | **1.00** | **0.00** |
| No settle, miss 0.25 | 4.3 | 7.92 | 0.20 | 7436 | 1.06 | 0.06 |
| Settle, miss 0.25 | 4.1 | 8.08 | 0.19 | 7480 | **1.00** | **0.00** |

Every band still holds and `yarn sim:cascade --check` passes. The occupancy census moves the same
way: the drop's share of floors falls from 0.442 to 0.388 and matches per floor from 3.18 to 3.04,
both inside their bands.

**The finding, recorded because it is a regression and not a win.** The ripple stops firing. It was
already marginal - 7% of breaks reached a second wave before the settle - and the settle takes it to
zero. The cause is not that reactions got smaller: `largest` is 0.49 either way and pairs per floor
went *up*. A packed board simply makes the first wave's clump big enough to swallow the partners
that used to seed the second, so the ripple's work moved into wave 0 where it has no name and no
beat. The player loses the "Ripple ×N" line, not the payout.

The fix is the one the Gen 189 note already pointed at from the other direction: the boards are too
small and carry too few suits for any of this to have room. A floor is **three turns long** and
shows **two suits** up to floor 12 (`yarn sim:pop`), so the whole screen clears in two goes and no
reaction ever needs a second wave. Gen 191 widens the palette and the pair curve, and the ripple is
the number to re-measure there.

## Gen 191: the boards grew, and the palette grew with them

Gen 190's note ended by naming the reason the ripple had nowhere to fire: a floor was three turns
long and showed two suits until floor twenty, so the whole screen went in two goes and no reaction
ever needed a second wave. This generation is that repair. Three constants moved, and the third
moved because the first two did.

### The pair curve, anchored to the authored floors

`pairsForFloor` used to be one square-root curve over every floor, which quietly collided with the
three authored teaching floors: a layout the deal cannot fill is abandoned for the ordinary deal
with nothing failing, so a curve that stopped returning 3, 6 and 7 would have turned floors 1 to 3
off in silence. The curve now returns the authored sizes for those floors by name and takes over
from floor 4, anchored on the last of them. `pair-curve.test.ts` fails if the two ever disagree.

| Floor | 4 | 6 | 8 | 12 | 20 | 30 | 50 |
|---|---|---|---|---|---|---|---|
| Was | 8 | 9 | 10 | 12 | 14 | 17 | 21 |
| Now | 9 | 11 | 12 | 14 | 17 | 19 | 23 |

### The palette, one suit per four pairs instead of six

With bigger boards a suit can be one in four rather than one in six and still hold about as many
pairs as it did. A floor now reaches three suits at floor 5 and four by floor 11, against two suits
until floor twenty.

The cost is real and it is not evenly spread. A **scattered** floor - a rush, speed or trap floor -
has no regions by construction, and every suit added to one thins what is left until a match
touches nothing of its own kind: measured, a third suit takes a scattered floor's pop rate from
about 0.7 of matches to **0.36**, which is exactly the failure Gen 148 existed to fix. So the
palette is now capped by how a floor deals: a scattered floor keeps two suits however big it is,
a spotlight floor keeps its two by definition, and a clumped floor grows. With that cap the worst
floor in the first twelve pops on 0.63 of matches, unchanged from before this generation.

### The tier shares, 0.45 and 0.6

Momentum counts the pairs a break took as well as the matches made, so it climbs faster on a bigger
board than the pair count it is measured against. On the new curve a reference player reached Fever
on 0.32 of floors against a band of 0.22 - Fever stops being a thing you reach and becomes a thing
that happens. Raising the shares from 0.4 and 0.5 corrects it without touching the reaction itself.

| Reference player (misses a quarter) | Turns | Pairs a floor | Fever share | Score |
|---|---|---|---|---|
| Gen 190 | 4.1 | 8.08 | 0.19 | 7480 |
| Gen 191, shares unchanged | 5.5 | 9.37 | 0.35 | 7755 |
| Gen 191, shares raised | 5.4 | 9.26 | **0.18** | 6796 |

A clean player reaches Fever on 0.45 of floors, so the separation is 2.5 against a band of 1.5.

### What it bought, and what it did not

The ladder got deeper, which is the thing Gen 189's reach experiment concluded could only be bought
by changing the boards:

| Rung | Pairs, Gen 190 | Pairs, Gen 191 | Score step, Gen 190 | Score step, Gen 191 |
|---|---|---|---|---|
| A lone match | 1.91 | 1.76 | — | — |
| Clean | 3.19 | 2.97 | ×3.24 | ×3.35 |
| Sharp | 3.50 | 3.47 | ×2.24 | **×2.52** |
| Fever | 6.95 | 7.84 | ×4.02 | **×4.73** |

Sharp's step over Clean in pairs goes 0.32 to 0.50, the spread from a lone match to Fever 5.04 to
6.08, and every rung's score step is more even than it was. A floor now takes 5.4 turns for the
reference player against 4.1, which is the "two goes and the screen is gone" complaint answered.

**The ripple is still not back.** It reads 0.02 of breaks at zero misses and 0.00 at the reference
rate, against 0.07 before the settle. Bigger boards moved it from nothing to nearly nothing, and
that is as far as board size can carry it: the cause is a rule, not a size. A Sharp or Fever break
has unbounded reach, so it takes the whole suit in the first wave and leaves nothing for a second;
the ripple only ever lived at Clean, where the reach is bounded, and a packed board puts Clean's
partners inside the clump the first wave already took. Making the ripple fire again means changing
what a wave is allowed to take, which is its own generation and its own risk. Recorded here rather
than quietly left as a number nobody looks at.

## Gen 192: the settle out, and the ripple back on its own

The settle went, on the player's call, for the reason no measurement was going to argue with: a
memory game may not move a card the player has learned. `docs/REMOVED_SETTLE.md` keeps the whole
record. Cleared cards still leave the board; the holes they leave now stay.

The interesting part is what the measurement said afterwards. Two generations had been spent
chasing the ripple - Gen 190 recorded it dying, Gen 191 widened the boards and the palette partly to
revive it and got it back only to 0.02, and a task was filed to change what a wave is allowed to
take. Removing the settle answered all of it at once:

| | Ripple mean | Breaks that rippled | Drop, share of floors | Turns a floor takes |
|---|---|---|---|---|
| Before the settle (Gen 189 boards) | 1.08 | 0.07 | 0.442 | 4.3 |
| With the settle (Gen 190) | 1.00 | 0.00 | 0.388 | 4.1 |
| With it, on the wider boards (Gen 191) | 1.02 | 0.02 | 0.463 | 5.4 |
| **Without it, on the wider boards** | **1.16** | **0.16** | **0.588** | **5.7** |

The ripple is not merely restored, it is healthier than it has ever been: 0.16 of breaks reach a
second wave at zero misses and 0.07 at the reference miss rate, against 0.07 and roughly nothing
before any of this. The severance drop moved the same way, from 0.463 of floors to 0.588. Both had
the same cause, and it was not the reach or the board size: a packed board lets the first wave
swallow the partners and the orphans that the second wave and the drop existed to find.

The finding worth keeping is procedural. Gen 191 was a real improvement on its own terms - the pair
curve and the palette both stand - but it was reached for partly as a repair for a number that a
different change had broken, and it could not have fixed it. When a metric falls the generation a
mechanic lands, suspect the mechanic before tuning around it.

### One band re-tuned

`CHAIN_TIER_FEVER_SHARE` goes 0.6 to 0.62. Longer floors mean more matches and more momentum, so
with the settle out the reference player landed on 0.22 of floors reaching Fever against a band
whose ceiling is exactly 0.22 - passing, with no margin for the next change. At 0.62 that reads
0.17, with a clean player at 0.44, so the separation is 2.6 against a band of 1.5.

`CHAIN_TIER_SHARP_SHARE` stays at 0.45. The ladder is unchanged in shape: 1.74 / 3.00 / 3.40 / 7.88
pairs per rung, paying x3.33 / x2.37 / x4.84.

## Gen 193: two suits on the first board, three on the second

The first three floors are authored, and they were dealing one suit, then two, then two. A board of
one colour is not a board with a map on it, it is a field, and the palette then sat at two until the
procedural floors caught up. This generation opens them.

| Floor | 1 | 2 | 3 | 4 | 6 | 10 |
|---|---|---|---|---|---|---|
| Suits, was | 1 | 2 | 2 | 2 | 3 | 3 |
| Suits, now | **2** | **3** | **3** | **3** | 3 | 4 |
| Pairs, was | 3 | 6 | 7 | 9 | 11 | 13 |
| Pairs, now | **4** | 6 | 7 | 9 | 11 | 13 |

### Floor 1 needed a fourth pair, and the reason is the cursed pair

Two suits over three pairs is 2 and 1, and a suit of one pair cannot pop at all - the pop needs two
whole pairs of a suit within reach of each other. Four pairs gives two suits of two, laid as two
solid 2×2 blocks on a 4×2 grid, where every cell of a suit is within `BOUNDED_BREAK_REACH` of every
other. So whatever the player matches first, the suit's other pair pops, and it visibly stops at the
colour boundary - the pop and the boundary taught on one board instead of two.

That still failed on measurement, and the cause is worth recording: **an authored floor was taking
an incidental cursed pair**, and a break never takes the cursed pair. A suit of two pairs whose other
pair is cursed pops nothing, whatever the layout promised. The guarantee those three boards exist to
make was being cancelled silently on any seed that put the cursed pair on floor 1.

Authored floors now take no incidental cursed pair. One asked for by the floor's own objective is
still honoured, because that is content the player was told about; the schedule never puts a cursed
objective on floors 1 to 3 in any case. This is the same rule the authored floors already applied to
traits, which start on floor 4.

Floor 2 is three bands of four on a 4×3 grid, two pairs to a band: a row of four holds any two pairs
within reach of each other however the seed lays them, so every band pops from any of its pairs, and
three bands make the boundary a rule rather than the coincidence of one line. Floor 3 keeps its seven
pairs and its split pair and moves to a 5×3 grid with three suits.

### The palette rounds up now, so it never goes backwards

With rounding-to-nearest, floor 4's nine pairs asked for two suits - the palette narrowing the moment
the tutorial ended, which is the opposite of what the player has just been taught to read. Rounding
the ratio up instead gives floor 4 three suits and floor 10 all four, and the count never decreases
as the boards grow.

### What it cost

| | Lone match, pairs | Sharp step | Spread | Score rungs | Ripple | Fever, reference |
|---|---|---|---|---|---|---|
| Gen 192 | 1.74 | 0.40 | 6.13 | ×3.33 / ×2.37 / ×4.84 | 0.16 | 0.17 |
| Gen 193 | 1.47 | 0.43 | 6.08 | ×3.42 / ×2.47 / ×5.10 | 0.14 | 0.18 |

The ladder is unchanged in shape and slightly more even in score. The real cost is the pop rate on
the early procedural floors: floors 4 to 6 fall from about 0.95 of matches popping to about 0.76,
because three suits over nine to eleven pairs is three pairs to a suit and a three-pair region does
not always hold two whole pairs within reach. Every band still passes, and the scattered-floor cap
from Gen 191 keeps the worst floors where they were. It is the price of the palette and it is worth
watching: if it drops further, the lever is the pair curve, not the palette.

## Gen 196 — the decoy left, and nothing moved

The `glass_floor` mutator, the `__decoy__` card and the `glass_witness` objective all went, along
with the `__exit__` pair key that had outlived the exit card by twenty generations. The full record
is in [`REMOVED_DECOY.md`](./REMOVED_DECOY.md); this is the measurement.

| | Lone match, pairs | Sharp step | Spread | Score rungs | Ripple | Fever, reference | Occupancy |
|---|---|---|---|---|---|---|---|
| Gen 195 | 1.46 | 0.44 | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.44 | 11 counters, baseline |
| Gen 196 | 1.46 | 0.44 | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.44 | 11 counters, unchanged |

Every number is identical to four significant figures, which is the correct result and worth saying
out loud rather than skipping past. The decoy was an *extra* card, dealt on top of the pair budget,
on two floors of a twelve-floor cycle. It never entered a clump, never popped, never rippled, never
dropped, and never appeared in a chain-tier calculation. Taking it away therefore moves nothing the
cascade measures.

That is the whole indictment. A mechanic that costs nothing to remove was, by the same arithmetic,
contributing nothing — and it was doing that while occupying a Codex entry, a mutator slot, an
objective slot, two `RunState` fields, a fairness issue code, a renderer prop chain through five
components, and a corner ring in the WebGL board. The Gen 194 accountability audit exists to find
exactly this shape: a mechanic on the board with no counter answering for it. The decoy was on the
exemption list, and the honest resolution of an exemption is sometimes deletion rather than
instrumentation.

Two lines did change, and both are administrative rather than behavioural: `MUTATOR_CATALOG` is 10
entries rather than 11, and `SINGLETON_UTILITY_PAIR_KEYS` holds one key rather than two.
`tile-identity.test.ts` now pins that count, so the next singleton anyone adds has to argue for
itself against the rule the removal doc states: **every card on the board has a partner**, and the
wild joker's exception is one that makes the player's read worth *more*, not worthless.

## Gen 197 — contact, not distance

The pop stopped reaching cards it was not touching. `docs/BREAK_TOUCHES_ONLY.md` is the full record:
what was measured, why the partner reach and the halo went, and what replaced them. This is the
balance side of it.

| | Lone match | Clean | Sharp | Fever | Spread | Score rungs | Rippled | Severance floors |
|---|---|---|---|---|---|---|---|---|
| Gen 196 | 1.46 | 2.62 (+1.16) | 3.05 (+0.43) | 7.59 (+4.54) | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.583 |
| Gen 197 | 1.46 | 2.10 (+0.65) | 5.79 (+3.69) | 8.46 (+2.67) | 7.00 | ×2.89 / ×8.99 / ×2.81 | 0.25 | 0.779 |

Every band passes. Three readings worth keeping.

**The middle rung got thicker, not thinner.** The whole risk of this change was that removing the two
long-range rules would flatten the ladder, and the first measurement said exactly that: bounded to
one suit clump the rungs paid 1.46 / 2.10 / 2.20 / 2.66, Sharp worth **0.10 pairs** over Clean. The
fix was not to give the reach back but to find a lever that stays inside the rule — the **bridge**,
which spreads the wave into a clump the broken cards were in contact with. With it Sharp pays 3.69
over Clean, against the 0.43 it paid before the change. `CHAIN_RUNG_PAIRS` moved from `{1, 3, 3, 8}`
to `{1, 2, 6, 8}`; Clean and Sharp stopped rounding to the same number for the first time since
Gen 186.

**The score rungs got less even while the pair rungs got more even.** ×2.89 / ×8.99 / ×2.81 against
×3.56 / ×2.49 / ×5.11. Sharp is now the loud step in both currencies, which is defensible — it is the
rung where a break stops being one clump and becomes two, and that is a thing a player can see happen.
It is worth watching rather than tuning immediately: the pair ladder is what the aim guide previews,
and it now reads 1 / 3 / 5 / 7 on the reference fixture, two pairs a rung, which is the cleanest that
ghost has ever been.

**The severance drop is doing a lot more work**: 0.583 → 0.779 of floors. That is the direct
consequence of a pop that only takes what it touches — more suits end up stranded, and the drop is
the rule that clears a stranded suit. It is inside its band. If it climbs much further it stops being
a surprise and becomes a second, quieter pop, and the lever is `SEVERANCE_DROP_MAX_PAIRS`, not the
break reach.

The bridge also had to be capped, and the measurement is the argument: uncounted, a Sharp break took
**8.26** pairs against Clean's 2.10, because a clump touches several others at once and the fire ran
until the floor was gone. One clump at Sharp, three at Fever, and the bridge fires on one wave only.

## Gen 198 — the deal did not feel random, and the measurement agreed

> "the algorithm for spawning needs to mesh all the cards together. It doesnt feel random. We get a
> bunch of cards spawning next to eachother that are matching etc."

Measured before touching anything, over six seeds × twenty floors (1512 pairs): **0.228 of pairs
landed with their two halves orthogonally touching**, and a further **0.144 at a corner**. More than
a third of every floor's pairs sat beside their own twin.

The interesting part is that this is roughly what *chance* gives. On a board of twenty cells a given
cell has about four of the other nineteen as orthogonal neighbours, so a shuffle lands a pair's
halves adjacent about one time in five on its own. The deal was not biased; it was uniform, and
uniform is the problem. A memory game whose boards hand the player one free pair in five reads as
arranged rather than random, because they keep finding pairs they never had to remember — and the
lesson generalises: **in a game about remembering where things are, a uniform shuffle is not neutral,
it is generous.**

The fix is in the last step of `dealTilesInClumps`, which used to shuffle a suit's tiles into that
suit's cells. It now lays whole pairs first, drawing the second half at random from every cell at
least `PAIR_HALF_SEPARATION` (3) grid steps from the first, then a repair sweep of swaps for pairs
that a greedy placement painted into a corner. It is a floor with a random draw above it, not a
target: the halves end up as far apart as the board happens to put them.

| | Mean distance between halves | Touching | At a corner | Either |
|---|---|---|---|---|
| Gen 197 | 3.02 | 0.228 | 0.144 | 0.372 |
| Gen 198 | 3.60 | **0.053** | 0.104 | **0.157** |

**The residual is structural and worth stating rather than chasing.** Four suits over twenty cells
gives each suit about five cells, dealt as a clump — and a tight clump's own diameter is often two,
so a pair inside it *cannot* be three apart. The suit clumping is what the pop needs; the separation
is what the memory needs; on a small board they genuinely compete. The rule takes the farthest cell
available rather than refusing to place a tile, and `tile-suit-rules.test.ts` ratchets both rates so
a regression cannot creep back.

Two side effects, both in the game's favour:

| | Lone match | Clean | Sharp | Fever | Severance floors |
|---|---|---|---|---|---|
| Gen 197 | 1.46 | 2.10 | 5.79 | 8.46 | 0.779 |
| Gen 198 | 1.70 | 2.17 | 5.91 | 8.74 | 0.667 |

**A chain-one pop got bigger, not smaller** — 1.46 to 1.70 pairs. Spreading a pair's halves through
its suit's clump puts more *whole* pairs inside any given wave, which is exactly what the contact
rule needs. And the severance drop fell back from 0.779 to 0.667 of floors, because a pop that takes
more whole pairs strands fewer suits.

The one cost is on the meter's hover sentence. `CHAIN_RUNG_PAIRS` re-baselined to `{2, 2, 6, 9}`, so
the bottom two rungs now round to the same number of pairs. That is the case Gen 189 already ruled
on — the meter shows the **multiplier**, precisely because pairs alone can read flat while the payoff
doubles — and the rung test now asserts the strict climb on the multiplier and allows one level step
in pairs.

## Gen 200 — the two dead powers, and what their absence moved

Rules version 47 → 48. This entry records the measurements the removal changed, not the argument
for the removal itself; that lives in [REMOVED_POWERS.md](./REMOVED_POWERS.md).

**The wild joker re-banded from `common` to `core`.** The occupancy census bands each system by how
much of the game it occupies: `core` wants 0.9 or more of the floors it can act on, `common` wants
0.1 to 0.9. The wild joker had been sitting in `common`, and after Gen 200 it reads **1.000** on the
setup pass — the census failed with "wildMatch is now dominant and is not in the baseline".

That is not a regression to tune away. Stray was the only thing in the game that could take the
joker off the board before it was spent, because after Gen 196 the joker was Stray's only legal
target. Remove Stray and a run that holds the token spends it on every single floor. The band moved
to match the measurement, which is the direction that rule is supposed to travel.

**Counterplay edges: floor 14 → 11.** Both powers were the graph's named answer to other mechanics,
so pulling them pulled the edges pointing at them. Re-baselined against the graph rather than
propped up; a counterplay edge to a power nobody can press was never counterplay.

**The census now reads 30 of 41 mechanics, not 30 of 45.** The four that left were Destroy, its
charge, Stray and its charge. Two of them carried UNREACHABLE exemption lines — the census's way of
recording that no code path in the game could reach them — and those lines are gone with the
mechanics. The coverage ratio improved by deleting the debt rather than covering it, which is worth
saying out loud so the number is not read as progress on instrumentation.

**Nothing moved in the cascade.** `sim:cascade`, `sim:pop` and `sim:endless` are unchanged: neither
power was reachable in a plain endless run, so neither had ever appeared in those numbers. The
absence of movement here is itself the confirmation that Destroy was dead code and Stray was a
setup-only button.

## Gen 201 — every system read back against the game that exists

Not a balance change so much as a truth pass, so the numbers below are the ones that moved and the
rest of the entry is what was found. The method: take each system in turn, read what it *claims* —
in its band, in its Codex entry, in the sentence a player reads mid-run — and check the claim
against the code that runs.

### The tools' occupancy numbers were measuring the census

Three of them read exactly `1.000 x 1.00` on every floor of every seed. That is not a measurement,
it is a construction: the setup-pass census player pressed the pin, the swap and the flash on floor
open, unconditionally, before a card had been turned. All three were then banded `core` — a claim
that the game does this on nearly every floor, which nothing had ever checked.

Each is now reached for when the board gives it the reason the tool exists for, and the share falls
where it falls:

| Tool | Reason it is now pressed | Before | After | Band |
|---|---|---|---|---|
| Pin | a miss happened; there is a seen card to hold | 1.000 (constructed) | **0.158** | core → common |
| Flash pair | a miss happened; the floor gave nothing up | 1.000 (constructed) | **0.158** | core → common |
| Tile swap | a pair's halves are dealt not touching | 1.000 (constructed) | **0.988** | core (now earned) |
| Peek | an unrevealed card exists at floor open | 1.000 | 1.000 | core (already honest) |
| Wild joker | the joker always has a partner | 1.000 | 1.000 | core (already honest) |

0.158 is the reference miss rate, and that is the right shape: the pin and the flash both answer
going wrong, so they happen about as often as going wrong. The swap staying `core` is now a fact
about the deal rather than about the script — Gen 198's separation rule is what puts a non-touching
pair on nearly every board.

The rule is written into `SYSTEM_OCCUPANCY_COUNTERS` so the next counter added has to face it: **a
counter the census presses unconditionally measures the census.**

### The in-run coaching taught a game removed twenty-five generations ago

`getFloorIdentityContract` is four sentences a player reads on the floor they are standing on. Its
seven branches named trap bounties and clean disarms, the Trap Workshop and the Rune Seal, keys and
locks and cache extraction, guard and scout value, the parasite clock, boss blockers and finding
the exit. Every one of those left with the dungeon layer, the hazards, the lives and the exits.

A floor archetype now decides exactly one thing — how the deal lays the suits out, `clumped`,
`scattered` or `two_suit` — and that is what decides how far a pop reaches. So the coaching says
that instead. A scattered floor tells you a swap is worth more there than anywhere else; a
two-suit floor tells you it is where the deepest chains of the run live; a breather tells you it is
the cheapest place to spend a charge.

The boss identity was worse than stale: it promised `+2 Favor` (a currency removed in Gen 175) and
a "Keystone Pair board anchor" that appears nowhere in the game — no field, no rule, no generator —
in a string shown in the HUD title.

Why it rotted: `FloorArchetypeId` was a bare type union, so nothing could enumerate the archetypes
at runtime and the table's tests only ever sampled five of its branches. It is now
`FLOOR_ARCHETYPE_IDS`, a list, and the test walks all 100 floor variants (eleven archetypes × three
tags × three mutator sets, plus the null fallback) asserting that no floor coaches a removed noun.

### Eleven Codex entries and four objective strings said the same kind of thing

Findables, powers, dense pickups, shifting spotlight, charges, perfect memory, recall focus, the
scholar objective and the scholar contract all still taught Destroy and Stray, one day after both
were removed. The scholar objective's copy also named three tools while its rule watched one field
— though that one turned out to be honest, because `applyTileSwap` sets `shuffleUsedThisFloor` too.

Heavy's trait line promised "costs +1 extra try but never drains peek charges". Nothing in the game
drains a peek charge on a mismatch — no trait, no mutator, no rule. The clause promised the absence
of a penalty that cannot happen, which is a way of teaching a player to fear the game wrongly.

## Gen 202 — the surfaces that talk to the player, checked the same way

Same method as Gen 201, pointed at the three systems that speak: the in-run feedback rail, the
trait interaction lanes on the card backs, and the session stats.

### Twenty-one in-run feedback branches could never fire

`gameScreenFeedback.ts` reads the *text* of a run announcement and decides what chip to show and
what to advise. That makes it rot in a way the type checker cannot see: remove the system that
produced "Guard Cache ward blocked" and the branch watching for those words still compiles, is
still tested, and is now unreachable.

Twenty-one were: guard caches and lantern wards, omen and anchor seals, loaded gateways, mimic
caches, shuffle snares, cascade/fragile/toll/fuse caches, shop gold, hazard wards, moving and
dungeon enemies, and the exit being ready. Each was a line of advice waiting to tell a player to
manage something the game does not have — "pause on the patrol path", "bank gold for shops, rests,
or route events". Checked mechanically: collect every string the shipping code can emit, and a
branch whose needle appears nowhere in that corpus cannot fire.

`gameScreenFeedbackReach.test.ts` now runs that check on every build.

### A peek charge was being drawn on the board as a combo shard

The trait interaction lane map had seven lanes. Four interactions exist. Against those four:

| Lane | Verdict |
|---|---|
| `shard` | reachable, and **wrong** — "Conduit + Echo: peek spark" matched on the word *spark*, so a payoff that hands the player a peek charge was labelled "Shard · Cash shard". Combo shards left in Gen 184. |
| `guard` | matched guard/ward/braced/shield/armor; no live interaction says any of them |
| `risk` | matched risk/danger/penalty/damage/doom; nor any of those |
| `tool`, `block`, `recall`, `score` | reachable and correct |

Three lanes gone, and the peek spark now reads "Tool · Use tool", which is what it is. The lane
colours, the marker patterns drawn on the card back, and the beat-count tiers all went with them.
The test that "proved" the dead lanes worked was feeding the grouper phrases — "Braced guard ward",
"Doom pays penalty" — that no trait has ever said; it is rebuilt on `TILE_TRAIT_INTERACTION_TAGS`.

### `pairsDestroyed` was a stat that could only ever be zero

Destroy was its only writer. It survived Gen 200 as a `SessionStats` field, a normalizer entry, and
a branch in the long-run feedback that listed "destroy pair" among the actions a player took. All
three are gone.

Also: the findable reward row carried a `destroyText` field, the Codex's `mechanic-feedback` token
called an effect "a hazard", the meta-reward copy pointed players at tables of relics, the inventory
prep hint promised rows that "update between floor decisions" for rests and shops, and the viewport
matrix reasoned about "route/shop decisions". All repointed at what ships.

## Gen 203 — the ledger, so "every system" is checkable rather than asserted

Generations 200–202 worked system by system. This records the result of that pass in a shape a test
can walk, because a claim about coverage is worth exactly what the thing checking it is worth.

`src/shared/system-refinement-ledger.ts` carries one entry per system: an id, a verdict, the
generation that last passed over it, and a note saying what was found. Forty-seven entries — the
forty-one mechanics the interaction graph models, plus six surfaces it does not (the floor coaching,
the boss identity, the trait lanes, the Codex, the audio, and the record of the removed powers).

Nineteen **changed**, twenty-seven **confirmed**, one **removed**.

`confirmed` is the verdict worth being suspicious of, so it is the one the gate constrains hardest:
every note must be a real sentence over sixty characters and must say what was checked and what the
evidence was. "Occupancy 0.512, banded common" is a finding; a tick in a box is not.

Three checks hold it up:

- every mechanic in the graph must have an entry — a new mechanic cannot ship without someone
  writing down what state it is in, because the graph will list it and the gate will fail;
- no entry may name a mechanic the graph does not have, so the ledger cannot drift into fiction;
- the verdict counts are pinned, so the pass cannot be quietly downgraded to all-confirmed later.

The ledger is printed into `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md` by the same
generator that emits the version snapshot. A record of what state every system is in belongs where
a person will read it, not in a source file only its own gate opens.

## Gen 204 — the deal is a shuffle now, and a corner counts as touching

Two changes, one asked for and one forced by it.

### Yes, the clustering was on purpose. It went much further than intended.

`SUIT_DEAL_PROFILE_BY_ARCHETYPE` deals `clumped` on eight of eleven archetypes, and the dealer grew
each suit as a solid region — its own comment said round-robin growth "at small board sizes is
indistinguishable from a shuffle", which is exactly what it was avoiding. The reason was real: the
pop reaches through same-suit contact, and a grown region is contact by construction.

Measured against what a shuffle gives, it overshot badly:

| profile | suits | a shuffle gives | before | after |
|---|---|---|---|---|
| `clumped` (8 of 11 floors) | 4 | 0.25 | **0.569** | **0.287** |
| `scattered` | 2 | 0.50 | 0.496 | **0.463** |
| `two_suit` | 2 | 0.50 | **0.733** | **0.460** |

Biggest single-suit blob, as a share of the board: 30% → 17%, 35% → 22%, 49% → 24%.

The deal is now a uniform shuffle followed by one repair pass that cuts any connected same-suit run
over `MIX_MAX_RUN` — four cells on a four-suit board, eight on a two-suit one, because a shuffle's
runs get longer as the palette shrinks and holding a two-suit board to the four-suit cap produces a
checkerboard, which is as arranged as a blob. Every profile now sits just *under* its own chance
baseline: a shuffle with the walls knocked down, not an anti-clustered lattice.

`scattered` also stopped taking its own code path. It was a bare shuffle that skipped both the blob
repair and the Gen 198 pair-half separation, which is why 0.144 of its pairs sat touching their own
twin against 0.025 on the dealt path. One deal for every floor; the profile still decides the
palette, which is a real difference — two suits is a board where almost everything can chain, four
is a board where the route has to be found.

### The pop collapsed, and the fix was to stop charging for the word "touching"

A mixed board has far less same-suit contact, so the contact-only pop (Gen 197) nearly stopped
firing at the bottom of the ladder:

| tier | clumped board | mixed, orthogonal only | mixed + corners |
|---|---|---|---|
| none | 1.72 pairs | **0.51** | **1.52** |
| clean | 2.19 | 0.62 | **2.08** |
| sharp | 6.03 | 2.51 | **5.57** |
| fever | 8.64 | 7.28 | **7.28** |

0.51 means a match took its own pair and nothing else, on most floors, most of the time — the pop
rate fell to 0.464 overall and 0.135 on some floors.

The corner step used to be Fever's privilege. That was defensible on a board of grown regions,
where orthogonal contact was already plentiful; on a shuffled board it meant the game charged the
top rung for the *definition* of touching. Two cards meeting at a corner have no gap between them,
which is the whole rule the pop is built on, so counting them does not loosen the promise — it stops
pretending a card diagonally against the match is somewhere else. Eight neighbours instead of four,
on a board where a quarter of them share your suit, is what makes a shuffled board poppable.

The ladder still sells reach, waves and bridges. It stopped selling what "touching" means.

### What moved with it

- **Par: 0.4 → 0.45 turns per pair.** A clean player took 4.3 turns a floor on the clumped board and
  4.7 on the shuffled one, because the pairs a break takes now have to be found rather than handed
  over. Held at 0.4, the clean player came in under par on 0.862 of floors against the 0.9 that
  target means to hold. Par follows the board rather than the board being clumped back to fit par.
- **`CHAIN_RUNG_PAIRS` fever: 9 → 7.** Only the top rung moved. A mixed board has no painted region
  left for Fever to swallow whole, so its take is what its waves and bridges reach.
- **Floors run longer and score the same**: 4.7 turns against 4.3, 10543 against 10062 at a clean
  clear. More of the floor is remembered rather than collected.
