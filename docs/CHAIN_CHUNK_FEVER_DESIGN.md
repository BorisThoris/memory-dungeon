# Chain → Chunk → Fever: bringing the bubble-shooter payoff loop into the dungeon

**Written:** 2026-09-06
**Status:** design case + build plan. Generations 117–122 implement it; each generation lands independently and the game stays shippable between them.
**Related:** [MARKET_SIMILAR_GAMES_RESEARCH.md](./MARKET_SIMILAR_GAMES_RESEARCH.md) (positioning), [GAMEPLAY_SYSTEMS_ANALYSIS.md](./GAMEPLAY_SYSTEMS_ANALYSIS.md) (what exists), [BALANCE_NOTES.md](./BALANCE_NOTES.md) (numbers that move when this lands).

---

## 0. The one-paragraph version

Memory Dungeon has a deep rules layer and almost no *payoff*. A correct match turns two tiles grey. The streak is a number in the HUD. Nothing on the board ever happens *because* you were good. Bubble shooters and Peggle are addictive for one reason above all others: **one small, skilled input produces a large, visible, escalating consequence on the board** — and the consequence is bigger the better you have been playing. This document takes that loop and translates it honestly into a memory game: every tile carries a **suit** you can see on its back; a **chain** of correct matches earns you the right to **break a chunk** — the whole connected same-suit region around your match goes at once, partners included; and a long enough chain tips into **Fever**, the celebration beat. The dungeon is not beside this loop; it is inside it — chunks are how you hit enemies, traps are what stops a chunk, the exit is the last peg.

---

## 1. What actually makes these games tick

Not "juice". Juice is the surface. Underneath, five ingredients recur in every title in the genre, and each one is specific enough to test our design against.

### 1.1 Puzzle Bobble / Bust-a-Move (1994) — leverage and the drop

- You fire one bubble. Matching 3+ pops them. **That is not the payoff.** The payoff is that any cluster no longer connected to the ceiling **drops**, and dropped bubbles are worth far more than popped ones. A precise, small action removes a huge chunk you never touched.
- The board is **legible before you act**: colours are visible, clusters are visible, the shot you are planning is visible. The uncertainty is only in *execution*, never in *information*.
- Pressure is spatial — the ceiling descends — so "one more shot" is always framed as a rescue.

**Ingredient: leverage.** One input → many outputs, and the many were visible before the one.

### 1.2 Peggle (2007) — the multiplier ladder and the last peg

- One ball, dozens of hits. The score multiplier climbs as orange pegs clear (×1 → ×2 → ×3 → ×5 → ×10). Every hit in a shot plays a **rising pitch**. Named "style shots" (long shot, lucky bounce) label what just happened so the player can *own* it.
- **Extreme Fever**: on the last orange peg, the game stops — slow-motion, zoom, Ode to Joy, rainbow — and then pays out *bonus buckets* the player did nothing extra to earn. The finish is the biggest firework and it is free.
- The **free-ball bucket** and the **purple peg that moves every shot** keep attention on the board between the big moments.

**Ingredients: the escalation ladder** (multiplier, pitch, label rising together) and **the terminal celebration** (the finish is louder than anything before it).

### 1.3 Zuma / Luxor — chains that make chains

- Removing a group closes a gap; if the pieces that meet also match, they go too. **Cascades are emergent, not scripted.** "Gap shots" reward threading a needle.

**Ingredient: variable reward inside a skill frame.** The player caused it, but they did not fully predict it.

### 1.4 Bejeweled / Candy Crush — gravity, specials, Sugar Crush

- Gravity refills the board and new matches form on their own. Big matches mint **special pieces** — promised power you spend later. Winning with moves left triggers **Sugar Crush**: every remaining move fires automatically with full fanfare.
- The voice line tier ("Sweet" → "Tasty" → "Divine" → "Sugar Crush") is a public scoreboard of how good the move was.

**Ingredients: specials as promised power** and **a named tier for every good move**.

### 1.5 What the five ingredients say about us

| Ingredient | In the genre | In Memory Dungeon today | Gap |
|---|---|---|---|
| Leverage | pop 3 → drop 20 | match 2 → 2 turn grey | Total |
| Legible potential | colours visible before the shot | backs are identical; nothing to plan against | Total |
| Escalation ladder | multiplier + pitch + label | `playMatchSfx` pitches with chain depth; streak is a HUD number | Half: ears yes, eyes/board no |
| Terminal celebration | Extreme Fever, Sugar Crush | floor-clear dialog | No board moment |
| Variable reward in a skill frame | cascades, bounces | none — outcomes are fully determined by recall | Total |

The gap is not polish. It is that **nothing the board does is a consequence of playing well**. That is what this design fixes.

---

## 2. The honest translation

A memory game's "shot" is not aim. It is **recall** — the flip you are sure about. So the cascade cannot be something the player aims; it must be something the player **earns by remembering**. The Peggle multiplier is already here: it is the **streak** (consecutive correct matches, `stats.currentStreak`). Today it multiplies score. After this design it also changes the board.

**Chain → Chunk → Fever.**

### 2.1 Suits — the visible layer

Every pair gets a **suit**, one of four, and both tiles of the pair share it. The suit is painted on the **back** of the tile — the face-down side — as a colour and a rune, so it is visible from the moment the floor opens and never hidden. The symbol on the front is still the memory challenge. The suit is the plan.

Dealing is **clustered**: the generator seeds suits into regions so the board opens with visible same-suit chunks, the way bubble colours arrive in clumps. A board with four suits scattered uniformly is noise; a board with four suits in three or four clumps each is a *map*. Determinism is unchanged — same seed, same board.

Suits: **Ember**, **Tide**, **Moss**, **Bone**. Colour plus a distinct rune, because the trait palette already learned (Gen 6, Gen 11) that colour alone is not a channel.

### 2.2 Chain — the ladder you climb

The streak is renamed in player-facing copy to the **chain**, and it gets named tiers, said aloud on the run line and coloured on the HUD:

| Momentum | Tier name | What it unlocks |
|---|---|---|
| 1–2 | — | a match |
| 3+ | **Clean** | chunk break: neighbours |
| max(4, 40% of the floor's pairs) | **Sharp** | chunk break: full region |
| max(7, 65% of the floor's pairs) | **Fever** | region + its halo + celebration + shard burst |

**Momentum**, not the streak alone, climbs the ladder: the streak plus every pair the chunks broke since the chain last dropped (`chainMomentum`, `runChainTier`). The score streak, recall and rating never see cascaded pairs; only the tier does. Gen 121's simulation forced both halves of this. With fixed rungs at ×6/×10, Fever arrived on *zero percent* of floors even for a player who never missed — a twelve-pair floor ends before a chain of ten can exist. With floor-relative rungs but a streak-only ladder, the ladder ate itself: the better the player, the more pairs the chunks took, the fewer matches were left to climb with, and a sloppy player reached Fever more often than a clean one. Counting the cascade toward the tier is what a bubble shooter does with its combo, and it is what makes Fever mean "you ran most of this floor without dropping it".

The chain milestone pings the feedback rail already makes (×3 "Chain started", ×6 "Surge", ×10 "Combo") are the *score* ladder and still read the streak; the Clean rung sits on ×3 with them. Sharp and Fever are the *board* ladder and move with the floor. (Gen 119 aligned the fixed rungs; Gen 121 made the top two floor-relative. Gen 122 settled the two ladders by name rather than by number: the score ladder keeps its own words — Surge, Combo — and never says Sharp or Fever, and the chain stat on the HUD carries a hover that spells the momentum out: "Chain 3 plus 2 cascaded, momentum 5. Clean from 3, Sharp from 5, Fever from 8 on this floor.")

A mismatch halves the streak (the score multiplier forgives) and drops the cascade's momentum to zero: the fire goes out, and the ladder is climbed again from what was remembered. That is the "one more" tension the genre runs on, and it maps onto a real skill: the chain is literally how many things in a row you remembered.

### 2.3 Chunk break — the leverage

When a match resolves with chain ≥ 3, the game finds the **connected same-suit region** (4-neighbour, through hidden tiles only) around the two matched tiles.

- **Clean**: every hidden same-suit tile *orthogonally adjacent* to either matched tile breaks away — and its partner, wherever it is, breaks with it. Pairs leave together, always.
- **Sharp**: the *entire connected region* breaks, partners included.
- **Fever**: the region **and its halo** — every hidden tile bordering the clump, whatever its suit. Peggle's fever lights every peg left; here the whole neighbourhood of the clump goes.
- **Treasure spills.** A treasure pair inside the region breaks with it and pays exactly what a matched treasure pays (score, gold, "treasure opened"). This is not generosity; it is what the floors are made of. Measured in Gen 121, an early endless floor is one to three plain tiles and a wall of dungeon cards, most of them treasure — a chunk that took only plain pairs broke on almost no floor before the twelfth. Keys, levers, locks, shrines, gateways, shops, rooms and the exit still never break.
- Tiles that break are set to `removed` and scored as a **cascade**: less than a matched pair (no streak credit, no recall credit, no perfect-rating credit) but real score, scaled by chunk size, and **one combo shard per two pairs cascaded** — so a big break feeds survival, not only the number.

What the player sees: they match a pair inside a big Ember chunk, and the Ember chunk *goes* — a wave of shatters spreading out from the match, partners across the board popping in answer, the pitch climbing with each one. That is the drop. That is the whole reason to build a chain.

What the player does not get: cascaded pairs do not count toward the floor's recall stats. **Memory still pays best.** A player who ignores chunks and plays clean recall clears the floor with a better rating; a player who builds chains and breaks chunks clears it *faster* and *louder* with more shards. Both are real ways to play, which is the shape of a good economy.

### 2.4 Fever — the terminal celebration

At the Fever rung the break is a **Fever break** — the clump and its halo go — the board dims and pulses gold, time stretches for a beat (a 450 ms slow-in on the shatter wave, respecting `reduceMotion`), a distinct sting plays, and the run line names it. Every cascaded pair in a Fever break drops a shard, not every second one.

And the floor's **last pair** is its own moment regardless of chain — the last-peg beat: the exit tile lights, the board holds for a breath, then the floor-clear dialog. Today the dialog just appears. The finish should be louder than anything before it.

### 2.5 Proximity tips stay honest

The flipped-tile badge (Manhattan steps to the nearest legal partner, `pairProximityHint.ts`) is computed from the live board on every render and already ignores `matched` and `removed` candidates, so a chunk break invalidates it for free. Two things still need to be true and will be tested:

1. **Positions do not move.** There is no gravity in this design. Tiles are memory anchors; a board that reflows after every break is a different game (a good one — not this one). Removed tiles leave gaps, and distance is measured across gaps.
2. **After a break, every flipped tile's number is recomputed** against the tiles that remain — and if the partner it was pointing at was cascaded, the badge changes or disappears *in the same frame the chunk does*. A test flips a tile, breaks a chunk that includes its nearest partner, and asserts the new distance.

Gen 123 pinned both where they are read: `pairProximityHint.test.ts` (a removed tile is never a partner, distance is measured across the gap it left, a tile whose partner broke has no number), `tileBoardRows.test.ts` (the rows the badge plane renders from are rebuilt from the board the chunk left, so the frame that removes the chunk is the frame every badge is recomputed in) and the focused-tile live label. A DOM label helper nothing rendered (`getPairProximityLabel`) was deleted rather than tested. One structural fact does most of the work: a chunk only takes pairs whose *both* halves are hidden, so the partner of a flipped tile can never be cascaded out from under it.

### 2.6 Weaving the dungeon in

The dungeon systems are not spectators to the cascade. They are what the cascade is *for*.

| Dungeon piece | Role in the loop |
|---|---|
| **Enemy cards** | A chunk break that includes an enemy's tile **hits it** for chunk-size damage. Chunks are attacks. A big enough Sharp break kills a warden outright. |
| **Traps** | Traps **stop chunks**: the region does not propagate through a trap tile. Traps become spatial — a trap in the middle of your Ember clump is a wall, and springing it opens the clump. |
| **Findables** | A findable inside a broken chunk is **claimed** by the cascade (drop the treasure). |
| **Treasure cards** | **Spill.** A treasure pair inside the region breaks and pays as if matched (Gen 121). Without this the cascade was a non-feature on early floors, which are mostly treasure. |
| **Exit tile** | Never cascades. It is the last peg; you flip it yourself. |
| **Levers, keys, locks** | Never cascade, and a findable riding on one stays with it — the exit is waiting for that card, and a chunk that swallowed it would softlock the floor (found by the softlock scenario matrix in Gen 120). |
| **Hidden wardens** | Not hit. A chunk only damages a warden the player can already see; a hidden one inside a clump is untouched — you learn where it is the way you always did. |
| **Magpie** (Gen 112) | Steals from cascaded pairs first. Funnier, and fairer — it takes what you were given, before what you earned. |
| **Residents** (Gen 114) | Spilled toffee: *"The tiles stick"* — chunk regions propagate diagonally on that floor. The skull tells you the biggest chunk's suit when greeted. |
| **Route worlds / mutators** | Each floor's archetype biases suit clustering — clumped, scattered or two-suit (Gen 126, `SUIT_DEAL_PROFILE_BY_ARCHETYPE`) — a lever for the twelve-floor cycle without new mechanics. |

### 2.7 What is deliberately *not* in this design

- **No gravity / reflow.** Stated above. Positions are the memory.
- **No specials/power pieces minted by breaks.** Candy Crush's striped candy is a second economy; we already have relics, findables and powers. A break pays in score, shards and damage — currencies that exist.
- **No chunk break at chain ×1.** A lone match is a match. Leverage must be earned or it is noise.
- **No cascaded credit toward recall / perfect / rating.** The memory game stays the best game.

---

## 3. How it lands in this codebase

Every rule below is a pure function in `src/shared/`, reachable from the real turn path, with a typed event on the journal so the renderer projects it rather than diffing snapshots (`board-turn-feedback-boundary.test.ts`).

| Piece | Where |
|---|---|
| `TileSuit` on `Tile` (`suit: 'ember' \| 'tide' \| 'moss' \| 'bone'`) | `contracts.ts` |
| Suit assignment + clustered dealing | `board-tile-generation-rules.ts` → new `tile-suit-rules.ts` |
| Chain tiers | new `chain-tier-rules.ts` (`getChainTier(momentum, pairsOnFloor)`, `runChainTier(run)`) |
| Region finder + break rule | new `chunk-break-rules.ts` (`findSuitRegion`, `resolveChunkBreak`) |
| Turn integration | `turn-match-board-resolution-rules.ts` after the claim, before enemy damage; enemy damage reads the chunk |
| Event | `board.chunk_broken` on `gameplay-core-contracts.ts`; facts on `board.turn_resolved` (`chunkPairsBefore/After`, `chainTier`) |
| Scoring | `turn-match-score-rules.ts` cascade score; `combo-shard-rules.ts` shard grant |
| Suit on the back | `tileTextures.ts` back raster variant per suit; DOM fallback `.cardFaceBack[data-suit]` |
| Shatter wave | `tileShatter.ts` → staggered shatter by Manhattan distance from the match |
| Announcement | `boardTurnAnnouncement.ts` chunk/fever lines; copy in `src/renderer/copy/chainBeat.ts` |
| Codex | Chain, Chunk, Fever, Suits entries |
| Balance | endless simulation: floor-clear speed and score inflation before/after; `BALANCE_NOTES.md` |

---

## 4. Build plan

Each generation is its own commit, verified and pushed. Order is chosen so that at every point the game is playable and each layer can be proven before the next leans on it.

| Gen | Deliverable | Proof |
|---|---|---|
| **117** | Suits on every tile, clustered dealing, suit painted on the back (WebGL + DOM). No rule changes yet. | Generation test: every pair shares a suit; clustering metric (mean same-suit neighbours) beats uniform by a stated margin at every board size; the back renders four distinct suits; fit contract unchanged. |
| **118** | Chain tiers + chunk break rule in the real turn path, `removed` state, cascade scoring, shard grant, typed event, journal facts, proximity recompute test. | Unit + turn-path tests; the endless simulation still replays deterministically; proximity test from §2.5. |
| **119** | Presentation: shatter wave, tier names on the HUD and run line, pitch ladder tied to chunk size, Fever pulse (reduce-motion safe), last-pair beat. | Component tests for the announcement; a Playwright pass that builds a chain and screenshots a break at desktop and Deck sizes. |
| **120** | Dungeon weave: enemies take chunk damage, traps block regions, findables claimed by cascade, exit immune, magpie prefers cascaded pairs, toffee/skull hooks. | Rule tests per row of §2.6; encyclopedia entries. |
| **121** | Balance pass, done: `cascade-balance-simulation.ts` plays generated endless floors with a player who misses a stated share of turns; bands stated in code and gated (`yarn sim:cascade --check`, `gate:gameplay`). Found and fixed: fixed rungs unreachable, the streak-only ladder eating itself, dungeon-card floors with nothing to break (treasure spills), a Fever with nothing to break (the halo), a sim player that flipped the shop by accident and called it stuck. Per-floor clustering profiles were **not** built — no authored per-floor table exists to hang them on; the archetype cycle already varies what a chunk can reach more than clustering would. | Sim section in `BALANCE_NOTES.md`; bands hold on 6 seeds × 24 floors × 3 miss rates. |
| **122** | Closing sweep, done: Codex entries (Chain/chunk/Fever, what a chunk does to the dungeon, Suits — in the Board section since Gen 120, copy updated for momentum); two self-proving release-checklist rows (`chain-chunk-fever`, `cascade-balance`); a clumped-board fixture (`cascadeClump`) declared as an e2e surface and walked by the reachability gate; `e2e/cascade-chain.spec.ts` matches it row by row and asserts Clean, Sharp and Fever on the stage, a Fever break pulse, the HUD naming Fever and the floor clearing; the HUD chain stat explains its tier from momentum. | Green gates; the spec is the recorded play-through that reaches Fever. |
| **123** | Proximity honesty, done: a removed tile is never a partner, distance is measured across the gap it left, a tile whose partner broke has no number; pinned at the rule, at the rows the badge plane renders from, and at the focused-tile live label. The dead DOM label helper was deleted. | `pairProximityHint.test.ts`, `tileBoardRows.test.ts`, `tileBoardDomAccessibility.test.ts`. |
| **124** | Style shots, done: the turn event carries the chunk's shape (`chunkPartnerSpanMax`, `chunkHaloPairs`, `chunkTreasuresSpilled`, `chunkSuitCleared`), read off the two boards by the fact stamper; the run line names it in one line after the break — "Partner across the board", "Halo", "Treasure spill ×n", "Clean sweep". The pitch ladder already steps once per pair with a cap of twelve. | Fact tests, copy tests, the announcement test; Codex v21. |
| **125** | Extreme Fever, done: the momentum still standing when the last pair goes pays a small ladder at floor clear — a gold at Clean and Sharp, a shard and two gold at Fever (`floor-clear-momentum-bonus-rules.ts`, applied in `floor-clear-transition.ts`, tagged `extreme_fever`); never score or rating. The floor-clear dialog carries a chain recap (best chain, chunks and pairs cascaded, Fever breaks, the payout) from new per-floor counters (`feverBreaksThisFloor`, `bestChainThisFloor`). The cascade sim reports `extremeFeverShare` and holds a band: the clean player reaches it at least 1.5× as often as the reference player. | Rule, transition, dialog and counter tests; Codex v22. |
| **126** | Deal profiles by archetype, done: `SUIT_DEAL_PROFILE_BY_ARCHETYPE` in `tile-suit-rules.ts` — breather, treasure, gate, shadow, anchor, script and parasite floors deal in clumps; speed trials, trap halls and rush floors deal scattered; spotlight floors deal two suits. `dealBoardSuits` takes the profile; the board build reads it off the floor's archetype. Measured (clean player, 6 seeds × 24 floors): clumped floors cascade 4.3 pairs a floor, scattered 2.1, two-suit 7.8; Fever on 60%, 50% and 75% of them. The bands still hold. | Profile table covers every archetype (gated); scattered vs clumped on the same tiles; a built rush floor opens scattered; per-profile rows in the sim report. |

---

## 5. Risks, named

- **Trivialising the memory game.** Cascades remove pairs the player never recalled. Mitigation: chain-gated (needs recall to earn), no recall credit, tuned in Gen 121 with the simulation so that a pure-recall player still posts the best rating.
- **Visual noise on small viewports.** Four suit colours on every back plus traits plus dungeon markers. Mitigation: suit is the *base* of the back (colour field + one rune), traits and markers sit on top as now; check the fit contract at six viewports in Gen 119.
- **Colour-blind safety.** Rune per suit, not colour alone; verified with the trait palette's existing contrast audit.
- **Determinism / replay.** Clustered dealing and region breaks are seeded and pure; the endless simulation's core-replay check (Gen 17) catches any drift.
- **Score inflation breaking records.** Per-mode records (Gen 71) mean a new scoring regime is a new record season; the balance pass sets the bands.
