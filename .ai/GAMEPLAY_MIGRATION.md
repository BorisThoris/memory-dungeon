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

Destroy Pair execution and floor-start hazard removal remain established deterministic compatibility consumers in this slice. They are not duplicated in the command reducer: the typed core owns source acquisition and Ward Spark intent, while the existing board/floor transitions own their already-tested completion and contract rules.

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

- migrate remaining legacy feedback producers onto the common journal adapter as their gameplay definitions move into the core;
- add route-choice outcome scoring to the headless build evaluation once route decisions enter the command core;
- continue migrating cohesive player builds rather than adding isolated definitions, using the graph diagnostics to choose the next least-overlapping loop.
