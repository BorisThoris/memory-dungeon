# Epic: Core memory loop (flip → resolve)

## Scope

The heart of the game: hidden tiles flip to reveal symbols; two (or three with gambit) flips resolve to match or mismatch; wild and decoy rules; transition into memorize / level complete / game over.

## Implementation status

| Area | Status | Notes |
|------|--------|--------|
| Two-flip resolution | **Shippable** | `flipTile`, `resolveTwoFlippedTiles` in `game.ts`; `tilesArePairMatch` exported for UI parity. |
| Resolve delay | **Shippable** | `computeFlipResolveDelayMs`; user `resolveDelayMultiplier`; echo adds `ECHO_EXTRA_RESOLVE_MS` for two-flip mismatch path. |
| Gambit (third flip) | **Functional** | Allowed while `resolving` with two flips; `resolveGambitThree`; fail path adds extra tries (`GAMBIT_FAIL_EXTRA_TRIES`). Third-flip delay does not add echo — asymmetry vs two-flip (**Codex**: **Resolve timing & echo** + **Gambit (third flip)**). |
| Wild joker | **Functional** | `WILD_PAIR_KEY` matching rules; `wildMatchesRemaining` across floors in wild-style runs. |
| Wild tile identity | **Shippable** | `BoardState.tiles` plus `WILD_PAIR_KEY` are authoritative; `getWildTileIdFromBoard` derives an id for inspection without duplicating it in `RunState`. |
| Glass decoy | **Shippable** | `DECOY_PAIR_KEY` never matches; `glass_floor` mutator; `decoyFlippedThisFloor` tracking. |
| Board generation | **Shippable** | `buildBoard` (internal `createTiles`); weaker shuffle modes, cursed pair pick, shifting spotlight init. [`Tile`](../../src/shared/contracts.ts) field matrix: [catalog Appendix D](./GAMEPLAY_MECHANICS_CATALOG.md#appendix-d--tile-every-field). |
| Fixed / puzzle boards | **Functional** | `fixedTiles` supplies layout; cursed pair init and shifting spotlight keys are added only when the puzzle / run pipeline wires them. Shipped builtins are documented per id in `builtin-puzzles.ts` (layout-only). |
| Timer fields | **Functional** | `RunTimerState` in `game.ts` (`pauseRun` / `resumeRun`); tick driving is primarily store/renderer. |

## Rough edges

- **Gambit vs echo:** Player-facing note lives in the Codex (**Resolve timing & echo**, **Gambit (third flip)**). Revisit balance only if feel testing asks for parity.
- **Wild tile id:** Resolved — consumers derive it from the authoritative board with `getWildTileIdFromBoard`.
- **Puzzle boards:** Builtins table in `builtin-puzzles.ts` lists which optional systems apply; defaults are layout-only.

## Primary code

- `src/shared/game.ts` — `flipTile`, `resolveBoardTurn`, `resolveTwoFlippedTiles`, `resolveGambitThree`, `tilesArePairMatch`, `computeFlipResolveDelayMs`, board builders.
- `src/shared/contracts.ts` — `BoardState`, `RunState`, `TileState`.
- `src/renderer/store/useAppStore.ts` — `pressTile` ordering (gambit third pick before normal play branch).

## Refinement

**Shippable** for standard endless/daily play. **Functional** for gambit/wild edge semantics and contract cleanliness.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §2.

- [x] Keep wild identity board-derived (`getWildTileIdFromBoard`) instead of maintaining duplicate `RunState` metadata.
- [x] Document per `builtin-puzzles` entry which systems are intentionally skipped (`fixedTiles` without cursed init, spotlight keys, etc.).
- [x] If balance review requires it: document or adjust gambit three-flip vs two-flip echo mismatch timing asymmetry. — *Documented:* intentional asymmetry in `game.ts` / resolve paths; revisit only on balance ticket.
