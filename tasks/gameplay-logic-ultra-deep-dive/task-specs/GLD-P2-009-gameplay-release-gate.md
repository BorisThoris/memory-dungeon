# GLD-P2-009 Gameplay Release Gate

## Status
Done

## Problem
Gameplay release checks were documented as separate commands without one executable gate.

## Implemented Behavior
`yarn gate:gameplay` runs shared typecheck, focused GLD tests, endless simulation, and full unit tests.

## Verification
- `yarn gate:gameplay`

