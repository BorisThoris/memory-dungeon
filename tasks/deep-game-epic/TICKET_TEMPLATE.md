# DGE-XXX: Ticket title

## Status
Not started

## Priority
P0/P1/P2

## Subsystem
Spine / Verb / Card family / Board / Boss / Camp / Meta / HUD / QA

## Depends on
- `DGE-001`

## Current repo context
Name the current files, state shapes, selectors, tests, and related REG tasks.

## Problem
Describe the product or engineering gap this ticket closes.

## Target experience
Describe what the player or future implementer should experience when the ticket is complete.

## Implementation notes
- State the likely code surfaces.
- State versioning or migration implications.
- Schedule-only changes bump `FLOOR_SCHEDULE_RULES_VERSION`, never `GAME_RULES_VERSION`; generation, scoring and seeded offers require a `GAME_RULES_VERSION` review.
- State UI/a11y/reduced-motion implications when relevant.

## Acceptance criteria
- Concrete done criteria.
- Cross-system consistency criteria.
- No online dependency unless explicitly scoped through `REG-052`.

## Tests and verification
- Focused unit tests.
- Renderer/e2e tests if UI changes.
- Deterministic generation/replay tests when changing seeded dungeon rules; save migration tests when persisted shape changes.
- Typecheck/lint/build when risk warrants it.

## Risks and edge cases
- List the failure modes future agents must consider.

## Cross-links
- `../README.md`
- `../04-mechanic-checklist.md`

## Future handoff notes
Leave next steps and known blockers here after implementation.
