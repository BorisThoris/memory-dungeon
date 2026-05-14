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

## PR readiness

Status: Done

This follow-up batch adds HUD readability E2E coverage, findable kind distribution diagnostics, explicit `ward_cache` deferral coverage, and a version-gate guard for the v29 findable weighting rule.

Relevant commits in this stack:

- `bc48c2d` - Add GLD long-run feedback baseline
- `ef1507c` - Surface long-run feedback in HUD
- `b97ca1c` - Add long-run feedback readiness coverage

Verification:

- `yarn gate:long-run-ui-feedback` - passed
- `yarn gate:gameplay` - passed

Known release notes:

- `ward_cache` remains read-model-only and is not registered as a runtime hazard tile.
- Findable distribution checks are broad seeded guardrails, not final economy tuning.
- HUD visual coverage is a desktop and phone smoke pass for the long-run feedback surfaces.

## Release-risk checklist

Status: Done

- Broad findable distribution tolerance is intentional; use it to catch seeded drift, not final economy tuning.
- `ward_cache` remains documented as a safe expansion candidate only; runtime hazard registration is guarded by tests.
- HUD visual coverage exercises the long-run feedback surfaces on desktop and phone, with renderer QA now carrying the spec.
