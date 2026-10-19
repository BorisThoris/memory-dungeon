# Memory Dungeon: the deep game plan

The scale-up plan for a game that currently stops changing. Written 2026-10-19 from two sources: the repository's own measurements, and a deep-research pass (107 agents, 11 findings that survived three-vote adversarial verification, 3 refuted). Everything marked **verified** cites a source that survived. Everything marked **design** is a proposal built on those findings and on the owner's standing rules (runs are punishing, the store is a stop, mutators iterate during play, no dark patterns).

---

## 0. The plateau, measured

Four facts from the repo, not opinions:

1. **The endless cycle is twelve floors that repeat.** `ENDLESS_CYCLE_FLOOR_COUNT = 12`, with one rotating boss slot at position nine. Floor 40 is floor 4's archetype with more pairs. There is no second act.
2. **The board stops growing at floor 52.** 24 pairs, 48 tiles, 7 columns, study window frozen at 5280 ms (`PAIRS_MAX`, BALANCE_NOTES Gen 211). Past that, nothing scales at all.
3. **The pop is a hill, not a line.** The cascade's share of a board is 0.50 at four pairs, 0.75 at fourteen, 0.48 at twenty-two (Gen 211). The one moment the game is built on gets weaker exactly where the late game lives.
4. **At a competent miss rate a run never ends on its own.** 15% misses: forty floors on every seed (Gen 207). The run ends when the player stops. Nothing is pushing back and nothing is pulling forward.

Diagnosis in one line: the game scales quantity once, the spectacle decays with size, there is no end to push toward, and no new verb arrives after floor 12. More items cannot fix that, because items change power and the problem is that nothing changes *kind*.

---

## 1. What the research says to do

| Finding | Confidence | What it means for us |
|---|---|---|
| **Goal gradient.** Effort accelerates as the *proportion* of distance remaining shrinks; pre-filled "endowed" progress speeds completion ~20% at identical real effort (Kivetz, Urminsky and Zheng 2006, field data). | High | Show progress as a fraction toward a *named* milestone. Open every new track with progress already banked. |
| **Post-reward reset.** Effort drops and quitting peaks immediately after a reward is earned; 17% of all defections in the field study happened right after a reward. | High | The floor-clear beat and the camp are the most dangerous moments in the game. The next named threshold must already be on screen there, and Descend must be the path of least resistance. |
| **Progress must be new, not near.** In a preregistered Wordle study, a *repeated* near-miss that revealed nothing new was less motivating and far more frustrating than a first near-miss (Dixon et al. 2024). | Medium | A late floor that repeats the same board at larger size is a thwarted-near-miss generator. Each depth band must reveal something new: a card type, a rule, a board shape. |
| **Curiosity peaks at intermediate uncertainty.** People attend most to what they half-know; both the fully predictable and the fully random lose them (Kidd and Hayden 2015; Kang 2009; replicated 2020, 2024). | High | A memory game is pure confidence-about-hidden-state. Escalate into *half-remembered*, never into chaos. Migrating cards with a visible trail beat a reshuffle. |
| **One coefficient, named tiers, priced composition.** Risk of Rain 2 drives everything from one compounding number, shows it as nine named tiers on a bar, and spends it on a priced spawn table where elites cost 6x, so late game is *composed* differently, not just bigger. | Medium | A "Dread" coefficient the HUD names and foreshadows, spent on a priced table of card families and mutator stacks. |
| **A designed end, a build ceiling, evolutions, endless as an unlock.** Vampire Survivors stops the run at 30 minutes with the Reaper, caps builds at 6+6 so power must come from planned evolutions, and makes Endless and Limit Break explicit opt-ins. | Medium | A Warden floor at fixed depth that ends the run unless a planned build exists; a relic slot cap with relic evolutions sold at the camp; Endless unlocked by beating the Warden. |
| **One new verb, scripted troughs.** Tetris Effect's Zone (defer line clears, release as one) was chosen for adding something significant without altering pure Tetris; its escalation runs in deliberate excitation-relaxation cycles. | Medium | One new verb per act, layered on flip-two-cards without changing it. Breather floors are not optional; they are the trough. |
| **The hardest content is a post-win ladder; unlocks are guided tours.** Slay the Spire's Ascension opens after a clear; Balatro's stakes, unlocks and challenges exist "to push players out of their comfort zone and explore the design" (LocalThunk 2025). Dead Cells throttles boss drops by difficulty tier. | High / Medium | The Depths ladder opens after the Warden. Unlocks are feats in under-used mechanics. Boss rewards are tier-gated so skipping ahead pays nothing. |
| **Required power meta is a failure mode.** Grinding runs to feed a meta layer replaces playing for real (Bycer 2015, opinion, contested). | Low | Meta unlocks stay sideways: new card families, mutators, realms, relic variants. Never a stat the deep game needs. |
| From the previous pass: **competence and autonomy** predict the wish to replay; near misses are not a foundation; the slot-machine schedule story was refuted. | High | Every mechanic below is a skill the player can get visibly better at, or a choice they make. |

Refuted and not used: Dead Cells' blueprint rarity tiers, Slay the Spire's unlock score thresholds, the "layered near-miss" reading of Vampire Survivors. Not covered by surviving evidence: Balatro's ante maths, Hades Heat, Luck be a Landlord, Noita, Isaac, any GDC postmortem on late-game plateaus. Those are left out rather than guessed.

---

## 2. The spine: the Descent in four acts (design)

Replace the repeating twelve-floor cycle with a sixty-floor Descent in four acts, a Warden at the bottom, and Endless beyond it as an unlocked mode. Each act adds exactly five things, so an act is a production unit the way a realm is:

1. **One new verb** the player gets (a thing they can do, not a thing done to them).
2. **One new card family** that changes the memory task itself.
3. **One board transformation** that changes the shape of the problem.
4. **One boss with rules of its own**, rewarded on a tier gate.
5. **One Dread tier** named on the HUD before it arrives.

The existing realms, weather, mutators and camp keep running underneath. Act I is the current game.

### Act I · The Gate (floors 1 to 12)

The shipped cycle, unchanged. Verb: flip two. The player learns the board, the pop, the doors, the camp, the realms. Boss: the existing Keystone Warden floors. Dread tier: *Quiet*, then *Stirring* at floor 8.

### Act II · The Living Dungeon (floors 13 to 24)

The board starts to move on its own, and the player gets the tool to turn that into spectacle.

- **Verb: Hold.** A meter fills with chain links. While Hold is active, matches do not detonate; they stack, face-up and glowing. Release fires every held match as one cascade, with the combo multiplier applied once to the whole stack. This is the Zone pattern, and it directly repairs the pop hill: a late board's smaller natural cascade is replaced by a deliberate, planned mega-cascade the player built. Holding is a risk: a miss while holding drops the stack to half.
- **Card family: Wanderers.** Two or three pairs per floor whose cards move one cell every third resolved turn, leaving a faint footprint on the cell they left for one turn. The player half-knows where they are. This is the Goldilocks band made literal: never a reshuffle, always a trail.
- **Board transformation: the Fold.** The board is dealt as two rooms joined by a doorway of two cells. A cascade crosses the doorway only through a match made beside it. Where you match becomes a route decision, not just a memory one.
- **Boss: the Keeper of Halls (floor 24).** Every fourth turn the two rooms swap sides. Beating it on the raging door drops the Act II relic evolution blueprint; on calm, nothing extra (Dead Cells gate).
- **Dread tiers:** *Restless* (13), *Hungry* (19).

### Act III · The Deep (floors 25 to 40)

The board stops being flat.

- **Verb: Carve.** Before a flip, the player may spend chain links to choose the direction a cascade will prefer (up, down, left, right). The pop walks that way first. Aiming the detonation turns the cascade from a thing that happens to a shot the player lines up. This is the Peggle shot finally made aimable.
- **Card family: Masks.** A few cards whose backs show a false suit. The first time one is flipped its mask drops for the rest of the floor. Memory of *which backs lie* becomes a second layer of the task.
- **Board transformation: Layers.** Floors are dealt two decks deep. Clearing a pair reveals the cards beneath it, which belong to a richer, narrower palette (the deep layer runs two suits, so its chains are the longest in the run). The board effectively grows *during* play, so floor 40 is never fully known at the study window. This also lifts the floor-52 ceiling without adding columns: depth, not width.
- **Boss: the Cartographer (floor 40).** The board is dealt face-up for the study window, then the whole lower layer rotates a quarter turn every third match. The looking glass, generalised and placed where it belongs.
- **Dread tiers:** *Awake* (25), *Watching* (33).

### Act IV · The Abyss (floors 41 to 60)

The dungeon remembers you, and says so.

- **Verb: Echo.** Once per floor, replay your last three flips automatically, in order, as free turns. A pure competence reward: it is only worth anything if your last three flips were good. The player who plays well gets to play more.
- **Card family: Sleepers.** Matched pairs that return to the board, face-down, four turns after they leave, in new cells, unless the match that cleared them was part of a chain of three or more. Clearing fast is now the only way to clear at all.
- **Board transformation: the Spiral.** Each clear removes the outer ring of the board and deals a new inner ring. The floor is never finished; it is survived. Par becomes a time-boxed score target rather than a clear.
- **The dungeon learns you (told, never hidden).** From floor 41 the HUD states one rule chosen from your own stats, for example "the suit you match most hides from you this floor" or "your first flip of each turn is always a Wanderer". Adaptive, announced, never silent. The owner's rule against hidden difficulty adjustment holds; this is the opposite.
- **Boss: the Warden (floor 60).** The run's designed end. The board rebuilds itself every five turns unless a Hold is active. The Warden cannot be out-waited: it takes one miss from the bank every turn after par. It is beatable only with a Held mega-cascade of a stated size, which requires an evolved relic from Act II or III. Beating it unlocks Endless and opens the Depths ladder. Dying to it at floor 58 is a first near-miss, not a repeated one, because every act above changed what the player was doing.
- **Dread tiers:** *It knows you* (41), *It is coming* (51).

### Endless (unlocked by beating the Warden)

The four acts repeat with each act's length halved, every verb and card family in play at once, the Dread coefficient compounding, and the board allowed to grow past 24 pairs toward the 768-to-4096-pair sizes the simulator already handles. The score to continue is a per-floor rent that rises per cycle, so an endless run has a reason to end and a number to beat. Endless is where the "everscaling" promise lives, and it is earned.

---

## 3. Dread: one number the whole dungeon spends (design)

- **Dread** is one coefficient: it rises linearly with floor, is multiplied per raging door taken, and never resets inside a run.
- It is shown as a bar with named tiers (Quiet, Stirring, Restless, Hungry, Awake, Watching, It knows you, It is coming). The next tier's name is visible before it arrives. That is the goal gradient and the foreshadowing in one widget.
- It is spent on a **priced table**: ordinary pairs cost 1, Wanderers 4, Masks 6, Sleepers 9, a stacked mutator 12, a boss rule 20. The floor builder buys from the table with its Dread budget and skips anything too cheap once the budget is large. Floor 40 is composed differently from floor 4 by construction, not by a larger copy of the same deal.
- Doors keep paying gold the way they do now, and also pay Dread. The player who takes raging doors reaches *It is coming* by floor 45, the calm player by 55. Difficulty stays a dial the player turns.

---

## 4. The build ceiling and relic evolutions (design)

More items added power without adding interest because the camp has no ceiling and no combinations. Change both:

- **Four relic slots.** A fifth purchase replaces one. The choice is the interest.
- **Evolutions.** A relic at rank 3 held beside a specific second relic at rank 3 is offered an evolution at the next camp, once, for gold. Six to start:

| Evolution | Made from | What it does |
|---|---|---|
| Lantern of Recall | Long Look 3 + Tallow Candle 3 | Every match lights its neighbours for the rest of the floor, not until the next flip |
| Miser's Vault | Deep Pockets 3 + Gilded Chain 3 | Once per floor a miss on an empty bank costs gold instead of the run |
| Cartographer's Thread | Long Look 3 + Gilded Chain 3 | Wanderers leave a trail for three turns instead of one |
| Keystone Heart | Deep Pockets 3 + Tallow Candle 3 | A Held release of ten or more refills one miss |
| Unmasking Glass | Tallow Candle 3 + Gilded Chain 3 | Masks drop at the study window |
| Echo Chamber | Long Look 3 + Deep Pockets 3 | Echo replays five flips, not three |

- Evolution blueprints are the boss drops, tier-gated by door (raging drops, calm does not). The Warden needs one. That is the planned build Vampire Survivors forces with the Reaper, in our terms.

---

## 5. Milestones, the clear beat, and the post-reward reset (design)

- **Named milestones** at 12, 24, 40 and 60, each the act boss. Progress to the next is shown as a fraction on the run bar from floor one.
- **Pre-filled progress on every new track.** When the Depths ladder opens, Depth 1 shows "2 of 10 floors banked" from the run that unlocked it. When a realm's raging door track opens, the first clear is already counted.
- **The clear beat shows the next threshold**, not just the reward. The camp's Descend button carries the next milestone's name and the floors to it. Quitting at the camp is the post-reward reset; the screen is built to carry the player past it.
- **The results screen names the act reached and the Dread tier**, so a death at floor 38 reads "two floors from the Cartographer, at Watching", which is a first near-miss with information in it.

---

## 6. Unlocks as a guided tour (design)

Thirty feat unlocks, all sideways, none a stat. Each is a feat in an under-used mechanic that unlocks content for that mechanic, so the tree teaches the late game:

- "Release a Hold of twelve in the Storm realm" unlocks the Storm-only Wanderer variant.
- "Clear a Layers floor without flipping a Mask" unlocks the Unmasking Glass blueprint for the calm door.
- "Beat the Keeper of Halls on raging twice" unlocks its second rule set.
- "Reach Watching before floor 30" unlocks the Spiral in Endless from cycle one.

Each is a Steam achievement, each has a Codex entry, each is checked by a hall room.

---

## 7. The Depths ladder, after the Warden

Unchanged from the pitch deck, now gated correctly: it opens when the Warden falls. Twenty rungs, one rule each, more every season. The one-in-twelve target from the market survey applies to Depth 20.

---

## 8. What we measure before any of it ships

Every mechanic above goes through the repo's own gate (hall room, soak invariant, census, graph, playtest screenshots). The run-level bars, so the plan can fail honestly:

| Bar | Instrument | Target |
|---|---|---|
| A run ends on its own | `yarn sim:run` at 15% misses | The Warden ends at least half of average-player runs; a clean run can beat it |
| The pop stops decaying | `sim:cascade` by act with Hold | Pop share ≥ 0.6 on every act's boards, by Held release if not by deal |
| Something new every twelve floors | a schedule test | Every act introduces a verb, a family, a transformation and a boss not present in the act before |
| Uncertainty stays intermediate | soak inspector | No floor past 24 is fully known at the study window; no floor is a reshuffle |
| The clear beat carries | playtest | Next milestone and fraction visible on every clear and camp screen |
| Reach curve | Steam achievements after launch | Floor 24 reached by ~40% of owners, floor 40 by ~15%, the Warden beaten by ~8%, Depth 20 by ~1 in 12 |

---

## 9. Build order

1. **The spine first, no new mechanics.** Four acts over the existing content, Dread bar with named tiers, milestone fractions on the run bar and the clear beat, the Warden at 60 as a rule-only boss, Endless gated behind it. This alone answers "nothing changes" and "nothing ends", and it is mostly schedule and HUD.
2. **Hold, Wanderers, the Fold, the Keeper.** Act II complete. Hold is the highest-leverage single mechanic in the plan because it fixes the pop hill and gives the chain clip its best footage.
3. **Relic cap and the six evolutions.** Makes the camp a build again and gives the Warden its condition.
4. **Act III, then Act IV.** Carve, Masks, Layers, the Cartographer; Echo, Sleepers, the Spiral, the dungeon that tells you what it learned.
5. **The unlock tree and the Depths**, which only make sense once there is a deep game to tour.

Each step ships through `main` with the full checklist, and each gets a look in the browser before the next starts.

---

## 10. Open questions the research could not settle

- Which board transformation keeps uncertainty in the intermediate band at 768 to 4096 pairs: Layers, Wanderers, or the Spiral? Probe each with a scratch `tsx` script against the soak's "a way left to finish" inspector before committing.
- Does the goal-gradient proportional model survive in an open-ended Endless, where there is no fixed count? The rent-per-cycle design assumes it does. Measure run length by cycle in the soak.
- What unlock cadence (per hour, per run) do Balatro and Vampire Survivors actually deliver? No public figure survived. Start at one unlock per two runs and tune on the demo.
- Is the Warden's planned-build requirement too hard a wall for the calm-door player? The sim will say; if so, the calm path gets a weaker Warden and a smaller Endless unlock.

---

## Sources that survived verification

- Kivetz, Urminsky and Zheng, "The Goal-Gradient Hypothesis Resurrected", Journal of Marketing Research 2006
- Dixon et al., Scientific Reports 14:24336, October 2024 (Wordle, preregistered)
- Kidd and Hayden, "The Psychology and Neuroscience of Curiosity", Neuron 2015; Kang et al. 2009; Dubey and Griffiths 2020; Spitzer et al. 2024
- Risk of Rain 2 community wiki, Difficulty and Directors pages (decompiled constants, cross-checked)
- Vampire Survivors, Wikipedia and fandom wiki, fetched 2026-10-19
- Unreal Engine developer interview on Tetris Effect, October 2019
- slaythespire.info on Ascension; LocalThunk, "Solitaire", localthunk.com, 26 February 2025
- Dead Cells wiki, Blueprint page (2-1 vote)
- Bycer, "The Pitfalls of Meta-Game Design", Game Developer 2015 (opinion)
- Memory Dungeon repository: `floor-mutator-schedule.ts`, `docs/BALANCE_NOTES.md` Gen 207 and Gen 211
