# Pass 03: Flip, Match, Mismatch Resolution

## Current Map
- `pressTile` is the main input path; gambit third pick bypasses normal playing-state flow and calls `flipTile` while resolving.
- Hidden dungeon traps can spring immediately during reveal before a tile is added to `flippedTileIds`.
- Two-card matches resolve immediately; misses use `computeFlipResolveDelayMs`; gambit has inline delay.
- Gambit checks pairs in order `a+b`, `a+c`, `b+c`; failure counts as one mismatch.
- Wild is a singleton utility tile and is consumed when used in a match.

## Findings
- **P0/P1:** Fatal immediate trap reveal can return `gameOver` from `flipTile`, but normal store flip path does not call `applyResolvedRun`.
- **P1:** Shuffle Snare appears able to move cursed-pair tiles, despite docs saying cursed pairs are protected.
- **P1:** Mirror Decoy docs imply flip trigger, while runtime counters increment on mismatch paths.
- **P2:** Fuse Cache wording says first three floor resolutions, but code uses successful match resolutions.
- **P2:** Gambit can consume wild if wild is the unmatched third tile.

## Task Candidates
- Add store-level game-over handling for immediate fatal trap reveal.
- Lock Snare/cursed, Mirror Decoy, and Fuse Cache semantics with tests and docs.
- Add a compact ordered resolution timeline doc.

## Verification
- Store test for hidden trap at one life.
- Unit tests for Snare/cursed, Mirror Decoy flip vs mismatch, Fuse Cache with early misses, gambit/wild edge cases.

## Refinement Notes
- `Confirmed P0`: immediate fatal trap reveal can return `gameOver` before the store routes through `applyResolvedRun`.
- `Confirmed P1`: Mirror Decoy copy says first reveal/flip, while runtime increments on mismatch paths.
- `Confirmed P2`: Fuse Cache uses successful `matchResolutionsThisFloor`; early misses do not consume the fresh window.
- `Needs Repro`: Shuffle Snare cursed-pair movement and gambit unmatched-wild consumption need targeted tests before being treated as proven bugs.
- Fatal trap acceptance must include summary, achievements, daily/no-powers side effects, armed-mode cleanup, and no duplicate terminal handling.
