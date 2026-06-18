# NGE-007 No-Softlock Generator Contract

## Goal

Make "never softlocked" a generator contract instead of a bug-by-bug patch cycle.

## Acceptance

- Seeded simulations cover locks, shops, keys, levers, traits, exits, hazards, enemies, and final-pair states.
- Tests fail on unreachable exits, unavailable required keys, impossible remaining pairs, or unsafe blocking effects.
- Dev diagnostics explain the failing seed, floor, required resource, and blocked tile/card state.

## Implemented Slices

- Softlock generator failures now include issue details with messages, pair keys, and tile ids instead of only issue codes.
- The default contract now includes locked-exit economy coverage and checks that key-locked exit boards produce shop stock containing key insurance (`iron_key` or `master_key`).
- Boss and enemy patrol overlays that only reference already matched/removed cards are now defeated/ignored before completion checks, preventing cleared Warden floors from staying blocked by stale enemy markers.
- Moving enemy hazard activity is now a shared board selector used by status, renderer rows, ARIA text, and DOM telemetry, so stale cleared-board patrol records do not remain visible or announced.
- Softlock generator coverage now adds cleaned cleared-board projections for boss and moving-hazard boards, catching stale-overlay completion states across seeded scenarios.
