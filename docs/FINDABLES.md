# Findables system

**Status:** **Implemented** in `game.ts` (`findableKind` on tiles, `findables_floor` mutator, HUD counter). Task file [`GP-FINDABLES.md`](./gameplay-tasks/GP-FINDABLES.md) is **historical** (checkboxes may lag).  
**Backlog id:** **FN-01** in [`gameplay-depth/05-app-specific-idea-backlog.md`](./gameplay-depth/05-app-specific-idea-backlog.md).

**Authoritative kinds and numbers:** [`FindableKind`](../src/shared/contracts.ts), `FINDABLE_MATCH_SCORE` and `FINDABLE_KIND_SPAWN_WEIGHTS` in [`contracts.ts`](../src/shared/contracts.ts). Spawn logic: `assignFindableKindsToTiles` in [`game.ts`](../src/shared/game.ts).

## The “?” glass decoy is gone

Older builds carried a **`glass_floor`** mutator that dealt a partnerless **`?`** card (`pairKey`
**`__decoy__`**) to tempt mis-flips, and a **glass witness** bonus for leaving it alone. All three —
the mutator, the card and the objective — were removed at **Gen 196**; see
[`REMOVED_DECOY.md`](./REMOVED_DECOY.md). Every card on the board now has a partner, with the wild
joker as the only exception. **Findables** are, and always were, a different thing: optional
**reward markers** on **normal pairs** (corner ring in WebGL when face-up), granting score when the
carrier pair is matched.

## Purpose

**Findables** are optional, board-placed goals **besides** clearing pairs: specific tiles (or pairs) carry a **pickup** that the player **claims** by meeting a clear rule (default: **complete that pair’s match**). They add **exploration / planning** on top of pair memory without replacing the win condition (**clear the board**).

Design goals:

1. **Readable** — Player can see during memorize (or on first reveal) that something is special; HUD/codex explain the **claim** rule.
2. **Low extraneous load** — Bounded count per floor (**0–2** findable **pairs** in normal generation), **visually distinct** from generic pair chrome (not hue-only); aligns with [research/RESEARCH_LOG.md](./research/RESEARCH_LOG.md) (distractor similarity).
3. **Fair** — Seeded from `runSeed`, `runRulesVersion`, and level so runs reproduce; **destroy** / **shuffle** behaviors are explicit (see below).
4. **Rules evolution** — Older exports (`runRulesVersion` below `PICKUP_BASELINE_RULES_VERSION` in `game.ts`) treated findables as **mutator-only**; current rules spawn findables on **procedural** boards without requiring that mutator (see **When findables appear**).

## Concepts

| Term | Meaning |
|------|---------|
| **Findable kind** | `FindableKind` in `contracts.ts`: **`score_glint`**, the one kind left. `ward_spark` and `scout_glint` went in Gen 176 with the hazard tiles and dungeon cards they acted on; `shard_spark` went in Gen 184 with the combo shard it paid (`docs/REMOVED_LIVES.md`). |
| **Carrier** | A **tile** (by `tile.id`) that **holds** the findable. **Both** tiles of a pair carry the same `findableKind` when spawned. |
| **Claim** | On **match**, apply the reward from `FINDABLE_MATCH_SCORE`; increment `findablesClaimedThisFloor`; clear `findableKind` on matched tiles. |
| **Spawn** | `assignFindableKindsToTiles` in `buildBoard` (after `createTiles`), using a dedicated RNG seed string. |

## Implemented rules (code)

### When findables appear

Spawn runs inside `assignFindableKindsToTiles` (`game.ts`).

- **Legacy (rules version below `PICKUP_BASELINE_RULES_VERSION` in `game.ts`):** No findables unless the run includes mutator **`findables_floor`**. If enabled, pair count is **0**, **1**, or **2** (weighted RNG: 20% / 50% / 30%).
- **Current (rules version at or above that baseline):**
  - With mutator **`findables_floor`**: **2** findable pairs (capped by eligible real pairs on the floor).
  - Without that mutator: **levels 1–3** → **1** pair; **level 4+** → **1** or **2** pairs (50% each), capped by eligible pairs.
- **Kind per pair:** weighted roll from `FINDABLE_KIND_SPAWN_WEIGHTS`: `score_glint` **100** (one kind, so the roll is a formality kept for the day a second kind earns its place).
- **Never** on wild (`WILD_PAIR_KEY`) singletons.
- **Fixed / handcrafted boards** (`buildBoard` with `fixedTiles`): `assignFindableKindsToTiles` is **not** applied — no spawned findables unless the fixed payload already sets `findableKind`.

### Claim condition

- **On successful match** (normal flip resolution or wild-card path) where **either** tile still has `findableKind` **before** resolution → **one claim per pair** (both tiles share the same kind when spawned).

### Rewards (authoritative)

Values are in **`FINDABLE_MATCH_SCORE`** (`contracts.ts`). On claim, the score request applies through match resolution.

| Kind | Flat match score |
|------|------------------|
| `score_glint` | **+25** |

Tune so rewards **do not** obsolete secondary objectives (scholar style, cursed last, flip par) — findables are **extra sugar**, not the main economy.

### Interactions

| Action | Behavior |
|--------|----------|
| **Match pair** (normal / wild) | Claim if findable on that pair; bonuses from tables above. |
| **Destroy pair** | Findable **not claimed** — destroy uses a separate path that clears `findableKind` without the match-time findable score. |
| **Shuffle (full or row)** | Findables **move with tiles** (identity keyed by `tile.id`); still claimable on later match. |
| **Peek** | Does not claim; may reveal carrier is special if UI shows marker only when face-up / peek face-up. |
| **Perfect Memory** | Findable claims are Perfect Memory-safe; they are match rewards, not assist powers. |

### Floor advance

- Reset `findablesClaimedThisFloor` and set `findablesTotalThisFloor` from the new board when advancing floors (`advanceToNextLevel` in `game.ts`).

## Data model

### `Tile` ([`contracts.ts`](../src/shared/contracts.ts))

```ts
/** If set, matching this pair claims a pickup reward on eligible floors. */
findableKind?: FindableKind;
```

After a claim or destroy, the field is **cleared** (`undefined`) on the affected tiles.

### `RunState`

- `findablesClaimedThisFloor: number`
- `findablesTotalThisFloor: number` (derived from tiles at floor start)

### `LevelResult` / `finalizeLevel`

- Findable points are folded into **match-time** score via `findableScoreBonus` in `game.ts` (export consistency follows normal scoring).

## Generation

- **Where:** `buildBoard` → `createTiles` → `assignFindableKindsToTiles`.
- **RNG:** `createMulberry32(hashStringToSeed(\`findables:${rulesVersion}:${runSeed}:${level}\`))` (see `game.ts`).
- **Cap:** Never more pairs with findables than there are eligible **real** pair keys on the board.

## Presentation & accessibility

- **Memorize + play:** Marker on carrier tiles — **pattern / icon / border**, not color alone; compatible with `silhouette_twist` (silhouette + findable glyph).
- **`reduceMotion`:** No pulsing requirement; static badge is enough.
- **Screen reader:** `aria-label` or visible text “Bonus pickup on this pair” in codex / FTUE string (`useHudPoliteLiveAnnouncement.ts`).

## Modes & fairness

- **Daily:** Only if mutator rolls into daily table (optional future) or dedicated daily variant — product choice.
- **Practice / Meditation:** Can enable via mutator pick; baseline rules still spawn findables on procedural boards without mutators (unless legacy save rules apply).
- **Puzzle / fixed board:** No spawn pass on `fixedTiles` boards unless tiles already carry `findableKind` in data.

## `GAME_RULES_VERSION` and export

- Bump when findables affect **generation** or **scoring** semantics.
- `RunExportPayload`: mutators + `runRulesVersion` + seed drive spawn; no separate per-floor findable table in v1.

## Non-goals (v1)

- Findables **between** cells (edge-only) — higher spatial WM load; defer to v2 (see [GAME_MECHANICS_IDEAS.md](./GAME_MECHANICS_IDEAS.md) presentation ideas).
- **Sequence combos** (match `1` then `2`) — separate design; not part of findables.

## Related docs

- [GAME_MECHANICS_IDEAS.md](./GAME_MECHANICS_IDEAS.md) — board powers, cognitive load note.
- [gameplay-depth/02-helper-tiers-and-cognitive-jobs.md](./gameplay-depth/02-helper-tiers-and-cognitive-jobs.md) — findables as **Search / planning**, not Recall substitute.
- [gameplay-tasks/GP-FINDABLES.md](./gameplay-tasks/GP-FINDABLES.md) — implementation tasks.
- [gameplay-tasks/GP_AUDIT_ROLLUP.md](./gameplay-tasks/GP_AUDIT_ROLLUP.md) — GP-FIN01–06 vs shipped code (audit).
