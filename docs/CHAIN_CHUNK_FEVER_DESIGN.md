# Chain → Chunk → Fever: bringing the bubble-shooter payoff loop into the dungeon

**Written:** 2026-09-06
**Status:** design case + build plan. Generations 117–122 implement it; each generation lands independently and the game stays shippable between them.
**Related:** [MARKET_SIMILAR_GAMES_RESEARCH.md](./MARKET_SIMILAR_GAMES_RESEARCH.md) (positioning), [GAMEPLAY_SYSTEMS_ANALYSIS.md](./GAMEPLAY_SYSTEMS_ANALYSIS.md) (what exists), [BALANCE_NOTES.md](./BALANCE_NOTES.md) (numbers that move when this lands).

---

## 0. The one-paragraph version

Memory Dungeon has a deep rules layer and almost no *payoff*. A correct match turns two tiles grey. The streak is a number in the HUD. Nothing on the board ever happens *because* you were good. Bubble shooters and Peggle are addictive for one reason above all others: **one small, skilled input produces a large, visible, escalating consequence on the board** — and the consequence is bigger the better you have been playing. This document takes that loop and translates it honestly into a memory game: every tile carries a **suit** you can see on its back; **every match pops** — the whole same-suit clump touching the two tiles you matched breaks away with them, live, the moment the second tile turns; a **chain** of correct matches is what lets the pop **ripple** — the partners it pulls from across the board take their own clumps, wave after wave; and a long enough chain tips into **Fever**, the celebration beat. The dungeon is not beside this loop; it is inside it — pops are how you hit enemies, traps are what stops a pop, the exit is the last peg. Section 8 is the second pass, made after the first ten generations shipped: the brief said *while we're playing, not at the end*, and the first pass had gated the pop behind the chain.

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

| Momentum | Tier name | What it unlocks (as of §8) |
|---|---|---|
| 0–2 | — | **the pop**: the clump touching the match, pairs whose both halves touch it |
| 3+ | **Clean** | **the ripple**: partners across the board leave too, and each takes its own clump (two waves) |
| max(4, 40% of the floor's pairs) | **Sharp** | the reaction runs until a wave takes nothing |
| max(7, 65% of the floor's pairs) | **Fever** | Sharp + the first clump's halo + celebration + shard burst |

**Momentum**, not the streak alone, climbs the ladder: the streak plus every pair the chunks broke since the chain last dropped (`chainMomentum`, `runChainTier`). The score streak, recall and rating never see cascaded pairs; only the tier does. Gen 121's simulation forced both halves of this. With fixed rungs at ×6/×10, Fever arrived on *zero percent* of floors even for a player who never missed — a twelve-pair floor ends before a chain of ten can exist. With floor-relative rungs but a streak-only ladder, the ladder ate itself: the better the player, the more pairs the chunks took, the fewer matches were left to climb with, and a sloppy player reached Fever more often than a clean one. Counting the cascade toward the tier is what a bubble shooter does with its combo, and it is what makes Fever mean "you ran most of this floor without dropping it".

The chain milestone pings the feedback rail already makes (×3 "Chain started", ×6 "Surge", ×10 "Combo") are the *score* ladder and still read the streak; the Clean rung sits on ×3 with them. Sharp and Fever are the *board* ladder and move with the floor. (Gen 119 aligned the fixed rungs; Gen 121 made the top two floor-relative. Gen 122 settled the two ladders by name rather than by number: the score ladder keeps its own words — Surge, Combo — and never says Sharp or Fever, and the chain stat on the HUD carries a hover that spells the momentum out: "Chain 3 plus 2 cascaded, momentum 5. Clean from 3, Sharp from 5, Fever from 8 on this floor.")

A mismatch halves the streak (the score multiplier forgives) and drops the cascade's momentum to zero: the fire goes out, and the ladder is climbed again from what was remembered. That is the "one more" tension the genre runs on, and it maps onto a real skill: the chain is literally how many things in a row you remembered.

### 2.3 Chunk break — the leverage

> **Superseded in part by §8.** This section is the first pass (Gens 117–142), where the break was what a chain of three bought. The second pass makes the pop live on every match and gives the chain the ripple instead. The mechanics below — pairs leave together, treasure spills, cascades score less and carry no recall credit, what never breaks — all still hold.

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
| **122** | Closing sweep, done: Codex entries (Chain/chunk/Fever, what a chunk does to the dungeon, Suits — in the Board section since Gen 120, copy updated for momentum); two self-proving release-checklist rows (`chain-chunk-fever`, `cascade-balance`); a clumped-board fixture (`cascadeClump`) declared as an e2e surface and walked by the reachability gate; `e2e/cascade-chain.spec.ts` matches it row by row and asserts Clean, Sharp and Fever on the stage, a Fever break pulse, the HUD naming Fever and the floor clearing; the HUD chain stat explains its tier from momentum. Two fit-contract regressions from Gen 111 fixed on the way: the launch panel clipped its third action on a 390px phone, and the mode-detail sweep asked for the recommended run's card, which the launch panel replaced. Hot reload is off for e2e (`E2E_DISABLE_HMR`) so browser gates and editing can overlap. | Green gates; the spec is the recorded play-through that reaches Fever. |
| **123** | Proximity honesty, done: a removed tile is never a partner, distance is measured across the gap it left, a tile whose partner broke has no number; pinned at the rule, at the rows the badge plane renders from, and at the focused-tile live label. The dead DOM label helper was deleted. | `pairProximityHint.test.ts`, `tileBoardRows.test.ts`, `tileBoardDomAccessibility.test.ts`. |
| **124** | Style shots, done: the turn event carries the chunk's shape (`chunkPartnerSpanMax`, `chunkHaloPairs`, `chunkTreasuresSpilled`, `chunkSuitCleared`), read off the two boards by the fact stamper; the run line names it in one line after the break — "Partner across the board", "Halo", "Treasure spill ×n", "Clean sweep". The pitch ladder already steps once per pair with a cap of twelve. | Fact tests, copy tests, the announcement test; Codex v21. |
| **125** | Extreme Fever, done: the momentum still standing when the last pair goes pays a small ladder at floor clear — a gold at Clean and Sharp, a shard and two gold at Fever (`floor-clear-momentum-bonus-rules.ts`, applied in `floor-clear-transition.ts`, tagged `extreme_fever`); never score or rating. The floor-clear dialog carries a chain recap (best chain, chunks and pairs cascaded, Fever breaks, the payout) from new per-floor counters (`feverBreaksThisFloor`, `bestChainThisFloor`). The cascade sim reports `extremeFeverShare` and holds a band: the clean player reaches it at least 1.5× as often as the reference player. | Rule, transition, dialog and counter tests; Codex v22. |
| **126** | Deal profiles by archetype, done: `SUIT_DEAL_PROFILE_BY_ARCHETYPE` in `tile-suit-rules.ts` — breather, treasure, gate, shadow, anchor, script and parasite floors deal in clumps; speed trials, trap halls and rush floors deal scattered; spotlight floors deal two suits. `dealBoardSuits` takes the profile; the board build reads it off the floor's archetype. Measured (clean player, 6 seeds × 24 floors): clumped floors cascade 4.3 pairs a floor, scattered 2.1, two-suit 7.8; Fever on 60%, 50% and 75% of them. The bands still hold. | Profile table covers every archetype (gated); scattered vs clumped on the same tiles; a built rush floor opens scattered; per-profile rows in the sim report. |
| **127** | The clump read, done: `clump-read-rules.ts` reads the connected same-suit region a hidden tile stands in and how many pairs a Sharp break there would take, through the break's own region rule. On focus or selection the board outlines the clump (a `clump` back accent, lowest priority under any armed power), the preview chip names it ("Ember clump of 6 — a Sharp break here takes 2 more pairs."), and the tile's accessible name carries "clump of N" for keyboard, controller and screen reader. | Rule tests, accent tests, live-label test; Codex v24. |
| **128** | Feel, done: the shatter phrase is capped at nine notes with a per-note taper (pitch climbs, level does not); a low thud when a chunk finished a warden; the music bed ducks to 0.6 for one beat on a Fever break (`fever_break` in the REG-114 table, `useFeverDuck` keyed to the event); controller rumble per tier through the Gamepad vibration actuator, a silent no-op without one and off under reduce motion. | SFX, duck, rumble and ducking-table tests; the audio coverage table gains `chunk_break_ladder`. |
| **129** | Records and achievements, done: run-wide counters (`feverBreaksThisRun`, `biggestChunkPairs`, `chunkWardenKills`) feed four achievements — Fever, Sixfold (six pairs in one break, proved reachable on the clumped fixture), Extreme Fever, Buried (a warden finished by a chunk) — with Codex entries and Steam API names. The run summary and run history carry the longest chain and biggest chunk; records by mode keep the chain's own maxima across every run and Profile shows them. | Achievement, reachability, history, mode-record and counter tests; Codex v25; the checklist's API-name row re-proves the new ids. |
| **130** | Relics that touch the cascade, done: Tuning Fork (a Clean break reaches two steps), Magpie's Ledger (spilled treasure pays double gold, matched treasure unchanged) and Suit Lens (three suits a floor, bigger clumps) — standing rules in the pool with draft rows, Codex entries and draft-card copy, read by `resolveChunkBreak` and `dealBoardSuits`. The sim gained a loadout axis (`--relics`): each relic alone sits inside the bare bands; all three together lift a 25%-miss player's Fever share to 0.23, held to a stated relic band of 0.3. | Rule tests per relic, the pool alignment test, the sim loadout test; Codex v26. |
| **131** | Daily and shared play carry the chain, done: the run summary and history keep the longest chain (momentum, not the score streak) and the floors that reached Sharp and Fever, and the persisted summary normaliser now keeps them (it had been dropping Gen 129's `biggestChunk` on reload). The run share line and the daily share string say `best chain ×N` and `Fever on M floors`; the quest ladder gains Chain Rhythm (a Sharp chain on three cleared floors, read from a new `playerStats.sharpFloors` counter with a migration policy, folded in once per clear and never from a shared table). Pass-and-play seats credit the pairs a chunk took on their turn, keep a best chain, and the handoff line says "Player 1's chain of 4 ends. Player 2's turn." when a miss ends a chain of two or more; the standings show each seat's best chain. Fit-contract findings on the way: the relic draft's four offers wrapped to two rows at 1024×768 and pushed the reroll, ban and upgrade buttons below the fold (one row at every width now); the floor-clear recap pushed the third door off a phone (non-reward notes give way there); and the "dungeon showcase" fit case had been clicking a main-menu button Gen 111 retired, timing out at every size and reading as load — it is now the run setup sheet's fit case, which found the sheet's nine 44px rows overflowing a phone held sideways (three columns there). |
| **132** | Closing sweep, done. Sims re-run: bare bands and the relic-loadout bands both hold, numbers unchanged from Gen 130. The chain system is now a mechanic in the interaction graph (`board.chain_chunk_fever`, with the three chain relics' claim definitions in the core contracts — the pick reducer had been refusing Magpie's Ledger the moment a draft offered it, which the build-strategy playthrough caught). The mode-matrix spec was rewritten for the post-Gen-111 catalog: four real modes by name, and the setup sheet's clock, both vows at once, wild and unrecorded proven on the HUD — which found that a chaos setup did not carry the wild flag (the bar said Classic and a retry restarted Classic). A review-capture spec (`e2e/chain-review-capture.spec.ts`) and a look at the frames found the clump read never reached a mouse player: it followed keyboard focus only and refused a flipped seed. It now follows the pointer after a short rest and reads the first flipped tile too. Seen and left for the next batch: the phone board sits small in its stage with empty bands above and below; the dock's Shuffle and Swap labels touch at 390px; the Mystery door's risk line clips under the dialog's actions on a phone; and a retry after a setup run keeps the vow or the wild flag but drops the clock and the pace (restart precedence predates the sheet). | Full gates green; fit contract, reachability gate, cascade and pass-and-play specs green. |
| **133** | The Fever meter, done: `chainMeter` in `chain-tier-rules.ts` reads the ladder as one bar — momentum over the floor's Fever rung, ticks where Clean and Sharp sit, full at Fever and full until the chain drops (one bar rather than one per rung, because a bar that emptied on reaching Sharp would read as a loss at the moment the player did something right). Four pixels under the Chain number in `RunShell.tsx`, tier-coloured, pulsing at Fever unless motion is reduced, with a screen-reader label naming momentum of Fever-at. Peggle's multiplier reads at a glance because it is a meter; ours was a number, a word and a hover hint. | RunShell tests read the meter's fill, tier and label; fit contract re-run for the HUD's height. |
| **134** | The phone board fills its stage, done: `getCameraFitMargin` in `tileBoardViewport.ts` fits a stage taller than it is wide at 0.92 instead of the sideways phone's 0.76 bleed margin. Upright, the width is the scarce axis and nothing sits beside the board; the suits and the clump rings need the tiles more than the pinch gesture needs a margin. Landscape phones and the Deck keep their margins. | Viewport unit test; the fit contract's board case and the reachability gate at phone; the review capture at phone. |
| **135** | Phone chrome, done: the dock goes to two rows of four under 520px (eight 12px labels need about 420px in one row and a phone has 370, so Shuffle ran into Swap), and the floor-clear door drops its room-name line on a phone so the third door's risk line clears the dialog's sticky actions. The fit contract asks two more questions so both stay caught: text another element paints over (a cover taking more than half the line) and text leaves that share pixels on one line. | Fit contract at all six windows; review captures at phone. |
| **136** | A retry keeps the whole setup, done: `classicRunSetupFromRun` in `classic-run-setup.ts` reads a Classic run's setup back off its own flags — the clock from `gauntletSessionDurationMs`, the pace from `resolveDelayMultiplier`, the vows from the contract, wild and unrecorded from their flags — and `createRestartRun` restarts all of it before the one-flag branches that predate the sheet, which had kept a vow or the joker and dropped the clock and the pace. The contract object carries over as it was. Focus mutators are not recoverable from a run (the floor schedule writes the same field) and come back empty. | Round-trip unit test; restart test with clock, pace and both vows. |
| **137** | The drop, done: `resolveChunkBreak` takes, at Sharp or better, the matched suit's last pairs when the break leaves it with `DROP_MAX_PAIRS` (two) or fewer and every one of them plain — wherever they sit on the board. Anything with a job of its own (exit, key, lever, lock, a cursed pair) holds the suit up. Puzzle Bobble's second ingredient, section 1.1: a cluster falls once nothing holds it; here the last pairs of a suit become a target instead of a chore. Dropped pairs pay as cascaded pairs and carry a `chunkDroppedPairs` fact on the turn event, so the style line says "Drop"; the run counts drops (`chunkDropsThisRun`) for the achievement in Gen 141. | Rule tests (Sharp drops, Clean does not, a job holds, three remain and hold); sims re-run with `--check`. |
| **139** | Hit-stop on a Fever break, done: the break rule stamps `brokenAtTier` on every tile it takes, and the shatter wave (`tileBoardBreakWave.ts`) spreads a Fever break 1.7× slower with a longer cap, still under a second; the stage's Fever pulse is held for 1.1 s instead of 0.72 with a push-in the stage eases back from. Peggle slows time on the last peg; the biggest break of the floor is now the one the player gets to watch. Reduce motion turns the push-in off and the wave keeps its pace. | Wave tests for pace, cap and Sharp unchanged; the GameScreen pulse test holds Fever past the ordinary beat. |
| **140** | The chain-drop beat, done: the turn event now carries `chainTierBefore`, so a miss that ends a Sharp or Fever chain says which fire went out ("Sharp chain x5 broken - the fire is out") on the board line and in the live region; the Fever meter drains red for a beat (`data-meter-drop`) instead of snapping empty; the descending two-note phrase already played on a broken chain. Loss aversion is half of the loop, and a meter that vanished silently taught nothing. | Announcement and RunShell tests. |
| **141** | Records for the new mechanics, done: the Codex's chain entry says what the meter is, what the drop is and that Fever plays slower; the drop is a self-proving release-checklist row (`the-drop`: Sharp drops the cut-off pair, Clean does not, an exit holds the suit and stays hidden); a new achievement, Nothing held it, with a Steam API name, awarded on the run's first drop and proven earnable on a real board in the reachability test; the interaction graph's chain mechanic carries the drop's counters and the meter's and wave's evidence. | Achievement, reachability and checklist tests; appendix and model regenerated in the sweep. |
| **142** | Closing sweep, done. Sims re-run with the drop: every bare and relic-loadout band holds, numbers in `BALANCE_NOTES.md`. Regenerated diagrams, appendix, checklist page and model; verify (4044 tests), lint and the systems gate green; reachability gate 32 of 32; cascade, pass-and-play and mode-matrix specs green; fit contract green at all six windows for every one of its 23 cases, the last nine after the fixes below and each proven by its own rerun. What the sweep found: (1) every "main menu hang" this session — a test dying after seven minutes at the menu — was `dismissStartupIntro`'s fallback `locator.evaluate` waiting without a bound on an intro that had already closed; a trace showed it waiting 410 seconds, and it is bounded now. (2) The two new fit questions found the side room's skip and claim buttons stacked on top of each other on a phone held sideways (the footer now spans both columns) and the Profile's progress cards losing their third line under the cell's edge sideways (the kicker gives way there, and the stat tiles lay out as a one-line strip so the record grid gets their other half); they also needed three refinements to stop reporting a dialog's scrim, a card's full-face button and a clipped card's own box as defects, and the clipped rule now sees a leaf cut by any clipping ancestor - which is how the final run found two more: the Profile's stat tiles lay out as a strip sideways so the record grid gets the height back, and a browse card on Choose Your Path drops its description by its own height (a container query), because on the Deck's 1280x800 the grid hands it the 44px minimum row and the sentence was cut under the card's edge; the shortcuts overlay's Gambit tip and the in-run inventory's tenth charge row were under their overlay's edge the same way (tighter rows sideways, two charge columns on the Deck); the in-run settings' camera-shell hint pushed Auto / Always / Never under the pane sideways (the board pair's hints go there); the vendor's two-line offers put Spend under the card at desktop (the row is 172px, the offer copy a step smaller); and the floor-clear doors lost their risk line at 1024x768 once the resident's line joined the summary (the room name steps aside under 800px of height, as it does on a phone). One more was not a fit at all: a pickup toast ("Shard spark +1 combo shard") painted over the side room's Rest heal button on a phone, because the toast stack sits 6.5rem from the bottom and the sheets rise from there; moved to the top it painted over the run bar instead, so while a dialog is open the toast stack is not shown at all - no toast carries an action, and the pickup it names is on the run bar and in the inventory (the sideways capture showed the same toast on Save the time at 812x375, so it is every size, not the phone's). The rerun then reached the windows the first failures had hidden: the vendor sideways (name at 1rem, effect a step smaller in the 165px text column) and the in-run inventory on a phone (the 51px display title, which also ran \"Inventory\" off its plate, is the modal size there, and the section gaps give up the rest). And the relic draft on a phone, four cards one per row, cut its third service (Upgrade offer) at the plate's edge: the header's two bullets step aside there as they do at a short height. Seen and left: the phone board still sits below a large empty band in its stage; the review captures now include Profile and the side room sideways. | The next batch is in section 7. |

---

## 5. Risks, named

- **Trivialising the memory game.** Cascades remove pairs the player never recalled. Mitigation: chain-gated (needs recall to earn), no recall credit, tuned in Gen 121 with the simulation so that a pure-recall player still posts the best rating.
- **Visual noise on small viewports.** Four suit colours on every back plus traits plus dungeon markers. Mitigation: suit is the *base* of the back (colour field + one rune), traits and markers sit on top as now; check the fit contract at six viewports in Gen 119.
- **Colour-blind safety.** Rune per suit, not colour alone; verified with the trait palette's existing contrast audit.
- **Determinism / replay.** Clustered dealing and region breaks are seeded and pure; the endless simulation's core-replay check (Gen 17) catches any drift.
- **Score inflation breaking records.** Per-mode records (Gen 71) mean a new scoring regime is a new record season; the balance pass sets the bands.

## 6. Delivered against the brief

The brief asked for five things. Where each one landed, by generation and by file, so the answer is checkable rather than claimed.

| Ask | Where it landed |
|---|---|
| **Combo-break cards; huge same-type chunks break away together and disappear when matched.** | Suits on every tile (Gen 117, `tile-suit-rules.ts`); a chain that climbs Clean → Sharp → Fever on momentum (Gen 118, `chain-tier-rules.ts`); the chunk break that removes the connected same-suit region around a match, the whole region at Sharp and the halo at Fever (Gen 118–121, `chunk-break-rules.ts`); the shatter wave, tier names and Fever pulse (Gen 119, `tileBoardBreakWave.ts`, `chainBeat.ts`); the style line naming what each break did (Gen 124); Extreme Fever at the floor's end (Gen 125); the feel layer — layered shatter audio, the Fever music duck, controller rumble (Gen 128, `gameSfx.ts`, `feverDuck.ts`, `gamepadRumble.ts`). |
| **Recalculate every card's proximity tip whenever cards disappear or break away.** | The proximity recompute in the turn path after a chunk (Gen 118, `board-turn-transition.ts`); a removed tile is never a partner and distance is measured across the gap, proven where the player reads it — the tip, the DOM tree and the recorded play-through (Gen 123, `pair-proximity-rules.ts`, `tileBoardDomAccessibility.ts`, `e2e/cascade-chain.spec.ts`). |
| **Weave the dungeon into the Peggle / bubble craze so it makes sense.** | Exit, keys, levers, locks, shrines, gateways, shops and rooms never break; treasure spills with the chunk and pays as matched; a chunk finishes a warden and lands a thud; floor archetypes deal clumped, scattered or two-suit boards (Gen 120, 126, 128; `chunk-break-rules.ts`, `tile-suit-rules.ts`); three relics that touch the cascade, drafted in the run (Gen 130); chunk pairs and best chains credited per seat at a shared table and carried by the daily post and the quest ladder (Gen 131). |
| **Delve into the franchises and see what makes them tick.** | Section 1 above — Puzzle Bobble's leverage and drop, Peggle's multiplier ladder and last peg, Zuma's chains of chains, Bejeweled's gravity and Sugar Crush — and section 2's translation of each into a memory game, with 2.7 saying what was deliberately left out. The aim guide a bubble shooter draws became the clump read (Gen 127, `clump-read-rules.ts`), which follows the pointer and keyboard focus and names the pairs a Sharp break would take. |
| **A polished, satisfying Steam game: elaborate, add tasks.** | Balance against a simulation with stated bands rather than by feel (Gen 121, `cascade-balance-simulation.ts`, `yarn sim:cascade --check`); records, four achievements with Steam API names, per-mode chain records (Gen 129); Codex entries and self-proving release-checklist rows (Gen 122, 131); the fit contract, reachability gate and review captures at desktop, Deck and phone (Gen 122, 132); the build plan in section 4 with every generation's row, and the next batch in section 7. |

## 7. Next batch (as set after Gen 142)

Superseded by §9: the brief's second pass reordered everything. Kept for the record.

| Gen | Task | Why |
|---|---|---|
| — | The magpie play-through (task 114 / #156). | Carried into §9. |
| — | The phone board's stage band in portrait. | Carried into §9. |
| — | Zuma's chains of chains: a halo pair's suit gets the ring for one turn. | Folded into the ripple (§8.3): a halo pair is the edge of the celebration and does not seed, by measurement. |
| — | A per-floor "best break" replay card. | Carried into §9 as the best ripple. |

## 8. The second pass: the live pop

### 8.1 What the brief meant, read again

> *"It needs to connect in the entire game we have. It needs to be like Tetris: if things with similar groups are matched and touch they should break away together. Not just on the end, but while we're playing. When you match a pair it should pop in real time; if it's touching more blocks of the same pair, they should all pop as well."*

Four claims, and the first pass had honoured only two of them.

1. **Contact is the rule.** A group that touches the thing you matched goes with it. In Puzzle Bobble the bubble you fire attaches, and if three or more of its colour are now touching they burst — *touching*, not "within range", not "if you earned it". In Tetris Attack (Panel de Pon) three in a line clear on contact. The first pass had this rule but rationed it: a lone match broke nothing, a chain of three broke the neighbours, a chain of four the clump. That is Peggle's ladder applied to Puzzle Bobble's contact, and it put the game's best moment behind a gate a new player would not reach on floor one.
2. **Live, every time.** *Not just on the end, but while we're playing.* The pop belongs to the moment the second tile turns, not to a floor-end payout (Extreme Fever, Gen 125, is a payout at the end and is fine as one — but it was the loudest thing in the loop, and it was at the end).
3. **Same group, all of it.** *If it's touching more blocks of the same pair, they should all pop as well.* The whole touching clump, not a step into it.
4. **Woven, not bolted on.** *It needs to connect in the entire game.* The pop has to be what hits a warden, what a trap stops, what the treasure spills from, what the relics bend, what the magpie steals from, what the tips recount after, what the floor-clear line names, what the Codex teaches. Most of that weave existed (§2.6); it was reached less often than it should have been because the pop was.

### 8.2 What the franchises do on contact, and what we take

| Game | Contact rule | Chain reaction | Gravity | What we take |
|---|---|---|---|---|
| **Puzzle Bobble** | fired bubble + 2 touching of its colour burst | none directly; what they held **drops** | bubbles hang from the ceiling; unsupported ones fall | contact on every match (the pop); the drop (Gen 137) |
| **Tetris Attack / Panel de Pon** | 3 in a line clear; panels above fall | falls that land in a new line = a **chain**, ×1, ×2, ×3… named and counted | yes, the whole reaction is gravity | the wave count as the thing worth naming ("Ripple ×3"), scored on top |
| **Puyo Puyo** | 4 connected of a colour pop | pops let the rest fall into new groups; chains are the whole game | yes | one wave seeds the next; a longer reaction pays more, up to a cap |
| **Tetris** | a full line clears | none (tetrises are a size bonus) | pieces fall, rows don't | size pays more per pair (`6·n·(n−1)`) |
| **Peggle** | the ball hits pegs; hit pegs clear at ball-out | Fever on the last peg | ball physics | the tier ladder for *reach*, the halo, Fever's celebration |
| **Bejeweled / Candy Crush** | 3 in a line | falls make new lines; specials | yes | nothing new here; a memory board has no gravity (§8.6) |

The gap between us and every one of them is **gravity**. Every chain reaction in the genre is gravity: something clears, something else falls into the gap, the fall makes a new clear. A memory game cannot have gravity — a tile that moves is a memory the player loses, which is the one thing the game must never do to them. So the ripple has to travel some other way, and the only other way on this board is **the partner**: a pair is two tiles, and when one goes, the other goes, wherever it is. The partner is our falling block. That is the whole idea of §8.3.

### 8.3 The refined system

**Every match pops.** When the second tile turns and the two match, the game walks the connected same-suit region (4-neighbour, hidden tiles only, never through an unsprung trap) out from both tiles. Every plain pair with **both halves in that region** breaks away with the match. Pairs still leave together, always; a pair with a half outside the clump stays whole on a pop, because reaching that half is what the chain is for. No chain is needed. This is the contact rule and it runs on floor one, turn one.

**The chain buys the ripple.** Every pair a wave takes leaves both halves. Where the chain allows it, the half *outside* the region — the partner pulled from across the board — seeds the next wave: its own clump is walked and popped the same way, and so on.

| Tier | Waves | Read as |
|---|---|---|
| none (0–2) | 1 | the pop: what touches you |
| Clean (3+) | 2 | the pop, and each partner it pulled takes its clump |
| Sharp | unbounded (12) | the reaction runs until a wave takes nothing — Puyo's chain |
| Fever | unbounded + halo | Sharp, and the first clump's halo (every hidden tile touching it, any suit) |

Tuning Fork lends a lone match the chain's reach (partners leave and seed one wave) and adds a wave to Clean. A halo pair is the edge of the celebration, not a bridge: it does not seed. The matched pair itself is never re-taken by a later wave. The drop (Gen 137) still fires at Sharp and Fever after the last wave and is not a wave.

**Islands.** The deal (`tile-suit-rules.ts`) now lays every suit with three pairs or more as **two clumps seeded apart**, so about thirty percent of a floor's pairs straddle two islands of their suit (measured on 6×4, 8×4 and 8×6: 1.7–1.9 islands per suit, 0.29–0.32 straddling). A lone match pops the island it is in; the straddling pairs sit there whole; a Clean chain is what takes them and, with them, the other island. The reason is the measurement in §8.5: with one clump per suit the ripple had nothing to bridge, and the ladder it was meant to reward fired on four percent of floors.

**What it pays.** Unchanged in kind, extended in size: cascade pay is 60% of a base match per pair plus `6·n·(n−1)` for size, ×1.5 at Fever, and now ×(1 + 0.2·(waves−1)) for the ripple, capped at ×2. Shards one per two pairs, one per pair at Fever. No streak credit, no recall credit, no rating credit — a chunk never moved a rating on any of the 432 floors of the first sim and does not now.

**Momentum.** Every pair a break takes feeds the ladder, the pop's included. §8.5 records why: a ladder fed by the ripple alone reached Fever on four percent of clean floors.

**What the player sees and hears.** The stage pulses on a pop (softer than Clean); the shatter wave spreads from the match within a wave, and each later wave leaves a beat after the one before it (`RIPPLE_WAVE_GAP_SECONDS`), so a three-wave reaction reads as three answers across the board. The run line says "Pop: 2 pairs went with that match" or "Clean break: …", and the style line names the shape: **Ripple ×3** first, then Drop, Partner across the board, Halo, Treasure spill, Clean sweep. The chain stat's hover and the Codex entry say the rule in one breath: every match pops the clump it touches; Clean lets the partners ripple; Sharp runs the reaction out; Fever adds the halo.

**What stays memory.** The symbol on the face is still the only thing that makes a match; the suit on the back is the map. A pair with a half outside the clump — the partner you will have to remember — is exactly the pair the pop leaves you. The pop takes what you could see; the chain takes what you remembered.

### 8.4 The weave, restated for the live pop

| Dungeon thing | Then | Now |
|---|---|---|
| Wardens and revealed hazards | a chunk that reached them hit for its size | every wave that reaches them hits; a pop on turn one can land the first blow |
| Traps (unsprung) | stop the region | stop every wave's region |
| Treasure | spills with a chunk at Clean+ | spills with a pop, both halves touching; a straddling treasure waits for the chain |
| Keys, levers, locks, shrines, gateways, shops, rooms, the exit | never break | never break; they hold a suit up against the drop, and a pair with such a partner stays |
| The cursed pair | never breaks | never breaks, never seeds |
| The magpie | steals from a chunk's spill and resets the tile's tier stamp | the same, and resets its wave stamp |
| Sticky toffee | the region is diagonal | every wave is diagonal |
| Relics | Tuning Fork +1 step, Magpie's Ledger ×2 spilled gold, Suit Lens three suits | Tuning Fork lends a lone match the chain's reach and +1 wave; the others unchanged |
| Proximity tips | recounted after a break | recounted after every wave's removals, because the tip reads the board, not the rule |
| Floor archetypes | clumped / scattered / two-suit deals | the same, and a clumped or two-suit deal now lays islands |

### 8.5 Measured, not guessed

`yarn sim:cascade` on 6 seeds × 24 floors × 3 miss rates, the same harness as Gen 121, with `ripple` (mean of the floor's longest ripple, in waves) and `rippled` (share of floors with a second wave) added to the report.

| Variant | miss 0: turns | pairs/floor | Fever | rippled | miss 0.25: Fever | rippled |
|---|---|---|---|---|---|---|
| Gen 137 (chain-gated break) | 9.2 | 4.13 | 0.59 | — | 0.15 | — |
| pop + ripple, momentum from every pair | 8.1 | 5.26 | 0.51 | — | 0.19 | — |
| momentum from the ripple only | 8.3 | 5.14 | **0.04** | — | 0.00 | — |
| + contact rule (both halves touch) | 8.3 | 5.16 | 0.53 | ~0.05 | 0.19 | ~0.05 |
| **+ islands (shipped)** | **8.3** | **5.15** | **0.50** | **0.14** | **0.19** | **0.10** |

What the rows say. The pop shortens a clean floor by a turn and takes one more pair per floor than the gated break did, and every band still holds (`CASCADE_BALANCE_BANDS`): a clean player clears every floor, no floor sticks, chunk score is 16% of level score, Fever is on half the clean player's big floors and a fifth of the sloppy player's, Extreme Fever 0.75 against 0.21, rating drift zero. The one band that moved is the test harness's smaller sample (3 seeds × floors 1–18): clean Fever on big floors sat at 0.47 against a 0.5 floor with one clump per suit and at 0.5 with islands. The ripple-only momentum row is the one that decides the design: partners rarely sat outside their clump, so the ladder starved. Islands are what make the ripple a thing that happens (14% of clean floors, 10% of sloppy ones — the clean player's is higher, which is the whole point of the chain).

Where it is still thin: rippled floors are a minority. Early floors are one to three plain tiles and a wall of dungeon cards; the ripple needs a Clean chain *and* a straddling pair *and* the far island still standing. §9 has the two levers left: a third island on big boards, and letting a treasure pair straddle.

### 8.6 What is still deliberately not in

- **Gravity.** No tile ever moves because of a break. The partner is the falling block.
- **Pops without a match.** A flip that mismatches pops nothing; the contact rule needs a match to touch.
- **Popping the matched suit's whole floor.** The pop is the clump you touch; the rest of the suit is the chain's, or the drop's when two pairs are all that is left.
- **Ripple through the halo.** Measured as a bridge it would take every neighbouring clump at Fever; it stays the edge.

## 9. Next batch

| Gen | Task | Why |
|---|---|---|
| **148** | A third island on boards of 32 tiles or more, and a treasure pair allowed to straddle. | §8.5's two levers for the ripple's frequency, both measurable with the sim before they ship. |
| ~~149~~ | ~~Records for the ripple~~ — **done in Gen 147**: `bestRipple` on the run summary and the persisted one, the run and daily share lines past one wave, and **Chain reaction** at three waves with a reachability proof. | |
| ~~150~~ | ~~The e2e proof of the pop~~ — **done in Gen 147**: `cascade-chain.spec.ts` asserts the first match of a floor pops the clump it touches at chain one, and the review capture takes the board before, during and after that match. | |
| **151** | The magpie play-through (task 114 / #156), now with a pop to steal from on turn one. | Carried. |
| **152** | The phone board's stage band in portrait. | Carried. |
| **153** | A per-wave sound: the answering pops across the board pitch a step above the pop. | The audio phrase is one rising line per pair; the ripple has no voice of its own yet. |
| **154** | First-run: the tutorial floor's first match is laid to pop. | The pop is the game's best moment; the new player should meet it on their first match. |
| **155** | Closing sweep over 143–154. | Sims, docs, gates, captures, push. |
