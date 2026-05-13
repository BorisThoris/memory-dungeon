# Pass 04: Powers And Action Economy

## Current Map
- `board-powers.ts` re-exports implementations from `game.ts`.
- Shuffle, region shuffle, destroy, peek, undo, flash pair, stray remove, and gambit lock Perfect Memory.
- Pin is hidden-tile only, capped by base cap plus relic/contract rules, and is Perfect Memory-safe.
- Store action order is enemy contact, exit/shop/room, pin, stray, peek, destroy, then normal flip.

## Findings
- **P0:** Stray remove can softlock normal pairs by orphaning one real tile.
- **P1:** Destroy can be armed under `noDestroy` or with open flips; later click is blocked but UX is misleading.
- **P1:** Peek can be armed with an open flip and then silently falls through to normal flip.
- **P1/P2:** Flash copy says “briefly,” but reveal persists until next flip or level clear.
- **P2:** Pin cap UI ignores `pin_cap_plus_one`.
- **P2:** Row shuffle armed state exists but UI directly executes row buttons; preview flow is effectively dead.

## Task Candidates
- Fix Stray contract and add fairness coverage.
- Align toolbar disabled/armed state with canonical legality.
- Decide flash duration semantics and update code or copy.
- Derive pin cap UI from active run.
- Remove dead row-armed state or implement row-preview behavior.

## Verification
- `game.test.ts` for stray + fairness.
- Renderer tests for toolbar disabled/armed states.
- A11y assertions for target validity and consequence copy.

## Refinement Notes
- `Confirmed P0`: Stray softlock is the canonical power-economy blocker; Pass 03 should cross-link rather than duplicate it.
- `Confirmed P1`: destroy and peek can be armed when their next target path cannot execute, causing misleading UX even when rules later no-op.
- `Confirmed P1/P2`: Flash has no timer; "brief" currently means until next flip or level clear.
- `Likely P2`: pin cap and row-shuffle preview claims need focused UI verification.
- `board-powers.ts` is only a facade; implementation references should cite `src/shared/game.ts`.
