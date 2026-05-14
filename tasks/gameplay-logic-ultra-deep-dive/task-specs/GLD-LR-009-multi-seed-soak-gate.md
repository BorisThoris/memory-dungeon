# GLD-LR-009 Multi-Seed Soak Gate

## Status
Done

## Problem
Long-run checks were available as separate simulations but not as one deterministic multi-seed gate.

## Implemented Behavior
`yarn gate:long-run` runs shared typecheck, focused long-run tests, deterministic multi-seed soak rows, and endless simulation.

## Verification
- `yarn gate:long-run`

