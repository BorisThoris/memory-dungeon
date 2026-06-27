# Gameplay Rules Edit Map

Use focused gameplay rule modules for new work. Avoid importing from `src/shared/game.ts` in new code; it remains as the legacy backing module while the rules layer is being split.

| Task | Edit first | Usually test |
|------|------------|--------------|
| Add or tune a dungeon card, exit, room, trap, boss, objective | `src/shared/dungeon-rules.ts` | `yarn vitest run src/shared/game.test.ts -t "dungeon cards"` |
| Add or tune a board power | `src/shared/board-powers.ts` | `yarn gate:action-loop` |
| Change flip/match/mismatch resolution | `src/shared/turn-resolution.ts` | `yarn gate:action-loop` |
| Change board generation, findables, fairness, completion | `src/shared/board-generation.ts` | `yarn gate:sim-softlock-seeds`, `yarn gate:sim-softlock-stress`, plus focused fairness tests |
| Change trait placement, rewards, blockers, or interactions | `src/shared/tile-trait-rules.ts` | `yarn gate:action-loop` |
| Change route choices, gateways, side rooms | `src/shared/route-rules.ts` | `yarn gate:navigation` |
| Change shop offers, pricing, rerolls, purchases | `src/shared/shop-rules.ts` | `yarn gate:rewards-economy` |
| Change endless wagers, relic offers, Favor progression | `src/shared/objective-rules.ts` | `yarn gate:rewards-economy` |
| Build deterministic test runs/boards | `src/shared/test/game-fixtures.ts` | Reuse fixtures instead of adding local ad hoc builders |

Default final gate for gameplay rule work:

```powershell
yarn gate:changed
yarn gate:systems
yarn gate:sim-softlock-seeds
yarn gate:sim-softlock-stress
```

Use `yarn gate:changed --json <path...>` when reviewing a known file list, or run `yarn gate:changed` with no paths to select gates from the current Git diff.
