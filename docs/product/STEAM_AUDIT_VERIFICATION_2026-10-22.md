# Memory Dungeon audit verification

22 October 2026. Tested source: main `4bbbb057e350dad025efbfcaa6e06ef5ed30c431`. Runtime and configuration changes were not made. This is a scoped audit baseline, not full release certification.

| Check | Result | Scope |
| --- | --- | --- |
| typecheck | PASS | Full TypeScript validation, no emit; Node 26.3.1. |
| pop-by-act | PASS | Eight seeded omniscient runs to floor 60, grouped by act. Threshold is zero: a measurement-only design check. |
| warden-reach | PASS | 100 seeds each at 10% and 15% misses; 98 and 58 Warden clears. Static audit found an incomplete-floor forced-advance path; do not equate this with human survival. |
| goldilocks | PASS | Thirty-seed limited-memory certainty model, bank held open, named moving-room exemptions; not human retention. |
| focused-unit-node22 | PASS | 18 shared rule/save/hall files, 395 tests; Node 22.22.2, two workers. |
| Isolated browser opening playtest | PASS | Existing `e2e/playtest.spec.ts`, careful player only, one worker, headless Chromium, separate context, private noninteractive station, CPU cap 25%. Own Vite server on 4187. |

## Exact scope and artifacts

Logs, the test command record, source inventory, original checkout patch/status, rules probes, launcher proof and machine-readable results live under `D:/agent-work/memory-dungeon/2026-10-22-steam-product-audit/evidence`. The launcher uses `D:/gha-runners/headless-tools/Start-IsolatedProcess.ps1` and confirms a non-visible station. Browser profiles and temporary files are on D:. No everyday browser was attached.

Commands: `tsc --noEmit --pretty false`; `vitest run` with the 18 files listed in `checks.json`, `--maxWorkers=2 --reporter=dot`; `tsx scripts/sim-pop-share.ts --floors=60 --by-act --check`; `tsx scripts/sim-survival.ts --rates 0.1,0.15 --seeds 100 --check`; `tsx scripts/sim-goldilocks.ts --check`. Browser command: `playwright test --config ../playwright.audit.config.ts e2e/playtest.spec.ts --grep "a careful player" --workers=1`.

The final supported-runtime unit run is recorded separately in `focused-unit-node22.log`. The default Node 26 run emitted worker-termination warnings and later reported the same 18 files/395 tests passing; it is not the primary unit evidence. The first PowerShell wrapper stopped on a native stderr warning; it was corrected without modifying the game. Vite emits esbuild/oxc deprecation warnings under both runs.

Rules probes: `probe-build-access.ts` directly calls the boss reward and evolution rules. It confirms blueprint floors 24/40/60/72/80/90 and an offered inactive Echo Chamber consuming 30 gold in an eligible fixture. It tests the offer/apply functions, not the probability of a naturally generated run reaching that state.

The scoped table above does not cover lint/fullcheck, renderer/Electron packaging, all responsive/controller browser suites, hard-Warden UI playthrough, real Steam integration, two-machine Cloud or device/Proton validation. No runtime change was introduced by this audit. Broader repository delivery checks, including the system gate and full unit suite, are recorded separately in `evidence/precommit-results.json` when complete; inspect that record rather than assuming this scoped table proves them. Product/device checks belong to implementation slices and the pinned release candidate.

The browser solver reads hidden pair IDs and calls the real store press path; menu and continuation controls use the UI. It can find transition/render errors but cannot demonstrate human memory, click accuracy, comprehension, game feel or desire to replay. All five 1280 x 720 captures, floors 1 through 5, were inspected. They show usable board/HUD framing and distinct realm environments; floor 4 catches a large transient realm title over the card backs. These stills do not establish animation duration, audio quality or low-end performance. The test took 6.9 minutes under isolated software rendering and its CPU cap; that is not a human session-length measurement.
