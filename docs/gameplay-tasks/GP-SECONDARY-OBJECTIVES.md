# Gameplay tasks: secondary objectives (bonuses)

Source: [O-01–O-04](../gameplay-depth/05-app-specific-idea-backlog.md#o--secondary-objectives-bonus-not-gate)

**Principle:** Clearing the board remains the only hard win; bonuses support the primary loop ([optional goals pattern](https://www.cs.vu.nl/~eliens/design/media/pattern-optionalgoals.html)).

---

## GP-O01 — Glass witness bonus

### Status
**Done** — `glass_witness` in `LevelResult.bonusTags` ([`game.ts`](../../src/shared/game.ts) ~1360); end-of-level line via `formatBonusTagsLine` ([`GameScreen.tsx`](../../src/renderer/components/GameScreen.tsx)).

### Priority
High

### Objective
When `glass_floor` is active, grant a **bonus** if the player never triggers decoy failure / never “touches” the decoy per spec (define exact event: mismatch vs any flip involving decoy).

### Spec reference
Backlog **O-01**.

### Affected areas
- `src/shared/contracts.ts` — `LevelResult.bonusTags` or equivalent; optional `RunState` flag `decoyTouchedThisFloor`.
- `src/shared/game.ts` — decoy resolution paths; level clear scoring.
- `GameScreen.tsx` — end-of-floor line “Glass witness ✓/✗”.

### Acceptance criteria
- Bonus rules documented in code comment + this file when implemented.
- Unit tests: decoy touched vs not; floor still completable either way.
- No change to hard win/lose.

### Dependencies
None.

### Out of scope
New decoy art.

---

## GP-O02 — Cursed-last pair bonus

### Status
**Done** — [`BoardState.cursedPairKey`](../../src/shared/contracts.ts), `pickCursedPairKey`, bonus tag `cursed_last`; board props [`GameScreen.tsx`](../../src/renderer/components/GameScreen.tsx) → `TileBoard` / `TileBoardScene`.

### Priority
Medium

### Objective
At generation, mark one `pairKey` as **cursed**. Bonus if that pair is matched **last** among real pairs.

### Spec reference
Backlog **O-02**.

### Affected areas
- `src/shared/contracts.ts` — `BoardState.cursedPairKey` or run-level for floor.
- `src/shared/game.ts` — `buildBoard` / match order evaluation on clear.
- Renderer — memorize-phase marker; **a11y:** not color-only.

### Acceptance criteria
- Deterministic cursed pair from level seed (document function).
- Bonus failure does not block level complete.
- Screen reader / tooltip can name “cursed pair” without relying on hue alone.

### Dependencies
Optional: **GP-O01** pattern for `bonusTags` on `LevelResult`.

### Out of scope
Narrative VO.

---

## GP-O03 — Flip par bonus

### Status
**Done** — `flipParLimit`, `matchResolutionsThisFloor`, bonus tag `flip_par` ([`game.ts`](../../src/shared/game.ts)).

### Priority
Medium

### Objective
Bonus if committed flips (or match flips) stay under `ceil(pairs * K) + B`. Document peek, gambit third flip, undo.

### Spec reference
Backlog **O-03**.

### Affected areas
- `src/shared/game.ts` — counters on `RunState` / `stats`; flip increment sites.
- `contracts.ts` — extend stats or small `floorObjectiveState` struct.
- `GameScreen.tsx` — optional HUD hint for “Par: N flips”.

### Acceptance criteria
- Written rules in repo for what increments the counter.
- Tests for peek/gambit edge cases.

### Dependencies
None; cleaner if **GP-O01** establishes bonus reporting shape.

### Out of scope
Leaderboard for flip efficiency (future).

---

## GP-O04 — Per-floor scholar-style bonus

### Status
**Done** — `shuffleUsedThisFloor` / `destroyUsedThisFloor`; tile swap sets the shuffle-side flag; bonus tag `scholar_style`; encyclopedia topic `sys_scholar_style_floor` ([`mechanics-encyclopedia.ts`](../../src/shared/mechanics-encyclopedia.ts)).

### Priority
High

### Objective
Bonus if the floor is cleared **without shuffle, tile swap, and destroy** on that floor (even when allowed). Separate from run-wide `powersUsedThisRun` where needed.

### Spec reference
Backlog **O-04**.

### Affected areas
- `src/shared/game.ts` — `shuffleUsedThisFloor`, `destroyUsedThisFloor` (or infer + explicit flags).
- Scoring on level complete.
- `GameScreen.tsx` — optional summary line.

### Acceptance criteria
- Does not break `ACH_PERFECT_CLEAR` / existing achievement semantics; document interaction.
- Scholar contract runs still behave sensibly (often always eligible for “no destroy/shuffle” if disabled — clarify copy).

### Dependencies
None.

### Out of scope
Changing contract definitions.
