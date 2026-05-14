# GLD-LR-004 Route Reward Budget Depth

## Status
Done

## Problem
Route share and reward pacing needed long-run samples beyond single-floor smoke checks.

## Implemented Behavior
The long-run soak gate samples generated route choices across multiple seeds and validates safe, greed, and mystery route shares.

## Verification
- `yarn gate:long-run`

