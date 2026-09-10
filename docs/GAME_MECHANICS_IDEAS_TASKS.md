# Tasks from [GAME_MECHANICS_IDEAS.md](./GAME_MECHANICS_IDEAS.md)

Check off as you ship or reject. **Roadmap-scale work** (dailies, relics, mutator engine) is also tracked in [HOOK_AND_DEPTH_TASKS.md](./HOOK_AND_DEPTH_TASKS.md) — cross-references below avoid duplicate wording.

**Legend:** `[P0]` · `[P1]` · `[P2]` · `[Research]`

---

## Already shipped (keep in sync with code)

- [x] **Shuffle** (limited charges, playing-only, FLIP animation) — [GAME_MECHANICS_PLAN.md](./GAME_MECHANICS_PLAN.md)
- [x] **Pin / mark** (cap 3, playing-only)
- [x] **Destroy pair** (bank, clean-clear earn, scoring rules)
- [x] **Forgiveness stack** (grace, guards, shards, soft streak, memorize bonus) — `game.ts`

---

## Research themes → actionable spikes

- [x] `[Research]` **Assist economy audit** — compare your charges to Mahjong-style hint/undo/shuffle pacing; document what you will *not* add (avoid feature creep). → [IDEAS_AUDITS.md](./IDEAS_AUDITS.md)
- [x] `[P2]` **Rule variants doc** — one-pager: Concentration-style alternates (one flip per turn, two decks) marked *out of scope* or *future mode*. → [IDEAS_AUDITS.md](./IDEAS_AUDITS.md)
- [x] `[P1]` **Symbol set guidelines** — [SYMBOL_GUIDELINES.md](./SYMBOL_GUIDELINES.md).
- [x] `[P2]` **Picture superiority pass** — [PICTURE_SUPERIORITY_CHECKLIST.md](./PICTURE_SUPERIORITY_CHECKLIST.md) (process doc; art pass ongoing).
- [x] `[Research]` **N-back / running-anchor mutator** — `n_back_anchor` in [MUTATORS.md](./MUTATORS.md) + HUD anchor pill + `game.ts` hooks.
- [x] `[P2]` **Named challenge modes** — surface mutators RoGlass-style in UI copy (even if only 1–2 exist) — see HOOK **D3**.
- [x] `[P2]` **Silhouette / speed twist** — `silhouette_twist` mutator (fallback board silhouette filter during play).
- [x] `[P1]` **Hand-crafted / Puzzle Lab mode** — HOOK **F1–F2**.

---

## Cognitive & meta-memory hooks (table → tasks)

- [x] `[P2]` **Spaced encore** — `encorePairKeysLastRun` in save + bonus in `resolveBoardTurn`; privacy: pairKey hashes only.
- [x] `[Research]` **Distraction channel mutator** — `distraction_channel` + settings toggle; **off by default**; respects reduce motion.
- [x] `[P1]` **Category floors** — letters-only / numbers-only mutator or player filter — HOOK **D5**.
- [x] `[P2]` **Atomic pairs** — `Tile.atomicVariant` + fallback inset colors; themes can key off variant.
- [x] `[P2]` **Meditation mode** — `gameMode: 'meditation'`; menu entry; nerfed streak rewards in `game.ts`.

---

## Modifier & challenge ideas (replay)

- [x] `[P1]` **Glass floor** — decoy tile, flip penalty, destroy rules — HOOK **D3**.
- [x] `[P1]` **Sticky fingers** — cannot flip same grid index next turn after a match — HOOK **D3**.
- [x] `[Research]` **Wide recall** — `wide_recall` mutator; fallback board de-emphasizes symbol on flipped tiles during play.
- [x] `[P1]` **Score parasite** — score multiplier vs life every N floors — HOOK **D3**.
- [x] `[P0]` **Daily seed** — HOOK **A1**; leaderboard later **E4**.
- [x] `[P2]` **Mirror craft** — builtin puzzle `mirror_craft` (symmetric 3×2 hand layout); standard clear win.

---

## Social, async, content

- [x] `[P2]` **Ghost run** — `flipHistory` + count + **game-over flip timeline** — HOOK **E3** / **E1**.
- [x] `[P1]` **Floor of the week** — curated JSON `level` + `seed` — HOOK **A4**, **F3** guidelines.
- [x] `[Research]` **Undo once per floor** — `cancelResolvingWithUndo` + HOOK **H2**; see [IDEAS_AUDITS.md](./IDEAS_AUDITS.md).

---

## Presentation & layout

- [x] `[P2]` **Spaghetti layout** — loose cloud layout — HOOK **G1**. *(CSS tilt prototype.)*
- [x] `[P2]` **Breathing grid** — 1–2px drift, `reduceMotion` off — HOOK **G2**. *(Subtle scale pulse.)*
- [x] `[P2]` **Focus cone** — dim outside radius — HOOK **G3**. *(Orthogonal neighbor dim, fallback board.)*

---

## Board manipulation (beyond shipped powers)

- [x] `[Research]` **Weaker shuffle** — `Settings.weakerShuffleMode` / `rows_only` path in `applyShuffle`.
- [x] `[P2]` **Shuffle score tax** — `shuffleScoreTaxEnabled` + `matchScoreMultiplier` decay on shuffle.
- [x] `[Removed]` **Remove one stray tile** — shipped, then removed in Gen 200 once the wild joker was the only legal target it had left. See [REMOVED_POWERS.md](./REMOVED_POWERS.md).

---

## Information & feedback

- [x] `[Research]` **Peek** — charged peek after memorize — HOOK **H1** + [IDEAS_AUDITS.md](./IDEAS_AUDITS.md) (updated).
- [x] **Pin / mark** (shipped)
- [x] `[P1]` **Echo** — extended mismatch resolve delay via `echoFeedbackEnabled` / `computeFlipResolveDelayMs` (outline deferred).

---

## Stakes & pacing

- [x] `[Research]` **Gambit third flip** — HOOK **H3** (`resolveGambitThree`).
- [x] `[P1]` **Slow time** — `resolveDelayMultiplier` in settings (applies to playing-phase resolve delays).
- [x] `[Research]` **Wild / joker** — HOOK **H4** + **Wild run** menu (`createWildRun`).

---

## Progression / meta (long-term)

- [x] `[P0]` **Relics** — draft pick after floors — HOOK **B1–B5**.
- [x] `[P0]` **Mutators opt-in** — charges ↔ memorize tradeoff, etc. — HOOK **D1–D2**.

---

## Open decisions (from ideas doc §Open decisions)

- [x] `[Research]` **Mutators v1 shortlist** — pick order: daily seed vs glass floor vs sticky fingers (recommend: seed first, then one mutator). → [IDEAS_AUDITS.md](./IDEAS_AUDITS.md)
- [x] `[Research]` **Undo vs ghost** — v1 or backlog (link to forgiveness audit). → [IDEAS_AUDITS.md](./IDEAS_AUDITS.md)
- [x] `[Research]` **Spaced encore** — save + privacy (see cognitive row above).
- [x] `[P2]` **Power UI** — buttons vs radial; align [OBSIDIAN_RELIC_THEORY.md](./OBSIDIAN_RELIC_THEORY.md) if present. → [IDEAS_AUDITS.md](./IDEAS_AUDITS.md)

---

## Suggested implementation order (ideas doc) — status

1. [x] Shuffle (limited charges)
2. [x] Pin / mark
3. [x] Destroy / remove pair
4. [x] Daily seed + mutator engine (HOOK **A1**, **D2**) and relic draft (**B2**)

---

## Code touchpoints (when picking any task)

- `src/shared/game.ts`, `src/shared/contracts.ts`
- `src/renderer/store/useAppStore.ts`
- `src/renderer/components/GameScreen.tsx` (+ board UI)

Update checkboxes when scope changes.
