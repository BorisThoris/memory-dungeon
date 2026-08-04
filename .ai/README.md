# Memory Dungeon AI repository model

`repo-model.json` is a deterministic semantic index generated from the repository rather than manually maintained documentation. It joins:

- every tracked or pending repository file, including a content hash;
- TypeScript source files, imports, exported symbols, layers, exact declaration lines, and direct test imports;
- every `RunState` contract field with its exact declaration plus production read/write references, `direct_assignment` versus full `state_construction` access kinds, and file-to-field relationships;
- configured orchestration budgets as queryable nodes, derived from indexed source line/import counts and connected to their guarded files;
- every active-run `gameplayCommandSchema`, bootstrap `runStartCommandSchema`, and `gameplayEventSchema` variant with payload fields, exact reducer/creator/emitter/consumer/test references, journal persistence, and renderer display relationships;
- source-derived relic, findable, inventory, bonus-reward, and build-archetype registries, including the mechanic IDs they still need;
- curated gameplay mechanics, implementation evidence, tests, state reads/writes, feedback surfaces, safeguards, and interaction edges;
- the source-derived `GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES` registry, with matching state nodes marked `playerVisible` so runtime feedback checks and model diagnostics share one definition;
- validation diagnostics for stale references, dangling edges, orphan mechanics, missing critical tests, unconsumed graph writes, active-run `RunState` fields with no production reader, renderer writes to core-owned run state, oversized orchestration files, commands with no reducer handler, events with no emitter, protocol variants with no direct test, and typed feedback with no renderer consumer.

Run `yarn ai:model` after changing source, tests, content, or gameplay relationships. Run `yarn ai:model:check` to enforce freshness. Query it with, for example, `yarn ai:model:query "recallFocus"`, `yarn ai:model:query "gameplay_command:run.finalize"`, `yarn ai:model:query "gameplay_event:run.finalized"`, `yarn ai:model:query "mechanic:core.command_transaction"`, `yarn ai:model:query "mechanic:core.gameplay_compatibility_facade"`, `yarn ai:model:query "mechanic:simulation.generated_board_playthrough"`, or `yarn ai:model:query "orchestration_budget:src/renderer/components/GameScreen.tsx"`.

The JSON file is authoritative for tools but not the source of gameplay truth. TypeScript remains authoritative for derived structure, `RunState` field and writer ownership, the gameplay command/event protocol, and player-visible feedback fields, while `src/shared/gameplay-interaction-graph-data.json` remains authoritative for curated relationships that static analysis cannot infer. Production renderer files may project or store returned state, but a full `RunState` construction is a model error; deterministic state transformations belong under `src/shared/`.
