# Pass 09: Modes, Puzzles, Replay

## Current Map
- `GameMode` is `endless | daily | puzzle | gauntlet | meditation`; Classic/Practice/Wild/Scholar/Pin Vow are UI entries or flags.
- Classic starts as internal `endless`; product Endless card is locked.
- Daily derives current UTC seed/mutator/date.
- Puzzle starts built-ins only; import validator exists but UI/import docs drift.
- Replay/export is a readable local journal/share string, not a reconstructable payload.

## Findings
- **P0/P1:** Docs claim run import/export and puzzle import implementations that are absent.
- **Closed by GLD-P1-001:** The under-specified value is now a local share key, not a replay promise.
- **P0/P1:** Daily completion increments on any daily game over, even with zero clears.
- **P0/P1:** Puzzle completion progress is read by UI/gates but appears unwired on clear.
- **P1:** Puzzle run can continue into procedural floors after the authored board.
- **P1/P2:** Built-in puzzle layout derivation can contradict puzzle title/layout.
- **P2:** Puzzle import validator is not ready for user import.

## Task Candidates
- Implement or remove documented import/export surfaces.
- Add structured replay payload if replay is a product promise.
- Gate daily completion on real success.
- Persist puzzle completions and define terminal puzzle outcome.
- Add explicit puzzle layout metadata.

## Verification
- Store tests for failed vs cleared daily.
- Puzzle clear persistence tests.
- Replay snapshot tests per entry type.

## Refinement Notes
- `Confirmed P0`: puzzle completion is read from save data but no write path was found.
- `Confirmed P0/P1`: puzzle mode can continue into generated procedural floors through normal `continueToNextLevel` / `advanceToNextLevel`.
- `Confirmed`: built-in puzzle layout copy can drift from derived runtime columns, such as an 8-tile `4x2` title deriving to `3x3`.
- `Likely`: puzzle import validator copy is mismatched and UI import remains absent.
- Keep replay/export acceptance in GLD-P1-001 and avoid duplicating detailed criteria here.
