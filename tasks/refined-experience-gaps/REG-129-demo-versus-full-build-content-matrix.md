# REG-129: Demo versus full build content matrix

## Status
Done

## Priority
P0

## Area
Meta

## Evidence
- `tasks/refined-experience-gaps/README.md` — *Current product scope (refinement bar)*
- `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.md`
- `docs/gameplay-tasks/GP_AUDIT_ROLLUP.md`
- `tasks/refined-experience-gaps/REG-087-anti-softlock-fairness-and-edge-case-suite.md`
- `tasks/refined-experience-gaps/REG-120-mechanics-combinatoric-matrix-and-coverage.md` — *Combinatoric anchor (fourth wave)*
- `tasks/refined-experience-gaps/REG-147-local-trust-and-no-server-anticheat-posture.md` — *Local trust / bookend*
- `tasks/refined-experience-gaps/REG-119-bot-batch-plan-and-product-acceptance-report.md`

## Problem
Feature flags, demo length, and content locks must be a single matrix so QA does not test the wrong build — `REG-115` / `REG-118` depth. **Enterprise depth wave:** this ticket adds explicit combinatoric, process, and edge coverage that large teams use so gaps are not left only in `GP-*` or implicit QA habit.

## Target Experience
Engineering and QA can **name** a matrix, a gate, or an edge list; long-running implementation work can verify against it without re-deriving risk from scratch. **Online** services are **out of scope** for v1 per `REG-052` and `README` — these tasks are **local/offline**-first, Steam-client-only where relevant (`REG-137`).

**Focus:** Build flavor table and acceptance per column.

## Suggested Implementation
- Cross-link `REG-041` (replay), `REG-040` / `REG-117` (save), `REG-119` (acceptance), `REG-087` (softlock suite index), and `REG-086` / `REG-030` as applicable; avoid duplicating full bodies from `docs/gameplay/`.
- Name contract surfaces: `RunState`, `SaveData`, `Settings`, `GAME_RULES_VERSION`, `SAVE_SCHEMA_VERSION`, `FLOOR_SCHEDULE_RULES_VERSION`, `RelicId`, `MutatorId`, `FindableKind` only where the ticket’s scope needs it.
- Sequence with `REG-033` and P0 `REG-068` / `REG-087` when choosing batch order; fourth-wave P0s often support RC (`REG-130`) and combinatoric coverage (`REG-120`).

## Acceptance Criteria
- The ticket’s **Problem** and **Target** are unambiguous to a new engineer; cross-links to prior REGs are present.
- **Online** is not a shipping dependency for v1; Steam-only cases stay client/offline in `REG-137`.
- **Placeholder and asset contract (placeholderNeeded)** is filled (Not applicable or legal/store slots for `REG-137`).

## Verification
- File includes: Status, Priority, Area, Evidence, Problem, Target Experience, Suggested Implementation, Acceptance Criteria, Verification, **Placeholder and asset contract (placeholderNeeded)**, and **Cross-links**.
- `git status --short` for implementation is scoped; markdown-only in this pass for new files.

## Placeholder and asset contract (placeholderNeeded)
- **Not applicable** for shippable new art, audio, trailer, capsule, or poster deliverables in this task’s planning scope. If implementation implies UI, use existing in-product frames, procedural audio fallbacks, and placeholder copy per `REG-113` until owners supply finals. The implementation bot does not generate or license final marketing art.



## Cross-links
- `README.md`
- `REG-000-audit-method-and-priority-map.md`
- `REG-068-complete-product-definition-of-done.md`
- `REG-087-anti-softlock-fairness-and-edge-case-suite.md`
- `REG-120-mechanics-combinatoric-matrix-and-coverage.md`
- `REG-147-local-trust-and-no-server-anticheat-posture.md`
- `REG-052-leaderboards-trust-model-and-online-deferral.md`

## Implementation

The matrix lives in `docs/STEAM_DEMO_CYCLE.md` §4 and is enforced by `src/shared/content-lock.ts`: Classic only, reduced relic pool, Act I mutators, achievements off, run length uncapped. Test: `src/shared/content-lock.test.ts`.
