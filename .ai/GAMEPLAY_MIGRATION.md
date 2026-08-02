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

- consume every typed feedback event in common renderer/audio/accessibility adapters (Peek audio is the first migrated consumer);
- add route-choice outcome scoring to the headless build evaluation once route decisions enter the command core;
- migrate the next cohesive player build rather than adding isolated definitions.
