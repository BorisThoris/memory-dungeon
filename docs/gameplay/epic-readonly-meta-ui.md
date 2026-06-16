# Epic: Read-only meta UI (Codex, Collection, Inventory)

## Scope

Screens that **display** run or save information **without changing** simulation state when the player reads them. Distinct from **Settings** (which persists assist flags that *do* affect the next run).

## Surfaces

| Screen | Data shown | Gameplay impact |
|--------|------------|-----------------|
| **Codex** | Topic groups from `mechanics-encyclopedia` (via `game-catalog`): **powers**, **scoring & survival**, **pickups & board**, **contracts**, **featured runs**, **core**, **modes**, **achievements**, **relics**, **mutators** | **None** — subtitle states this explicitly. |
| **Collection** | Save achievements, relic pick counts, bests, daily streak cosmetic, symbol catalog slices | **None** — archive / progress readout. |
| **Inventory** (in-run) | Current `RunState`: mutators, relics, charges (peek, shuffle, destroy, region, tile swap, stray, flash, gambit, undo, wild) | **None** — mirror of run; closing does not mutate run. |

## Implementation status

| Area | Status |
|------|--------|
| Codex navigation | **Shippable** |
| Collection sections | **Shippable** |
| Inventory empty vs active run | **Shippable** |

## Rough edges

- Inventory could **drift** from true charges if run mutates while overlay is open (Zustand is live) — acceptable; rare edge.
- Collection **symbol** sections are illustrative; actual board symbols still come from `tile-symbol-catalog` + generation.

## Primary code

- `src/renderer/components/CodexScreen.tsx`
- `src/renderer/components/CollectionScreen.tsx`
- `src/renderer/components/InventoryScreen.tsx`

## Refinement

**Shippable** as non-mechanical reference. Listed in [GAMEPLAY_MECHANICS_CATALOG](./GAMEPLAY_MECHANICS_CATALOG.md) so “all mechanics” includes **explicit non-mechanics** for clarity.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §14.

- [x] (Optional) Snapshot Inventory values at open time or add “live updating” hint if Zustand drift confuses testers. — *Deferred:* no tester reports; revisit if QA flags drift.
- [x] Collection: add clearer labeling where sections are **illustrative** vs pulled from live `tile-symbol-catalog` data. — *Deferred:* copy/labels backlog with meta UI milestone.
