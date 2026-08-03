# Gameplay platform migration

## Architectural decision

Memory Dungeon keeps strict TypeScript, Electron, React, PixiJS, Zustand, and the existing deterministic rule suite. The migration changes ownership rather than replacing the product stack:

- serializable commands enter the shared gameplay core;
- pure reducers emit domain events and the next run state;
- typed effect definitions express triggers, conditions, state changes, and feedback requests;
- renderer and audio adapters consume state and feedback events but do not define gameplay truth;
- existing rule functions remain compatibility adapters until parity tests prove that a slice can replace them;
- `.ai/repo-model.json` measures code, test, state, feedback, and content coverage throughout the migration.

Legacy paths are removed only after deterministic replay, focused parity tests, and seeded simulation cover their behavior.

## First vertical slice: Conduit Cartographer

The first slice follows an existing player build rather than adding a disconnected feature:

1. A player chooses the `echo_conduit_lens` bonus reward or `peek_charge_plus_one` relic.
2. Echo and Conduit trait matches trigger their typed effects.
3. Effects grant and consume the `peek_charge` inventory item through shared commands.
4. The Peek board power resolves through the deterministic core.
5. Mystery-route and hidden-hazard information creates a downstream routing decision.
6. HUD, board, audio, and accessibility feedback describe the cause, resource change, and available consequence.

The slice is complete only when:

- command and event payloads are serializable and schema-validated;
- seeded replay produces the same state and event sequence;
- existing Echo, Conduit, reward, relic, inventory, Peek, route, save, and feedback behavior has parity coverage;
- headless simulation can exercise the build without renderer state;
- its content nodes connect to source, state, feedback, consequence, persistence, and tests in the semantic model;
- no source of truth is duplicated between the shared core and Zustand/React.

After this proof slice, migrate the other source-derived content families build by build, prioritizing connections that reduce the `unmodeled_content_family` diagnostics rather than maximizing raw mechanic count.

## Second vertical slice: The Warden

The Warden is the first defensive slice and deliberately proves a different loop from Peek-based information control:

1. Hazard Ward and the Warden Sigil create capped guard inventory through content claims.
2. Volatile beside Heavy creates guard through a typed trait command.
3. Mirror invokes the equipped Warden Sigil; a full guard bank converts that proc into explicit overflow score.
4. Guard is consumed before life by mismatch, patrol, enemy, and trap rules, with the combat forecast exposing that consequence.

The effect language now owns the reusable `inventory.grant_or_score` rule and emits a typed `score.changed` event for the overflow branch. Live reward claims, relic picks, and trait matches use the same journaled reducer; existing damage rules remain compatibility consumers until damage commands become the next relevant ownership boundary.

## Third vertical slice: Combo Shard Engine

The Catalyst slice connects momentum pickups to a real survival consequence:

1. Canonical Bonus Shards and the Combo Shard Head Start relic grant capped shard inventory through content commands.
2. Sealed matches invoke the equipped relic and convert a full shard bank into explicit overflow score.
3. Matching a Shard Spark emits `combo_shard.requested`; the compatibility adapter passes that typed request into the existing match-survival resolver.
4. At the third effective shard and below maximum life, the existing deterministic conversion spends shards for one life; Meditation continues to disable that conversion.

The request-event boundary avoids duplicating the nuanced streak, mimic, route, dungeon, life-cap, and Meditation rules in two reducers. It is intentionally temporary: when match survival becomes command-owned, the typed request can be consumed inside the core without changing content definitions or journal history.

## Shared renderer feedback boundary

All migrated slices now cross one read-only renderer adapter. It validates persisted journal entries, deduplicates by core-owned event ID, preserves the typed message and tone, and assigns only presentation ownership:

- Peek cues are played by the tile-action controller;
- relic-pick cues are played by the relic action;
- bonus-reward cues are played by the side-room claim action;
- trait, findable, and proc cues remain inside match resolution so existing payoff audio is not doubled;
- every category enters the same polite accessibility queue;
- typed inventory overflow is expanded with the actual converted score amount.

The adapter never mutates the run or infers whether an effect happened. Commands and events remain gameplay truth; Zustand, React, and audio only decide how a validated event is presented.

## Fourth vertical slice: The Saboteur

The Saboteur connects trap-control choices that previously appeared as separate inventory and HUD rows:

1. Hazard Banisher grants a destroy charge and the durable floor-start hazard-banish perk through one typed claim command.
2. The Breaker Chisel relic adds another uncapped destroy-pair charge through the same relic command boundary.
3. Matching Ward Spark emits a typed safe-hazard-ward request; the compatibility adapter feeds that request into the existing one-charge floor ward cap.
4. The player spends destroy charges on a chosen completion-safe pair, while the banked ward absorbs one remaining Shuffle Snare or Fragile Cache mistake.
5. On later floors, Hazard Banisher removes one hazard pair automatically, or grants a destroy charge when no hazard exists; `noDestroy` contracts continue to block both lanes.

Destroy Pair execution moved into the typed core in the sixteenth slice, followed by Hazard Banish floor-start resolution in the seventeenth. Ward Spark intent and the durable banish payoff are both journaled; established hazard-trigger calculations retain their tested priority rules.

## Fifth vertical slice: The Vaultbreaker

The Vaultbreaker turns remembered treasure pairs into route access and future build selection:

1. Treasure Chest grants one iron key, two shop gold, and 25 score through typed inventory, currency, and score effects.
2. Cursed Opener Contract grants its durable perk and signing gold; only the first resolved Cursed match of a floor can execute the typed one-gold, 25-score payoff.
3. Matching Score Glint emits `score.requested`; the compatibility adapter passes exactly 25 points into the established match-scoring summary without mutating score twice.
4. Shrine Echo banks a typed bonus relic pick, consumed by the established next-offer draft budget.
5. Iron keys open matching exits and optional caches, while shop gold funds route insurance and board-shaping purchases.

Locked-cache resolution, shop purchases, match score composition, and relic-offer advancement remain deterministic compatibility consumers. The command core owns the content causes and durable economy mutations; typed request events bridge into calculations whose broader ownership has not yet migrated.

## Sixth vertical slice: The Slayer

The Slayer connects boss preparation to objective execution and future build growth:

1. Chapter Compass grants a Peek charge immediately, then emits a typed 30-score request only when a boss trophy cache is actually claimed.
2. Wager Surety grants a guard token immediately; a won objective wager emits a one-Favor request, while a lost wager emits a one-step streak-floor request.
3. Parasite Ledger grants an immediate parasite ward; completing a featured objective while Score Parasite is active emits one pressure-relief request.
4. Boss trophy scoring, featured-objective resolution, Favor conversion, and parasite advancement consume those requests through explicit compatibility parameters.
5. Favor becomes extra relic selections, closing the loop from preparation through boss/objective execution into the next build decision.

The floor-clear orchestrator journals every typed cause and supplies the requested amounts to existing pure calculators. Direct calculator callers retain legacy defaults, so parity tests can compare old and migrated behavior while live runs use the command-owned source boundary.

## Seventh vertical slice: The Seer

The Seer joins information sources, memory markers, safe correction, and future relic choice into one decision loop:

1. Secret Favor grants one Peek and one Favor progress through a single typed reward command; Favor conversion still banks future relic picks at the established threshold.
2. Scout Glint emits `scout_reveal.requested`; the compatibility adapter passes that request into the deterministic omen-style selector for a hidden hazard, dungeon family, or route special.
3. Memory Nail emits an explicit pin-capacity request at acquisition, while the established capacity rule continues to derive the live extra slot from the owned relic.
4. Pin presses are now serializable `board.pin_toggle` commands with typed board and feedback events.
5. Stray Hook grants typed `stray_remove_charge` inventory, and each chosen removal is a serializable `board.stray_remove` command that retains the established completion-safe target guard.
6. Peek, Scout, Pin, and Stray Remove turn discovered information into player-authored board decisions; Secret Favor compounds successful exploration into later relic drafts.

The renderer only converts presses into commands and projects feedback. Board legality remains in the existing pure Pin and Stray rules, and Scout target selection remains in the deterministic dungeon-scout rule, so replay gained coverage without creating a second gameplay implementation.

## Eighth vertical slice: The Route Gambler

The Route Gambler makes optional risk, one-floor rescue capacity, and Favor cash-out one explicit loop:

1. An eligible Endless wager is accepted through `risk_wager.accept`; the core calls the established pure eligibility rule and emits the target floor, streak at risk, and exact Favor payout.
2. Illegal or duplicate wagers are rejected without mutation, so the renderer no longer reports a wager sound for a no-op press.
3. Run and floor start remain the authoritative source of one non-stackable Gambit token; the semantic graph now exposes that lifecycle instead of treating the flags as unrelated state.
4. A third-flip choice enters the core as `board.gambit_commit`, which requires resolving state, an unused floor token, exactly two flipped tiles, and a hidden distinct target.
5. Enemy contact and dungeon-card behavior still execute through the established transition. The command and its typed commitment feedback are only journaled if the chosen tile actually becomes the third flipped tile.
6. Existing Gambit resolution retains both outcomes: a valid pair can rescue the turn, while a failed three-card commitment spends the token and keeps its extra-tries penalty.
7. Successful wagers cash out through the existing Favor-to-relic-draft economy; Wager Surety softens a loss without removing its failure consequence.

The renderer derives wager and Gambit audio exclusively from typed feedback categories. Seeded simulation generates both new command forms, and the graph connects floor start → Gambit token → rescue decision plus objective streak → wager → Favor → relic draft.

## Ninth vertical slice: The Board Tactician

The Board Tactician expands the Saboteur from hazard removal into deliberate board control, while keeping every source and spend in one replayable loop:

1. Trait Toolkit and Stasis Lockbox grant targeted row-shuffle charges alongside Peek or Guard support, so their mixed rewards feed both information/defense and board shaping.
2. Free Swap Floor grants the durable first-swap-per-floor perk; Extra Shuffle Charge grants a full-board shuffle; First Shuffle Free Per Floor and Region Shuffle Free First expose their existing floor-reset benefits through typed relic claims.
3. Full shuffle, selected-row shuffle, and selected-tile swap enter the core as `board.shuffle`, `board.region_shuffle`, and `board.tile_swap` commands.
4. Each reducer delegates legality and permutation to the established pure board-power implementation, then journals exact affected tiles, nonces, charge/free-use consumption, and typed feedback only when the action succeeds.
5. The renderer retains only UI arming and target selection. It projects returned state/events and derives sound from feedback rather than mutating inventory or announcing rejected presses.
6. The semantic graph joins all six content sources to shuffle resources, floor-reset perks, the three board powers, trap-control synergies, and floor completion.

Seeded simulation now generates all three board-control command forms and verifies exact JSON replay, event schemas/order, and state invariants. Direct parity tests prove that the command reducers preserve the existing deterministic shuffle, row-shuffle, and tile-swap outcomes rather than introducing a second implementation.

## Tenth vertical slice: The Memory Scout

The Memory Scout turns study time, clean trait play, temporary recall, and bounded mistake recovery into one explicit loop:

1. Trait Streak Lens grants the durable `trait_streak_toolkit` perk and score through a typed reward claim.
2. Any trait match at an existing x2 clean streak triggers that perk through the command core, banking one `flash_pair_charge` without duplicating the established match calculation.
3. Flash Pair is now a `board.flash_pair` command. It delegates deterministic pair selection to the existing pure action and journals the exact revealed tile IDs, charge delta, nonce, and feedback only after a legal Practice/Wild use.
4. Lantern Study and Compressed Margins claims emit typed relic feedback, while the established pure study-window rule remains authoritative for their +280 ms global and +220 ms Short Memorize effects.
5. The floor Undo is now a `board.undo_resolve` command. It delegates restoration to the existing pure action and records restored tiles, consumed use, recall-focus cost, forgotten-tile memory, timer clearing, and feedback.
6. The renderer clears a pending resolve timer only after Undo succeeds, so an illegal no-charge press can no longer strand a resolving turn with its timer removed.

The versioned graph connects reward choice to perk, clean trait match, Flash inventory, deterministic reveal, study-window counterplay, floor-reset Undo, HUD feedback, replay, and persistence. Seeded simulation generates both new command forms and retains exact JSON replay and nonnegative inventory invariants.

## Eleventh vertical slice: The Locksmith

The Locksmith makes pre-lock insurance, shop fallback, and the final lock spend one replayable extraction loop:

1. Key Insurance grants one iron key, one shop gold, and 10 score through a typed reward command before lock pressure spikes.
2. Shop purchases now enter the core as `shop.purchase`; the reducer delegates compatibility, affordability, item application, and purchased-offer state to the established pure shop rule.
3. A successful purchase journals the exact offer, item, cost, wallet delta, Master Key delta, and typed feedback. Invalid, sold, unaffordable, or incompatible offers remain no-ops and are not journaled by the live surface.
4. Exit activation now enters the core as `dungeon.exit_activate` with the exact selected spend. When the UI omits a choice, the existing pure selector preserves free activation first, matching typed key second, and Master Key fallback last.
5. The reducer delegates board sealing, objective reward, hazard cleanup, route-plan creation, and key consumption to the established pure exit transition, then journals the activated tile, lock spend, key kind, Master Key delta, gateway delta, and route.
6. Master Keys remain universal one-lock resources for exits and locked caches; explicit typed keys remain preferred so flexible fallback value is not wasted.

The graph connects reward insurance and shop gold to typed and Master Key inventories, lock/caches, explicit exit activation, HUD feedback, persistence, and seeded replay. Direct parity tests cover successful Master Key purchase and spend, while existing shop, exit, topology, and softlock tests retain authority over legality.

## Twelfth vertical slice: Combo Shard Survival

The Combo Shard build now includes its chapter-pressure defense instead of ending at shard-to-life conversion:

1. Claiming the one-shot Parasite Ward relic executes the same strict content command as other migrated relics and emits the exact ward delta plus acquisition feedback.
2. Every cleared-floor transition executes `floor.parasite_advance`, delegating the established four-floor pressure calculation to the pure score-parasite rule.
3. The command records pressure, ward, and life before/after values plus explicit threshold, ward-consumed, and life-lost flags.
4. Only a real threshold consequence emits feedback: ward absorption is a reward cue and unprotected life loss is a warning cue.
5. The transition appends the accepted command and events before creating the next board or game-over state, so replay, save data, HUD, audio, and accessibility share one persisted cause.
6. Direct parity tests retain the existing ward-before-life rule, while the semantic graph connects relic acquisition through the ward state to score-parasite consumption and feedback.

This closes the last unmodeled relic diagnostic without inventing a parallel survival system. The typed command owns orchestration and observability; `advanceScoreParasiteFloor` remains the deterministic calculation primitive.

## Thirteenth vertical slice: Supply Cache Emergency Toolkit

Supply Cache now has an explicit role between information control and blocker removal instead of existing as an isolated payout row:

1. The canonical reward executes `bonus_reward.supply_cache` and emits exact Destroy, Peek, score, and feedback events.
2. Compatibility routing is payout-sensitive: only the authored +1 Destroy, +1 Peek, +10 score contract uses the definition; altered fixtures keep generic normalized payout behavior.
3. The existing command-owned Peek reveals a hidden blocker without committing flips.
4. The established completion-safe Destroy Pair action consumes the paired emergency charge, respects `noDestroy`, forfeits pair rewards, and cannot remove an exit source.
5. The graph models the intended sequence—inspect first, remove second, recover the floor—and connects it to both Seer information planning and Saboteur removal planning.
6. The claim is journaled, persisted, renderer-projected, and generated by deterministic simulation with exact replay and nonnegative inventory checks.

Destroy Pair is now a typed, journaled action in the sixteenth slice. The mature floor finalizer remains a compatibility handoff after the command event reports board completion; Supply Cache’s content definition is unchanged.

## Fourteenth vertical slice: Wild Joker Token

Wild Run now treats its joker as a persistent, countable resource instead of collapsing every stored use after the first match:

1. Starting Wild Run grants one `wild_match_token` and generates one Wild Joker tile through the established run-creation rules.
2. A legal normal or Gambit-assisted wildcard pair executes `wild_match.consume` with the exact Wild and paired tile IDs.
3. The reducer requires two distinct flipped tiles, exactly one Wild Joker, a legal wildcard pairing, and a positive token balance before spending anything.
4. Successful resolution emits the inventory decrement, `wild_match.consumed`, and the `wild_joker.match_consumed` feedback cue as one deterministic journal sequence.
5. Each match consumes exactly one token. Additional tokens remain banked instead of being reset to zero.
6. If a token remains when the floor advances, the next generated board receives a new Wild Joker tile; if none remain, normal board generation resumes.
7. Stray Remove remains the completion-safe escape hatch for an unwanted Wild singleton, and Gambit can still turn a third flip into a valid wildcard match.

Graph v12 connects mode setup, token inventory, board generation, normal and Gambit match resolution, exact consumption, HUD feedback, floor completion, persistence, and next-floor continuity. Core and live-game tests cover rejection without a valid flipped pair and the two-token-to-one-token regression that previously erased the whole bank.

## Fifteenth modeled slice: Run Loadout Composition

The inventory's three loadout rows are now modeled as projections over existing authoritative state, not as additional consumables or a second state owner:

1. Run Setup copies the selected contract, mode/daily mutators, starting relics, and starting-loadout identity into the new run exactly once.
2. `relic_loadout` projects owned `relicIds`; relic drafts are its only mid-run mutation boundary, and owned relics gate later offers.
3. `mutator_loadout` projects the active floor's `activeMutators`; the deterministic floor schedule may replace that list only during run-flow advancement.
4. `contract_loadout` projects the immutable `activeContract`; its `noShuffle`, `noDestroy`, and total-pin constraints gate the same board-power legality functions used by the live UI.
5. All three rows display through the shared inventory/HUD surfaces while the underlying run fields remain the single source of truth.
6. Graph v13 connects run setup, relic drafting, floor scheduling, build composition, affected powers and hazards, feedback, and the existing run-flow boundary.

This slice intentionally adds no command type: read-only projections should not pretend to mutate gameplay. Commands remain responsible for actual draft picks and board actions as those ownership boundaries migrate.

## Sixteenth vertical slice: Typed Destroy Pair

Destroy Pair now completes the Supply Cache and Saboteur action loop through the deterministic command core:

1. A selected hidden target executes `board.destroy_pair`; the strict schema records the exact target tile.
2. The reducer delegates legality and state calculation to the established pure transition: clear flip state, positive charge, no `noDestroy` contract, exactly one fully hidden pair, and exit-source protection are all retained.
3. A successful command journals the charge delta, both removed tile IDs, pair key, match count, Recall Focus cost, parasite relief, Shifting Spotlight nonce, and whether the board became complete.
4. Pair removal still forfeits ordinary pair/findable rewards, increments destruction statistics, clears affected pins, and remembers both removed tiles.
5. The floor-completion adapter appends the accepted command and events before invoking the established finalizer, and only when the typed event reports `boardComplete`.
6. Renderer audio is projected from `power.destroy_pair.used`; the armed UI no longer needs a parallel hardcoded gameplay cause.
7. Seeded simulation includes the strict command in exact JSON replay, while direct core and live-surface tests prove accepted state parity and contract rejection.

Graph v14 connects Supply Cache and Saboteur sources, Destroy inventory, target legality, typed execution, feedback, completion, persistence, and replay. The compatibility boundary is now only the mature floor finalizer, not pair-removal truth.

## Seventeenth vertical slice: Hazard Banish Floor Payoff

The Saboteur's durable reward now has a typed payoff on every prepared floor instead of silently mutating the new board:

1. Claiming Hazard Banisher still grants one immediate Destroy charge and the durable `hazard_banish_per_floor` perk through its existing content definition.
2. Each next-floor constructor executes `floor.hazard_banish` only when that perk is active, after the deterministic board and reset state have been prepared.
3. The pure rule selects the first active hazard marker deterministically and clears that hazard kind from its pair without matching or removing either tile.
4. If no hazard marker exists, the perk grants exactly one Destroy charge, preserving its authored fallback value.
5. A `noDestroy` contract produces an explicit `contract_blocked` event and warning feedback without changing the board or inventory.
6. All outcomes journal floor, target pair, hazard kind, affected tiles, and Destroy balance before play begins.
7. Seeded replay includes the strict command form; direct core and next-floor parity tests cover hazard removal, fallback grant, and contract suppression.

Graph v15 separates reward acquisition from the durable perk, then connects run flow to hazard counterplay or Destroy fallback, contract gating, typed feedback, persistence, and simulation.

## Eighteenth vertical slice: Typed Route Choice

The between-floor Safe, Greed, or Mystery commitment now crosses the deterministic command boundary instead of bypassing the replay journal:

1. The continuation surface submits `route.choose` with the exact generated choice id while the run is `levelComplete`.
2. The core delegates availability and deterministic payoff calculation to the established pure route outcome rule, preserving its life, gold, score, guard, shard, Favor, and memorize-time behavior.
3. Successful choices emit `route.choice_selected` with route and outcome kinds, selected dungeon node, summary, and before/after values for every affected build resource.
4. Missing, stale, repeated, dead-run, and one-life Greed choices reject without mutating the run.
5. The accepted command and events are appended before the established side-room and next-floor continuation adapters run.
6. Renderer feedback is projected from `route.choice.safe`, `route.choice.greed`, or `route.choice.mystery`; Greed retains a warning tone for its life cost.
7. Seeded simulation includes the strict command, while accepted core replay and live continuation tests prove state parity and persistence.

Graph v16 connects floor clear, route commitment, the command core, exact economy/progression consequences, typed feedback, persistence, and deterministic simulation. This also establishes event data for later build-aware route outcome scoring in the headless evaluator.

## Typed route outcome evaluation

The dungeon balance profiler now consumes the live route command rather than maintaining separate Safe, Greed, and Mystery reward arithmetic:

1. Each seed and strategy profile carries a real run-state sidecar across its abstract pressure simulation.
2. Every cleared-floor decision generates the same choices as live play and executes `route.choose` through the core.
3. The profiler reads `route.choice_selected` and accumulates accepted/rejected decisions, outcome kinds, life, shop-gold, score, guard, combo-shard, Favor, and memorize-time deltas.
4. Profile tests require exactly one accepted typed outcome per cleared floor, zero rejected authored choices, exact Greed score, and Mystery outcome accounting.
5. This removed a real drift bug: the old model awarded Greed two shop gold while live gameplay awards three, and it ignored Mystery's deterministic resource branch.

Graph v17 adds the typed build-strategy evaluator as an executable balance gate connected to route choice, the command core, economy, Route Gambler strategy, and per-seed fairness bounds.

## Nineteenth vertical slice: Typed Relic Draft Selection

The run's central build-composition choice now crosses one authoritative command boundary instead of relying on a legacy pick followed by a nested effect command:

1. `relic.pick` accepts only a schema-enumerated relic that is currently offered, eligible, and selected while the run is alive and `levelComplete`.
2. A new core-independent pure transition owns relic acquisition, remaining-pick normalization, deterministic next-round options, and final offer closure; legacy callers and the core share it without circular dependencies.
3. The core applies the selected relic's existing schema-defined immediate effects under the same command id, retaining typed inventory, guard, ward, free-shuffle, bonus-pick, request, and feedback events.
4. `relic.picked` records definition/build identity, offer tier, pick rounds, remaining budget, next options, relic counts, tier progress, and whether the offer continues or is ready to advance.
5. Multi-pick visits remain on the relic surface; the final accepted pick is journaled before the mature next-floor constructor runs.
6. JSON replay covers a complete two-pick visit, while live-surface tests prove command/event persistence survives final floor advancement.
7. Expanding the strict relic enum exposed and fixed a schema gap where the live `peek_charge_plus_one` relic was absent from the enumerated command contract.

Graph v18 connects relic draft choice to the command core, relic loadout projection, typed feedback, bounded persistence, deterministic replay, and downstream run flow.

## Twentieth vertical slice: Typed Relic Offer Services

Relic-draft shaping now shares the same deterministic boundary as the final selection:

1. `relic.offer_service_use` validates reroll, ban, and rarity-upgrade intent against the open offer, wallet, one-use visit limits, target eligibility, and option-count guards.
2. The core delegates option generation to the mature seeded relic rules and emits `relic.offer_service_used` with exact cost, wallet, pick-round, option, ban-list, and upgrade-state deltas.
3. The live draft surface journals the command and events, while the feedback adapter classifies the typed cue as relic-service audio instead of inferring success from the click.
4. Contract tests keep the service enum equal to the live catalog, prove parity for all three services, reject duplicate use, and replay JSON-round-tripped service intent exactly.
5. The seeded simulation forces one service command without perturbing its established random content census.

Graph v19 extends relic draft progression across shop-gold funding, deterministic offer shaping, typed feedback, persistence, and replay.

## Twenty-first vertical slice: Flat Typed Route Side Rooms

Between-floor rest, event, bonus-reward, and skip choices now cross one replayable boundary instead of an opaque Zustand callback or a reward command nested inside another journal:

1. `side_room.resolve` accepts an explicit claim or skip intent and validates live `levelComplete` state, event identity and choice, visible bonus-draft membership, reward floor/secret/anti-grind limits, and a deterministic primary fallback.
2. Rest healing and cost, all seeded run-event effects, all thirteen bonus-reward definitions, the reward ledger, and first-treasure Shrine Echo Favor are applied by the core under one command id.
3. `side_room.resolved` records room/route identity, selected outcome, reward or event effect, and exact before/after deltas for lives, gold, score, guard, shards, Favor, tools, keys, and durable reward perks.
4. Bonus payouts reuse schema-owned content definitions without appending nested commands; direct tests require the pure reducer to leave journals untouched and prove JSON replay parity against mature legacy outcomes.
5. The side-room surface now accepts typed intent rather than an arbitrary mutation callback, appends exactly one outer command, projects typed reward/side-room feedback, and preserves the established shop or next-floor continuation.
6. The seeded simulation forces a rejected baseline side-room probe without perturbing its stable random definition census.

Graph v20 connects route commitments through side-room choice, build rewards, economy, feedback, bounded persistence, replay, and downstream run flow.

## Twenty-second vertical slice: Flat Typed Floor Advancement

The cleared-floor boundary now prepares the next playable board through one replayable command instead of nesting parasite and Hazard Banish commands inside an untyped transition:

1. `floor.advance` validates the cleared-floor state, puzzle-mode boundary, and unresolved side-room or relic-draft gates before any mutation.
2. The existing deterministic schedule, dungeon-node selection, board generator, memorize-time calculation, and per-floor reset rules remain the calculation authority; their pure transition no longer appends journals.
3. Score Parasite pressure resolves before board construction and Hazard Banish resolves after the new board exists, while both retain their typed domain and feedback events under the single outer command id.
4. `floor.advanced` records source/target floors, resulting phase, board shape and authored context, memorize duration, life/parasite/ward deltas, Hazard Banish outcome, and Destroy balance.
5. Normal continuation and a final endless relic pick both use the same command adapter; puzzle relic picks preserve the established no-advance behavior.
6. Direct reducer tests require journals to remain unchanged, JSON replay reproduces the generated board exactly, and the seeded simulation forces the strict command form without perturbing its random content census.

Graph v21 connects floor clear and relic drafting through flat run advancement, parasite pressure, floor-start perks, deterministic board preparation, memorize feedback, persistence, and replay.

## Twenty-third vertical slice: Flat Typed Board Turn Resolution

The live delayed match seam now resolves as one gameplay transaction instead of journaling a separate command for each findable, trait proc, Wild token, and pair-triggered floor-clear hook:

1. The mature ordinary and Gambit resolvers were extracted from `game.ts` into a core-independent transition factory; scoring, survival, hazards, dungeon rewards, traits, objectives, economy, and cleanup still use their established pure rules.
2. Schema-driven effect execution was separated from the command reducer, removing the trait-to-core dependency cycle and allowing multiple content definitions to share one outer command id and event sequence.
3. `board.turn_resolve` validates resolving state plus exactly two or three flipped tiles, then owns ordinary or Gambit match/mismatch state and emits `board.turn_resolved` with outcome, matched identity, board completion, status, life, score, tries, and match deltas.
4. Findable requests, trait synergies, and Wild Joker inventory/feedback events execute under the turn command. The live journal now retains one outer turn command rather than nested `effects.apply` or `wild_match.consume` commands.
5. The mature floor finalizer is now a core-independent transition factory. Pair-completed floors reach `levelComplete` inside the turn command, and any applicable Slayer boss, wager, or parasite definitions share its command id without nested journals.
6. JSON-round-tripped replay reproduces both non-final and pair-final state plus ordered events exactly. Exit activation and Destroy-triggered completion remain separate typed commands whose finalizer handoffs are the next explicit ownership seams.

Graph v23 connects delayed input, match/mismatch and Gambit resolution, schema effects, Wild consumption, pair-triggered floor clearing, Slayer hooks, feedback, bounded persistence, and replay.

## Twenty-fourth vertical slice: Flat Typed Destroy Completion

Destroy Pair now owns its completion consequence instead of handing a complete board back to a wrapper for a second transition:

1. `board.destroy_pair` still delegates legality, charge consumption, pair removal, reward forfeiture, Recall cost, parasite relief, and Spotlight rotation to the established pure action.
2. When `board.pair_destroyed.boardComplete` is true, the reducer invokes the core-independent floor finalizer before returning, under the same command id and event list.
3. The live wrapper now only appends the accepted command and events; it does not inspect the event and finalize again.
4. Direct reducer tests prove final-Destroy `levelComplete` state, untouched reducer journals, JSON replay equality, and exact board-completion events.
5. Live tests require one `board.destroy_pair` journal entry with no nested `effects.apply` command on a completed floor.
6. Non-final Destroy behavior, `noDestroy`, exit-source protection, reward forfeiture, and softlock guards remain unchanged.

Graph v24 connects Destroy removal directly to the completed-floor run flow, flat persistence, feedback, and replay. Dungeon Exit activation is now the remaining common floor-finalizer handoff.

## Twenty-fifth vertical slice: Flat Typed Dungeon Exit Completion

Dungeon Exit activation now owns its floor-completion consequence instead of returning an opened board for a wrapper to finalize separately:

1. `dungeon.exit_activate` still delegates reveal, objective, lock-spend, key, Master Key, hazard cleanup, gateway, and route-plan calculation to the established pure exit transition.
2. The reducer emits the exact activation and feedback events, then invokes the core-owned floor finalizer under the same command id and event list.
3. Boss trophy, featured objective, wager, Favor, and parasite effects therefore share the exit command envelope without nested `effects.apply` journal entries.
4. Shared and renderer wrappers now only choose the explicit spend, submit the command, and append one journal transaction; neither owns floor-clear rules.
5. Direct reducer tests prove legacy state parity, untouched reducer journals, deterministic event identity, and JSON-round-tripped replay equality.
6. Live boss-exit and renderer tests require one `dungeon.exit_activate` command that returns the complete `levelComplete` state.

Graph v25 connects explicit exit and lock choice directly to completed run flow, typed feedback, persistence, topology safety, and replay. Ordinary matches, Destroy Pair, and Dungeon Exit now share the same core-owned floor finalizer without wrapper-level gameplay mutation.

## Twenty-sixth vertical slice: Typed Tile Input

Board input now enters the deterministic core before it changes run state:

1. `board.tile_flip` owns ordinary flips, trap triggers, exit/shop/room reveals, and board cleanup through the established pure tile transition.
2. `enemy_hazard.contact` owns patrol contact, hazard advancement, pending-memorize pressure, Guard-before-life absorption, game-over state, and typed feedback.
3. Shared and renderer entry points append accepted commands and ordered events; they retain only UI timing, modal, and audio coordination.
4. Gambit now journals `board.gambit_commit` before the chosen `board.tile_flip`, preserving causal replay even when the third pick is a fatal or surviving trap.
5. Utility tiles use the same command path as ordinary board tiles, so exit, shop, and room reveals are reconstructible from pre-input state.
6. Reducer tests prove JSON-round-tripped replay across flip → flip → turn resolution and exact enemy-contact parity, while the seeded simulation reports accepted and rejected command types separately and proves accepted tile input plus rejected contact legality.

Graph v26 connects typed tile input to delayed turn resolution, enemy patrols, Guard absorption, Gambit, utility exits, feedback, persistence, and deterministic replay.

## Twenty-seventh vertical slice: Typed Shop Stock Reroll

The vendor's paid stock refresh now crosses the deterministic command boundary instead of mutating economy and offer state in a renderer helper:

1. `shop.reroll` delegates affordability, one-use legality, floor-scaled cost, and seeded route-aware offer generation to the established pure shop rule.
2. `shop.stock_rerolled` records the exact cost, wallet and reroll-count deltas, plus old and refreshed offer/item identities.
3. The live shop surface appends one accepted command and its ordered events; rejected, unaffordable, and repeated rerolls remain no-ops.
4. Purchase and reroll confirmation audio now follows typed feedback acceptance, while `ShopScreen` exposes the journal message through a polite live region.
5. Direct reducer tests prove legacy parity, untouched reducer journals, strict rejection, and JSON-round-tripped replay equality.
6. The headless simulation begins with deterministic stock and proves an accepted reroll while reporting accepted and rejected command types separately.

Graph v27 registers the previously unmodeled stock-reroll mechanic and connects its gold sink, refreshed build/key choices, priority guards, feedback, persistence, and replay coverage.

## Twenty-eighth vertical slice: Flat Typed Route Interlude Opening

Route selection now owns its immediate between-floor consequence instead of returning a partially advanced run for a renderer helper to mutate:

1. `route.choose` applies the existing deterministic Safe, Greed, or Mystery outcome and opens the seeded rest, event, or bonus-reward side room in one atomic reducer transaction.
2. Accepted choices emit `route.choice_selected`, `side_room.opened`, and typed route feedback under the same command id; the opening event records exact room, route, node, floor, payload, event, and visible-choice identity.
3. If the selected route cannot produce its deterministic interlude, the entire command rejects against the original run rather than retaining a route plan without its required continuation.
4. The continuation executor now journals the reducer result and performs navigation only; it no longer calls a gameplay mutation after the typed command.
5. Shop purchase and stock-reroll commands now require a live cleared-floor or paused-board shop interlude, preventing replay-valid economy mutations from unrelated run phases.
6. The seeded simulator proves a causal flip → resolve → floor clear → route → side room → shop purchase/reroll → next-floor sequence, plus strict out-of-context contact rejection and JSON replay equality.

Graph v28 connects the route commitment directly to deterministic side-room creation, captures the new typed opening event and atomicity guards, and records the shop lifecycle boundary used by both live play and replay.

## Twenty-ninth vertical slice: Flat Typed Relic Offer Opening

The source of a build-defining relic choice now crosses the same deterministic boundary as offer services and final selection:

1. Milestone option generation and pick-budget consumption were extracted into a core-independent rule so legacy callers and command reduction share one seeded implementation without a core-adapter dependency cycle.
2. `relic.offer_open` validates a live eligible cleared milestone with no unresolved side room, repairs deterministic progression state, and opens the exact tier, options, pick budget, service availability, and contextual reasons.
3. `relic.offer_opened` records the cleared floor, tier, visible choices, available services, contextual-reason identities, banked/Favor pick consumption, and claimed-tier deltas under one command id.
4. An exhausted relic pool is an accepted `milestone_skipped` outcome that advances the tier ledger and emits explicit feedback instead of leaving an empty draft or dead end.
5. The level-complete continuation surface no longer calls `openRelicOffer` directly; it journals the typed adapter result before presenting the draft or advancing after a safe skip.
6. Relic-offer reveal audio now follows the typed `relic.offer.opened` feedback event rather than inferring causality from `run.relicOffer` becoming non-null.
7. The seeded simulator clears milestone floor 3 and proves an accepted route → side room → shop purchase/reroll → offer open → paid service → relic pick → floor advance chain with JSON replay equality.

Graph v29 connects run progression to deterministic draft creation, empty-pool safety, build feedback, persistence, and replay before the existing service and selection consequences.

## Thirtieth vertical slice: Typed Memorize Completion

The first state-changing boundary on every playable floor now enters the deterministic core instead of being applied directly by the renderer timer:

1. `phase.memorize_complete` accepts only a live memorize phase and delegates Focus initialization and timer cleanup to the established pure `finishMemorizePhase` rule.
2. `phase.memorize_completed` records the floor, remaining study time, pending timing bonus, and exact before/after Focus under one deterministic command id.
3. The reducer emits typed study-complete feedback, rejects duplicate or out-of-phase completion, leaves journals untouched, and reproduces the legacy result under JSON-round-tripped replay.
4. `runTimerController` retains ownership of browser timers but submits their expiration consequence through the journaling adapter, including zero-duration and paused-resume completion.
5. The renderer feedback adapter classifies study completion separately so HUD and accessibility announcements consume the same event without inventing gameplay truth.
6. The seeded simulator now starts from an actual memorize state with a hidden board, then proves memorize → six flips → three resolves → route → side room → shop → relic draft → next floor as one replayable causal sequence.

Graph v30 connects the study window directly to the command core, ready-Focus feedback, persistence, and seeded replay. This closes the previously missing opening transition between core-owned floor construction and typed tile input.

## Thirty-first vertical slice: Typed Gauntlet Expiry

The run-wide Gauntlet deadline now terminates play through serialized command data instead of renderer-owned wall-clock mutation:

1. `run.gauntlet_expire` carries the host's integer `observedAtMs` into the deterministic reducer; replay never reads the current clock.
2. The reducer accepts only an active Gauntlet with positive lives and an observation strictly after its normalized deadline, then owns the exact `lives: 0` and `gameOver` consequence.
3. `run.gauntlet_expired` records the observation, deadline, overdue duration, previous phase, and life delta, followed by typed warning feedback under the same command id.
4. Paused, non-Gauntlet, terminal, duplicate, at-deadline, and before-deadline commands reject without changing the run.
5. Both the interval watcher and the normal/Gambit tile-input boundary call the same journaling adapter, so a deadline cannot be crossed by clicking between timer ticks.
6. The seeded simulator includes a dedicated Gauntlet scenario that serializes the clock observation and proves schema validity, invariant safety, event ordering, and JSON replay equality through the terminal state.

Graph v31 adds the Gauntlet clock as an executable hazard and connects run setup, earned floor time, memorize and tile-input gates, command-owned terminal state, HUD feedback, persistence, and deterministic simulation.

## Thirty-second vertical slice: Typed Pause And Resume

Every live pause boundary now freezes and restores authoritative run timing through serialized commands instead of renderer calls that read the wall clock internally:

1. `run.pause` records one integer host observation plus the exact memorize, resolve, and debug-reveal timer snapshot captured before browser timers are cleared.
2. `run.paused` records the prior phase, frozen timer values, Gauntlet deadline, and pause timestamp; only memorize, playing, or resolving runs may accept it.
3. `run.resume` carries a new host observation, and `run.resumed` records the restored phase, Gauntlet deadline extension, paused duration, and whether corrupted resolving state recovered to play or terminated safely.
4. The command core calls explicit `pauseRunAt` and `resumeRunAt` rules with no ambient clock read; legacy clock-reading wrappers remain only for unmigrated shared callers and tests.
5. Manual pause, inventory/settings overlays, playable-board shops, and their return paths all use the same journaling timer adapter, including zero-duration memorize completion after resume.
6. Dead or impossible paused snapshots still reach the established game-over summary path, now with a causal resume command, terminal event, and warning feedback.
7. Seeded simulation inserts an accepted pause → resume pair into the full 384-step scenario and proves schema validity, event order, invariant safety, and JSON replay equality.

Graph v32 registers pause/resume as a core lifecycle mechanic and connects all playable phases, serialized timer state, Gauntlet clock extension, HUD feedback, persistence, and deterministic simulation.

## Thirty-third vertical slice: Typed Debug Reveal Lifecycle

Temporary debug-board visibility now crosses the deterministic command boundary instead of toggling run truth from three renderer controllers:

1. `debug.reveal_activate` accepts only active board play, carries the user-setting achievement policy, and deterministically activates or refreshes the established reveal duration.
2. `debug.reveal_activated` records activation versus refresh, reveal duration, prior debug use, and exact before/after achievement eligibility.
3. `debug.reveal_deactivate` requires an explicit schema-validated cause: browser timer elapsed, a paused zero-duration timer resumed, or the gameplay phase ended.
4. `debug.reveal_deactivated` records that cause and the serialized remaining duration before clearing visibility; typed feedback distinguishes the developer reveal from the consumable Peek power.
5. `runLifecycleController`, `runTimerController`, and `runResolutionController` now retain only settings, browser-timer, and presentation coordination while core adapters own every `debugPeekActive`, `debugUsed`, timer, and achievement-policy mutation.
6. Pausing preserves the exact debug-reveal remainder, refreshing cannot restore achievement eligibility once disabled, and phase-end cleanup is journaled before summary/persistence work.
7. Seeded simulation proves memorize → activation → deactivation after pause/resume, with strict schemas, ordered events, invariant safety, and JSON replay equality.

Graph v33 registers debug reveal separately from `power.peek` and connects typed commands, pause-aware timer state, phase cleanup, achievement gating, HUD feedback, persistence, and deterministic simulation.

## Thirty-fourth vertical slice: Typed Progression Safety Repair

Automatic anti-softlock repair now crosses the deterministic command boundary instead of silently changing exit, hazard, and counter state in renderer continuation code:

1. `run.progression_repair` accepts only when the pure repair transition finds a concrete stale exit requirement or enemy-hazard occupancy; healthy runs reject without state or journal noise.
2. The repair transition records ordered repair kinds, exact exit lock and lever-count before/after values, defeated hazard identities, and all affected enemy-counter deltas.
3. `run.progression_repaired` carries that complete diff under a `progression_safety` source, followed by typed feedback that names the automatic reachability repair.
4. Primary resolution and level-complete continuation now call one journaling adapter; they retain presentation, achievement, persistence, and navigation coordination without mutating board truth directly.
5. Stale terminal key locks become open only after progression pairs are exhausted, reachable or held keys remain authoritative, and final-pair boss hazards still update all established defeat counters exactly once.
6. Direct reducer and adapter tests prove legacy parity, effect-only acceptance, strict schema/event identity, bounded journals, and JSON-round-tripped replay.
7. The CLI headless simulation includes an accepted corrupted-board fixture containing both a stale iron exit lock and stale boss hazard, and fails if repair acceptance, schema validity, invariants, or replay diverge.

Graph v34 upgrades `safety.softlock_fairness` into a typed invariant and replayable repair gate connected to command ownership, exit reachability, HUD feedback, persistence, and deterministic simulation.

## Thirty-fifth vertical slice: Authoritative Board Turn Feedback Projection

Match and mismatch floaters now project the typed board-turn event instead of independently re-running gameplay rules or reconstructing consequences from mutable board snapshots:

1. `board.turn_resolved` now records the board level, exact two- or three-tile floater anchor, claimed findable and route identity, validated trait-interaction tags, and before/after streak, mismatch, shard, guard, life, and score counters.
2. The established match and mismatch transitions capture the interaction tags they actually applied. Gambit matches record only the selected matching pair as their score anchor, while Gambit misses retain all three tiles.
3. `resolveBoardTurnWithEvent` returns the journaled run together with the authoritative resolution event; state-only callers retain the existing compatibility wrapper.
4. `runResolutionController` passes that event to the floater projector. `matchScorePop` formats typed tags and reward identities but no longer calls `resolveTileTraitEffects` or recalculates gameplay effects.
5. Live floater keys use the deterministic command id rather than wall-clock time, so identical accepted transitions retain stable presentation identity.
6. Core tests prove ordinary route/findable/trait/resource facts, mismatch chain-break facts, Gambit anchors, strict schema validity, and JSON replay equality. Renderer tests prove the exact event drives HUD copy and audio payoff coordination.
7. The core gate now includes the dedicated floater projection suite, keeping this feedback ownership boundary under architectural drift enforcement.

Graph v35 adds `feedback.board_turn_floater` and connects authoritative turn facts to HUD projection, bounded persistence, and deterministic replay.

## Thirty-sixth vertical slice: Event-Only Board Turn Feedback Boundary

The board-turn floater strangler no longer retains a renderer-side state reconstruction path:

1. `buildMatchScorePopPayload` and `buildMismatchScorePopPayload` accept only the typed `board.turn_resolved` event plus an optional deterministic test nonce; they no longer accept before/after `RunState` snapshots.
2. Anchor selection, claimed findable and route identity, trait tags, score, streak, shard, guard, life, and mismatch changes all come exclusively from the event envelope.
3. Wall-clock keys were removed from the projector. The command id is now the production identity for both match and mismatch floaters.
4. `runResolutionController` projects only when the core returns a resolution event. A rejected or unmigrated compatibility transition cannot synthesize authoritative feedback from board diffs.
5. Existing presentation scenarios remain readable through a test-only event factory; it converts fixture state into the same event contract before invoking production code and is not bundled at runtime.
6. `board-turn-feedback-boundary.test.ts` reads the production sources and fails if `RunState`, board-anchor helpers, pickup-diff detection, trait effect resolution, wall-clock identity, or state-shaped controller calls return.
7. The gameplay-core gate executes the new boundary test alongside event projection, controller, replay, and simulation coverage.

Graph v36 upgrades `feedback.board_turn_floater` to an event-only projection boundary with explicit drift enforcement against renderer gameplay reconstruction.

## Thirty-seventh vertical slice: Event-Owned Pickup Feedback

Pickup feedback now shares the same schema-validated board-turn envelope as match and mismatch floaters instead of rediscovering claimed findables by comparing React board snapshots:

1. `gameplayFeedbackAdapter` exposes the latest valid `board.turn_resolved` event from the bounded journal and ignores malformed persisted entries.
2. `GameScreen` keys pickup toasts by deterministic event id and reads the claimed findable identity directly from `matchedFindableKind`; it no longer retains previous tiles or scans pair state.
3. The polite live-region hook consumes the same typed event, suppresses stale history on mount, and coordinates with same-command `feedback.requested` events to avoid duplicate screen-reader announcements.
4. The obsolete `detectClaimedFindableKind` renderer rule and its `Tile` dependency were removed from production copy and hook modules.
5. Focused adapter, screen, and accessibility tests prove invalid-event rejection, exact pickup identity, stable deduplication, and reward-stack copy.
6. The board-turn ownership test reads all affected production sources and fails if board-diff helpers or snapshot refs return.
7. Graph v37 broadens `feedback.board_turn_floater` into event-only multi-surface board-turn feedback, covering visual floaters, pickup toasts, accessible announcements, replay, and drift enforcement.

## Thirty-eighth vertical slice: Replay-Stable Pickup Toast Context

Pickup toast copy no longer mixes event-owned identity with live run counters:

1. `board.turn_resolved` now carries claimed-findable and total-findable counters before and after every accepted turn alongside its existing streak, shard, life, and identity facts.
2. The reducer records those counters from the exact transition inputs and outputs, so replay preserves pickup progress without consulting a later mutable run snapshot.
3. `getPickupStackToastText` accepts only `BoardTurnResolvedEvent` and derives reward identity, chain forecast, lives, and pickup progress from that envelope.
4. The `GameScreen` pickup effect retains only run identity/current-board guards and reduced-motion timing; it no longer passes score, inventory, life, or findable state into the toast formatter.
5. Core tests prove the `0 → 1 of 1` pickup transition, while renderer fixtures and UI coverage exercise the stricter schema across floaters, accessibility, and stacked toast copy.
6. The source-reading boundary test rejects restoration of the former state-shaped toast input and requires all four findable counter facts in schema and reducer ownership.
7. Graph v38 marks board-turn feedback as an event-only, replay-stable multi-surface projection and adds the `event-only-pickup-toast-context` drift guard.

## Thirty-ninth vertical slice: Event-Owned Board Turn Live Narration

The HUD live region now narrates accepted board turns from the same schema-validated event as visual floaters and pickup toasts, rather than inferring gameplay consequences from cumulative React snapshots:

1. `board.turn_resolved` contains a strict nested announcement snapshot with exact pair progress, currencies, charges, Stasis state, applied trait kinds, objective progress, Recall state, forgotten tiles, and enemy outcomes before and after the transition.
2. `getBoardTurnAnnouncementFacts` captures those values at the core boundary and normalizes optional or malformed legacy counters before the event enters bounded persistence and replay.
3. `buildBoardTurnAnnouncement` is a pure event-only projector that orders match or mismatch, traits, resources, objectives, Recall consequences, enemy outcomes, pickup identity, and payoff intensity into one deterministic message.
4. Same-command `feedback.requested` copy is consumed exactly once by that projector, so accessible feedback does not repeat rewards already described by the board event.
5. The live-region hook still observes snapshots for genuinely non-turn actions such as shops, powers, and enemy contact, but advances past board-turn snapshots without reconstructing their consequences.
6. Removed hook inputs and dead trait-diff helpers make the ownership boundary explicit; source-reading checks reject restoration of board-turn counter subtraction, trait-counter inference, or state-shaped `GameScreen` inputs.
7. Fact-capture, copy, core, hook, and architectural boundary tests are part of the gameplay-core gate, while the semantic model records every narrated state fact and its exact implementing and testing files.

Graph v39 upgrades `feedback.board_turn_floater` into an event-only authoritative board-turn narration projection with explicit guards against HUD snapshot inference and duplicate accessible narration.

## Fortieth vertical slice: Typed Command Live Feedback Boundary

Accepted non-turn commands now reach the HUD live region through their schema-validated feedback event without being augmented by mutable React state deltas:

1. `buildGameplayEventAnnouncement` projects exact core-owned copy, warning priority, and a replay-stable dedupe key from the typed feedback event alone.
2. The live-region hook processes that projection independently, marks the same transition consumed by the legacy action snapshot, and advances the snapshot without narrating inferred resource, health, objective, Recall, or enemy deltas a second time.
3. State-only mutations still retain the former fallback during the strangler migration, but its keys and tests now identify it explicitly as `legacy-action` rather than presenting it as equivalent to typed truth.
4. Peek, Destroy Pair, Stray Remove, full shuffle, row shuffle, tile swap, and Undo events now require Recall-focus and unstable-memory counts before and after the action; their feedback messages expose that complete memory-aid consequence.
5. Enemy contact events now retain the moving-enemy hit counter before and after guard-first damage resolution. Shop purchase feedback includes the item, exact spend, and remaining wallet.
6. Focused hook tests prove typed shop, enemy, reward, and power feedback wins over simultaneous snapshot changes while legacy-only recovery and resource tests remain intact.
7. A source-reading boundary rejects renderer state dependencies in the typed projector, restoration of feedback-plus-snapshot message assembly, and incomplete power consequence contracts.
8. The gameplay-core gate runs the new projector and boundary suites, and replay parity tests validate the stricter event payloads and exact feedback copy.

Graph v40 adds `feedback.typed_command_announcement`, connecting typed commands, tile contact, powers, shops, and moving hazards to accessible HUD feedback, bounded persistence, deterministic replay, and explicit anti-inference guards.

## Forty-first vertical slice: Complete Board Turn Consequence Envelope

Hazards, scouts, route specials, defensive wards, and chain milestones now join match rules and rewards in one replay-stable board-turn narration instead of running six additional React counter observers:

1. `board.turn_resolved.announcement` now requires nested before/after counters for every hazard-tile outcome, Lantern Ward and Omen Seal scouts, Mimic Cache claims and bites, five route-special payoffs, and Guard Cache ward use.
2. `getBoardTurnAnnouncementFacts` captures those counters directly from the reducer input and output, preserving exact turn ownership even when several consequences fire together.
3. `buildBoardTurnAnnouncement` projects hazard copy in stable gameplay order, retains reduced-motion variants, reports every simultaneous route-special payoff, and gives Mimic bites warning priority without consulting live health or guard state.
4. Chain thresholds and breaks now use `currentStreakBefore` and `currentStreakAfter` from the same event. A turn that crosses a threshold reports its match, build payoff, next reward target, and other consequences in one message.
5. The hook removed chain, hazard, scout, Mimic, route-special, and ward refs and effects. `GameScreen` no longer passes any of their cumulative counters into the accessibility boundary.
6. Deep-partial test fixtures keep strict production events readable while always filling the complete nested schema; core fact tests verify the normalized source snapshot rather than constructing renderer-shaped state.
7. Focused projector, hook, adapter, GameScreen, core, and source-boundary coverage proves stable ordering, late Fuse copy, reduced motion, multi-scout turns, controlled and biting Mimics, stale-event suppression, and complete route-special narration.
8. Architectural enforcement rejects restoration of the removed counter props, snapshot refs, renderer hazard-copy dependency, or chain-threshold reconstruction.

Graph v41 upgrades `feedback.board_turn_floater` into the complete event-only board-consequence projection and connects hazard pressure, moving enemies, safe wards, and route payoffs to the same persisted and replay-tested feedback boundary.

## Forty-second vertical slice: Lossless Typed Command Feedback Batches

Compound accepted commands now retain every ordered feedback consequence at the renderer boundary instead of exposing only the final `feedback.requested` event:

1. `getLatestGameplayFeedbackBatch` validates the bounded event journal, selects the latest feedback-producing command, and preserves all of that command's feedback in journal order.
2. `buildGameplayEventBatchAnnouncement` joins the exact typed messages under one replay-stable command key, ignores duplicate persisted event identities, and promotes the batch to error priority when any member is a warning.
3. `GameScreen` passes the complete batch to the HUD and searches that same batch for relic-offer audio, so presentation consumers no longer depend on a lossy latest-event projection.
4. Board narration consumes every same-command proc message before projecting its complete turn facts, records all consumed event IDs, and excludes unrelated command feedback.
5. `floor.parasite_advance` now emits a typed one-floor-before-drain warning when pressure reaches three, alongside its existing ward and life-loss outcomes.
6. The HUD's score-parasite snapshot ref, active flag, pressure counter, ward counter, and level-delta effect were removed; typed floor events now own warning, protection, damage, and floor-ready narration.
7. Focused tests prove multi-feedback floor ordering, strongest priority, duplicate filtering, stale-first-render suppression, board proc losslessness, strict core replay, and the absence of retired renderer inference.
8. The legacy action snapshot remains only for still-untyped state mutations and is advanced—not narrated—whenever any event in a new typed command batch arrives.

Graph v42 upgrades typed command feedback to a lossless command-scoped projection, connects floor flow and Score Parasite directly to it, and adds guards for journal ordering, compound-feedback completeness, strongest-priority propagation, stale-history suppression, and the removal of parasite snapshot ownership.

## Forty-third vertical slice: Strict Event-Only HUD And Feedback Completeness Gate

The last React gameplay-delta narrator is gone, backed by a deterministic audit that fails when accepted commands change accessibility-critical state without authoritative presentation:

1. `getGameplayFeedbackCriticalSnapshot` normalizes the exact health, guard, shard, gold, objective, Recall, forgotten-memory, and enemy-outcome fields formerly compared inside the HUD hook.
2. `getGameplayFeedbackObjectiveSnapshot` is shared by board-turn event capture and the audit, eliminating duplicate dungeon-versus-trait-route objective selection logic.
3. `inspectGameplayFeedbackCompleteness` compares before/after critical snapshots and returns the exact command id, command type, changed fields, emitted event types, and a machine-readable failure message.
4. Rejected and normalized no-op transitions owe no feedback. Meaningful accepted transitions must emit either `feedback.requested` or the authoritative `board.turn_resolved` envelope.
5. The seeded core simulation applies this invariant after every reduced command, so a missing feedback path becomes an ordinary deterministic `invariantViolations` failure and replay gate regression.
6. `useHudPoliteLiveAnnouncement` removed `actionSnapRef`, its consumed-event bookkeeping, all gameplay delta calculations, and the `legacy-action` dedupe path.
7. `GameScreen` no longer passes lives, currencies, objective counters, Recall fields, shuffle state, or enemy counters into the announcement hook. React now supplies only typed events plus timer and Gambit presentation signals.
8. Dedicated unit, simulation, hook, GameScreen, and source-boundary tests prove exact diagnostics, accepted presentation paths, normalization, seeded corpus coverage, and architectural non-regression. The new suite is part of `gate:gameplay-core`.

Graph v43 adds `safety.feedback_completeness`, upgrades the gameplay HUD to a strict event-only readability gate, and links deterministic commands, board turns, typed announcements, simulation, and the HUD through explicit audit, gate, guard, and `tested_by` relationships.

## Forty-fourth vertical slice: Three Distinct Typed Build Strategy Gate

The platform now proves three retained gameplay builds through executable command/event loops instead of relying on build labels or route-risk profiles as evidence of build viability:

1. `GAMEPLAY_BUILD_STRATEGIES` maps each evaluated build to a shipped starting loadout, schema-validated activation definitions, one authoritative consequence command, and its expected event fingerprint.
2. Conduit Cartographer starts from Memory Scout, claims Echo Conduit Lens, triggers Echo beside Conduit, and spends the resulting information resource through `board.peek` → `board.peeked`.
3. The Warden starts from Cursebreaker, claims Hazard Ward, triggers Volatile beside Heavy, and spends its control resource through `board.destroy_pair` → `board.pair_destroyed`.
4. The Vaultbreaker starts from its matching loadout, claims treasure and Cursed Opener sources, triggers the clean Cursed payoff, and spends earned gold through `shop.purchase` → `shop.offer_purchased`.
5. Every seed records the exact commands, events, feedback cues, acceptance results, remaining lives, schema/order diagnostics, and JSON-round-tripped replay result. The existing feedback-completeness invariant audits each reduced transition.
6. Viability requires a complete accepted chain, a live run, at least three typed feedback events, an accepted downstream consequence, no invariant violations, and exact replay on every sampled seed.
7. Distinctness comes from typed event axes—information, control, and economy. The gate requires a unique dominant axis for each build and a pairwise presence distance of two, so renamed copies or overlapping resource loops cannot satisfy the requirement.
8. `sim:build-strategies` emits a queryable JSON summary and exits nonzero on drift. `gate:rewards-economy` runs the focused tests and simulation, while exact build/seed diagnostics identify a failed consequence, feedback gap, replay divergence, or collapsed strategy identity.

Graph v44 expands `simulation.build_evaluation` from route-only profile outcomes into a combined route-profile and three-build command/event viability gate, connecting the core, replay, event-only HUD, Conduit Cartographer, Warden, Vaultbreaker, economy, and fairness checks.

## Forty-fifth vertical slice: Generated-Board Command Playthrough Gate

Generated-board fairness now executes the same serializable command/event boundary as live play instead of relying on direct compatibility transitions:

1. `solveRunThroughGameplayCoreWithTrace` exhausts a board through typed memorize completion, tile flips, delayed turn resolution, progression repair, and exit activation commands.
2. Every step validates command and event schemas, deterministic event identity and order, accepted/rejected agreement, nonnegative run inventory, stable run identity, and typed feedback completeness.
3. The planner respects live Stasis behavior by placing the currently sticky-blocked tile second; seeded parity coverage compares the final gameplay state and stop reason with the retained legacy solver before that compatibility path can be removed.
4. Exact commands, events, accepted and rejected command IDs, stop diagnostics, and invariant violations remain queryable. Full verification JSON-round-trips the command list and compares the complete run, event sequence, and acceptance ledger.
5. The feedback audit exposed an existing `reveal_unknowns` gap: ordinary tile reveals could advance the dungeon objective without an authoritative presentation event. Tile-flip reduction now emits `objective.progress.changed` with the exact label and progress whenever that snapshot changes.
6. The softlock generator contract and endless simulation now use the command solver. Direct `flipTile`/`resolveBoardTurn` playthrough remains only as parity evidence during the strangler migration.
7. Long-run simulation executes all command, schema, event-order, feedback, inventory, and fairness invariants on every selected playable floor. It fully replays the first 24 floors, every boss floor, and each hundredth-floor checkpoint, and exposes `replayCheckedFloors` as a gated CSV and health-report metric.
8. Focused tests prove simple exit activation, typed stale-boss repair, generated-board parity across seeds and depths, explainable no-exit/no-progress stops, optional replay sampling, consumer source boundaries, and the missing objective-feedback regression.

Graph v45 adds `simulation.generated_board_playthrough` and connects typed tile input, turn resolution, exits, feedback completeness, floor progression, softlock/topology safety, and sampled deterministic replay through source-referenced `tested_by` and `guarded_by` relationships.

## Forty-sixth vertical slice: Multi-Floor Three-Build Playthrough Gate

The three retained build proofs now traverse the real floor loop instead of stopping after one injected payoff:

1. `build-strategy-playthrough-simulation` carries Conduit Cartographer, Warden, and Vaultbreaker through generated boards, typed turns, route decisions, side-room resolution, the floor-three relic milestone, and typed floor advancement.
2. Every floor retains its exact commands, events, completion stop reason, schema/feedback invariants, observed mutator matchup, lives, score, turn cost, and isolated JSON replay checkpoint.
3. The complete multi-floor command list also replays from one deterministic stocked initial run, with globally unique solver command and event identities that include the board floor.
4. Strategy evidence comes from authoritative events: Peek usage and Echo/Conduit tags for information, Destroy usage and Mirror/Stasis guard tags for control, and shop spending plus Cursed/Volatile or Sealed/Heavy tags for economy.
5. The Warden policy exposed and fixed a cohesion failure: eager Destroy could erase its seeded Mirror/Stasis setup. Destroy now waits for a non-synergy pair, preserving the recurring guard payoff while still spending the control resource.
6. Matchup distributions report shipped memory pressure, hazard pressure, bosses, economy opportunities, or neutral floors without inventing unsampled counterfactuals.
7. Balance summaries retain min/mean/max turns, commands, lives, and score plus pairwise mean-turn ratios. The current gate requires complete floors, exact replay, at least one downstream consequence per build/seed, and at least one real recurring synergy per build.
8. `sim:build-strategy-playthroughs` emits the queryable three-seed/four-floor report and is part of `gate:rewards-economy` alongside the original structural proof.

Graph v46 upgrades `simulation.build_evaluation` into a multi-floor command/event viability, matchup, balance, synergy, and replay gate connected to generated-board playthrough, run flow, board-turn facts, relic drafting, three cohesive builds, and deterministic replay.

## Forty-seventh vertical slice: Typed-Only Renderer Board Input Boundary

The live board no longer reaches through compatibility exports for its highest-frequency gameplay mutations:

1. `applyTileFlipThroughGameplayCore` is the shared adapter for ordinary presses, Gambit's committed third press, and dungeon exit, shop, and room reveals.
2. `applyDestroyPairThroughGameplayCore` owns Destroy command construction, reduction, journal persistence, and the exact current-command event result.
3. `runSurfaceState` no longer imports `flipTile` or `applyDestroyPair`; its audio and completion decisions consume the typed adapter result.
4. Destroy feedback no longer scans the retained event journal and reparses historical entries to recover the current action. The reducer's event batch is returned directly, avoiding retention- and command-id-coupled presentation logic.
5. `dungeonPressSurfaceState` uses the same typed flip path as ordinary cards, so exit, shop, and side-room board interactions cannot bypass the replay boundary.
6. Existing deterministic command IDs, command/event journals, tile outcomes, floor completion, trap behavior, and Gambit intent-before-flip ordering are preserved.
7. A source-boundary test rejects renderer imports of the legacy mutation names while requiring both typed adapters, alongside behavioral coverage for ordinary, power, hazard, Gambit, exit, shop, and room presses.

Graph v47 strengthens `core.tile_input` with explicit renderer-command-only, no-compatibility-import, and current-command-event guards across the shared adapter and both live board presentation surfaces.

## Forty-eighth vertical slice: Transient Surface Intent Ownership

Board-power arming is now treated as short-lived interface intent instead of durable gameplay truth:

1. Live Stray Remove arming belongs to `RunSurfaceState.strayRemoveArmed` in Zustand and is initialized, toggled, reset, and cleared alongside Peek, Destroy, Pin, and Swap surface modes.
2. `GameScreen`, `GameLeftToolbar`, tile hints, and the tile-press controller consume the transient surface flag; production renderer code no longer reads or writes `run.strayRemoveArmed`.
3. At Graph v48, the serialized `RunState.strayRemoveArmed` field and the legacy pure helper's armed-by-default precondition remained temporarily during the strangler migration; Graph v62 removes both after proving the renderer boundary.
4. A typed `board.stray_remove` command is self-contained player intent. Core reduction preserves every target, charge, route-anchor, completion-safety, and feedback rule without consulting interface state.
5. Successful actions, mode changes, hazards, run transitions, and mutual-exclusion helpers clear the transient flag without changing replayable run state.
6. Region Shuffle already submits a row directly through a typed command. Graph v48 removed its unused renderer arm action and state writer; the durable compatibility field/helper were subsequently removed in Graph v63.
7. Source-boundary tests reject live renderer reads of the serialized Stray arm field and reject reintroduction of the dead Region Shuffle arm action, while behavioral tests prove command independence and transient-state cleanup.

Graph v48 records transient intent ownership, typed-command independence from UI arm flags, the no-live-serialized-arm boundary, and direct Region Shuffle row commands across the core, store, presentation, and test evidence.

## Forty-ninth vertical slice: Direct Renderer Turn Resolution

The delayed match/mismatch boundary now enters the gameplay core directly from the renderer:

1. `runResolutionController` calls `resolveBoardTurnThroughGameplayCore` instead of importing the `resolveBoardTurnWithEvent` compatibility facade.
2. The adapter owns deterministic `board.turn_resolve` command identity, reduction, exact current-command events, and outer command/event journal persistence.
3. Match and mismatch floaters are built from the `board.turn_resolved` event returned by that exact reduction, preserving event-only feedback without scanning retained history or diffing state snapshots.
4. The legacy `resolveBoardTurnWithEvent` and `resolveBoardTurn` exports remain for non-renderer compatibility callers, but now reuse the already-journaled adapter result rather than appending the outer command a second time.
5. Source-boundary coverage rejects reintroduction of the renderer compatibility import and requires the direct adapter, while behavioral coverage proves the outer turn command is retained with its authoritative feedback facts.

Graph v49 marks board-turn resolution as a renderer-direct command adapter with adapter-owned journaling and a no-renderer-compatibility-import guard.

## Fiftieth vertical slice: Long-Horizon Build Policies And Shipped Counter-Matchups

The build gate now evaluates sustained policy behavior and explicit pressure hypotheses instead of repeating a four-floor perfect-information script:

1. `GAMEPLAY_BUILD_POLICIES` exports deterministic policy definitions for Conduit Cartographer, Warden, and Vaultbreaker, including route ranking, side-room reward priorities, relic priorities, shop-item priorities, signature timing, one favorable matchup, and one counter matchup.
2. Policies choose only from real generated route, side-room, relic, and shop options. Side-room candidates are previewed through the pure typed reducer, preventing stale read-model eligibility from cascading into rejected interlude commands.
3. Every policy decision records floor, observed matchup, phase, selection, application result, and reason beside the retained command/event trace.
4. The default gate horizon increases from four to twelve floors across three seeds: 108 generated floors total, with isolated floor replay plus full multi-floor JSON replay.
5. The gate requires actual shipped exposure to each declared favorable and counter pressure, complete/replay-clean counter floors, at least one policy decision per attempted floor, zero rejected commands, recurring synergy, signature consequences, and the existing pairwise balance envelope.
6. Counter labels remain explicit design hypotheses. The report does not turn perfect-information survival into a synthetic human win-rate or claim that unsampled schedule buckets occurred.
7. The first long sweep exposed a real feedback omission: final-pair enemy blockers could be defeated during `board.tile_flip` without typed presentation. `board.tile_flipped` now carries exact defeated IDs and before/after enemy counters, plus `hazard.enemy_blocker.cleared` feedback.
8. The repaired default report completes all 108 floors with exact replay, zero rejected commands, and observed counter samples for every build.

Graph v50 upgrades `simulation.build_evaluation` to a twelve-floor legality-aware policy and shipped counter-matchup gate, requires unique strictly increasing floor identities so a stalled interlude cannot inflate the horizon, and adds exact final-pair enemy-defeat facts/feedback guards to `core.tile_input`.

## Fifty-first vertical slice: Bounded-Memory And Risk-Budget Playthroughs

The retained build gate no longer chooses board pairs from hidden `pairKey` groups:

1. `solveRunThroughGameplayCoreWithTrace` keeps perfect-information behavior as its default for legacy parity, topology, and exhaustive fairness callers, while accepting an optional bounded-memory information policy for strategy evaluation.
2. Bounded policies retain only a capped transient tile ledger from the memorize phase. Runtime observations enter the ledger only through active flips or explicit Peek/Flash assistance; resolved traps and passively exposed cards cannot be replayed as actionable pairs.
3. A known pair may be selected only from observed ledger entries. An unknown choice is ranked by visible tile ID/order from engine-provided structural eligibility and never groups unobserved identities by `pairKey`.
4. Every unsupported second choice consumes one deterministic uncertain-turn unit. Each build has an explicit ceiling—20 with 10 remembered tiles for Conduit Cartographer, 24/8 for Warden, and 28/6 for Vaultbreaker—and the solver stops with `risk_budget_exhausted` instead of silently borrowing hidden information.
5. Solver traces expose initial playable/remembered tiles, observations, evictions, maximum ledger size, uncertain turns, and budget exhaustion beside the exact command/event replay.
6. The action loop handles self-resolving traps, passive face-up cards, progression repairs, and a mid-turn transition to `resolving` before seeking another tile. These cases were found by the bounded policy rather than by synthetic fixtures alone.
7. The default 108-floor gate remains complete with zero rejected commands, zero budget exhaustion, and exact replay. It records 108 uncertain turns for Conduit Cartographer, 116 for Warden, and 169 for Vaultbreaker across 24, 24, and 30 genuinely imperfect-information floors respectively.
8. These deterministic bounded-memory traces are stronger structural evidence than perfect-information survival, but remain simulator behavior—not measured player win rate or final difficulty balance.

Graph v51 records the optional perfect/bounded solver modes, capped observation ledger, identity-blind unknown choices, uncertain-turn budgets, imperfect-information minimums, and mid-turn resolution guard across generated-board and build-evaluation simulations.

## Fifty-second vertical slice: Visible-Resource Interlude Risk And Route Gambler Gap

Long-horizon policies now make route and side-room decisions from visible survival resources instead of following a static reward preference:

1. Every generated route is previewed through `applyRouteChoiceOutcome` and `openRouteSideRoom`, so policy assessment uses the same typed rules as the applied command and rejects stale or non-opening choices.
2. Each build owns a route-risk cap and minimum effective-survival reserve. Effective survival combines lives with a bounded contribution from visible guard tokens, floor hazard ward, parasite ward, and Destroy charges; hidden board identities never enter the route decision.
3. Conduit Cartographer and Warden accept at most one risk unit and preserve four effective survival. Vaultbreaker accepts two risk units and preserves five, with one explicit opening-floor Greed credit that retains real economy exposure without exempting later choices from the reserve.
4. Every route decision retains all candidate assessments: legality, risk units/cap, before/after lives and protection, effective survival, acceptance, and reason. The default report records 240 assessments, 48 policy rejections, and one actual adaptive switch—Vaultbreaker seed `42123`, floor 5, rejects Greed for the floor-6 transition and chooses Mystery.
5. Side-room claims are also pure-reducer previews. Rest stops are spent only while wounded, bonus rewards remain build-ranked and command-legal, and event rooms recover their actual deterministic effects from `rollRunEventRoom` rather than inferring value from presentation labels.
6. Event priorities remain build-specific, but `heal_or_guard` moves to the front whenever visible effective survival is below reserve. Current event effects are beneficial resources; this is resource selection evidence, not a fabricated downside model.
7. The gate requires route assessments and rejections for every strategy, at least one assessed side room per seed, at least one adaptive route selection report-wide, complete 108-floor play, zero rejected gameplay commands, and exact replay.
8. The report now names the next cohesive coverage gap instead of overclaiming it: Route Gambler's shipped `route_tactician`, Wager Surety, Risk Wager, Gambit Token, Gambit, and Mystery-route pieces exist, but the build is not yet sampled by the long-horizon policy gate. Its proposed distinct axis is `risk_conversion`, with `economy_opportunity` favorable and `hazard_pressure` counter hypotheses.

Graph v52 adds typed route-outcome previews, visible-resource budgets, survival reserves, bounded opening risk, adaptive selection, actual event-effect ranking, recovery-below-reserve, and a machine-readable next-build gap. `simulation.build_evaluation` no longer lists Route Gambler as covered; a `gates` edge marks it as the next unsampled candidate.

## Fifty-third vertical slice: Route Gambler Risk-Conversion Build

Route Gambler is now the fourth retained long-horizon build, connecting the previously separate wager, Gambit, Favor, loadout, trait, and route pieces:

1. The structural build evaluator adds a fourth `risk_conversion` axis. Route Tactician plus Wager Surety prepares a real resolving board, submits `board.gambit_commit`, emits its typed commitment event, and remains pairwise distinct from information, control, and economy fingerprints.
2. The bounded-memory solver accepts an explicit `first_uncertain_mismatch_rescue` Gambit policy. It chooses the uncertain second card and potential third target by visible tile order and its observation ledger, never by grouping hidden `pairKey` identities.
3. A Gambit trace submits the commitment command before the third flip, follows through the normal tile-flip and turn-resolution commands, consumes the one-floor token through existing rules, and remains exactly replayable.
4. Route Gambler starts from the shipped Route Tactician loadout with Wager Surety active, prefers Greed then Mystery subject to the same visible survival reserve, prioritizes Favor/event resources, and retains Drift/Volatile/Heavy trait interactions as recurring board cohesion.
5. Actual `risk_wager.accept` commands occur only when the shipped featured-objective streak rule says the wager is eligible. The following floor resolves the wager through normal floor-clear logic; Wager Surety's Favor-on-win or streak-floor-on-loss events provide the retained conversion evidence.
6. The policy suppresses Gambit under `hazard_pressure`. An early far-edge experiment exposed two `missing_pair_tile` stops on hazard floors; the final counter policy treats hidden hazard cards as a reason to conserve the one-floor rescue, while still completing and replaying every hazard matchup.
7. The default report now covers four builds × three seeds × twelve floors: all 144 floors complete with zero rejected commands and exact replay. Route Gambler records 9 Gambit commits, 19 accepted wagers, 13 insured wins, 5 insured losses, 3 favorable economy floors, and 21 completed hazard-counter floors.
8. Pairwise mean-turn ratios remain between 1.00 and 1.12. These are deterministic policy traces and explicit matchup hypotheses, not player win-rate or final balance claims.

Graph v53 promotes Route Gambler from an unsampled `gates` edge to tested long-horizon coverage, adds the fourth strategy and risk-conversion guards, and records identity-blind Gambit targeting, commit-before-third-flip ordering, one-floor token use, wager outcomes, and hazard-matchup suppression.

## Fifty-fourth vertical slice: Combo Shard Sustain-Conversion Build

The Combo Shard Engine is now the fifth retained long-horizon build, connecting authored shard sources, capped inventory, board streaks, route risk, life recovery, and parasite pressure:

1. The structural evaluator adds a fifth `sustain_conversion` axis. The Catalyst activates the shipped Bonus Shards reward and Combo Shard + Step relic definitions, resolves a real matching turn from a one-life deficit and two-shard bank, and observes the third effective shard convert into one life through `board.turn_resolve` / `board.turn_resolved`.
2. The long-horizon policy starts with the Vaultbreaker loadout and the actual Combo Shard + Step relic, prefers Greed then Mystery, ranks Bonus Shards and Shard Spark resources, and retains Sealed/Heavy/Conduit interactions instead of injecting signature effects outside normal commands.
3. Its normal route cap is one risk unit with a five-point effective-survival reserve. An explicit `conversionRiskCredit` allows Greed above that cap only while the visible shard bank is full; once the bank is spent, later over-budget Greed routes are rejected and the policy adapts to Mystery or Safe.
4. The favorable hypothesis is `economy_opportunity`, where a full shard bank can fund an intentional Greed cost before normal play restores life. The counter hypothesis is `parasite_pressure`, recognized from the shipped Score Parasite floor and completed through the same bounded-memory command stream.
5. Source evidence includes typed Combo Shard requests and positive shard inventory changes from Bonus Shards, Combo Shard + Step, Shard Spark, and clean streak play. Conversion evidence requires an authoritative board-turn event where life increases while the shard bank decreases.
6. The default report now covers five builds x three seeds x twelve floors: all 180 floors complete with zero rejected gameplay commands and exact replay. Combo Shard Engine completes all 36 of its floors, records 18 shard-source events, 22 shard-to-life conversions, 116 policy decisions, 6 over-budget route rejections, 6 adaptive selections, 2 favorable economy floors, and 3 completed parasite-counter floors.
7. Pairwise mean-turn ratios remain between 1.00 and 1.12. These traces prove deterministic cohesion and explicit matchup exposure; they do not claim human win rate or final balance.

Graph v54 adds five-strategy and sustain-conversion guards, full-shard Greed credit, third-shard life conversion, parasite-counter coverage, build-specific source/conversion reports, and a tested edge from the evaluator to `build.combo_shard_engine`.

## Fifty-fifth vertical slice: Free Targeted Reconfiguration Ownership

The Trap Control audit found and closed a shipped source-to-command break before adding a sixth simulation policy:

1. Route Tactician and Free Swap Discipline already granted `free_first_swap_per_floor`, and floor setup correctly rearmed `regionShuffleFreeThisFloor`.
2. Row-shuffle and tile-swap legality nevertheless recognized that free flag only when the separate `region_shuffle_free_first` relic was owned. After the loadout's initial paid charge, the perk advertised a free use that its commands could not spend.
3. One shared `hasFreeTargetedReconfiguration` rule now recognizes either the durable reward perk or the relic, while still requiring the per-floor flag, a clear flip state, legal hidden targets, and no `noShuffle` contract.
4. Both pure actions consume the free flag before paid row/swap charges. Typed `board.region_shuffle` continues to emit `usedFreeCharge: true`, zero inventory spend, deterministic tile IDs, feedback, and exact replay.
5. Power teaching consumes the same shared availability rule and now describes free uses as build effects rather than relic-only behavior.
6. Availability, pure action, command reducer, teaching projection, and graph tests cover both source paths. The focused gate passes 86 tests across those boundaries.

Graph v55 adds reward-perk-or-relic and free-before-paid guards to targeted reconfiguration, connects reward perk state to both powers' read sets, and records the command and presentation tests that enforce the complete source/effect/consequence loop.

## Fifty-sixth vertical slice: Trap Control Board-Reconfiguration Build

The Saboteur is now the sixth retained long-horizon build, using the corrected renewable Free Swap loop as a distinct board-reconfiguration policy rather than duplicating the Warden's Destroy signature:

1. The structural evaluator adds `board_reconfiguration` as a sixth axis. Route Tactician activates Trait Toolkit and Free Swap Discipline, preserves its paid row/swap charge, and spends the renewable free use through `board.region_shuffle` / `board.region_shuffled` with exact replay and typed feedback.
2. The long-horizon policy prioritizes Safe then Mystery routes, Free Swap Discipline, Trait Toolkit, Stasis Lockbox, Hazard Banisher, region-shuffle relics, and targeted-control shop inventory.
3. The favorable hypothesis is `hazard_pressure`. Before board play, the policy chooses a legal row with at least two hidden tiles, preferring the row with the most visible hazard markers, and submits one typed row-shuffle command.
4. The counter hypothesis is `memory_pressure`. The policy explicitly conserves targeted reconfiguration on those floors because spatial disruption compounds short-memorize and recall pressure; normal bounded-memory play still completes and replays the floor.
5. Signature evidence counts only accepted `board.region_shuffled` or `board.tiles_swapped` events and build-sourced region-charge/perk facts. Incidental Peek or score attached to mixed rewards does not define the axis fingerprint.
6. The default report now covers six builds x three seeds x twelve floors: all 216 floors complete with zero rejected gameplay commands and exact replay. Saboteur completes all 36 of its floors, makes 123 policy decisions, rejects 33 over-budget route options, executes 12 hazard-pressure reconfigurations, and records 6 memory-pressure conservations.
7. All 12 favorable hazard floors and all 6 counter floors complete without life loss. Drift row-shuffle and Drift/Volatile full-shuffle tags recur on 9 favorable floors, while the worst pairwise mean-turn ratio remains 1.12.

Graph v56 adds the sixth strategy, distinct board-reconfiguration axis, renewable-source, hazard-use, and memory-conservation guards, build-specific evidence reports, and a tested long-horizon edge to `build.trap_control`.

## Fifty-seventh vertical slice: Boss Hunter Objective-Extraction Build

The Slayer is now the seventh retained long-horizon build, connecting boss preparation, objective wagers, trophy extraction, Favor insurance, and chapter-pressure relief:

1. The structural evaluator adds `boss_extraction` as a seventh axis. Memory Scout stocks Chapter Compass, Wager Surety, and Parasite Ledger; the typed trophy definition accepts only with an active Compass and claimed trophy, then emits the validated 30-score request and reward feedback.
2. Incidental Peek, Guard, and parasite ward grants from the three mixed relics remain useful secondary resources but do not define the axis fingerprint. Pairwise structural distance remains 2 against every retained build.
3. The long-horizon policy prioritizes Safe then Mystery routes, recovery/Favor event effects, boss-preparation rewards, and Peek/healing shop resources. It starts with the three actual relics so their floor-clear hooks—not synthetic state injection—provide consequence evidence.
4. The favorable hypothesis is `boss_pressure`. Claimed boss trophy caches invoke Chapter Compass through the normal board-turn/floor-clear envelope; evidence requires `score.requested` with reason `boss_trophy` and the Compass source.
5. The counter hypothesis is `parasite_pressure`. Completing the shipped featured objective with Score Parasite active invokes Parasite Ledger and requires an actual `parasite_relief.requested` event.
6. Wager Surety initially remained disconnected: the first healthy report recorded zero wagers. The final policy now submits eligible `risk_wager.accept` commands after clears and requires actual insured win/loss outcomes, keeping the relic inside the retained loop rather than counting its immediate Guard alone.
7. The default report covers seven builds x three seeds x twelve floors: all 252 floors complete with zero rejected gameplay commands and exact replay. Boss Hunter completes all 36 floors, makes 126 policy decisions, rejects 33 over-budget route options, converts 12 claimed boss trophies, emits 3 parasite-relief requests, and accepts 19 wagers with 13 insured wins and 5 insured losses.
8. All 12 boss floors and all 3 parasite-counter floors complete without life loss; Conduit/Echo synergy recurs on 11 boss floors, and the worst pairwise mean-turn ratio remains 1.12.

Graph v57 adds the seventh strategy, distinct boss-extraction axis, trophy, parasite-relief, insured-wager, and long-horizon guards, build-specific evidence reports, and a tested evaluator edge to `build.boss_hunter`.

## Fifty-eighth vertical slice: Memory Scout Mistake-Recovery Build

Memory Scout is now the eighth retained long-horizon build, connecting study-window counterplay, clean trait chains, deterministic recall, and bounded mistake recovery:

1. The structural evaluator adds `mistake_recovery` as an eighth axis. Trait Streak Lens grants the durable toolkit, a real x2 streak trigger banks a Flash charge, both study relic definitions are claimed, and `board.flash_pair` consumes the authored charge through the command core.
2. Lantern Study and Compressed Margins are stocked as actual relics, so the established +280 ms global and +220 ms Short Memorize rules remain authoritative rather than being simulated as parallel timing arithmetic.
3. The long-horizon policy spends Flash only on shipped `memory_pressure` floors. Clean trait matches renew the finite charge through `reward_perk.trait_streak_toolkit`, joining loadout, pickup, perk, inventory, and consequence in one trace.
4. The bounded-memory solver adds an opt-in `first_uncertain_mismatch_undo` policy. It chooses the second unknown from the opposite board edge without reading hidden identities and submits `board.undo_resolve` only after an observed mismatch enters resolving state.
5. Undo retains its shipped focus cost, forgotten-tile record, one-use floor reset, feedback, and replay contract. Boss-special floors suppress the automated policy because already-sprung special cards intentionally remain visible and are not safe generic pair-solver recovery targets.
6. The favorable hypothesis is `memory_pressure`; the counter hypothesis is `hazard_pressure`. Both must be sampled, completed, and replayed, while Flash and Undo each have per-seed evidence bounds.
7. The default report now covers eight builds x three seeds x twelve floors: all 288 floors complete with zero rejected gameplay commands and exact full-run replay. Memory Scout completes all 36 floors, makes 125 policy decisions, rejects 33 over-budget route options, spends 6 Flash charges and 11 Undo uses, and records 17 total signature consequences.
8. All 6 favorable memory-pressure floors and all 12 hazard-counter floors complete without life loss; clean-streak/recall synergy recurs on 2 favorable and 10 counter floors, while the worst pairwise mean-turn ratio remains 1.12.

Graph v58 adds the eighth strategy, opposite-edge identity-blind recovery, Flash/Undo evidence reports, boss-special suppression, Short Memorize relic counterplay, and a tested evaluator edge to `build.memory_scout`.

## Fifty-ninth vertical slice: Locksmith Lock-Extraction Build

The Locksmith is now the ninth retained long-horizon build, connecting Key Insurance, typed keys, board vendors, Master Key fallback, locked caches, and optional alternate extraction:

1. The structural evaluator adds `lock_extraction` as a ninth axis. Vaultbreaker and Key Insurance stock real typed keys, and the generated-board fixture spends an Iron Key on an affordable locked alternate exit through `dungeon.exit_activate` / `dungeon.exit_activated` with exact replay.
2. The bounded-memory solver adds an opt-in `prefer_affordable_lock_rewards` policy. It prefers matching typed keys, falls back to Master Key, and never consumes either resource when the lock cannot be afforded.
3. The policy visits real hidden board vendors through typed `run.pause`, `shop.purchase`, and `run.resume` commands. It reserves generic shop gold for Master Key instead of allowing unrelated purchases to erase the build's extraction option.
4. Affordable locked caches emit `dungeon.locked_cache_opened` with exact key, Master Key, gold, and score deltas plus typed feedback. Locked alternate exits use the established exit command, floor-clear consequence, feedback, persistence, and replay ownership.
5. The primary exit remains available throughout. The favorable hypothesis is `lock_pressure`; the counter hypothesis is `hazard_pressure`, where automation is suppressed and access resources are explicitly conserved rather than treated as mandatory survival costs.
6. Signature evidence counts only accepted cache/exit lock spends, Master Key purchases, and Key Insurance facts. Incidental economy gains from the mixed insurance reward do not define the axis fingerprint.
7. The default report now covers nine builds x three seeds x twelve floors: all 324 floors complete with zero rejected gameplay commands and exact full-run replay. Locksmith completes all 36 floors, uses 8 typed keys and 1 Master Key on locks, purchases 7 Master Keys, and records 13 hazard-pressure conservation floors.
8. All 9 favorable lock-pressure floors and all 13 counter floors complete within the shared bounds, and the structural build remains pairwise distinct from every retained strategy.

Graph v59 adds the ninth strategy, distinct lock-extraction axis, cache and alternate-exit spend guards, typed-key-first and Master-Key-fallback policy, vendor purchase evidence, hazard-pressure conservation, and a tested evaluator edge to `build.locksmith`.

## Sixtieth vertical slice: Conduit / Seer Information-Control Consolidation

Graph diagnostics selected a redundancy seam instead of another build: the declared Seer sources are now owned by the retained Conduit Cartographer information axis.

1. `build.reveal_scout` is removed from the executable graph. Echo Conduit Lens/Double, Scout Glint, deterministic Scout reveal, Memory Nail, typed Pin, Peek, Mystery routing, and future relic selection now converge on `build.conduit_cartographer`.
2. Stray Hook and completion-safe Stray Remove move to `build.emergency_toolkit`, where correction belongs, rather than remaining attached to a second information-build label with no long-horizon policy.
3. The structural Conduit fixture now claims the real `relic.pin_cap_plus_one` definition while starting with Memory Nail, so its capacity request, feedback, build source, and replay evidence are explicit.
4. The bounded-memory solver adds the opt-in `pin_next_known_pair` policy. It can pin only hidden tiles whose complete pair identity is already present in the observation ledger, caps automation at two placements per floor, and leaves default solver parity unchanged.
5. Pinned observations are protected from eviction. Ledger settlement now defers to the authoritative unresolved-playable-pair set instead of independently treating resolved dungeon metadata as proof that a hidden tile is no longer playable.
6. Conduit keeps a six-tile working ledger and Memory Nail's four simultaneous Pin slots. The policy annotates one genuinely remembered target pair, then normal command-core matching removes those Pins through established cleanup ownership.
7. Real board turns—not injected pickup state—record 9 Scout Glint matches across the three retained seeds. The build places 46 typed Pins, exercises Pins on both sampled memory-pressure floors, and suppresses automated Pins on all 13 hazard-pressure floors where board disruption makes annotations unreliable.
8. The complete nine-build report still clears all 324 generated floors with zero rejected commands, exact per-floor checkpoints, exact full-run replay, and unchanged pairwise strategy bounds.
9. Source taxonomy now matches the graph: Conduit content definitions own Secret Favor, Memory Nail, and Scout Glint; Emergency Toolkit owns Stray Hook; the player-facing relic profile replaces the retired Seer alias with Conduit Cartographer and exposes Emergency Toolkit as the correction build.

Graph v60 removes the redundant Seer build node, rehomes safe correction, expands Conduit's source/choice/effect/feedback/consequence path, and adds known-pair, two-Pin, Scout Glint, favorable-pressure, counter-pressure, and long-horizon guards.

## Sixty-first vertical slice: Source-Derived Player-Visible Feedback Registry

The feedback-completeness seam is widened without creating another overlapping build:

1. `GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES` is now the single typed registry mapping normalized deterministic feedback facts to their graph state fields.
2. Coverage expands from 13 former narration counters to 27 actual HUD/action-resource facts: life, guard, shards, streak, floor/total score, tries, mismatches, gold, typed/master keys, all six power charge banks, Favor, Pins, objectives, recall facts, and enemy/hazard progress.
3. `inspectGameplayFeedbackCompleteness` derives its ordered comparison fields from that registry. Accepted commands that change any registered fact still require typed feedback or the authoritative board-turn envelope; rejected and normalized no-op transitions remain exempt.
4. Graph auditing consumes the same registry instead of maintaining a second player-visible list. The widened check immediately found missing direct display relationships for Iron Key locks, typed-key locks, and Flash Pair charges; Graph v61 now records each source-to-HUD path and tests it.
5. `ai-repo-model.mjs` reads the registry literal from TypeScript source, marks matching semantic state nodes with `playerVisible: true`, publishes the sorted registry and count, and rejects missing graph states, stale flags, or count drift.
6. The generated model now contains 10,709 relationships, 27 player-visible states, and zero orphan, dead-end, missing-test, missing-feedback, unmodeled-content, or visible-state drift diagnostics.
7. The focused command corpus and the complete nine-build, three-seed, twelve-floor corpus pass the widened invariant. All 324 generated floors still complete with zero rejected commands and exact replay.
8. Emergency Toolkit remains a bounded support package rather than being promoted into a synthetic tenth long-run axis: its one-shot Stray correction is meaningful and graph-complete, while its renewable Peek/Destroy tools already belong to retained information/control loops.

Graph v61 makes the runtime accessibility invariant, graph audit, and AI semantic model agree on the exact player-visible state boundary.

## Sixty-second vertical slice: Stray Remove Intent Boundary Completion

The temporary compatibility seam from Graph v48 is now closed:

1. `RunState.strayRemoveArmed` is removed from the durable gameplay contract, run creation, and floor-clear transitions. Stray Remove charges and board consequences remain deterministic core state; click-to-arm intent remains renderer-only `RunSurfaceState`.
2. `applyStrayRemove` no longer accepts a `requireArmed` escape hatch or reads interface state. The typed `board.stray_remove` command and the shared pure action now use the same legality path for status, charge, clear-flip state, completion safety, and protected route anchors.
3. The obsolete shared `toggleStrayRemoveArmed` helper and its barrel exports are removed. Zustand's transient toggle remains the sole owner of arming, mutual exclusion, and post-contact clearing.
4. Source-boundary coverage requires the renderer to retain transient arming while rejecting `strayRemoveArmed` and its legacy toggle from durable run/core sources. Behavioral tests retain exact typed-command outcomes, replay, charge use, feedback, and softlock fairness.
5. No save-schema bump is required: `SaveData` persists summaries and profile data, not active `RunState`; normalization already drops legacy `currentRun` payloads, including any old arm flag. `SAVE_SCHEMA_VERSION` therefore remains 6.
6. Regeneration removes the retired helper/export symbols and records 10,706 relationships with the same 27 player-visible states and zero diagnostics.

Graph v62 records the no-serialized-arm invariant on both Stray Remove and typed tile input without changing player-facing rules or replay semantics.

## Sixty-third vertical slice: Direct Region Shuffle Row Ownership

The second obsolete board-power intent seam is now closed:

1. `RunState.regionShuffleRowArmed` is removed from the durable contract, run creation, floor transitions, and action results. A selected row was never gameplay state: live UI already constructs `board.region_shuffle` with its `rowIndex` directly.
2. The uncalled `armRegionShuffleRow` helper and its public barrel exports are removed. `applyRegionShuffle` remains the single pure legality/consequence path, shared by typed command reduction and compatibility callers.
3. Row shuffle and Tile Swap no longer write a ceremonial null field after success. Their charge, free-use, nonce, Pin cleanup, memory disruption, objective, feedback, fairness, and replay behavior is unchanged.
4. Source-boundary coverage rejects both the field and helper across durable run/core sources. The renderer still proves direct typed row submission and explicitly rejects resurrection of the old renderer arm action.
5. Save schema remains 6 because active `RunState` is not persisted; the existing legacy-`currentRun` normalization fixture now includes both retired arm fields and proves they are discarded.
6. Regeneration removes the retired helper/export symbols and records 10,703 relationships with the same 27 player-visible states and zero diagnostics.

Graph v63 records the no-serialized-row-arm invariant on Region Shuffle and typed tile input, completing direct row ownership without changing player-facing rules.

## Sixty-fourth vertical slice: Compiler-Derived RunState Ownership Index

The semantic model now audits the active gameplay contract directly instead of relying only on curated graph state names:

1. Model schema v3 extracts every `RunState` property from the TypeScript compiler tree with its exact declaration line and production read/write references.
2. Each field is a queryable `run_state_field:*` node. Typed `declares`, `reads`, and `writes` relationships connect contract and consumer files back to the active-run state boundary with exact lines.
3. A `run_state_field_without_reader` error now rejects any active-run field that is only initialized, reset, or written. Generated-model freshness and zero-diagnostic checks therefore enforce state ownership continuously.
4. The first audit found three real dormant fields. `dailyStreakCount` was a cosmetic zero initialized and never consumed; `dungeonShopVisitedThisFloor` duplicated authoritative `BoardState.dungeonShopVisited`; and `wildTileId` duplicated the wild tile already identified by `BoardState.tiles` plus `WILD_PAIR_KEY`. All three are removed rather than allowlisted.
5. The source-derived index stays distinct from curated semantic state: exact TypeScript ownership answers “where is this field read or written,” while graph state and edges answer “what gameplay relationship does it represent.” Queries can return both views.
6. Save schema remains 6 because active `RunState` is not persisted. Daily profile data, board shop visit behavior, shop offers, rerolls, feedback, and replay outcomes are unchanged.
7. Graph v64 adds the AI repository model as an executable simulation/gate node connected to command ownership, HUD feedback, persistence, softlock safety, and replay evidence.
8. Regeneration records 127 source-derived `RunState` fields, 14,497 relationships, the same 27 player-visible states, and zero diagnostics.

Graph v64 makes dormant active-run state a source-derived build failure and records the model itself as part of the gameplay architecture rather than passive documentation.

## Current slice status

Implemented in the Conduit Cartographer vertical slice:

- strict, versioned schemas for sources, facts, conditions, effects, commands, content definitions, and domain events;
- pure command reduction over existing reward, relic, inventory, trait, and Peek primitives;
- atomic condition rejection with explainable events;
- deterministic event IDs/order and JSON-round-trippable command replay;
- parity tests for Echo Conduit Lens, Peek Charge relic, Echo/Conduit perk bonus, and Peek board legality;
- live renderer Peek actions routed through the command core, with audio driven by the typed feedback event instead of a parallel hardcoded cause;
- live Echo Conduit Lens claims, Peek relic picks, and Echo-Conduit trait rewards routed through compatibility adapters into the same core;
- bounded, schema-validated command/event journals retained on the run and copied into completed-run summaries under save schema v6;
- malformed and duplicate journal entries normalized away, with deterministic retention limits of 64 commands and 256 events;
- seeded headless command simulation with seed sweeps, JSON replay equality, schema checks, event-order checks, and nonnegative-inventory assertions;
- semantic graph coverage from content choice through state, feedback, route consequence, persistence boundary, and replay gate.

Still required before the vertical slice is complete:

- extend the shared player-visible registry when additional gameplay ownership enters the core, rather than adding renderer or model-only field lists;
- use Graph v64 diagnostics and nine-build traces to select the next least-overlapping cohesive loop or architectural ownership seam, without presenting simulator survival as human win-rate proof;
- continue migrating cohesive player builds rather than adding isolated definitions, using the graph diagnostics to choose the next least-overlapping loop.
