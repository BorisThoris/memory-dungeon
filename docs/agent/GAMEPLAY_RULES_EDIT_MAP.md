# Gameplay Rules Edit Map

Use focused gameplay rule modules for new work. Avoid importing from `src/shared/game.ts` in new code; it remains as the legacy backing module while the rules layer is being split.

| Task | Edit first | Usually test |
|------|------------|--------------|
| Add or tune a dungeon card, exit, room, trap, boss, objective | `src/shared/dungeon-rules.ts` | `yarn vitest run src/shared/game.test.ts -t "dungeon cards"` and `yarn audit:dungeon-topology:json` |
| Add or tune a board power | `src/shared/board-powers.ts` | `yarn gate:action-loop` |
| Change flip/match/mismatch resolution | `src/shared/turn-resolution.ts` | `yarn gate:action-loop` |
| Change run modes, start/restart context, Daily identity, or Gauntlet start deadlines | `src/shared/run-start-core-contracts.ts` / `src/shared/run-start-core.ts` | `yarn gate:gameplay-core` and `yarn gate:navigation` |
| Change zero-life interlude cleanup, game-over routing, or terminal feedback | `src/shared/gameplay-core-contracts.ts` / `src/shared/gameplay-core.ts` / `src/shared/interlude-transition-rules.ts` | `yarn gate:gameplay-core` and `yarn gate:navigation` |
| Change terminal summary fields, evaluated achievement handoff, final run journals, or game-over persistence | `src/shared/gameplay-core-contracts.ts` / `src/shared/gameplay-core-adapters.ts` / `src/shared/run-summary-rules.ts` | `yarn gate:gameplay-core` and `yarn gate:navigation` |
| Change renderer command submission, accepted command/event journal ordering, or the reducer adapter boundary | `src/shared/gameplay-core-adapters.ts` / `src/shared/renderer-command-transaction-boundary.test.ts` | `yarn gate:gameplay-core` and `yarn gate:navigation` |
| Change historical shared flip/turn/Destroy/exit calls or the legacy `game.ts` facade | `src/shared/gameplay-command-compatibility.ts` / focused rule module; keep `game.ts` import-free | `yarn gate:gameplay-core` and `yarn gate:action-loop` |
| Change generated-board solving, information policies, fairness playthroughs, or replay sampling | `src/shared/gameplay-core-playthrough-solver.ts` / `src/shared/playthrough-solver-rules.ts` | `yarn test:gameplay:properties`, `yarn gate:action-loop`, and `yarn gate:softlock-full` |
| Change board generation, findables, fairness, completion | `src/shared/board-generation.ts` | `yarn gate:sim-softlock-seeds`, `yarn gate:softlock-full`, plus focused fairness/topology tests |
| Change trait placement, rewards, blockers, or interactions | `src/shared/tile-trait-rules.ts` | `yarn gate:action-loop` |
| Change route choices, gateways, side rooms | `src/shared/route-rules.ts` / `src/shared/run-map.ts` | `yarn gate:navigation`, `yarn gate:long-run`, `yarn audit:dungeon-topology:json`, and `yarn gate:softlock-full` |
| Change softlock repair, boss completion, locked exits, or route progression | `src/shared/softlock-generator-contract.ts` | `yarn gate:action-loop` and `yarn gate:softlock-full` |
| Change shop offers, pricing, rerolls, purchases | `src/shared/shop-rules.ts` | `yarn gate:rewards-economy` |
| Change endless wagers, relic offers, Favor progression | `src/shared/objective-rules.ts` | `yarn gate:rewards-economy` |
| Build deterministic test runs/boards | `src/shared/test/game-fixtures.ts` | Reuse fixtures instead of adding local ad hoc builders |

Default final gate for gameplay rule work:

```powershell
yarn gate:changed
yarn gate:systems
yarn gate:sim-softlock-seeds
yarn gate:softlock-full
```

Use `yarn gate:changed --json <path...>` when reviewing a known file list, or run `yarn gate:changed` with no paths to select gates from the current Git diff.
