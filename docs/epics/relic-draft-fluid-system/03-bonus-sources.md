# Bonus pick sources (shipped)

## API

- **`computeRelicOfferPickBudget(run)`** in [`game.ts`](../../../src/shared/game.ts) — returns total relic selections this milestone visit (minimum 1). Combines:
  - Base **1** + `bonusRelicPicksNextOffer` (from **`shrine_echo`** via `grantBonusRelicPickNextOffer`, then cleared when the offer opens).
  - **+1** if **`generous_shrine`** mutator is active.
  - **+1** if **`gameMode === 'daily'`**.
  - **+1** if **`metaRelicDraftExtraPerMilestone`** (from save: claimed **`relicShrineExtraPickUnlocked`** after **7** daily completions make Week of Archives available).
  - **+1** if **`activeContract.bonusRelicDraftPick`** (Scholar contract run from the menu).

- **`grantBonusRelicPickNextOffer(run, amount?)`** — increments `bonusRelicPicksNextOffer` for the next `openRelicOffer`.

| Source | Implementation |
|--------|------------------|
| Relic `shrine_echo` | `applyRelicImmediate` → `grantBonusRelicPickNextOffer(run, 1)` |
| Mutator `generous_shrine` | `hasMutator(run, 'generous_shrine')` in `computeRelicOfferPickBudget`; appears in [`DAILY_MUTATOR_TABLE`](../../../src/shared/mutators.ts) rotation |
| Meta | [`PlayerStatsPersisted.relicShrineExtraPickUnlocked`](../../../src/shared/contracts.ts); [`normalizeSaveData`](../../../src/shared/save-data.ts); [`mergeDailyComplete`](../../../src/shared/save-data.ts); copied into run via [`metaRelicDraftExtraPerMilestoneFromSave`](../../../src/shared/save-data.ts) in [`useAppStore`](../../../src/renderer/store/useAppStore.ts) |
| Daily mode | `run.gameMode === 'daily'` |
| Scholar contract | `bonusRelicDraftPick: true` on `activeContract` ([`useAppStore.startScholarContractRun`](../../../src/renderer/store/useAppStore.ts)) |

No new npm dependencies.
