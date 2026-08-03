# Memory Dungeon AI repository model

`repo-model.json` is a deterministic semantic index generated from the repository rather than manually maintained documentation. It joins:

- every tracked or pending repository file, including a content hash;
- TypeScript source files, imports, exported symbols, layers, exact declaration lines, and direct test imports;
- source-derived relic, findable, inventory, bonus-reward, and build-archetype registries, including the mechanic IDs they still need;
- curated gameplay mechanics, implementation evidence, tests, state reads/writes, feedback surfaces, safeguards, and interaction edges;
- the source-derived `GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES` registry, with matching state nodes marked `playerVisible` so runtime feedback checks and model diagnostics share one definition;
- validation diagnostics for stale references, dangling edges, orphan mechanics, missing critical tests, and unconsumed state writes.

Run `yarn ai:model` after changing source, tests, content, or gameplay relationships. Run `yarn ai:model:check` to enforce freshness. Query it with, for example, `yarn ai:model:query "recallFocus"` or `yarn ai:model:query "trait.stasis"`.

The JSON file is authoritative for tools but not the source of gameplay truth. TypeScript remains authoritative for derived structure and player-visible feedback fields, while `src/shared/gameplay-interaction-graph-data.json` remains authoritative for curated relationships that static analysis cannot infer.
