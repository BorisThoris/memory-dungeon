# Epic: Contracts & challenge-style runs

## Scope

`ContractFlags` on `RunState.activeContract` constrains how a run can be played. Used by **Scholar-style** menu entries, **Pin Vow**, and tests — not a separate `GameMode`, but a parallel rules layer.

## Contract surface (`contracts.ts`)

| Flag | Role |
|------|------|
| `noShuffle` | Blocks full-board shuffle, row shuffle, and tile swap availability. |
| `noDestroy` | Blocks destroy-pair power. |
| `maxMismatches` | When set, exceeding cumulative tries vs threshold can force **game over** (see mismatch resolution paths). |
| `maxPinsTotalRun` | Caps total pins placed across the run (`pinsThisRun` vs contract). |

## Implementation status

| Aspect | Status | Notes |
|--------|--------|--------|
| Rule gating in sim | **Shippable** | `applyShuffle`, `applyRegionShuffle`, `applyTileSwap`, `applyDestroyPair`, and `togglePinnedTile` consult `activeContract`; tests cover many combinations. |
| Scholar / menu wiring | **Functional** | Started from main menu with explicit `activeContract` payloads (`useAppStore` / `createNewRun` options). |
| Codex alignment | **Functional** | Dedicated contract articles in `ENCYCLOPEDIA_CONTRACT_TOPICS` (`mechanics-encyclopedia.ts`): scholar, pin vow, max mismatches — re-exported via `game-catalog.ts`; core topics still give high-level cross-links. |
| HUD surfacing | **Functional** | Contract state may be less visible than mutators; players learn from disabled buttons / toasts. |

## Rough edges

- **Discoverability:** New players may not distinguish “classic” vs “scholar contract” without reading codex or hitting a locked power.
- **Balance:** `maxMismatches: 0` and similar edge cases are tested in `game.test.ts` — product tuning is separate.

## Primary code

- `src/shared/mechanics-encyclopedia.ts` — `ENCYCLOPEDIA_CONTRACT_TOPICS` (player-facing codex copy for contracts).
- `src/shared/contracts.ts` — `ContractFlags`, `activeContract` on `RunState`.
- `src/shared/game.ts` — guards on shuffle, row shuffle, tile swap, destroy, pin cap; mismatch game-over when `maxMismatches` exceeded.
- `src/shared/game.test.ts` — extensive contract + wild matrix.
- `src/renderer/store/useAppStore.ts` — `startScholarContractRun`, `startPinVowRun` (both set `activeContract` via `createNewRun` options).

## Refinement

**Shippable** for simulation correctness. **Functional** for onboarding and UI affordances around “why is shuffle greyed out?”.

## Tasks (polish backlog)

Tracked in rollup: [GAMEPLAY_POLISH_AND_GAPS.md](./GAMEPLAY_POLISH_AND_GAPS.md) §13.

- [x] Improve discoverability: classic vs scholar / pin vow (menu badges, first-run callout, or codex section). — *Deferred:* discoverability pass scheduled with Codex/onboarding epic.
- [x] (Product) Tune extreme `maxMismatches` contract feel beyond automated tests — separate from sim correctness. — *Deferred:* balance playtest when contract presets ship broadly.
