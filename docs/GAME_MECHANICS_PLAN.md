# Board powers — fleshed implementation plan

This document turns [GAME_MECHANICS_IDEAS.md](./GAME_MECHANICS_IDEAS.md) into a **sequenced, buildable spec**. It assumes the current core loop in `src/shared/game.ts` (memorize → play → resolve; lives; grace; guards; shards; soft streak; pending memorize bonus).

## Stored summary (single source of truth)

| Item | Locked value |
|------|----------------|
| **Forgiveness vs powers** | Mistake economy stays as-is; powers are **tools** (layout / planning / overload). |
| **Shuffle** | **1** charge at **run start**; **no refill** between floors in v1. |
| **Pin** | **Max 3** markers; **playing** only; no charge counter. |
| **Destroy** | **0** at run start; rewards can add charges to an uncapped run-local bank. |
| **Destroy scoring** | **0** match score; **no** `currentStreak` gain; counts toward `matchedPairs` / clear. |
| **Achievements** | **Option B**: do **not** disable the whole run; only gate **perfect-run-style** checks when powers used (see §7). |
| **Shuffle / pins** | **Clear all pins** after shuffle. |
| **When powers work** | **`playing` only**; `flippedTileIds.length === 0` for shuffle & destroy; never in memorize / resolving / paused / level complete / game over. |

*Change this table when design changes — implementation should mirror it.*

---

## 1. Goals and non-goals

### Goals

- Add **player agency** beyond “flip better” — limited **charges** with clear use cases.
- Keep **readable design**: each power answers a different frustration (layout vs planning vs overload).
- Ship in **vertical slices**: each slice is playable, testable, and shippable alone.

### Non-goals (for this plan’s first release track)

- Meta progression shop, relic drafts, or save-schema **currency** (can follow later).
- Peek / wild tile / gambit flip (documented as **phase 4+ backlog** only).
- PvP or async features.

---

## 2. Design principles (locked)

| Principle | Implication |
|-----------|-------------|
| **Powers ≠ forgiveness** | Grace, guards, shards, soft streak, life-loss memorize bonus stay the “mistake economy.” Powers are **tools**, not extra lives. |
| **Costs are visible** | Player always sees charges before spending; confirm for high-impact actions if needed. |
| **One primary cost dimension (v1)** | Use **charges per run** first. Score tax or life cost can be **v2 tuning** once telemetry feels right. |
| **Memorize phase is sacred** | No shuffle, pin, or destroy during **`memorize`** (avoids weird timing with timers). |
| **Resolving is locked** | No powers while **`resolving`** (two tiles face-up waiting for resolve), unless we later add an explicit exception. |
| **Paused / level complete / game over** | No powers. |

---

## 3. Product decisions (locked for v1)

| Topic | Decision |
|-------|----------|
| **Charge source** | **Granted at run start**; destroy **earned** on clean clear (below). **No** meta currency in `SaveData` for v1. |
| **Achievements** | **Option B** (§7): selective gating only; track `powersUsedThisRun` for stats / UI if useful. |
| **UI** | **Two icon buttons** (shuffle, destroy) + **pin toggle**; show **numeric charges** for shuffle/destroy. |
| **Tutorial** | One-time copy or hint row: shuffle / pin / destroy limits; can extend `FORGIVENESS_HINT` or add a second line. |

### Charges (constants in `contracts.ts`)

| Power | Start of run | Refill |
|-------|----------------|--------|
| **Shuffle** | `1` | **None** in v1 (entire run). |
| **Pin** | N/A | **Max 3** concurrent pins; unlimited pin/unpin while under cap. |
| **Destroy pair** | `0` | Run-local rewards add charges to an uncapped bank. |

*Rationale*: Shuffle is the simple “unstick”; pins are low power (slot cap); destroy is strong so it is **earned**, not free.

---

## 4. Feature specifications

### 4.1 Shuffle (phase 1 — ship first)

**Intent**: Fix bad **spatial** clustering; intentionally **invalidates positional** memory from memorize — player accepts that trade by spending a charge.

**When allowed**

- `run.status === 'playing'`
- At least **2** tiles with `state === 'hidden'` (unmatched, not currently flipped — if one of a pair is flipped, define: **only shuffle hidden tiles**; flipped tiles stay in place **or** shuffle aborts if any flip in progress — **recommend**: only callable when `flippedTileIds.length === 0`).

**Effect**

- Take all **hidden** unmatched tiles; **Fisher–Yates** shuffle their order in the `tiles` array.
- **Matched** tiles stay in fixed indices **or** compact hidden tiles into shuffled slots — **recommend**: keep array length stable; swap positions of hidden tiles only among hidden indices so matched cells do not move (simpler mentally: “only messes up what you have not locked in”).

**Implementation note**: Today `tiles` is a flat list with `columns`/`rows` derived from count. Easiest approach: shuffle **order of hidden tiles** while preserving **matched tile positions** in the array. That may require a defined algorithm (e.g. extract hidden tile objects, shuffle, write back into hidden slots in row-major order).

**Cost**

- Consume `1` shuffle charge if `shuffleCharges > 0`.

**Edge cases**

- Level with 1 pair left: shuffling two hidden tiles is a no-op or disabled — **disable button** when ≤1 hidden pair.
- After shuffle: clear **pins** on shuffled tiles only, or clear **all pins** — **recommend**: **clear all pins** on shuffle (simple rule).

---

### 4.2 Pin / mark (phase 2)

**Intent**: **Planning** only — no symbol reveal.

**When allowed**

- `playing` (and optionally `memorize` **deferred** — **recommend**: **playing only** for v1).

**Effect**

- `pinnedTileIds: string[]` with `length <= MAX_PINS` (3).
- Tapping a pinned tile unpins it. Tapping an unpinned hidden tile adds pin (if under cap).
- Pins are **visual only**; do not affect match logic.

**Cost**

- None (cap by count).

**Edge cases**

- Tile matches: remove its id from `pinnedTileIds` when tile becomes `matched`.
- Level advance: **clear all pins**.
- Shuffle: **clear all pins** (see 4.1).

**UI**

- **Mode**: “Pin” toggles active; taps apply pin/unpin. **Or** long-press to pin (harder to discover). **Recommend**: explicit **Pin** toggle button + cursor state.

---

### 4.3 Destroy pair (phase 3)

**Intent**: Reduce **overload** — removes one **full unmatched pair** from the board without flipping.

**When allowed**

- `playing`, `flippedTileIds.length === 0`
- `destroyPairCharges > 0`
- At least one **unmatched** pair still fully `hidden` (both tiles hidden).

**Effect**

- **Target selection**: player picks **one** hidden tile; system removes **both** tiles of that `pairKey` from the “active” pool.

**Data shape options**

- **A (recommend)**: Mark both tiles `state: 'matched'` and increment `matchedPairs` by 1 (reuse match pipeline for **win condition**). Optionally add `matchReason: 'destroyed'` on stats for analytics.
- **B**: New state `'removed'` — more branching in `flipTile` / resolve. Avoid unless needed.

**Cost**

- `1` destroy charge per use.

**Streak / scoring**

- **Recommend**: counts as **+1 match** for `matchedPairs` and **level clear**, but **does not** increase `currentStreak` (avoids farming guards/shards). Optional: grant **0 score** or **flat 10** for destroy — **recommend**: `0` match score for destroy so it is pure tempo, not score exploit.

**Edge cases**

- Last pair destroyed: trigger **same path as** clearing board (`finalizeLevel` after board cleared).
- Achievements: destroying last pair might skip “true” perfect — define **perfect floor** as `tries === 0` still; destroy does not add tries — good.

---

## 5. State model (TypeScript sketch)

Add to `RunState` (names illustrative):

```ts
shuffleCharges: number;
destroyPairCharges: number;
pinnedTileIds: string[];
powersUsedThisRun: boolean; // if any power used; for achievements / stats
```

Session stats extension (optional):

```ts
shufflesUsed: number;
pairsDestroyed: number;
```

Constants in `contracts.ts`: `INITIAL_SHUFFLE_CHARGES`, `MAX_PINS`, `DESTROY_CHARGE_ON_CLEAN_CLEAR`, etc. Destroy charges are stored as an uncapped run-local bank.

Pure functions in `game.ts`:

- `canUseShuffle(run): boolean`
- `applyShuffle(run): RunState` (immutable)
- `togglePin(run, tileId): RunState`
- `applyDestroyPair(run, tileId): RunState`

---

## 6. UI / UX checklist

- [x] Shuffle button: disabled states + tooltip (“No charges”, “Finish flip”, “Not during memorize”). — **Shipped** in `GameLeftToolbar` / board chrome (`useAppStore` guards).
- [x] Destroy: two-step **confirm** optional for v1 (mobile: confirm modal) — **recommend**: **no modal** if charges are scarce; **yes modal** if we add life-cost later. — **Resolved:** no confirm modal in v1 per plan; revisit if life-cost added.
- [x] Pin mode: visible **active** state on chrome; ESC / tap outside cancels mode. — **Shipped** in toolbar + tile input paths.
- [x] **Reduce motion**: pin and shuffle animations respect `settings.reduceMotion`. — **Shipped** in board / motion hooks.
- [x] Screen reader: `aria-label` on actions; live region when charge spent. — **Shipped** on power controls + HUD patterns; extend labels if new actions added.

---

## 7. Achievements and integrity (**locked: Option B**)

**Stored rule**: Using board powers does **not** set `achievementsEnabled = false` for the whole run (unlike optional debug reveal).

**Gating (implement in `evaluateAchievementUnlocks` or equivalent)**:

- **`ACH_PERFECT_CLEAR`**: **Locked**: if `powersUsedThisRun`, **do not** unlock this achievement for that run (even if floor was mistake-free). Other achievements stay eligible. Document the exact predicate next to code.
- **All other current IDs** (`ACH_FIRST_CLEAR`, `ACH_LEVEL_FIVE`, `ACH_SCORE_THOUSAND`, `ACH_LAST_LIFE`, etc.): **remain eligible** when powers are used unless a future achievement explicitly says otherwise.

**Option A (not v1)**  
Full-run `achievementsEnabled = false` when any power used — reserved for a future “purist” mode if needed.

Document the exact achievement predicates in `src/shared/achievements.ts` beside `evaluateAchievementUnlocks`.

---

## 8. Implementation phases (engineering order)

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **P1** | Shuffle only + charges + `applyShuffle` tests + UI button | Playable; tests for edge cases; pins cleared on shuffle (even if pins not built yet — stub empty array). |
| **P2** | Pin state + TileBoard visuals + pin mode input | 3 pins max; clears on level up / shuffle. |
| **P3** | Destroy pair + earn rule on clean clear + stats | Level can end via destroy; streak/score rules verified in tests. |
| **P4** | Polish: SFX, tutorial copy, achievement policy, telemetry hooks if any | Ready for external playtest. |

---

## 9. Testing matrix (minimum)

- Shuffle with 0 charges → no-op.
- Shuffle with 1 pair left hidden → disabled or no-op.
- Shuffle during memorize / resolving / paused → no-op.
- Pin cap at 3; pin matched tile → id removed from pins.
- Destroy: both tiles leave board; `matchedPairs` and win condition; no streak increment.
- `advanceToNextLevel` resets pins; define whether shuffle/destroy charges **persist** run-wide (yes per plan) or reset per floor (no — plan says per run).

---

## 10. Backlog (not in v1–3 scope)

- **Peek** (post-memorize, charged).
- **Echo** (longer mismatch feedback) — art-only-ish.
- **Gambit flip** (third flip once per floor).
- **Relic pick** after level N (+1 shuffle, etc.).
- **Meta currency** in `SaveData` for shop refills.
- **Weak shuffle** (row swap only) as a relic or setting.

---

## 11. Locked answers (formerly open questions)

| Question | Answer stored here |
|----------|-------------------|
| Shuffle refill? | **No** — **1** charge for the **whole run** (v1). |
| Destroy earn: perfect vs clean clear? | Current rules grant destroy charges through run-local reward sources into an uncapped bank; update this table before changing earn cadence. |
| Achievement disable: full vs selective? | **Selective (Option B)** — §7. |

**Playtest note**: If data shows destroy too rare or shuffle too stingy, revise **this section and the summary table at the top** first, then change constants.

---

## 12. File touch list (when coding)

| Area | Files |
|------|--------|
| Rules + types | `src/shared/contracts.ts`, `src/shared/game.ts`, `src/shared/game.test.ts` |
| Achievements | `src/shared/achievements.ts`, `achievements.test.ts` |
| Store / input | `src/renderer/store/useAppStore.ts`, `useAppStore.test.ts` |
| UI | `GameScreen.tsx`, `TileBoard.tsx`, `*.module.css`, possible small `BoardPowerBar.tsx` |
| Copy | `MainMenu.tsx` / onboarding if extended |

---

*Board powers v1–3. Revise the **Stored summary** table and §11 when playtest or scope changes.*
