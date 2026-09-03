# Gameplay tasks: helpers (Recall / Search / Damage)

Source: [H-01–H-03](../gameplay-depth/05-app-specific-idea-backlog.md#h--helpers-recall--search--damage)

Tier vocabulary: [`02-helper-tiers-and-cognitive-jobs.md`](../gameplay-depth/02-helper-tiers-and-cognitive-jobs.md).

---

## GP-H01 — Region shuffle (Search)

### Status
**Done** — [`applyRegionShuffle`](../../src/shared/game.ts), `canRegionShuffle`; the **Row** tool in the
run dock ([`GameScreen.tsx`](../../src/renderer/components/GameScreen.tsx)) arms it, and pressing any
tile shuffles that tile's row.

This row read "Done" for a long time while pointing at `GameLeftToolbar.tsx`, a component removed in
the run-shell rebuild. The rules, the command and both store actions survived; the only way to reach
any of them did not, so the power was unreachable while every test around it passed. `yarn
audit:store-reachability` now fails on a store action or state field nothing outside the store can
reach, which is the shape that failure takes.

### Priority
Medium

### Objective
Add a power that shuffles **only one row** (or column) of hidden tiles, with eligibility rules and contract respect.

### Spec reference
Backlog **H-01**.

### Affected areas
- `src/shared/contracts.ts` — charge field if not folded into existing shuffle charges.
- `src/shared/game.ts` — `applyRegionShuffle` or branch in `applyShuffle`; RNG uses `shuffleNonce` pattern consistently.
- `src/renderer/components/GameScreen.tsx` — arm state, row highlight, confirm; disabled reasons.
- Tests: softlock, `noShuffle` contract, daily seed.

### Acceptance criteria
- Player can always finish floor after legal use (no trapped states).
- `noShuffle` disables region shuffle clearly in UI.

### Dependencies
None.

### Out of scope
Column shuffle if row-only MVP ships first (add follow-up task).

---

## GP-H02 — Flash pair (Recall)

### Status
**Done (v1 scoped)** — [`applyFlashPair`](../../src/shared/game.ts); charges default to **1** only when `practiceMode` **or** `wildMenuRun` (`createNewRun` ~1031–1032). Other modes intentionally keep **0** charges; tests guard that even manually injected charges no-op outside Practice/Wild.

### Priority
Low

### Objective
Spend a charge: reveal one **random unmatched** pair for T ms without counting as a committed flip (seeded randomness).

### Spec reference
Backlog **H-02**.

### Affected areas
- `src/shared/contracts.ts` — `flashPairCharges` or reuse peek with distinct semantics.
- `src/shared/game.ts` — charge spend + ephemeral tile ids.
- Renderer — same pathway as peek with different timing; `reduceMotion` respect.

### Acceptance criteria
- **Practice or Wild only** for v1 unless daily fairness review is done.
- Seeded pair choice documented for daily/export.

### Dependencies
None.

### Out of scope
Player-chosen pair (different power).

---

## GP-H03 — Destroy ↔ score parasite feedback

### Status
**Done** — [`applyDestroyPair`](../../src/shared/game.ts) resets `parasiteFloors` when `score_parasite` is active; see [`MUTATORS.md`](../MUTATORS.md) and test in [`game.test.ts`](../../src/shared/game.test.ts).

### Priority
High

### Objective
When `score_parasite` is active, make **destroy** affect parasite cadence in a **documented** way (reset counter vs accelerate — pick one design).

### Spec reference
Backlog **H-03**.

### Affected areas
- `src/shared/game.ts` — `applyDestroyPair`, `advanceToNextLevel` parasite logic (~parasiteFloors).
- `GameScreen.tsx` or toast pipeline — one clear line after destroy.

### Acceptance criteria
- Behavior matches table in `MUTATORS.md` / this task footer after implementation.
- Unit test: parasite floor counter before/after destroy.

### Dependencies
None.

### Out of scope
New parasite VFX.
