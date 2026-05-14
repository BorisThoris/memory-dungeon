# GLD-FB PR readiness

Status: Done

## Player-facing summary

- Long-run HUD surfaces explain pickups, hazards, economy, objective state, route context, and Perfect Memory eligibility without changing scoring rules.
- `ward_spark` and `scout_glint` are shipped findable reward kinds; `ward_cache` is intentionally deferred.
- Mobile HUD Info and More panels are viewport-bounded at the 390px phone smoke size.

## Review evidence

- `yarn gate:long-run-ui-feedback` passed.
- `yarn gate:gameplay` passed.
- Renderer QA passed across the curated spec set, including `e2e/long-run-feedback-hud.spec.ts` and the 844x390 short-height settings page/modal coverage in `e2e/mobile-layout.spec.ts`.

## Known non-goals

- No `GAME_RULES_VERSION` bump in this readiness batch.
- No runtime `ward_cache` hazard tile.
- No final economy retune; findable kind distribution checks are broad guardrails.
