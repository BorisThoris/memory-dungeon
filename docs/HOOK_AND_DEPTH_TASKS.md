# Tasks: hookability & deep play

Design context: [GAME_MECHANICS_IDEAS.md](./GAME_MECHANICS_IDEAS.md), [GAME_MECHANICS_PLAN.md](./GAME_MECHANICS_PLAN.md), [MARKET_SIMILAR_GAMES_RESEARCH.md](./MARKET_SIMILAR_GAMES_RESEARCH.md). Idea-level checkboxes: [GAME_MECHANICS_IDEAS_TASKS.md](./GAME_MECHANICS_IDEAS_TASKS.md). Forgiveness: [GAME_FORGIVENESS_DEEP_DIVE.md](./GAME_FORGIVENESS_DEEP_DIVE.md).

**Legend:** `[P0]` highest leverage · `[P1]` strong follow-up · `[P2]` polish / longer tail · `[Research]` design spike before build

---

## Phase A — Session & habit hooks

- [x] `[P0]` **A1** — Daily challenge: fixed seed (calendar or UTC day); seed in `game.ts`, save or date-derived; optional menu entry vs main run.
- [x] `[P0]` **A2** — Daily + one mutator (shorter memorize, no destroy, etc.); can follow A1; needs **D2**.
- [x] `[P1]` **A3** — Daily results: seed id, score, floor, optional share string / clipboard.
- [x] `[P1]` **A4** — Weekly curated floor: JSON `level` + `seed`; later remote config. *(Menu banner + `starter_pairs`; remote config later.)*
- [x] `[P2]` **A5** — Optional streak: cosmetic or low-pressure only; avoid punishing misses ([MARKET_SIMILAR_GAMES_RESEARCH.md](./MARKET_SIMILAR_GAMES_RESEARCH.md) §4). *(Cosmetic streak in `playerStats`, with one grace day: a single missed UTC day is forgiven and a consecutive clear earns the grace back — see `resolveDailyStreak` in `save-data.ts`.)*

---

## Phase B — Run identity & “build” depth (roguelite-style)

- [x] `[Research]` **B1** — Relic roster doc: 8–15 concepts; no overlap with forgiveness jobs. → [RELIC_ROSTER.md](./RELIC_ROSTER.md)
- [x] `[P0]` **B2** — Relic pick UI + state after floor N (e.g. 3, 6, 9): pick 1 of 3; `RunState` / save / `contracts` / `game.ts`.
- [x] `[P0]` **B3** — Implement 3–5 relics v1 (+shuffle, first shuffle free/floor, +memorize, destroy cost tweak, …); two viable builds minimum.
- [x] `[P1]` **B4** — Relic synergy playtest matrix; fix softlocks. → [RELIC_SYNERGY_PLAYTEST.md](./RELIC_SYNERGY_PLAYTEST.md)
- [x] `[P1]` **B5** — Run summary / game over lists relics taken.

---

## Phase C — Secondary goals & mastery

- [x] `[P0]` **C1** — Contract flags data model: `noShuffle`, `noDestroy`, `maxMismatches`, `maxFlips` (start with 2–3).
- [x] `[P0]` **C2** — Run start: optional contract pick **or** random daily contract; multiplier or badge reward. *(Scholar menu + daily contract TBD; scholar shipped.)*
- [x] `[P1]` **C3** — End-of-floor contract progress / partial credit UI. *(Level-complete copy / fail via `maxMismatches`.)*
- [x] `[P1]` **C4** — Ascetic ladder: local stat or board for best floor without powers; ties to `powersUsedThisRun` / perfect achievements.
- [x] `[P2]` **C5** — Speed gauntlet mode: timer per floor or run; fail condition clear; optional separate mode. *(Run-wide gauntlet + HUD; menu presets **5 / 10 / 15** minutes.)*

---

## Phase D — Mutators & rule variety

- [x] `[Research]` **D1** — Mutator spec: enum, copy, rules for memorize vs playing vs powers (append to PLAN or new doc). → [MUTATORS.md](./MUTATORS.md)
- [x] `[P0]` **D2** — Mutator engine: `activeMutators` on run; hooks in `game.ts` (timing, score, power gates); v1 = one active mutator.
- [x] `[P1]` **D3** — Ship 3 mutators: glass floor, sticky fingers, score parasite (or equivalents from ideas doc).
- [x] `[P1]` **D4** — Wire daily (A2): roll one mutator with daily seed.
- [x] `[P2]` **D5** — Category mutator: letters-only / numbers-only via `pairKey` / sets.

---

## Phase E — Async & social-light

- [x] `[P1]` **E1** — Export run payload: seed, version, floor, score, optional flip hash; clipboard or file. *(Summary JSON + game over copy.)*
- [x] `[P2]` **E2** — Import seed string → validate schema → play.
- [x] `[P2]` **E3** — Local ghost: last run flip order as timeline or heatmap. *(Flip count + `flipHistory`; collapsible step timeline on game over; heatmap still optional.)*
- [x] `[Research]` **E4** — Online leaderboard scope: daily seed only, anti-cheat assumptions; defer until product call. → [LEADERBOARDS_DEFERRAL.md](./LEADERBOARDS_DEFERRAL.md)

---

## Phase F — Puzzle / fixed content

- [x] `[P1]` **F1** — Hand-crafted level JSON: grid, tiles, optional locked mutator. *(Builtin puzzle object shape.)*
- [x] `[P1]` **F2** — Puzzle mode menu: fixed puzzle list, no RNG for those ids.
- [x] `[P2]` **F3** — Community PR guidelines for new puzzle JSON. → [PUZZLE_CONTRIBUTING.md](./PUZZLE_CONTRIBUTING.md)

---

## Phase G — Presentation & layout

- [x] `[P2]` **G1** — Spaghetti / cloud layout prototype (bounded); per-mode flag. *(Settings → board presentation “spaghetti tilt”.)*
- [x] `[P2]` **G2** — Breathing grid drift; respect `reduceMotion`. *(Breathing scale animation when motion allowed.)*
- [x] `[P2]` **G3** — Focus cone (dim outside radius); a11y review. *(Focus assist: dim non-orthogonal neighbors on **fallback** 2D board.)*

---

## Phase H — Additional powers & assists

- [x] `[Research]` **H1** — Peek: charged post-memorize reveal of one hidden tile (arm → tap); `peekCharges` / `peekRevealedTileIds`; counts as power use. *(Shipped `applyPeek` + GameScreen + `game.ts`.)*
- [x] `[Research]` **H2** — Undo once/floor before resolve timer completes (`cancelResolvingWithUndo`); achievement / perfect-run still gated by `powersUsedThisRun`.
- [x] `[Research]` **H3** — Gambit third flip once per floor when first two do not match; resolves triplet in `resolveGambitThree`.
- [x] `[Research]` **H4** — Wild / joker: one wild tile per run when enabled (`createWildRun` / `includeWildTile`); single consumable match against any symbol.

---

## Phase I — Meta progression & cosmetics

- [x] `[P1]` **I1** — Save schema: unlocks (backs, frames, mutator pool); bump `SAVE_SCHEMA_VERSION`. *(`unlocks[]` + v3 fields.)*
- [x] `[P2]` **I2** — Earn cosmetics via achievements or high-water stats. *(Achievement tags appended to `unlocks`.)*
- [x] `[P2]` **I3** — Stats screen: best no-shuffle floor, dailies completed, relic usage. *(Main menu summary + relic pick detail.)*

---

## Phase J — UX & onboarding

- [x] `[P0]` **J1** — FTUE: powers + future contracts; extend hints or one-shot modal.
- [x] `[P1]` **J2** — Results line: “try daily / contract / relic next.” *(Game over hint block.)*
- [x] `[P1]` **J3** — Optional Practice vs Ranked split if stress increases. *(`practiceMode` run.)*

---

## Phase K — Analytics & balance

- [x] `[P2]` **K1** — Telemetry: run start/end, relics, power usage, daily complete (privacy-first). *(`telemetry.ts` no-op sink + store hooks.)*
- [x] `[P2]` **K2** — Balance pass: floor curve vs relic power (after B2–B3). → [BALANCE_NOTES.md](./BALANCE_NOTES.md)

---

## Suggested build order (milestones)

1. **M1 — Habit:** A1 → A3 → J1  
2. **M2 — Depth:** B1 → B2 → B3 → B5  
3. **M3 — Goals:** C1 → C2 → C3  
4. **M4 — Variety:** D1 → D2 → D3 → A2 / D4  
5. **M5 — Content:** F1 → F2  
6. **M6+:** E*, G*, H*, I*, K* as appetite allows  

---

## Done / already in repo

- [x] Board powers: shuffle, pin, destroy ([GAME_MECHANICS_PLAN.md](./GAME_MECHANICS_PLAN.md))
- [x] Forgiveness: grace, guards, shards, soft streak, memorize bonus
- [x] Shuffle FLIP + 3D motion; `powersUsedThisRun` / perfect clear gating

Update checkboxes when tasks close or scope changes.
