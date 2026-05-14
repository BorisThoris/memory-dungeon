# GLD-FB long-run feedback rollup

Status: Done

This batch adds shared long-run feedback/readability contracts and a small safe findable expansion:

| Task | Status | Outcome |
| --- | --- | --- |
| GLD-FB-001 | Done | Shared in-run cause rows |
| GLD-FB-002 | Done | Perfect Memory lock attribution read model |
| GLD-FB-003 | Done | Findable announcement/copy path covers new pickup kinds |
| GLD-FB-004 | Done | Touch HUD detail rows for objective, hazard, boss, route, PM, economy |
| GLD-FB-005 | Done | Terminology contract matrix |
| GLD-FB-006 | Done | `ward_spark` and `scout_glint` findables |
| GLD-FB-007 | Done | `ward_cache` read-model-only candidate |
| GLD-FB-008 | Done | Objective impact matrix |
| GLD-FB-009 | Done | `yarn gate:readability-long-run` |
| GLD-FB-010 | Done | Rollup and task docs |

`GAME_RULES_VERSION` is bumped because generated findable identity and player-visible run rules changed.

## Follow-up implementation batch

Status: Done

The next long-run pass surfaces the shared feedback models in the HUD and inventory, fixes full repo typecheck, weights the new safe findables at 15% each, keeps `ward_cache` read-model-only, updates findables/encyclopedia docs, and adds `yarn gate:long-run-ui-feedback`.
