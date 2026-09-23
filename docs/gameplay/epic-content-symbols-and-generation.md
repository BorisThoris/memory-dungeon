# Epic: Content — symbols, bands, and tile generation

## Scope

What appears **on** cards (symbols, labels) and how bands advance by level; distinct from **rendering** (textures, SVG merge) in `cardSvgPlaneGeometry` / `tileTextures`.

## Implementation status

| Area | Status | Notes |
|------|--------|--------|
| Symbol catalog | **Shippable** | `tile-symbol-catalog.ts` — letter band, numeric bands, level thresholds (`SYMBOL_BAND_*`). |
| Symbol bands during play | **Removed** | The `category_letters` mutator went in Gen 262: faces are illustrations, so a symbol-band swap changed nothing a player could see. `restless_floor` took its floor. |
| Atomic variants | **Functional** | `atomicVariant` on tiles for styling; used in puzzles and pair visual variety. |
| `getSymbolSetForLevel` | **Shippable** | Stages difficulty of symbol pool by floor. |
| Labels vs symbols | **Functional** | Tiles carry both; `wide_recall` was intended to shift emphasis — **penalty only** until presentation catches up (see board epic). |

## Rough edges

- **Readability curve:** Large symbol pools on high floors are a design choice; mutator `wide_recall` does not yet change legibility in 3D.
- **Puzzle overrides:** Built-in puzzles set explicit symbol/label pairs per tile — must stay in sync with any global catalog rename.

## Primary code

- `src/shared/tile-symbol-catalog.ts`
- `src/shared/game.ts` — `createTiles`, symbol picking, `atomicVariantForPairKey`-style helpers.
- `src/shared/builtin-puzzles.ts` — handcrafted `symbol` / `label` / `atomicVariant`.

## Refinement

**Shippable** for procedural variety. **Functional** for tying catalog progression to player-facing difficulty communication.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §10, §15.

- [x] Balance pass: `SYMBOL_BAND_*` thresholds vs [BALANCE_NOTES.md](../BALANCE_NOTES.md) and high-floor readability targets. — *Ongoing:* [`balance-notes-drift.test.ts`](../../src/shared/balance-notes-drift.test.ts) guards drift; full pass on tuning tickets.
- [x] Process: when renaming or re-banding catalog symbols, update **builtin puzzles** and any pinned `symbol`/`label` pairs ([PUZZLE_CONTRIBUTING.md](../PUZZLE_CONTRIBUTING.md)). — *Ongoing:* process documented in PUZZLE_CONTRIBUTING; no code change this pass.
- [x] Coordinate with [epic-board-rendering-assists](./epic-board-rendering-assists.md): once `wide_recall` has 3D legibility, revisit symbol/label emphasis design. — *Deferred:* emphasis pass after next board art milestone.
