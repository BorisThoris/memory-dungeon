# Removed: the Inventory screen model and the four read models behind it

Gen 214. No rules version change, and that is the point: nothing a player can do changed, because
nothing a player could see was involved.

This is the record. It exists so nobody rebuilds these projections from first principles, finds
half of them still referenced in a REG acceptance row, and wonders why they went.

## What went

| Module | What it built |
| --- | --- |
| `inventoryScreenModel.ts` (part) | `createInventoryScreenModel`, which assembled eleven projections for the Inventory screen, plus `getInventoryRunLoopSignals`, `getInventoryPayoffEngineSignal` and `getInventoryToolActionCue`, which fed it. `modeTitle` and `createInventoryQuantityMap` stay - they are what the screen calls. |
| `inventory-prep.ts` | Run-prep rows: active setup, loadout capacity, mutable windows, next prep action. |
| `long-run-feedback.ts` | In-run cause rows, perfect-memory attribution, touch HUD detail rows, findable distribution rows, the terminology contract rows. |
| `meta-reward-signals.ts` | Reward and next-goal signals for Collection, Inventory and Codex, and the meta-progression run-impact rows. |
| `run-economy.ts` | The run economy projection: score, findable pickups and assist charges as labelled rows with a purpose, a source and a sink. |
| `memory-recall-feedback.ts` | Recall focus, pressure detail, atmospheric beat and next memory move. |

783 lines of read model and 257 lines of test, all of it correct, all of it green, none of it
reachable.

## Why they went

`createInventoryScreenModel` was the only live consumer of the first four, and `long-run-feedback`
was the only live consumer of the last. The Inventory screen imports two unrelated helpers from
that file and nothing else: it renders a run line, the mutator chips, a charge table and the match
score multiplier. The model lost its caller when the meta screens were rebuilt green-field, and it
did not lose its test - so five modules went on being maintained, typechecked and verified for
nobody, and the chain came apart in one pull the moment the head of it was removed.

Perfect Memory is the case worth naming, because it looks like a feature being deleted and is not.
`getPerfectMemoryAttribution` is a superseded duplicate: the run bar reads
`perfect-memory-status.ts`, which `GameScreen.tsx` calls directly and which is unaffected.

## Why nothing caught it

Three things could have and none did.

- **`audit:test-only-modules`** asks whose only importer is its own test. It has read zero for a
  long time, and it was right: every one of these modules was imported by `inventoryScreenModel.ts`,
  which is imported by the screen. The module was reachable; the export was not.
- **`knip --exports`** counts a test file as a consumer, so an export a test imports is used.
- **Every test passed**, because the tests were the consumers.

`yarn audit:test-only-exports` (Gen 214) is the audit that can see it: an export is reported when
every file that imports it is that module's own test and the module itself does not use it. It
found 152 on the day it was written, and the 149 that survive this removal are recorded in
`scripts/test-only-exports-baseline.json` so the count can only go down.

## What else came out with them

The viewport matrix's Inventory row named `[data-testid="inventory-prep-strip"]` as the node a
player must be able to reach at every required size, and the Codex row named
`[data-testid="codex-knowledge-base-summary"]`. Neither has been rendered by any component since
the meta-screen rebuild. The matrix's own summary checked that each selector is a non-empty string,
which is a bar no string has ever failed. `breakpoints.test.ts` now reads the renderer and requires
every selector to name a testid a component actually writes.
