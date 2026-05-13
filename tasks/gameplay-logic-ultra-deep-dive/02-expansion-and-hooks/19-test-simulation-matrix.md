# Pass 19: Test, Simulation, Release Gates

## Coverage Map
- Strong unit coverage exists in `src/shared/game.test.ts`.
- `softlock-fairness.test.ts` covers many structural board fairness conditions.
- `balance-simulation.ts` and `scripts/sim-endless.ts` provide smoke-level balance signals.
- `dungeon-combinatoric-matrix.ts` documents P0 rows, but does not execute every row as a scenario.
- Playwright covers main playable path, interludes, mode starts, rendering, mobile, and visual contracts.
- Docs define intended routing in `TEST_ROUTING_MATRIX.md` and `GAMEPLAY_RULES_EDIT_MAP.md`.

## Checks Run During Research
- `yarn vitest run src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/dungeon-combinatoric-matrix.test.ts src/shared/dungeon-e2e-fixtures.test.ts`
- `yarn sim:endless --floors=24 --seed=42001`

Both passed in the sub-agent pass.

## Weak Spots
- Balance sim has no stored baselines, percentile bands, or diff tolerances.
- `yarn ci` does not run Playwright, sim, renderer QA, or balance snapshots.
- DNG fixture recipes are metadata, not an executable Playwright sweep.
- Fairness is structural, not a bounded legal action solver.
- Save/resume fuzz is thin around resolving hazards, shops, side rooms, relics, and floor-clear interludes.
- Soak/long-session gates are documented but not executable.

## Task Candidates
- Add executable dungeon fixture Playwright smoke.
- Promote balance snapshots with multi-seed baselines and tolerance bands.
- Convert combinatoric matrix P0 rows into scenario factories.
- Add seed-sweep fairness simulation.
- Add save/resume fuzz around every interlude/status.
- Add exploit tests for quit/reload around reward services.
- Add release gate script separate from fast PR CI.

## Recommended Gates
- Gameplay PR: typecheck shared, game tests, softlock fairness, full unit.
- Economy PR: add balance sim and exploit tests plus `sim:endless --floors=1000 --seed=42001`.
- Route/shop/relic PR: add playable-path full e2e.
- Renderer gameplay shell PR: add renderer QA.
- Release candidate: CI, balance diff, renderer QA, visual smoke, dungeon fixture smoke.

## Refinement Notes
- `Confirmed`: `yarn ci` runs lint/typecheck/unit but not Playwright, `sim:endless`, renderer QA, visual smoke, or packaging smoke.
- `Refined`: balance simulation does have an inline baseline and drift assertion, but no external multi-seed percentile snapshot or diff artifact.
- `Confirmed`: `scripts/sim-endless.ts` is a deterministic schedule/board sampler, not a legal-action or economy simulator.
- `Confirmed`: dungeon fixture recipes are metadata/unit-tested; referenced `e2e/dungeon-fixtures-smoke.spec.ts` is absent.
- The "Checks Run During Research" section is historical evidence only; rerun commands before treating it as current pass/fail status.
- Acceptance should define a named gameplay release gate, balance seeds/tolerances/artifacts, executable fixture smoke, soak metrics, and combinatoric scenario factories.
