# GLD-P2-003 Fixed-Tile Exact Contract

## Status
Done

## Problem
`fixedTiles` could still gain dungeon, layout, exit, shop, room, or enemy systems when called with `gameMode`.

## Implemented Behavior
`buildBoard` now supports `fixedTilesMode: 'exact'`, which copies fixed tiles without encounter enhancement. Default behavior remains legacy enhancement.

## Verification
- `yarn vitest run src/shared/p2-contracts.test.ts`

