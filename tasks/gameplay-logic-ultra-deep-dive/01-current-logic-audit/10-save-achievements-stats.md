# Pass 10: Save, Achievements, Stats

## Current Map
- `SaveData` schema is v5; active runs are memory-only.
- `normalizeSaveData` shallow-merges settings, achievements, stats, unlocks, and summaries.
- Floor clear persists best score, onboarding dismissal, achievements, and honors.
- Game over persists last summary, daily completion, no-powers best floor, encore keys, achievements, and honors.
- Achievements save locally before Steam sync.

## Findings
- **P0/P1:** Puzzle completion is read but never written.
- **P0/P1:** Save normalization trusts corrupted values such as arbitrary achievement booleans, numbers, maps, and summaries.
- **P0/P1:** Save read failure silently starts a default profile, risking overwriting recoverable data after next save.
- **P1:** Profile “run history entries” counts generated display rows, not real history entries.
- **P1:** Abandoning a run loses some gameplay-facing progress because several merges happen only on game over.
- **P1/P2:** Replay is presented as replay, but is only a seed label.
- **P2:** Achievement copy around Endless conflicts with Classic-as-internal-endless.

## Task Candidates
- Add puzzle completion merge path.
- Harden save normalization and add corrupted-save tests.
- Add read-failure state/notice and prevent overwrite after failed hydration.
- Decide whether run history is real history or last-run shell.
- Split “seed recipe” from “replay.”

## Verification
- Save fuzz tests.
- Puzzle clear persistence test.
- Daily clear/abandon/game-over policy tests.
- Profile count test for empty save.

## Refinement Notes
- `Confirmed P0`: daily completion is persisted on any daily `gameOver`, and seven-daily achievement eligibility reads that completed count.
- `Confirmed P0`: save normalization accepts many unsafe values, including non-finite/negative numbers, arbitrary unlock arrays, shallow achievement maps, and unshaped puzzle maps.
- `Confirmed P0`: save read failure can fall back to defaults in renderer hydration and local fallback client without a visible read-failure blocker.
- `Confirmed`: profile "run history rows" is a fixed journal-row count, not real saved run history.
- GLD-P0-006 should acknowledge existing save fuzz coverage but add missing cases for NaN, Infinity, negative stats, arbitrary achievement values, malformed unlocks, and malformed puzzle records.
