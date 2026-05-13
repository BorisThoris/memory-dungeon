# GLD-P2-002 Route Semantic Parity

## Status
Done

## Problem
Route choice, run-map node, side-room, board node, and reward semantics could drift.

## Implemented Behavior
`getDungeonRouteSemanticContract` normalizes route type, node kind, floor tag, archetype, objective, and reward policy through one shared contract.

## Verification
- `yarn vitest run src/shared/route-foundation.test.ts`

