# Pass 01: Run Lifecycle, Timers, Pause, Advance

## Current Map
- `RunStatus` is `memorize | playing | resolving | paused | levelComplete | gameOver`.
- New runs start in `memorize`; the store waits for `TileBoard` readiness before starting the memorize timer.
- Resolve timing is store-owned; `resolveBoardTurn` returns `playing`, `levelComplete`, or `gameOver`.
- Pause/meta overlays snapshot timer remainders with `freezeRun`, clear timers, then resume with `resumeRunWithTimers`.
- Gauntlet uses an absolute `gauntletDeadlineMs` with a ~300ms store watcher.

## Findings
- **P0:** `continueToNextLevel` and `advanceToNextLevel` can advance non-`levelComplete` runs if called directly.
- **P0/P1:** Gauntlet can expire while paused because the watcher does not exclude `paused`, and the deadline is absolute.
- **P1:** Board-ready memorize latch can be bypassed by opening/closing overlays before `notifyMemorizeBoardReady`.
- **P1:** App visibility/blur interruption handling is called out in REG-043 but not wired into run timers.
- **P2:** Destroy-charge clean-clear behavior drifts across code, tests, HUD, and docs.

## Task Candidates
- Add lifecycle guards to store and shared advance paths.
- Define and implement gauntlet pause policy.
- Preserve board-ready gating across overlays.
- Add app interruption tests or a deliberate non-goal note.

## Verification
- Store tests for `continueToNextLevel` from every non-complete status.
- Timer tests for pause/settings/inventory/visibility during gauntlet and memorize.

## Refinement Notes
- `Confirmed P0`: `continueToNextLevel` and `advanceToNextLevel` can advance non-`levelComplete` runs if directly called. Acceptance must cover store and shared rule paths.
- `Confirmed P1`: gauntlet expiry uses an absolute deadline and the watcher does not exclude paused runs.
- `Confirmed P1`: resume from overlays can schedule memorize timers without rechecking the board-ready latch.
- `Confirmed absent / product decision`: no gameplay visibility/blur freeze handler was found; decide whether backgrounding is an auto-freeze rule or an explicit non-goal.
