# Gameplay Rules Edit Map

Use focused gameplay rule modules for new work. Avoid importing from `src/shared/game.ts` in new code; it remains as the legacy backing module while the rules layer is being split.

| Task | Edit first | Usually test |
|------|------------|--------------|
| Add or tune a board power | `src/shared/board-powers.ts` | `yarn gate:action-loop` |
| Change flip/match/mismatch resolution | `src/shared/turn-resolution.ts` | `yarn gate:action-loop` |
| Change board generation, findables, fairness, completion | `src/shared/board-generation.ts` | `yarn gate:sim-softlock-seeds`, `yarn gate:softlock-full`, plus focused fairness tests |
| Change trait placement, rewards, blockers, or interactions | `src/shared/tile-trait-rules.ts` | `yarn gate:action-loop` |
| Change what happens between floors | `src/shared/floor-clear-transition.ts` / `src/shared/next-floor-transition-rules.ts` | `yarn gate:navigation`, `yarn gate:long-run`, and `yarn gate:softlock-full` |
| Change softlock repair or floor completion | `src/shared/softlock-generator-contract.ts` | `yarn gate:action-loop` and `yarn gate:softlock-full` |
| Change the featured objective or the run economy | `src/shared/objective-rules.ts` / `src/shared/run-economy.ts` | `yarn gate:rewards-economy` |
| Build deterministic test runs/boards | `src/shared/test/game-fixtures.ts` | Reuse fixtures instead of adding local ad hoc builders |

Default final gate for gameplay rule work:

```powershell
yarn gate:changed
yarn gate:systems
yarn gate:sim-softlock-seeds
yarn gate:softlock-full
```

Use `yarn gate:changed --json <path...>` when reviewing a known file list, or run `yarn gate:changed` with no paths to select gates from the current Git diff.
