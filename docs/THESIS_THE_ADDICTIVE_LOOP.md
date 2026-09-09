# The Addictive Loop

### A thesis on building the most compelling small game we can, by fusing the memory board with the cascade genre

---

**Status:** Living document. Written at Gen 171, immediately before the dungeon layer was removed.
**Companion documents:** `docs/CHAIN_CHUNK_FEVER_DESIGN.md` (the mechanic spec as shipped),
`docs/BALANCE_NOTES.md` (every measurement, in order), `docs/MARKET_SURVEY.md` (the nine products
surveyed), `docs/RESEARCH_NOTES.md` and `docs/RESEARCH_NOTES_2.md` (the raw research passes),
`docs/REMOVED_DUNGEON_LAYER.md` (what came out and why).

---

## Abstract

This document argues that the game we have been building has been two games stapled together, that
one of them is excellent and the other is a tax on it, and that the excellent one is not finished
because it has never been allowed to be the whole game.

The excellent one is this: **you flip two tiles from memory, and when they match, the board
detonates.** Same-suit tiles touching your match go with it. Their partners, wherever they are on
the board, go too. Those partners' neighbours go next. A chain of correct recalls makes each
detonation reach further, until a long enough chain turns one remembered pair into most of a
board leaving at once. That is a memory game with the payload of Peggle's fever shot, the chain
grammar of Puyo Puyo, and the contact rule of Puzzle Bobble — and as far as we can find, nobody
has built it.

The tax is everything else: a key you must find before a lock, a lever before an exit, a shop to
open, a trap that punishes a flip, a decoy that lies about a tile, a boss with hit points, a route
with three doors. Each was reasonable in isolation. Together they are eleven kinds of **stop**
inserted into a loop whose entire value is **momentum**.

The argument proceeds in ten parts. Part I states the question and shows, from our own
instrumentation, that the current game fails it. Part II is a mechanical dissection of thirteen
products that solved adjacent problems, at a level of detail sufficient to steal from precisely.
Part III is the psychology, including an explicit statement of the manipulative techniques we
refuse to use and why refusing them is not merely ethical but *commercially correct for this
product*. Part IV synthesises: the one-page thesis, the loop beat by beat, and the argument for
why memory is not a handicap for a cascade game but the best possible input to one. Part V is the
full specification — every rule, every constant, every band. Part VI is feel, in milliseconds.
Part VII is the first ten minutes. Part VIII is retention without dark patterns. Part IX is
measurement: what we hold ourselves to and what we would do if a band broke. Part X is the plan,
in tasks, in order.

The conclusion is a single sentence: **the game is one board, one loop, one number that goes up,
and nothing else — and the work is to make that one loop the best-feeling thing on the platform.**

---

## How to read this document

It is long on purpose. It is meant to be the place where an argument is settled once, in full,
with the measurement attached, so that it does not have to be re-litigated every time somebody has
an idea for a new card type. If you are looking for something specific:

- **You want the design, not the argument.** Read §26 (one page), then Part V (the spec).
- **You want to know why the dungeon went.** Read §3, then §31, then `REMOVED_DUNGEON_LAYER.md`.
- **You want to add a mechanic.** Read §25 (the ethical line), §57 (the bands), and §63 (what we
  are deliberately not doing). Then write down which band your mechanic moves, and by how much,
  before you write any code.
- **You are implementing.** Part V is normative. Everything else is rationale.
- **You disagree.** Good — §62 lists the risks I think are real, and Appendix E lists the questions
  I could not settle. Start there rather than at the top.

Every number in this document that is attributed to a measurement was produced by one of
`yarn sim:pop`, `yarn sim:cascade`, `yarn sim:occupancy`, or `yarn gate:systems` in this
repository, and can be reproduced. Numbers attributed to external products are from the market
survey and are cited to it; where a source is a developer talk or postmortem rather than
instrumentation, that is stated, because the difference matters.

---

## Contents


**Part I — The Question**

- §1. What we are actually trying to build
- §2. The current game, measured
- §3. Why "just remove it" is the right call and not laziness

**Part II — The Field**

- §4. Peggle — the anatomy of a shot
- §5. Puzzle Bobble / Bust-a-Move — contact, cluster, orphan
- §6. Tetris — the gravity contract
- §7. Tetris Attack / Panel de Pon — the skill chain
- §8. Puyo Puyo — chain notation and the shared mental model
- §9. Bejeweled and Candy Crush — the cascade as slot machine
- §10. Zuma and Luxor — the pressure line, done well
- §11. Cookie Clicker and the incremental family — the number that always moves
- §12. Vampire Survivors — the power fantasy curve
- §13. Balatro — the multiplicative build
- §14. Slay the Spire — the run as the unit of play
- §15. Threes and 2048 — the merge and the tidy board
- §16. Slot machines — what we take and what we refuse
- §17. Cross-cutting: what each reference does at every timescale

**Part III — The Psychology**

- §18. Reward prediction error, and why a cascade feels so good
- §19. Variable ratio schedules, and the honest version
- §20. Flow, and the channel
- §21. Near-miss, and where the line is
- §22. Zeigarnik, endowment, and the sunk-cost machinery
- §23. What memory actually affords, and what it costs
- §24. Session shape, and what the research actually supports
- §25. The line: what we will not build

**Part IV — The Synthesis**

- §26. The thesis in one page
- §27. The loop, beat by beat
- §28. Why memory is the right input for a cascade
- §29. The board as a legible field
- §30. The chain as the only progression axis, and the hold decision
- §31. What replaces the dungeon

**Part V — The Specification**

- §32. Board generation
- §33. Suits and clumps
- §34. The flip and the match
- §35. The pop
- §36. The ripple
- §37. The drop — restructured
- §38. The chain ladder
- §39. Fever
- §40. Scoring
- §41. The floor: end, clear, and the next one
- §42. The run
- §43. Difficulty and the pressure curve
- §44. Powers, and the one-button economy

**Part VI — Feel**

- §45. The timing table
- §46. Audio
- §47. Camera, shake, and hit-stop
- §48. Colour, contrast, and accessibility
- §49. Readability and the screenshot test

**Part VII — The First Ten Minutes**

- §50. Onboarding without a tutorial
- §51. The first board
- §52. The first Fever

**Part VIII — Retention Without Dark Patterns**

- §53. Session shape
- §54. Between sessions
- §55. Records, not currencies
- §56. The thing nobody in the market measures

**Part IX — Measurement**

- §57. The bands
- §58. The simulations
- §59. Modelling the player better
- §60. What we would do if a band broke

**Part X — The Plan**

- §61. The task breakdown
- §62. Risks
- §63. What we are deliberately not doing

**Part XI — Worked Play Traces**

- §64. Trace 1 — the first ninety seconds
- §65. Trace 2 — the hold decision, floor 9
- §66. Trace 3 — a Fever break, in full
- §67. Trace 4 — a bad floor, and why it is not a punishment
- §68. What the traces reveal

**Part XII — Failure Modes**

- §69. The catalogue

**Part XIII — The Interface, Surface by Surface**

- §70. The board (the only surface that matters)
- §71. Pause
- §72. Run end
- §73. First launch

**Part XIV — The Score (audio, at note level)**

- §74. The pitch system
- §75. The event score

**Appendix A — Glossary**


**Appendix B — The Constant Register**


**Appendix C — The Removed Inventory, With Verdicts**


**Appendix D — Sources, and How to Read Them**


**Appendix E — Open Questions**


**Appendix F — Objections and Answers**


**Appendix G — The Task Register**


**Appendix H — Removal Manifest**


**Appendix I — The Measurement History**


**Part XV — The Six Inputs to a Flip**

- §76. Input one — what do I remember?
- §77. Input two — what suit is it?
- §78. Input three — where is the clump?
- §79. Input four — what tier am I at?
- §80. Input five — how much of this suit is left?
- §81. Input six — how close am I to Fever?

**Part XVI — The Mathematics of the Cascade**

- §82. The basic quantity
- §83. The score curve, derived
- §84. The expected floor

**Part XVII — Positioning**

- §85. What this product is
- §86. Who it is for
- §87. What it is not for
- §88. The positioning problem, named
- §89. Pricing and scope, as a constraint on the plan

**Part XVIII — Content Without Content**

- §90. The five sources of longevity that are not content
- §91. What we would add first, if we added anything
- §92. The rule for all future additions

**Part XIX — The Long Game**

- §93. Year one — the loop is the product
- §94. Year two — the community, if there is one
- §95. What would make us add a mode back
- §96. The failure case, and what we would do
- §97. The thing worth keeping regardless

**Appendix J — Comparative Reference Data**


**Appendix K — The Copy Deck**


**Appendix L — Implementation Notes**


**Appendix M — Decision Log**


**Appendix N — Proposed Mechanics, Pre-Judged**


**Appendix O — The Band Register**


**Part XX — A Close Reading of the Loop's Emotional Beats**

- §98. The eight feelings
- §99. The map of feelings to floor position
- §100. The feeling we do not have and should

**Part XXI — What We Learned Building the Wrong Game**

- §101. Nine lessons

**Part XXII — Comparative Session Arcs**

- §102. The first ten minutes, four ways

**Appendix P — The Surviving Codebase**


**Appendix Q — The Rules, As Told**


**Appendix R — Expected Values**


**Part XXIII — "Why Not Just…?"**

- §103. Why not just make a good memory game?
- §104. Why not just make a good cascade game?
- §105. Why not a hybrid where the player chooses to peek?
- §106. Why not keep the dungeon and cut the cascade?
- §107. Why not a puzzle game with authored boards?
- §108. Why not make it multiplayer?
- §109. Why not make it an idle game?
- §110. Why not a time attack?
- §111. Why not let the chain persist across floors?
- §112. Why not add a second board mechanic — gravity?

**Appendix S — Pre-Mortem**


**Appendix T — Playtest Protocol**


**Appendix U — Metrics**


**Appendix V — The Visual Specification**


**Appendix W — Adding a Mechanic, Correctly**


**Part XXIV — Phase Briefs**

- §113. Phase 1 brief — The Removal
- §114. Phase 2 brief — The Loop Made Whole
- §115. Phase 3 brief — The Strategic Layer
- §116. Phase 4 brief — Feel
- §117. Phase 5 brief — The Run and the Record
- §118. Phase 6 brief — The Candidates
- §119. Phase 7 brief — The Sweep

**Appendix X — The Deletion Register**


**Appendix Y — Team FAQ**


**Appendix Z — What Counts as a Stop**


**Appendix AA — Before and After**


**Part XXV — Closing**

- §120. The argument, restated in short
- §121. The three things to hold on to
- §122. The last word

**Appendix AB — The Authored Floors, Exactly**


**Appendix AC — The Event Contract**


**Appendix AD — Reading the Old Code**


**Appendix AE — The Counter Roster After the Removal**


**Appendix AF — Reading List**


**Appendix AG — Maintaining This Document**


**Appendix AN — The Complete Feedback Stack**


**Appendix AO — The Teaching Plan, Per Mechanic**


**Appendix AP — Every Section's Claim**


**Appendix AQ — Our Loop Against the Genre**


**Appendix AR — Implementation Pitfalls**


**Appendix AS — Part Abstracts**


**Appendix AT — Quick Reference**


**Appendix AU — Glossary of Reference-Game Terms**

**Colophon**


**Part XXVI — The Recall, Specified**

- §123. The rule
- §124. Every design decision in that sentence
- §125. What it is for, strategically
- §126. Presentation
- §127. The risk, and the kill criterion

**Part XXVII — Scenarios**

- §128. The twelve
- §129. What the scenarios found

**Appendix AH — Alternative Score Curves Considered**


**Appendix AI — Definition of Done**


**Appendix AJ — What Success Looks Like**


**Appendix AK — Risk Register**


**Appendix AL — The First Week**


**Appendix AM — Index**


**Colophon**


---

## A note on the word "addictive"

The brief for this document used the word *addictive*, and I want to be precise about what I am
going to do with it, because the word covers two very different engineering targets and only one
of them is worth building.

The first target is **compulsion**: build a machine that exploits known weaknesses in human reward
processing to extract time and money from people, including people who are not enjoying
themselves. This is a solved engineering problem. The techniques are published, effective, and
cheap: variable-ratio reward schedules with near-miss framing, artificial scarcity with a countdown,
loss-framed daily streaks, energy meters that gate play behind waiting or payment, social
comparison against strangers, and sunk-cost inventories that make quitting feel like destroying
something you own. A team that wanted to could implement all of it in a fortnight.

The second target is **desire to return**: build a thing so good that a person who has stopped
playing wants to start again. This is not a solved problem, it is not cheap, and it is the only one
of the two that produces something you would want your name on.

The two targets share some machinery — both care about reward timing, about feedback clarity,
about the shape of a session — which is why the literature is so easy to misuse. The difference is
the *counterfactual*: compulsion techniques work **better** when the underlying game is worse,
because their job is to substitute for quality. A near-miss animation on a slot machine is doing
all the work; a near-miss on a well-made puzzle game is a small flourish on top of a thing the
player already wants. If you find yourself reaching for a compulsion technique, that is a signal
your loop is not good enough yet, and the technique will let you stop working on the loop.

So: this document optimises for **desire to return**, and §25 lists explicitly the things we will
not build even though they would work. That list is not decoration. It is a design constraint that
makes the rest of the work harder and the result better, and it is the reason several otherwise
attractive ideas in Part II are marked *steal the feeling, refuse the mechanism*.

---

## Thesis statement

> A memory board is the highest-tension input device in casual games, because every action is a
> commitment made under self-imposed uncertainty. A cascade is the highest-payoff output device,
> because one input produces a visibly enormous, legible consequence. Nobody has connected them.
> Connecting them — and then removing everything that interrupts the connection — produces a loop
> whose tension and payoff are both at the top of the genre, from a single tap.

Everything that follows is either evidence for that sentence, specification of it, or a plan to
build it.

---

# Part I — The Question

---

## §1. What we are actually trying to build

### 1.1 The one-sentence product

A game you can open, play for ninety seconds, and feel like you did something impressive; and
which, if you keep playing, gets deeper for about forty hours without ever adding a rule you have
to read.

Every clause in that sentence is load-bearing.

**"Open."** Not launch, not log in, not check in. The distance between deciding to play and
touching a tile is a number we should measure in milliseconds and treat as a defect budget. Every
splash, every menu, every "welcome back" modal is a place a person changes their mind. Our current
startup path is instrumented (Gen 17) and the budget exists; what does not yet exist is a rule that
the *first interactive frame is a board*, not a menu.

**"Ninety seconds."** A floor should clear in roughly six to ten turns of good play. Measured at
Gen 170, a clean player clears a floor in 8.4 turns and a reference player at a 25% miss rate in
16.7. At two to four seconds a turn including animation, that is twenty to sixty seconds a floor.
Ninety seconds is one or two floors — enough to feel a chain build and pay out at least once.

**"Feel like you did something impressive."** Not "did well". Impressive. The distinction is that
"did well" is a score comparison and "impressive" is a *spectacle* — a thing that happened on the
screen that you caused and could not have predicted the full extent of. This is the Peggle
distinction: the reason people remember Peggle is not the score, it is the moment the ball goes
into the bucket after thirty seconds of pinballing, and the reason they remember that is that the
game stops everything and shows it to them in slow motion with Ode to Joy playing. Spectacle is a
design output, not a polish pass.

**"Keep playing... deeper... forty hours."** Depth without new rules means the depth is in the
*interaction of existing rules*, not in content. Chess has one rule set. Tetris has one rule set.
Both are bottomless. Our depth budget is: the board's geometry, the suit layout, the chain ladder,
and the player's own memory. That is four interacting systems, which is enough — Puyo has three
and is still being played competitively thirty years on.

**"Without ever adding a rule you have to read."** This is the constraint the dungeon layer
violated most severely. Eleven card kinds, thirty-seven card effects, five key kinds, eight
objectives, eleven floor archetypes, six hazard tiles: that is a rulebook. A player meeting a
`fuse_cache` for the first time has to be told, in text, that claiming it within three resolutions
pays full value. There is no way to learn that by looking at it.

### 1.2 What "one loop" means as an engineering constraint

The single hardest and most valuable constraint in this document is this:

> **There is exactly one thing a player does, and everything in the game is a consequence of doing
> it well or badly.**

The thing is: *flip two tiles you believe are a pair.*

Everything else must be downstream of that action. Not adjacent to it, not a different verb, not a
menu you visit between doing it — downstream. If a system cannot be expressed as "this is what
happens when you flip two tiles", it does not belong in the game.

Run the existing systems through that filter:

| System | Downstream of the flip? | Verdict |
|---|---|---|
| The match | Yes — it *is* the flip resolving | Core |
| The pop | Yes — the match detonates its neighbourhood | Core |
| The ripple | Yes — the detonation propagates | Core |
| The drop | Yes — the detonation leaves a remnant that falls | Core |
| The chain ladder | Yes — consecutive good flips climb it | Core |
| Fever | Yes — the top of the ladder | Core |
| Suits | Yes — they decide what the detonation reaches | Core (input to the flip decision) |
| Score | Yes — it is the flip's payout | Core |
| Treasure card | Partly — it pays when the pop reaches it | Reducible to score |
| Enemy card | No — it is a second verb (attack) wearing a tile | Cut |
| Trap card | No — it is a punishment for flipping, i.e. anti-loop | Cut |
| Key / lock | No — it is an inventory puzzle between flips | Cut |
| Lever | No — it is a switch you must find, not a pair you remember | Cut |
| Exit | No — it is a *separate* thing to find after the board is done | Cut |
| Shop | No — it is a menu | Cut |
| Room | No — it is a menu with a theme | Cut |
| Gateway / route | No — it is a choice screen between boards | Cut |
| Hazard tiles (decoys, fakes) | No — they make the flip *lie*, which is anti-memory | Cut |
| Boss | No — it is an HP bar on a tile | Cut |
| Modes (daily/puzzle/gauntlet/meditation) | No — they are four other games | Cut for now |

Twelve of twenty-one systems fail the filter. That is not a trim; that is the finding that the game
has been carrying more than half its weight in things that are not the game.

### 1.3 The three families we are joining

This product sits at the intersection of three well-explored genres, and it is worth being exact
about what we take from each, because "inspired by" is how a design ends up with eleven card kinds.

**Family one: the cascade matcher.** Bejeweled, Candy Crush, Puzzle Bobble, Tetris Attack, Puyo
Puyo, Zuma. The defining property is that *one input can produce a chain of consequences whose
length the player did not fully predict.* This family is where our payoff comes from. What we take:
the contact rule (a group goes when it touches its own kind), the chain grammar (each wave seeds
the next), gravity/orphaning (a cluster with nothing holding it falls), and — critically — the
**escalating announcement** that names each step of the chain as it happens.

**Family two: the incremental / clicker.** Cookie Clicker, Adventure Capitalist, Universal
Paperclips, and the idle layer inside almost every mobile game since 2015. The defining property is
*a number that always moves, and a curve that always has a next visible threshold.* This family is
where our session shape comes from. What we take: the always-visible next threshold, the
non-punishing failure state, and the sense that time invested is never wasted. What we
emphatically do **not** take: idle accrual, prestige resets, and currency-gated waiting, all of
which substitute arithmetic for play.

**Family three: the memory game.** Concentration, and its thousand digital descendants. The
defining property is *the player's own uncertainty is the difficulty* — the game is not hiding
information adversarially, the player simply has not memorised it yet. This is our input, and §28
argues at length that it is a far better input for a cascade game than the genre's usual one.

The synthesis nobody has built is family three's *input* driving family one's *output* on family
two's *curve*. That is the whole idea. Everything in Part II is an attempt to learn precisely how
each family does its job so we can do all three at once.

### 1.4 What success looks like, stated as numbers

A design document that cannot be falsified is an essay. Here is what would make this thesis wrong:

1. **The first-session hook.** A new player reaches their first ripple (a break that runs more
   than one wave) inside their first three floors. If they do not, the loop's headline feature is
   not being taught by play, and the design has failed at its own premise. *Currently: measurable
   via `sim:pop`; floors 1–3 pop on 1.00 / 0.96 / 0.78 of matches, but a ripple needs Sharp, which
   a new player will not reach. **This is the single largest open risk in the design** and §51
   addresses it directly.*
2. **The ladder is felt.** Each chain tier takes visibly more off the board than the one below.
   *Currently: 1.18 / 2.32 / 2.71 / 3.71 pairs per match, banded by `sim:pop --check` at a minimum
   step of 0.3 and a spread of 2.2. Holds as of Gen 170.*
3. **The top of the ladder is reachable.** A clean player reaches Fever on at least one floor in
   ten. *Currently: 0.119 of floors at a 15% miss rate; 0.27 for a clean player. Holds as of Gen
   170, and did not before it.*
4. **Nothing in the game is decoration.** Every system fires on floors real players play.
   *Currently: eleven systems fire on zero floors — all eleven are in the layer being removed.
   After removal this should be zero, and the occupancy census is the gate that says so.*
5. **The session is short and repeatable.** Median session contains at least three floors and the
   player's last action before quitting is a floor clear rather than a mid-floor abandon. *Not yet
   instrumented. Task in §61.*
6. **A returning player is faster than they were.** Skill transfer across sessions is real and
   measurable: same seed, fewer mistakes. *Not yet instrumented; this is the "instrument repeat
   play" task the market survey said nobody in this space measures.*

If (1) cannot be made true, the design is wrong and we should reconsider whether the chain ladder
should start lower or whether the first floors should be hand-authored to guarantee a ripple.

---

## §2. The current game, measured

Before arguing about what to build, it is worth being precise about what exists, because this
project has unusually good instrumentation and there is no need to guess.

### 2.1 What works

**The pop reaches.** On every generated floor, a match takes at least one other pair with it
between 58% and 100% of the time, and on the first six floors — the ones a new player meets — it
is 63% to 100%. This was not true six generations ago: at Gen 148 the first three floors popped on
*zero percent* of matches, because four suits were dealt over floors with two or three breakable
pairs and no two of them ever shared a suit. It is true now because the palette scales with the
board and because the dungeon budget no longer eats the whole floor.

**The ladder separates.** After Gen 168, the four chain tiers take 1.18 / 2.32 / 2.71 / 3.71 pairs
per match. Before it, they took 1.67 / 1.91 / 1.92 / 3.34, which is to say the middle two rungs
were indistinguishable and the whole payoff was at the top.

**The cascade is balanced against skill.** A clean player reaches Fever on 27% of floors; a player
missing a quarter of their turns reaches it on 10%. The separation ratio is banded at 2 and sits at
2.64. The rating a player earns is driven by mistakes and nothing else — the cascade never moves
it, which is checked on every floor of every simulation run and has drifted zero times.

**The board is legible.** Suits are dealt in clumps, and the clumping is real: measured across
eight seeds, a dealt board has a same-suit neighbour rate of 0.69–0.75 against 0.46–0.51 for a
shuffle of the same tiles. A player can see the regions before flipping anything.

### 2.2 What does not work

**Eleven systems never happen.** The occupancy census plays 160 generated floors with a reference
player and counts, per system, the share of floors where the game's own counter for it moved.
Eleven counters never move at all:

| System | What it was supposed to be |
|---|---|
| `enemyHazardHitsThisFloor` | A roaming hazard landing a hit |
| `hazardShuffleSnaresThisFloor` | A shuffle snare springing |
| `hazardMirrorDecoysThisFloor` | A mirror decoy fooling a flip |
| `mimicCacheClaimsThisFloor` | A mimic cache being opened |
| `magpieTheftsThisFloor` | The magpie stealing a pair |
| `anchorSealUsesThisFloor` | An anchor seal being spent |
| `catalystAltarUpgradesThisFloor` | A catalyst altar upgrading something |
| `parasiteVesselConversionsThisFloor` | A parasite vessel converting |
| `pinLatticeRewardsThisFloor` | A pin lattice paying out |
| `lanternWardScoutsThisFloor` | A lantern ward scouting |
| `safeHazardWardsUsedThisFloor` | A safe-hazard ward absorbing a hit |

Every one of the eleven is in the dungeon layer or its hazard-tile annexe. Every one has code,
tests, Codex entries, and player-facing copy. None of them has ever happened to anybody. This is
the strongest single argument in this document: **more than half the systems in the game's most
elaborate layer are, empirically, decoration.**

**The layer is fragile in a specific, diagnostic way.** Gen 167 tried to reserve a quarter of a
floor's pairs for the loop, which required the dungeon's card-trimming function to decide which
cards to cut. That decision needed four separate passes of protection before floors stopped losing
the card their own archetype was named for: protect what the floor cannot finish without, protect
threat in full, protect the objective *and* the archetype's objective, and then keep one of every
kind before any kind gets a second copy. A system that needs four passes of special-case protection
to survive losing 25% of its budget is a system with too many mutually-load-bearing parts.

**The layer competes with the loop for the same scarce resource.** A floor has a fixed number of
pairs. Every pair the dungeon takes is a pair the pop cannot break. Before Gen 167, the dungeon's
budget was *the entire floor's pair count* — the same expression, literally — so a lever, a key, a
gateway and an enemy could take every pair on the board and the cascade had nothing to touch. That
was not a bug in a constant; it was the two designs discovering they were in a zero-sum contest and
the older one winning by default.

**The tax was invisible to our own taxonomy.** We have a memory-tax scoring system with six axes,
designed to catch exactly this: content that costs the player more than it gives. Every one of the
eleven card kinds scored `core_safe` on it. Individually they were all fine. The taxonomy could not
see that eleven individually-cheap stops, stacked, are a different game — because it measured cost
to *recall* and the real cost was to *momentum*, which nothing measured.

### 2.3 The diagnosis

The game has a cascade loop that measurably works and is getting better, and a dungeon layer that
measurably does not happen, costs the loop its raw material, needs constant special-casing, and
adds a rulebook. The layer is not badly built. It is well built, thoroughly tested, and wrong.

The correct move is not to fix it. It is to take it out, keep an accurate record of what it was, and
spend all of the recovered budget — design attention, board pairs, player attention, screen space,
and the rulebook the player has to hold — on the loop that works.

---

## §3. Why "just remove it" is the right call and not laziness

The obvious objection: the dungeon layer is content, and content is what stops a game being thin.
Removing it leaves a memory board with a cascade on it and nothing else. Is that not a smaller
game?

It is a *smaller rulebook*. Whether it is a smaller game depends entirely on whether the remaining
loop has depth, and the argument that it does runs as follows.

### 3.1 Depth comes from decisions, not from nouns

A player facing our board makes one decision repeatedly: *which pair do I flip next?* Under the
current design that decision has at least six inputs:

1. **What do I remember?** The base memory game.
2. **What suit is the pair I remember?** Suits are on the tile backs, so this is knowable without
   flipping.
3. **Where is that suit's clump?** A match inside a big clump pops more.
4. **What is my chain at?** At Clean the pops reach partners across the board; at Sharp the
   reaction runs. The same match is worth wildly different amounts at different rungs.
5. **How many pairs are left of that suit?** A break that leaves a suit with two or fewer plain
   pairs drops them too, which is a bonus you can set up.
6. **How close am I to the Fever rung?** Momentum is streak plus cascaded pairs, so a big break
   accelerates the ladder, which makes the next break bigger.

Those six inputs interact. Deciding to *not* match a pair you remember, because matching it later
at Sharp will take four more pairs with it, is a real strategic decision available on turn three of
floor one, and it is exactly the kind of decision that produces expertise. Compare it to the
decision the dungeon layer offered: *do I want the safe door, the greedy door, or the mystery door?*
— a choice made once per floor, on a menu, with no information.

### 3.2 The genre precedent is overwhelming

Every deep game in the cascade family has a tiny rulebook:

| Game | Rules a new player must be told | Depth |
|---|---|---|
| Tetris | Seven shapes, they fall, full lines clear | Played competitively for 40 years |
| Puyo Puyo | Blobs fall in pairs, four alike pop, gravity | 30 years of competitive play |
| Tetris Attack | Swap two, three alike pop, gravity, rising floor | Considered one of the deepest puzzlers made |
| Puzzle Bobble | Aim, shoot, three alike pop, orphans fall | 30 years |
| Peggle | Aim, shoot, hit orange pegs | Two games, both beloved |
| 2048 | Swipe, equal numbers merge | Cultural phenomenon from a weekend project |

None of them has a key. None has a shop mid-board. None has an exit tile. Peggle's *entire* rule
set is "clear the orange pegs, you have ten balls, the bucket gives you a ball back", and it is
the most-cited example of game feel in the industry.

The pattern is not that these games are simple. It is that their complexity is **emergent from
geometry** rather than **enumerated in content**. Our geometry — a grid, suits in clumps, pairs
whose two halves are in different places — is at least as rich as Puyo's falling blobs. We have
been adding enumerated content on top of an emergent system that had not yet been given room to
emerge.

### 3.3 The measured cost of the layer, in the loop's own currency

The clearest statement of the trade is in pairs. A floor at level 8 has about ten whole pairs. As
shipped before Gen 167, the dungeon could claim all ten. After the reserve, it claims at most
seven or eight. With the layer removed entirely, it claims none, and every pair on the board is a
pair the cascade can use.

Extrapolating from the measured relationship between breakable pairs and the ladder — floors with
more breakable pairs show both higher pop rates and wider tier spreads — removing the layer should
push the mid-game floors from roughly five to seven breakable pairs to eleven to fourteen. That is
not an incremental improvement to the cascade; it is the difference between a suit that a Clean
chain sweeps entirely and a suit deep enough that Sharp's unbounded reaction has somewhere to run.
The entire Gen 168 finding — that the ladder had no middle because suits were too small — was a
symptom of the dungeon eating the board. **Removing the layer is the real fix for the problem Gen
168 could only partially work around.**

### 3.4 What we lose, honestly

It would be dishonest to claim the layer contributed nothing. It contributed:

- **Variety of visual incident.** Different tiles looked different and meant different things. A
  board of nothing but suited pairs is visually flatter. *Mitigation: the cascade itself is the
  spectacle, and Part VI spends nine hundred lines on making the board's own events carry the
  variety. Peggle's board is 100 identical pegs in two colours.*
- **A reason to care about a specific tile.** A treasure pair was worth aiming a break at.
  *Mitigation: §40 replaces this with suit-level and geometry-level targets — the biggest clump,
  the pair whose partner is across the board, the suit down to its last three — which are
  properties of the loop rather than decorations on it.*
- **A run structure.** Floors had objectives; runs had bosses. *Mitigation: §41 and §42 replace
  this with a pressure curve and a personal-best structure, which is what the incremental family
  uses and which does not require a rulebook.*
- **Sunk work.** Thirty modules, hundreds of tests, a Codex, copy, and art hooks.
  *Mitigation: none. This is a real cost and the correct response to it is to notice that it is a
  sunk cost and that sunk costs are not a reason to keep shipping something that does not work.
  The archive exists so the work is recoverable, not so it is defended.*

### 3.5 The counterfactual test

The strongest argument for removal is a thought experiment. Imagine the game exists exactly as
this document specifies — one board, the cascade, the ladder, nothing else — and it is good.
Somebody proposes adding a card that, when you flip it, opens a shop menu.

Would we take it?

No. Obviously not. It stops the board, it adds a screen, it introduces a currency, it costs pairs,
and it makes the player read. We would reject it in a sentence.

The only reason it is in the game is that it arrived before the loop did. That is not a reason.

---

# Part II — The Field

> Thirteen dissections. The purpose of this part is not appreciation; it is theft. Each section
> ends with **What we take** and **What we refuse**, and those entries are the specification
> inputs for Part V. Where a claim is instrumented it is marked *(measured)*; where it is a
> developer's own account it is marked *(stated)*; where it is my reading of the design it is
> marked *(analysis)* and should be treated as a hypothesis rather than a fact.

---

## §4. Peggle — the anatomy of a shot

Peggle (PopCap, 2007) is the most important reference for this project, because it solved the
exact problem we have: **a single simple input producing a long, unpredictable, spectacular
consequence, in a game with almost no rules.**

### 4.1 The rule set, in full

1. There are pegs on a board. Twenty-five of them are orange; the rest are blue.
2. You aim a ball and fire it. It bounces.
3. Every peg the ball touches lights up and is removed at the end of the shot.
4. Clear all twenty-five orange pegs to win the level.
5. You have ten balls. A bucket slides along the bottom; catching it returns a ball.
6. Purple pegs are worth more; green pegs trigger a power.

That is the whole game. Six rules, four of which are "the ball bounces off things".

### 4.2 Where the depth actually is

The depth is not in the rules; it is in the **physics of a bounce and the topology of the peg
layout.** The player is doing a continuous-space geometry estimation under uncertainty: *if I
launch at this angle, the first bounce goes roughly there, and then everything after that is
chaos.*

This is worth dwelling on because it is precisely the shape of our own problem. In Peggle:

- **The first consequence is predictable.** You can see which peg the ball will hit first. Skill
  determines this.
- **The rest is not.** After one or two bounces the trajectory is chaotic. Luck determines this.
- **The reward is proportional to the unpredictable part.** A good aim gets you the first orange
  peg; a great shot gets you eleven pegs because the ball happened to fall into a channel.

That ratio — skill sets up the first step, chaos amplifies it, and the amplification is where the
joy lives — is the core engine of the entire genre and it is what we are trying to reproduce.

In our game the mapping is exact:

| Peggle | Ours |
|---|---|
| Aim the shot | Choose which remembered pair to flip |
| First peg hit | The pop: the same-suit tiles touching your match |
| Subsequent bounces | The ripple: partners elsewhere, and their neighbours |
| Ball falls into a channel and clears a column | A partner across the board seeds a wave into an untouched clump |
| Free ball from the bucket | *(we have no equivalent — see §44)* |

### 4.3 The Extreme Fever moment, dissected frame by frame

The single most-copied moment in casual game design is Peggle's level completion. It is worth
describing in full because every element of it is deliberate and most imitations copy only the
surface.

When the last orange peg is cleared:

1. **Everything stops.** The ball freezes mid-flight. This is a hard cut to a different game state,
   not a slow-down.
2. **The camera zooms** to the final peg and the screen desaturates around it.
3. **Ode to Joy begins** — not a sting, the actual choral melody, at full volume, over whatever
   music was playing.
4. **A rainbow appears** and the words EXTREME FEVER, in a font two sizes larger than anything
   else in the game.
5. **The board tilts** and the ball drops into a set of bonus buckets worth 10,000 to 100,000
   points, which are worth vastly more than the entire rest of the level.
6. **The score counts up** with an accelerating tick, for several seconds.

The whole sequence runs about eight seconds, during which the player does nothing.

The reasons this works, in order of importance:

**(a) It is disproportionate.** The bonus is worth more than the level. This is the key insight
and the most-missed one: the celebration is not a *reward for* the achievement, it *is* the
achievement. Games that add a small flourish to a proportionate reward get a small flourish.

**(b) It interrupts.** For eight seconds the player cannot do anything. Modern design instinct
says never take control away; Peggle takes it away at the exact moment the player most wants to
sit and look. Interruption at the moment of triumph reads as *ceremony*, not as friction.

**(c) It is the same every time.** Not randomised, not escalating, not variable. Every Extreme
Fever is identical. This makes it a **ritual**, and rituals are how a game builds anticipation:
the player knows exactly what is coming and wants it. A variable celebration would be more
"interesting" and much less desirable.

**(d) It uses borrowed cultural weight.** Ode to Joy carries two centuries of "this is a triumph"
that no bespoke sting can buy. *(analysis)*

**(e) It is earned by the thing the game is about.** You do not get Extreme Fever for a side
objective. You get it for the win condition.

### 4.4 What Peggle does in the 950ms after every ordinary shot

The famous moment is once a level. The moment-to-moment feel is the other 99%, and it is equally
deliberate:

- **Every peg hit plays a note**, and the notes rise in pitch through the shot. A shot that hits
  fifteen pegs plays an ascending fifteen-note run. This is free, enormous feedback: your ear tells
  you how well the shot is going before your eye has counted.
- **The pitch resets each shot**, so every shot is its own phrase.
- **Peg removal is deferred to end-of-shot**, so the board does not change under the ball. This is
  a *legibility* decision that costs realism and buys comprehensibility.
- **The ball's last bounce before falling off screen gets a slow-motion nudge** if it is near an
  orange peg. *(analysis — this is widely reported and consistent with observation)*
- **The score floats up from each peg**, in the peg's colour, and accumulates in a visible total.

### 4.5 The rising pitch is the most stealable idea in casual games

It deserves its own subsection because it is cheap, enormous, and we have already partially built
it.

The mechanism: a chain of events maps to a rising musical scale. Each event's audio is one step up.
The player's ear integrates the sequence and reports "this is going *well*, and it is *still going*"
without any numbers being read.

Why it is so effective:
- **Pitch is pre-attentive.** You do not have to look at it or think about it.
- **Rising pitch is universally read as ascent/accumulation.** *(analysis, though it is a
  well-attested cross-cultural association)*
- **It creates a musical phrase**, and an incomplete phrase creates tension — a chain that stops at
  the fifth note leaves the ear wanting the sixth. This is Zeigarnik in the auditory channel.
- **It scales for free.** A five-event chain and a twenty-event chain need no different design.

We implemented a version of this at Gen 124 (per-pair style shots with rising pitch). §46 and §61
extend it: the pitch should map to the *wave index* of the ripple as well as the pair index, so a
chain reaction climbs faster than a wide single wave, and the scale should be diatonic so long runs
stay musical rather than becoming a siren.

### 4.6 Peggle's failure modes, which we should avoid

Peggle is not perfect and its weaknesses are instructive:

- **The last orange peg problem.** Late in a level, one orange peg remains in an awkward corner and
  the player fires five balls at it. The game becomes a low-payoff accuracy test at exactly the
  moment it should be at its most spectacular. *Our equivalent risk: the end of a floor, when few
  pairs remain, no pop is possible, and the player is just clearing up. §41 addresses this
  directly — it is the reason the drop exists, and the reason the floor-end bonus exists.*
- **Luck-dominated failure.** Losing because the ball bounced badly is frustrating in a way that
  losing because you aimed badly is not. *Our equivalent risk is lower, because our chaos is
  deterministic given the board and the player's knowledge — see §28.*
- **Level count as content.** Peggle has 55 levels and then needs sequels. *Ours is procedural,
  which is a genuine advantage.*

### 4.7 What we take from Peggle

1. **The disproportionate ceremony.** The floor-end Fever payout should be worth more than the
   floor. Currently Extreme Fever pays out what the chain left standing, which is right in shape;
   §40 argues it should be larger in magnitude.
2. **The ritual.** The Fever sequence must be identical every time, and it must interrupt.
3. **The rising pitch, extended to the wave dimension.**
4. **Deferred board mutation.** Tiles removed by a break should leave *after* the break's
   animation resolves, so the board the player is reading does not change under them.
5. **The floating per-event score.** Each broken pair should float its own value.
6. **Free feedback density.** Peggle gives roughly four channels of feedback per peg (visual pop,
   colour, pitch, score float) at essentially no design cost. We should be similarly generous.

### 4.8 What we refuse from Peggle

1. **The luck-dominated failure state.** We have no equivalent and should not add one.
2. **The Master characters.** Peggle's powers are strong but they are a second system with a
   rulebook; §44 argues our power budget should be one button, not ten characters.
3. **Hand-authored levels as the content model.**

---

## §5. Puzzle Bobble / Bust-a-Move — contact, cluster, orphan

Puzzle Bobble (Taito, 1994) contributes the single most important *rule* in our design, and it is
one we have already adopted without fully mining the source.

### 5.1 The rule set

1. Shoot a coloured bubble from the bottom into a hanging cluster.
2. If it lands adjacent to two or more of its own colour, the whole connected group pops.
3. **Any bubble left with no path to the ceiling falls.**
4. The ceiling descends over time.

### 5.2 Rule 3 is the whole game

The contact rule (rule 2) is what everyone copies. The **orphan rule** (rule 3) is what makes the
game deep, and it is copied far less often.

The reason: rule 2's payoff is bounded by how many bubbles of one colour are touching. Rule 3's
payoff is bounded by *the structure of the entire board*. A three-bubble pop that happens to sever
the last connection to a thirty-bubble mass drops thirty-three bubbles. The skill ceiling of Puzzle
Bobble is almost entirely in seeing severance opportunities.

This is a profound design lesson: **the biggest payoffs should come from a structural property the
player can learn to see, not from a bigger version of the basic action.** A player who has played
Puzzle Bobble for a hundred hours is not aiming better; they are seeing the load-bearing bubble.

### 5.3 Our version, and why it currently underperforms

We have this rule. It is the **drop**: a Sharp or Fever break that leaves the matched suit with two
or fewer plain pairs takes them too. Measured at Gen 169, it fires on 0.6% of floors — barely at
all, and until Gen 168 on 0% of them.

The diagnosis (Gen 151, confirmed Gen 168): the ripple is too good. At Sharp the reaction runs
until a wave takes nothing, so it has usually swept the entire suit before the drop even looks —
0 plain pairs left on 92–98% of breaks at every tier. The drop was written for a break that took
only the touching clump, and by the time it shipped the break took the whole suit.

Gen 168 partially fixed this by bounding the wave and enlarging the suits, and the drop came off
the silent list as a direct result. But 0.6% is not a mechanic; it is a rounding error.

**The Puzzle Bobble lesson says the fix is structural, not numerical.** The drop should not be a
threshold on a remnant. It should be a *severance*: a pair whose suit-mates have all left is
orphaned and falls, regardless of tier. That makes it a property of board structure the player can
see and aim at, exactly as in Puzzle Bobble, rather than a bonus that occasionally triggers. §37
specifies this.

### 5.4 The pressure line

Puzzle Bobble's ceiling descends. This does three things:

1. **It converts a puzzle into a real-time decision.** You cannot think forever.
2. **It creates a visible, mounting threat** that is not an abstract number.
3. **It makes a big clear feel like relief**, not just points — the threat physically recedes.

Point 3 is the one worth stealing. A big cascade in our game currently produces score and
momentum. It does not produce *relief*, because there is nothing bearing down. §43 discusses
whether we want a pressure line at all — my view is that a memory game cannot afford a hard timer,
but that a *soft* pressure (the board getting harder to read, or a growing count of tiles you have
seen and forgotten) may give us the relief beat without the anxiety.

### 5.5 What we take

1. **The orphan rule as a first-class mechanic**, restructured from a threshold to a severance.
2. **The idea that the deepest skill is structural reading**, and therefore that the board must be
   readable enough to support it (which is what suits on tile backs are for).
3. **Relief as a distinct emotional payload** from reward.

### 5.6 What we refuse

1. **The hard descending ceiling.** A memory game punishes hesitation far more harshly than an
   aiming game does; a timer would make forgetting catastrophic. See §43.
2. **Colour-only identity.** Puzzle Bobble is a famously colour-blind-hostile design. Our suits
   carry a rune as well as a colour, and that is non-negotiable (Gen 6, Gen 11).

---

## §6. Tetris — the gravity contract

Tetris contributes less mechanically and more *philosophically* than any other reference here.

### 6.1 What Tetris actually is

Tetris is a game about **managing entropy against a contract you cannot renegotiate.** Pieces
arrive. They must be placed. Gaps are permanent. The floor never lowers except by your own
clearances. The contract is absolute and identical for everyone, and the entire game is the
player's relationship with it.

### 6.2 The four-line clear, and why the game is built around one move

Tetris has a scoring table that rewards clearing multiple lines at once, steeply:

| Lines cleared at once | Score multiplier (roughly) |
|---|---|
| 1 | 1× |
| 2 | 3× |
| 3 | 5× |
| 4 (a "Tetris") | 8× |

That curve is the entire strategy of the game. It converts a game about survival into a game about
**deliberately building a dangerous structure in order to resolve it spectacularly.** The player
digs a well nine columns wide and one deep, stacks precariously high, and waits for the long piece.
The tension is self-imposed and the payoff is proportional to the risk.

This is the most important idea in this section: **the best games let the player choose to make
things harder in exchange for a bigger payoff, and make that choice legible and reversible.**

Our game has this in embryo and does not exploit it. A player who remembers a pair can flip it now
for a small pop, or *hold it* — not flip it — and let their chain climb on other pairs, then flip
it at Sharp for a much larger break. That is a well being dug. The problem is that the game does
not currently make it legible: nothing on screen says "this pair, at your current tier, is worth
two pairs; at Sharp it is worth six."

§30 and §61 make this the design's central strategic axis: **the game must show the player the
value of waiting.**

### 6.3 What Tetris does about failure

You lose. There is no partial credit, no resurrection, no continue. You lose, you see your score,
and the next game starts in under a second.

The speed of restart is the whole retention mechanism. *(analysis)* A game that takes ten seconds
to restart after a loss has a very different session shape from one that takes one second, because
the second one never gives the player a moment in which quitting is the path of least resistance.

Our restart path currently goes through a game-over screen with a summary. §53 argues that screen
should be skippable to a new run with one input, and that the input should be the *same* input as
"flip a tile", so the player's hand does not move.

### 6.4 What we take

1. **The multi-clear scoring curve**, steeply superlinear, as the mechanism that makes hoarding
   correct. §40 specifies ours.
2. **Legible risk-taking**: the player must be able to see what waiting is worth.
3. **Sub-second restart.**
4. **An absolute, identical contract.** No difficulty selection, no assists that change the rules.
   Everyone plays the same game; the only variable is skill. *(This is also an accessibility
   consideration in tension with §48 and is discussed there.)*

### 6.5 What we refuse

1. **The hard-fail on entropy.** Our board does not fill up.
2. **Speed as the sole difficulty curve.** §43.

---

## §7. Tetris Attack / Panel de Pon — the skill chain

Tetris Attack (Intelligent Systems, 1995) is the deepest game in this survey and the one whose
central mechanic maps most directly onto ours.

### 7.1 The rule set

1. A grid of coloured blocks rises from the bottom.
2. You move a cursor and swap two horizontally adjacent blocks.
3. Three or more of a colour in a line clears.
4. Blocks above a clear fall.
5. If falling blocks form a new match, that is a **chain**, and chains are worth enormously more.
6. If you make a new match while blocks are still falling, that is a **skill chain**.

### 7.2 Rule 6 is the deepest mechanic in this document

Rule 5 — the automatic chain — exists in Bejeweled, Candy Crush, and every match-three since. It is
luck. You made a match, blocks fell, and something happened that you may or may not have foreseen.

Rule 6 is different in kind. Because blocks take time to fall, and because the game keeps the chain
"open" during that time, an expert player can **make a second, entirely separate match while the
first is still resolving**, and it counts as part of the same chain. And a third. And a fourth.

This converts the chain from *a thing that happens to you* into *a thing you perform*, under time
pressure, with your hands. Top-level Tetris Attack play is a sequence of pre-planned swaps executed
inside the falling window of the previous one. It is closer to a rhythm game than a puzzle game.

### 7.3 What this means for us

We have the falling window. It is the **ripple**: a break runs its waves over some hundreds of
milliseconds of animation.

We do **not** currently let the player act inside it. Input is locked while a break resolves.

The Tetris Attack lesson says this is leaving the entire skill ceiling on the table. If a player
could flip a pair *while the previous break's waves are still running*, and have that flip count as
part of the same chain, then:

- Expert play becomes a performance, not a sequence of turns.
- The chain ladder acquires a second dimension: not just *how many in a row* but *how fast*.
- Fever becomes a state you fight to sustain rather than a threshold you cross.

This is the single most exciting unexplored idea in this document and §36 and §61 treat it as a
first-class candidate. The risk is that it turns a calm memory game into a twitch game and alienates
the audience the memory board attracts; the mitigation is that it should be **optional and
invisible** — the game never asks you to do it, never shows a timer, and a player who ignores it
plays exactly the game they play now. It is a ceiling, not a floor. *(This is the same shape as
Tetris's own hold-and-wait strategy: invisible to a beginner, everything to an expert.)*

### 7.4 The garbage mechanic, and the shape of escalation

In competitive Tetris Attack, chains send "garbage" blocks to the opponent, and garbage blocks
*clear when a chain runs through them*, turning defence into offence. The escalation shape is:
pressure arrives → pressure becomes ammunition → bigger counterattack.

We have no multiplayer target and should not build one. But the *shape* — an incoming problem
that a big enough play converts into a bigger reward — is worth having against the environment
rather than an opponent. §43 sketches a version: as a run gets deeper, boards carry more pairs whose
partners are far apart (harder to remember), and a Sharp break is precisely the thing that reaches
across the board to take them. The difficulty and the answer to it are the same mechanic.

### 7.5 What we take

1. **Acting inside the resolution window as the skill ceiling.** Candidate; see §36.
2. **Chains as performance, not luck.**
3. **Difficulty that a big play converts into reward.**
4. **The chain counter as the loudest thing on screen.** Tetris Attack announces "CHAIN ×4!" in a
   voice, over the music. Ours announces tiers by name; §46 argues the *count* should be as loud as
   the tier.

### 7.6 What we refuse

1. **Twitch input as a requirement.**
2. **Competitive multiplayer.**

---

## §8. Puyo Puyo — chain notation and the shared mental model

Puyo Puyo (Compile, 1991) contributes something unusual: not a mechanic, but a *vocabulary*.

### 8.1 The rule set

1. Pairs of coloured blobs fall. You rotate and place them.
2. Four or more connected of a colour pop.
3. Blobs above fall, possibly forming new groups, which pop, and so on.
4. Each step of that sequence is a link in a chain, and the score curve on chain length is brutal.

### 8.2 The chain score curve

Puyo's chain multiplier is roughly:

| Chain length | Multiplier |
|---|---|
| 1 | 1 |
| 2 | 8 |
| 3 | 16 |
| 4 | 32 |
| 5 | 64 |
| ... | ×2 per link, roughly |

A five-chain is not five times a one-chain, it is sixty-four times. This is the steepest reward
curve in the survey and it produces a very specific behaviour: **players spend the entire early
game building and never scoring.** A Puyo match is thirty seconds of apparently doing nothing
followed by one detonation.

### 8.3 The vocabulary is the real contribution

Competitive Puyo has named, taught, shared chain-building patterns: *stairs*, *sandwich*, *GTR*,
*fron*, *tara*. These are not in the game. Players invented them, named them, and teach them to
each other. The game's depth became a *shared language*, and that language is the community.

This is the strongest possible form of retention and it cannot be manufactured directly. What can
be manufactured is the *precondition*: a mechanic must be deterministic enough, and repeatable
enough, that patterns are worth naming. If chains are luck, there is nothing to name.

Ours is deterministic given the board and the player's memory. Board layouts are seeded. That means
patterns exist to be found: *this suit shape, at this tier, takes this much.* Whether players find
and name them depends on whether we make the geometry visible and stable enough. That is an
argument for suits on tile backs (already done), for a fixed and legible reach rule (done, Gen
168), and for a replay/share format that lets a player show somebody else a board. *(§55.)*

### 8.4 What we take

1. **A steeply superlinear chain curve.** Ours is currently a 20%-per-wave lift capped at 2×,
   which is nearly linear and far too shallow. §40 proposes a curve nearer Puyo's shape.
2. **The build-then-detonate rhythm**, which is the same idea as Tetris's well and reinforces §6.2.
3. **Determinism as the precondition for a shared vocabulary.**
4. **A chain counter with its own escalating audio.**

### 8.5 What we refuse

1. **A curve so steep that not building is never correct.** Puyo's curve makes small chains
   worthless, which is fine in a competitive two-player game and hostile in a single-player casual
   one. Ours must reward the small chain honestly while making the big one spectacular. This is a
   real tension and §40 resolves it with a curve that is superlinear but bounded.

---

## §9. Bejeweled and Candy Crush — the cascade as slot machine

These two are grouped because they share a mechanic and differ almost entirely in monetisation,
which makes the pair a controlled experiment in what the monetisation does to the design.

### 9.1 The shared rule set

1. A grid of coloured gems.
2. Swap two adjacent gems if the swap makes a line of three or more.
3. The line clears, gems above fall, new gems drop in from the top.
4. If the fall makes a new line, it clears too. Repeat.

### 9.2 The critical difference from Tetris Attack

In Tetris Attack, the falling window is a **window the player can act in**. In Bejeweled, it is a
**cutscene**. The player makes one input and then watches for up to several seconds while the
board resolves itself.

This is a deliberate design choice, not an oversight, and it defines the genre's audience. The
cascade in Bejeweled is not a skill expression; it is a **reward event**. The player's input is a
lever pull; the cascade is the reels spinning.

This is stated bluntly because it is important for us: **Bejeweled's cascade is structurally a slot
machine, and it is enormously successful.** Millions of people love the feeling of pulling a lever
and watching a good thing unfold that they did not fully cause. There is nothing wrong with that
feeling.

But it has a ceiling. A player who plays Bejeweled for a thousand hours is not meaningfully better
than one who has played for ten, because the cascade — where all the points are — is not skill.
*(analysis; this is contested, and expert Bejeweled play does involve real board reading, but the
variance from refill randomness dominates.)*

### 9.3 The refill is the problem

The specific thing that makes Bejeweled's cascade luck rather than skill is that **new gems fall in
from off-screen, randomly.** The player cannot see them, cannot plan around them, and their
identity determines whether the cascade continues.

This is the single design decision that separates the "cascade as reward" family from the "cascade
as skill" family:

| Game | Where the cascade's continuation comes from | Result |
|---|---|---|
| Bejeweled / Candy Crush | Random gems from off-screen | Luck |
| Tetris Attack | Blocks already on the board falling | Skill |
| Puyo Puyo | Blobs already on the board falling | Skill |
| Puzzle Bobble | Structure already on the board severing | Skill |
| **Ours** | **Pairs already on the board, whose positions the player has memorised** | **Skill** |

Our design is in the right column, and it is there for a reason that is worth naming: **we have no
refill.** Nothing enters our board mid-floor. Everything that can happen is on the board at the
start of the floor, and the only hidden information is hidden *from the player's memory*, not by
the game. That is a stronger guarantee than any of the skill-column games have, and §28 argues it
is the design's deepest structural advantage.

### 9.4 What Candy Crush adds, and what it costs

Candy Crush (King, 2012) took Bejeweled's mechanic and added: level goals, a lives system, a map,
boosters, and a monetisation layer. The lessons are mostly cautionary but not entirely.

**Worth taking:**
- **Explicit per-level goals** give a session a shape and an ending. Our floors have this
  implicitly (clear the board); making the goal explicit and visible is cheap.
- **Special pieces created by large matches** (striped, wrapped, colour bomb) are an elegant way to
  make a big match pay forward into the *next* move rather than just scoring. A four-match makes a
  striped candy; the player then decides where to use it. This is a genuinely good idea and §44
  considers a version.
- **The failure state is soft.** You lose a level, you retry. No run is destroyed.

**Refused:**
- **The lives system.** Energy gating is the purest form of "make the game worse so waiting is
  worth money". §25.
- **Difficulty tuned against the payment funnel.** Candy Crush's difficulty spikes are well
  documented as being placed where conversion is highest. *(stated, widely reported)*
- **Boosters as a solution to a difficulty you authored.**
- **The map metaphor**, which is a progress illusion — a long ribbon of levels that makes a
  thousand identical boards feel like a journey.

### 9.5 What we take

1. **The awareness that a no-refill board puts us in the skill column by construction**, and the
   determination not to give that up for any reason.
2. **Special-piece-from-big-match** as a candidate for the one power the game has. §44.
3. **The explicit visible goal per floor.**

### 9.6 What we refuse

1. **Randomness that arrives from outside the board.**
2. **Lives, energy, and any gate between wanting to play and playing.**
3. **Difficulty tuned to anything but the player's experience.**

---

## §10. Zuma and Luxor — the pressure line, done well

Zuma (PopCap, 2003) is Puzzle Bobble's contact rule on a moving track, and it contributes one
specific thing: **the best-executed pressure mechanic in the casual canon.**

### 10.1 The mechanic

A line of coloured balls advances along a path toward a hole. You shoot balls into the line from a
fixed point. Three or more alike pop; the line closes the gap; if the closure makes a new match, it
chains. Reach the hole and you lose.

### 10.2 Why the pressure feels fair and Puzzle Bobble's often does not

Three reasons:

**(a) The threat is continuous and visible in space, not time.** You are not racing a clock, you
are watching a snake. Distance to the hole is a spatial quantity you can read at a glance and
reason about. This is enormously less stressful than a countdown while being just as urgent.

**(b) Progress is reversible.** A good chain *pushes the line backwards*. Under time pressure you
cannot get time back; under spatial pressure you can get space back. That converts a losing
position into a comeback opportunity, and comebacks are the most memorable moments in any game.

**(c) The pressure is the scoring opportunity.** The line being long is bad (it is close to the
hole) and good (a long line has more chain potential). Risk and reward are the same object.

### 10.3 What a Zuma-shaped pressure would look like for us

§43 develops this properly, but the sketch: our board does not fill, but the player's *memory*
degrades. A soft pressure could be a **fog**: tiles the player has seen but not matched gradually
lose the suit marking on their back, or dim, after N turns without being touched. The player is
racing their own forgetting, which is thematically exact.

This satisfies (a) — it is visible in space, on the board, tile by tile. It satisfies (b) — a big
break clears fogged tiles and *relieves* the pressure. It satisfies (c) — a heavily fogged board is
dangerous and also full of pairs nobody has claimed.

It is a strong idea and it is also the riskiest idea in this document, because it makes the game
harsher and our audience may not want that. §43 proposes it as an opt-in intensity rather than the
default, and §57 specifies what would have to be true for it to ship.

### 10.4 What we take

1. **Spatial pressure over temporal pressure**, if we take pressure at all.
2. **Pressure that a good play pushes back.**
3. **Risk and reward as the same object.**

### 10.5 What we refuse

1. **A hard fail state on the pressure**, at least by default.

---

## §11. Cookie Clicker and the incremental family — the number that always moves

Cookie Clicker (Orteil, 2013) and its descendants contribute the **session and retention shape**,
and a very sharp lesson about what is and is not a game.

### 11.1 The core loop, and why it is compelling despite being trivial

You click a cookie. You get a cookie. You spend cookies on things that make cookies. The number
goes up faster. Repeat.

There is no skill. There is barely any decision. And it is *extremely* compelling for the first
several hours. Why:

**(a) The number always moves.** There is never a moment when nothing is happening. This is the
single most important property and the one most casual games get wrong: they have dead time —
menus, transitions, waiting — during which the player's brain gets a chance to ask whether it wants
to be doing this.

**(b) There is always a visible next threshold.** You can always see the next purchase you cannot
quite afford, and how close you are. The game is a rope of near-completions.

**(c) The thresholds are logarithmically spaced.** Each is roughly a fixed *proportion* away, so
the experience of "almost there" is constant regardless of scale.

**(d) Nothing is ever lost.** No failure state, no decay, no punishment.

### 11.2 What incrementals teach about thresholds

The design pattern worth stealing is precise: **at every moment, the player can see exactly one
next thing they are close to, and roughly how close.**

Not five things. One. Cookie Clicker shows a shop full of items but the *next* one is the one
highlighted as affordable-soon. The player's attention has a single target.

Our equivalent already half-exists: the chain meter shows momentum against the next rung. §40 and
§53 extend it — at any moment the HUD should be able to answer "what is the next good thing, and
how close am I?" with one number, and that number should be different at different points in a
floor (early: the next rung; late: the floor-clear bonus; end of run: the personal best).

### 11.3 Universal Paperclips, and the lesson about endings

Universal Paperclips (Frank Lantz, 2017) is an incremental that **ends**. It has a narrative arc, a
conclusion, and a running time of a few hours. It is far more respected than the genre's endless
entries, and people finish it and recommend it, which is a retention mechanism that outlasts any
daily reward.

The lesson: **a thing that ends is shareable in a way an endless thing is not.** "You should play
this, it takes four hours" is a much easier recommendation than "you should play this, it is
endless".

We are an endless arcade game and should stay one. But the lesson applies to the *run*: a run
should have a shape with an ending, so that a session produces a story ("I got to floor 22 and then
lost it on a stupid mistake") rather than a state. §42.

### 11.4 What we refuse from the incremental family, emphatically

**Idle accrual.** The moment a game earns for you while you are not playing, playing becomes the
optional part. Every incremental eventually becomes a notification manager.

**Prestige resets.** Wiping progress for a multiplier is an extremely effective compulsion loop and
it is arithmetic, not play.

**Waiting as a mechanic.** Any design where the correct move is to close the app is a design that
has stopped being a game.

### 11.5 What we take

1. **The number always moves. No dead time.** This becomes a hard rule in §45: no state in which
   the screen is static and the player is not being asked for input.
2. **Exactly one visible next threshold at a time.**
3. **Logarithmic threshold spacing**, so "nearly" feels the same at every scale.
4. **Nothing is ever lost** within a floor. §41.
5. **A run has a shape and an ending.**

---

## §12. Vampire Survivors — the power fantasy curve

Vampire Survivors (poncle, 2022) is the clearest modern demonstration of a specific curve: **the
player starts weak and ends absurd, within twenty minutes, every time.**

### 12.1 The shape

Minute 0: you have one weak attack, you dodge everything.
Minute 10: you have six weapons firing automatically, the screen has forty enemies.
Minute 25: the screen is a solid wall of your own effects, thousands of enemies die per second, and
you have essentially stopped playing in any conventional sense.

And then the run ends and you start again at minute 0.

### 12.2 Why it works

**(a) The delta is enormous and compressed.** Going from weak to godlike in twenty minutes means
the *rate of change* is always palpable. Most progression systems spread the same delta over forty
hours and the player never feels it.

**(b) The absurdity is the point.** The end state is not "balanced". It is ridiculous, and being
ridiculous is the reward.

**(c) Resetting is not a punishment** because the ascent is the fun part, not the summit.

**(d) The build is legible and combinatorial.** Weapons combine into named evolutions; the player
learns a vocabulary (as in Puyo, §8.3).

### 12.3 What this means for our floor and run curves

Our current floor curve is roughly flat in feel: floor 1 and floor 12 play similarly, differing in
pair count. Our run has no ascent.

The Vampire Survivors lesson suggests the **floor** should have the compressed ascent, not the run:

- **Turn 1 of a floor**: your chain is zero, a match pops one or two pairs.
- **Turn 6 of a floor**: your chain is at Sharp, a match runs a reaction across the board.
- **Turn 8**: Fever, the halo, the screen goes off.
- **Floor ends. Chain resets. Next floor: back to turn 1.**

That is exactly the Vampire Survivors shape at a ninety-second scale, and we already have most of
it. What is missing is the *magnitude* of the top end. Going from 1.18 pairs per match to 3.71 is a
3× ascent. Vampire Survivors' is more like 1000×. We are not going to hit 1000×, but §40 argues our
top end is currently far too modest, and that the Fever break should feel like a different game
rather than a bigger version of the same one.

### 12.4 What we take

1. **A compressed, always-palpable ascent within the floor.**
2. **An absurd top end.** Fever should be excessive.
3. **Reset without punishment.**

### 12.5 What we refuse

1. **Automation.** Vampire Survivors ends with the player barely playing. Our top end must still be
   the player flipping tiles — more consequentially, not less actively.

---

## §13. Balatro — the multiplicative build

Balatro (LocalThunk, 2024) is the most instructive recent release in this survey because it
achieved enormous success with a tiny rule set, no art budget to speak of, and a single mechanic
that this project can learn from directly.

### 13.1 The core insight: chips × mult

Every scoring hand in Balatro resolves as `chips × mult`. Cards and jokers add to one or the other,
or multiply the mult. Because the final score is a product, effects that seem small compose
explosively: a joker that adds +4 mult is modest alone and transformative next to one that doubles
mult.

The design consequence: **the player's job is to find a multiplicative pair**, and finding one
produces a score that is orders of magnitude beyond the baseline. The game's entire emotional arc
is "I found the thing that makes the other thing enormous."

### 13.2 Why this matters to us

Our scoring is additive. A break of six pairs scores roughly six times a break of one, with a
modest ripple lift on top (20% per wave, capped at 2×).

If the score were `pairs × tier × waves`, a Fever break with four waves and eight pairs would be
worth vastly more than four separate two-pair breaks — and the player would feel that they *found*
something rather than accumulated it.

This is the same idea as Puyo's chain curve (§8.2) and Tetris's line curve (§6.2), and the fact
that three of the deepest games in the survey independently arrive at a steeply superlinear payoff
for concentration-over-time is the strongest convergent evidence in this document. §40 makes our
curve multiplicative.

### 13.3 The run structure

Balatro's run is: eight antes, each with three blinds, each a score threshold. The threshold grows
faster than the player's natural growth, so the player *must* find a multiplicative engine or lose.

The lesson is not the structure but the *pressure it creates*: the game constantly tells you the
number you must reach, and that number is visibly larger than what you can currently do. Every run
is a race to build faster than the threshold climbs.

Ours has no such number. §42 proposes one: the run's pressure is a rising **floor-clear par** —
each floor states a score you should beat, and the par climbs faster than raw pair count does, so
the player must lean on the ladder rather than on grinding matches.

### 13.4 What we take

1. **Multiplicative scoring**, so that concentration beats accumulation.
2. **A visible, climbing threshold** that forces the player toward the deep mechanic.
3. **Extreme numbers as a reward in themselves.** Balatro players screenshot their scores.

### 13.5 What we refuse

1. **Deck-building as a second system.** Balatro's jokers are a rulebook; we have just removed one.
2. **Run-ending failure on a threshold**, at least in the default experience. §42 keeps the run
   endless and makes the par a *target*, not a gate.

---

## §14. Slay the Spire — the run as the unit of play

Slay the Spire (Mega Crit, 2017) contributes structural lessons about how a session is shaped and
how a player's investment is protected.

### 14.1 The relevant structure

A run is 50-ish encounters across three acts, forty-five to ninety minutes, ending in victory or
death. Between encounters, the player makes a small number of highly consequential choices (a card,
a relic, a path).

### 14.2 The three lessons

**(a) A run is the unit, not a session.** Players talk about runs. Runs have stories. This is the
same idea as §11.3's ending, and it is why our run needs a shape.

**(b) Choices are few, consequential, and permanent.** Slay the Spire offers roughly one meaningful
choice every ninety seconds, and each is irreversible within the run. Compare our removed route
system: a choice every floor, between three doors, with almost no information and almost no
consequence. A choice without information is not a choice; it is a coin flip with extra clicking.

The lesson for us is stark: **if we ever add a choice back, it must be informed and consequential,
and one every ten minutes is plenty.** §44 proposes exactly one such choice per run, and §63 lists
"a choice screen between floors" as something we are deliberately not doing.

**(c) Failure is information.** A Slay the Spire death teaches. The player knows what killed them
and what they would do differently.

Our failure state — running out of lives on mistakes — teaches almost nothing, because a mistake is
a memory lapse and the lesson is "remember better". §42 discusses whether the run should end on
mistakes at all, and leans toward no: the run should end on *the pressure curve outpacing the
player*, which is legible, rather than on accumulated forgetting, which is not.

### 14.3 What we take

1. **The run as the unit of play and the unit of storytelling.**
2. **Choices that are few, informed, and consequential — or none at all.**
3. **A failure the player can learn from.**

### 14.4 What we refuse

1. **Between-encounter menus as the primary decision surface.** This is what we just deleted.
2. **Run length over fifteen minutes**, for a game meant to be opened for ninety seconds.

---

## §15. Threes and 2048 — the merge and the tidy board

Threes (Sirvo, 2014) and its clone 2048 contribute one lesson each, and they are opposite lessons,
which is what makes the pair valuable.

### 15.1 Threes: the value of a hand-tuned, unforgiving system

Threes was built over fourteen months. Every number, every animation, every card-arrival rule was
tuned. The result is a game where the board is small, the decisions are constant, and the failure is
always the player's fault. Its designers wrote a famous, bitter postmortem about the clones.

The lesson: **a tiny mechanic, tuned obsessively, is a complete product.** Threes has one verb.

### 15.2 2048: the value of legibility over depth

2048 was made in a weekend, is mechanically inferior to Threes (its merge rules are simpler and its
board is more forgiving), and was played by vastly more people.

The reason, per the analyses at the time: **2048 is instantly legible.** Equal numbers merge and
double. You understand the entire game in two seconds from a screenshot. Threes' merge rule (1+2=3,
then equals merge) requires a sentence of explanation.

The lesson: **legibility beats depth for reach.** A screenshot must teach the game.

### 15.3 The synthesis for us

Our screenshot currently shows: a grid of tiles with runes on them, a HUD with several numbers, and
possibly a dungeon card overlay. It does not teach the game.

After the removal it should show: a grid of tiles in two or three suit-coloured regions, two tiles
face up and matched, and a visible blast taking six other tiles with it. That *is* the game, in one
frame. §49 makes "the screenshot teaches the game" an explicit test.

### 15.4 What we take

1. **The screenshot test.**
2. **Obsessive tuning of a tiny mechanic as a legitimate and complete plan.**
3. **A board small enough to comprehend at a glance.**

---

## §16. Slot machines — what we take and what we refuse

This section exists because it would be dishonest to write about compelling loops and omit the
most optimised of them, and because several techniques in the cascade genre are directly inherited
from gambling design without acknowledgement.

### 16.1 The mechanisms, stated plainly

- **Variable-ratio reinforcement.** Rewards arrive on an unpredictable schedule. This produces the
  highest and most persistent response rate of any reinforcement schedule.
- **Near-miss framing.** Outcomes are displayed so that losses resemble wins (two jackpot symbols
  and a third just above the line). Near-misses activate reward circuitry despite being losses.
- **Losses disguised as wins.** A spin that returns less than it cost is presented with win audio
  and animation.
- **Rapid, uninterrupted repetition.** Short cycle time, no natural stopping point.
- **Illusory control.** A stop button that does not change the outcome.
- **Sensory reinforcement of the *event*, not the *value*.** Every payout, however small, gets
  celebration; the celebration's magnitude is decoupled from the payout's.

### 16.2 Which of these are already in the cascade genre

Honestly: most of them, in mild form.

- Bejeweled's random refill is a variable-ratio schedule.
- A cascade that stops one gem short of continuing is a near-miss, and is rendered with the same
  drama as one that continues.
- Match-three games celebrate every match identically regardless of value.
- Session-based mobile matchers are explicitly designed without natural stopping points.

The genre is not innocent, and pretending otherwise would make this document useless as a guide.

### 16.3 Our position, stated as rules

**We use:** rapid repetition, sensory generosity, and celebration of events. These are the parts
that make a game feel good and that work *better* when the underlying game is good.

**We refuse, as hard rules:**

1. **No randomness the player cannot see or plan around.** Our board is fully determined at floor
   start; nothing enters mid-floor. This single rule removes the variable-ratio schedule at the
   root, because the outcome of a flip is a function of the player's knowledge, not of a hidden
   roll.
2. **No losses disguised as wins.** A mismatch is presented as a mismatch. A small break is
   presented as a small break — celebrated, but proportionately.
3. **No near-miss manufacturing.** We will not construct boards, or bias generation, so that
   cascades stop one pair short. If a cascade stops short, that is the geometry, and the geometry
   was visible.
4. **No illusory control.** Every control does what it appears to do.
5. **No money in the loop at all.** No currency the player can buy, no purchase that changes a
   board, no purchase that saves a run.
6. **No artificial scarcity.** No lives, no energy, no cooldowns, no "come back in four hours".

### 16.4 Why refusing these is commercially correct, not just ethical

Three arguments:

**(a) They only work on a captive audience.** Compulsion techniques exploit the gap between wanting
to stop and being able to. A premium, one-purchase, no-monetisation-in-the-loop product has no
mechanism to profit from that gap — the player has already paid. Compulsion in a premium game
extracts nothing and costs goodwill.

**(b) They substitute for quality and thereby prevent it.** If a near-miss animation keeps
retention acceptable, the loop never gets fixed. The measurements in this repository exist to
prevent exactly that substitution.

**(c) The market punishes it in this segment.** The market survey found that the products with the
strongest word-of-mouth in the puzzle and roguelite space (Balatro, Vampire Survivors, Slay the
Spire, Threes) are conspicuously free of these techniques, and that the ones most associated with
them are conspicuously not recommended by their own players. Word of mouth is the only marketing
channel available to a small premium game.

### 16.5 The one genuinely hard case: the ritual celebration

Peggle's Extreme Fever is, mechanically, "sensory reinforcement decoupled from value" — an
eight-second celebration for finishing a level. Is that a slot machine technique?

My answer: no, because of the *counterfactual test in §16.4(b)*. Remove the celebration from Peggle
and the game is still good, just less joyful. Remove the celebration from a slot machine and there
is nothing left. Celebration on top of a real achievement is craft; celebration instead of an
achievement is manipulation. The test to apply to any of our own flourishes is: **if we deleted
this flourish, would the underlying event still be worth having?** If yes, the flourish is craft.

---

## §17. Cross-cutting: what each reference does at every timescale

The most useful single artefact from this survey is a comparison across timescales, because it
shows which games have thought about which parts of the experience and where the gaps are.

### 17.1 The table

| Timescale | Peggle | Puzzle Bobble | Tetris | Tetris Attack | Puyo | Bejeweled | Zuma | Cookie Clicker | Vampire Survivors | Balatro | Slay the Spire | 2048 | **Ours (target)** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **~16ms (frame)** | Ball physics | Bubble flight | Piece drop | Cursor | Blob fall | — | Ball flight | Number ticks | Particles | — | — | — | Tile flip lerp |
| **~100ms (beat)** | Peg hit + note | Bubble lands | Lock delay | Swap | Blob lands | Gem swap | Ball inserts | Click | Enemy dies | Card flip | Card play | Merge | **Match resolves, pop begins** |
| **~1s (event)** | Multi-peg chain | Cluster pops, orphans fall | Line clear | Chain link | Chain link | Cascade step | Chain | Purchase | Level up | Hand scores | Attack | Slide | **Ripple runs its waves** |
| **~10s (exchange)** | One shot's full arc | Two or three shots | A few pieces | A chain built and fired | A chain fired | A few swaps | A crisis and its resolution | A few purchases | A wave | A blind | An encounter | A dozen moves | **A chain built, held, and detonated** |
| **~1min (phase)** | Half a level | A level | A speed level | A match's midgame | A match | A level | A level | A tier of buildings | Minutes 0–1 of the ascent | An ante | A room-to-room stretch | A game's midgame | **A floor** |
| **~10min (session)** | Several levels | Several levels | One long game | Several matches | Several matches | Several levels | Several levels | An hour's worth of tiers | Half a run | Half a run | Half a run | A game | **Six to ten floors: a run** |
| **~1hr (sitting)** | A world | A world | Many games | Many matches | Many matches | Many levels | Many levels | A prestige cycle | Two or three runs | Two runs | One run | Many games | **Four to six runs** |
| **~1wk (return)** | New worlds | New levels | Beat your score | Improve | Learn patterns | Daily levels | New levels | Numbers grew | New characters | New jokers/decks | New ascension | Beat your score | **Beat your best; the board is the same, you are better** |

### 17.2 What the table shows

**We are well covered at 100ms to 1 minute.** The match, the pop, the ripple, the floor — these are
built and measured.

**We are thin at 10 seconds.** The "chain built, held, and detonated" cell is the strategic heart of
the design per §6.2, and it currently is not legible to the player. This is the single biggest
design gap. §30.

**We are absent at 1 hour and 1 week.** We have no run shape worth the name and no reason to
return other than a score. Every other game in the table has a deliberate answer here. §§53–56.

**Nobody in the table has our 100ms cell.** Every other game's 100ms event is a mechanical
placement or a swap. Ours is *an act of recall being tested*. That is a genuinely novel emotional
beat — the half-second between committing to a flip and seeing whether you were right — and no
game in this survey has it as its core input. §28 argues this is our biggest untapped asset and
that we have not built a single piece of feedback around it.

---

# Part III — The Psychology

> A caveat before this part begins. Game design borrows from psychology badly and often. Much of
> what circulates as settled fact in design talks is either contested in the literature, drawn from
> animal studies whose generalisation to humans is debated, or has failed replication. I have tried
> to mark confidence levels honestly: **(robust)** for findings with broad replication,
> **(contested)** where the literature genuinely disagrees, and **(mechanism)** where I am
> describing a plausible causal story rather than a measured result. Where I am reasoning by
> analogy from the games in Part II rather than from research, I say so. A design argument that
> needs a specific contested finding to be true is a weak argument, and I have tried not to make
> any.

---

## §18. Reward prediction error, and why a cascade feels so good

### 18.1 The finding

The best-supported account of what dopamine signals in reward learning is that it encodes not
reward but **reward prediction error** — the difference between what was expected and what
occurred. **(robust)** A fully predicted reward produces little response; an unexpected reward
produces a large one; an expected reward that fails to arrive produces a negative signal.

### 18.2 Why this is the whole explanation for the cascade genre

Consider the moment structure of a Bejeweled cascade:

1. Player swaps two gems. Expected outcome: one line of three clears. **Prediction is confident.**
2. The line clears. **No prediction error. Small response.**
3. Gems fall. A new line forms. **This was not predicted. Large positive prediction error.**
4. That line clears; more gems fall; another line forms. **Again unpredicted.**
5. The cascade stops. **Slight negative error, quickly forgotten.**

Steps 3 and 4 are where the entire emotional payload of the genre lives, and they are payload
precisely *because* they were not predicted.

This yields a design principle with real teeth:

> **The pleasure of a cascade is proportional to the gap between what the player predicted and what
> occurred. Therefore the design goal is not "bigger cascades" but "cascades whose extent the
> player could not have computed in advance — while still being able to compute that something
> good was likely."**

Both halves matter. A completely unpredictable outcome is not a reward, it is noise — the player
gets no credit and learns nothing. A completely predictable outcome is arithmetic. The sweet spot
is *confident about the first step, uncertain about the extent*, which is exactly Peggle's shape
(§4.2) and exactly what our pop-then-ripple structure produces.

### 18.3 The specific implication for our design

Our first step is **highly** predictable: a match pops the same-suit tiles it is touching, and the
suits are visible on the tile backs. A player can look at the board and know that this match will
take at least those two neighbours.

Our extent is **unpredictable in a specific, fair way**: the pop's partners are *elsewhere*, and
where they are depends on what the player has and has not memorised. A player who has memorised the
whole board could compute the whole cascade; a player mid-floor cannot, because the cascade's
propagation runs through tiles they have not seen.

**This is a better prediction-error structure than any game in Part II**, and it is worth being
precise about why: in Bejeweled the uncertainty comes from the game hiding information (the refill).
In ours the uncertainty comes from the *player's own incomplete knowledge of information the game
showed them*. The player is surprised by their own board.

Two consequences follow.

**(a) Surprise decays as knowledge grows, and that is correct.** Late in a floor the player knows
more, predicts better, and gets less prediction error. This means the *early* part of a floor should
carry the big cascades, not the late part — which is the opposite of how most of our floors
currently play, where the chain ladder climbs over the floor and the biggest breaks land at the end
when the player knows everything. §30 and §41 address this tension, which I consider the deepest
open design problem in the document. Peggle has the same problem (§4.6, the last orange peg) and
solves it by making the *level end* the celebration rather than the last shot.

**(b) A cascade that the player fully predicted should be rewarded differently** — as mastery, not
as spectacle. A player who deliberately sets up an eight-pair Sharp break and gets exactly eight
pairs has done something excellent and should be told so in different language than a player who
got eight by luck. §46 proposes distinct feedback: spectacle audio for the unpredicted, a crisp
confirming tone for the predicted. *(mechanism — this is a hypothesis about what would feel right,
not a measured result.)*

---

## §19. Variable ratio schedules, and the honest version

### 19.1 The finding, and its limits

Reinforcement delivered on a variable-ratio schedule (reward after an unpredictable number of
responses) produces high, steady response rates that are highly resistant to extinction.
**(robust in operant conditioning; the extrapolation to complex human behaviour like game-playing
is (contested))**

The extrapolation deserves scepticism. Human game-playing is not lever-pressing: it involves
narrative, self-concept, social context, and explicit reasoning about the schedule itself. Players
who *know* a schedule is variable-ratio respond differently from rats. Designers who treat the
finding as a lever to pull tend to produce games that people play compulsively and describe
resentfully.

### 19.2 What we do instead

The honest version of the same shape, and the one every good game in Part II actually uses, is
**variable magnitude with deterministic occurrence.**

- **Deterministic occurrence:** every match produces a break. Always. No roll.
- **Variable magnitude:** how big the break is depends on the board's geometry and the player's
  chain, both of which are visible and both of which the player influences.

This produces the same "you never know quite what you'll get" texture without any hidden
randomness, and — critically — the variance is attributable to *skill and board reading* rather
than to a die roll. A player who gets a large break can correctly feel they earned it. A player who
gets a small one can correctly identify why.

### 19.3 The test we hold ourselves to

> For any outcome the player experiences, they must be able — in principle, with full board
> knowledge — to have predicted it exactly.

Our design satisfies this by construction because the board is fully determined at floor start and
nothing enters mid-floor (§9.3). This is a strong, checkable property and §57 makes it a gate: any
proposed mechanic that introduces a mid-floor roll fails it.

---

## §20. Flow, and the channel

### 20.1 The model

Csikszentmihalyi's flow model describes an optimal experience arising when perceived challenge and
perceived skill are both high and roughly matched; too much challenge produces anxiety, too little
produces boredom. **(robust as a descriptive framework; (contested) as a predictive or measurable
construct)**

The practical design content of flow theory, stripped of the mysticism, is three requirements:

1. **Clear goals at every moment.**
2. **Immediate, unambiguous feedback.**
3. **Challenge that tracks skill.**

### 20.2 Requirement 1: clear goals

At every moment our player should be able to answer "what am I trying to do right now?" without
thinking.

- **Early floor:** find any pair. (Trivially clear.)
- **Mid floor:** build the chain / decide whether to spend a known pair now or hold it. (Currently
  *not* clear — the game does not tell the player holding is an option. §30.)
- **Late floor:** clear out; reach the floor bonus. (Reasonably clear.)
- **Run:** get deeper than last time. (Clear if we show the personal best. §55.)

The mid-floor gap is a flow defect, not just a missing feature.

### 20.3 Requirement 2: immediate unambiguous feedback

We are strong here and can be stronger. Every match currently produces: a flip animation, a match
sound, a score float, a break animation with per-wave delays, a shatter wave, a tier name, a chain
meter update, and a HUD announcement. Part VI tightens the timing.

The one ambiguity worth naming: **a mismatch and a match-with-no-pop currently feel too similar**
in the moment before the break resolves. §46.

### 20.4 Requirement 3: challenge tracking skill

This is where a memory game is unusual, and it is worth spelling out.

In most games, difficulty is a property of the content. In a memory game, **difficulty is a
property of the player's memory**, and it self-adjusts: a good rememberer finds the board easy, a
poor one finds it hard, and both are playing the same board. The challenge automatically tracks
skill without any dynamic difficulty adjustment, and it does so honestly.

This is a large, underappreciated structural advantage. It means:

- We do not need difficulty settings.
- We do not need dynamic difficulty adjustment (which is always slightly dishonest).
- Our difficulty curve can be a simple monotone increase in board size, because the *effective*
  difficulty is board size divided by the player's memory capacity, and that ratio is
  self-normalising.

§43 uses this: the pressure curve is pure board growth, and it is honest.

### 20.5 The anxiety failure mode specific to memory games

Flow's anxiety pole is a real risk for us in a way it is not for other cascade games: **being asked
to remember more than you can hold is unpleasant in a specific, tiring way.** A player at the edge
of their capacity is not exhilarated, they are strained.

Mitigations, all of which are in the design:
- Suits on tile backs give a *partial* memory aid that reduces raw load without removing the game.
- The pop and ripple remove tiles the player has not memorised, which *reduces* load as a reward
  for playing well — a beautiful property that no other game in the survey has.
- No timer.

That second point deserves emphasis because it is the design's most elegant self-balancing loop:
**playing well makes the board smaller, which makes remembering easier, which makes playing well
easier.** The rich get richer, which is exactly the ascent §12 wants.

---

## §21. Near-miss, and where the line is

### 21.1 The finding

Outcomes that fall just short of a win activate reward circuitry similarly to wins, and increase
persistence, despite being losses. **(robust for gambling contexts)**

### 21.2 The distinction that matters

There are two things called near-miss and only one is manipulative:

**Manufactured near-miss:** the system *arranges* outcomes to appear close when they are not
mechanically close. A slot machine's reels are weighted so jackpot symbols appear just above and
below the payline far more often than chance would produce. The near-miss is a lie about the
structure of the game.

**Emergent near-miss:** the system's honest mechanics sometimes produce outcomes that fall just
short, and the player can see exactly why. A Peggle ball that rims out of the bucket did that
because of physics.

Emergent near-miss is not manipulation; it is *narrative*. It gives the player a specific,
actionable story ("if I had held that pair one more turn") and that story is the material of
improvement.

### 21.3 Our rules

1. **We do not bias generation toward near-misses.** Board generation is seeded and blind to
   outcomes.
2. **We do not render a small outcome as if it were large.** §16.3.
3. **We do make honest near-misses legible.** If a break stopped one pair short of the drop
   threshold, or the chain ended one match short of Sharp, the player should be able to see that,
   because it is true and it is instructive. §46 specifies a quiet, factual presentation for this —
   a dimmed marker on the pair that would have gone, not a flashing "SO CLOSE!".

The difference between those two presentations is the entire ethical content of this section.

---

## §22. Zeigarnik, endowment, and the sunk-cost machinery

Four related effects that games use, with our position on each.

### 22.1 The Zeigarnik effect

Interrupted tasks are recalled better than completed ones, and produce intrusive returning
thoughts. **(contested — the original finding has a mixed replication record, though the weaker
claim that incomplete goals remain cognitively active is better supported)**

Games use this as: leave the player mid-progress when they stop. A partially filled bar, a quest at
step three of five.

**Our position:** we use the *within-session* version and refuse the *between-session* version.
Within a floor, the chain meter is an incomplete phrase and that is good — it is the same tension
as an unresolved musical cadence (§4.5). Between sessions, we do **not** leave anything hanging:
a run ends cleanly, and the game does not hold anything of the player's hostage to their return.
No "your crop will wither", no "your streak will break".

The distinction: within-session incompleteness is the game being interesting. Between-session
incompleteness is the game manufacturing anxiety in someone who is not playing it.

### 22.2 The endowment effect and the IKEA effect

People value things they own, and things they made, above their objective worth. **(robust for
endowment; (robust) for IKEA effect in its original consumer-assembly form, with generalisation
(contested))**

Games use this as: give the player a collection, a base, a deck, a character they built.

**Our position:** we deliberately have almost nothing to own. This is a real cost — it removes a
strong retention mechanism — and it is a deliberate choice, because everything ownable is a second
system with a rulebook (§14.2), and because ownership converts into sunk cost (§22.3).

The one thing the player owns is their **record**, and §55 argues that a record is the honest form
of ownership: it cannot be bought, it cannot be lost, and it is a true statement about them.

### 22.3 Sunk cost

People continue investing in proportion to what they have already invested, independent of expected
value. **(robust)**

Games use this as: long progression bars, collections at 87%, characters at level 46.

**Our position: we do not build sunk cost.** Concretely:
- No account-level progression bar.
- No collection with a completion percentage.
- No unlock tree.
- Nothing that would be *destroyed* or *wasted* by not playing.

The test: **if a player stopped playing forever today, would the game have made them feel they lost
something?** If yes, we have built sunk cost. The answer should be no.

### 22.4 Loss aversion

Losses loom larger than equivalent gains. **(robust)**

Games use this as: streaks that break, timers that expire, resources that decay.

**Our position:** no decay, no expiry, no streak that can break. Within a floor, the chain drops on
a mismatch, which is a loss — but it is a loss *inside the game's own fiction of momentum*, it is
immediately recoverable, and it is the direct consequence of the player's action. That is a
mechanic. A streak counter that resets because you did not open the app on Tuesday is not.

---

## §23. What memory actually affords, and what it costs

This section is the design's technical foundation, because the input device is a memory task and
we should be precise about what kind of task it is.

### 23.1 The task, formally

The player is performing **cued recall of paired associates in a spatial array**, with:
- Encoding that is incidental (you see a tile because you flipped it, not because you were told to
  study it),
- Retrieval that is self-initiated and self-paced,
- Immediate feedback on every retrieval attempt,
- A test-enhanced-learning structure: every attempt is itself a study trial.

That last property is significant. **Retrieval practice produces better retention than restudy**
**(robust — the testing effect is among the more replicable findings in the field)**, and our game
is nothing but retrieval practice. This is why a memory game gets easier within a floor faster than
naive expectation suggests: every flip both tests and strengthens.

### 23.2 The capacity constraint

Working memory capacity for arbitrary items is small — the classic figure is around seven items,
more recent estimates around four chunks. **(robust that it is small; the exact figure is
(contested))**

Our boards run from two to nineteen pairs, i.e. four to thirty-eight tiles. That is well beyond
working memory for the larger boards, which means players are necessarily using:
- **Spatial memory**, which has larger capacity and is more durable,
- **Chunking**, grouping tiles into remembered regions,
- **Partial knowledge**, remembering "there is a triangle somewhere in the top-left".

This has a direct design consequence that we have already exploited without naming it: **suits
create chunks.** A board dealt in suit clumps lets a player remember "the moss region is the left
third" as one item instead of eight. Clumped dealing is not just a legibility feature, it is a
working-memory multiplier, and the measured clumping (0.69–0.75 same-suit neighbour rate against
0.46–0.51 shuffled) is doing real cognitive work.

### 23.3 Interference, and why board size hurts superlinearly

Recall of paired associates degrades with the number of competing associations. **(robust)** Two
tiles with similar symbols interfere; a symbol seen in two places interferes with itself.

This means difficulty from board size is worse than linear: a twenty-pair board is more than twice
as hard as a ten-pair board. §43's pressure curve should therefore grow board size **sub-linearly**
in floor number, or the curve will outrun the player abruptly. Our current growth is roughly linear
in level (`level + 1` pairs, clamped), which by this argument is already slightly too aggressive at
depth and is worth measuring. *(open question, Appendix E.)*

### 23.4 What memory gives us that no other input does

Four things, and I want to state them plainly because they are the answer to "why a memory game at
all":

**(a) Every action is a commitment under self-imposed uncertainty.** In Tetris you know exactly
what your piece is. In Bejeweled you know exactly what your swap does. In ours, you *believe* you
know where the partner is, and the half-second between committing and seeing is a genuine emotional
beat that no other puzzle input produces. §17.2 notes no game in the survey has this.

**(b) Difficulty self-normalises to the player.** §20.4.

**(c) The board's information is fully public and the uncertainty is entirely internal.** This is
the property that puts us in the skill column of §9.3 with no hidden randomness at all.

**(d) Success is legibly *yours*.** A big cascade in Bejeweled might have been luck. A big cascade
in ours required you to have remembered where a specific tile was. Attribution is clean, and clean
attribution is what makes a reward feel earned (§18.3).

### 23.5 What memory costs us

**(a) It is tiring in a way that dexterity is not.** Sustained recall effort produces fatigue faster
than sustained motor effort at comparable engagement. *(mechanism / (contested) as a quantitative
claim)* This argues for short floors and against long sessions, and it means our session-shape
target (§53) should be honest about a natural stopping point rather than fighting it.

**(b) Failure feels like a personal deficiency.** "I forgot" lands differently from "I mistimed".
This is the single strongest argument for our no-timer, no-hard-fail stance: adding time pressure
to a memory task converts a pleasant challenge into an unpleasant one very quickly.

**(c) It excludes, at the margins.** Players with memory impairments are excluded from the core
verb in a way that a dexterity game does not exclude them. §48 discusses what, if anything, can be
done here without dismantling the game.

---

## §24. Session shape, and what the research actually supports

### 24.1 What we can say with confidence

Very little of the "optimal session length" folklore is well founded. What is reasonably supported:

- **People stop when they hit a natural boundary**, and games with clear boundaries produce
  cleaner, more satisfied stopping than games without. *(mechanism, supported by the design
  literature rather than by controlled study)*
- **Interruption at a boundary is remembered more positively than interruption mid-task.** This is
  a fairly direct consequence of the peak-end structure of experienced-utility judgements.
  **(peak-end rule: robust)**
- **The end of an experience disproportionately determines its remembered quality.** **(robust)**

### 24.2 The peak-end implication, which is the actionable one

If remembered quality is dominated by the peak and the end, then:

**(a) We must guarantee a peak.** Every session should contain at least one moment of spectacle. A
session with no Fever, no big ripple, no drop, is a session with no peak, and it will be remembered
as flat regardless of how competent it was. §51 makes "the player sees at least one large break in
their first three floors" a first-session guarantee, and §53 generalises it.

**(b) We must control the end.** Most sessions end with the player losing or quitting mid-floor —
the worst possible ending. Two mitigations:
- The **floor-clear beat** should be a genuine small ceremony, so that quitting after a floor clear
  is a good ending. (This is why the game should make floor clear the obvious stopping point.)
- The **run-end screen** should lead with the best thing that happened, not with the failure.
  Currently it leads with the summary. §42.

### 24.3 The one thing we should measure and do not

**Whether players return.** The market survey's most striking finding was that almost nobody in
this segment publishes or apparently measures repeat-play by the same player on the same content.
We have run history (Gen 63) and per-mode records (Gen 71), which means we *can* measure whether a
returning player is better than they were, on the same seed. Nobody in the reference set does this.
It is both a design instrument and, potentially, a feature — §56.

---

## §25. The line: what we will not build

This section is normative. It is the list of techniques that would probably increase engagement
metrics and that we are choosing not to use. It exists so that the choice is made once, in
advance, rather than repeatedly under pressure.

### 25.1 The list

1. **No energy, lives, or stamina.** No gate between wanting to play and playing.
2. **No timers that punish absence.** No decay, no withering, no expiring rewards.
3. **No streaks that break.** A record of consecutive days is fine as an observation; a *penalty*
   for breaking it is not.
4. **No loot boxes, gacha, or randomised purchasable rewards.**
5. **No purchasable advantage.** Nothing bought changes a board, a score, or a run.
6. **No manufactured near-misses.** §21.
7. **No losses disguised as wins.** §16.
8. **No hidden randomness inside a floor.** §19.3.
9. **No dark-pattern notifications.** Nothing designed to induce guilt or FOMO. If we notify at
   all, it is factual and rare.
10. **No social comparison against strangers by default.** Leaderboards, if any, are opt-in and
    are not the primary progression signal.
11. **No progress bar we do not intend the player to finish.**
12. **No difficulty tuned against a payment funnel.** There is no funnel.
13. **No dynamic difficulty adjustment that the player is not told about.** §20.4 makes it
    unnecessary; honesty makes it unacceptable.
14. **No sunk-cost inventory.** §22.3.
15. **No cognitive-benefit claims.** We will not market this as brain training, memory improvement,
    or dementia prevention. The evidence for transfer from trained tasks to general cognition is
    weak **(contested at best, and largely negative for commercial brain-training)**, and the claim
    is both dishonest and, in some jurisdictions, regulated. This is already a standing task in the
    repository and it applies to store copy, in-game copy, and any future marketing.

### 25.2 The test to apply to anything new

Before adding any system, answer three questions in writing:

1. **Does it survive the §1.2 filter?** Is it downstream of "flip two tiles"?
2. **Which measured band does it move, and by how much?** If it moves none, it is decoration.
3. **If we deleted the flourish and kept only the mechanic, would the mechanic still be worth
   having?** (§16.5.) If not, it is manipulation.

A system that fails any of the three does not ship. The dungeon layer would have failed all three,
and the reason it shipped is that these questions were not asked in this order.

---

# Part IV — The Synthesis

---

## §26. The thesis in one page

*If you read nothing else in this document, read this section. Everything before it is evidence and
everything after it is detail.*

### The game

A grid of face-down tiles. Each tile's back shows a **suit** — one of up to four, each with a
colour and a rune. Suits are dealt in **clumps**, so the board opens as two or three visible
regions. Each tile's face shows a **symbol**; every symbol appears exactly twice.

You flip two tiles.

**If they do not match**, they turn back over, and your chain drops to nothing.

**If they match**, they leave the board — and so does every same-suit tile within two steps of
them. That is the **pop**, and it happens on every match, always, with no chain required.

Every pair the pop takes leaves *both* its halves, wherever they are. If your chain is at **Clean**
or better, a pair goes even when only one half was inside the blast, so the pop reaches partners
across the board. If your chain is at **Sharp** or better, each of those departing partners becomes
the seed of a new blast in its own region, and the reaction runs until a wave takes nothing. That
is the **ripple**. If a suit is left with pairs that nothing can ever pop again, they fall on their
own: the **drop**.

At **Fever**, the top of the ladder, the blast also takes its **halo** — every tile bordering it,
whatever its suit — and the screen stops to show you.

Clear the board. The next floor is bigger. Your chain resets. Go again.

That is the entire rule set. Seven sentences.

### The strategy

Because the blast is bigger at higher chain tiers, and because your chain climbs on consecutive
correct matches, **the pair you remember is worth more later than it is now**. The whole strategic
game is deciding when to spend what you know.

A pair matched at chain one takes about 1.2 pairs with it. The same pair matched at Fever takes
about 3.7, plus its halo, plus whatever the ripple reaches. Holding a known pair while you climb on
others is the equivalent of Tetris's well: a deliberate, reversible, legible increase in risk for a
disproportionate payoff.

### Why it is new

No game combines a memory input with a cascade output. The reason that combination is special is
that it puts the *uncertainty inside the player* rather than inside the game: the board is fully
public and fully determined, nothing enters it mid-floor, and every surprise the player experiences
is a surprise about their own knowledge. Every other cascade game manufactures its surprise with
hidden randomness. Ours does not need to.

### What it is not

It is not a dungeon crawler. There are no keys, locks, levers, doors, shops, rooms, traps, decoys,
bosses, or exits. There are no modes. There is no currency. There is nothing to buy, nothing to
unlock, nothing that decays, and nothing you can lose by not playing.

There is one board, one loop, and one number that goes up.

---

## §27. The loop, beat by beat

This is the normative sequence for a single turn. Timings are specified in §45; this section is
about *order and meaning*.

### 27.1 The full sequence

**Beat 0 — Read (indefinite, player-paced).**
The player looks at the board. Available information: every tile's suit (on its back), every
matched tile's absence, and everything they remember from previous flips. This is where the
strategic decision of §30 lives.

**Beat 1 — Commit (one input).**
The player selects the first tile. It flips. Its symbol is revealed.

*This is the emotional centre of the game and currently the least-served beat.* The player has just
committed to a belief. §46 argues this moment deserves its own audio and its own visual weight.

**Beat 2 — The gap (150–400ms).**
The player selects the second tile. Between the input and the reveal is the shortest interval in
the game with the highest emotional density: the player knows what they believe and does not yet
know if they were right.

**Beat 3 — Resolution (immediate).**
Match or mismatch. Unambiguous, instant, distinct.

**Beat 4a — Mismatch.**
The chain drops to zero. The tiles turn back. The player has *learned two tile positions*, which is
the compensation, and the game should acknowledge it as such rather than as pure punishment
(§46.5). No life is lost; no time is taken.

**Beat 4b — Match: the pop (one wave).**
The matched pair leaves. Every same-suit tile within `BOUNDED_BREAK_REACH` steps leaves with it,
subject to the contact rule at chain zero (both halves must be inside) or the partner rule at Clean
and above (either half suffices).

**Beat 5 — The ripple (zero or more further waves, Sharp and above).**
Each partner pulled from outside the region seeds the next wave in its own neighbourhood. Repeat
until a wave takes nothing. Each wave is a separate, visible, audible step, ascending in pitch.

**Beat 6 — The halo (Fever only).**
The first wave's region also takes every bordering hidden tile whatever its suit.

**Beat 7 — The drop.**
Any suit left with no possibility of ever popping again gives up its remaining pairs. (§37
restructures this from a threshold to a severance.)

**Beat 8 — The tally.**
Score floats from each broken pair, accumulates, and lands in the total. The chain meter advances
by the match plus the momentum the break earned. If the advance crosses a rung, the rung is
announced.

**Beat 9 — The board settles.**
Deferred removal completes (§4.7.4): the tiles that left are gone, and the board the player is now
reading is stable.

**Beat 10 — Floor check.**
If pairs remain, return to Beat 0. If not, the floor clears (§41).

### 27.2 The invariants

Four properties must hold at every beat, and they are the acceptance criteria for any change to the
loop:

**(I1) The player is never waiting with nothing to look at.** Every beat has visible motion.

**(I2) The board never changes under the player's reading.** All mutation happens between Beat 4
and Beat 9, and Beat 0 always begins from a settled board.

**(I3) Every consequence is attributable.** At any point the player can answer "why did that
happen?" from what is on screen.

**(I4) Nothing is hidden that the player could have known.** No mid-floor randomness, ever.

---

## §28. Why memory is the right input for a cascade

This is the argument the whole project rests on, so it gets its own section.

### 28.1 The problem every cascade game has

A cascade needs uncertainty, or there is no prediction error and no joy (§18). But it also needs
*attributability*, or the player cannot feel they earned it.

These pull against each other, and every game in Part II makes a trade:

- **Bejeweled** takes uncertainty from a random refill. Maximum surprise, minimum attribution. The
  player enjoys it and cannot improve at it.
- **Tetris Attack and Puyo** take uncertainty from the player's inability to compute a complex
  deterministic system fast enough. Good attribution, but the uncertainty *shrinks with skill*: an
  expert Puyo player is not surprised by their own chains, which is why the top-level game becomes
  about execution speed rather than discovery.
- **Puzzle Bobble** takes it from board structure the player has not fully parsed. Good on both
  axes, but the board is small and fully visible, so it also shrinks with skill.
- **Peggle** takes it from physics chaos. Enormous surprise, but attribution is poor — the player
  cannot claim credit for a lucky bounce.

### 28.2 What memory does differently

Our uncertainty comes from **the gap between the information the game has shown the player and the
information the player currently holds**.

That gap has four properties no other source has:

**(a) It is created by the player's own play**, not by the designer. We do not hide anything. The
player has seen every tile they have flipped.

**(b) It shrinks *within* a floor and resets *between* floors.** So the surprise is renewable
without the game ever cheating. Puyo's uncertainty shrinks permanently with skill; ours resets
every ninety seconds.

**(c) It shrinks in proportion to effort**, which means the reward for careful play is *literally*
better prediction, and better prediction is what §30's strategy requires. Skill directly buys the
strategic layer.

**(d) It is perfectly attributable in both directions.** A big cascade happened because you
remembered a tile; a small one because you did not. There is no third explanation. This is cleaner
attribution than any game in the survey.

### 28.3 The consequence: we can be more generous than any comparable game

Because our uncertainty is free and renewable, we do not need to ration our payoffs to preserve
surprise. Bejeweled must keep cascades relatively rare or the refill randomness becomes obvious.
Puyo must keep chains hard or experts trivialise it.

We can let a match pop on nearly every turn — measured, 63%–100% by floor — and *still* have
surprise, because the surprise is not "did something happen" but "how far did it reach", and that
depends on tiles the player has not memorised.

This is why the design can afford the extraordinary generosity of §35: **every match pops, always,
with no chain required.** No other game in the survey gives its payoff mechanic away on turn one.
We can, because our scarcity is elsewhere.

### 28.4 The risk this creates, named

If every match pops, the pop stops being an event. The mitigation is the ladder: the pop is
guaranteed but its *magnitude* is earned, and the magnitude range must therefore be wide. A
guaranteed event with a 3× range is fine; a guaranteed event with a 1.2× range is wallpaper.

This is precisely why the Gen 168 finding mattered so much and why §40's scoring curve must be
steeper than it is. **The ladder's spread is the design's load-bearing number**, and it is banded
accordingly (§57).

---

## §29. The board as a legible field

### 29.1 What the player must be able to see without flipping anything

1. **Where each suit is.** Suit is on the tile back, dealt in clumps.
2. **How big each suit's region is.** By eye, from the clump.
3. **Which regions are adjacent**, because a Fever halo crosses suit boundaries.
4. **How many pairs remain.** A count, and the visible board.
5. **What tier they are at, and what the next tier gives.** The chain meter.
6. **What a match here would take, roughly.** This is the aim guide (Gen 127) and it is the single
   most important readability feature we have.

### 29.2 The aim guide is the design's Peggle trajectory line

In Peggle, the player can see the launch angle. In Puzzle Bobble, the bounce line. Both games give
the player a *preview of the first consequence* while leaving the rest chaotic — which is exactly
the §18.2 structure.

Our equivalent: when the player hovers or focuses a tile, the board should show which same-suit
tiles are within reach of a match there, at the player's current tier. Not the ripple — the ripple
is the unpredictable part and previewing it would destroy the design — just the first wave.

This is already built in embryo. §49 and §61 make it a first-class, always-available, hover-free
affordance on touch devices.

### 29.3 The screenshot test

§15.3: a single frame of the game must teach the game. The target frame:

- Two or three suit-coloured regions, visibly clumped.
- Two tiles face up, symbols matching.
- A blast in progress taking six or eight tiles.
- One number rising.

If a screenshot of our game does not contain those four things, the game is not presenting itself.
§49 makes this a review criterion for every UI change.

---

## §30. The chain as the only progression axis, and the hold decision

This section specifies the strategic layer, which is currently the largest gap between what the
design is capable of and what the player can see.

### 30.1 The decision, stated exactly

At any moment, a player who knows the location of a pair faces:

- **Spend now:** match it. Take `f(current tier)` pairs. Chain advances by one match plus the
  break's momentum.
- **Hold:** match something else — possibly a pair found by exploration, at the risk of a mismatch
  — and match the known pair later at a higher tier for `f(higher tier)` pairs.

With the measured ladder (1.18 / 2.32 / 2.71 / 3.71), holding a pair from chain zero to Sharp
roughly *doubles* what it takes. From zero to Fever, roughly triples it.

### 30.2 Why the player cannot currently see this

Nothing in the interface expresses `f(tier)`. The chain meter shows momentum against the next rung,
which tells the player *where they are* but not *what it is worth*. A new player has no way to
discover that holding is a strategy except by accident.

This is a serious omission: **the game's central strategic decision is invisible.**

### 30.3 The fix, specified

Three changes, in increasing order of ambition:

**(a) Tier value in the meter.** The chain meter should carry, at each rung, the *typical pairs a
break takes at that rung* — not as a number but as a visual weight (a small cluster of pips whose
count grows). The player learns "Sharp takes about this many" by seeing it every floor.

**(b) The aim guide is tier-aware.** §29.2's preview should show what a match on this tile takes
*at the current tier*, and — the important part — a ghosted overlay of what it would take *at the
next tier*. The player sees the delta directly, on the board, on the pair they are considering.

**(c) A held-pair marker.** The player can mark a pair they know and intend to save. The marker is
purely a memory aid — it changes no rules — but it makes the strategy *nameable*, and nameable
strategies are what §8.3 says produce a shared vocabulary. *(Candidate; risk is that it becomes a
crutch that replaces memory. §63 discusses. My view: mark the pair, not the symbol, and cap the
number of markers at one or two, so it is a commitment rather than a notebook.)*

**Found building Phase 3 (Gen 188): the marker collides with the pin, and the collision is
structural.** The game already ships a memory marker - the **pin**: up to three hidden tiles
(`MAX_PINNED_TILES`), toggled from the dock, changing no rules, with a contract vow that caps how
many a run may place. That is (c)'s job description almost word for word, minus the one thing that
matters: a pin marks a *tile*, and the hold decision's unit is a *pair*.

The gap cannot be closed by making the game smarter, because the game deliberately does not know
what the player has seen. There is no seen-set in `RunState` - that absence *is* the memory game -
so nothing can infer that a player knows a pair. The claim has to be a two-tile gesture the player
makes, which is exactly the gesture the pin already owns. Two controls that both mark tiles on the
same board is the duplication §105 was written to remove.

Two further constraints on any answer:

- **The marker must never validate.** If marking two tiles told the player whether they match, it
  would be a free match test - no turn spent, no mismatch, strictly better than flipping. The mark
  is a claim the player makes and may be wrong about; they find out by flipping, as now.
- **T3.6 rides on it, and only on it.** A pair's span is a fact about the hidden symbol layout, so
  putting it on an unmarked tile hands back part of the memory game (the finding recorded at G.3).
  On a *marked* pair it is safe by construction: it restates the distance between two tiles the
  player themselves chose, and if the claim is wrong the span shown is the span of the pair they
  think they have, which is what they are deciding about.

Three ways out, and the choice belongs to the product rather than to an interface generation:

1. **Extend the pin into a pair link.** Pins stay three tiles and a note; two of them can be linked
   into one held pair, capped at one, carrying the badge and the span. One new verb on an existing
   control; the vow keeps counting pins placed. *Recommended:* no second control, the cap makes it a
   commitment as (c) asks, and T3.6 comes free.
2. **Replace the pin with the held pair.** One pair, no tile notes. Cleanest interface, but it
   removes shipped content and rewrites the Pin vow, its Codex entry and its contract cap.
3. **Leave the pin alone and build nothing.** (c) is a candidate, and E.6's question - whether the
   marker does the remembering for the player - cannot be settled here: it needs players, not a
   simulation, because a memory aid's effect on human memory is not a thing the reference player
   models.

### 30.4 Why this is the highest-value unbuilt feature

Per §17.2, our 10-second cell — "a chain built, held, and detonated" — is the strategic heart and
is not legible. Making it legible converts the game from *a sequence of pleasant matches* into *a
game with a plan*, and it does so without adding a single rule: the mechanic already exists and
already works. This is pure interface work on top of shipped mechanics, which makes it both the
highest-value and the cheapest item in Part X.

---

## §31. What replaces the dungeon

Removing eleven card kinds, six hazard tiles, four bosses, eight objectives, eleven archetypes and
four modes leaves gaps. This section says what fills each one, and in several cases the answer is
"nothing, and that is the point".

### 31.1 The gaps and their answers

| What the dungeon provided | What replaces it |
|---|---|
| **A reason the floor ends** (find and activate the exit) | The floor ends when the board is clear. §41. |
| **A floor objective** (eight kinds) | The objective is always the same: clear the board, as spectacularly as possible. Explicit par score per floor. §41. |
| **Variety between floors** (eleven archetypes) | Board geometry, size, and suit layout. §32, §33. |
| **A reason to care about a specific tile** (treasure, key) | Board structure: the biggest clump, the pair whose partner is far, the suit down to its last pairs. §40. |
| **Risk** (traps, enemies, hazards) | The mismatch, which costs the chain — the only currency that matters. §34. |
| **A between-floor decision** (routes, shops, rooms) | None. This is deliberate. §14.2. |
| **A run structure** (bosses, acts) | The pressure curve and the personal best. §42, §43. |
| **Score sources** (treasure, boss defeat, objectives) | Matches and breaks, on a multiplicative curve. §40. |
| **Economy** (gold, shop) | None. §63. |
| **Four other modes** | One mode. §63. |

### 31.2 The two answers that are load-bearing

**"The floor ends when the board is clear."** This is the change with the widest blast radius in the
codebase, and it is also a strict improvement in loop terms: the exit was a *second win condition*
that competed with the first. A player who had cleared every pair still had to go find a tile. That
is a stop at the exact moment the player has finished doing the thing the game is about.

There is one thing the exit provided that clearing does not: **the option to leave early.** A player
who was doing badly could take the exit and cut their losses. §41 addresses this: the floor-clear
bonus scales with how few turns it took, so a bad floor is self-limiting without needing an escape
hatch.

**"None, and that is deliberate."** The between-floor decision is the hardest gap to leave empty,
because designers instinctively fill it. §14.2's finding is the defence: a choice without
information is not a choice. If we ever add one back, it must be informed and consequential, and
once per run rather than once per floor. §44 sketches the one candidate.

### 31.3 What we keep from the removed layer

Three things survive the removal, because they are downstream of the flip:

1. **Suits and clumped dealing.** Not dungeon content; core.
2. **Tile traits** (echo, mirror, cursed, sealed, heavy, drift, conduit, stasis) — *partially*. Some
   are properties of a tile that change what a match does, which passes the §1.2 filter. Others are
   miniature rulebooks. §32.4 triages them individually rather than keeping or cutting the family
   wholesale.
3. **The findable pickups** — *no*. These are dungeon-adjacent rewards; their function is absorbed
   into score. Cut.

### 31.4 The size of the win

Removing the layer recovers, per floor:

- **Every pair.** A level-8 floor goes from roughly five to seven breakable pairs to ten.
- **Every tile back.** No dungeon card art competing with the suit marking, which is the one thing
  a tile back must communicate.
- **The whole HUD strip** that showed keys, objectives, and dungeon status.
- **The rulebook.** From roughly seventy player-facing concepts to seven.

And it removes, from the codebase: thirty modules, their tests, their Codex entries, their copy,
their save migrations, and the four passes of special-case protection in the card trimmer.

---

# Part V — The Specification

> This part is **normative**. Where it disagrees with the code, the code is wrong or this document
> is out of date, and either way somebody should reconcile them. Every constant named here should
> exist in the codebase under the name given, with a comment pointing back to this section.
>
> Sections are marked **[SHIPPED]** where the rule is implemented as described, **[CHANGE]** where
> this document specifies something different from what is implemented, and **[NEW]** where it
> specifies something that does not exist yet.

---

## §32. Board generation

### 32.1 The board [CHANGE]

A board is a rectangular grid of tiles. Every tile belongs to exactly one **pair**; both halves of
a pair share a symbol and a suit and are placed independently.

| Property | Value | Status |
|---|---|---|
| Pairs on floor *n* | See §32.2 | [CHANGE] |
| Grid dimensions | Smallest rectangle fitting `2 × pairs`, favouring the display's aspect | [SHIPPED] |
| Tiles that are not part of a pair | **None** | [CHANGE] |
| Content entering the board mid-floor | **None, ever** | [SHIPPED] |
| Dungeon cards, hazard tiles, exits, shops, rooms | **None** | [CHANGE] |

The third and fifth rows are the removal. After it, `2 × pairs === tiles.length` is an invariant
that can be asserted, and §57 asserts it.

### 32.2 The pair-count curve [CHANGE]

Current: `pairs = clamp(level + 1 + delta, 2, 19)`, where `delta` came from the dungeon encounter
context. With the dungeon gone, `delta` is zero and the curve is linear in level.

§23.3 argues linear growth is too aggressive because interference makes memory difficulty
superlinear in board size. The specified curve is **square-root-tempered growth**:

```
PAIRS_BASE       = 3
PAIRS_GROWTH     = 2.6
PAIRS_MAX        = 24
pairsForFloor(n) = clamp(round(PAIRS_BASE + PAIRS_GROWTH * sqrt(n - 1)), 2, PAIRS_MAX)
```

Which gives:

| Floor | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 15 | 20 | 30 | 50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pairs (new) | 3 | 6 | 7 | 8 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 17 | 21 |
| Pairs (current) | 2 | 3 | 4 | 5 | 6 | 7 | 9 | 11 | 13 | 16 | 21 | 24 | 24 |

The new curve starts **larger** (three pairs rather than two on floor one, six rather than three on
floor two) and grows **slower** at depth. Both changes are deliberate:

- **Larger early:** a two-pair board cannot pop at all and a three-pair board barely can. The
  first floors must demonstrate the loop (§51), and they cannot do so with two pairs. This is the
  single most important consequence of removing the dungeon: floor one can now be a *real board*
  because nothing else is competing for its tiles.
- **Slower deep:** interference (§23.3). A twenty-four-pair board is forty-eight tiles, which is
  past the point where the game is fun rather than gruelling for most players, and the current
  curve reaches it at floor thirty.

*Open question (Appendix E): whether the curve should flatten completely at some depth and let
difficulty come from elsewhere. See §43.*

### 32.3 Symbol assignment [SHIPPED]

Symbols are drawn from a fixed alphabet, one per pair, without repetition within a floor. Symbols
must be distinguishable at the smallest rendered tile size and must not rely on colour.

### 32.4 Tile traits — triage [CHANGE]

The trait family survives, but not wholesale. Each trait is judged against the §1.2 filter.

| Trait | What it does | Verdict |
|---|---|---|
| `echo` | Matching it briefly reveals another tile | **Keep.** Downstream of the flip; pays the player in the game's own currency (information). |
| `mirror` | Its symbol appears identical to another tile's | **Cut.** This makes the board *lie*, which is anti-memory: the player's correct recall produces a mismatch. §21 forbids manufactured near-misses and this is one. |
| `cursed` | Scores less if matched at the wrong time | **Cut.** A rule you must read, punishing a correct action. |
| `sealed` | Cannot be matched until something else happens | **Cut.** A stop. |
| `heavy` | Slower to flip back | **Keep, demoted.** This is a feel property, not a rule; fold it into presentation. |
| `volatile` | Changes position | **Cut.** Board must not change under the player's reading (I2). |
| `drift` | Moves slowly over time | **Cut.** Same. |
| `conduit` | Extends the break's reach | **Keep.** Directly downstream, amplifies the core mechanic, legible on the tile back. |
| `stasis` | Locks a tile face-up | **Keep, reframed.** As a *gift* — a tile that stays revealed — rather than a lock. Pure information, no rulebook. |

Four kept (`echo`, `heavy`, `conduit`, `stasis`), five cut. The kept four share a property: each
either **gives the player information** or **amplifies the break**. Neither requires a sentence of
explanation, because both are visible in what happens.

### 32.5 Determinism [SHIPPED]

A board is a pure function of `(runSeed, rulesVersion, floor)`. This is already true and is the
precondition for §55's shareable boards and for every simulation in Part IX.

---

## §33. Suits and clumps

### 33.1 The suits [SHIPPED]

Four suits, each with a colour and a rune, because colour alone is not a channel this game trusts:

| Suit | Rune | Hue | Character |
|---|---|---|---|
| Ember | ▲ | `#e0713c` | Warm; usually the largest clump |
| Tide | ≈ | `#3f9fd8` | Cool and long; runs in lines |
| Moss | ✿ | `#6fb64a` | Patient; sits in corners |
| Bone | ◆ | `#d8cfb4` | Pale and scattered; breaks the others up |

### 33.2 How many suits a floor deals [SHIPPED, Gen 168]

```
SUIT_TARGET_PAIRS       = 6
MIN_PAIRS_FOR_TWO_SUITS = 6
suitCountForPairs(p)    = max(p >= MIN_PAIRS_FOR_TWO_SUITS ? 2 : 1,
                              min(4, round(p / SUIT_TARGET_PAIRS)))
```

One suit per six pairs, never below two suits once a board is big enough to carry a map, never
above four.

The reasoning is fully recorded in `tile-suit-rules.ts` and in Gen 168's balance note: at one suit
per two pairs, a suit averaged four and a half pairs of which about half could break, and one
bounded wave swept the lot — which is why the chain ladder's middle rung was worth one hundredth of
a pair. Depth needs somewhere to go.

### 33.3 The clump deal [SHIPPED]

Suits are grown one at a time to completion from seeded starting cells, rather than dealt
round-robin, so each suit forms contiguous regions. Measured clumping: same-suit neighbour rate of
0.66–0.76 against 0.46–0.51 for a shuffle of the same tiles, across eight seeds and levels 8–26.

Suits with three or more pairs are laid as **two clumps seeded apart**, so roughly 30% of a floor's
pairs straddle two islands of their own suit. This is what gives the ripple something to bridge:
a lone match pops the island it is in, and a Clean chain is what reaches the other one.

### 33.4 Deal profiles [CHANGE]

Currently three profiles (`clumped`, `scattered`, `two_suit`) selected by floor archetype. With
archetypes removed, profile selection needs a new source.

Specified: **profile is a function of floor depth and seed, on a fixed rotation**, so that a run
has variety without a rulebook:

```
FLOORS_PER_PROFILE_CYCLE = 5
profile(floor, seed) =
    floor <= 3            -> 'clumped'      // the loop must be legible while it is being learned
    floor % 5 === 0       -> 'two_suit'     // every fifth floor is a big-clump floor
    hash(seed, floor) % 4 === 0 -> 'scattered'
    otherwise             -> 'clumped'
```

A `scattered` floor is harder to read and produces smaller pops; a `two_suit` floor is a
celebration floor with enormous clumps. The rotation is invisible to the player as a *rule* but
visible as *rhythm*, which is what §12's ascent shape wants at the run scale.

---

## §34. The flip and the match

### 34.1 Input [SHIPPED]

Select a tile; it flips face-up. Select a second; it flips. The turn resolves. Selection may be
mouse, touch, keyboard, or gamepad; all four are supported and all four must produce identical
timing.

### 34.2 Resolution [SHIPPED]

| Outcome | Effect |
|---|---|
| Symbols match | The pair leaves. The break runs (§35–§37). Chain advances. |
| Symbols differ | Both tiles turn back. **Chain drops to zero.** |

### 34.3 What a mismatch costs, exactly [CHANGE]

Currently a mismatch costs a life (via the mistake/rating system) *and* the chain.

Specified: **a mismatch costs the chain and nothing else.**

The argument: the chain is the only currency in the game (§30), and it is a real, painful, and
immediately-recoverable cost. Adding a life on top is a second punishment for the same event, and
lives are what create the run-ending failure that §14.2 argues teaches nothing. §42 replaces the
life system entirely.

The rating system — which grades a floor on mistakes — stays, because it is an *observation* rather
than a punishment, and because it never touches the cascade (verified on every floor of every
simulation run, drift zero).

### 34.4 The compensation for a mismatch [NEW]

A mismatch is the game's only negative event and it should be framed as what it actually is: **you
just learned two tile positions.**

Specified: on a mismatch, the two revealed tiles briefly show a "remembered" mark — a subtle
persistent tint on their backs for the next several turns, fading out — indicating *the game knows
you have seen this*. It is not a memory aid strong enough to replace remembering (it does not say
*what* the symbol was), but it converts the beat from pure loss into an acknowledged exchange.

*This is a candidate, not a certainty. Risk: it may reduce the memory challenge more than intended.
§57 specifies the band it must not move (mistake rate must not fall by more than a fifth).*

---

## §35. The pop

### 35.1 The rule [SHIPPED, Gen 168]

Every match pops. There is no chain requirement and no roll.

The pop takes the connected same-suit region around the matched pair, walked through hidden tiles
only, never through a blocked tile, to a depth of `BOUNDED_BREAK_REACH` steps.

```
BOUNDED_BREAK_REACH = 2
breakClumpReach(tier) = (tier === 'sharp' || tier === 'fever') ? Infinity : BOUNDED_BREAK_REACH
```

### 35.2 The contact rule [SHIPPED]

Below Clean, a pair goes only when **both** of its halves are inside the region. At Clean and above,
**either** half suffices, and the pair leaves from wherever both halves are.

```
breakReachesPartners(tier) = tier !== 'none'
```

This single rule is the Clean rung's entire purchase, and it is the mechanic that makes the game a
*memory* cascade rather than a spatial one: at Clean, remembering where a partner is becomes
directly, mechanically valuable.

### 35.3 What the pop may take [CHANGE]

Currently: plain pairs, treasure, findables — never exits, keys, levers, locks, shrines, route
specials or hazards.

Specified, post-removal: **everything on the board**, because everything on the board is a plain
pair. The exclusion list becomes empty, and `tileCanBreakInChunk` collapses to "is a hidden tile
belonging to a whole pair".

This is a large simplification and it is the clearest single benefit of the removal.

### 35.4 Measured behaviour [SHIPPED]

| Floor | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pop rate at chain 1 | 1.00 | 0.96 | 0.78 | 0.65 | 0.63 | 0.89 | 0.69 | 0.70 | 0.80 | 0.82 | 0.83 | 0.72 |

Banded at: floors 1–6 ≥ 0.45, overall ≥ 0.5, no floor below 0.25.

*These numbers are pre-removal. Post-removal they should rise substantially, because every pair on
the board becomes breakable. §57 requires re-baselining after the removal and ratcheting the bands
up to whatever the new floor is.*

---

## §36. The ripple

### 36.1 The rule [SHIPPED, Gen 168]

At Sharp and above, every partner that the pop pulled in from outside the walked region becomes a
seed for the next wave, which walks its own region with the same reach. Repeat until a wave takes
nothing.

```
POP_WAVES              = 1
CLEAN_WAVES            = 1     // the reaction belongs to Sharp
RIPPLE_MAX_WAVES       = 12
TUNING_FORK_EXTRA_WAVES = 1
rippleWaves(tier) = (sharp|fever) ? RIPPLE_MAX_WAVES : (clean ? CLEAN_WAVES : POP_WAVES)
```

A halo pair (Fever, §38.3) is the edge of the celebration and does **not** seed.

### 36.2 Why Clean gets one wave and not two [SHIPPED, Gen 168]

Measured: with Clean at two waves, Sharp was worth one hundredth of a pair more than Clean, because
two waves plus the partner reach swept every breakable pair a suit had. One rung, one thing: Clean
buys the partner reach, Sharp buys the reaction.

### 36.3 Acting inside the window [NEW — the highest-ceiling candidate]

Per §7.3, Tetris Attack's skill chain is the deepest mechanic in the survey and we do not have it.

**Specified as a candidate:**

> While a break's waves are still animating, the player may begin a new flip. If the resulting match
> resolves before the previous break's last wave completes, the chain does **not** reset between
> them and the new break's waves are appended to the same chain, counting toward the same momentum
> and the same announcement.

Properties this must have:

1. **Invisible to a player who does not use it.** No timer, no prompt, no tutorial. A player who
   waits for the board to settle plays exactly the game they play now.
2. **Never punishing.** Missing the window costs nothing. There is no penalty for being slow.
3. **Legible in retrospect.** When it happens, the game says so loudly — this is how a player
   discovers it exists.
4. **Bounded.** The window is the animation, and the animation has a fixed length, so the ceiling
   is finite.

Risks, honestly:
- It converts the top of the skill curve into a dexterity test, which may be off-brand.
- It interacts badly with I2 (board must not change under the player's reading), since the player
  would be flipping on a board mid-mutation. Mitigation: only *already-revealed-and-remembered*
  tiles can be flipped in the window, so the player is acting on knowledge, not on reading.
- It is hard to make accessible.

**Recommendation: prototype it behind a flag, measure whether it changes the ladder's spread, and
ship only if it can be shown to be invisible to a player who ignores it.** §61 sequences it late.

### 36.4 Wave count is the chain's second dimension [CHANGE]

Currently the ripple's payout lift is `1 + 0.2 × (waves − 1)`, capped at 2×. That is nearly linear
and far too shallow against the Puyo/Tetris/Balatro convergence of §13.2.

Specified in §40.

---

## §37. The drop — restructured

### 37.1 The current rule [SHIPPED]

A Sharp or Fever break that leaves the matched suit with `DROP_MAX_PAIRS = 2` or fewer plain pairs
takes them too.

Measured: fires on 0.6% of floors. It came off the "never fires at all" list only at Gen 168.

### 37.2 The problem

It is a threshold on a remnant, which means it fires when a numeric accident occurs. Puzzle Bobble's
equivalent (§5.2) is a **structural property the player can learn to see**: a bubble with no path to
the ceiling falls, and expert play is entirely about creating that condition deliberately.

A threshold cannot be aimed at. A structure can.

### 37.3 The specified rule [CHANGE]

> **A pair drops when its suit can no longer pop.**
>
> A suit can pop if it has at least two whole pairs whose tiles are within reach of each other. When
> a break leaves a suit that fails that test, every remaining pair of that suit drops, at any tier.

Consequences:

- **It is aimable.** A player can look at a suit with three pairs, see that two of them are adjacent
  and one is alone, and know that breaking the adjacent two orphans the third.
- **It fires at every tier**, including chain zero, which makes it a mechanic a new player can
  meet on floor one.
- **It removes a magic number.** `DROP_MAX_PAIRS` disappears; the condition is derived from the pop
  rule itself, which means it cannot drift out of sync with it.
- **It is more generous**, and generosity is affordable per §28.3.

### 37.4 Presentation [CHANGE]

The drop must read as *different* from the break — it is not a blast, it is a collapse. Specified:
the dropped pairs fall (translate downward, accelerate, fade) rather than shatter, with a low tone
distinct from the break's rising scale. §46.

### 37.5 The achievement it unblocks

`ACH_NOTHING_HELD_IT` has been unearnable since it shipped. Under §37.3 it becomes earnable on the
first floor where a suit is severed, which is most of them.

---

## §38. The chain ladder

### 38.1 Momentum [SHIPPED]

The ladder climbs on **momentum**, not the streak alone:

```
momentum = currentStreak + chunkPairsThisChain
```

where `chunkPairsThisChain` accumulates each break's momentum contribution:

```
chunkBreakMomentumPairs(result, relics) =
    (sustained ? popPairs : ceil(popPairs / 2)) + laterWavePairs
```

The pop counts at half, later waves at full. The reason is measured (Gen 145): at full credit for
everything, a player missing a quarter of their turns reached Fever nearly as often as a clean one,
because the pop is guaranteed and therefore not a skill signal. Later waves require Sharp, which
requires a chain, so they are.

A mismatch resets momentum to zero.

### 38.2 The rungs [SHIPPED, Gen 170]

```
CHAIN_TIER_CLEAN_FROM = 3
CHAIN_TIER_SHARP_SHARE = 0.4    CHAIN_TIER_SHARP_MIN = 4
CHAIN_TIER_FEVER_SHARE = 0.5    CHAIN_TIER_FEVER_MIN = 7

rungs(pairs) = {
    clean: 3,
    sharp: max(4, ceil(pairs * 0.4)),
    fever: max(7, sharp + 1, ceil(pairs * 0.5))
}
```

Fever moved from two thirds of a floor to half at Gen 170, because at two thirds the rung arrived
on the last match or two — when the board is nearly empty and a Fever break has nothing to take.

### 38.3 What each rung buys [SHIPPED]

| Rung | From | Buys |
|---|---|---|
| — | 0 | The pop: two steps into the touching clump, pairs whose both halves are inside |
| **Clean** | 3 | The partner reach: a pair goes when either half is in the blast |
| **Sharp** | 40% of the floor (min 4) | The whole clump, and the reaction: waves run until one takes nothing |
| **Fever** | 50% of the floor (min 7) | The halo: every tile bordering the first region, whatever its suit — plus ceremony |

### 38.4 Measured ladder [SHIPPED, Gen 168–170]

| Tier | Pairs per match | Gain over the rung below |
|---|---|---|
| none | 1.18 | — |
| clean | 2.32 | +1.14 |
| sharp | 2.71 | +0.39 |
| fever | 3.71 | +1.00 |

Spread none→fever: **2.53**. Banded at minimum step 0.3 and minimum spread 2.2 by `sim:pop --check`.

Before Gen 168 the same measurement read 1.67 / 1.91 / 1.92 / 3.34, spread 1.66, thinnest rung
0.01.

**This table is the design's vital sign.** If any step approaches zero, a rung has stopped existing
and the game has lost a quarter of its strategic range.

### 38.5 Post-removal re-baselining [NEW]

Every number in §38.4 was measured on boards where the dungeon took most of the pairs. After the
removal, all four values should rise and the spread should widen. §57 requires:

1. Re-measure immediately after the removal lands.
2. Ratchet the bands up to just below the new values.
3. Record the before/after in `BALANCE_NOTES.md`.

If the spread does *not* widen after removing the dungeon, something in this document's central
argument is wrong and it should be revisited before building anything further.

---

## §39. Fever

### 39.1 What Fever is [SHIPPED]

The top rung. A break at Fever takes the whole clump, runs the full reaction, **and** takes the
halo: every hidden tile bordering the first wave's region, whatever its suit.

The halo is the only rule in the game that crosses a suit boundary, and it is what makes Fever feel
like a different mechanic rather than a bigger one. A Fever break does not respect the map.

### 39.2 The halo does not seed [SHIPPED]

A halo pair is the edge of the celebration, not a bridge: it leaves, but it does not start a new
wave. Without this rule a Fever break would chain across suit boundaries indefinitely and take the
entire board every time, which would be spectacular exactly once.

### 39.3 The ceremony [CHANGE]

Per §4.3, the Peggle lesson is that the ceremony must be **disproportionate, interrupting,
identical every time, and earned by the thing the game is about.**

Currently we have hit-stop and slow-motion on a Fever break (Gen 139) and a Fever pulse on the HUD
(Gen 119, Gen 133). That is a flourish, not a ceremony.

Specified:

| Element | Spec |
|---|---|
| **Freeze** | 180ms hard stop at the instant the Fever break resolves, before any tile moves |
| **Zoom** | Camera eases 8% toward the matched pair over 400ms |
| **Desaturation** | Everything except the break's region desaturates to 30% over 250ms |
| **Sound** | The chain's rising scale resolves to its tonic, fortissimo, over a held chord |
| **Word** | `FEVER` in the largest type in the game, 2× any other text, held 900ms |
| **The break** | Runs at 0.6× speed with per-wave delays doubled, so the reaction is *watchable* |
| **Score** | Counts up with an accelerating tick, not an instant jump |
| **Return** | Everything returns to normal over 300ms; input unlocks at the end |
| **Total** | ~2.6s, during which the player does nothing |
| **Variation** | **None.** Identical every single time. |

2.6 seconds is short for a Peggle-scale ceremony and long for a puzzle game; it is chosen because
Fever happens on roughly one floor in four for a good player, which is far more often than Peggle's
once-per-level. A ceremony that happens every fourth floor cannot be eight seconds.

### 39.4 Extreme Fever: the floor-end payout [SHIPPED, needs magnitude work]

Ending a floor while at Fever pays a bonus scaled by what the chain left standing.

Per §4.3(a), the critical property is **disproportion**: the bonus should be worth more than the
floor that earned it. Currently it is a modest addition. §40.5 specifies the magnitude.

### 39.5 Reachability [SHIPPED, Gen 170]

| Player | Floors reaching a Fever break |
|---|---|
| Clean (no mistakes) | 0.27 |
| Reference (15% miss) | 0.119 |
| Sloppy (25% miss) | 0.10 |

Separation clean-over-reference: 2.64, banded at 2.

The 0.119 figure is the one that matters most: it means a typical player sees the game's biggest
moment roughly every eight floors, which is once or twice a session. That is about right — often
enough to be a real part of the game, rare enough to remain an event.

---

## §40. Scoring

### 40.1 The current model and why it is wrong [CHANGE]

Currently:

```
chunkBreakScore(level, pairs, tier, waves) =
    floor((perPair × pairs + sizeBonus) × feverLift × rippleLift(waves))
rippleLift(w) = min(2, 1 + 0.2 × (w - 1))
feverLift     = tier === 'fever' ? 1.5 : 1
```

This is **additive in pairs** with a small multiplier on top. A break of eight pairs scores roughly
eight times a break of one.

Three of the deepest games in the survey independently converge on a steeply superlinear curve
(§6.2 Tetris, §8.2 Puyo, §13.1 Balatro). Our curve is nearly linear, which means:

- Concentration is barely better than accumulation.
- The strategic hold decision of §30 is worth about a 2× score improvement, not a 20× one.
- No score a player ever gets is worth screenshotting.

### 40.2 The specified model [CHANGE]

```
SCORE_PER_PAIR        = base match score × 0.6      (unchanged)
CHAIN_MULT            = { none: 1, clean: 2, sharp: 4, fever: 8 }
WAVE_MULT_STEP        = 0.75
WAVE_MULT_CAP         = 6

waveMult(w)  = min(WAVE_MULT_CAP, 1 + WAVE_MULT_STEP × (w - 1))
breakScore(level, pairs, tier, waves) =
    floor(SCORE_PER_PAIR(level) × pairs × CHAIN_MULT[tier] × waveMult(waves))
```

Worked examples at a nominal `SCORE_PER_PAIR` of 10:

| Break | Pairs | Tier | Waves | Old score | New score |
|---|---|---|---|---|---|
| A chain-one pop | 1 | none | 1 | 10 | 10 |
| A small Clean break | 2 | clean | 1 | 20 | 40 |
| A Sharp reaction | 4 | sharp | 3 | 56 | 400 |
| A big Sharp reaction | 7 | sharp | 5 | 98 | 980 |
| A Fever break | 8 | fever | 4 | 180 | 2,080 |
| A huge Fever reaction | 12 | fever | 7 | 270 | 5,280 |

The range widens from 27× to 528×. That is the Puyo/Balatro shape, and it makes a great break
*worth talking about*.

### 40.3 Why this does not break the mistake economy

The obvious objection: if a Fever break is worth 200× a chain-one pop, then everything except
reaching Fever is worthless, and the game becomes "wait for Fever" — which §8.5 warns against.

Three reasons it holds:

1. **You cannot reach Fever without the small breaks.** Momentum comes from breaks, so the small
   ones are the ladder. They are not competing with the big one; they are the price of it.
2. **The board is finite.** You cannot hoard indefinitely; the floor ends.
3. **Score is not the only feedback.** §55 makes the run's *depth* the headline record, and depth
   is not bought with score.

We should nevertheless measure it: §57 adds a band that the share of a floor's score coming from
its single largest break must sit between 0.25 and 0.7. Below 0.25 the curve is too flat; above 0.7
the small breaks are decoration.

### 40.4 Score presentation [CHANGE]

Per §4.4 and §11.2:

- **Every broken pair floats its own value** from its own position, in its suit's colour.
- **The values converge** on the score total rather than fading in place.
- **The total counts up**, never jumps, with an accelerating tick whose pitch rises.
- **The multiplier is shown as it is applied**: `12 pairs × Fever ×8 × Ripple ×5.5`, built up
  term by term as the break resolves, so the player watches the number being constructed.

That last one is directly from Balatro, where watching `chips × mult` resolve is the single most
satisfying moment in the game, and it is free: the terms already exist.

### 40.5 The floor-end bonus [CHANGE]

```
FLOOR_CLEAR_BASE       = 100 × level
FLOOR_TIER_MULT        = { none: 1, clean: 1.5, sharp: 2.5, fever: 5 }
FLOOR_EFFICIENCY_BONUS = max(0, (parTurns - turnsTaken)) × 50 × level
floorScore = FLOOR_CLEAR_BASE × FLOOR_TIER_MULT[tierAtClear] + FLOOR_EFFICIENCY_BONUS
```

Clearing a floor while at Fever is worth five times clearing it cold. This is the Extreme Fever
disproportion (§4.3a): the ceremony pays more than the floor.

`parTurns` is the floor's stated par (§41.3) and the efficiency bonus is what replaces the removed
exit's "leave early" option (§31.2): a floor that went badly simply pays less, without needing an
escape hatch.

### 40.6 What score is *for* [CHANGE]

Score is **not** the primary progression signal. §55 argues depth is. Score's job is:

1. To be the number that always moves (§11.2).
2. To make a great break legible as great, in the moment.
3. To be screenshottable.

It is deliberately *not* a currency (nothing is bought), not a gate (nothing is unlocked by it),
and not compared against strangers by default (§25.1.10).

---

## §41. The floor: end, clear, and the next one

### 41.1 How a floor ends [CHANGE]

> **A floor ends when the board has no pairs left.**

That is the whole condition. No exit, no objective, no activation.

Note this is *pairs*, not tiles: since every tile belongs to a pair and pairs always leave together,
an empty board and a board with no whole pairs are the same thing. §32.1's invariant makes this
checkable.

### 41.2 The last-pair problem [CHANGE]

Per §4.6 (Peggle's last orange peg), the end of a floor is structurally the worst part: few tiles
remain, the player knows where all of them are, no pop is possible, and they are just clearing up.

Three mitigations, in order of importance:

**(a) The drop.** Under §37.3's severance rule, the last pairs of a suit that can no longer pop
**fall on their own**. In practice this means a floor's final two to four pairs frequently clear
themselves as a consequence of the second-to-last break, and the player never has to grind them
out. *This is the strongest argument for the restructured drop and on its own justifies the change.*

**(b) The last-pair beat.** The final pair of a floor gets its own small ceremony (already shipped,
Gen 119) so the tail is an ending rather than a fade.

**(c) The efficiency bonus.** §40.5 means the tail costs score, so the player has a reason to have
set up (a) rather than to grind.

### 41.3 The par [NEW]

Each floor states a **par**: the number of turns a competent player should need.

```
parTurnsForFloor(pairs) = ceil(pairs × 0.85)
```

A twelve-pair floor pars at ten turns. Because breaks remove pairs the player never matched, a good
player beats par comfortably; a player who is missing will not.

The par's jobs:
1. **A visible goal at every moment** (§20.2), shown as a simple `turns / par` readout.
2. **The efficiency bonus's basis** (§40.5).
3. **The pressure signal** (§43), replacing lives.

It is a *target*, not a gate. Missing par has no consequence beyond a smaller bonus.

### 41.4 The floor-clear beat [CHANGE]

Per §24.2, the floor clear must be a good place to stop, because it is where most sessions will
end.

| Element | Spec |
|---|---|
| The last pair leaves with its own beat | [SHIPPED] |
| The score total resolves and the floor bonus is added, visibly, term by term | [CHANGE] |
| `Floor N cleared — 8 turns, par 10` | [NEW] |
| Best-floor marker if this is a personal best depth | [NEW] |
| **No screen transition.** The next board builds in place. | [CHANGE] |
| Total duration | ~1.6s, then the next floor is playable |

The last row is important. Currently a floor clear goes through a summary screen. That is a stop,
and per §11.2 stops are where players leave. The next board should assemble on the same surface
while the bonus is still counting up, so the player's next input is available before they have
finished reading.

### 41.5 What carries between floors [CHANGE]

| Carried | Reset |
|---|---|
| Score | The chain and its momentum |
| Depth (floor number) | The board |
| The run's records | Everything else |

The chain resetting per floor is what gives each floor the §12 ascent shape. It is not a
punishment; it is the reason the ascent can happen again in ninety seconds.

---

## §42. The run

### 42.1 What a run is [CHANGE]

A sequence of floors of increasing size, played until the player stops or the pressure curve
outpaces them.

### 42.2 How a run ends [CHANGE]

Currently: the player runs out of lives, lost to mistakes.

Specified: **there are no lives.** A run ends in one of two ways:

1. **The player stops.** They close the app or press quit. The run is recorded at the depth
   reached. This is the normal case and it is not a failure.
2. **The floor is not cleared within its turn ceiling.** Each floor has a hard ceiling of
   `parTurns × 3`. Failing to clear within it ends the run.

The second condition exists so a run *can* end, which §11.3 and §14.2 both argue matters — a run
with an ending is a story. But it is deliberately generous: three times par means a player missing
two-thirds of their flips. It is not a difficulty gate; it is a floor under competence.

The critical property is that **the run does not end because you forgot.** It ends because you
could not finish a board at all, which is a much clearer and rarer signal.

### 42.3 What the run-end screen leads with [CHANGE]

Per §24.2(b), the end determines the memory. Currently the screen leads with a summary.

Specified order:
1. **The best thing that happened.** The largest break of the run, replayed as a small animation,
   with its score. ("Floor 14 — 12 pairs, Fever ×8, Ripple ×5.5 — 5,280")
2. **Depth reached**, against personal best, with the delta.
3. **Total score.**
4. **One button: go again.** Same input as flipping a tile.

The summary details go behind an optional expansion.

### 42.4 Run length target [CHANGE]

Six to twelve floors for a typical player; ninety seconds to six minutes. This is short by
roguelike standards and correct for a game that is opened rather than scheduled (§14.4).

---

## §43. Difficulty and the pressure curve

### 43.1 The only difficulty axis [CHANGE]

**Board size**, on the tempered curve of §32.2. Nothing else.

No timers, no speed increase, no dynamic adjustment, no difficulty selection. Per §20.4, memory
difficulty self-normalises to the player, so a monotone board-size curve produces an honest,
personal difficulty ramp with no machinery at all.

### 43.2 Why board size is enough

Three compounding effects as pairs increase:

1. **More to remember**, superlinearly, because of interference (§23.3).
2. **Longer to clear**, so more opportunities to break the chain.
3. **Larger suits**, so bigger potential breaks — the difficulty and its answer are the same
   quantity, which is the §7.4 shape.

That third point is what keeps a growing board from being purely punishing: a bigger board is
harder to hold in mind *and* holds bigger payoffs, so the player's incentive grows with the
challenge.

### 43.3 The soft-pressure candidate: fog [NEW — highest risk]

Per §10.3, Zuma's spatial, reversible, opportunity-bearing pressure is the best-executed in the
canon, and we have nothing equivalent.

**Specified as a candidate:**

> A tile the player has flipped and not matched begins to **fog** after `FOG_AFTER_TURNS` turns
> without being touched. A fogged tile's back loses its suit rune (keeping its colour), then its
> colour. Fog clears when the tile is flipped again, or when a break takes it.

Properties, checked against §10.2:
- **(a) Spatial and visible.** Fog is on tiles, readable at a glance.
- **(b) Reversible by good play.** A big break clears fogged tiles wholesale.
- **(c) Risk and opportunity are the same object.** A heavily fogged region is dangerous (you can
  no longer read its suit) and full of pairs nobody has claimed.

It is thematically exact — the player is racing their own forgetting — and it is the single most
dangerous idea in this document, because it makes a pleasant game stressful.

**Recommendation:** build it, put it behind a setting, default it **off**, and measure. §57
specifies what would have to be true to make it default: session length must not fall, mistake rate
must not rise by more than a quarter, and the ladder's spread must not narrow. If any of those
fail, it stays optional or is cut. This is the correct way to treat an idea that is exciting and
might be wrong.

### 43.4 What we will not do

- **No timer.** §23.5(b).
- **No speed ramp.**
- **No hidden difficulty adjustment.** §25.1.13.
- **No difficulty selection.** §6.4.4 — everyone plays the same game.

---

## §44. Powers, and the one-button economy

### 44.1 The current state [CHANGE]

The game currently has peek charges, region shuffle charges, undo, stray remove, master keys,
relics, loadouts, and a shop to buy them with. That is an economy, and economies are rulebooks.

### 44.2 The specified state

**One power. One button. Earned in play, never bought.**

The candidate, taking §9.4's special-piece idea and §4.4's bucket:

> **The Recall.** A large break (six or more pairs) charges the Recall. When charged, one press
> reveals every tile of a single suit for 1.2 seconds, then hides them again.

Why this and not the others:

- **It is downstream of the flip** (§1.2): earned by breaks, spends into memory, which is the
  game's currency.
- **It has no rulebook.** "Look at a suit" needs no explanation.
- **It amplifies the core loop** rather than bypassing it: knowing where a suit's pairs are is
  exactly what §30's hold strategy needs.
- **It creates a decision with information**: which suit, and when — early to plan, or late to
  finish a chain.
- **It is earned by the thing the game is about**, which is §4.3(e).
- **It is Peggle's bucket**: a reward for doing well that lets you do better, with a visible charge
  state.

### 44.3 What is cut

Peek charges, region shuffle, undo, stray remove, master keys, relics, loadouts, gold, the shop,
and the starting-loadout selection. All of them.

Relics deserve a specific note because three of them (Tuning Fork, Magpie's Ledger, Suit Lens)
touch the cascade directly and are genuinely good design. They are cut anyway, because they require
a draft screen, an inventory, and a rulebook — and because §44.2's single power does their job with
none of that. If a build layer ever returns, §61 sequences it as its own project with its own
justification, not as a survivor of this one.

### 44.4 The one exception under consideration

**Nothing.** Listed here so the section is explicit: there is no second power, no consumable, no
charge other than the Recall.

---

# Part VI — Feel

> Feel is not polish. It is the difference between a correct game and a good one, and it is
> specified in milliseconds because that is the unit it exists in. Every number in this part is a
> starting value to be tuned against the real thing, not a law — but a starting value written down
> is worth ten arguments about whether something "feels floaty".

---

## §45. The timing table

### 45.1 The principle: no dead frames

Per §11.2(a), the number always moves. Restated as a hard rule:

> **There is no moment in the game where the screen is static and the player is not being asked for
> input.**

Every interval below either has motion in it or is an input state. The one deliberate exception is
the Fever freeze (§39.3), which is a *hard stop* used precisely because it is the only one.

### 45.2 The core turn

| Event | Duration | Curve | Notes |
|---|---|---|---|
| Tile press → flip begins | 0ms | — | Zero latency. Never queue, never debounce. |
| Flip animation | 180ms | `ease-out-back` (slight overshoot) | The overshoot is what makes a tile feel physical |
| Symbol readable | at 120ms | — | Before the animation finishes; readability leads motion |
| Second tile press → flip | 180ms | same | |
| **The gap** (§27.2) | 150ms | — | After the second symbol is readable, before resolution. This is the game's most emotionally dense interval and it must not be shortened for "responsiveness". |
| Match resolution | 0ms | — | Instant, on the frame |
| Matched pair lift | 120ms | `ease-in` | Rises and brightens before the break begins |
| Pop wave 1 | 220ms | `ease-out` | Tiles shatter outward from the matched pair |
| Each further wave | +160ms | staggered | Waves are sequential and individually legible |
| Per-tile stagger within a wave | 18ms × distance | — | The wave visibly propagates rather than firing at once |
| Score floats rise | 400ms | `ease-out` | Start at each tile, converge on the total |
| Total counts up | 350ms | `ease-out` accelerating tick | Never jumps |
| Board settles | 150ms | — | Deferred removal completes (§4.7.4) |
| **Input unlocks** | — | — | At settle, or earlier under §36.3 |

Total for a one-wave break: about 1.0s from second press to input unlock.
For a four-wave Sharp break: about 1.6s.
For a Fever break with ceremony: about 4.2s.

### 45.3 The mismatch

| Event | Duration | Notes |
|---|---|---|
| Both symbols readable | — | Both tiles stay face-up |
| Hold | 700ms | Long enough to encode. **This is a study interval, not a punishment.** |
| Flip back | 160ms | |
| Chain meter drains | 300ms | Visible, with a falling tone (Gen 140) |
| "Remembered" tint applied | at flip-back | §34.4 |

The 700ms hold is the most important number in this table. Too short and the player cannot encode
the tiles, which makes the game unfair and the mismatch pure loss. Too long and the game drags.
700ms is a starting point and should be tuned by measuring whether players' second attempts at a
seen tile succeed more often.

### 45.4 Reduced motion

Every animation above has a reduced-motion variant which:
- Preserves **all timing** (so the game feels the same and the audio still lines up),
- Replaces translation and scale with **opacity and colour**,
- Keeps the wave stagger, because the stagger is *information* about the reaction's structure, not
  decoration.

That last point is the one usually got wrong: reduced motion should reduce *motion*, not
*information*.

---

## §46. Audio

Audio does more work per byte than any other channel in this genre, and §4.5 argues the rising
pitch is the single most stealable idea in casual games.

### 46.1 The scale

Every break plays an ascending run. Specified:

- **Scale:** a diatonic major pentatonic. Pentatonic because any subset of it is consonant, so a
  break of any length sounds intentional rather than like an alarm.
- **Root:** fixed per floor, rotating through a cycle of fifths across a run, so a long run is
  audibly *going somewhere*.
- **One note per pair broken**, in break order.
- **Octave per wave.** Wave 1 plays in the base octave, wave 2 an octave up, wave 3 another.
  **This is the key change from what is shipped**: currently pitch rises per pair. Rising per wave
  as well means a chain reaction climbs *faster* than a wide single wave, so the ear can tell the
  difference between "that was big" and "that was deep" — which is exactly the distinction §38
  makes mechanically and which currently has no audio expression.
- **Ceiling:** cap at three octaves and hold, so a twenty-pair break does not become a whistle.

### 46.2 The event vocabulary

| Event | Sound | Why |
|---|---|---|
| Tile flip | Soft card-turn, pitched slightly by column | Positional feedback for free |
| Second tile flip | Same, but with a tiny rising anticipatory swell under it | §27.1 Beat 2 — the gap should be *audible* |
| Match | A clean bell attack, the first note of the run | |
| Mismatch | Two tones a semitone apart, the only dissonance in the game | Unmistakable, and unpleasant without being harsh |
| Chain drop | A falling third under the mismatch | Names the loss |
| Pop wave | The pitch run, one note per pair | §46.1 |
| Ripple wave boundary | A soft percussive tick, then the octave shift | Marks the structure |
| Drop | A low, soft *thud* cluster, distinctly *not* in the rising scale | §37.4 — a collapse, not a blast |
| Halo (Fever) | A wide, bright chord underneath the run | The only chordal event in normal play |
| Rung reached | The rung's own tone, held, over the break | Clean, Sharp and Fever have distinct timbres |
| Floor clear | The run's root, resolved, with a short rising arpeggio | An ending |
| Fever ceremony | §39.3 | |
| Recall charged | A single quiet chime | The only "you may act" sound in the game |

### 46.3 The one thing audio must never do

Never celebrate a small outcome with big-outcome audio (§16.3.2). The bell attack for a match is
the same every time; everything above it scales with what actually happened.

### 46.4 Music

- A single loop per run, tempo rising very slightly with depth.
- **Ducked**, not stopped, during a break, so the break's run sits on top of it (shipped, Gen 128).
- **Silence is allowed.** The 150ms gap of §45.2 should have the music duck slightly too. A
  moment of near-silence before a resolution is the cheapest tension in audio design.

### 46.5 Presenting the mismatch honestly

Per §34.4, a mismatch is an exchange, not just a loss. The audio should say so: the dissonant pair
resolves, quietly, into a consonance as the tiles turn back — a two-note "well, now you know"
figure. It costs nothing and it changes the emotional reading of the game's only negative event.

---

## §47. Camera, shake, and hit-stop

### 47.1 The trauma model [CHANGE]

Screen shake should be driven by a single scalar `trauma` in `[0,1]` that decays, with the actual
offset computed as `trauma² × maxOffset × noise(t)`. The square is what makes small events barely
shake and large ones violent.

This matters beyond aesthetics: a trauma scalar survives hit-stop and slow-motion correctly (it is
a value, not an animation), and it is deterministic given a seed, which means a replay reproduces
it exactly. The current implementation shakes by triggering animations, which does neither.

### 47.2 The budget

| Event | Trauma added |
|---|---|
| Match | 0.05 |
| Pop wave, per pair | 0.02, capped at 0.25 per wave |
| Wave boundary | 0.08 |
| Drop | 0.15 |
| Rung reached | 0.20 |
| Fever break | 0.55 |
| Floor clear | 0.10 |

Decay: `trauma -= 1.6 × dt`, clamped at zero.

### 47.3 Hit-stop

| Event | Freeze |
|---|---|
| Match | 30ms |
| Wave boundary | 40ms |
| Drop | 60ms |
| Fever break | 180ms |

Hit-stop is a freeze of *simulation*, not of rendering: particles hold, audio continues. This is
what makes it read as impact rather than as a frame drop.

### 47.4 Camera Comfort

All of the above must be reducible to zero by a single setting, and the setting must be reachable
from the pause screen without leaving the run. Screen shake is the single most common accessibility
complaint in games with juice, and the answer is not "less shake for everyone" but "a switch".

Specified: a three-position control — **Full / Reduced / Off** — where Reduced halves trauma and
removes hit-stop, and Off removes both. Reduced is the default on handheld form factors.

---

## §48. Colour, contrast, and accessibility

### 48.1 Suits must never rely on colour [SHIPPED]

Each suit carries a rune as well as a hue. This is already true and is non-negotiable.

The test: a greyscale screenshot of the board must remain fully playable. §57 makes it a gate.

### 48.2 Contrast

All text at 4.5:1 minimum against its background; all functional non-text (suit runes, meter fill,
tile borders) at 3:1 minimum. The suit hues in §33.1 must be checked against both the light and
dark tile backs at these ratios, and the runes must carry the difference where a hue pair is close.

### 48.3 Text size

A 12px minimum was set at Gen 27 and is a floor, not a target. Specified additionally: a **text
size control** with at least three steps, which scales the HUD without reflowing the board.

### 48.4 The honest limitation

Per §23.5(c), a memory game excludes players with significant memory impairment from its core verb,
and no accessibility feature fixes that without becoming a different game.

What we can honestly offer:
- **Suits as a partial aid**, already core.
- **The "remembered" tint** on seen-and-mismatched tiles (§34.4), which reduces raw load.
- **The Recall power** (§44.2), which is a memory aid earned in play.
- **Fog default off** (§43.3), so the game never *accelerates* forgetting by default.
- **No timer**, ever, so a slow player is never punished.

What we will not do: an assist mode that reveals the board, because it removes the game rather than
adapting it. This is a judgement call and reasonable people differ; it is recorded in Appendix E as
an open question rather than settled.

### 48.5 Input

Mouse, touch, keyboard, and gamepad all fully supported, all with identical timing, and the game
must be completable with any one of them alone. Already true (Gen 1) and must stay true.

---

## §49. Readability and the screenshot test

### 49.1 The test [NEW as a gate]

> A single screenshot of the game, shown to somebody who has never seen it, must let them describe
> what the game is.

Concretely, the frame must contain:
1. Two or three visibly clumped suit regions.
2. Two face-up tiles with matching symbols.
3. A break in progress taking several tiles.
4. One rising number.

§61 adds a capture task that produces this frame automatically from a seeded run, so it can be
checked on every UI change rather than argued about.

### 49.2 What the HUD may contain

The HUD competes with the board for attention, and the board is the game. Specified maximum:

| Element | Always visible? | Why it earns its place |
|---|---|---|
| Score | Yes | The number that always moves (§11.2) |
| Depth (floor number) | Yes | The run's actual progression axis (§55) |
| Chain meter with rung ticks | Yes | The strategic layer (§30) |
| Turns / par | Yes | The visible goal (§41.3) |
| Recall charge | When charged | The only action affordance |
| Personal best marker | When passed | §24.2(b) |

Six elements. Everything else — objectives, keys, gold, mode, relics, loadout, hazard status —
goes with the dungeon.

### 49.3 The board's own readability

- **Tile backs** carry the suit hue as a field and the rune at ≥ 24% of tile width.
- **Tile faces** carry the symbol at ≥ 45% of tile width.
- **Clump boundaries** are legible without a drawn border: the hue field is enough, and a drawn
  border would imply a rule that does not exist.
- **The aim guide** (§29.2) is always available on touch (long-press) and on hover on pointer
  devices, and shows only the first wave.

---

# Part VII — The First Ten Minutes

> Everything in this part is subordinate to one sentence: **the game must teach itself by being
> played, with no text.** If any rule in Part V requires a tutorial, that rule is wrong.

---

## §50. Onboarding without a tutorial

### 50.1 Why no tutorial

Three reasons, in order of strength:

1. **The rule set is seven sentences (§26).** A game that needs a tutorial for seven sentences has
   a presentation problem, not a teaching problem.
2. **A tutorial is a stop.** §1.2. The first thirty seconds is the worst possible place for one.
3. **Every mechanic here is visible when it fires.** A pop is a thing you watch happen. There is
   nothing to explain that showing does not explain better.

### 50.2 The teaching order

The player must learn, in this order, purely from play:

| # | What they learn | How | When |
|---|---|---|---|
| 1 | Tiles flip | They tap one | Second 1 |
| 2 | Two matching symbols clear | They find a pair | Turn 1–3 |
| 3 | **A match takes other tiles with it** | It happens, loudly | **Their first match** |
| 4 | The tiles it takes share a colour | They see the blast is one hue | Turn 2–4 |
| 5 | The colour is on the back, before you flip | They notice, or they do not — it works either way | Turn 3–10 |
| 6 | A mismatch costs the meter | It happens | First mismatch |
| 7 | A run of matches makes blasts bigger | It happens, and the game names the rung | Floor 1–2 |
| 8 | Blasts reach across the board at Clean | A partner leaves from somewhere else, visibly | Floor 1–3 |
| 9 | At Sharp the blast keeps going | The reaction runs | Floor 2–4 |
| 10 | Fever is a thing that exists | They see it, or see the meter's top tick | Floor 3–8 |

Rows 3 and 8 are the critical ones and both must be **guaranteed**, not left to chance (§51).

### 50.3 The one piece of text

There is exactly one instruction in the game, shown once, on the first board, under the board:

> **Find a pair.**

It disappears on the first match and never returns.

Everything else — rung names, the ripple, the drop, Fever — is named by the game *as it happens*,
in the feedback rail, which is a different thing from instruction: it labels an event the player is
already watching.

---

## §51. The first board

### 51.1 Why the first board must be authored

Per §50.2, the player must see a pop on their first match. Under procedural generation with the
current curve, floor 1 has two pairs — which cannot pop at all, because a pop needs two pairs of a
suit within reach.

**This is the single most serious first-session defect in the game as it stands, and it exists
because the dungeon was eating the early floors.** §32.2's new curve fixes it structurally (floor 1
becomes three pairs, floor 2 six), but structure alone does not *guarantee* the pop.

### 51.2 The specified first board

Floor 1 is **hand-authored**, once, and is the same for every player:

```
Six tiles, three pairs, one suit (Ember), in a 3×2 grid.
All three pairs are mutually within reach.
```

Consequences, all deliberate:
- **Any correct match pops at least one other pair.** Row 3 of §50.2 is guaranteed on turn 1.
- **The board is small enough to solve by exploration**, so a player who remembers nothing still
  wins.
- **One suit means the suit rule is not yet taught**, which is correct — it is row 4, not row 1.
- **It clears in three to five turns**, so the player reaches floor 2 inside twenty seconds.

### 51.3 Floors 2 and 3

Also authored, and their jobs are:

**Floor 2 — teach the suit.** Six pairs, two suits, clumped, with the clumps clearly separated. The
first match pops within its own clump and conspicuously does *not* touch the other colour. The
player learns rule 4 by watching a blast stop at a colour boundary.

**Floor 3 — teach the reach across the board.** Seven pairs, two suits, and **one pair deliberately
split**: one half inside a clump, the other half across the board. Reaching Clean on this floor is
made easy (the board is small enough that three matches is most of it), and when the player does,
the split pair's far half visibly flies out of nowhere.

That moment — a tile leaving from somewhere you were not looking — is the game's thesis in one
event, and it should happen inside the first ninety seconds of a player's life with the product.

### 51.4 Floor 4 onward

Procedural, on the §32.2 curve. The authored floors are three, not thirty; they exist to guarantee
the three teaching moments and then get out of the way.

---

## §52. The first Fever

### 52.1 The problem

Fever arrives at momentum `max(7, half the floor's pairs)`. On the small early floors that is seven
momentum, which a new player will not reach — and Fever is the game's headline moment.

Measured: a clean player sees Fever on 27% of floors, but a *new* player is not clean.

### 52.2 The options, and the recommendation

**Option A: lower the early rungs.** Make Fever reachable on floors 1–5 specifically.
*Rejected:* it makes the ceremony cheap and it is a hidden difficulty adjustment (§25.1.13).

**Option B: guarantee it on an authored floor.** Author floor 5 so that a competent clear reaches
Fever.
*Rejected:* too fragile; depends on the player's line.

**Option C: show it before they earn it.** The chain meter's top tick is visible from turn one and
is labelled. When a player first reaches Sharp, the game says so, and the meter shows how far Fever
is. The player knows the mountain exists long before they climb it.
**Recommended.** This is how Vampire Survivors handles its evolutions and how Balatro handles its
high hands: you see the possibility long before you achieve it, and the gap is the motivation.

**Option D: an attract-mode demonstration.** On the run-end screen, occasionally replay a Fever
break from a simulated run.
*Recommended as a supplement*, because it is honest (it is a real board), costs nothing, and puts
the spectacle in front of a player at the exact moment they are deciding whether to go again.

### 52.3 The measured target

A player's first Fever should land inside their first **three runs**, or roughly fifteen minutes.
This is measurable once §61's session instrumentation exists, and it is a band worth holding.

---

# Part VIII — Retention Without Dark Patterns

---

## §53. Session shape

### 53.1 The target shape

| Property | Target | Why |
|---|---|---|
| Time to first input | < 2s from app open | §1.1 |
| Time to first pop | < 15s | §51.2 |
| Floor duration | 20–60s | §1.1 |
| Floors per run | 6–12 | §42.4 |
| Runs per session | 2–5 | |
| Session duration | 4–20 minutes | §23.5(a) — memory work is tiring |
| Time from run end to next run | < 1s, one input | §6.3 |

### 53.2 The natural stopping point

Per §24.2, we should *give* the player a good place to stop rather than fight their leaving.

The floor clear is that place: it has a small ceremony, it resolves the score, and it is the moment
the chain resets anyway. A player who stops after a floor clear has a clean ending.

**Therefore the design should make floor clear the easiest place to stop and mid-floor the hardest
— not by trapping the player mid-floor, but by making the floor-clear beat satisfying enough that
stopping there feels like finishing.** The distinction from a dark pattern is that we are making
stopping *good*, not making it *hard*.

### 53.3 No dead time

Auditing the current session for stops:

| Stop | Verdict |
|---|---|
| Splash screen | Cut; boot straight to a board |
| Mode selection | Cut with the modes |
| Loadout selection | Cut with §44.3 |
| Route choice between floors | Cut with the dungeon |
| Shop | Cut |
| Floor summary screen | Cut; fold into the in-place beat (§41.4) |
| Relic draft | Cut |
| Run-end screen | Kept, but restructured (§42.3) and skippable in one input |

That is seven stops removed from a five-minute session.

---

## §54. Between sessions

### 54.1 What we do not do

Per §25.1: no daily rewards, no streaks that break, no energy that refills, no notifications
designed to induce guilt, no limited-time events, no login bonuses.

This removes the entire conventional retention toolkit, deliberately.

### 54.2 What is left

Three things, all honest:

**(a) The game is good.** This is not a joke; it is the entire strategy, and it is the strategy of
every product in the survey with strong word of mouth.

**(b) A record that is a true statement about the player.** §55.

**(c) A reason to believe the next run will be better than the last.** This is the incremental
family's real mechanism (§11.1(b)) stripped of its arithmetic: not "your numbers grew while you
were away" but "you are better at this than you were."

### 54.3 Notifications

If we ship any at all, the rule is: **factual, rare, and never about what the player will lose.**

The only defensible notification for this product is one the player explicitly sets ("remind me to
play tomorrow"), and even that is a low priority.

---

## §55. Records, not currencies

### 55.1 The one number that goes up

Per §11.2, the player should always be able to see one next threshold. Across sessions, that
number is **depth**: the deepest floor reached.

Depth is the right axis rather than score because:
- It is **monotone in skill** and not in time invested.
- It is **legible**: "floor 14" needs no explanation.
- It is **not purchasable, farmable, or inflatable.**
- It produces a **natural next target** always exactly one greater.

Score is the in-run number (§40.6); depth is the between-run number.

### 55.2 The record set

| Record | Kept |
|---|---|
| Deepest floor | The headline |
| Best score in a single run | Secondary |
| Largest single break (pairs) | The spectacle record — this is the one players will screenshot |
| Longest chain | The skill record |
| Fastest floor clear at each depth | The mastery record, and the seed of §56 |

Five records, no currencies, nothing spendable.

### 55.3 Why a record is the honest form of ownership

§22.2 refuses the endowment machinery — collections, inventories, unlock trees — because it
converts into sunk cost. A record is different in kind:

- **It cannot be lost.** Not playing does not reduce it.
- **It cannot be bought.**
- **It is a true statement about the player**, not a possession the game granted.
- **Losing interest costs nothing.** The record stands whether or not you return.

That last property is the test of §22.3: if a player stops forever today, the game has taken
nothing from them. A record satisfies it; an 87%-complete collection does not.

---

## §56. The thing nobody in the market measures

### 56.1 The finding

The market survey's most striking gap: essentially nobody in this segment measures or surfaces
**whether a returning player is better at the same content than they were.**

Games measure retention (did they come back), engagement (how long), and monetisation. Almost none
measure improvement, and none surface it to the player.

### 56.2 Why we can

Our boards are pure functions of `(seed, rulesVersion, floor)` (§32.5), and we already keep a
bounded run history (Gen 63) and per-mode records (Gen 71). That means we can replay a player
against a board they have already played and compare, honestly, on identical content.

### 56.3 The feature this enables

> **The Rematch.** On the run-end screen, offer the seed of the run where the player's previous
> personal best was set. Playing it produces a direct, like-for-like comparison: same board, same
> floors, and a delta in turns, mistakes, and depth.

Why this is good:
- It is the **testing effect** (§23.1) turned into a feature: replaying a board is both a test and
  a study trial, and players will genuinely improve at it.
- It converts "I have played this before" from a negative (repetition) into the *point*.
- It produces the §54.2(c) belief — you are better than you were — as a **measured fact** rather
  than a feeling.
- It is honest. No other retention mechanism in this document's refused list is needed if the game
  can show a player, factually, that they are improving.

### 56.4 The measurement, internally

Independent of the feature, we should instrument it:

```
improvementDelta(seed, floor) = turns(firstAttempt) - turns(latestAttempt)
```

aggregated across a player's history. If this is not positive on average, the game is not teachable,
which would be a much deeper problem than any balance number in this document. §57 makes it a band.

---

# Part IX — Measurement

> This project's most valuable asset is not its code, it is its instrumentation. Four simulations
> play the real game through the real turn path and report on it, and every design claim in this
> document is either backed by one of them or explicitly marked as unmeasured. This part specifies
> what we measure, what bands we hold, and — the part usually missing — what we would actually do
> if a band broke.

---

## §57. The bands

### 57.1 The principle

A band is a number with a consequence. A measurement without a band is a dashboard, and dashboards
do not prevent regressions. Every band below fails a gate, and a failing gate blocks a commit.

The second principle: **a band is a ratchet, not a target.** When a change improves a measurement,
the band moves up. This is what stops a codebase from slowly spending its own quality.

### 57.2 Loop reachability — `sim:pop --check`

| Band | Current value | Threshold | What it protects |
|---|---|---|---|
| `earlyPopRate` (floors 1–6) | measured per run | ≥ 0.45 | A new player sees the loop |
| `overallPopRate` | measured per run | ≥ 0.50 | The loop is not a late-game feature |
| `perLevelPopRate` | measured per run | ≥ 0.25 | No floor is dead |
| `ladderMinStep` | 0.39 | ≥ 0.30 | Every rung is worth climbing |
| `ladderSpread` (none→fever) | 2.53 | ≥ 2.20 | The ladder has range |

**Post-removal action:** all five must be re-measured and ratcheted. §38.5.

### 57.3 Cascade balance — `sim:cascade --check`

| Band | Threshold | What it protects |
|---|---|---|
| `minSettledShare` | 1.00 | No floor can get stuck |
| `cleanClearedShare` | 1.00 | A clean player always clears |
| `ratingDriftFloors` | 0 | The cascade never moves the rating |
| `cleanFeverShareOnBigFloors` | ≥ 0.15 | The top of the ladder is reachable |
| `feverCleanOverReference` | ≥ 2.0 | The ladder separates skill |
| `referenceFeverShare` | ≤ 0.20 | Fever stays rare enough to be an event |
| `extremeFeverCleanOverReference` | ≥ 1.5 | The floor-end bonus rewards skill |
| `chunkShareOfScore` | 0.10–0.35 | The cascade pays without dominating |

**New band required by §40.3:** `largestBreakShareOfFloorScore` between 0.25 and 0.70.

### 57.4 System occupancy — `gate:occupancy`

| Band | Threshold |
|---|---|
| `core` cadence systems | 0.90–1.00 of floors |
| `common` cadence systems | 0.10–0.90 |
| `rare` cadence systems | 0.005–0.25 |
| Silent set | Must match the recorded baseline exactly |
| Thin set | Must match the recorded baseline exactly |
| Dominant set | Must match the recorded baseline exactly |

**Post-removal action:** the silent list should go from eleven entries to **zero**, because all
eleven are in the layer being removed. If it does not, we have discovered systems that were silent
for reasons unrelated to the dungeon, which is important and should be a task each.

### 57.5 New bands this document requires

| # | Band | Threshold | Section | Instrument |
|---|---|---|---|---|
| N1 | Board invariant: `tiles.length === 2 × pairs` | exact | §32.1 | Unit |
| N2 | Every tile belongs to a whole pair | exact | §32.1 | Unit |
| N3 | Nothing enters the board mid-floor | exact | §19.3 | Property test over a simulated floor |
| N4 | Greyscale playability | manual + contrast unit | §48.1 | Contrast check |
| N5 | Largest break's share of floor score | 0.25–0.70 | §40.3 | `sim:cascade` |
| N6 | First pop within the first three floors | 1.00 | §51 | Authored-floor unit |
| N7 | Split-pair reach demonstrated on floor 3 | 1.00 | §51.3 | Authored-floor unit |
| N8 | Drop fires on ≥ 0.25 of floors | ≥ 0.25 | §37.3 | `sim:occupancy` |
| N9 | Turn-to-input latency | 0ms | §45.2 | e2e timing |
| N10 | Session: median floors per run | ≥ 6 | §53.1 | Telemetry (local only) |
| N11 | Improvement delta on replayed seeds | > 0 | §56.4 | Run history analysis |
| N12 | Fog (if shipped) does not raise mistake rate > 25% | ≤ 1.25× | §43.3 | `sim:cascade` variant |

N8 deserves comment: the drop currently fires on 0.6% of floors. §37.3's severance rule should take
it to a substantial fraction, because on most floors *some* suit ends up unable to pop. If the
restructured rule does not produce ≥ 0.25, the restructure did not work and should be revisited
rather than shipped and forgotten.

---

## §58. The simulations

### 58.1 What each one is for

| Simulation | Question it answers | Plays |
|---|---|---|
| `sim:pop` | Is the loop reachable, and does the ladder have range? | Every whole pair on 12 floors × 8 seeds, at each tier's own rung |
| `sim:cascade` | What does the loop pay, and does it separate skill? | Full floors at three miss rates, 6 seeds × 24 floors |
| `sim:occupancy` | Does each system ever happen to a player? | Full floors with a reference player, 16 floors × 10 seeds |
| `build-strategy-playthrough` | Do different builds produce different play? | Nine builds through a run |

### 58.2 The rule that makes them trustworthy

> **A simulation reads the game's own counters. It never re-derives a rule.**

This rule was learned the hard way at Gen 170: `sim:cascade` counted a break as Fever by asking
what tier the chain was at *after* the turn, rather than reading `feverBreaksThisFloor`, which the
game increments when the break itself resolves at Fever. The two readings differed by a factor of
five, and every Fever band in the file had been tuned against the wrong one.

The general form of the error: a simulation that re-implements a rule is a second implementation
that can drift, and when it drifts it will drift toward whatever the person writing it expected.

**Corollary:** every simulation should be auditable against the occupancy census, which reads only
counters and therefore cannot drift. If two instruments disagree, the one reading counters wins.

### 58.3 What the simulations cannot see

Honesty requires listing this:

- **Feel.** No simulation knows whether 220ms is the right wave duration.
- **Legibility.** No simulation knows whether a player can read the board.
- **Fun.** Obviously.
- **The player's actual memory.** Our simulated player either knows a pair or picks randomly; a
  real player has partial, decaying, spatially-organised knowledge. This is the largest modelling
  gap and it means every number about *difficulty* should be treated as directional rather than
  absolute.

§59 proposes a partial fix.

---

## §59. Modelling the player better

### 59.1 The current model

The simulated player picks a known pair with probability `1 - missRate`, and otherwise picks two
random hidden tiles. That is a coin flip, not a memory.

### 59.2 A better model, specified

```
memoryModel = {
    capacity:      number,   // how many tile identities are held at once
    decayTurns:    number,   // turns before an unrehearsed item is lost
    spatialBonus:  number,   // recall bonus for tiles in a remembered clump
    encodeOnFlip:  number    // probability an event enters memory at all
}
```

The player holds a bounded set of `(tileId → symbol)` facts; each flip adds facts subject to
`encodeOnFlip`; facts decay after `decayTurns` unless re-seen; a fact in a suit region the player
has been working in gets `spatialBonus`.

This is a crude cognitive model and it would still be wrong, but it would be wrong in *interesting*
ways: it would show us how difficulty scales with board size for a bounded-memory agent, which is
the §23.3 question that currently has no instrument behind it.

### 59.3 What it would let us answer

1. Whether §32.2's pair curve is right at depth.
2. Whether the fog (§43.3) is survivable.
3. Whether the "remembered" tint (§34.4) meaningfully reduces load.
4. Where the difficulty wall actually is for a given capacity — i.e. what floor a typical player
   should reach, which is the number §55.1 makes the headline.

That last one is worth the whole exercise: right now we do not know what floor a typical human
reaches, and the entire between-session progression axis depends on it.

---

## §60. What we would do if a band broke

Written in advance, because the moment a gate goes red is exactly when good judgement is scarcest.

| Band | If it broke, the first hypothesis is... | The first check |
|---|---|---|
| `earlyPopRate` | Early floors are too small, or the suit palette is too wide for them | `sim:pop` per-floor table: look at `breakable` and `suits` columns |
| `ladderMinStep` | A rung has stopped buying something distinct | Re-read `breakClumpReach` and `rippleWaves`: has one tier's behaviour become another's? |
| `ladderSpread` | The bottom rung got too generous, not the top too weak | Compare `none` against its history first |
| `cleanFeverShareOnBigFloors` | The rung arrives too late in a floor to have anything to break | Compare peak momentum against the rung, per floor |
| `feverCleanOverReference` | Something is giving momentum for free | Look for a change that pays momentum on an unearned event |
| `ratingDriftFloors > 0` | **Stop.** The cascade has touched the rating. | This is the one band with no acceptable explanation; revert the change |
| Occupancy silent set grew | A generation change stopped producing the board a system needs | Diff the generation path, not the system |
| Occupancy dominant set grew | Either a system grew, or its cadence label was always wrong | Ask which, honestly; relabelling is legitimate, tuning to hide is not |
| N8 drop share | The severance condition is stricter than intended | Instrument how often a suit *is* severed vs how often the drop fires |
| N11 improvement delta ≤ 0 | The game is not teachable | This is a five-alarm finding; it would invalidate §56 and much of Part VIII |

### 60.1 The meta-rule

> **When a band breaks, fix the game or move the band deliberately and write down why. Never
> silence a band, and never widen one to make a red build green.**

The occupancy `rare` band's history is the model here: it was raised from 0.005 to 0.02, which
called three hazard caches thin that were actually fine, and it was **reverted with the reasoning
recorded** rather than left in place. That is the standard.

---

# Part X — The Plan

---

## §61. The task breakdown

Tasks are grouped into phases. A phase is shippable: at the end of each, the game is playable and
every gate is green. Within a phase, tasks are ordered by dependency.

### Phase 0 — Archive (done)

| # | Task | Acceptance |
|---|---|---|
| 0.1 | Generate `REMOVED_DUNGEON_LAYER.md` from the live catalogs | Every kind, effect, boss and hazard present with its real fields |
| 0.2 | Write this thesis | ≥ 10,000 lines, and Part V is normative |

### Phase 1 — The removal

The largest phase and the riskiest. Ordered so the game is playable after every task.

| # | Task | Detail | Acceptance |
|---|---|---|---|
| 1.1 | **Collapse to one mode** | `GameMode` becomes a single value. Delete daily, puzzle, gauntlet, meditation and every screen, rule, record and save field that only they used. | `GameMode` has one member; no screen offers a choice; `verify` green |
| 1.2 | **Stop generating hazard tiles** | Board generation no longer places any `HazardTileKind`. | `sim:occupancy` shows six fewer systems, all previously silent |
| 1.3 | **Stop generating dungeon cards** | Board generation no longer places any `DungeonCardKind`. Floors are pairs only. | Board invariant N1/N2 holds on every generated floor |
| 1.4 | **The floor ends on an empty board** | Remove the exit as a win condition. | A floor completes with no exit tile present |
| 1.5 | **Remove the route/gateway layer** | No route choice between floors; floors follow one another directly. | No between-floor screen |
| 1.6 | **Remove the economy** | Gold, shop, rooms, relics, loadouts, and every charge except the Recall's placeholder. | Nothing purchasable exists |
| 1.7 | **Delete the thirty dungeon modules** | Plus their tests, fixtures, Codex entries, copy, and save migrations. | `ls src/shared/dungeon-*` is empty |
| 1.8 | **Delete the hazard-tile modules** | Same. | |
| 1.9 | **Strip the HUD** | Down to the six elements of §49.2. | Screenshot shows six elements |
| 1.10 | **Re-baseline every band** | Re-measure pop, cascade and occupancy; ratchet up; record before/after. | Occupancy silent list is empty; bands ratcheted |

### Phase 2 — The loop, made whole

Now that the loop has the board to itself, finish it.

| # | Task | Detail | Acceptance |
|---|---|---|---|
| 2.1 | **The pair curve** | §32.2's tempered growth; floor 1 becomes three pairs. | Curve matches the table |
| 2.2 | **The authored first three floors** | §51. | N6 and N7 hold |
| 2.3 | **The drop, restructured** | §37.3 severance. Delete `DROP_MAX_PAIRS`. | N8: drop fires on ≥ 0.25 of floors |
| 2.4 | **Multiplicative scoring** | §40.2. | N5 holds; the largest break of a good floor is worth 100× a chain-one pop |
| 2.5 | **The floor par** | §41.3, shown as `turns / par`. | Visible every floor |
| 2.6 | **The floor-end bonus** | §40.5, with the Fever multiplier. | Clearing at Fever pays 5× cold |
| 2.7 | **The floor clear happens in place** | §41.4; no screen transition. | No route from board to board through a screen |
| 2.8 | **Lives out, turn ceiling in** | §42.2. | A run ends only on the ceiling or on quitting |
| 2.9 | **Tile trait triage** | §32.4: keep four, cut five. | Five trait kinds gone |

### Phase 3 — The strategic layer made visible

The highest-value phase, and it is nearly all interface work over shipped mechanics.

| # | Task | Detail | Acceptance |
|---|---|---|---|
| 3.1 | **Tier-aware aim guide** | §29.2 + §30.3(b): show the first wave at the current tier. | Available on hover and long-press |
| 3.2 | **The next-tier ghost** | §30.3(b): the same preview at the next rung, ghosted. | A player can see what holding is worth |
| 3.3 | **Rung value in the meter** | §30.3(a). | Each rung tick carries a visual weight |
| 3.4 | **The held-pair marker** | §30.3(c), capped at one or two. | Marking changes no rules |
| 3.5 | **Score term-by-term** | §40.4: `pairs × tier × ripple` built up visibly. | The multiplier is watched being constructed |

### Phase 4 — Feel

| # | Task | Detail | Acceptance |
|---|---|---|---|
| 4.1 | **The timing table** | §45. Every duration set to spec. | Timings match the table |
| 4.2 | **Pitch per wave** | §46.1: octave shift per ripple wave. | A deep chain sounds different from a wide one |
| 4.3 | **The trauma model** | §47.1: scalar, squared, decaying, deterministic. | Shake survives hit-stop and replays identically |
| 4.4 | **Camera Comfort** | §47.4: three positions, reachable from pause. | Off removes all shake and hit-stop |
| 4.5 | **The Fever ceremony** | §39.3, to the millisecond. | Identical every time; 2.6s |
| 4.6 | **The drop's own presentation** | §37.4: falls, does not shatter. | Distinct from a break, visually and audibly |
| 4.7 | **The mismatch as exchange** | §34.4 + §46.5. | The tint and the resolving figure |
| 4.8 | **Text size control** | §48.3. | Three steps, board does not reflow |

### Phase 5 — The run and the record

| # | Task | Detail | Acceptance |
|---|---|---|---|
| 5.1 | **Depth as the headline record** | §55.1. | Shown on the HUD when passed |
| 5.2 | **The record set** | §55.2: five records, no currencies. | |
| 5.3 | **Run-end leads with the best break** | §42.3. | The largest break replays |
| 5.4 | **One-input restart** | §6.3, same input as a flip. | < 1s from run end to playing |
| 5.5 | **The Rematch** | §56.3: replay the personal-best seed. | Delta shown in turns and mistakes |
| 5.6 | **Improvement instrumentation** | §56.4. | N11 measurable |

### Phase 6 — The candidates

Each is a real idea that might be wrong. Each ships behind a flag, is measured, and is kept or cut
on the measurement.

| # | Task | Risk | Kill criterion |
|---|---|---|---|
| 6.1 | **The Recall power** | Medium — a memory aid could hollow the game | If mistake rate falls > 25%, cut or weaken |
| 6.2 | **Acting inside the ripple window** | High — could make the game twitchy | If it is not invisible to a player who ignores it, cut |
| 6.3 | **Fog** | High — could make the game stressful | §43.3's three conditions |
| 6.4 | **The player memory model** | Low — it is an instrument, not a feature | If it does not change any decision, it was not worth building |
| 6.5 | **Attract-mode Fever replay** | Low | If it delays restart, cut |

### Phase 7 — The sweep

| # | Task |
|---|---|
| 7.1 | Re-run every gate; ratchet every band to its new value |
| 7.2 | Regenerate the mechanics catalog, the Codex, the release checklist and the system diagrams against the reduced rule set |
| 7.3 | Rewrite `CHAIN_CHUNK_FEVER_DESIGN.md` as the spec it now is, pointing at this document for rationale |
| 7.4 | The screenshot test (§49.1) as a capture job |
| 7.5 | A recorded playthrough of floors 1–10 for review |

---

## §62. Risks

Stated plainly, worst first.

### 62.1 The game may be too thin

**The risk:** after removing eleven card kinds and four modes, there is a memory board with a
cascade and nothing else, and players find it slight.

**Why I think it is manageable:** §3.2's precedent — every deep game in the family has a tiny
rulebook — and §3.1's six-input decision. But precedent is not proof, and this is the risk that
would invalidate the whole project.

**The early warning:** session length falling after Phase 1. If players leave sooner with the
dungeon gone, the dungeon was doing something the measurements could not see.

**The response if it fires:** *not* to add cards back. To look at §30 (the strategic layer is
invisible) and §40 (the score curve is flat) first, because both are known deficiencies that make
the loop feel thinner than it is, and both are cheap to fix.

### 62.2 The first three floors may still not teach

**The risk:** even authored, the teaching moments do not land, and new players bounce before the
loop reveals itself.

**The early warning:** N6/N7 pass in simulation but players still do not describe the game as "a
memory game where things explode".

**The response:** more authored floors, and the attract-mode demonstration (§52.2 option D).

### 62.3 The removal may destabilise the codebase

**The risk:** 93 files reference `dungeonCardKind`; 30 modules exist to serve it; several thousand
tests touch it. A removal this size can leave the project broken for a long time.

**The mitigation:** Phase 1's task order is chosen so the game is playable after every single task.
Stop generating before deleting; delete leaves last.

### 62.4 Multiplicative scoring may make the small break worthless

§40.3's concern. **The mitigation:** band N5, and the fact that small breaks are the ladder rather
than competing with it.

### 62.5 The candidates may be wrong

Phase 6 exists for this. Each candidate has a written kill criterion *before* it is built, which is
the only reliable defence against the sunk cost of one's own good idea.

### 62.6 This document may be wrong

The most likely way: §28's claim that memory is a superior source of cascade uncertainty could be
true in theory and irrelevant in practice, if players do not actually experience the "surprised by
my own board" feeling. That is an empirical question this document cannot settle, and the honest
position is that Phase 1 and Phase 2 are worth doing regardless — because they simplify the game
and fix measured defects — while Phase 3's strategic layer is the one that most depends on §28
being right.

---

## §63. What we are deliberately not doing

A list, so that each of these is decided once.

| Not doing | Because |
|---|---|
| A between-floor choice screen | §14.2 — a choice without information is a coin flip with clicking |
| A build/relic/deck layer | §44.3 — it is a rulebook, and §44.2 does its job with none |
| Multiple modes | The loop is not finished; four variants of an unfinished loop is four unfinished games |
| Multiplayer | §7.6 |
| An economy of any kind | §25.1.5 |
| Idle accrual or prestige | §11.4 |
| Lives, energy, or any gate | §25.1.1 |
| Daily challenges or streaks | §25.1.2–3 |
| A story or characters | Neither is downstream of the flip; both are content the loop does not need |
| Cosmetics | Would be harmless, and is a distraction while the loop is unfinished |
| Difficulty selection | §43.4 |
| An assist mode that reveals the board | §48.4 — it removes the game rather than adapting it |
| Cognitive-benefit marketing | §25.1.15 |
| Leaderboards as the default progression signal | §25.1.10 |
| A tutorial | §50.1 |

### 63.1 The standing rule for anything not on either list

Answer §25.2's three questions in writing. If it survives all three, it is a candidate for Phase 6
with a written kill criterion. If it does not, it goes on the list above with a one-line reason.

---

# Part XI — Worked Play Traces

> A specification says what the rules are. A trace says what it is like. These four traces are
> annotated turn-by-turn walkthroughs of the game as specified in Part V, written to expose the
> decisions the design intends the player to face and to check that they are actually there.
>
> Boards are described in a compact notation: a grid where each cell is `suit:symbol` for a known
> tile and `suit:?` for one whose face the player has not seen. Suits are `E` (Ember), `T` (Tide),
> `M` (Moss), `B` (Bone).

---

## §64. Trace 1 — the first ninety seconds

The authored opening (§51). A brand-new player.

### Floor 1 — three pairs, one suit, 3×2

```
E:?  E:?  E:?
E:?  E:?  E:?
```

**Turn 1.** The player taps the top-left tile. It flips: a triangle. They tap the tile beside it: a
circle. Mismatch.

*What the game did:* both symbols held for 700ms; a two-note dissonance resolving to a consonance;
the tiles turned back with a faint tint on their backs. The chain meter, which was at zero, did not
move.

*What the player learned:* tiles flip; two different symbols do not match; the game told them, in
its own voice, that they now know two positions.

**Turn 2.** They tap the top-right tile: a triangle. They remember the top-left was a triangle. They
tap it. **Match.**

*What the game did:* the pair lifted and brightened for 120ms. Then it detonated — and because all
three pairs on this board are Ember and mutually within reach, the blast took **both other pairs
with it.** Six tiles left the board in one 220ms wave, with a five-note ascending run. The score
floated up from six positions and converged. `FLOOR 1 CLEARED` in the same breath.

*What the player learned:* **the thing the game is about, on their second turn.** Not told, not
demonstrated in a tutorial — it happened to them because they remembered one tile.

*Elapsed: about 14 seconds.*

**This is the single most important moment in the product**, and it is why floor 1 is authored
rather than generated. Under the old two-pair generated floor 1, this turn would have cleared two
tiles with no pop, and the player's first impression of the game would have been "Concentration".

### Floor 2 — six pairs, two suits, clumped, 4×3

```
E:?  E:?  E:?  T:?
E:?  E:?  T:?  T:?
E:?  T:?  T:?  T:?
```

**Turn 1.** Exploration. Two Ember tiles: a square and a star. Mismatch.
**Turn 2.** Two Tide tiles: a moon and a key. Mismatch.
**Turn 3.** A Tide tile: a moon. They remember the other moon. **Match.**

*What the game did:* the blast took the matched Tide pair and the two Tide tiles adjacent to it —
but one of those had its partner outside the blast, and the player is at chain 1, below Clean. Under
the contact rule (§35.2), that pair **stayed whole.** The blast stopped, visibly, at the boundary
between the Tide clump and the Ember clump.

*What the player learned:* rule 4 — the blast is one colour. They did not read it; they watched a
blast decline to cross a line.

**Turns 4–7.** Two more matches; the chain reaches 3; **Clean**. The meter says so and the rung
tone plays.

**Turn 8.** They match an Ember pair inside the Ember clump. At Clean, the partner reach applies:
a pair with one half in the blast goes anyway, and its other half — three cells away, in the middle
of the board — **flies out of the Ember region to join it.**

*What the player learned:* rule 8, four floors earlier than they would have discovered it by
accident. This is the moment the game becomes *itself*.

*Elapsed: about 55 seconds.*

### Floor 3 — seven pairs, two suits, one deliberately split

The split pair has one half deep in the Moss clump and the other in the far corner of the Ember
clump. Reaching Clean on this board takes three matches, which the board's size makes easy.

**Turn 5, at Clean.** The player matches inside Moss. The blast takes four Moss tiles and then —
because one of them is the split pair's half — **a tile in the opposite corner of the board leaves,
alone, trailing across the screen.**

*Elapsed: about 90 seconds. The player has now seen the pop, the suit boundary, the partner reach,
and a cross-board departure. They have read one sentence of text: "Find a pair."*

---

## §65. Trace 2 — the hold decision, floor 9

A competent player, twelve pairs, three suits. This trace exists to check that §30's strategic
decision is real and legible.

```
E:?  E:?  E:?  T:?  T:?  M:?
E:?  E:?  T:?  T:?  T:?  M:?
E:?  T:?  T:?  M:?  M:?  M:?
B:?  B:?  M:?  M:?  M:?  M:?
```

Rungs on a twelve-pair floor: Clean 3, Sharp 5, Fever 7.

**Turns 1–4.** Exploration and two matches; three mismatches along the way have twice reset the
chain. The player has learned nine tile positions. Current chain: 2. They know:

- An Ember pair, both halves adjacent, in the top-left.
- A Moss pair, halves at opposite ends of the large Moss region.
- A Bone pair, both halves in the bottom-left corner, isolated from everything.

**Turn 5 — the decision.** Three options, and this is the game:

**(a) Match the Ember pair now.** Chain 2 → 3, which crosses into Clean. The blast is bounded
(reach 2, one wave) and the Ember clump around it is dense: takes maybe three pairs. *Safe, decent,
and it buys the Clean rung.*

**(b) Match the Moss pair now.** Its halves are far apart, so at chain 2 — below Clean — the contact
rule means **neither half's clump contributes the other**; the pair leaves, plus whatever is
touching each half. Roughly two pairs. *Worse now than (a), and it spends the game's best asset.*

**(c) Match the Bone pair.** Isolated in the corner, touching nothing. Pops nothing at all — but
still advances the chain by one, and, crucially, **it severs the Bone suit**, which under §37.3
means the remaining Bone pairs drop on their own. *Zero blast, free chain, free clear-up.*

The interesting answer is **(c) then (a) then hold (b) for Sharp.**

- (c) advances the chain to 3 (Clean) with no cost and clears the corner.
- (a) at Clean now reaches partners: the Ember blast takes its clump *and* any Ember pair with one
  half inside. Say five pairs. Chain jumps to 4 plus momentum from five pairs (half of a five-pair
  pop is 3), so momentum ≈ 7 — past Sharp.
- (b) at Sharp is now transformed: the Moss pair's two halves are in *different parts of the Moss
  region*, and at Sharp each departing partner seeds a new wave in its own neighbourhood. The
  reaction runs across the whole Moss region from two ends at once.

The same Moss pair that was worth two pairs on turn 5 is worth eight on turn 7.

**What the interface must show for this to be a real decision:**

1. That the Bone pair pops nothing (aim guide, §29.2) — otherwise (c) looks like a wasted turn.
2. That the Bone suit is down to pairs that cannot pop (a suit-level indicator) — otherwise the
   severance is invisible.
3. That Moss at the current tier takes two, and at the next takes more (the ghost preview, §30.3b)
   — otherwise holding is a guess.

**All three are Phase 3 tasks, and none of them exist today.** This trace is the argument for that
phase: the mechanics already produce this decision, and the player cannot see any of it.

---

## §66. Trace 3 — a Fever break, in full

Floor 14, seventeen pairs, four suits. The player is at momentum 8; Fever on this floor is at 9.

**The setup.** They know a Tide pair whose halves sit at the two ends of a long Tide region running
diagonally across the board. They have been holding it for four turns.

**The turn before.** They match an Ember pair for three pairs. Momentum 8 → 12. **The meter fills
and the Fever tick lights.**

**The Fever turn, frame by frame:**

| Time | What happens |
|---|---|
| 0ms | Second tile flips; symbols match |
| +150ms | The gap. Music ducks. |
| +150ms | **Hard freeze, 180ms.** Nothing moves. The bell attack rings alone. |
| +330ms | Camera eases 8% toward the pair over 400ms; everything outside the coming blast desaturates to 30% |
| +330ms | The word `FEVER` at 2× any other type in the game |
| +430ms | Wave 1, at 0.6× speed: the whole Tide clump around the first half — nine tiles — shatters outward, one note each, ascending |
| +800ms | **The halo:** every hidden tile bordering that region, whatever its suit — two Ember, one Moss — goes with it, under a wide bright chord |
| +1000ms | Wave 2: the far half of the held pair departs, and *seeds its own region* — the other end of the Tide diagonal, six tiles, an octave up |
| +1400ms | Wave 3: a partner from wave 2 seeds a third region, two more pairs, another octave |
| +1700ms | Wave 4 takes nothing. The reaction ends. |
| +1750ms | **The drop:** Moss has been left with two pairs that cannot reach each other. They fall — translate down, accelerate, fade — under a low thud cluster, deliberately outside the rising scale |
| +1900ms | Score builds term by term: `14 pairs × Fever ×8 × Ripple ×3.25` |
| +2200ms | The total counts up, accelerating tick, rising pitch |
| +2600ms | Everything returns to full saturation over 300ms. Input unlocks. |

Fourteen pairs of seventeen left the board on one turn. The floor is nearly over; what remains is
one suit's worth, which the efficiency bonus rewards clearing quickly.

**What made it big:** not luck. The player held a pair whose halves were at opposite ends of a long
region, and spent it at the one tier where a departing partner seeds its own reaction. Every part of
that was visible before they committed.

**What the player could not have predicted:** exactly how far wave 3 reached, because it ran
through tiles they had never flipped. That is the prediction error (§18.2), and it is the whole
payload.

---

## §67. Trace 4 — a bad floor, and why it is not a punishment

Floor 11, fourteen pairs. The player is tired and misremembering.

**Turns 1–6:** four mismatches, two matches. Chain has reset four times. Momentum never exceeded 2.
The two matches popped two pairs and one pair respectively — bounded reach, no partner rule.

**Turn 7:** a match. Chain 1. Two pairs.

**Turns 8–12:** three more mismatches, two matches. Six pairs remain.

**Turn 13–16:** the board is small enough now that the player remembers everything. Four matches in
a row. Chain reaches 4 — past Clean, short of Sharp at 6. The last of these matches severs the last
suit; **the final two pairs drop on their own** (§37.3) and the floor clears.

**Turn count: 16 against a par of 12.**

**What the player experiences at the end:**
- `Floor 11 cleared — 16 turns, par 12`
- No efficiency bonus.
- Floor bonus at the `clean` multiplier (1.5×) rather than Fever's 5×.
- Their score went up. Their depth went up. Nothing was lost.
- The run continues.

**What did not happen:**
- No life was lost, because there are no lives.
- The run did not end; the ceiling was 36 turns and they used 16.
- No screen told them they did badly.
- No mechanic punished the forgetting beyond the chain resetting, which it does immediately and
  recoverably.

**The design intent this trace checks:** a bad floor should be *unremarkable*, not punishing. The
player who has a bad floor should feel they had a quiet floor, not a failure — because the failure
state in a memory game is "I could not remember", and making that painful is the fastest way to make
the game unpleasant (§23.5b).

The cost of the bad floor is entirely **opportunity cost**: they scored a fraction of what a good
floor pays, because the score curve is multiplicative (§40.2). That is the right kind of cost —
it is invisible in the moment and enormous in aggregate, which means it drives improvement without
generating frustration.

---

## §68. What the traces reveal

Four things this exercise surfaced that are not obvious from the specification:

**(a) The severance drop is a *turn* the player takes deliberately.** Trace 2's option (c) — match
an isolated pair to orphan a suit — is a real, non-obvious, good move that only exists under
§37.3's restructured rule. Under the current threshold rule it does not exist at all. This is the
strongest argument for the restructure, and it was not visible until the trace was written.

**(b) A pair's value depends on the geometry of *both* its halves, not just one.** Trace 3's held
pair was valuable because its halves were at opposite ends of a long region — so at Sharp it seeded
two reactions. Nothing in the interface expresses "this pair's halves are far apart", and that is a
missing Phase 3 task not currently in the list. **Added as task 3.6.**

**(c) The first-floor authoring is load-bearing in a way the spec understated.** Trace 1's turn 2
is the product's entire pitch, delivered in fourteen seconds, and it only works because all three
pairs are one suit and mutually in reach.

**(d) A bad floor needs an explicit design pass.** Trace 4 works, but only because several
individually-motivated decisions (no lives, generous ceiling, self-clearing tail) happen to
compose. That composition should be deliberate and tested, not incidental. **Added as task 2.10:
"a bad floor is quiet, not punishing" as an explicit acceptance criterion.**

---

# Part XII — Failure Modes

> Every design has characteristic ways of going wrong. Naming them in advance is how you notice
> them early. Each entry gives the symptom, the likely cause, and the first thing to check.

---

## §69. The catalogue

### 69.1 "It feels random"

**Symptom:** players describe outcomes as luck.

**Likely cause:** the aim guide is not visible or not trusted, so the first wave — the predictable
part — is not being predicted. Per §18.2, if the *first* step is not confident, the whole structure
collapses into noise.

**First check:** can a player, before committing, say how many pairs their match will take? If not,
§29.2 has failed regardless of what the mechanics do.

### 69.2 "It feels the same every floor"

**Symptom:** floors blur together.

**Likely cause:** the deal profile rotation (§33.4) is too subtle, or board growth is too slow to
change the *character* of play rather than just its size.

**First check:** compare a floor-5 and a floor-15 board side by side. If they differ only in tile
count, difficulty is growing but variety is not.

### 69.3 "The chain doesn't matter"

**Symptom:** players do not pursue the ladder.

**Likely cause:** either the ladder's spread has narrowed (band `ladderSpread`, §57.2) or its value
is invisible (§30.2).

**First check:** the ladder table (§38.4). If the numbers are fine, it is a presentation failure,
which is Phase 3.

### 69.4 "I don't know what I did wrong"

**Symptom:** mismatches feel arbitrary.

**Likely cause:** the 700ms hold (§45.3) is too short to encode, so the player is not actually
learning from mismatches and the game feels like guessing.

**First check:** measure second-attempt success on a previously-seen tile. If it is not
substantially above chance, the study interval is failing.

### 69.5 "It's exhausting"

**Symptom:** short sessions, players report fatigue rather than boredom.

**Likely cause:** board size has outrun memory capacity (§23.3), or fog shipped when it should not
have (§43.3).

**First check:** the pair curve against depth reached. If the median run ends at the same floor for
everyone regardless of skill, the wall is capacity, not challenge.

### 69.6 "The big moment stopped being big"

**Symptom:** Fever no longer lands.

**Likely cause:** either it became too frequent (band `referenceFeverShare`, §57.3) or the ceremony
was varied. §4.3(c): a ritual that changes stops being a ritual.

**First check:** how many Fevers per session? Above roughly two, it is wallpaper.

### 69.7 "There's nothing to come back for"

**Symptom:** good first session, no second.

**Likely cause:** the record is not visible enough, or improvement is not perceptible (§56).

**First check:** N11 — is the improvement delta actually positive? If players are not measurably
improving, no presentation will make them feel that they are.

### 69.8 "It's just Concentration"

**Symptom:** players do not notice the cascade at all.

**Likely cause:** the first pop did not land (§51), or the break's presentation is too quiet
relative to the match's.

**First check:** the screenshot test (§49.1). If a frame of the game does not show a blast, players
will not describe the game as having one.

### 69.9 The meta-failure: adding content to fix a feel problem

**Symptom:** somebody proposes a new mechanic because the game "needs more".

**Cause:** almost always, a loop deficiency that presentation would fix more cheaply.

**First check:** §25.2's three questions, and this document's §62.1 response — look at §30 and §40
before adding anything.

This is the failure mode that produced the dungeon layer, and it is the one most likely to recur.

---

# Part XIII — The Interface, Surface by Surface

> After the removal there are four surfaces in the entire product. This part specifies each. The
> brevity of the list is the point: every surface that is not the board is a place the player is
> not playing.

---

## §70. The board (the only surface that matters)

### 70.1 Layout

```
┌────────────────────────────────────────────────┐
│  SCORE 12,480          FLOOR 9         8 / 11  │   ← the bar: 3 items, one line
│  ▓▓▓▓▓▓▓▓▓░░░░  · Clean    · Sharp    ◆ Fever  │   ← the chain meter with rung ticks
├────────────────────────────────────────────────┤
│                                                │
│              [ the board fills                 │
│                everything that is              │
│                left ]                          │
│                                                │
├────────────────────────────────────────────────┤
│  ◈ Recall ready                    best: 14    │   ← only when true
└────────────────────────────────────────────────┘
```

Rules:
- The board takes **every pixel not required** by the bar and the meter.
- The bottom strip is **conditional**: it appears only when the Recall is charged or when the run
  has passed a personal best, and it is absent otherwise.
- Nothing overlays the board. Ever. Feedback happens *on* tiles and in the bar.

### 70.2 The bar

Three items, left to right: **score**, **depth**, **turns / par**.

- Score counts up, never jumps (§40.4).
- Depth is the largest type in the bar, because it is the record axis (§55.1).
- Turns/par is the visible goal (§41.3). It turns amber at par and stays amber; it never turns red,
  because missing par is not a failure.

### 70.3 The chain meter

A single horizontal bar with three ticks. Per §30.3(a), each tick carries a small cluster of pips
indicating the typical break size at that rung — two pips at Clean, three at Sharp, four at Fever.
The pips are how a player learns the ladder's shape without a number.

- Fill is `momentum / feverRung`, clamped.
- Crossing a tick plays the rung tone and briefly enlarges the tick.
- A mismatch drains the bar over 300ms with a falling tone (Gen 140).

### 70.4 On-tile feedback

Everything the game says, it says on the board:

| Event | On-tile expression |
|---|---|
| Flip | The tile turns; the symbol is readable at 120ms |
| Match | Both tiles lift and brighten |
| Pop | Tiles shatter outward, staggered by distance |
| Ripple wave | The next wave's tiles begin as the previous wave's finish; a visible propagation |
| Partner departure | The far half **travels** to join the blast rather than vanishing — this is the game's signature visual and it should be unmissable |
| Halo | Bordering tiles of other suits flash their own hue before going |
| Drop | Fall downward and fade |
| Score | Floats from each tile, in its suit's hue |
| Remembered (post-mismatch) | A faint persistent tint on the back |
| Aim guide | The tiles a match here would take are outlined at 40% opacity |

The "partner departure" row deserves emphasis: **a tile flying across the board to join a blast is
the single clearest expression of what makes this game different**, and it should be the most
visually distinctive event in the product.

---

## §71. Pause

One overlay, reachable from one control, containing:

- Resume
- Camera Comfort (Full / Reduced / Off)
- Text size (three steps)
- Sound and music volume
- Quit run

Five items. No stats, no codex, no achievements list, no settings sub-menus.

---

## §72. Run end

Per §42.3, in this order:

1. **The best break of the run**, replayed as a small animation, with its score and its terms.
2. **`Floor 14`** — depth, against best, with the delta.
3. **Score.**
4. **`Again`** — one button, same input as flipping a tile.
5. (Collapsed) the full summary, the record set, and the Rematch offer (§56.3).

Time from arrival to being able to press `Again`: under one second. Time from pressing it to a
playable board: under one second.

---

## §73. First launch

There is no first-launch flow. The application opens onto floor 1 of a new run, with the words
"Find a pair" under the board.

That is the entire onboarding surface, and §50 is the argument for it.

---

# Part XIV — The Score (audio, at note level)

> Audio is specified here at a level a composer could implement from, because §4.5 argues the
> rising pitch is the single most valuable stealable idea in the genre and vagueness is how it gets
> implemented as a generic sparkle.

---

## §74. The pitch system

### 74.1 The scale

**Major pentatonic**, degrees `1 2 3 5 6`. Any subset is consonant, so a break of any length is
musical.

Across three octaves that gives fifteen available pitches:

| Wave | Octave | Degrees available |
|---|---|---|
| 1 | base | 1 2 3 5 6 |
| 2 | +1 | 1 2 3 5 6 |
| 3 | +2 | 1 2 3 5 6 |
| 4+ | +2 (held) | cycles the top octave |

### 74.2 Note assignment within a wave

The *n*-th pair broken in a wave plays degree `n mod 5` of that wave's octave, ascending. A
nine-pair wave therefore runs `1 2 3 5 6 1' 2' 3' 5'` — it climbs past the octave inside a single
wave, which is correct: a huge single wave should also feel like it is ascending.

### 74.3 The root, per floor

The root shifts by a fifth every floor, cycling through all twelve. Consequences:

- A run is audibly **going somewhere**, without any explicit music change.
- Floor 12 sounds distinctly different from floor 1 in a way nobody consciously notices.
- The cycle length (12) is longer than a typical run (6–12 floors), so a run never audibly repeats.

### 74.4 Timbre by tier

| Tier | Timbre |
|---|---|
| none | Soft mallet — wood |
| clean | Mallet with a bell partial |
| sharp | Bell, brighter, longer decay |
| fever | Bell plus a low bowed drone underneath |

The timbre change is how the ear knows the tier without reading, and it is the audio equivalent of
the meter's pips.

---

## §75. The event score

| Event | Pitch | Timbre | Level | Notes |
|---|---|---|---|---|
| Tile flip | Root, −2 octaves, quiet | Card | −18dB | Column-panned |
| Second flip | Same, with a rising swell beneath | Card + pad | −16dB | The swell is the tension of the gap |
| Match | Degree 1, wave octave | Per tier | −6dB | The attack that starts the run |
| Mismatch | Root and root+1 semitone | Muted string | −8dB | The only dissonance in the game |
| Mismatch resolve | The semitone falls to a unison | Muted string | −14dB | §46.5 — "well, now you know" |
| Chain drop | Falling minor third | Low pad | −10dB | Under the mismatch |
| Pop note | §74.2 | Per tier | −6dB, ducking each subsequent note by 0.3dB | Prevents a long run becoming loud |
| Wave boundary | — | Percussive tick | −12dB | Marks the structure |
| Halo | Root+3rd+5th, base octave | Wide pad | −8dB | The only chord in normal play |
| Drop | Root −1 octave, cluster | Soft thud | −9dB | Deliberately outside the scale |
| Rung reached | The rung's own degree, held | Per tier | −5dB | Over the break |
| Recall charged | Degree 5, two octaves up | Glass | −16dB | The only "you may act" sound |
| Floor clear | Root, then 1-3-5 arpeggio ascending | Full | −4dB | Resolution |
| Fever ceremony | The run resolves to the tonic, fortissimo, over a held chord | Full + drone | −2dB | §39.3 |

### 75.1 The ducking rule

Music ducks by 6dB during any break and recovers over 400ms. It ducks by 3dB during the 150ms gap
before a resolution — a near-silence that costs nothing and is the cheapest tension available.

### 75.2 The one prohibition

**No sound may be louder for a small outcome than for a large one.** This is §16.3.2 expressed in
the mix, and it is the rule that keeps our celebration honest.

---

# Part XV — The Six Inputs to a Flip

> §3.1 claimed the flip decision has six inputs and that their interaction is where depth lives.
> This part takes each in turn, because a claim about depth that is not unpacked is a slogan.

---

## §76. Input one — what do I remember?

The base memory game, and the only input a player has on turn one.

### 76.1 The states of knowledge

A player's knowledge of any pair is in one of five states, and the design should be legible in all
five:

| State | What they know | What the board shows |
|---|---|---|
| **Unknown** | Nothing but the suit | The tile back |
| **Half-seen** | One half's symbol and position | The remembered tint, if it was a mismatch |
| **Half-seen, partner unknown** | A symbol they have seen once and cannot place | — |
| **Known** | Both positions | — |
| **Known and spent** | It has left the board | Absence |

The interesting state is the third: a symbol seen once whose partner has not been found. It creates
a specific, common, and pleasurable event — flipping a new tile and *recognising* it — which the
game currently does not acknowledge at all.

**Proposal (task, §61 addendum):** when a flip reveals a symbol the player has seen before this
floor, the game gives a distinct, quiet recognition tone. It tells them nothing they do not know;
it confirms that they know it. This is very cheap and it directly serves the game's most
distinctive emotional beat.

### 76.2 How knowledge decays

We do not currently model or acknowledge decay. §43.3's fog would make it a mechanic; §34.4's tint
partly compensates for it. Between them sits a design space nobody has explored: the game knows
exactly which tiles the player has seen and when, and it currently uses that information for
nothing.

---

## §77. Input two — what suit is it?

Suits are on the tile backs, so this input is available for *every* tile, including ones the player
knows nothing else about.

### 77.1 What the suit tells you before you flip

1. **Which region a tile belongs to**, so a match here will pop *there*.
2. **How big that region is**, so roughly how much a match will take.
3. **Whether the region is nearly exhausted**, which is the severance signal (§37.3).

The third is currently invisible and is Phase 3 work.

### 77.2 The design tension this creates

A memory game normally has *no* pre-flip information. Suits give some. That is a deliberate
reduction in the game's purity in exchange for making the cascade plannable — and it is the single
most important design decision in the product, because without it the cascade would be entirely
luck and we would be in §9.3's left column with Bejeweled.

It is worth stating that trade explicitly: **we gave up some of the memory game to make the cascade
a skill.** The exchange is good, and it should not be quietly extended — every further piece of
pre-flip information takes more from the memory game and should be justified individually.

---

## §78. Input three — where is the clump?

### 78.1 The geometry that matters

Given a suit's region, three properties determine what a match inside it takes:

1. **Density.** How many of the region's cells are still occupied.
2. **Reach coverage.** How much of the region is within `BOUNDED_BREAK_REACH` of the candidate.
3. **Island structure.** Whether the region is one clump or two (§33.3 deals two for suits of three
   or more pairs).

Property 3 is the one with strategic teeth: a match in island A, at a tier below Sharp, cannot
reach island B — but a *pair straddling both* can bridge them, and at Sharp the bridge becomes a
reaction.

### 78.2 The best move in the game

Combining §78.1 with the ladder: **the highest-value single move available in this design is
matching a straddling pair at Sharp inside a dense two-island suit.** It takes island A, bridges to
island B, and each departure seeds a further wave.

That move should have a name, in the §8.3 sense. The design's job is to make it discoverable
(Phase 3), and the community's job — if there is one — is to name it.

---

## §79. Input four — what tier am I at?

### 79.1 The multiplier table, from the player's seat

| At tier | A match takes | Relative to chain one |
|---|---|---|
| none | 1.18 pairs | 1.0× |
| clean | 2.32 | 2.0× |
| sharp | 2.71 | 2.3× |
| fever | 3.71 | 3.1× |

And with §40.2's scoring, the *score* multipliers are 1 / 2 / 4 / 8 on top of that, so the same
pair matched at Fever rather than at chain one is worth roughly **25×**.

### 79.2 The asymmetry that makes it interesting

Climbing is cheap early (Clean is three matches) and expensive late (Fever is half the floor). So
the marginal value of one more match on the chain is not constant — it is small between chain 1 and
2, large between chain 5 and 6 on a twelve-pair floor because that crosses Sharp.

A player who understands this plays differently near a rung than in the middle of a stretch, which
is exactly the kind of local structure that produces expertise. Making the *distance to the next
rung* prominent (the meter already does) is therefore doing more work than it appears.

---

## §80. Input five — how much of this suit is left?

The severance input (§37.3). Under the specified rule this becomes a first-class strategic
consideration:

- A suit reduced to pairs that cannot reach each other **drops**.
- Therefore breaking the *connecting* pairs of a suit is worth more than its face value.
- Therefore a small, unimpressive match can be the best move on the board (Trace 2, option c).

This is the Puzzle Bobble severance skill (§5.2) and it is the design's deepest single mechanic,
because it rewards seeing structure rather than remembering harder.

**It requires interface support to exist at all**, and that support does not exist. Without a
suit-level "this suit is one break from severing" signal, no player will ever find this. Phase 3.

---

## §81. Input six — how close am I to Fever?

The momentum input. Its distinguishing property is that it is **fed by the breaks themselves**, so
a big break accelerates the ladder, which makes the next break bigger.

### 81.1 The positive feedback loop, and its bound

```
bigger break → more momentum → higher tier → bigger break
```

Unbounded, this would mean one good break wins the floor. Three things bound it:

1. **The pop's half credit** (§38.1) — the guaranteed part of a break contributes less.
2. **The floor is finite** — a big break removes the material for the next one.
3. **The rungs scale with floor size** — a bigger floor needs more momentum.

Bound (2) is the interesting one: **the loop is self-limiting because success consumes its own
fuel.** That is an unusually elegant property and it means we never need an artificial cap.

### 81.2 The consequence for floor shape

Because momentum accumulates and the board depletes, a floor has a natural arc:

- **Early:** low tier, small breaks, lots of board.
- **Middle:** rising tier, growing breaks, board depleting.
- **Late:** highest tier, but little left to break.

The peak is in the *middle*, which is where a floor's spectacle should be — and it is why §18.3(a)
noted the tension with prediction error (which is highest early, when the player knows least).

**The reconciliation:** early breaks are *surprising*, middle breaks are *large*, and late breaks
are *clean*. Three different pleasures across ninety seconds, which is a better shape than one
pleasure escalating.

---

# Part XVI — The Mathematics of the Cascade

> This part derives, from first principles, how much a break should take — so that the constants in
> Part V can be checked against a model rather than only against a simulation. Where the model and
> the simulation disagree, the simulation is right and the model is a useful lie; the point of the
> model is to say *why* a number is roughly what it is.

---

## §82. The basic quantity

Let:

- `p` = pairs in a suit
- `d` = the suit's density in its region (occupied cells / region cells)
- `r` = the reach (2 for bounded tiers, ∞ for Sharp and above)
- `k` = the number of the suit's cells within reach of a random cell

For a roughly-square clump, the number of cells within `r` steps of a point (orthogonal movement)
is `2r² + 2r + 1` — 13 for `r = 2` — bounded by the region's size.

So a bounded pop touches about `min(13, regionCells) × d` of the suit's tiles.

### 82.1 From tiles to pairs

Below Clean, a pair goes only if *both* halves are in the region. If a suit's two halves are placed
independently within a region of `c` cells, the probability both are within the reach set of `k`
cells is approximately `(k/c)²`.

For a suit of six pairs (twelve tiles) laid in a region of about sixteen cells, `k = 13`:

```
P(both halves in reach) ≈ (13/16)² ≈ 0.66
expected pairs taken ≈ 6 × 0.66 ≈ 4
```

Which is far more than the measured 1.18 at chain one. The discrepancy is instructive and has three
causes:

1. **Regions are not square.** §33.3 lays suits as two clumps seeded apart, so `c` is effectively
   two smaller regions and `k/c` is much lower for cross-island pairs.
2. **Reach walks through hidden tiles only**, and matched tiles create holes that block propagation.
3. **The match's own pair is excluded**, and the board is depleting.

The model's value is in the *shape* it predicts, not the magnitude: **expected pairs taken rises
with density and falls with island separation**, which is exactly the lever §33.3 uses.

### 82.2 At Clean

The partner rule means a pair goes if *either* half is in reach:

```
P(either half in reach) = 1 - (1 - k/c)²
```

For the same numbers: `1 - (1 - 0.81)² ≈ 0.96`.

So the model predicts Clean roughly *doubles* the pop over the contact rule, which matches the
measured 1.18 → 2.32 almost exactly. **This is the one place where the model and the measurement
agree closely**, and it is reassuring because it is the mechanism we most recently rebuilt.

### 82.3 At Sharp

Reach is unbounded within the region, so the first wave takes the whole connected island. Then
every partner pulled from the other island seeds a wave there.

Expected pairs ≈ `p × (fraction of the suit reachable through the reaction)`, which for a two-island
suit with any straddling pair is close to `p` — the whole suit.

Measured: 2.71 against a mean suit of about seven pairs. The gap is because most pairs in a suit are
not breakable (in the pre-removal game, roughly half were dungeon cards) and because a suit is often
already partly cleared.

**Prediction: after the removal, Sharp should move much closer to the whole-suit figure**, because
the "roughly half are dungeon cards" term disappears. If it does not, §82's model is wrong
somewhere and that is worth finding out. This is the sharpest testable prediction in the document.

---

## §83. The score curve, derived

### 83.1 What we want the curve to do

Three requirements:

1. **A great break should be worth talking about** — at least two orders of magnitude above an
   ordinary one.
2. **An ordinary break should still be worth having** — its share of a floor's score should not be
   negligible (band N5).
3. **The curve should reward concentration over accumulation**, per the Tetris/Puyo/Balatro
   convergence.

### 83.2 Why multiplicative satisfies all three

With `score = pairs × chainMult × waveMult`:

- Requirement 1: `12 × 8 × 5.5 = 528` against `1 × 1 × 1 = 1`. ✓
- Requirement 2: an ordinary Clean break of 2 pairs at 1 wave scores 4, and a floor has many of
  them; their aggregate share is what N5 measures. ✓
- Requirement 3: two breaks of 4 pairs at Clean score `4×2 + 4×2 = 16`; one break of 8 pairs at
  Sharp with 3 waves scores `8 × 4 × 2.5 = 80`. Five times as much for the same pairs. ✓

### 83.3 Choosing the constants

`CHAIN_MULT` doubling per rung (1, 2, 4, 8) is chosen because:
- It matches the *measured* pairs-per-match ratio (1.0, 2.0, 2.3, 3.1) closely enough at the bottom
  and amplifies it at the top, which is where we want amplification.
- Powers of two are legible to a player watching the multiplier build (§40.4).
- Puyo's curve doubles per link; Tetris's line curve is close to `n²`. Doubling sits between them
  and is the more conservative choice.

`WAVE_MULT_STEP = 0.75` and `WAVE_MULT_CAP = 6` are chosen so a four-wave reaction is worth about
3.25× and an eight-wave one is capped at 6×. The cap exists because `RIPPLE_MAX_WAVES` is 12 and an
uncapped linear step would make a rare twelve-wave break worth 9.25×, which is a large amount of
variance riding on one unusual board.

### 83.4 The sanity check that must be run before shipping

Compute, over a simulated run:

```
largestBreakShare = maxBreakScore(floor) / totalScore(floor)
```

and check the distribution against band N5 (0.25–0.70). If the median is above 0.70, reduce
`CHAIN_MULT.fever` to 6; if below 0.25, raise `WAVE_MULT_STEP`. **Do not ship the curve without
this measurement** — it is the one number that decides whether §40.3's objection is right.

---

## §84. The expected floor

Putting the pieces together, a model of a twelve-pair floor played by a competent player:

| Turn | Tier | Expected pairs taken | Pairs remaining | Cumulative score (nominal) |
|---|---|---|---|---|
| 1 | none | 1.2 | 10.8 | 12 |
| 2 | none | 1.2 | 9.6 | 24 |
| 3 | clean | 2.3 | 7.3 | 70 |
| 4 | clean | 2.3 | 5.0 | 116 |
| 5 | sharp | 2.7 | 2.3 | 386 |
| 6 | sharp | 2.3 (board-limited) | 0 | 616 |

Six turns against a par of ten (§41.3), which is a good floor. Note:

- **The board runs out before the ladder does.** The player reached Sharp and never Fever, because
  twelve pairs cannot sustain a chain to seven momentum *and* have anything left.
- This is precisely the Gen 170 finding (§39) restated as a model, and it is why Fever moved to
  half a floor.
- **On a twenty-pair floor the same model reaches Fever on turn 8 with six pairs left**, which is
  the shape we want: the top rung arrives with material still on the board.

### 84.1 The design implication

**Fever is a deep-floor mechanic.** On floors under about fifteen pairs it will be rare regardless
of play; on floors above twenty it should be routine for a good player.

That is a *good* property — it means the run has a shape where the game's biggest moment becomes
available as you go deeper, which is exactly §12's ascent at the run scale rather than the floor
scale. It should be stated to the player implicitly (the meter's Fever tick is further away on
small floors, which it already is) and it argues against §32.2 flattening the pair curve too
aggressively at depth.

**This is a real tension in the specification:** §23.3 wants slower growth for memory reasons,
§84.1 wants continued growth for Fever reasons. The resolution in §32.2 (square-root growth) is a
compromise, and Appendix E.1 records it as unsettled.

---

# Part XVII — Positioning

> A design document that ignores who the game is for produces a game for nobody. This part is
> shorter than the others because most of it is somebody else's job, but the parts that constrain
> design belong here.

---

## §85. What this product is

**A premium, one-purchase, no-monetisation-in-the-loop arcade puzzle game**, sold once, playable
forever, with no account, no server, and no data leaving the machine.

Every clause is a design constraint:

- **Premium** means §16.4(a) applies: there is no mechanism to profit from a player's inability to
  stop, so compulsion techniques extract nothing.
- **One purchase** means the game must be *complete* at purchase. No content roadmap dependency.
- **No monetisation in the loop** means §25.1.5 is structural rather than a policy that could be
  reversed under pressure.
- **No account, no server** means §56's improvement measurement is local, which is both a privacy
  property and a constraint on what we can know.

## §86. Who it is for

Three audiences, in order of how well the design serves them:

**(a) The person who likes puzzle games with a spectacle.** Peggle, Puyo, Puzzle Bobble, Threes,
2048. They will recognise the genre immediately and the memory input as novel.

**(b) The person who plays a game for ten minutes at a time.** The session shape (§53) is built for
them, and the no-account, no-timer, no-decay stance means the game never punishes irregular play.

**(c) The person who likes memory games.** They are served, but they are not the target, and it is
worth being explicit: **the design repeatedly trades memory purity for cascade quality** (§77.2).
A player who wants Concentration will find this noisy.

## §87. What it is not for

- Players who want a long-form roguelike with builds. §44.3 removed the build layer.
- Players who want narrative.
- Players who want competitive multiplayer.
- Players who want a daily obligation. §25.1.

## §88. The positioning problem, named

Per §F.12: "memory game" is a poor category. The product must present as a **cascade game with a
memory input**, not as a memory game with effects.

This has one hard design consequence: **the first frame anybody sees must contain a detonation**
(§49.1). That applies to the store page, the trailer's first second, and any screenshot. It is a
design requirement, not a marketing one, because it constrains what the board must look like in
motion.

## §89. Pricing and scope, as a constraint on the plan

A one-purchase premium puzzle game in this segment sits in a well-understood price band, and the
scope implied by that band is roughly: **a complete, deep, small game — not a large one.**

This is the strongest external argument for the removal. A game with eleven card kinds, four modes,
a relic system and a shop is priced and scoped like a much larger product than this team is
building, and it will be judged against that scope. A game with one board, one loop and one number
is judged on how good the loop is — which is the comparison we want, because that is where the
work has gone.

---

# Part XVIII — Content Without Content

> The obvious objection to a game with one loop and no content system is that it will run out. This
> part is the plan for depth over time that does not involve adding rules.

---

## §90. The five sources of longevity that are not content

### 90.1 Geometry

Every board is a new arrangement of the same pieces, and the *interesting* variation is not
symbol layout but **suit topology**: how many islands, how separated, how many straddling pairs,
how dense.

That is a large space and we currently sample a small part of it. §33.4's profile rotation is a
crude first pass. A richer generator could produce recognisable board *shapes* — a long thin suit
that runs the board's diagonal, a suit that rings another, two suits interleaved like a
checkerboard — each of which plays differently under the same rules.

**This is the single largest untapped source of variety in the design**, it requires no new rules,
and it is invisible as a "system" to the player: they just notice that boards feel different.

### 90.2 Depth

The pair curve means floor 30 is a different game from floor 5, not because rules changed but
because twenty-one pairs is past most players' comfortable capacity. The depth axis is
self-renewing as the player improves.

### 90.3 Mastery of the existing mechanics

§78.2's "best move in the game" is not documented, taught, or hinted at. A player who discovers it
has found something real. There are probably a dozen such patterns, and each is a small piece of
content that costs nothing to make and that the player experiences as insight rather than as
unlocked material.

**The design's job is to make them discoverable; it is not to name them.** Naming them is what a
community does (§8.3).

### 90.4 The record

§55. A number to beat is the oldest content system there is and it does not deplete.

### 90.5 The Rematch

§56.3. Replaying a board you have played is normally a failure of content; here it is the
measurement of improvement, which makes repetition the point rather than a compromise.

---

## §91. What we would add first, if we added anything

In order, with the precondition for each:

| Order | Addition | Precondition |
|---|---|---|
| 1 | **Richer suit topology generation** (§90.1) | None — this is free variety and should probably be Phase 2.5 |
| 2 | **Authored landmark floors** every N floors | Procedural floors are good (§F.8's discipline: each must name what it guarantees) |
| 3 | **A daily seed** | Phase 3 complete (Appendix C.7) |
| 4 | **Authored puzzles inside the one mode** | Phase 3 complete |
| 5 | **A build layer** | Phases 3 and 4 complete, plus a written answer to "what does this add that the Recall does not?" (Appendix C.8) |

Note that (1) is not really an addition — it is finishing the generator we have. The first genuine
*addition* is at position 2, and it is authored geometry rather than a new rule.

## §92. The rule for all future additions

Restating §25.2 as a commitment:

> **Nothing ships that is not downstream of the flip, that does not move a measured band, or whose
> mechanic would not be worth having with its flourish removed.**

And the corollary that the dungeon layer's history teaches:

> **Nothing ships without a counter and a cadence, and the occupancy census must see it fire on the
> floors real players play, within one generation of shipping.**

---

# Part XIX — The Long Game

> Where this goes if it works, and what would have to be true at each step. Speculative, marked as
> such, and included because a plan that only covers the next eight weeks tends to make decisions
> that are wrong on a two-year view.

---

## §93. Year one — the loop is the product

The plan in Part X, shipped. The measure of success is not sales; it is whether the four claims of
§1.4 hold:

1. A new player reaches their first ripple in their first three floors.
2. Each rung takes visibly more.
3. A clean player reaches Fever on at least one floor in ten.
4. Nothing in the game is decoration.

If those hold and the game still is not compelling, the thesis in §26 is wrong and no amount of
content will rescue it. That is a hard thing to write down in advance, and it is exactly why it
should be written down in advance.

## §94. Year two — the community, if there is one

§8.3's Puyo vocabulary is the outcome to hope for and cannot be manufactured. What *can* be done is
to remove the obstacles to it:

- **Shareable boards.** Seeds are already a stable identifier; a board can be shared as a short
  code. (Some of this shipped at Gens 53–56 and would survive the removal.)
- **A replay format.** Deterministic simulation means a run is a seed plus a list of flips, which is
  tiny. A replay is a thing a player can send somebody.
- **Naming nothing ourselves.** If we name the straddling-pair-at-Sharp move in our own copy, we
  foreclose the community naming it. The copy should describe mechanics, never strategies.

## §95. What would make us add a mode back

Stated in advance so it is not decided in a moment of enthusiasm:

**A daily seed** is added when: Phase 3 is complete, the improvement measurement (§56.4) shows a
positive delta, and there is a reason to believe a shared board would be discussed. It is the
cheapest mode and the one most aligned with §90.5.

**Nothing else.** Not a timed mode, not a zen mode, not a puzzle pack as a separate mode. If
authored boards happen, they are floors in the one mode.

## §96. The failure case, and what we would do

If the game ships and does not find an audience, the honest possibilities in order of likelihood:

1. **Positioning.** The category problem of §88, which is solvable and not a design failure.
2. **The loop is good but shallow.** §62.1. The response is Phase 3 and the suit topology work,
   not content.
3. **The memory input is a barrier.** Some proportion of players simply will not enjoy being tested.
   This is not fixable and it bounds the audience; it should be accepted rather than designed
   around by weakening the memory game.
4. **The thesis is wrong.** §28's claim about memory as a source of cascade uncertainty does not
   land experientially. This would be the most interesting failure and the one worth writing up.

## §97. The thing worth keeping regardless

Whatever happens to this product, the instrumentation is the transferable asset. Four simulations
that play the real game and report on it, a census that catches dead content, and a habit of
writing the measurement next to the decision — that is a way of working, and it is what produced
every finding in Appendix I.

The dungeon layer was removed not because somebody disliked it but because the game's own
instruments said, over six generations and in four independent ways, that it was not happening.
That is worth more than any single design decision in this document.

---

# Part XX — A Close Reading of the Loop's Emotional Beats

> Part V says what happens. This part says what it is *like*, beat by beat, because a designer
> tuning a number needs to know which feeling that number is serving.

---

## §98. The eight feelings

The loop produces eight distinguishable emotional states. Each has a beat that produces it, a
number that controls it, and a failure mode.

### 98.1 Anticipation — "I think I know where it is"

**Beat:** the moment before the first flip (§27.1 Beat 0).
**Controlled by:** how much the board shows without flipping — suits, absences, the aim guide.
**Produced by:** the player's own partial knowledge.
**Failure mode:** if the board shows too little, this is blank; too much, and it collapses into
certainty, which is not anticipation.

This is the state the player spends the most *time* in and the one we design for the least. Beat 0
is player-paced and indefinite, and the entire strategic layer (§30) lives inside it.

### 98.2 Commitment — "I'm going to say it's here"

**Beat:** the second tile press (§27.1 Beat 1–2).
**Controlled by:** the 150ms gap, and the audio swell under it.
**Produced by:** the irreversibility of the flip.
**Failure mode:** if resolution is instant, there is no commitment, only a result. This is why §45.2
insists the gap must not be shortened for "responsiveness" — responsiveness here would delete the
feeling.

No other game in Part II has this beat, and it is the emotional signature of a memory input.

### 98.3 Vindication — "I was right"

**Beat:** resolution, on a match (Beat 3).
**Controlled by:** the clarity and immediacy of the match signal.
**Produced by:** the confirmation of a belief.
**Failure mode:** if a match is presented identically to the break that follows it, vindication is
swallowed by spectacle. The bell attack (§46.2) exists to give the *recall* its own moment before
the *consequence* arrives.

### 98.4 Escalation — "it's still going"

**Beat:** the ripple's waves (Beat 5).
**Controlled by:** wave stagger (160ms), the octave shift, the per-wave tick.
**Produced by:** an incomplete musical phrase and an unfinished animation.
**Failure mode:** if waves resolve simultaneously, there is no escalation, only a big flash. The
stagger is the feeling.

### 98.5 Surprise — "I didn't know it would reach that far"

**Beat:** a wave taking tiles the player had not accounted for (Beat 5).
**Controlled by:** the gap between the player's knowledge and the board's content, which is why
early-floor breaks surprise more (§18.3a).
**Produced by:** prediction error.
**Failure mode:** if the player can compute the whole cascade, there is no surprise; if they can
compute none of it, there is no credit. §18.2's sweet spot.

### 98.6 Mastery — "I set that up"

**Beat:** a break that went exactly as planned, especially a held pair spent at Sharp.
**Controlled by:** whether the strategic layer is visible (§30) — you cannot feel you planned
something the game never let you plan.
**Produced by:** a confirmed prediction, which is the *opposite* of §98.5 and equally valuable.
**Failure mode:** currently, near-total, because §30's inputs are invisible. **This is the feeling
the game is most missing.**

### 98.7 Relief — "the board is manageable again"

**Beat:** a large break clearing tiles the player had failed to memorise.
**Controlled by:** break size relative to remaining board.
**Produced by:** cognitive load dropping.
**Failure mode:** only exists if load was high, which is why §20.5's self-balancing loop (playing
well makes the board smaller) is doing emotional work as well as difficulty work.

This is the feeling Zuma's pushed-back line produces (§10.2b) and it is one we get for free.

### 98.8 Ceremony — "the game stopped to show me"

**Beat:** Fever (§39.3), and in miniature, the floor clear.
**Controlled by:** the freeze, the ritual's invariance, the disproportion of the payout.
**Produced by:** the game taking control away at the moment of triumph.
**Failure mode:** happening too often (wallpaper), or varying (not a ritual).

---

## §99. The map of feelings to floor position

| Floor position | Dominant feeling | Why |
|---|---|---|
| Turns 1–2 | Anticipation, commitment | Nothing is known; every flip is exploration |
| Turns 2–4 | Surprise | Breaks reach through unknown tiles |
| Turns 4–6 | Escalation, relief | The chain climbs; the board shrinks |
| Turns 6–8 | Mastery, ceremony | Knowledge is nearly complete; the biggest breaks land |
| Final turns | Completion | The tail, which §41.2 works to shorten |

**The design intent:** three different pleasures across ninety seconds, in a fixed order, repeating
every floor. That repetition is not monotony — it is the same structure as a pop song's verse and
chorus, and it is why a floor should be short enough to feel like a phrase.

---

## §100. The feeling we do not have and should

Reading §98, one gap stands out: **there is no feeling associated with learning.** The player is
constantly memorising, and the game acknowledges it nowhere except in the mismatch's 700ms hold.

§76.1's proposal — a quiet recognition tone when a flip reveals a symbol seen before this floor —
is the smallest possible fix, and it serves the game's most distinctive property. It costs one
sound and a set of seen-symbols.

**Added to the task register as T4.10.**

---

# Part XXI — What We Learned Building the Wrong Game

> Six generations of instrumented work went into making the dungeon layer function. It is worth
> extracting the transferable lessons before the code goes, because most of them are not about
> dungeons.

---

## §101. Nine lessons

### 101.1 A unit test proves a rule works; it does not prove the rule happens

Every one of the eleven silent systems had passing tests. The tests built the board the rule
needed. Generation never did.

**The general form:** any test that constructs its own fixture is testing the *rule*, not the
*game*. A codebase needs at least one instrument that plays the game as generated and reports what
occurred.

### 101.2 Two systems competing for one resource will be resolved by whichever was written first

The dungeon's pair budget was the floor's entire pair count, and it had been for a long time,
because the dungeon existed before the cascade did. Nobody chose that; it was the default and it
survived by inertia.

**The general form:** when two systems share a scarce resource, write down the split explicitly,
even if the split is 100/0. An implicit split is a decision nobody made.

### 101.3 A taxonomy that scores items individually cannot see an aggregate problem

The memory-tax framework scored all eleven card kinds `core_safe` and was right about each of them.

**The general form:** if a framework scores items, it needs a term for the *portfolio*. "How many
of these can coexist?" is a different question from "is this one acceptable?"

### 101.4 Special-case protection is a smell with a number attached

The card trimmer needed four passes of protection to survive a 25% budget cut. That number is a
measurement of coupling.

**The general form:** count the special cases needed to keep a system correct under a small
perturbation. If it is more than one or two, the system's parts are mutually load-bearing.

### 101.5 An instrument that re-derives a rule will drift toward the author's expectation

Gen 170: `sim:cascade` counted Fever breaks by re-computing the tier, and was wrong by 5× in the
optimistic direction.

**The general form:** instruments read; they do not compute. Where an instrument must compute, it
should be audited against one that only reads.

### 101.6 A band tuned on a small sample measures the sample

Three separate fixtures in Gens 168–170 failed on sample size rather than on the game. Each time,
widening the sample was the correct fix and narrowing the band would have been the tempting one.

**The general form:** before moving a band, check whether the measurement is stable at twice the
sample.

### 101.7 A measurement can be right and the wrong measurement

`feverBreaksThisFloor` at 4% looked like a Fever problem. It was: but the deeper finding was that
momentum reached the rung on 61% of floors and there was nothing left to break. The rate was
correct; the diagnosis required a second measurement nobody had taken.

**The general form:** when a number is bad, measure the thing *upstream* of it before changing the
thing that produces it.

### 101.8 Content that ships with a counter is content you can delete confidently

The reason this removal is defensible rather than reckless is that eleven counters read zero. Had
those systems shipped without counters, the argument would have been aesthetic and would have gone
on forever.

**The general form, and the one worth institutionalising:** every mechanic ships with a counter and
a stated cadence, and the census sees it within one generation. This is standing task Gen 162 and
it should be a rule rather than a task.

### 101.9 The instrumentation outlives the design

Every simulation in this repository will survive the removal unchanged in purpose. They were built
to answer questions about a game that is about to stop existing, and they will answer the same
questions about its replacement.

**The general form:** invest in instruments, not in dashboards. An instrument that plays the game
is portable across designs; a dashboard of a specific system dies with it.

---

# Part XXII — Comparative Session Arcs

> A minute-by-minute comparison of what a player experiences in the first ten minutes of our game
> against three references. The purpose is to check that our arc has the same density of *events*
> as products known to hook.

---

## §102. The first ten minutes, four ways

| Minute | Peggle | Vampire Survivors | Balatro | **Ours (specified)** |
|---|---|---|---|---|
| 0:00 | Menu, level select | Character select | Deck select | **Board. "Find a pair."** |
| 0:15 | First shot; pegs light | First enemies; one weapon | First hand dealt | **First match; the board detonates** |
| 0:30 | A lucky bounce clears eight pegs | First level-up choice | First scoring hand | **Floor 1 clear; floor 2 begins in place** |
| 1:00 | Level 1 cleared; Extreme Fever | Second weapon; screen busier | Blind cleared | **Floor 2: a blast stops at a colour boundary** |
| 1:30 | Level 2; a new peg layout | Enemies in formations | First joker | **Floor 3: a tile flies in from across the board** |
| 2:00 | A Master power introduced | Evolution hinted | Shop | **Floor 4; procedural, larger** |
| 3:00 | Level 3–4 | Screen full of effects | Ante 2 | **Floors 5–6; first Sharp reaction** |
| 5:00 | A level fails; retry | First run ends; restart | First run ends | **Run 1 ends or continues; personal best set** |
| 7:00 | Level 5–6 | Run 2, better build | Run 2, new deck | **Run 2; deeper, faster** |
| 10:00 | A world completed | Mid-run, powerful | Ante 4 | **First Fever, probably** |

### 102.1 What the comparison shows

**We are competitive on time-to-first-event.** Our first spectacle is at 0:15, which is earlier than
any of the three. That is a direct consequence of the authored floor 1 and of the pop being
guaranteed on every match.

**We are competitive on event density in minutes 0–2**, because three teaching moments land in the
first ninety seconds.

**We are thin from minute 3 to minute 7.** All three references introduce a *new kind of thing* in
that window — a Master power, an evolution, a joker. We introduce a larger board.

That is the honest gap, and this document's answer is deliberate: the thing that arrives in minutes
3–7 is **the strategic layer** — the player noticing that holding a pair is worth something. That
is a discovery rather than an introduction, and discoveries are less reliable than gifts.

**This is the strongest argument for Phase 3 being high priority rather than a polish phase.** If
the player does not notice the hold decision by minute five, our arc has a hole exactly where the
references have their best material.

**And it is the strongest argument for the Recall (§44.2) as the one power**, because a power that
charges on a large break gives minutes 3–7 a *gift* as well as a discovery: something new appears,
you did not have to find it, and it is earned by the thing the game is about.

---

# Part XXIII — "Why Not Just…?"

> Ten alternative designs somebody could reasonably prefer, and why this document does not choose
> them. Each is a real design, not a straw man.

---

## §103. Why not just make a good memory game?

**The design:** drop the cascade entirely. Polish Concentration — beautiful tiles, perfect timing,
elegant scoring, a difficulty curve.

**Why not:** because the ceiling is low and known. Concentration's skill expression is "remember
better", and there is no strategic layer at all — no decision beyond which tile to try. Every
digital memory game in existence occupies this space and none of them is remembered.

**What it gets right:** purity. §77.2 admits we trade memory purity for cascade quality, and this
alternative is what we are trading away.

---

## §104. Why not just make a good cascade game?

**The design:** drop the memory. Tiles are face-up; you match adjacent same-suit groups; the
cascade does everything Part V says.

**Why not:** the uncertainty disappears. §28.1's problem returns immediately — with a fully visible
board, the player can compute the whole cascade, and the game becomes an optimisation puzzle rather
than an act of nerve. It also puts us into direct competition with Bejeweled, Puyo and Tetris
Attack, where we would be the worst entry.

**What it gets right:** accessibility. This version excludes nobody.

---

## §105. Why not a hybrid where the player chooses to peek?

**The design:** tiles are face-down, but the player can hold a button to see the whole board at a
cost (score, time, a resource).

**Why not:** it converts the memory game into a resource-management game about *when to look*,
which is a different and much shallower decision than *what to remember*. It also means the
optimal strategy is computable, which kills §98.2's commitment beat.

**What it gets right:** it removes the exclusion of §23.5(c), which is a real cost of our design.
The Recall (§44.2) is the bounded version of this idea and was chosen precisely because it gives
some of the benefit without collapsing the decision.

---

## §106. Why not keep the dungeon and cut the cascade?

**The design:** a memory-based roguelite. Keys, locks, bosses, routes, relics — all of it — with
matching as the resolution mechanic and no cascade.

**Why not:** the eleven silent systems say this design was not working either. And its core loop
would be "flip tiles until you find the thing the objective wants", which is a search task rather
than a game of consequence.

**What it gets right:** it has more nouns, and nouns are easy to market. §89 is the counter.

---

## §107. Why not a puzzle game with authored boards?

**The design:** hand-authored boards with a par, like a chess problem. No procedural generation, no
run, no depth axis.

**Why not:** authoring is expensive and finite, and the memory input makes a board *unrepeatable*
in a way a chess problem is not — once you have solved it, you know where everything is, so the
second play is a different and much easier game.

**What it gets right:** guaranteed quality per board. Appendix C.7 keeps a version of this as
**LATER** — authored floors inside the one mode, for teaching moments and landmarks.

---

## §108. Why not make it multiplayer?

**The design:** two players, same board, alternate turns, chains steal from each other.

**Why not:** it is a different product with different infrastructure, and it converts a calm
solitary activity into a competitive one, which changes the audience entirely. §7.6.

**What it gets right:** memory games are genuinely good at the kitchen table, and the pass-and-play
work already shipped (Gens 91–98) proves it can work. It survives as a possibility for later,
outside this document's scope.

---

## §109. Why not make it an idle game?

**The design:** the board plays itself slowly; the player intervenes to accelerate.

**Why not:** §11.4. The moment the game earns without the player, the player is optional.

---

## §110. Why not a time attack?

**The design:** clear as many floors as possible in three minutes.

**Why not:** §23.5(b) — time pressure on a memory task converts a pleasant challenge into an
unpleasant one very fast, and forgetting under a clock feels like personal failure.

**What it gets right:** a bounded session with a clean comparison. §55's records give us the
comparison without the clock.

---

## §111. Why not let the chain persist across floors?

**The design:** the chain does not reset at a floor boundary, so a great run compounds.

**Why not:** it removes the per-floor ascent (§12.3), which is the design's best structural
property — the compressed, repeatable, always-palpable climb. A persistent chain would make floors
1–3 irrelevant preamble to a long tail, which is the opposite shape.

**What it gets right:** it would make a run feel more continuous. §41.5 chooses the repeated ascent
instead, deliberately.

---

## §112. Why not add a second board mechanic — gravity?

**The design:** when tiles leave, the tiles above fall, as in Tetris Attack and Puyo.

**Why not, and this is the closest call in this appendix:** gravity is the mechanic that makes
those games' cascades *automatic*, and it would give us a genuinely new source of chain — tiles
falling into new adjacencies. It is downstream of the flip, it moves bands, and it survives without
its flourish. By §25.2 it is a legitimate candidate.

**The reason it is not in the plan:** it breaks invariant I2. If tiles fall, every memorised
position changes, and a memory game whose board rearranges itself after every match is a memory
game that punishes memory. Puyo can do this because its board is fully visible; ours cannot.

**But it is worth recording as the most interesting rejected idea in this document**, and if
somebody finds a way to have falling *without* moving what the player has memorised — for example,
tiles falling only within their own suit region, or a "settle" that happens only at floor end —
that is worth hearing.

---

# Part XXIV — Phase Briefs

> One page per phase, written so that somebody picking up a phase does not have to read the whole
> document. Each brief states the goal, the shipped outcome, the acceptance, and the one thing most
> likely to go wrong.

---

## §113. Phase 1 brief — The Removal

**Goal.** Take the dungeon layer and the extra modes out of the game, leaving one board, one loop,
one mode, and every pair available to the cascade.

**Shipped outcome.** A player opens the game onto a board of suited pairs. They flip, they match,
things detonate. The floor ends when the board is empty. There is no exit, no key, no shop, no
route, no trap, no decoy, no boss, no gold, no relic, and no mode selection.

**Acceptance.**
- `ls src/shared/dungeon-*` is empty.
- `GameMode` has one member.
- Every generated floor satisfies `tiles.length === 2 × pairCount`.
- The occupancy census's silent list is **empty**.
- Every band is re-measured and ratcheted, with before/after in `BALANCE_NOTES.md`.

**The thing most likely to go wrong.** Deleting before you stop generating (§L.9). The game must be
playable after every single task; if it is not, the ordering was wrong.

**Rough size.** The largest phase. 93 files reference `dungeonCardKind`; expect the test suite to
shrink by a third.

---

## §114. Phase 2 brief — The Loop Made Whole

**Goal.** With the board to itself, finish the loop: the right pair curve, the teaching floors, the
severance drop, multiplicative scoring, par, and a run that ends properly.

**Shipped outcome.** Floor 1 is three pairs of one suit and pops on the first match. The pair curve
grows on a tempered curve. A suit that can no longer pop drops. A great break is worth two orders
of magnitude more than an ordinary one. Every floor states a par. There are no lives.

**Acceptance.**
- N6, N7: the first pop and the cross-board reach are guaranteed in the first three floors.
- N8: the drop fires on at least a quarter of floors.
- N5: the largest break's share of a floor's score sits between 0.25 and 0.70.
- Trace §67 reproduced as a test: a bad floor is quiet, not punishing.

**The thing most likely to go wrong.** Shipping the score curve without §83.4's sanity check, or the
severance drop without §F.7's distribution measurement. Both are one measurement each and both are
the difference between a good change and a floor-trivialising one.

---

## §115. Phase 3 brief — The Strategic Layer

**Goal.** Make the game's central decision — spend a known pair now or hold it for a higher tier —
visible.

**Shipped outcome.** Hovering or long-pressing a tile shows what a match there takes at the current
tier, and ghosts what it would take at the next. The chain meter's rungs carry weight. A player can
mark a pair they are saving. A suit about to sever is signposted. The score builds term by term.

**Acceptance.** In playtesting (§T.3), a player declines to match a pair they clearly know, at least
once, within their first three runs.

**The thing most likely to go wrong.** Treating this as polish and deferring it. §102.1 shows this
is the material that fills minutes 3–7, which is where every reference product puts its best
content. **It is loop work.**

---

## §116. Phase 4 brief — Feel

**Goal.** Every millisecond, every sound, every shake, to the specification.

**Shipped outcome.** The timing table of §45 exactly. Pitch rises per pair *and* per wave. Shake is
a decaying scalar that survives hit-stop and replays identically. Camera Comfort has three
positions. The Fever ceremony is 2.6 seconds and identical every time. A drop falls; it does not
shatter. A mismatch is presented as an exchange. A partner travelling across the board is the most
distinctive thing on screen.

**Acceptance.** The screenshot test (§49.1) passes. A greyscale board is playable. The reduced-motion
variant preserves every timing and every piece of information.

**The thing most likely to go wrong.** Moderating the excess. §S.7 — the tuning instinct will want
to shorten the ceremony and soften the shake, and the excess is the point.

---

## §117. Phase 5 brief — The Run and the Record

**Goal.** Give the player a reason to come back that is a true statement about them.

**Shipped outcome.** Depth is the headline record. Five records, no currencies. The run-end screen
leads with the best break of the run, replayed. One input restarts. The Rematch offers the seed of
a previous personal best and shows the delta.

**Acceptance.** N10 (median floors per run ≥ 6) and N11 (improvement delta > 0) are measurable and
positive.

**The thing most likely to go wrong.** N11 coming back at or below zero, which would mean the game
is not teachable and would invalidate much of Part VIII. It is worth measuring early rather than at
the end of the phase.

---

## §118. Phase 6 brief — The Candidates

**Goal.** Test five ideas that might be excellent and might be wrong, without letting any of them
into the game on enthusiasm alone.

**Shipped outcome.** Each candidate behind a flag, measured against its written kill criterion, and
either kept or cut on the measurement.

**Acceptance.** Every candidate has a recorded verdict with the number that produced it.

**The thing most likely to go wrong.** Keeping a candidate because it was expensive to build.
§62.5 — the kill criteria exist to defend against the sunk cost of one's own good idea, and they
only work if they are applied.

---

## §119. Phase 7 brief — The Sweep

**Goal.** Leave the repository in a state where the next person can find the game.

**Shipped outcome.** Every gate green and every band ratcheted. The mechanics catalog, Codex,
release checklist and system diagrams regenerated against the reduced rule set.
`CHAIN_CHUNK_FEVER_DESIGN.md` rewritten as the spec, pointing here for rationale. A capture job for
the screenshot test. A recorded playthrough of floors 1–10. This document updated with what the
build taught.

**Acceptance.** A newcomer following §P.6 can understand the game in an hour.

**The thing most likely to go wrong.** Skipping it, because the game works and the documentation is
not the game. §97 — the way of working is the transferable asset, and it decays silently.

---

# Part XXV — Closing

---

## §120. The argument, restated in short

A memory board makes every action a commitment under uncertainty the player created themselves. A
cascade makes one action produce a large, legible, unpredicted consequence. Nobody has connected
them, and connecting them well requires that nothing sit between the commitment and the
consequence.

The dungeon layer sat between them. It was well built and thoroughly tested and it was in the way,
and the game's own instruments said so eleven times over.

What is left, once it is gone, is a board of suited pairs and one loop: flip, match, pop, ripple,
drop, climb, Fever, clear. Seven sentences of rules and six inputs to every decision.

The work is to make that loop the best-feeling thing on the platform: to give it the ceremony
Peggle gives a shot, the chain grammar Puyo gives a stack, the severance depth Puzzle Bobble gives
a cluster, the score curve Tetris gives a Tetris, and the ascent Vampire Survivors gives a run —
and to do all of it without a single mechanic that punishes the player for playing, without a
currency, without a timer, and without one technique from the compulsion toolkit.

## §121. The three things to hold on to

1. **One loop.** Everything is downstream of flipping two tiles, or it does not ship.
2. **Measure it or it is decoration.** Every mechanic ships with a counter and a cadence, and the
   census sees it fire within one generation.
3. **The excess is the point.** Correctness is not memorable. The ceremony, the score range, and
   the halo that ignores the map are where the design is deliberately too much, and they should be
   defended from the instinct to moderate them.

## §122. The last word

The strongest evidence in this document is not an argument. It is a table of eleven counters that
read zero across a hundred and sixty floors, produced by an instrument built to answer a different
question, on a game that was working as designed.

Build the instruments. They will tell you things you did not want to know, and those are the only
findings worth having.

---

# Part XXVI — The Recall, Specified

> §44.2 proposes the game's single power. This part specifies it fully, because a game with exactly
> one power cannot afford for it to be vague.

---

## §123. The rule

> **The Recall.** A break that takes six or more pairs charges the Recall. When charged, one input
> reveals every tile of a single suit for 1.2 seconds, then hides them again. The charge is spent.

## §124. Every design decision in that sentence

| Decision | Value | Alternative | Why |
|---|---|---|---|
| Charged by | A break of ≥ 6 pairs | Score, turns, floors | It must be earned by the thing the game is about (§4.3e) |
| Threshold | 6 pairs | 4, 8 | 6 is roughly a good Sharp break; it should feel like a reward for a real achievement, not for a routine one |
| Charges held | 1 | 2–3 | More than one turns it into a resource to manage, which is an economy |
| Carried between floors | **No** | Yes | The chain resets per floor and so should this; a carried charge would make floor N's opening depend on floor N−1 |
| Reveals | One suit | The whole board, one region, N tiles | One suit is a *choice* and it is legible; the whole board is the game turned off |
| Which suit | Player picks | Random, largest | The choice is where the strategy is |
| Duration | 1.2s | 0.6s, 3s | Long enough to encode two or three positions, short enough that it is a glance rather than a study |
| Reveals | Faces (symbols) | Just positions | Positions are already visible; the symbol is the information |
| Cost | None beyond the charge | Score, a turn | A cost would make the correct play "never use it", which is how a power becomes dead content |
| Interrupts the loop | No | Yes | It happens on the board, in place, in 1.2 seconds |

## §125. What it is for, strategically

Three uses, in increasing sophistication:

**(a) Rescue.** The board is large, the player is lost, and the Recall gives them a foothold. This
is what a new player will use it for and it is fine.

**(b) Setup.** The player is at Clean, wants Sharp, and needs one more certain match. Reveal the
suit they have been working in, find a pair, spend it.

**(c) The big one.** The player intends a Sharp break on a suit with two islands, and needs to know
whether a straddling pair exists. Reveal, find it, hold it, climb, spend it (§78.2).

Use (c) is the reason the Recall reveals a *suit* rather than a region: the straddling pair is
defined by suit membership, not by position, so a suit reveal is exactly the information the best
move in the game needs.

## §126. Presentation

| Element | Spec |
|---|---|
| Charge indicator | A quiet chime and a small mark in the bottom strip (§70.1); no modal, no popup |
| Selecting a suit | Hover or press a suit indicator; the board dims all other suits |
| The reveal | All tiles of that suit flip together over 200ms, hold 1.2s, flip back over 200ms |
| Audio | A single sustained tone during the hold, so the player's ear knows how long is left |
| After | The charge mark clears |

**What it must not do:** no slow-motion, no ceremony, no "power activated" banner. It is a tool,
not an event. Ceremony is reserved for Fever (§39.3), and spending ceremony elsewhere devalues it.

## §127. The risk, and the kill criterion

Per §F.9, the Recall is a memory aid in a memory game.

**Kill criterion (T6.1):** if mistake rate falls by more than 25% with the Recall available, it is
doing the remembering and must be weakened — first by shortening the duration to 0.8s, then by
raising the charge threshold, then by cutting it.

**What would make it clearly right:** if mistake rate is roughly unchanged but *tier reached* goes
up. That would mean the Recall is being spent on setup rather than on rescue, which is the
strategic use, which is the point.

---

# Part XXVII — Scenarios

> Twelve short scenarios covering board shapes and situations the specification should handle
> gracefully. Each is a check on the rules, and several surfaced small gaps.

## §128. The twelve

### 128.1 A suit of exactly one pair

Can never pop (a pop needs two pairs of a suit in reach). Under §37.3 it is severed from the moment
the board is dealt, so it **drops on the first break of any other suit**.

*Is that right?* Yes, and it is elegant: a one-pair suit is a scrap, and the game clears it for
free rather than making the player hunt it. **But it means `suitCountForPairs` must never produce a
suit with one pair on a board where that would drop most of the content.** §33.2's rule already
prevents this; assert it.

### 128.2 A board where every pair's halves are adjacent

Maximum pop, minimum partner reach — Clean buys almost nothing because both halves are always in
the blast anyway.

*Consequence:* the ladder's Clean rung would be nearly worthless on such a board. **This is an
argument for the generator never producing it**, and for the `pairs whose halves are always
adjacent` knob in Appendix N being an *easy-floor* setting rather than a general one.

### 128.3 A board where every pair's halves are maximally distant

The opposite: chain zero pops almost nothing, and Clean transforms the game.

*Consequence:* a dramatic difficulty spike at the Clean rung. Interesting as an occasional floor,
punishing as a default. This is the `far apart` knob and it belongs on deep floors.

### 128.4 One suit, whole board

Every match pops enormously. Effectively floor 1 at scale.

*Consequence:* a celebration floor. §33.4's `two_suit` profile every fifth floor approaches this
and should probably go all the way occasionally.

### 128.5 Four suits, minimum size

Four suits of three pairs each on a twelve-pair board. Each suit is barely poppable; the ladder
has nowhere to run.

*Consequence:* this is the pre-Gen-168 board, and it is exactly what §33.2 exists to prevent.
**Assert that `suitCountForPairs` cannot produce it.**

### 128.6 The last two pairs, different suits, far apart

Neither can pop. Neither is severed *by* a break — they were never connected. Under §37.3 both
suits fail the "can pop" test, so **both drop**, and the floor ends.

*Is that right?* It means the last turn of many floors is automatic. §41.2(a) says yes — this is the
last-pair problem solved. **But it must not fire so early that the player never finishes a floor by
hand.** Measure the distribution (T2.4).

### 128.7 A break that would take the entire board

Possible at Fever on a one-suit floor. The floor ends on that turn.

*Consequence:* spectacular and correct. The floor bonus (§40.5) still applies, at the Fever
multiplier, so it pays enormously. This is the game's best possible moment and nothing should
prevent it.

### 128.8 A mismatch on the last two tiles

The player has two tiles left and gets them wrong — impossible, because two tiles left means they
are a pair. **The board can never present an unwinnable last turn**, which is a pleasing property
of pairs-only boards and is worth asserting.

### 128.9 The chain reaching Fever with one pair left

Momentum crosses the rung on the second-to-last match. The last match is a Fever break on one pair,
which takes it and nothing else, and the floor clears at Fever for the 5× bonus.

*Is that right?* The ceremony fires for a one-pair break, which is disproportionate in the wrong
direction. **Gap found: the Fever ceremony should be suppressed when the break takes fewer than
three pairs, and the floor bonus should still apply.** Added as a specification note to §39.3.

### 128.10 A player who never reaches Clean

Every floor cleared at chain zero or one. Entirely possible for a player with poor recall.

*Consequence:* they see the pop on every match and never the ripple. The game is still complete and
still enjoyable, and the ladder is a visible thing they have not yet reached — which is §52.2(c)'s
"see the mountain before you climb it".

**This is the most common real player and the design should be checked against them explicitly.**
The simulations model 0%, 10%, 15% and 25% miss rates; none of them models a player who *never*
strings three together. **Added: a `chain-zero player` band to `sim:cascade`.**

### 128.11 A board where a suit's two islands are both one pair

Two islands of one pair each. Neither can pop; the suit is severed at deal time; it drops on the
first break.

*Same as 128.1, and the same assertion covers it.*

### 128.12 Two suits, and the player only ever matches in one

The unmatched suit accumulates. Eventually the matched suit is exhausted, its remaining pairs drop,
and the player is left with a board of one suit — which is 128.4, a celebration.

*Consequence:* ignoring a suit is self-correcting and even rewarding. That is a pleasant emergent
property and it should not be designed away.

## §129. What the scenarios found

Four specification changes, none of which were visible from the rules alone:

1. **§39.3 addendum:** suppress the Fever ceremony for a break of fewer than three pairs (128.9).
2. **§33.2 assertion:** `suitCountForPairs` must never produce a one-pair suit on a board where
   that matters, nor four minimum-size suits (128.1, 128.5).
3. **T2.4 strengthened:** measure how often a floor's *final* pairs drop rather than being matched
   (128.6).
4. **New simulation band:** model a player who never reaches Clean (128.10).

**This is why scenarios are worth writing.** All four are cheap to fix now and would have been bugs
discovered by players.

---

# Appendix A — Glossary

> Every term this document uses in a technical sense, alphabetically, with the section that defines
> it. Terms marked **[player-facing]** appear in the game's own copy and must be used consistently
> there; terms marked **[internal]** are ours.

| Term | Kind | Meaning | Defined |
|---|---|---|---|
| **Aim guide** | [internal] | The preview of which tiles a match on a given tile would take, at the current tier | §29.2 |
| **Attributability** | [internal] | The property that a player can correctly identify why an outcome happened | §18.3, §28.2 |
| **Band** | [internal] | A measured threshold with a consequence: failing it fails a gate | §57.1 |
| **Board** | [player-facing] | The grid of tiles for one floor | §32.1 |
| **Break** | [internal] | The whole consequence of a match: pop, ripple, halo and drop together | §27.1 |
| **Ceiling (turn)** | [internal] | `parTurns × 3`; failing to clear within it ends the run | §42.2 |
| **Chain** | [player-facing] | Consecutive correct matches; the ladder's input | §38.1 |
| **Chain drop** | [player-facing] | Momentum returning to zero on a mismatch | §38.1 |
| **Clean** | [player-facing] | The first rung; buys the partner reach | §38.3 |
| **Clump** | [internal] | A contiguous region of one suit | §33.3 |
| **Compulsion** | [internal] | Engineering for time extraction rather than for desire to return; refused | §0, §25 |
| **Contact rule** | [internal] | Below Clean, a pair goes only when both halves are inside the blast | §35.2 |
| **Deal profile** | [internal] | `clumped`, `scattered` or `two_suit`; how suits are laid out | §33.4 |
| **Depth** | [player-facing] | The deepest floor reached; the between-run record axis | §55.1 |
| **Desire to return** | [internal] | The engineering target this document optimises for | §0 |
| **Drop** | [player-facing] | Pairs falling because their suit can no longer pop | §37.3 |
| **Efficiency bonus** | [internal] | Floor-end score for beating par | §40.5 |
| **Extreme Fever** | [player-facing] | The floor-end payout for clearing at Fever | §39.4 |
| **Fever** | [player-facing] | The top rung; buys the halo and the ceremony | §38.3, §39 |
| **Floor** | [player-facing] | One board, start to clear | §41 |
| **Fog** | [internal] | Candidate soft pressure: unmatched seen tiles lose their suit marking over time | §43.3 |
| **Halo** | [player-facing] | At Fever, the tiles bordering the first wave, whatever their suit | §39.1 |
| **Hit-stop** | [internal] | A brief freeze of simulation on impact | §47.3 |
| **Hold** | [internal] | Declining to match a known pair so it is worth more at a higher tier | §30.1 |
| **Legibility** | [internal] | The property that a player can read the board's state and consequences | §29, §49 |
| **Memory tax** | [internal] | The scoring taxonomy for content that costs the player recall; found insufficient | §2.2 |
| **Mismatch** | [player-facing] | Two flipped tiles whose symbols differ | §34.2 |
| **Momentum** | [internal] | `streak + cascaded pairs since the chain last dropped`; what climbs the ladder | §38.1 |
| **Near-miss (emergent)** | [internal] | An honest outcome that falls just short; permitted and made legible | §21.2 |
| **Near-miss (manufactured)** | [internal] | An outcome arranged to look close; forbidden | §21.2, §25.1.6 |
| **Occupancy** | [internal] | Whether a system ever fires on floors a player actually plays | §2.2, §57.4 |
| **Orphan** | [internal] | A pair whose suit can no longer pop; drops | §37.3 |
| **Par** | [player-facing] | The turn count a competent player should need for a floor | §41.3 |
| **Partner** | [internal] | The other half of a pair | §35.2 |
| **Partner reach** | [internal] | At Clean and above, a pair goes when either half is in the blast | §35.2 |
| **Pip** | [internal] | A mark on a chain-meter rung indicating the typical break size there | §30.3a, §70.3 |
| **Pop** | [player-facing] | The first wave: same-suit tiles within reach of the match | §35 |
| **Prediction error** | [internal] | The gap between expected and actual outcome; the source of cascade joy | §18 |
| **Ratchet** | [internal] | A band that only moves in the improving direction | §57.1 |
| **Reach** | [internal] | How many steps into a clump a wave walks | §35.1 |
| **Recall** | [player-facing] | The single power: reveal one suit briefly, earned by a large break | §44.2 |
| **Rematch** | [player-facing] | Replaying the seed of a previous personal best for a like-for-like comparison | §56.3 |
| **Remembered tint** | [internal] | The mark on a tile the player has seen and not matched | §34.4 |
| **Ripple** | [player-facing] | Waves after the first; bought at Sharp | §36 |
| **Rung** | [internal] | A chain tier threshold | §38.2 |
| **Run** | [player-facing] | A sequence of floors until the player stops or the ceiling is missed | §42 |
| **Screenshot test** | [internal] | A single frame must teach the game | §49.1 |
| **Severance** | [internal] | The board state where a suit can no longer pop | §37.3 |
| **Sharp** | [player-facing] | The second rung; buys the whole clump and the reaction | §38.3 |
| **Spread** | [internal] | Pairs-per-match at Fever minus at chain one; the ladder's range | §38.4 |
| **Stop** | [internal] | Any moment the loop pauses for something that is not the loop | §1.2 |
| **Suit** | [player-facing] | One of up to four tile families, each a colour and a rune | §33.1 |
| **Trauma** | [internal] | The scalar driving screen shake | §47.1 |
| **Wave** | [internal] | One step of a break's propagation | §36.1 |

---

# Appendix B — The Constant Register

> Every tunable number in the specified design, with its value, its home, and the band that guards
> it. A constant with no band is a constant nobody will notice going wrong.

## B.1 Board generation

| Constant | Value | Module | Guarded by | §  |
|---|---|---|---|---|
| `PAIRS_BASE` | 3 | `board-build-rules` | N6 (first floor pops) | §32.2 |
| `PAIRS_GROWTH` | 2.6 | `board-build-rules` | `sim:pop` per-level | §32.2 |
| `PAIRS_MAX` | 24 | `board-build-rules` | §69.5 fatigue check | §32.2 |
| Tiles per pair | 2 | contract | N1, N2 | §32.1 |
| Mid-floor arrivals | 0 | invariant | N3 | §19.3 |

## B.2 Suits

| Constant | Value | Module | Guarded by | § |
|---|---|---|---|---|
| `TILE_SUITS.length` | 4 | `tile-suit-rules` | greyscale test N4 | §33.1 |
| `SUIT_TARGET_PAIRS` | 6 | `tile-suit-rules` | `ladderSpread` | §33.2 |
| `MIN_PAIRS_FOR_TWO_SUITS` | 6 | `tile-suit-rules` | legibility, §33.2 | §33.2 |
| Clump count per suit (≥3 pairs) | 2 | `tile-suit-rules` | ripple reachability | §33.3 |
| Straddling-pair share | ~0.30 | measured | — | §33.3 |
| Same-suit neighbour rate (clumped) | 0.66–0.76 | measured | clumped > shuffled + 0.15 | §33.3 |
| `FLOORS_PER_PROFILE_CYCLE` | 5 | `floor-profile-rules` | — | §33.4 |

## B.3 The break

| Constant | Value | Module | Guarded by | § |
|---|---|---|---|---|
| `BOUNDED_BREAK_REACH` | 2 | `chunk-break-rules` | `ladderMinStep` | §35.1 |
| Sharp/Fever reach | ∞ | `chunk-break-rules` | `ladderSpread` | §35.1 |
| `POP_WAVES` | 1 | `chunk-break-rules` | | §36.1 |
| `CLEAN_WAVES` | 1 | `chunk-break-rules` | `ladderMinStep` (Sharp's rung) | §36.1 |
| `RIPPLE_MAX_WAVES` | 12 | `chunk-break-rules` | bound only | §36.1 |
| Halo seeds a wave | no | `chunk-break-rules` | — | §39.2 |
| Drop condition | suit cannot pop | `chunk-break-rules` | N8 | §37.3 |

## B.4 The ladder

| Constant | Value | Module | Guarded by | § |
|---|---|---|---|---|
| `CHAIN_TIER_CLEAN_FROM` | 3 | `chain-tier-rules` | | §38.2 |
| `CHAIN_TIER_SHARP_SHARE` | 0.40 | `chain-tier-rules` | `ladderMinStep` | §38.2 |
| `CHAIN_TIER_SHARP_MIN` | 4 | `chain-tier-rules` | | §38.2 |
| `CHAIN_TIER_FEVER_SHARE` | 0.50 | `chain-tier-rules` | `cleanFeverShareOnBigFloors` | §38.2 |
| `CHAIN_TIER_FEVER_MIN` | 7 | `chain-tier-rules` | | §38.2 |
| Pop momentum credit | ½ | `chunk-break-rules` | `feverCleanOverReference` | §38.1 |
| Later-wave momentum credit | full | `chunk-break-rules` | same | §38.1 |

## B.5 Scoring

| Constant | Value | Module | Guarded by | § |
|---|---|---|---|---|
| `SCORE_PER_PAIR` | 0.6 × match score | `scoring-rules` | `chunkShareOfScore` | §40.2 |
| `CHAIN_MULT.none` | 1 | `scoring-rules` | N5 | §40.2 |
| `CHAIN_MULT.clean` | 2 | `scoring-rules` | N5 | §40.2 |
| `CHAIN_MULT.sharp` | 4 | `scoring-rules` | N5 | §40.2 |
| `CHAIN_MULT.fever` | 8 | `scoring-rules` | N5 | §40.2 |
| `WAVE_MULT_STEP` | 0.75 | `scoring-rules` | N5 | §40.2 |
| `WAVE_MULT_CAP` | 6 | `scoring-rules` | N5 | §40.2 |
| `FLOOR_CLEAR_BASE` | 100 × level | `level-clear-rules` | | §40.5 |
| `FLOOR_TIER_MULT.fever` | 5 | `level-clear-rules` | `extremeFeverCleanOverReference` | §40.5 |
| Efficiency bonus per turn under par | 50 × level | `level-clear-rules` | | §40.5 |

## B.6 The floor and the run

| Constant | Value | Module | Guarded by | § |
|---|---|---|---|---|
| `parTurnsForFloor(pairs)` | `ceil(pairs × 0.85)` | `level-clear-rules` | median turns vs par | §41.3 |
| Turn ceiling | `par × 3` | `run-rules` | run-length target | §42.2 |
| Lives | **none** | — | — | §42.2 |
| Floors per run (target) | 6–12 | — | N10 | §42.4 |

## B.7 Timing (ms)

| Constant | Value | § |
|---|---|---|
| Input → flip start | 0 | §45.2 |
| Flip animation | 180 | §45.2 |
| Symbol readable at | 120 | §45.2 |
| The gap | 150 | §45.2 |
| Matched pair lift | 120 | §45.2 |
| Pop wave 1 | 220 | §45.2 |
| Each further wave | +160 | §45.2 |
| Per-tile stagger | 18 × distance | §45.2 |
| Score float | 400 | §45.2 |
| Total count-up | 350 | §45.2 |
| Board settle | 150 | §45.2 |
| Mismatch hold | **700** | §45.3 |
| Mismatch flip-back | 160 | §45.3 |
| Meter drain | 300 | §45.3 |
| Fever freeze | 180 | §39.3 |
| Fever zoom | 400 | §39.3 |
| Fever desaturate | 250 | §39.3 |
| Fever word hold | 900 | §39.3 |
| Fever break speed | 0.6× | §39.3 |
| Fever return | 300 | §39.3 |
| Fever total | ~2600 | §39.3 |
| Floor clear beat | ~1600 | §41.4 |
| Run end → able to restart | < 1000 | §72 |

## B.8 Camera

| Constant | Value | § |
|---|---|---|
| Trauma decay | 1.6 / s | §47.2 |
| Trauma: match | 0.05 | §47.2 |
| Trauma: pop, per pair | 0.02 (cap 0.25/wave) | §47.2 |
| Trauma: wave boundary | 0.08 | §47.2 |
| Trauma: drop | 0.15 | §47.2 |
| Trauma: rung | 0.20 | §47.2 |
| Trauma: Fever | 0.55 | §47.2 |
| Trauma: floor clear | 0.10 | §47.2 |
| Offset model | `trauma² × maxOffset × noise(t)` | §47.1 |
| Hit-stop: match | 30ms | §47.3 |
| Hit-stop: wave boundary | 40ms | §47.3 |
| Hit-stop: drop | 60ms | §47.3 |
| Hit-stop: Fever | 180ms | §47.3 |

## B.9 Audio

| Constant | Value | § |
|---|---|---|
| Scale | Major pentatonic (1 2 3 5 6) | §74.1 |
| Octaves available | 3 | §74.1 |
| Octave per ripple wave | +1, capped at +2 | §74.1 |
| Root shift per floor | +1 fifth | §74.3 |
| Root cycle length | 12 floors | §74.3 |
| Per-note ducking within a run | 0.3dB | §75 |
| Music duck during a break | 6dB, recover 400ms | §75.1 |
| Music duck during the gap | 3dB | §75.1 |

## B.10 Accessibility

| Constant | Value | § |
|---|---|---|
| Minimum text size | 12px | §48.3 |
| Text size steps | 3 | §48.3 |
| Text contrast | ≥ 4.5:1 | §48.2 |
| Functional non-text contrast | ≥ 3:1 | §48.2 |
| Suit rune size | ≥ 24% of tile width | §49.3 |
| Symbol size | ≥ 45% of tile width | §49.3 |
| Camera Comfort positions | 3 (Full / Reduced / Off) | §47.4 |
| Greyscale playability | required | N4 |

---

# Appendix C — The Removed Inventory, With Verdicts

> `REMOVED_DUNGEON_LAYER.md` records *what* each removed thing was, generated from the source.
> This appendix records *whether we would ever take it back*, and under what conditions. The
> distinction matters: an archive without a verdict invites the same argument every six months.
>
> Verdicts: **NEVER** (the idea is wrong for this game), **NOT AS BUILT** (the idea has merit, the
> implementation was the problem), **ABSORBED** (its function now lives somewhere else), or
> **LATER** (worth revisiting once the loop is finished, with a stated precondition).

## C.1 Card kinds

| Kind | Verdict | Reasoning |
|---|---|---|
| `enemy` | **NEVER** | An HP bar on a tile is a second verb. Combat and recall are different games and putting them on the same tile makes both worse. |
| `trap` | **NEVER** | It punishes flipping, which is the one thing the game wants the player to do freely. §1.2. |
| `treasure` | **ABSORBED** | Its function — a tile worth aiming a break at — is now board structure: the biggest clump, the far-apart pair, the suit about to sever. §40. |
| `shrine` | **NEVER** | A defensive reward for a game with no attrition. |
| `gateway` | **NEVER** | A route choice between floors; §14.2. |
| `key` | **NEVER** | An inventory puzzle between flips. |
| `lock` | **NEVER** | Same, plus it gates content behind an item, which is a stop. |
| `exit` | **ABSORBED** | The floor now ends on an empty board, which is a strictly better win condition because it is the same as the thing the player is already doing. §41.1. |
| `lever` | **NEVER** | A switch you must find is not a pair you remember. |
| `shop` | **NEVER** | A menu. §63. |
| `room` | **NEVER** | A menu with a theme. |

## C.2 Card effects — the ones worth a note

Most effects inherit their kind's verdict. These are the exceptions.

| Effect | Verdict | Reasoning |
|---|---|---|
| `treasure_cache` | **ABSORBED** | Its job was "a big reward inside a clump". A big clump is now its own reward. |
| `rune_seal` | **NEVER** | Disarming is anti-loop. |
| `room_scrying_lens` | **NOT AS BUILT** | The *function* — a peek at hidden information — is genuinely good and is exactly what the Recall (§44.2) does. The room was the problem, not the peek. |
| `room_map` | **NOT AS BUILT** | Same shape: information as a reward. Absorbed into the Recall. |
| `key_master` | **NEVER** | A universal solution to a problem we no longer have. |
| `gateway_depth` | **NEVER** | |
| `lever_floor` | **NEVER** | |

## C.3 Hazard tiles

| Hazard | Verdict | Reasoning |
|---|---|---|
| `shuffle_snare` | **NEVER** | It moves tiles, which violates invariant I2 (the board must not change under the player's reading) and destroys memorised positions. This is the most anti-memory mechanic we ever shipped. |
| `mirror_decoy` | **NEVER** | It makes the board lie: a correct recall produces a mismatch. §21 forbids manufactured near-misses and this is the purest possible example. |
| `cascade_cache` | **ABSORBED** | "A clean match clears a hidden pair" is the pop. We built the pop later and better. |
| `fragile_cache` | **NEVER** | A conditional reward with a rulebook. |
| `toll_cache` | **NEVER** | A cost for a reward, in a currency we no longer have. |
| `fuse_cache` | **NEVER** | A timed reward. §25.1.2. |

Note that four of the six never fired on a single floor in 160 measured floors. The two that did
(`fragile_cache` at 0.037, `toll_cache` and `fuse_cache` at 0.05) were rare enough to be
unlearnable.

## C.4 Bosses

| Boss | Verdict |
|---|---|
| All four (`trap_warden`, `rush_sentinel`, `treasure_keeper`, `spire_observer`) | **NEVER** as HP-on-a-tile. **LATER** as a *board*: a hand-authored floor with a distinctive geometry every N floors would give a run a landmark without a rulebook. Precondition: the procedural floors must be good first, or an authored one is just a different flavour of not-good. |

## C.5 Floor archetypes

| Archetype | Verdict | Reasoning |
|---|---|---|
| `survey_hall`, `speed_trial`, `rush_recall`, `spotlight_hunt` | **NEVER** | Each was a modifier with a rulebook. |
| `treasure_gallery` | **ABSORBED** | "A floor with more reward" is now "a floor whose suits are big", which is the `two_suit` deal profile. §33.4. |
| `trap_hall`, `shadow_read`, `parasite_tithe`, `anchor_chain`, `script_room` | **NEVER** | |
| `breather` | **ABSORBED** | Pacing variety now comes from the deal-profile rotation. |

## C.6 Objectives

| Objective | Verdict |
|---|---|
| `find_exit` | **ABSORBED** — the floor ends when the board is empty |
| `open_bonus_exit`, `claim_route` | **NEVER** |
| `disarm_traps`, `defeat_boss`, `pacify_floor` | **NEVER** — they name content that is gone |
| `loot_cache` | **ABSORBED** into score |
| `reveal_unknowns` | **ABSORBED** into the Recall |

## C.7 Modes

| Mode | Verdict | Reasoning |
|---|---|---|
| `endless` | **KEPT** — this is the game |
| `daily` | **LATER** | A daily seed is a genuinely good, cheap feature *once the loop is finished*, and it is the natural home for §56's Rematch comparison. Precondition: Phase 3 complete. |
| `puzzle` | **NOT AS BUILT** | Hand-authored boards with a target are a good idea; a separate mode with its own packs, difficulties and completion records is not. **LATER**, as authored floors inside the one mode. |
| `gauntlet` | **NEVER** | A timed variant; §43.4. |
| `meditation` | **NEVER** | A mode with the cascade turned off is a mode with the game turned off. If a player wants calm, the answer is that the default game is already calm — no timer, no fail. |

## C.8 The economy

| Thing | Verdict |
|---|---|
| Shop gold | **NEVER** |
| The shop | **NEVER** |
| Relics (all) | **NOT AS BUILT** — three of them (Tuning Fork, Magpie's Ledger, Suit Lens) touch the cascade well. **LATER**, as a project with its own justification, not as survivors of this one. Precondition: Phase 3 and Phase 4 complete, and a written answer to "what does this add that §44.2 does not?" |
| Starting loadouts | **NEVER** |
| Peek / shuffle / undo / stray-remove charges | **ABSORBED** into the Recall |
| Master keys | **NEVER** |

## C.9 Tile traits

Triaged individually in §32.4. Summary:

| Trait | Verdict |
|---|---|
| `echo` | **KEPT** |
| `heavy` | **KEPT** (demoted to presentation) |
| `conduit` | **KEPT** |
| `stasis` | **KEPT** (reframed as a gift) |
| `mirror` | **NEVER** — the board must not lie |
| `cursed` | **NEVER** |
| `sealed` | **NEVER** |
| `volatile` | **NEVER** — violates I2 |
| `drift` | **NEVER** — violates I2 |

## C.10 The pattern in the verdicts

Counting: **NEVER** 34, **ABSORBED** 11, **NOT AS BUILT** 5, **LATER** 4, **KEPT** 4.

Two patterns worth naming:

**(a) Almost everything ABSORBED was absorbed into either board structure or score.** That is the
signature of content that was *duplicating* something the loop already did. The dungeon's treasure
was a reward the cascade already produces; its exit was a win condition the empty board already
provides; its scrying lens was information the Recall already grants.

**(b) Every NEVER falls into one of four categories:** it is a second verb (enemy, boss), it
punishes the core verb (trap, curse), it is a menu (shop, room, gateway), or it makes the board lie
or move (mirror, volatile, drift, snare). Those four categories are a usable filter for future
proposals, and they are a sharper tool than the memory-tax taxonomy that failed to catch any of
them (§2.2).

---

# Appendix D — Sources, and How to Read Them

> Where the claims in this document come from, with an honest account of each source's weight.

## D.1 Instrumented, from this repository

The strongest class. Reproducible by running a command.

| Source | Command | What it supports |
|---|---|---|
| Pop reach simulation | `yarn sim:pop` | §2.1, §35.4, §38.4, §57.2 |
| Cascade balance simulation | `yarn sim:cascade [--relics]` | §2.1, §39.5, §57.3 |
| System occupancy census | `yarn sim:occupancy`, `yarn gate:occupancy` | §2.2, §37.1, §57.4 |
| Build strategy playthrough | in `verify` | §2.2 (route risk rejections) |
| Suit clumping measurement | `tile-suit-rules.test.ts` | §33.3 |
| Balance notes | `docs/BALANCE_NOTES.md` | The whole measured history; Appendix I |

**Caveat:** every one of these plays a *simulated* player whose memory model is a coin flip
(§59.1). Numbers about the *mechanics* are trustworthy; numbers about *difficulty* are directional.

## D.2 Market survey, from this project's research passes

`docs/MARKET_SURVEY.md`, `docs/RESEARCH_NOTES.md`, `docs/RESEARCH_NOTES_2.md`. Nine products
surveyed with sourced figures where figures were available.

**Caveat:** publicly available figures on retention and session length in this segment are sparse,
inconsistently defined, and often from press releases. Treat comparative retention claims as weak.
The survey's most solid contributions are qualitative: what mechanics exist, how they are framed,
and what is conspicuously absent (§56.1).

## D.3 Design analysis of the reference products

Part II. Where a claim is my reading of a design rather than a documented fact, it is marked
*(analysis)*.

**Caveat:** design analysis by observation is systematically prone to attributing intention to
accident. The Peggle rising-pitch mechanism (§4.5) is observable and uncontroversial; the claim
about slow-motion nudging near orange pegs (§4.4) is widely reported and I have marked it
accordingly.

## D.4 Psychology literature

Part III, with confidence markers.

**Caveat, and it is a large one:** I am summarising fields I am not qualified to adjudicate, at a
level of abstraction where the summaries are mostly uncontroversial but the *applications* are
mine. Specifically:

- **Reward prediction error** (§18) is well established as an account of dopaminergic signalling in
  reward learning. Its application to "why cascades feel good" is my inference and is plausible
  rather than demonstrated.
- **Variable ratio schedules** (§19) are robust in operant conditioning and their generalisation to
  human game-playing is genuinely contested. I have deliberately built the design so that it does
  not depend on the finding being true.
- **The testing effect** (§23.1) is among the more replicable findings in cognitive psychology and
  the application here is direct.
- **Working memory capacity** (§23.2) is robust in the small; the exact number is contested and the
  design does not depend on it.
- **The peak-end rule** (§24.1) is robust and its application to session design is standard.
- **The Zeigarnik effect** (§22.1) has a mixed replication record and I have marked the design's use
  of it as the weaker within-session claim only.
- **Brain-training transfer** (§25.1.15) — the evidence for far transfer from trained tasks to
  general cognition is weak, which is why we make no claims.

**The design principle behind these caveats:** no mechanic in Part V requires a contested finding
to be true. Where a finding is load-bearing, it is a robust one; where it is contested, it is
supporting a decision we would make anyway on other grounds.

## D.5 What is missing

Honestly:

- **No player testing.** Not one claim in this document has been checked against a real person
  playing the game. That is the single largest gap and it dwarfs every other caveat here.
- **No telemetry.** We do not know what floor a real player reaches, how long a session is, or
  whether anybody reaches Fever. §59 and Phase 5 address this.
- **No competitive analysis of the memory-game segment specifically.** The survey covered cascade
  and roguelite products; the memory-game market is separate and largely unexamined here.

---

# Appendix E — Open Questions

> Questions this document could not settle. Each has what would settle it.

## E.1 Is the pair curve right at depth?

§32.2 tempers growth by a square root on the argument that memory interference is superlinear in
board size. That argument is sound in principle and unquantified in practice.

**What would settle it:** §59's memory model, or telemetry on where real players stall.

## E.2 Should the board stop growing?

If a player's memory capacity is the binding constraint, then past some size every player fails at
the same floor and depth stops being a skill signal. If so, difficulty should come from somewhere
else past that point — but §43.4 forbids most of the alternatives.

**What would settle it:** the distribution of run depths across real players. If it has a hard
ceiling everybody hits, the curve is wrong.

## E.3 Does the "surprised by my own board" feeling actually happen?

§28 is the design's central claim and it is untested. It could be true mechanically and absent
experientially.

**What would settle it:** asking people. Genuinely — this is a question for playtesting, not
instrumentation.

## E.4 Is fog a good idea or a bad one?

§43.3 is the highest-variance idea in the document.

**What would settle it:** building it behind a flag and measuring §57's N12, plus session length.

## E.5 Should the player be able to act inside the ripple window?

§36.3 could be the game's skill ceiling or could ruin its character.

**What would settle it:** a prototype, and a check that it is invisible to a player who ignores it.

## E.6 Is the held-pair marker a crutch?

§30.3(c) makes the game's central strategy nameable and might replace the memory it is meant to
support.

**What would settle it:** measure mistake rate with and without. If it falls more than a fifth, it
is doing the remembering.

**Not settleable here (Gen 188).** The cascade and pop simulations model a reference player who
misses at a fixed rate; a memory aid changes what a *human* remembers, which is not a parameter any
of them carry. Turning the miss rate down to simulate "the marker helped" measures the miss rate,
not the marker. This one waits for players, and §30.3(c) now records the two constraints any build
has to meet in the meantime: the mark must not validate, and the span (T3.6) may only be shown on a
pair the player has claimed.

## E.7 What is the right assist for players with memory impairment?

§48.4 declines to build a board-revealing assist mode on the grounds that it removes the game. That
is a defensible position and it is also the position every game takes right before somebody builds
a better one.

**What would settle it:** talking to players who need it, rather than reasoning about them.

## E.8 Should score or depth be the headline?

§55.1 chooses depth. Score is more granular and more screenshottable; depth is more legible and
harder to inflate.

**What would settle it:** which one players quote to each other, which is observable once anybody
is playing.

## E.9 Is the mismatch's 700ms hold right?

§45.3 calls it the most important number in the timing table and picks it by feel.

**What would settle it:** measure second-attempt success rate at 500 / 700 / 1000ms.

## E.10 Does the multiplicative score curve hollow out small breaks?

§40.3 argues no and adds a band. The band is a guess.

**What would settle it:** measure the distribution, then ask whether players *feel* small breaks are
worthless — which is a different question from whether they are.

## E.11 Should there be any between-floor choice at all?

§63 says no. §14.2's argument is about *uninformed* choices; an informed one might be fine, and
Slay the Spire's cadence of one meaningful choice per ninety seconds is a strong precedent.

**What would settle it:** trying one informed choice — e.g. "next floor: bigger, or two suits
instead of three?" — with the consequence stated, and measuring whether anybody engages with it or
whether it just adds a stop.

## E.12 Is a run with no fail state still a run?

§42.2 makes the run essentially endless for a competent player. §14.2 and §11.3 both argue a run
needs an ending to be a story.

**What would settle it:** whether players talk about their runs. If they say "I got to 14", it is a
run. If they say "I played for a bit", it is not.

---

# Appendix F — Objections and Answers

> Every serious objection I could construct against this document, with the best answer I have.
> Where the answer is weak, it says so. The purpose is to make the argument attackable rather than
> to make it look strong.

## F.1 "You are deleting most of the game to fix a balance problem."

**The objection.** Eleven card kinds, six hazards, four bosses, eleven archetypes and four modes is
an enormous amount of built, tested, shipped content. Removing it because the cascade is not getting
enough pairs is using a wrecking ball on a tuning problem. Reserve fewer pairs for the dungeon and
move on.

**The answer.** That was tried. Gen 167 reserved a quarter of the floor's pairs and it worked — pop
rate on floor 4 went 0.52 → 0.94 — but it took four passes of special-case protection in the card
trimmer to stop floors losing the card their own archetype was named for, and it did not wake a
single one of the eleven silent systems. The reserve is the "tune it" answer and we shipped it; the
finding is that it fixed the cascade's raw material and left every other problem in place.

More importantly, the eleven silent systems are not a balance problem. A system that fires on zero
of 160 floors is not mistuned; it is absent. No reserve percentage fixes that.

**Where this answer is weak:** it does not address the possibility that the *right* reserve is 60%
rather than 25%, which nobody has measured. It is a real gap, and the counter-argument is §3.5's
counterfactual test — at 60% the dungeon would be a garnish, and nobody would propose adding a
garnish with a seventy-concept rulebook.

## F.2 "The game will be too thin without it."

**The objection.** §62.1's risk, stated as a certainty.

**The answer.** §3.2's precedent table: every deep game in this family has a rule set of five to
seven sentences. Depth in this genre comes from geometry, not from nouns.

**Where this answer is weak:** precedent is not proof, and none of those games has a *memory* input,
which is more taxing and might leave less headroom for strategic thinking. If a player's whole
cognitive budget goes to remembering, the strategic layer of §30 may be unusable in practice — in
which case the game *is* thinner than this document assumes. §62.1's early warning is the honest
response.

## F.3 "You are removing content because it is hard to measure, not because it is bad."

**The objection.** The occupancy census measures firing frequency. Content can be valuable without
firing often — atmosphere, variety, the *possibility* of a boss. Judging content by counter
frequency is measuring what is easy to measure.

**The answer.** This is the strongest objection in this appendix and it is partly right. Two
defences:

First, the census is not the only argument. The rulebook argument (§1.1), the pairs-competition
argument (§2.2), the fragility argument (four protection passes), and the §1.2 filter are all
independent of frequency.

Second, *eleven at exactly zero* is not a marginal reading. Content that has never happened to
anybody cannot be providing atmosphere, because nobody has experienced it.

**Where this answer is weak:** the four route specials among the eleven are silent because the
census plays floors rather than runs, which is a measurement artefact and not a fact about the game.
Those four are being removed on the other arguments, not on the census, and this document should be
clearer about that than it has been. *Noted as a correction.*

## F.4 "One mode is a worse product than five."

**The objection.** Modes are cheap breadth. A store page with five modes sells better than one.

**The answer.** Four of the five are variants of a loop that is not finished. Shipping four
variants of an unfinished thing is shipping four unfinished things, and it quadruples the surface
that every future change must be checked against. The daily mode in particular is genuinely cheap
and genuinely good — which is why it is **LATER** rather than **NEVER** in Appendix C.7, with a
stated precondition.

**Where this answer is weak:** it is a sequencing argument, not a design argument, and sequencing
arguments are how features get deferred forever. The precondition (Phase 3 complete) should be
treated as a commitment.

## F.5 "No fail state means no tension."

**The objection.** §42.2 removes lives. A game you cannot lose is a toy.

**The answer.** The tension is the chain, and it is lost constantly. A mismatch drops momentum to
zero, which can cost a Fever break the player was four turns into building. That is a real,
frequent, painful loss — far more frequent than a life system's, and directly caused by the
player's own action.

The turn ceiling (`par × 3`) does end runs; it is simply generous. Something can end without being
a punishment.

**Where this answer is weak:** it may be true that a *run-ending* stake is qualitatively different
from a *chain-ending* one, and that players need the former to care. §E.12 records this as open.

## F.6 "Multiplicative scoring will make everything except Fever pointless."

**The objection.** §40.2 makes a Fever break worth 200× a chain-one pop. Nobody will care about
anything else.

**The answer.** §40.3's three reasons: you cannot reach Fever without small breaks (they are the
ladder), the board is finite so hoarding is bounded, and depth rather than score is the record axis.
Plus band N5.

**Where this answer is weak:** N5's thresholds (0.25–0.70) are guesses. If the real distribution
sits at 0.85, the objection is correct and the curve needs flattening. This should be measured
before Phase 2.4 ships, not after.

## F.7 "The severance drop will fire constantly and trivialise floors."

**The objection.** §37.3 drops every pair of a suit that can no longer pop, at any tier. On a
four-suit board, suits sever often. This could clear half a floor for free.

**The answer.** It is meant to fire often — N8 targets ≥ 0.25 of floors, up from 0.006. The
"trivialise" concern is real but bounded: severance happens when a suit is nearly gone anyway, so
the drop is taking pairs that were about to be cleared by hand. That is the §41.2 last-pair problem
being solved, not free points.

**Where this answer is weak:** "nearly gone anyway" is an assumption. A suit of six pairs split into
two clumps of three, where one clump is broken, leaves three pairs that cannot reach each other —
which is not nearly gone. The rule as specified would drop three pairs for free. **This needs
measuring before it ships, and possibly a minimum-remaining condition.** *Noted as a correction to
§37.3: measure the distribution of dropped-pair counts and add a cap if the tail is fat.*

## F.8 "Authored floors are a slippery slope back to hand-made content."

**The objection.** §51 authors three floors. Then five. Then a boss floor. Then thirty.

**The answer.** Three floors exist to guarantee three specific teaching moments (§50.2 rows 3, 4
and 8) that procedural generation cannot guarantee. That is a bounded, stated purpose. Any proposal
for a fourth authored floor must name the teaching moment it guarantees.

**Where this answer is weak:** Appendix C.4 already contemplates authored boss-landmark floors under
**LATER**, which is the first step down the slope. Consistency requires that they too name what they
guarantee.

## F.9 "The Recall is a memory aid in a memory game."

**The objection.** §44.2 lets the player see a suit. That is the game answering its own question.

**The answer.** It is earned by a large break, it is brief (1.2s), it covers one suit, and it feeds
the strategic layer rather than replacing recall — knowing *where* a suit's pairs are is not the
same as knowing *which symbol* each is. The player still has to match.

**Where this answer is weak:** it might still hollow the game, which is why it is Phase 6.1 with a
written kill criterion (mistake rate falling more than 25%).

## F.10 "You have written ten thousand lines about a game nobody has playtested."

**The objection.** §D.5 admits no claim here has been checked against a real person.

**The answer.** Correct, and it is the most serious limitation of this document. The defence is
that Phases 1 and 2 are justified on *measurements of the existing game* rather than on
predictions — the eleven silent systems, the flat ladder, the dungeon eating the board are all
facts about what is there now. Phases 3 onward are predictions, and they should be treated with
proportionally more suspicion.

**Where this answer is weak:** it is not weak; the objection is simply right, and the correct
response is to get the thing in front of people as soon as Phase 2 lands.

## F.11 "Refusing the retention toolkit will just mean nobody comes back."

**The objection.** §25 refuses daily rewards, streaks, energy, notifications, collections and
progression bars. That is the entire conventional retention stack. Without it, retention will be
whatever organic interest produces, which is usually not much.

**The answer.** §16.4's three arguments: compulsion techniques only extract value from a captive
audience and a premium product has none; they substitute for quality and thereby prevent it; and
the segment's most-recommended products conspicuously avoid them.

**Where this answer is weak:** "the good games don't do it" is partly survivorship. Plenty of good
games with retention mechanics also succeed. The honest version of this position is that we are
*choosing* a smaller, better-regarded product over a larger, worse-regarded one, and that is a
values choice rather than a measured optimum.

## F.12 "Nobody wants a memory game."

**The objection.** The genre is associated with children's apps and brain-training, both of which
are commercially and reputationally poor neighbourhoods.

**The answer.** This is a positioning problem, not a design problem, and §49.1's screenshot test is
the answer: if a frame of the game shows a board detonating, nobody will categorise it as
Concentration. The memory is the *input*; the game is the cascade.

**Where this answer is weak:** positioning problems are real problems, and a design document cannot
solve one. It belongs in the store-page work, not here.

## F.13 "The whole document is post-hoc rationalisation of a decision already made."

**The objection.** The instruction was "remove the dungeon cards". Everything here argues for that
conclusion.

**The answer.** Partly true and worth stating: the removal was directed, and this document builds
the case for it. What makes it more than rationalisation is that the *measurements* pre-date the
instruction — the eleven silent systems, the four protection passes, the flat ladder and the
dungeon-eats-the-board finding were all in `BALANCE_NOTES.md` before this document existed, and
several of them (Gen 167, Gen 168) were discovered while trying to make the dungeon *work*.

**Where this answer is weak:** it does not address the parts of this document that go beyond the
instruction — one mode, no lives, multiplicative scoring, the severance drop. Those are my
proposals and they deserve independent scrutiny; Appendix E and this appendix are where I have
tried to give it.

---

# Appendix G — The Task Register

> Every task from Part X, with an ID, its dependencies, its acceptance criterion, and its risk. IDs
> are stable; do not renumber.

## G.1 Phase 1 — the removal

| ID | Task | Depends on | Acceptance | Risk |
|---|---|---|---|---|
| T1.1 | Collapse `GameMode` to one value | — | Type has one member; no mode selection surface exists | Med — many screens and records key off mode |
| T1.2 | Remove daily-challenge rules, screens, records, save fields | T1.1 | No `daily` symbol remains | Low |
| T1.3 | Remove puzzle mode, packs, definitions, completion records | T1.1 | No `puzzle` symbol remains | Low |
| T1.4 | Remove gauntlet mode and its timers | T1.1 | No `gauntlet` symbol remains | Low |
| T1.5 | Remove meditation mode | T1.1 | No `meditation` symbol remains | Low |
| T1.6 | Board generation stops placing hazard tiles | — | `sim:occupancy` loses six silent systems | Low |
| T1.7 | Board generation stops placing dungeon cards | — | N1/N2 hold on every generated floor | **High** — the deepest change |
| T1.8 | Floor completes on an empty board | T1.7 | A floor clears with no exit tile present | **High** |
| T1.9 | Remove the route/gateway layer between floors | T1.8 | No between-floor screen | Med |
| T1.10 | Remove gold, shop, rooms | T1.9 | Nothing purchasable exists | Med |
| T1.11 | Remove relics and loadouts | T1.10 | No draft, no inventory | Med |
| T1.12 | Delete the thirty `dungeon-*` modules and their tests | T1.7–T1.11 | `ls src/shared/dungeon-*` is empty | Med |
| T1.13 | Delete the hazard-tile modules and their tests | T1.6 | | Low |
| T1.14 | Remove dungeon save migrations, keeping a one-way upgrade for existing saves | T1.12 | An old save loads and plays | Med |
| T1.15 | Strip the HUD to six elements | T1.11 | §49.2's table is exactly what is on screen | Low |
| T1.16 | Remove dungeon Codex entries, copy, and mechanics-catalog rows | T1.12 | Catalog regenerates clean | Low |
| T1.17 | Re-baseline every band; ratchet up; record before/after | all of Phase 1 | Occupancy silent list is empty | Low |

## G.2 Phase 2 — the loop made whole

| ID | Task | Depends on | Acceptance | Risk |
|---|---|---|---|---|
| T2.1 | The tempered pair curve (§32.2) | T1.7 | Curve matches the table | Low |
| T2.2 | Authored floors 1–3 (§51) | T2.1 | N6, N7 | Low |
| T2.3 | The severance drop (§37.3) | T1.7 | N8 ≥ 0.25 | **High** — see F.7 |
| T2.4 | Measure the dropped-pair distribution; cap if the tail is fat | T2.3 | Distribution recorded in BALANCE_NOTES | Low |
| T2.5 | Multiplicative scoring (§40.2) | T1.7 | N5 within 0.25–0.70 | Med |
| T2.6 | The floor par (§41.3) | T1.8 | `turns / par` visible | Low |
| T2.7 | The floor-end bonus with tier multiplier (§40.5) | T2.5, T2.6 | Clearing at Fever pays 5× cold | Low |
| T2.8 | Floor clear happens in place, no screen (§41.4) | T1.9 | No screen between boards | Med |
| T2.9 | Lives out; turn ceiling in (§42.2) | T2.6 | A run ends only on ceiling or quit | Med |
| T2.10 | "A bad floor is quiet, not punishing" as an explicit criterion | T2.9 | Trace 4 (§67) reproduced as a test | Low |
| T2.11 | Tile trait triage: keep four, cut five (§32.4) | T1.7 | Five trait kinds gone | Low |

## G.3 Phase 3 — the strategic layer made visible

| ID | Task | Depends on | Acceptance | Risk |
|---|---|---|---|---|
| T3.1 | Tier-aware aim guide (§29.2) | T1.7 | Hover and long-press both work | Low — **done, Gen 185** |
| T3.2 | Next-tier ghost overlay (§30.3b) | T3.1 | The delta is visible on the board | Med — **done, Gen 185** |
| T3.3 | Rung value pips in the meter (§30.3a) | — | Each tick carries weight | Low — **done, Gen 186** |
| T3.4 | Held-pair marker, capped (§30.3c) | — | Changes no rules; mistake rate check | **Blocked on a product decision** — collides with the shipped pin; three options and a recommendation at §30.3(c) |
| T3.5 | Score built term by term (§40.4) | T2.5 | The multiplier is watched being constructed | Low — **done, Gen 187** |
| T3.6 | Show that a pair's halves are far apart | **T3.4** | Derived from trace §68(b) | **Blocked with T3.4** — see the note below |

**T3.6 depends on T3.4, not T3.1 (found building Gen 185).** A pair's span is a fact about the
hidden *symbol* layout, not about the suits on the backs, so putting it on a tile the player has not
found tells them where not to look - it hands back part of the memory game the clump read never
touches. In trace §68(b) the player *knew* both halves, because it was a held pair; the interface
was only failing to reflect something they already had. Nothing in the run state knows a pair is
known until the held-pair marker exists. So the span belongs on the marker: mark the pair, and the
marker says whether it is worth holding.

## G.4 Phase 4 — feel

| ID | Task | Acceptance |
|---|---|---|
| T4.1 | Every duration set to §45's table | Timings match |
| T4.2 | Octave per ripple wave (§46.1) | Deep and wide chains sound different |
| T4.3 | The trauma model (§47.1) | Deterministic; survives hit-stop; replays identically |
| T4.4 | Camera Comfort, three positions (§47.4) | Reachable from pause |
| T4.5 | The Fever ceremony to the millisecond (§39.3) | Identical every time |
| T4.6 | The drop falls rather than shatters (§37.4) | Distinct visually and audibly |
| T4.7 | The mismatch as exchange (§34.4, §46.5) | Tint plus resolving figure |
| T4.8 | Text size control (§48.3) | Three steps; board does not reflow |
| T4.9 | The partner-departure travel animation (§70.4) | The signature visual is unmissable |

## G.5 Phase 5 — the run and the record

| ID | Task | Acceptance |
|---|---|---|
| T5.1 | Depth as the headline record (§55.1) | Shown when passed |
| T5.2 | The five-record set (§55.2) | No currencies |
| T5.3 | Run end leads with the best break (§42.3) | The break replays |
| T5.4 | One-input restart (§6.3) | < 1s |
| T5.5 | The Rematch (§56.3) | Delta in turns and mistakes |
| T5.6 | Improvement instrumentation (§56.4) | N11 measurable |

## G.6 Phase 6 — the candidates

| ID | Candidate | Kill criterion |
|---|---|---|
| T6.1 | The Recall (§44.2) | Mistake rate falls > 25% |
| T6.2 | Acting inside the ripple window (§36.3) | Not invisible to a player who ignores it |
| T6.3 | Fog (§43.3) | Session length falls, or mistakes rise > 25%, or spread narrows |
| T6.4 | The player memory model (§59) | Changes no decision |
| T6.5 | Attract-mode Fever replay (§52.2d) | Delays restart |

## G.6b Phase 6b — the settle and the room it needs

Not in the original plan. Asked for after Phase 3 shipped, and it belongs here rather than as a
candidate because it is not a feature the loop can be measured with or without: it changes what a
board *is* between one turn and the next, and everything downstream of adjacency reads that.

| ID | Task | Depends on | Acceptance | Risk |
|---|---|---|---|---|
| T6b.1 | Every cleared card leaves the board | — | No matched card sits face-up in its cell | Low — **done, Gen 190**, and kept |
| T6b.2 | ~~The survivors pack toward the middle~~ | T6b.1 | — | **Removed, Gen 192** — a memory game may not move a card a player has learned |
| T6b.3 | ~~The settle glides rather than teleports~~ | T6b.2 | — | **Removed with it** |
| T6b.4 | More suits from the first floor | T6b.2 | A run's early floors carry more than two suits | High — **done, Gen 191**, at one suit per four pairs with a scattered floor capped at two |
| T6b.5 | A pair curve that grows with the settle | T6b.4 | Later floors carry more cards; the board still fits | Med — **done, Gen 191** |
| T6b.6 | The ripple fires again | T6b.2 removed | `rippled` back above zero in `sim:cascade` | **Done, Gen 192** — 0.16 of breaks, more than before any of this. The settle was the cause. |

**Why the settle is not cosmetic.** Every reach in the game - the pop, the ripple, the severance
drop, the aim guide - reads the grid as it stands. A board that never moves is a board whose clumps
only ever shrink, so the cascade decays toward nothing as a floor empties, and the last matches of a
floor are worth nothing to break with. A board that closes its gaps keeps making new neighbours.

**What it cost, measured (Gen 190).** The ripple stopped firing: 7% of breaks reached a second wave
before, none after. Not because reactions got smaller - pairs per floor went up - but because a
packed board lets the first wave swallow the partners that used to seed the second.

**What T6b.4 and T6b.5 bought (Gen 191).** The boards grew and the palette grew with them, which is
the same change §30.3's reach experiment concluded was needed: suits that spread past reach 2, which
means bigger boards with more colours on them, not a different reach. It worked on the ladder -
Sharp's step over Clean goes 0.32 pairs to 0.50, the spread from a lone match to Fever 5.04 to 6.08,
and a floor takes 5.4 turns for the reference player against 4.1. Momentum climbs faster on a bigger
board than the pair count it is measured against, so the tier shares were raised to 0.45 and 0.6 to
keep Fever rare.

**Why the settle came out (Gen 192).** Because it moves cards a player has memorised, which is the
one cost a memory game cannot pay. No care in the movement rule buys it back: the settle was built
to be gentle - globally-closest pairs, the hole walking outward rather than a card flung across the
grid - and gentle is still moved. Either the grid a player learns is the grid they come back to or
it is not. `docs/REMOVED_SETTLE.md` keeps what it cost and what shape an answer to the hollowing
problem would have to have.

**T6b.6 came free with it.** The ripple now fires on 0.16 of breaks, against 0.02 with the settle in
and 0.07 before any of this - and the severance drop went from 0.463 of floors to 0.588. Both had
the same cause, and it was neither the reach nor the board size: a packed board lets the first wave
swallow the partners and orphans the second wave and the drop existed to find. Two generations were
spent tuning around a number one change had broken. The lesson is in `docs/BALANCE_NOTES.md`, Gen
192: when a metric falls the generation a mechanic lands, suspect the mechanic.

## G.7 Phase 7 — the sweep

| ID | Task |
|---|---|
| T7.1 | Re-run every gate; ratchet every band |
| T7.2 | Regenerate catalog, Codex, checklist, diagrams |
| T7.3 | Rewrite `CHAIN_CHUNK_FEVER_DESIGN.md` as the spec, pointing here for rationale |
| T7.4 | The screenshot test as a capture job (§49.1) |
| T7.5 | A recorded playthrough of floors 1–10 |
| T7.6 | Update this document with what the build taught |

## G.8 Ordering constraints

```
T1.1 ─┬─ T1.2 ─┐
      ├─ T1.3  │
      ├─ T1.4  ├──────────────┐
      └─ T1.5 ─┘              │
T1.6 ──────────── T1.13       │
T1.7 ─┬─ T1.8 ── T1.9 ── T1.10 ── T1.11 ─┬── T1.12 ── T1.14
      ├─ T2.1 ── T2.2                    └── T1.15 ── T1.16 ── T1.17
      ├─ T2.3 ── T2.4
      ├─ T2.5 ── T2.7
      ├─ T2.11
      └─ T3.1 ─── T3.2

  T3.4 ─── T3.6

T6b.1 ─── T6b.4 ── T6b.5 ── T6b.6
(T6b.2 and T6b.3 removed at Gen 192)
```

**T1.7 is the critical path.** Everything of consequence depends on board generation no longer
dealing dungeon cards, and it is also the highest-risk single task in the plan.

---

# Appendix H — Removal Manifest

> Every module the removal deletes, with what it did and what — if anything — inherits its job.
> Generated against the file list at Gen 171; `git log --all -- <path>` finds each one's history.

## H.1 The dungeon modules

| Module | What it did | Inherited by |
|---|---|---|
| `dungeon-blueprint-policy-rules.ts` | Exit route/lock policy, objectives, budgets, pair capacity | Nothing — floors have no policy |
| `dungeon-board-generation-rules.ts` | Placed dungeon cards onto the board | Nothing |
| `dungeon-board-status.ts` | The board's dungeon-state summary for the HUD | Nothing |
| `dungeon-boss-clear-rules.ts` | Boss defeat and its rewards | Nothing |
| `dungeon-boss-rules.ts` | The four boss definitions | Archived; **LATER** as authored floors (C.4) |
| `dungeon-card-read-model.ts` | What the player is allowed to know about a card | Nothing |
| `dungeon-card-recipe-rules.ts` | Which cards a floor deals, and the four-pass trim | Nothing — this is the module the reserve fought |
| `dungeon-cards.ts` | The kind and effect catalogs | Archived in full |
| `dungeon-combinatoric-matrix.ts` | Coverage matrix over card combinations | Nothing |
| `dungeon-e2e-fixtures.ts` | Fixtures for browser tests | Replaced by loop fixtures |
| `dungeon-encounter-context-rules.ts` | Encounter pressure per node kind | Nothing |
| `dungeon-enemy-card-rules.ts` | Enemy HP and damage | Nothing |
| `dungeon-enemy-hazard-rules.ts` | Roaming hazards | Nothing (never fired) |
| `dungeon-exit-rules.ts` | Exit reveal and activation | The empty board (§41.1) |
| `dungeon-floor-blueprint-rules.ts` | Assembled a floor's whole dungeon plan | Board generation, directly |
| `dungeon-key-copy.ts` | Key naming | Nothing |
| `dungeon-key-rules.ts` | Key inventory and lock spending | Nothing |
| `dungeon-match-reward-rules.ts` | Treasure payouts | Score (§40) |
| `dungeon-reveal-rules.ts` | Card reveal timing | Nothing |
| `dungeon-room-rules.ts` | Room services | The Recall, partly (C.2) |
| `dungeon-room-targeting-rules.ts` | Which tiles a room affects | Nothing |
| `dungeon-rules.ts` | Shared dungeon vocabulary | Nothing |
| `dungeon-run-state-rules.ts` | Dungeon fields on the run | Nothing |
| `dungeon-save-migration.ts` | Save migrations for dungeon state | A one-way upgrade (T1.14) |
| `dungeon-scout-rules.ts` | Scouting reveals | The Recall |
| `dungeon-showcase-run-rules.ts` | A demo run through dungeon content | Nothing |
| `dungeon-tile-augmentation-rules.ts` | Attaching card data to tiles | Nothing |
| `dungeon-topology.ts` | Route graph | Nothing |
| `dungeon-trap-rules.ts` | Trap arming and springing | Nothing |
| `dungeon-versioning.ts` | Dungeon rules version | Nothing |

Thirty modules, plus their test files, plus the fixtures and Codex entries that reference them.

## H.2 The hazard-tile modules

| Module | What it did |
|---|---|
| `hazard-tiles.ts` | The six hazard definitions, their copy, and their announcements |
| `enemy-hazard-board-rules.ts` | Placing and moving roaming hazards |
| (associated tests and fixtures) | |

## H.3 The mode modules

Every module, screen, record, save field and copy string whose only reason to exist is `daily`,
`puzzle`, `gauntlet` or `meditation`. The audit is task T1.1–T1.5; the acceptance criterion is that
grepping for each mode name returns nothing outside the archive and the save migration.

## H.4 What is deliberately kept

| Module | Why |
|---|---|
| `tile-suit-rules.ts` | Suits are core |
| `chunk-break-rules.ts` | The break is the game |
| `chain-tier-rules.ts` | The ladder is the game |
| `scoring-rules.ts` | Rewritten by §40, not removed |
| `board-build-rules.ts` | Simplified enormously |
| `pop-reach-simulation.ts` | The loop's own instrument |
| `cascade-balance-simulation.ts` | Same |
| `system-occupancy-simulation.ts` | Same — and it is what found the eleven |
| `mechanic-feedback.ts` | The memory-tax taxonomy stays, with §2.2's caveat recorded in it |
| Accessibility, input, crash-reporting, save, and platform modules | Untouched by this work |

---

# Appendix I — The Measurement History

> Every measured finding that led here, in order, with the number that mattered. This is a
> condensed index into `BALANCE_NOTES.md`; that file is the authority.

| Gen | Finding | The number |
|---|---|---|
| 117 | Suits shipped: every pair gets one, dealt in clumps, visible on the tile back | 4 suits |
| 118 | Chain tiers and the chunk break enter the real turn path | — |
| 119 | The break becomes visible: shatter wave, tier names, Fever pulse | — |
| 120 | The dungeon is woven into the cascade — treasure spills, enemies take hits | — |
| 121 | First balance pass. Fixed rungs at ×6/×10 gave Fever on **zero percent** of floors even for a perfect player, because a twelve-pair floor ends before a chain of ten exists | 0.00 |
| 121 | Floor-relative rungs introduced. A streak-only ladder ate itself: a sloppy player reached Fever *more often* than a clean one | — |
| 124 | Style shots: per-pair naming with a rising pitch | — |
| 125 | Extreme Fever: the floor's end pays what the chain left standing | — |
| 126 | Deal profiles by archetype: clumped, scattered, two-suit | — |
| 127 | The aim guide: read the clump before you commit | — |
| 130 | Three cascade relics: Tuning Fork, Magpie's Ledger, Suit Lens. Each alone inside the bare bands; all three lift a 25%-miss player's Fever share to 0.23 | 0.23 |
| 137 | The drop ships: an orphaned clump breaks on its own | — |
| 139 | Hit-stop and slow-motion on a Fever break | — |
| 143 | **The pop:** every match breaks what it touches, chain or no chain | — |
| 144 | **The ripple:** every popped tile seeds the next wave | — |
| 145 | Balance pass with the pop in. A floor clears in 6.3 turns rather than 9.2. Full momentum credit for the pop broke the ladder's separation: a 25%-miss player reached Fever on 22% against a clean player's 35% | ratio 1.6 |
| 145 | Half credit for the pop adopted. Fever on 20% of clean floors against 6% at the reference miss rate | ratio 3.3 |
| 148 | **The pop was invisible in a real run.** Floors 1–3 popped on **0% of matches on every seed**; floor 5 on 19%. Two causes: four suits dealt over two- and three-pair floors, and hazard tiles excluded from breaking | 0.00 → 0.50–1.00 |
| 149 | **The occupancy census.** Twelve systems fire on no floor; one is thin. A 40% dungeon reserve woke snares and the ward but gutted floor identity | 12 silent |
| 151 | **The drop never fires.** 483 of 501 Sharp/Fever breaks were vetoed by a pair with a job. Removing the veto was not enough: at Sharp the ripple has already swept the suit on 92–98% of breaks | 0.000 |
| 151 | `sim:pop` was measuring boards nobody plays — a bare `buildBoard` with no tag, archetype or mutators. Fixed to build through the floor schedule | — |
| 155 | The occupancy census enters the systems gate as a ratchet | — |
| 167 | **The reserve.** The dungeon's pair capacity was the identical expression to the floor's pair count. Reserving 25%: floor 4 pop rate 0.52 → 0.94; floor 8 pairs-per-match 1.80 → 2.60; suits per floor 1 → 2–4 on floors 9–11 | 0.52 → 0.94 |
| 167 | The trim needed **four passes** of protection to stop floors losing their own archetype's card | 4 |
| 167 | **Nothing came off the silent list.** The 40% measurement did not hold at the 25% that shipped | 12 silent, still |
| 168 | **The ladder had no middle.** Measured at each tier's own rung: 1.67 / 1.91 / **1.92** / 3.34. Sharp was worth one hundredth of a pair over Clean | step 0.01 |
| 168 | Cause 1: every wave walked the whole connected region whatever the chain — the reach ladder was never in the code | — |
| 168 | Cause 2: a suit averaged 4.5 pairs, about half breakable, so Clean's two waves swept the lot | 4.5 |
| 168 | Fixed: bounded wave (reach 2), ripple moved from Clean to Sharp, one suit per six pairs. Ladder becomes 1.18 / 2.32 / 2.71 / 3.71 | spread 1.66 → 2.53 |
| 168 | **The drop came off the silent list**, exactly as Gen 151 predicted once suits were big enough | 11 silent |
| 168 | Suit Lens was dead content under the new palette; rebuilt as "one suit fewer, down to two" | — |
| 168 | Tuning Fork was taking the top of the ladder away: with the chain loadout, clean Fever on big floors fell to 0.08 against a 0.15 band | 0.08 |
| 169 | **The census could only see the dead half.** Ceilings added per cadence; two rows breached and both were mislabels | 2 mislabels |
| 170 | **Two simulations disagreed about Fever by 5×.** `sim:cascade` counted a break as Fever by reading the tier *after* the turn — the tier the break's own pairs had just bought | 0.26 vs 0.04 |
| 170 | With the counter read honestly, every Fever band had been tuned against an inflated number | 0.26 → 0.14 |
| 170 | Momentum reaches the Fever rung on 61% of floors but a Fever *break* lands on 8%: at two thirds of a floor the rung arrives when the board is empty | 0.61 vs 0.08 |
| 170 | Fever moved to half a floor. Census 0.050 → 0.119; **the thin list is empty** | 0.119 |
| 171 | The dungeon layer archived and removed | 30 modules |

## I.1 The pattern across the history

Reading the table end to end, four recurring failure shapes appear, and they are worth naming
because they will recur:

**(a) A system shipped, tested, and never fired.** Gens 148, 149, 151 and the eleven silent
systems. The cause is always the same: unit tests build the board the rule needs, and generation
never does. **The defence is the occupancy census**, and it should be extended to any new mechanic
on the day it ships (this is standing task Gen 162).

**(b) An instrument measured a board nobody plays.** Gen 151's `sim:pop` asking for a bare
`buildBoard`. **The defence is that every simulation must build floors the way a run does.**

**(c) An instrument re-derived a rule and drifted.** Gen 170's Fever count. **The defence is §58.2:
read the game's counters, never re-implement.**

**(d) A number was measured on a sample too small for the band it fed.** Three separate fixtures
in Gens 168 and 170 — the clumped-deal control at four seeds, the cascade bands at three, the
checklist row at three. **The defence is to widen the sample before touching the band**, which is
what was done each time.

All four are process failures rather than design failures, and all four now have a written defence.
That is the real value of the instrumentation: not the numbers, but the catalogue of ways numbers
lie.

---

# Appendix J — Comparative Reference Data

> Per-game detail behind Part II, at the level needed to steal precisely. Figures marked *(stated)*
> are from developer accounts; *(observed)* are from play; *(analysis)* are my inference.

## J.1 Peggle

| Property | Value | Source |
|---|---|---|
| Rules a player must be told | 6 | observed |
| Pegs per board | ~100 | observed |
| Orange pegs (the win condition) | 25 | observed |
| Balls per level | 10 | observed |
| Free-ball mechanism | The sliding bucket | observed |
| Feedback channels per peg hit | 4 (pop, colour, pitch, score float) | observed |
| Pitch behaviour | Rises through a shot, resets each shot | observed |
| Board mutation timing | Deferred to end of shot | observed |
| Celebration length | ~8s | observed |
| Celebration variability | None — identical every time | observed |
| Bonus value relative to a level | Greater than the level | observed |
| Powers | 10 Masters, each one power | observed |
| Content model | 55 hand-authored levels | observed |
| Known weakness | The last-orange-peg endgame | analysis |

**What we take:** §4.7. **What we refuse:** §4.8.

## J.2 Puzzle Bobble / Bust-a-Move

| Property | Value |
|---|---|
| Rules | 4 |
| Match threshold | 3 same-colour connected |
| Orphan rule | Anything not connected to the ceiling falls |
| Where the skill ceiling is | Seeing severance opportunities |
| Pressure | Descending ceiling, time-based |
| Colour-blind provision | None (historically) |
| Board mutation | Immediate |

**The single idea worth the most:** the orphan rule, because its payoff is bounded by the whole
board's structure rather than by the local match. §5.2, §37.3.

## J.3 Tetris

| Property | Value |
|---|---|
| Rules | 4 |
| Piece count | 7 |
| Line-clear score curve | 1 / 3 / 5 / 8 (roughly), for 1–4 lines |
| Strategic consequence | Deliberate risk-building (the well) |
| Failure | Absolute, immediate |
| Restart time | Under 1 second |
| Difficulty axis | Speed |
| Content | None; one rule set forever |

**The idea worth the most:** a steeply superlinear reward for concentration, which converts
survival into deliberate risk-taking. §6.2.

## J.4 Tetris Attack / Panel de Pon

| Property | Value |
|---|---|
| Rules | 6 |
| Match threshold | 3 in a line |
| Automatic chain | Yes (falling blocks re-match) |
| **Skill chain** | **Yes — the player can act during the falling window** |
| Where the skill ceiling is | Executing pre-planned swaps inside the resolution window |
| Pressure | Rising stack |
| Competitive mechanic | Chains send garbage; garbage clears through chains |

**The idea worth the most:** acting inside the resolution window. §7.3, §36.3. This is the highest
unexplored ceiling available to us.

## J.5 Puyo Puyo

| Property | Value |
|---|---|
| Rules | 4 |
| Match threshold | 4 connected |
| Chain multiplier | Roughly ×2 per link |
| A 5-chain vs a 1-chain | ~64× |
| Player behaviour it produces | Long silent build, one detonation |
| Community vocabulary | Extensive and player-invented (GTR, stairs, sandwich, fron) |
| Determinism | Full — the falling sequence is known |

**The ideas worth the most:** the steep chain curve (§8.2) and the observation that determinism is
the precondition for a shared vocabulary (§8.3).

## J.6 Bejeweled / Candy Crush

| Property | Bejeweled | Candy Crush |
|---|---|---|
| Rules | 3 | 3 + goals + boosters |
| Cascade source | Random refill from off-screen | Same |
| Cascade is skill or luck | Luck | Luck |
| Player can act during cascade | No | No |
| Failure | Soft / none | Lose a life |
| Monetisation | Premium (originally) | Lives, boosters, IAP |
| Difficulty tuning | Even | Reportedly tuned against conversion *(stated, widely reported)* |
| Special pieces from big matches | Limited | Extensive (striped, wrapped, colour bomb) |

**Take:** the special-piece-from-big-match idea (§9.4) and the awareness that a no-refill board puts
us in the skill column by construction (§9.3). **Refuse:** everything in the bottom half of the
Candy Crush column.

## J.7 Zuma

| Property | Value |
|---|---|
| Rules | 4 |
| Pressure | Spatial (a line advancing along a track) |
| Pressure reversible? | **Yes** — chains push the line back |
| Risk and reward | The same object (a long line is dangerous and full of chain potential) |
| Failure | Hard, when the line reaches the hole |

**The idea worth the most:** reversible spatial pressure. §10.2, and the fog candidate at §43.3.

## J.8 Cookie Clicker and the incremental family

| Property | Value |
|---|---|
| Skill required | None |
| The number | Always moving |
| Next threshold | Always exactly one, visible, close |
| Threshold spacing | Logarithmic |
| Loss | None |
| Session boundary | None (a known weakness) |
| Retention mechanism | Idle accrual, prestige |

**Take:** no dead time, one visible next threshold, logarithmic spacing, nothing ever lost.
**Refuse:** idle accrual, prestige, waiting as a mechanic. §11.4.

## J.9 Universal Paperclips

| Property | Value |
|---|---|
| Length | ~4 hours |
| Ends? | **Yes** |
| Retention mechanism | It is finishable and therefore recommendable |

**The idea worth the most:** a thing that ends is shareable in a way an endless thing is not.
§11.3, applied to the run rather than the product.

## J.10 Vampire Survivors

| Property | Value |
|---|---|
| Run length | ~25 minutes |
| Power delta across a run | Enormous (order 1000×) |
| Rate of change | Always palpable |
| End state | Deliberately absurd |
| Reset | Not a punishment; the ascent is the fun |
| Build vocabulary | Named evolutions |

**Take:** the compressed, always-palpable ascent, applied at the floor scale (§12.3). **Refuse:**
automation.

## J.11 Balatro

| Property | Value |
|---|---|
| Score model | `chips × mult` — multiplicative |
| Emotional arc | "I found the thing that makes the other thing enormous" |
| Run structure | 8 antes, escalating thresholds |
| Threshold behaviour | Grows faster than natural growth, forcing engine-building |
| Player behaviour | Screenshotting scores |

**Take:** multiplicative scoring (§13.2), a visible climbing threshold (§13.3), extreme numbers as
their own reward. **Refuse:** deck-building as a second system.

## J.12 Slay the Spire

| Property | Value |
|---|---|
| Run length | 45–90 minutes |
| Encounters per run | ~50 |
| Meaningful choices | ~1 per 90 seconds |
| Choice quality | Informed and consequential |
| Failure | Teaches — the player knows what killed them |
| Unit of play and storytelling | The run |

**Take:** the run as the unit, few informed consequential choices *or none*, failure that teaches.
**Refuse:** between-encounter menus as the primary decision surface. §14.

## J.13 Threes and 2048

| Property | Threes | 2048 |
|---|---|---|
| Development time | 14 months | A weekend |
| Merge rule | 1+2=3, then equals | Equals only |
| Explanation needed | A sentence | Two seconds from a screenshot |
| Mechanical depth | Higher | Lower |
| Reach | Lower | Vastly higher |

**The lesson:** legibility beats depth for reach; a screenshot must teach the game. §15.

## J.14 The synthesis table

What each reference contributes to our specification, in one place:

| Reference | Contribution | Our section |
|---|---|---|
| Peggle | Disproportionate identical ceremony | §39.3 |
| Peggle | Rising pitch through a chain | §46.1, §74 |
| Peggle | Deferred board mutation | §45.2 |
| Peggle | Feedback generosity | §46.2 |
| Puzzle Bobble | The orphan/severance rule | §37.3 |
| Puzzle Bobble | Structural reading as the skill ceiling | §80 |
| Zuma | Reversible spatial pressure | §43.3 |
| Tetris | Superlinear reward for concentration | §40.2 |
| Tetris | Legible deliberate risk | §30 |
| Tetris | Sub-second restart | §72 |
| Tetris Attack | Acting inside the resolution window | §36.3 |
| Tetris Attack | Chains as performance | §36.3 |
| Puyo | Steep chain curve | §40.2 |
| Puyo | Determinism as the precondition for vocabulary | §94 |
| Bejeweled | (negative) refill randomness is the luck source to avoid | §9.3 |
| Candy Crush | Big match creates a forward-paying special | §44.2 |
| Cookie Clicker | No dead time; one visible next threshold | §45.1, §70.3 |
| Paperclips | A run that ends is a story | §42 |
| Vampire Survivors | Compressed palpable ascent | §12.3, §84 |
| Balatro | Multiplicative score, built visibly | §40.2, §40.4 |
| Slay the Spire | Few informed choices, or none | §63 |
| 2048 | The screenshot test | §49.1 |

---

# Appendix K — The Copy Deck

> Every player-facing string in the specified game. The shortness of this list is a design output:
> a game that needs less copy is a game that explains itself.
>
> House style: plain, factual, present tense. Name events; never congratulate. The game says what
> happened, and the player decides how to feel about it.

## K.1 In-run

| String | When | Notes |
|---|---|---|
| `Find a pair.` | Under the board, floor 1 only, until the first match | The only instruction in the game |
| `Clean` | Crossing the rung | Rung names appear in the feedback rail |
| `Sharp` | Crossing the rung | |
| `Fever` | Crossing the rung | Also the ceremony word, at 2× size |
| `Pop` | A break of one wave | |
| `Ripple ×N` | A break of N > 1 waves | |
| `Drop` | Pairs falling from severance | |
| `Halo` | The Fever halo taking cross-suit tiles | |
| `Floor N` | The HUD | |
| `N / P` | Turns against par | |
| `Recall ready` | The power is charged | |
| `Best: N` | When the run passes the personal best depth | |

## K.2 Floor clear

| String | Notes |
|---|---|
| `Floor N cleared` | |
| `N turns · par P` | Factual, never evaluative |
| `Best floor` | Only when true |

## K.3 Run end

| String | Notes |
|---|---|
| `Floor N` | The headline, largest type |
| `Best N` / `+N` | The delta against personal best |
| `Biggest break: N pairs` | With the terms: `N pairs × Fever ×8 × Ripple ×5.5` |
| `Again` | The only button |
| `Details` | The collapsed expansion |
| `Rematch your best` | The §56.3 offer |

## K.4 Pause

`Resume` · `Camera` (`Full` / `Reduced` / `Off`) · `Text size` · `Sound` · `Music` · `Quit run`

## K.5 What the copy must never say

| Forbidden | Why |
|---|---|
| `Nice!`, `Great job!`, `Amazing!` | Congratulation is the game telling the player how to feel; the event should do that |
| `So close!` | Manufactured near-miss framing (§21.3) |
| `Don't lose your streak!` | Loss framing (§25.1.3) |
| `Come back tomorrow` | §54.3 |
| Any brain-training or cognitive-benefit claim | §25.1.15 |
| A named strategy | §94 — naming is the community's job |
| Any explanation of a mechanic in more than one clause | §50.1 — if it needs a paragraph, the mechanic is wrong |

## K.6 Accessibility strings

Every event in K.1 has a live-region announcement and a reduced-motion variant. The reduced-motion
variant describes the *outcome*, never the animation:

| Event | Announcement | Reduced-motion variant |
|---|---|---|
| Pop | `Pop. N pairs.` | Same |
| Ripple | `Ripple, N waves. M pairs.` | Same |
| Drop | `Drop. N pairs fell.` | Same |
| Rung | `Sharp.` | Same |
| Fever | `Fever. N pairs.` | Same |
| Floor clear | `Floor N cleared in T turns.` | Same |

The variants being identical is the point: §45.4's rule that reduced motion reduces motion, not
information.

---

# Appendix L — Implementation Notes

> Module-level guidance for the people doing Part X. Not a design document; a set of warnings from
> somebody who has been reading this codebase.

## L.1 `board-build-rules.ts` — the highest-risk file

Task T1.7 lives here. Notes:

- The build path already funnels through one barrel (`board-generation.ts`, made a barrel at Gen
  48 specifically so there could not be two builders). Keep that property.
- Removing dungeon placement will leave a large amount of parameter plumbing (`floorTag`,
  `floorArchetypeId`, `featuredObjectiveId`, `activeMutators`, `dungeonNodeKind`) with no consumers.
  **Remove the parameters in a second pass, not the same one** — the first pass should be
  behavioural, so a bisect can separate "stopped placing cards" from "changed the signature".
- The invariant to assert after the change: `tiles.length === 2 × pairCount` and every `pairKey`
  appears exactly twice.

## L.2 `chunk-break-rules.ts` — simplifies dramatically

- `tileCanBreakInChunk` collapses to "hidden, part of a whole pair". The long exclusion list
  (exits, keys, levers, locks, shrines, route specials, hazards, bosses) all goes.
- `tileBlocksChunk` (unsprung traps stopping propagation) goes entirely.
- The treasure-spill branch, the findable branch, the enemy-damage branch and the warden branch all
  go, which removes most of the function's body.
- **What stays:** `findSuitRegion`, `breakClumpReach`, `breakReachesPartners`, `rippleWaves`, the
  wave loop, the halo, the drop, `chunkBreakMomentumPairs`, `chunkBreakScore`.
- The drop's restructure (T2.3) replaces the `DROP_MAX_PAIRS` threshold with a reachability test
  over the matched suit's remaining pairs. **Reuse `findSuitRegion` for that test** so the drop
  cannot drift out of sync with the pop, which is the whole point of §37.3.

## L.3 `chain-tier-rules.ts` — untouched by the removal

The ladder does not know about dungeon cards and never did. Its only change in this plan is §40's
scoring, which lives elsewhere.

## L.4 `scoring-rules.ts` — rewritten by §40

- The multiplicative model is a small function; the work is in the *presentation* (§40.4), which is
  a renderer concern.
- Keep `calculateMatchScore` as the base; `SCORE_PER_PAIR` is derived from it and should stay
  derived so a change to match scoring propagates.

## L.5 The simulations — must be updated in lockstep

All four simulations construct boards. When T1.7 changes what a board is, every simulation changes
with it. Notes:

- `pop-reach-simulation.ts` builds through `pickFloorScheduleEntry` — that schedule is dungeon
  vocabulary and will need replacing with the §33.4 profile rotation.
- `cascade-balance-simulation.ts` has a `relicIds` axis that becomes vestigial. Remove it in the
  same pass as T1.11 or it will silently test nothing.
- `system-occupancy-simulation.ts`'s counter roster loses eleven entries. **Do not delete the
  counters from `RunState` in the same commit as the roster** — leave them for one generation so
  the baseline diff is readable.

## L.6 Save migration — the one place to be careful

Existing saves carry dungeon state, mode records, relics and gold. T1.14's rule:

- **One-way upgrade.** Read the old shape, keep what survives (records, depth, settings), drop the
  rest.
- **Never fail to load.** A save that cannot be migrated should produce a fresh profile with the
  records preserved where possible, not an error. (Gen 21 built the unreadable-save surface; reuse
  it.)
- **Keep the migration for at least a year.** It is small and the alternative is a player losing
  their record.

## L.7 The HUD — delete, do not refactor

T1.15 removes objectives, keys, gold, mode, relics, loadout and hazard status from the run bar.
These are separate components with their own tests. Delete the components; do not try to
generalise what remains.

## L.8 Tests — the expected shape of the damage

Roughly half the shared test suite touches dungeon behaviour. The categories:

| Category | Action |
|---|---|
| Tests of dungeon rules | Delete with the rule |
| Tests of the loop that happen to use dungeon fixtures | Re-point at loop fixtures |
| Tests of generation that assert dungeon placement | Rewrite to assert the new invariants |
| Simulation tests | Re-baseline (T1.17) |
| Release-checklist rows for dungeon features | Delete the row and its verifier |
| Codex and catalog snapshots | Regenerate |

**Expect the suite to shrink by a third or more, and treat that as progress rather than as loss of
coverage** — coverage of deleted code is not coverage.

## L.9 The order that keeps the game playable

Restating G.8's critical path as an instruction: **stop generating before you delete.** After T1.7,
the dungeon modules are dead code that nothing calls, and deleting dead code is safe. If you delete
first, the game is broken for the length of the refactor and every intermediate state is unrunnable.

---

# Appendix M — Decision Log

> Every design decision this document makes that somebody could reasonably have made differently,
> with the alternative and the reason. Recorded so that revisiting one is a matter of disagreeing
> with a stated reason rather than rediscovering the question.

| # | Decision | Alternative considered | Reason |
|---|---|---|---|
| M1 | Remove the whole dungeon layer | Reserve more pairs for the loop | Tried at Gen 167; fixed the raw material and left the eleven silent systems, the rulebook and the fragility (§F.1) |
| M2 | One mode | Keep `daily`, cut the rest | Four variants of an unfinished loop; `daily` is **LATER** with a stated precondition (§F.4) |
| M3 | The floor ends on an empty board | Keep an exit tile | The exit was a second win condition competing with the first (§31.2) |
| M4 | No lives | Keep lives, remove only the dungeon | The chain is already a frequent, painful, recoverable loss; two punishments for one event (§34.3) |
| M5 | Turn ceiling at `par × 3` | No fail state at all | A run needs an ending to be a story (§11.3, §14.2) |
| M6 | Multiplicative scoring | Keep additive with a bigger ripple lift | Three of the deepest games in the survey converge on superlinear (§13.2, §83) |
| M7 | Severance drop | Keep `DROP_MAX_PAIRS` and tune it | A threshold cannot be aimed at; a structure can (§37.2) |
| M8 | Fever at half a floor | Lower `CHAIN_TIER_FEVER_MIN` instead | Measured: the min is not the binding constraint on big floors (Gen 170) |
| M9 | Square-root pair growth | Keep linear | Interference makes memory difficulty superlinear (§23.3) — though §84.1 pulls the other way, recorded at E.1 |
| M10 | Three authored floors | All procedural | Procedural cannot guarantee the three teaching moments (§51) |
| M11 | One power (the Recall) | Keep peek/shuffle/undo | An economy is a rulebook; one earned power does their job (§44.2) |
| M12 | Suits stay on tile backs | Remove them for memory purity | Without pre-flip information the cascade is luck (§77.2) |
| M13 | Depth as the headline record | Score | Depth is monotone in skill, not in time, and cannot be inflated (§55.1) |
| M14 | No between-floor choice | One informed choice per floor | A choice without information is a coin flip with clicking (§14.2); recorded as open at E.11 |
| M15 | Fog default off | Ship it on, or not at all | High variance idea with a written kill criterion (§43.3) |
| M16 | No assist mode that reveals the board | Ship one for accessibility | It removes the game rather than adapting it — flagged as a genuinely contestable call (§48.4, E.7) |
| M17 | Reduced motion keeps the wave stagger | Remove all stagger | The stagger is information about the reaction's structure (§45.4) |
| M18 | Mismatch holds for 700ms | Shorter, for pace | It is a study interval; too short makes the game unfair (§45.3, E.9) |
| M19 | Keep four tile traits, cut five | Cut all nine | The four kept either give information or amplify the break, with no rulebook (§32.4) |
| M20 | No cognitive-benefit claims | Market as brain training | Evidence for far transfer is weak, and the claim is regulated in places (§25.1.15) |
| M21 | Pitch rises per wave as well as per pair | Per pair only, as shipped | The ear should be able to tell depth from width (§46.1) |
| M22 | The ceremony is identical every time | Vary it to stay fresh | A ritual that changes stops being a ritual (§4.3c) |
| M23 | Record the removal's verdicts, not just its inventory | Archive only | An archive without verdicts invites the same argument every six months (Appendix C) |
| M24 | Write down what we would do if a band broke | Handle it when it happens | The moment a gate goes red is when judgement is scarcest (§60) |

---

# Appendix N — Proposed Mechanics, Pre-Judged

> A catalogue of mechanics somebody will propose, with a verdict against §25.2's three questions.
> The purpose is to make the common cases cheap to decide. A proposal not on this list gets the
> full three-question treatment.
>
> Columns: **Q1** downstream of the flip? **Q2** moves a measured band? **Q3** would the mechanic
> survive without its flourish?

| Proposal | Q1 | Q2 | Q3 | Verdict |
|---|---|---|---|---|
| A tile that reveals its neighbours when matched | ✓ | ✓ pop rate | ✓ | **Candidate** — this is `echo`, kept |
| A tile that extends the break's reach | ✓ | ✓ ladder spread | ✓ | **Candidate** — this is `conduit`, kept |
| A tile that stays face-up | ✓ | ~ | ✓ | **Kept** as `stasis`, reframed as a gift |
| A tile that lies about its symbol | ✗ | — | — | **No** — the board must not lie (§21) |
| A tile that moves | ✗ | — | — | **No** — violates I2 |
| A tile that explodes when mismatched | ✗ | — | — | **No** — punishes the core verb |
| A tile worth double score | ✓ | ~ | ✗ | **No** — it is a flourish on score with no mechanic underneath |
| A timer per floor | ✗ | — | — | **No** — §43.4 |
| A timer per turn | ✗ | — | — | **No** |
| A move limit per floor | ~ | ✓ | ✓ | **Already exists** as the turn ceiling (§42.2); a tighter one is a difficulty gate and is refused |
| A second board to switch between | ✗ | — | — | **No** — two boards halve the memory budget for each |
| A larger grid at depth | ✓ | ✓ | ✓ | **Already the plan** (§32.2) |
| A fifth suit | ✓ | ✓ ladder spread | ✓ | **Candidate**, but §33.2 says more suits means smaller suits; would need to come with a bigger board |
| Suits that interact (ember burns moss) | ✓ | ✓ | ✓ | **Candidate, deferred** — it is a real mechanic, it is downstream, and it is also a rulebook entry. Precondition: the loop is finished and this is the *first* addition considered |
| A wildcard tile matching anything | ✓ | ✓ | ✓ | **Candidate** — it is a memory aid earned or found; risk is it trivialises the endgame |
| Undo | ✗ | — | — | **No** — it removes the commitment that makes the flip tense (§23.4a) |
| A hint button | ✗ | — | — | **No** — same reason, and the Recall does the honest version |
| Shuffle the board | ✗ | — | — | **No** — destroys memorised positions (I2) |
| Score multiplier collectibles | ✗ | — | ✗ | **No** — a currency |
| Combo timer (act fast for a bonus) | ✗ | — | — | **No** — a timer wearing a hat |
| Daily seed | ~ | — | ✓ | **LATER**, precondition Phase 3 (C.7) |
| Weekly leaderboard | ✗ | — | — | **No** by default (§25.1.10); opt-in only |
| Achievements | ~ | — | ✓ | **Keep the existing few**, add none that are not statements about play |
| Cosmetic tile skins | ✗ | — | ✓ | **No, for now** — harmless and a distraction while the loop is unfinished |
| A story between floors | ✗ | — | — | **No** — a stop |
| A character with a passive | ✗ | — | — | **No** — a build layer by another name |
| Relics | ✗ | ✓ | ✓ | **LATER** with a written justification (C.8) |
| A shop | ✗ | — | — | **No** — a menu |
| An energy system | ✗ | — | — | **No** — §25.1.1 |
| Ads for a bonus | ✗ | — | — | **No** — no monetisation in the loop |
| A "continue?" after a failed run | ✗ | — | — | **No** — there is no failed run to continue |
| Boss floors | ~ | ~ | ✓ | **LATER** as authored *geometry*, never as HP (C.4) |
| A floor that is one enormous suit | ✓ | ✓ | ✓ | **Yes** — this is the `two_suit` profile taken further, and it is free variety (§90.1) |
| A floor with no clumping | ✓ | ✓ | ✓ | **Already exists** as `scattered` |
| A floor where suits ring each other | ✓ | ✓ | ✓ | **Candidate, high value** — §90.1's topology work |
| Pairs whose halves are always adjacent | ✓ | ✓ | ✓ | **Candidate** — an easy-floor generator knob |
| Pairs whose halves are always far apart | ✓ | ✓ | ✓ | **Candidate** — a hard-floor knob, and it directly feeds §78.2's best move |
| A visible count of pairs remaining per suit | ✓ | ✓ | ✓ | **Yes** — this is the severance signal §80 requires |
| A preview of the next floor | ✗ | — | — | **No** — a stop, and it removes the fresh-board reset |
| Carrying the chain between floors | ✓ | ✓ | ✓ | **No** — it removes the per-floor ascent (§12.3, §41.5), which is the design's best shape |
| A combo that spans floors | ✗ | — | — | **No** — same |
| Slow-motion on a big break | ✓ | — | ✓ | **Already shipped**; §39.3 formalises it |
| Screen shake | ✓ | — | ✓ | **Yes**, on the trauma model (§47.1) |
| Haptics | ✓ | — | ✓ | **Yes**, mapped to trauma |
| A replay of your best break | ~ | — | ✓ | **Yes** — §42.3 |
| Sharing a board by code | ~ | — | ✓ | **Yes** — §94, and much of it already exists |
| Ghost of your previous run | ~ | ✓ | ✓ | **Candidate** — this is the Rematch (§56.3) |
| A tutorial | ✗ | — | — | **No** — §50.1 |
| Difficulty selection | ✗ | — | — | **No** — §43.4 |
| Dynamic difficulty | ✗ | — | — | **No** — §25.1.13 |
| An endless mode with no floors | ✗ | — | — | **No** — floors are the ascent's reset |
| A zen mode with no chain | ✗ | — | — | **No** — a mode with the game turned off (C.7) |
| Colour-blind palettes | ✓ | ✓ N4 | ✓ | **Already required** — suits carry runes |
| A "seen" marker on tiles | ✓ | ✓ | ✓ | **Candidate** — this is §34.4's tint, Phase 4 |
| A pair-proximity hint | ✓ | ✓ | ✓ | **Already exists** and is honest after a break (Gen 123) |
| Sound-only play | ✓ | — | ✓ | **Interesting, unexplored** — the audio spec of §74 is nearly sufficient for it, and it would be a genuine accessibility win. Appendix E addendum |

### N.1 The four rejection categories, restated

Every **No** above falls into one of Appendix C.10's four categories:

1. **A second verb** (combat, a character passive, a build layer).
2. **Punishing the core verb** (explode on mismatch, timers, move limits as a gate).
3. **A menu** (shop, story, preview, difficulty selection).
4. **The board lies or moves** (fake tiles, shuffles, drift).

If a proposal is in one of those four, it can be rejected in a sentence. If it is not, it deserves
the full three-question treatment.

---

# Appendix O — The Band Register

> Every band, in one place, with its instrument, its current value, its threshold and its history.
> This is the table to check before and after any change to the loop.

| ID | Band | Instrument | Current | Threshold | Moved at |
|---|---|---|---|---|---|
| P1 | Early pop rate (floors 1–6) | `sim:pop` | per run | ≥ 0.45 | Gen 148 |
| P2 | Overall pop rate | `sim:pop` | per run | ≥ 0.50 | Gen 148 |
| P3 | Per-level pop rate | `sim:pop` | per run | ≥ 0.25 | Gen 148 |
| P4 | Ladder min step | `sim:pop` | 0.39 | ≥ 0.30 | Gen 168 (new) |
| P5 | Ladder spread | `sim:pop` | 2.53 | ≥ 2.20 | Gen 168 (new) |
| C1 | Settled share | `sim:cascade` | 1.00 | 1.00 | Gen 121 |
| C2 | Clean cleared share | `sim:cascade` | 1.00 | 1.00 | Gen 121 |
| C3 | Rating drift floors | `sim:cascade` | 0 | 0 | Gen 121 |
| C4 | Clean Fever share on big floors | `sim:cascade` | ~0.20 | ≥ 0.15 | Gen 148 (0.5 → 0.15), Gen 170 (re-measured) |
| C5 | Fever clean over reference | `sim:cascade` | 2.64 | ≥ 2.00 | Gen 148 (new) |
| C6 | Reference Fever share | `sim:cascade` | ~0.10 | ≤ 0.20 | Gen 121 |
| C7 | Extreme Fever clean over reference | `sim:cascade` | — | ≥ 1.50 | Gen 125 |
| C8 | Chunk share of score | `sim:cascade` | 0.18 | 0.10–0.35 | Gen 145 |
| C9 | Relic-loadout reference Fever share | `sim:cascade --relics` | — | ≤ 0.30 | Gen 130 |
| O1 | Core cadence | `sim:occupancy` | — | 0.90–1.00 | Gen 149; ceiling Gen 169 |
| O2 | Common cadence | `sim:occupancy` | — | 0.10–0.90 | Gen 149; ceiling Gen 169 |
| O3 | Rare cadence | `sim:occupancy` | — | 0.005–0.25 | Gen 149; raised to 0.02 and reverted; ceiling Gen 169 |
| O4 | Silent set matches baseline | `gate:occupancy` | 11 entries | exact | Gen 155; baseline moved Gen 168, Gen 170 |
| O5 | Thin set matches baseline | `gate:occupancy` | **empty** | exact | Gen 155; emptied Gen 170 |
| O6 | Dominant set matches baseline | `gate:occupancy` | empty | exact | Gen 169 (new) |
| N1 | `tiles.length === 2 × pairs` | unit | — | exact | **new, this document** |
| N2 | Every tile is half of a whole pair | unit | — | exact | **new** |
| N3 | Nothing enters the board mid-floor | property test | — | exact | **new** |
| N4 | Greyscale playability | contrast unit | — | pass | **new** |
| N5 | Largest break's share of floor score | `sim:cascade` | — | 0.25–0.70 | **new** |
| N6 | First pop inside the first three floors | authored-floor unit | — | 1.00 | **new** |
| N7 | Split-pair reach demonstrated on floor 3 | authored-floor unit | — | 1.00 | **new** |
| N8 | Drop fires on ≥ 0.25 of floors | `sim:occupancy` | 0.006 | ≥ 0.25 | **new** |
| N9 | Input-to-flip latency | e2e | — | 0ms | **new** |
| N10 | Median floors per run | telemetry | — | ≥ 6 | **new** |
| N11 | Improvement delta on replayed seeds | run history | — | > 0 | **new** |
| N12 | Fog does not raise mistakes > 25% | `sim:cascade` variant | — | ≤ 1.25× | **new** |

### O.1 The bands that have never moved

C1, C2 and C3 have held since Gen 121 and are the design's constitution: a floor can always be
finished, a clean player always finishes it, and the cascade never touches the rating. Any change
that threatens one of those three should be treated as a change to what the game *is*, not as a
tuning question.

### O.2 The one band with no acceptable failure

C3. Every other band has a legitimate story in which it moves. If the cascade ever moves a rating,
the game has started grading the player on luck, and there is no version of that we want.

---

# Appendix P — The Surviving Codebase

> What remains after Phase 1, grouped by role, so somebody arriving new can find the game. Modules
> not listed either go with the dungeon (Appendix H) or are infrastructure that this document does
> not touch.

## P.1 The loop

| Module | Role |
|---|---|
| `board-build-rules.ts` | Builds a board: pairs, symbols, layout |
| `board-generation.ts` | The single barrel every builder goes through (Gen 48) |
| `board-tile-generation-rules.ts` | Tile-level construction |
| `board-grid-dimensions.ts` | Grid sizing for a pair count and an aspect |
| `tile-suit-rules.ts` | Suits, palette sizing, the clump deal, the deal profiles |
| `tile-identity.ts` | Pair keys and tile identity |
| `chunk-break-rules.ts` | The pop, the ripple, the halo, the drop, momentum, break score |
| `chain-tier-rules.ts` | The rungs, momentum, the meter |
| `scoring-rules.ts` | Match score, and (after §40) the multiplicative break curve |
| `board-turn-transition.ts` | The turn: flip, resolve, apply the break, emit events |
| `turn-match-progress-rules.ts` | The per-floor counters the census reads |
| `turn-mismatch-rules.ts` | What a mismatch does |
| `level-clear-rules.ts` | Floor completion, par, the floor bonus |
| `playthrough-solver-rules.ts` | What pairs are playable; used by every simulation |

## P.2 The run

| Module | Role |
|---|---|
| `run-creation-rules.ts` | A new run |
| `next-floor-run-state-rules.ts` | What carries between floors |
| `run-number-guards.ts` | Defensive numeric guards used everywhere |
| `run-history-*` | The bounded run history (Gen 63) and the record set |

## P.3 The instruments

| Module | Role |
|---|---|
| `pop-reach-simulation.ts` | Is the loop reachable; does the ladder have range |
| `cascade-balance-simulation.ts` | What does the loop pay; does it separate skill |
| `system-occupancy-simulation.ts` | Does each system ever happen |
| `mechanic-feedback.ts` | Mechanic tokens and the memory-tax taxonomy (with §2.2's caveat) |

## P.4 The presentation

| Module | Role |
|---|---|
| `TileBoard` | The board |
| `RunShell` | The bar and the meter |
| `GameScreen` | The in-run surface |
| `uiSfx` / audio modules | §46, §74 |
| `pairProximityHint` | The proximity tip (Gen 123) |
| Copy modules | Every player-facing string (§K) |

## P.5 The platform

Untouched by this work: crash reporting, save persistence and migration, Steam integration, input
(mouse, touch, keyboard, gamepad), accessibility settings, display and fit contracts, the release
checklist, and the AI repo model.

## P.6 Where a newcomer should start

1. `docs/THESIS_THE_ADDICTIVE_LOOP.md` §26 — the game in one page.
2. `chunk-break-rules.ts` — the break, which is the game.
3. `chain-tier-rules.ts` — the ladder.
4. `tile-suit-rules.ts` — why the board looks the way it does.
5. `docs/BALANCE_NOTES.md` — every measurement, newest first.
6. `yarn sim:pop && yarn sim:cascade && yarn sim:occupancy` — watch the game play itself.

---

# Appendix Q — The Rules, As Told

> If a player asked "how does this work?", this is the answer, in full. It is reproduced here as a
> length test: **the whole rule set must fit on one screen.** If a future change makes this longer
> than it is, that change has a cost this document did not price.

---

**The board.** Tiles face down. Each tile's back shows a suit — a colour and a rune. The suits are
dealt in patches, so the board opens as a few coloured regions. Each tile's face shows a symbol, and
every symbol is on exactly two tiles.

**Your turn.** Turn over two tiles.

**If they don't match**, they turn back, and your chain drops to nothing.

**If they match**, they leave — and so does every tile of the same suit near them.

**Every match does that.** You don't need a chain for it.

**What a chain buys you:**

- **Three in a row (Clean):** a pair now leaves even if only one of its halves was in the blast. Its
  other half comes from wherever it is.
- **Further (Sharp):** the blast takes the whole patch, and each half that came from somewhere else
  sets off its own blast there. It keeps going until nothing new goes.
- **Further still (Fever):** it also takes everything touching it, whatever the suit. The game stops
  to show you.

**Falling.** If a suit is left with tiles that can never blast again, they fall on their own.

**The floor ends** when the board is empty. The next one is bigger. Your chain starts again.

---

That is 210 words. The dungeon layer's equivalent was roughly 2,400.

---

# Appendix R — Expected Values

> Modelled from §82 and §83, for reference while tuning. These are the model's numbers, not
> measurements; where the simulation disagrees, the simulation is right (§D.1).

## R.1 Expected pairs taken by a match, by floor size and tier

Assumes the §33.2 palette and the §33.3 two-island deal, with a board partly cleared.

| Pairs on floor | Suits | Pairs/suit | none | clean | sharp | fever |
|---|---|---|---|---|---|---|
| 3 | 1 | 3.0 | 2.0 | 2.4 | 2.6 | 2.8 |
| 6 | 2 | 3.0 | 1.4 | 2.0 | 2.3 | 2.9 |
| 8 | 2 | 4.0 | 1.3 | 2.2 | 2.6 | 3.3 |
| 10 | 2 | 5.0 | 1.2 | 2.3 | 2.8 | 3.6 |
| 12 | 2 | 6.0 | 1.2 | 2.4 | 3.1 | 3.9 |
| 14 | 2 | 7.0 | 1.2 | 2.5 | 3.4 | 4.2 |
| 16 | 3 | 5.3 | 1.2 | 2.4 | 3.0 | 4.1 |
| 18 | 3 | 6.0 | 1.2 | 2.4 | 3.2 | 4.4 |
| 21 | 4 | 5.3 | 1.2 | 2.4 | 3.0 | 4.5 |
| 24 | 4 | 6.0 | 1.2 | 2.5 | 3.2 | 4.8 |

**Reading it:** the `none` column is flat, which is correct — a bounded two-step reach takes about
the same regardless of board size. Every other column grows with suit size, which is the §33.2
argument.

**The jump at 16 pairs** is where the palette goes to three suits and each suit shrinks; the sharp
column dips. That is the cost of the palette rule and it is why `SUIT_TARGET_PAIRS` matters.

## R.2 Expected break score, by tier and waves

Nominal `SCORE_PER_PAIR = 10`, using §40.2.

| Pairs | Tier | Waves | Multiplier | Score |
|---|---|---|---|---|
| 1 | none | 1 | 1 × 1 | 10 |
| 2 | none | 1 | 1 × 1 | 20 |
| 2 | clean | 1 | 2 × 1 | 40 |
| 3 | clean | 1 | 2 × 1 | 60 |
| 3 | sharp | 2 | 4 × 1.75 | 210 |
| 4 | sharp | 3 | 4 × 2.5 | 400 |
| 5 | sharp | 3 | 4 × 2.5 | 500 |
| 6 | sharp | 4 | 4 × 3.25 | 780 |
| 7 | sharp | 5 | 4 × 4 | 1,120 |
| 6 | fever | 3 | 8 × 2.5 | 1,200 |
| 8 | fever | 4 | 8 × 3.25 | 2,080 |
| 10 | fever | 5 | 8 × 4 | 3,200 |
| 12 | fever | 6 | 8 × 4.75 | 4,560 |
| 14 | fever | 7 | 8 × 5.5 | 6,160 |
| 16 | fever | 9 | 8 × 6 (cap) | 7,680 |

**The range:** 10 to 7,680, or 768×. Compare the current additive model's 27×.

## R.3 Expected floor score, by floor size

Assuming the R.1 pairs and a competent player reaching Sharp on most floors, Fever on large ones.

| Pairs | Turns to clear | Break score | Floor bonus | Total |
|---|---|---|---|---|
| 3 | 2 | ~30 | 150 | ~180 |
| 6 | 4 | ~140 | 300 | ~440 |
| 8 | 5 | ~420 | 600 | ~1,020 |
| 10 | 6 | ~700 | 900 | ~1,600 |
| 12 | 6 | ~1,100 | 1,500 | ~2,600 |
| 14 | 7 | ~1,900 | 2,000 | ~3,900 |
| 16 | 8 | ~2,800 | 3,000 | ~5,800 |
| 18 | 8 | ~4,200 | 4,500 | ~8,700 |
| 21 | 9 | ~6,500 | 7,000 | ~13,500 |
| 24 | 10 | ~9,000 | 10,000 | ~19,000 |

**Total for a ten-floor run:** roughly 25,000–35,000, which is a number of the right shape to
screenshot (§13.4) — large enough to feel substantial, small enough to read at a glance.

**The floor bonus is roughly half the total at every depth**, which is deliberate: it keeps the
floor clear meaningful and it is where the Fever multiplier (§40.5) does its work.

## R.4 The largest-break share, checked against N5

From R.2 and R.3, on a twelve-pair floor with a good Fever break:

```
largest break = 2,080
floor total   = 2,600
share         = 0.80
```

**That is above N5's 0.70 ceiling.** Which means either:
- The model overestimates the Fever break (likely — R.1 says 3.9 pairs at Fever on a twelve-pair
  floor, not 8), or
- `CHAIN_MULT.fever = 8` is too high.

Recomputing with R.1's 3.9 pairs: `3.9 × 8 × 3.25 ≈ 1,014` against a floor total of ~2,600 — a
share of **0.39**, comfortably inside the band.

**The lesson:** §83.4's sanity check must be run against the *simulation*, not the model, before
the curve ships. The model is useful for shape and unreliable for magnitude, exactly as §82 warned.

---

# Appendix S — Pre-Mortem

> Written as though the project has already failed, eighteen months from now, and we are explaining
> why. Each scenario is followed by the earliest signal that would have shown it.

## S.1 "We removed the content and never replaced it with depth"

**The story:** Phase 1 shipped. The game was simpler and cleaner. Phase 2 shipped. Phase 3 kept
slipping because it was "just UI". Eighteen months later the game is a competent cascade memory
game that people play for twenty minutes and never again, because the strategic layer that was
supposed to give it a ceiling was never made visible.

**Earliest signal:** Phase 3 being described as polish. It is not polish; §102.1 shows it is the
material that fills minutes 3–7, which is where every reference product puts its best content.

**Prevention:** treat T3.1–T3.6 as loop work, not interface work, and schedule them before Phase 4.

## S.2 "The multiplicative score made everything except Fever pointless"

**The story:** §40.2 shipped without the §83.4 sanity check. Players learned to stall until Fever
and the middle of every floor became dead time.

**Earliest signal:** band N5 above 0.70, or players describing early turns as "getting it over
with".

**Prevention:** run the check before shipping the curve. It is one measurement.

## S.3 "The severance drop cleared floors for free"

**The story:** §37.3 shipped without measuring the dropped-pair distribution (§F.7). On boards with
widely-separated suit islands it dropped four or five pairs at a time, and floors became short and
unearned.

**Earliest signal:** floor turn counts falling well below par, or `chunkPairsDroppedThisFloor`
having a fat tail.

**Prevention:** T2.4, which exists because writing Trace 2 surfaced the risk.

## S.4 "Nobody understood what the game was"

**The story:** the store page said "memory game". Players who like cascades never looked; players
who like memory games found it noisy. §88's positioning problem, unaddressed.

**Earliest signal:** the screenshot test failing, or early feedback describing it as Concentration.

**Prevention:** §49.1 as a gate, and the first frame of every asset containing a detonation.

## S.5 "We shipped fog and it made the game stressful"

**The story:** §43.3 was exciting, shipped on by default, and turned a calm game into an anxious
one. Sessions shortened. It was removed six months later having cost the audience that had liked
the calm version.

**Earliest signal:** N12, or session length falling in the flagged cohort.

**Prevention:** default off, kill criterion written in advance, and the discipline to apply it.

## S.6 "The removal broke the build for three months"

**The story:** T1.12 (delete the modules) was done before T1.7 (stop generating), and the codebase
was unbuildable for a long stretch, during which everything else stopped.

**Earliest signal:** the first commit that deletes a module while generation still calls it.

**Prevention:** §L.9's rule — stop generating before you delete — and G.8's ordering.

## S.7 "It was fine and nobody cared"

**The story:** everything above was avoided. The game shipped, was competent, reviewed politely,
and disappeared. The loop was good but not *remarkable*, because we tuned every number to be
correct and never made anything excessive.

**Earliest signal:** nobody screenshots anything. No moment in the game produces a reaction worth
sharing.

**Prevention:** this is the hardest one, and the answer is §12.2 — **the absurdity is the point.**
Every instinct in a measured, banded, instrumented project pulls toward correctness, and
correctness is not memorable. The Fever ceremony, the 768× score range, the halo that ignores the
map — these are the places where the design is deliberately excessive, and they should be defended
against the tuning instinct that will want to moderate them.

---

# Appendix T — Playtest Protocol

> §D.5 admits no claim in this document has been checked against a person. This appendix is what to
> do about that, written now so it is not improvised later.

## T.1 What to test, in order of value

| # | Question | Method |
|---|---|---|
| 1 | Does the first match's blast land as a moment? | Watch the first ninety seconds. Say nothing. |
| 2 | Do they notice the suit rule? | Ask afterwards: "what decided which tiles went?" |
| 3 | Do they discover holding? | Watch for a player declining to match a pair they clearly know |
| 4 | Do they understand the chain meter? | Ask: "what is that bar?" |
| 5 | Does a mismatch feel bad or fine? | Watch body language on the third mismatch |
| 6 | What do they call the game? | Ask: "how would you describe this to a friend?" |
| 7 | When do they want to stop? | Do not prompt. Note where they stop and whether it was a boundary |
| 8 | Do they want to go again? | Do not offer. Note whether they press it themselves |

## T.2 What not to do

- **Do not explain anything.** The entire onboarding thesis (§50) is that no explanation is needed.
  Explaining invalidates the test.
- **Do not ask leading questions.** "Did you like the cascade?" is worthless.
- **Do not test with people who have read this document.**
- **Do not fix things during the session.**

## T.3 The three failure signals that would change the design

| Signal | What it means | Section to revisit |
|---|---|---|
| They describe it as "a memory game" | The cascade is not reading as the point | §88, §49.1 |
| They never decline to match a known pair | The strategic layer is invisible or absent | §30, Phase 3 |
| They stop mid-floor and do not return | The session has no good ending | §53.2, §24.2 |

## T.4 The one question worth asking at the end

> "Was there a moment where more happened than you expected?"

If the answer is no, §28 — this document's central claim — has not landed, and that is the most
important thing we could learn.

---

# Appendix U — Metrics

> §85 says no account and no server, so everything here is **local**: computed on the player's
> machine, stored in their save, never transmitted. That is a constraint on what we can learn and a
> feature of the product.

## U.1 What the save already holds

| Field | Since | Use here |
|---|---|---|
| Run history (bounded) | Gen 63 | §56.4's improvement delta |
| Per-mode records | Gen 71 | Collapses to one set of records after T1.1 |
| Best run marker | Gen 69 | §55 |
| Crash reports | Gen 32 | Unrelated but worth not breaking |

## U.2 What we should add

| Metric | Why | Task |
|---|---|---|
| Floors per run | §53.1's target, and N10 | T5.6 |
| Turns per floor, against par | Whether par is set right | T5.6 |
| Mistakes per floor | §69.4's check, and every candidate's kill criterion | T5.6 |
| Largest break per run | §55.2's record and §42.3's replay | T5.3 |
| Tier reached per floor | Whether Fever is reachable in practice | T5.6 |
| Time to first input from launch | §53.1 | T5.6 |
| Where a session ended (floor clear / mid-floor / run end) | §24.2's peak-end concern | T5.6 |
| Replayed-seed deltas | N11 | T5.5 |

Eight metrics. All derivable from a run log the game already produces.

## U.3 What the player sees

Most of it: the record set (§55.2), the Rematch delta (§56.3), and the run-end summary. The rest is
diagnostic and lives behind the same developer surface as the crash reports.

## U.4 What we will never collect

- Anything transmitted off the machine without an explicit action by the player.
- Anything tied to an identity.
- Anything about the player that is not about their play.

## U.5 The honest limitation

Local metrics mean we learn about the players who tell us, not about the population. That is a real
methodological weakness and it is the price of §85's stance. The mitigation is playtesting
(Appendix T), which is a smaller sample but a much richer one.

---

# Appendix V — The Visual Specification

## V.1 The suits

| Suit | Rune | Hue | Rune weight | Notes |
|---|---|---|---|---|
| Ember | ▲ | `#e0713c` | Heavy | Warm; the largest clump by convention |
| Tide | ≈ | `#3f9fd8` | Medium | Cool; runs in lines |
| Moss | ✿ | `#6fb64a` | Medium | Patient; corners |
| Bone | ◆ | `#d8cfb4` | Heavy | Pale; breaks the others up |

The runes are chosen to be distinguishable by **silhouette** at small size: a triangle, a wave, a
flower, a diamond. Two of them (triangle, diamond) are angular and two (wave, flower) are organic,
so even a blurred glance separates them into pairs.

## V.2 The greyscale test

Rendered without hue, the four runes must remain distinguishable at the minimum tile size. This is
band N4 and it is the reason runes are non-negotiable.

Additional provision: the four hues must also differ in **luminance**, not only in hue, so that a
greyscale board still shows the clump structure. Ember and Moss are the risky pair; Moss should sit
noticeably lighter.

## V.3 Symbols

| Property | Spec |
|---|---|
| Alphabet | At least 24 distinct glyphs |
| Distinguishability | By silhouette, at 45% of tile width |
| Colour dependence | None |
| Cultural neutrality | No letters, no numerals, no culturally specific icons |
| Style | Consistent stroke weight with the runes, so a face and a back read as the same object |

## V.4 The tile

| State | Appearance |
|---|---|
| Hidden | Suit hue field, rune at ≥24% width, subtle bevel |
| Hidden, remembered | Same, with a faint lighter tint (§34.4) |
| Flipped | Face: neutral ground, symbol at ≥45% width |
| Matched | Lifts, brightens, then leaves |
| Popped | Shatters outward, in its suit's hue |
| Dropped | Falls, fades, no shatter |
| Halo'd | Flashes its own hue before going |
| In the aim guide | Outlined at 40% opacity |

## V.5 The palette beyond suits

Deliberately minimal: a neutral board ground, a single accent for the score and meter fill, and the
four suit hues. **No sixth colour.** Every additional colour in the interface competes with the four
that carry meaning.

## V.6 Motion vocabulary

| Motion | Meaning | Never used for |
|---|---|---|
| Outward shatter | A pop | Anything else |
| Travel across the board | A partner joining a blast | Anything else |
| Downward fall + fade | A drop | Anything else |
| Lift + brighten | A match | Anything else |
| Flash then go | A halo take | Anything else |
| Rise + converge | Score | Anything else |

Six motions, each meaning exactly one thing. This is the visual equivalent of §75.2's audio
prohibition, and it is what lets a player read a break at a glance without counting.

---

# Appendix W — Adding a Mechanic, Correctly

> A worked example of the process §25.2 and §92 require, using a real candidate: **suit interaction
> (ember burns moss)**, from Appendix N.

## W.1 The proposal

> When an Ember break's region touches Moss tiles, those Moss tiles are taken too, as if they were
> Ember. Moss does not reciprocate.

## W.2 Question 1 — is it downstream of the flip?

Yes. It is a property of what a match does. It adds no verb, no menu, no screen, and no resource.

**Pass.**

## W.3 Question 2 — which measured band does it move, and by how much?

Predicted, before building:

| Band | Direction | Estimate |
|---|---|---|
| P1/P2 pop rate | Up | +0.05, because Ember breaks reach further |
| P4 ladder min step | Neutral | The effect applies at every tier |
| P5 ladder spread | Slightly up | Bigger absolute numbers at every tier |
| N8 drop share | **Down** | Moss suits get eaten by Ember before they can sever |
| C4 clean Fever share | Up | More momentum per break |
| C5 Fever separation | **Down** | The effect is unconditional, so a sloppy player benefits equally |

**The C5 row is the problem**, and it is the same shape as Gen 168's Tuning Fork finding: an
unconditional buff to the pop helps the reference player as much as the clean one, and the ladder's
separation is the design's most protected property.

**Conditional pass** — the mechanic would need to be tier-gated (say, Ember burns Moss only at
Sharp) to avoid flattening the ladder.

## W.4 Question 3 — would the mechanic survive without its flourish?

Yes. Even rendered plainly, "Ember takes Moss with it" is a rule with strategic content: it makes
Ember-adjacent-to-Moss a board property worth reading, which is §80's kind of depth.

**Pass.**

## W.5 The rulebook cost

One sentence, and it must be discoverable without text. Can it be? A player would see an Ember blast
take Moss tiles and could infer the rule — but they would not know it is *one-way* without seeing a
Moss blast decline to take Ember, which may take many floors.

**This is the real objection**: an asymmetric rule is much harder to learn by watching than a
symmetric one. Either make it symmetric (all suits take their neighbours at Sharp — which is just
the Fever halo moved down a rung, and therefore redundant) or accept a long discovery time.

## W.6 The verdict

**Deferred, with a specific reason:** it passes all three questions but it (a) requires a tier gate
to protect C5, and (b) at that point it is very close to the Fever halo one rung lower, which
suggests the design space it occupies is already taken.

**What to do instead:** if the goal is "make suit adjacency matter", the cheaper move is §90.1's
topology work — deal suits so that adjacency is *interesting* — rather than a rule that makes it
mechanical.

## W.7 What this exercise demonstrates

Three things worth generalising:

1. **The band prediction is the valuable step.** Writing down "this will move C5 down" before
   building is what caught the problem, and it took ten minutes.
2. **A rule that survives all three questions can still be wrong** — for reasons of learnability
   (W.5) or redundancy (W.6).
3. **The alternative is usually generation, not rules.** Twice now (here and in §90.1) the answer to
   "we need more variety" has been "vary the board, not the rulebook."

---

# Appendix X — The Deletion Register

> Every type, constant and exported symbol that Phase 1 removes. Enumerated so the removal can be
> checked mechanically rather than by inspection.

## X.1 Types removed from `contracts.ts`

| Type | Members |
|---|---|
| `DungeonCardKind` | enemy, trap, treasure, shrine, gateway, key, lock, exit, lever, shop, room |
| `DungeonCardEffectId` | 37 members |
| `DungeonCardState` | hidden, revealed, resolved |
| `DungeonKeyKind` | iron, treasure, shrine, boss, trap |
| `DungeonExitLockKind` | none, lever, + the key kinds |
| `DungeonObjectiveId` | find_exit, open_bonus_exit, disarm_traps, defeat_boss, pacify_floor, claim_route, loot_cache, reveal_unknowns |
| `DungeonBossId` | trap_warden, rush_sentinel, treasure_keeper, spire_observer |
| `DungeonFloorBlueprint` | the whole interface |
| `FloorArchetypeId` | 11 members |
| `FloorTag` | normal, breather, boss |
| `RouteNodeType` | safe, greed, mystery |
| `RouteCardKind` | safe_ward, greed_cache, mystery_veil |
| `RouteSpecialKind` | 16 members |
| `RouteWorldIntensity` | safe, greed, mystery |
| `RouteWorldProfile` | the whole interface |
| `HazardTileKind` | shuffle_snare, cascade_cache, mirror_decoy, fragile_cache, toll_cache, fuse_cache |
| `EnemyHazardKind` | sentinel, stalker, warden, observer |
| `EnemyHazardPattern` | patrol, stalk, guard, observe |
| `EnemyHazardStateKind` | hidden, revealed, defeated |
| `EnemyHazardState` | the whole interface |
| `FindableKind` | shard_spark, score_glint, ward_spark, scout_glint |
| `PuzzleDifficulty`, `PuzzleGoal`, `PuzzlePackId`, `PuzzleCompletionRecord`, `BuiltinPuzzleDefinition` | with the puzzle mode |
| `StartingLoadoutId` | memory_scout, route_tactician, cursebreaker, vaultbreaker |
| `RelicId` | the whole union |

`GameMode` is reduced from five members to one.

`TileTraitKind` is reduced from nine members to four (echo, heavy, conduit, stasis).

## X.2 Constants removed

| Constant | Home |
|---|---|
| `FINDABLE_MATCH_SCORE`, `FINDABLE_MATCH_COMBO_SHARDS`, `FINDABLE_MATCH_SAFE_HAZARD_WARDS`, `FINDABLE_MATCH_SCOUT_REVEALS` | `contracts.ts` |
| `DUNGEON_CARD_KIND_ORDER`, `DUNGEON_CARD_EFFECT_ORDER`, `DUNGEON_CARD_KIND_DEFINITIONS`, `DUNGEON_CARD_EFFECT_DEFINITIONS` | `dungeon-cards.ts` |
| `DUNGEON_BOSS_DEFINITIONS`, `DUNGEON_BOSS_PRESSURE_RULES`, `DUNGEON_BOSS_DEFEAT_SCORE` | `dungeon-boss-rules.ts` |
| `HAZARD_TILE_DEFINITIONS`, `HAZARD_TILE_KINDS` | `hazard-tiles.ts` |
| `LOOP_RESERVE_SHARE`, `DUNGEON_MIN_PAIRS` | `dungeon-blueprint-policy-rules.ts` — the reserve has no meaning once nothing competes |
| `DROP_MAX_PAIRS` | `chunk-break-rules.ts` — replaced by the severance test (§37.3) |
| `SUIT_LENS_SUITS_REMOVED`, `SUIT_LENS_MIN_SUITS` | `tile-suit-rules.ts` — with the relic |
| `TUNING_FORK_EXTRA_WAVES` | `chunk-break-rules.ts` — with the relic |
| `MAGPIE_LEDGER_GOLD_MULTIPLIER` | `chunk-break-rules.ts` — with the relic and with gold |
| `CASCADE_RELIC_LOADOUT`, `CASCADE_RELIC_BANDS` | `cascade-balance-simulation.ts` |

## X.3 Run-state fields removed

Eleven per-floor counters (the silent systems), plus dungeon key inventory, gold, relic ids,
loadout id, route profile, objective progress, boss state, hazard state, and every mode-specific
record.

**Note (§L.5):** remove the counters from the occupancy roster one generation *before* removing
them from `RunState`, so the baseline diff is readable.

## X.4 Simulation surfaces removed

| Surface | Reason |
|---|---|
| `relicIds` axis in `cascade-balance-simulation` | Nothing to load out |
| `CASCADE_RELIC_BANDS` | Same |
| `--relics` flag in `sim:cascade` | Same |
| `build-strategy-playthrough-simulation` | It simulates nine builds; there are no builds |
| `dungeon-combinatoric-matrix` | It covers card combinations |
| `pickFloorScheduleEntry`'s archetype and mutator outputs | Replaced by the §33.4 profile rotation |

## X.5 The check

After Phase 1, the following should return nothing outside `docs/REMOVED_DUNGEON_LAYER.md`,
`docs/THESIS_THE_ADDICTIVE_LOOP.md`, and the save migration:

```
grep -rn "dungeonCard\|DungeonCard\|hazardTile\|HazardTile\|routeSpecial\|RouteSpecial" src/
grep -rn "'daily'\|'puzzle'\|'gauntlet'\|'meditation'" src/
grep -rn "relicId\|RelicId\|shopGold\|loadout" src/
```

That grep is the acceptance criterion for T1.12, T1.13 and T1.16, and it should be written as a
test so it cannot rot.

---

# Appendix Y — Team FAQ

> Short answers to questions that will come up repeatedly, with the section that answers them
> properly.

**Q. Can we keep just the treasure cards? They're harmless.**
No. They cost pairs, they need art, copy, a Codex entry and a reward rule, and their function —
a tile worth aiming a break at — is now board structure. §C.1, §31.1.

**Q. What if we make the exit a bonus rather than a requirement?**
Then it is a treasure card with a different name, and the same answer applies. The floor already
ends when the board is empty; anything else on the board is competing for pairs. §41.1.

**Q. The daily mode is basically free. Why not keep it?**
Because it is free *after* the loop is finished and expensive before, since every change to the
loop has to be checked against it. It is **LATER** with a stated precondition, not **NEVER**.
§C.7, §95.

**Q. Won't removing lives make it too easy?**
The chain is lost on every mismatch, which is far more frequent and more painful than a life. The
run still ends on the turn ceiling. §34.3, §42.2, §F.5.

**Q. Can I add a mechanic if it's really good?**
Answer §25.2's three questions in writing first. Appendix N has pre-judged the common cases and
Appendix W is a worked example of doing it properly.

**Q. Why is the mismatch hold 700ms? It feels slow.**
Because it is a study interval, not a pause. Shortening it makes the game unfair, because the
player cannot encode the tiles they just paid for. It is the number this document is least
confident about and E.9 says what would settle it. §45.3.

**Q. The Fever ceremony takes 2.6 seconds. Can we shorten it?**
Only with a measurement. §S.7 — the excess is the point, and the tuning instinct will want to
moderate it. If it is happening more than about twice a session, shorten the *frequency* by moving
the rung, not the ceremony.

**Q. Shouldn't we keep the relics? Three of them are good.**
They are, and they are **LATER** with a written precondition. They need a draft screen, an
inventory and a rulebook, and §44.2's single power does their job with none. §C.8.

**Q. What is the one thing I should not break?**
Band C3: the cascade never moves the rating. It has held since Gen 121 and there is no version of
the game where it should not. §O.2.

**Q. What is the highest-value unbuilt thing?**
Phase 3 — making the hold decision visible. The mechanics already produce the decision and the
player cannot see any of it. §30.4, §102.1.

**Q. What is the riskiest thing in the plan?**
T1.7, stopping board generation from placing dungeon cards. Everything depends on it. §G.8.

**Q. How do I know if this whole document is wrong?**
§1.4 lists six falsifiable claims. §62.6 names the most likely way the central argument fails.
§T.4 is the single question to ask a playtester.

---

# Appendix Z — What Counts as a Stop

> §1.2 makes "no stops" the design's central constraint, and "stop" is doing a lot of work. This is
> the audit, so the term is checkable rather than rhetorical.

## Z.1 The definition

> **A stop is any moment where the player is not able to flip a tile and is not watching the
> consequence of having flipped one.**

By that definition, the Fever ceremony is not a stop (it is a consequence), and a floor summary
screen is.

## Z.2 The audit, before and after

| Moment | Before | After | Why |
|---|---|---|---|
| App launch → first board | Splash, menu, mode select | Direct | §73 |
| Mode selection | A screen | Gone | T1.1 |
| Loadout selection | A screen | Gone | §44.3 |
| Memorize window | A timed reveal | **Kept** — it is the board being shown, and the player is reading | — |
| Flipping a tile | — | — | The game |
| A break resolving | — | — | The consequence |
| Reading a dungeon card's meaning | A pause to parse | Gone | T1.7 |
| Opening a shop | A screen | Gone | T1.10 |
| Opening a room | A screen | Gone | T1.10 |
| Choosing a route | A screen | Gone | T1.9 |
| A relic draft | A screen | Gone | T1.11 |
| Finding the exit | Turns spent not playing the loop | Gone | T1.8 |
| Floor summary | A screen | Folded into the in-place beat | §41.4 |
| Run end | A screen | Kept, restructured, one input to leave | §42.3 |
| Pause | A screen | Kept — it is the player's choice | §71 |

**Thirteen stops before; two after**, and both survivors are player-initiated.

## Z.3 The one contentious survivor

The **memorize window** — the brief period at floor start where tiles are shown before being
hidden. Is it a stop?

By Z.1's definition, arguably yes: the player cannot flip. But it is the board *being presented*,
which is the input to every decision that follows, and removing it would make the first few turns
pure blind guessing.

**Verdict: not a stop, because the player is doing the game's central activity — encoding.** But it
should be as short as it can be while remaining useful, and it should be *skippable* by a player
who has seen enough. (The skip already exists; it should stay.)

---

# Appendix AA — Before and After

> The product, feature by feature, either side of this plan. Useful for anybody who has to describe
> the change to somebody who was not in the room.

| Feature | Before | After |
|---|---|---|
| Modes | 5 | 1 |
| Card kinds on the board | 11 | 0 |
| Hazard tile kinds | 6 | 0 |
| Tile traits | 9 | 4 |
| Floor archetypes | 11 | 0 (deal profiles instead) |
| Floor objectives | 8 | 1 (clear the board) |
| Bosses | 4 | 0 |
| Key kinds | 5 | 0 |
| Route node types | 3 | 0 |
| Route specials | 16 | 0 |
| Relics | a pool | 0 |
| Starting loadouts | 4 | 0 |
| Currencies | 1 (gold) | 0 |
| Player powers | 5+ charges | 1 (the Recall) |
| Screens between boards | 3–4 | 0 |
| HUD elements | 12+ | 6 |
| Player-facing concepts | ~70 | ~7 |
| Rule set length | ~2,400 words | 210 words (§Q) |
| Modules in `src/shared/dungeon-*` | 30 | 0 |
| Systems that never fire | 11 | 0 (target) |
| Pairs on a level-8 floor available to the cascade | ~5–7 | 10 |
| Score range within a floor | 27× | 768× |
| Ladder spread (pairs per match, none → fever) | 2.53 | to be re-measured, expected wider |
| Lives | yes | no |
| Fail state | out of lives | turn ceiling at 3× par |
| Between-session mechanics | records | records |
| Dark patterns | none | none |

## AA.1 The one-sentence summary

**Before:** a memory-based dungeon crawler with a cascade in it.
**After:** a cascade game you play with your memory.

---

# Appendix AB — The Authored Floors, Exactly

> §51 says floors 1–3 are authored and why. This is what they are, precisely enough to implement
> and to test. Coordinates are `(column, row)`, zero-indexed from the top-left.

## AB.1 Floor 1 — the pop

**Purpose:** guarantee that the player's first match detonates.

```
Grid: 3 × 2
Pairs: 3
Suits: 1 (Ember)

(0,0) E:α    (1,0) E:β    (2,0) E:γ
(0,1) E:β    (1,1) E:γ    (2,1) E:α
```

**Properties to assert in a test:**
- Every tile is Ember.
- Every pair's halves are within `BOUNDED_BREAK_REACH` of each other.
- For every possible first match, at least one other pair is entirely within reach of it.
  Therefore **any correct first match pops at least one other pair**, which is band N6.
- The board is solvable by pure exploration in at most five turns.

**Why three pairs and not four:** four would give the player one more mismatch before the payoff.
Three is the smallest board on which a pop is possible and it front-loads the moment.

**Why one suit:** the suit rule is teaching row 4, not row 1 (§50.2). A single suit means the pop
is unconditional and the player learns "a match takes things with it" without also having to notice
"…of the same colour".

## AB.2 Floor 2 — the suit boundary

**Purpose:** teach that the blast is one colour, by having it visibly stop.

```
Grid: 4 × 3
Pairs: 6
Suits: 2 (Ember 3 pairs, Tide 3 pairs), clumped and clearly separated

(0,0) E:α  (1,0) E:β  (2,0) E:γ  (3,0) T:δ
(0,1) E:β  (1,1) E:α  (2,1) T:ε  (3,1) T:ζ
(0,2) E:γ  (1,2) T:δ  (2,2) T:ζ  (3,2) T:ε
```

**Properties to assert:**
- The two suits occupy contiguous, adjacent regions.
- At least one Ember pair and one Tide pair are adjacent across the boundary, so a blast on either
  side visibly declines to cross.
- Every pair's halves are within reach of each other within their own suit's region, so the board
  is completable at chain zero.

## AB.3 Floor 3 — the cross-board reach

**Purpose:** the game's thesis in one event — a tile leaving from somewhere the player was not
looking.

```
Grid: 4 × 4 (fourteen tiles, two cells empty)
Pairs: 7
Suits: 2 (Moss 4 pairs, Ember 3 pairs)

The split pair: M:θ has one half at (0,0), inside the Moss clump,
and its other half at (3,3), in the far corner, surrounded by Ember.
```

**Properties to assert:**
- Exactly one pair is *split*: one half inside its suit's clump, one half outside it and far away
  (Manhattan distance ≥ 5).
- Reaching Clean requires three matches, and the board's size makes that likely by turn five.
- At Clean, a match inside the Moss clump takes the split pair, and its far half travels across the
  board. This is band N7.

**Why a split pair rather than just a distant one:** the point is that the far half is *not* in a
region the blast reached. It leaves because its partner did. That is the partner reach (§35.2) and
it is the mechanic that makes this a memory cascade rather than a spatial one.

## AB.4 What the authored floors must not do

- **They must not teach with text.** No callouts, no arrows, no "notice how…".
- **They must not be replayed.** A returning player gets the same three floors, which is fine — they
  are twenty seconds — but they must not be presented as a tutorial to be skipped or repeated.
- **They must not set a false expectation of density.** Floor 1's three-pairs-one-suit board is much
  more explosive per match than floor 8 will be. That is acceptable — it is a hook — but the curve
  from floor 4 onward must not feel like a let-down. §32.2's larger early floors are partly for
  this reason.

## AB.5 The test that guards them

```
describe('the authored floors', () => {
    it('floor 1: every possible first match pops at least one other pair')
    it('floor 2: a blast stops at the suit boundary')
    it('floor 3: at Clean, the split pair leaves from across the board')
    it('all three are solvable by exploration alone')
    it('none of them requires a rule not yet taught')
})
```

The last one is the important one and it is the hardest to automate; it may have to be a checklist
item rather than a test.

---

# Appendix AC — The Event Contract

> What the loop emits, so that presentation can be built without reaching into rules. This is the
> boundary the codebase already has (Gen 20's event-only projector) and it should survive the
> removal intact.

## AC.1 The events

| Event | Payload | Emitted when |
|---|---|---|
| `tileFlipped` | `tileId`, `symbol`, `suit`, `index` (first or second) | A tile turns face-up |
| `turnResolved` | `matched`, `tileIds` | Both tiles are up and the comparison is made |
| `chainChanged` | `before`, `after`, `tier`, `crossedRung` | Momentum changes |
| `breakBegan` | `matchedPairKey`, `tier`, `waveCount` | A break starts |
| `waveResolved` | `waveIndex`, `pairKeys`, `tileIds`, `isHalo` | Each wave completes |
| `partnerTravelled` | `pairKey`, `fromIndex`, `toIndex` | A half joins from outside the region |
| `pairsDropped` | `pairKeys`, `suit` | The severance drop fires |
| `breakScored` | `pairs`, `tier`, `waves`, `terms`, `total` | The break's score resolves |
| `recallCharged` | — | The power becomes available |
| `recallUsed` | `suit` | The power is spent |
| `floorCleared` | `floor`, `turns`, `par`, `tierAtClear`, `bonus` | The board empties |
| `runEnded` | `depth`, `score`, `bestBreak`, `records` | The run stops |

Twelve events. Everything in Parts VI and XIII is a reaction to one of them.

## AC.2 The rules the contract enforces

1. **Presentation never reads rules state directly.** It reacts to events. This is what makes the
   replay, the simulations and the reduced-motion variant all possible from one source.
2. **Every event carries what the announcement needs.** §K.6's live-region strings must be
   constructible from the event alone.
3. **Events are ordered and complete.** A consumer that processes every event in order has a
   correct picture of the floor. This is what makes a replay a list of flips plus a seed.

## AC.3 What this buys after the removal

The event list shrinks with the rules — no `cardRevealed`, `keyClaimed`, `trapSprung`,
`exitActivated`, `routeChosen`, `shopOpened`, `bossDamaged`. Twelve events instead of thirty-odd,
and every one of the twelve is a moment the player is meant to feel.

**That ratio — every event is a felt moment — is a good test of whether a game's rules and its
presentation are the same shape.** Before the removal, more than half the events were bookkeeping.

---

# Appendix AD — Reading the Old Code

> A translation table for anybody reading a commit or a comment from before the removal. Kept
> because `BALANCE_NOTES.md` and thirty generations of commit messages use this vocabulary.

| Old term | What it meant | Current equivalent |
|---|---|---|
| Chunk break | The whole consequence of a match | The break (§27) |
| Chunk | The region a break takes | The pop's region |
| Dungeon card | A tile with a rules role beyond being a pair | — (removed) |
| Paired card spec | A dungeon card the recipe asked for | — |
| Card recipe | Which dungeon cards a floor deals | — |
| Blueprint | A floor's whole dungeon plan | — |
| Encounter context | Pressure modifiers by node kind | — |
| Floor archetype | A named floor flavour | Deal profile (§33.4) |
| Floor tag | normal / breather / boss | — |
| Route node | A door between floors | — |
| Findable | A pickup pair | — |
| Hazard tile | A tile that lies or punishes | — |
| The reserve | Pairs held back from the dungeon budget | — (nothing competes) |
| Objective | What a floor asked you to do | Clear the board |
| Warden | A boss | — |
| Loop reserve share | The 25% held back | — |
| `tileCanBreakInChunk` | Whether a tile may be taken by a break | "is a hidden half of a whole pair" |
| `tileBlocksChunk` | An unsprung trap stopping propagation | — |
| Memory tax | The taxonomy scoring content's cost to recall | Kept, with §2.2's caveat |
| Occupancy | Whether a system ever fires | Unchanged — still the central diagnostic |
| Reachability | Whether content can be reached at all | Unchanged |

## AD.1 The one term worth keeping

**Occupancy.** "Reachability is not occupancy" is the repository's most useful sentence and it
predates everything in this document. Content can be reachable — a path exists — and still never
happen. The census exists because somebody noticed the difference, and eleven silent systems is
what that noticing was worth.

---

# Appendix AE — The Counter Roster After the Removal

> §101.8's rule: every mechanic ships with a counter and a stated cadence. This is what the
> occupancy census should watch once the dungeon layer is gone — the complete list, with the
> cadence each is expected to hold.

| Counter | Label | Family | Cadence | Expected |
|---|---|---|---|---|
| `matchResolutionsThisFloor` | A turn resolved | memory | core | 1.00 |
| `recallMatchesThisFloor` | A pair was matched from memory | memory | core | 1.00 |
| `recallMistakesThisFloor` | A mismatch was made | memory | common | 0.40–0.75 |
| `chunkBreaksThisFloor` | A match popped what it touched | cascade | core | ≥ 0.95 |
| `chunkPairsBrokenThisFloor` | Pairs a break took | cascade | core | ≥ 0.95 |
| `partnerReachesThisFloor` | **[new]** A pair left because only one half was in the blast | cascade | common | ≥ 0.30 |
| `chunkRippleWavesThisFloor` | A break ran more than one wave | cascade | common | ≥ 0.20 |
| `chunkPairsDroppedThisFloor` | The drop took a severed suit | cascade | **common** | ≥ 0.25 (N8) |
| `haloTakesThisFloor` | **[new]** The Fever halo crossed a suit boundary | cascade | rare | ≥ 0.05 |
| `feverBreaksThisFloor` | A break landed at Fever | cascade | common | ≥ 0.10 |
| `cleanRungReachesThisFloor` | **[new]** The chain reached Clean | cascade | core | ≥ 0.90 |
| `sharpRungReachesThisFloor` | **[new]** The chain reached Sharp | cascade | common | ≥ 0.40 |
| `recallPowerUsesThisFloor` | **[new]** The Recall was spent | power | rare | ≥ 0.05 |
| `parBeatenThisFloor` | **[new]** The floor cleared under par | progression | common | ≥ 0.30 |
| `personalBestPassedThisRun` | **[new]** The run passed the previous best depth | progression | rare | ≥ 0.01 |

Fifteen counters, of which **six are new** and are the direct application of §101.8: the mechanics
this document specifies must be observable from the day they ship.

## AE.1 Note on `chunkPairsDroppedThisFloor`

Its cadence moves from `rare` to `common`, which is the strongest single statement about the
severance restructure (§37.3). Under the old threshold rule, `rare` was generous — it fired on
0.6% of floors. Under the new rule, if it does not clear the `common` floor of 0.10, the
restructure did not work.

**That reclassification is deliberate and it is a commitment.** It converts §37.3 from a hope into
a gate.

## AE.2 Note on the three new rung counters

`cleanRungReachesThisFloor`, `sharpRungReachesThisFloor` and `feverBreaksThisFloor` together
measure the ladder's *reachability* rather than its *payout*, which the pop simulation already
covers. A ladder whose middle rung pays well but is never reached is as broken as one whose middle
rung pays nothing, and until now nothing measured the difference.

## AE.3 Note on `partnerReachesThisFloor`

This is the counter for the single mechanic that makes the game a memory cascade rather than a
spatial one (§35.2). It has never been measured. If it is low, the Clean rung is not doing what
§26 says it does, and the design's central claim is in trouble.

**It is the most important new counter in this table** and it should be the first one added.

---

# Appendix AF — Reading List

> What to read to understand the arguments in this document, roughly in order of usefulness to
> somebody working on this game.

## AF.1 Play these, attentively

| Product | What to watch for |
|---|---|
| **Peggle** | The 950ms after every shot; the pitch run; the Extreme Fever sequence timed with a stopwatch |
| **Puzzle Bobble** | Play until you find your first deliberate severance. Notice how it feels different from a big colour match |
| **Tetris Attack** | Watch a top-level match. The skill chain is invisible until you know it is there |
| **Puyo Puyo** | Watch a competitive match. Note how long the build takes and how short the payoff is |
| **Zuma** | Notice that the threat is spatial and that a chain pushes it back |
| **Balatro** | Watch `chips × mult` resolve. That is §40.4 |
| **Vampire Survivors** | One full run, paying attention to how the *rate of change* feels at minute 3, 10 and 20 |
| **2048 and Threes** | Play both. The reach difference is a legibility lesson |

## AF.2 The design writing that matters

- **Postmortems and design talks** from the products above, where they exist. Developer accounts are
  marked *(stated)* in Part II precisely because they are self-reports, but they are the only direct
  evidence of intention.
- **The Threes postmortem** on clones, which is the clearest available statement of the tuning-vs-
  legibility trade (§15).
- **Anything on game feel** — the vocabulary of hit-stop, trauma-based shake, and animation curves
  is standard and Part VI assumes it.

## AF.3 The psychology, with the caveats of §D.4

- Reward prediction error as an account of dopaminergic signalling — the foundation of §18.
- The testing effect and retrieval practice — the foundation of §23.1 and §56.3.
- Working memory capacity and interference — §23.2, §23.3.
- The peak-end rule — §24.2.
- The literature on gambling design, specifically near-miss and losses-disguised-as-wins — §16,
  read as a description of what *not* to do.

**Read all of these with the marker system of Part III in mind.** A design decision that needs a
contested finding to be true is a fragile decision.

## AF.4 This repository

Honestly the most useful reading of all:

| Document | Why |
|---|---|
| `docs/BALANCE_NOTES.md` | Every measurement in order. Appendix I is only an index into it |
| `docs/CHAIN_CHUNK_FEVER_DESIGN.md` | The mechanic spec as shipped |
| `docs/REMOVED_DUNGEON_LAYER.md` | What came out, generated from the source |
| `src/shared/chunk-break-rules.ts` | The break, with its reasoning in the comments |
| `src/shared/tile-suit-rules.ts` | Why the board looks the way it does |
| `src/shared/system-occupancy-simulation.ts` | The instrument that found the eleven |

The code comments in this repository carry more design reasoning than most design documents, and
they are attached to the thing they explain, which is the correct place for them. **This document
does not replace them; it is the argument they assume.**

---

# Appendix AG — Maintaining This Document

## AG.1 What must stay true

| Property | Why |
|---|---|
| Part V is normative and matches the code | Otherwise nobody trusts any of it |
| Every number is attributed to a measurement or marked unmeasured | §D |
| Every confidence marker in Part III stays honest | §D.4 |
| Appendix O's band register matches the gates | It is the checklist |
| Appendix E's open questions get closed, not quietly dropped | An open question that disappears was never answered |

## AG.2 When to update it

- **After every phase**, with what the build taught (task T7.6).
- **Whenever a band moves**, in Appendix O.
- **Whenever a candidate is killed or kept**, in Appendix N and the decision log.
- **Never** to make a shipped decision look better than it was. Appendix I's value is that it
  records the failures.

## AG.3 What to do when this document is wrong

Say so, in it, with the date and the measurement. A design document that has never been contradicted
by the thing it describes is a document nobody checked.

---
# Appendix AH — Alternative Score Curves Considered

> §40.2 specifies `pairs × chainMult × waveMult`. Four alternatives were considered and rejected;
> recorded so the choice can be revisited against reasons rather than re-derived.

## AH.1 The candidates

### Curve A — the current additive model

```
score = (perPair × pairs + sizeBonus) × feverLift × rippleLift(waves)
rippleLift = min(2, 1 + 0.2 × (waves - 1))
```

**Range:** 27×. **Rejected because:** concentration is barely better than accumulation (§40.1), and
no score is worth a screenshot.

### Curve B — quadratic in pairs

```
score = perPair × pairs²
```

**Range:** ~150× for a 12-pair break. **Rejected because:** it rewards *size* only, and size is
partly luck (which suit you happened to match in). It gives no credit for the chain, which is the
skill axis.

### Curve C — Puyo's doubling per wave

```
score = perPair × pairs × 2^(waves - 1)
```

**Range:** enormous — a seven-wave break is 64× before pairs. **Rejected because:** wave count has
high variance from board geometry, so this makes the score dominated by which board you got. It also
has no cap, and `RIPPLE_MAX_WAVES` is 12, which would put a rare break at 2048×.

### Curve D — the specified model

```
score = perPair × pairs × CHAIN_MULT[tier] × waveMult(waves)
CHAIN_MULT = { none: 1, clean: 2, sharp: 4, fever: 8 }
waveMult(w) = min(6, 1 + 0.75 × (w - 1))
```

**Range:** 768×. **Chosen because:** it credits all three of the things a great break requires —
size (pairs), skill (tier), and depth (waves) — and it bounds the highest-variance term.

### Curve E — multiplicative with a soft cap

```
score = perPair × pairs × CHAIN_MULT[tier] × log2(waves + 1) × k
```

**Rejected because:** a logarithmic wave term makes deep reactions barely better than shallow ones,
which undoes §36's whole point. The linear-with-cap of Curve D keeps the first few waves valuable
and only flattens the rare tail.

## AH.2 The comparison, on the same break

A 10-pair break at Fever with 5 waves, nominal `perPair = 10`:

| Curve | Score | Comment |
|---|---|---|
| A (current) | 270 | Indistinguishable from four ordinary breaks |
| B (quadratic) | 1,000 | Good, but the same for a lucky 10-pair chain-one pop |
| C (Puyo) | 1,600 | Good, but a 7-wave break would be 6,400 and an 11-wave one 51,200 |
| **D (specified)** | **3,200** | Credits size, skill and depth; bounded |
| E (log waves) | ~1,240 | The depth barely registers |

## AH.3 The term nobody proposed and probably should

**A term for the number of *distinct suits* a break touched.** Only Fever crosses suit boundaries
(the halo), so this would be a Fever-only bonus, and it would reward aiming a Fever break at a
boundary rather than at a suit's middle.

**Not adopted**, because it adds a term for a situation that only exists at one tier and the halo
already rewards it in pairs. **Recorded because** it is the only genuinely new idea that came out of
writing this appendix, and it may be worth revisiting if Fever needs a strategic dimension beyond
"be at Fever".

---

# Appendix AI — Definition of Done

> What "finished" means for each phase, stated so that it is a checklist rather than a judgement.

## AI.1 Phase 1 is done when

- [ ] `ls src/shared/dungeon-*` returns nothing
- [ ] `ls src/shared/hazard-tiles*` returns nothing
- [ ] `GameMode` has exactly one member
- [ ] The three greps of §X.5 return nothing outside the archive and the migration
- [ ] Every generated floor satisfies `tiles.length === 2 × pairCount`
- [ ] The occupancy silent list is empty
- [ ] Every band re-measured and ratcheted, before/after in `BALANCE_NOTES.md`
- [ ] `yarn verify`, `yarn lint`, `yarn gate:systems` all green
- [ ] An old save loads and plays

## AI.2 Phase 2 is done when

- [ ] The pair curve matches §32.2's table
- [ ] Floors 1–3 are authored and their tests (§AB.5) pass
- [ ] N6 and N7 hold
- [ ] The drop uses the severance rule and N8 holds (≥ 0.25)
- [ ] The dropped-pair distribution is measured and recorded
- [ ] Scoring is multiplicative and N5 holds (0.25–0.70)
- [ ] Every floor shows `turns / par`
- [ ] Clearing at Fever pays 5× clearing cold
- [ ] There is no screen between one board and the next
- [ ] There are no lives; the run ends on the turn ceiling or on quitting
- [ ] Trace §67 is reproduced as a passing test
- [ ] Five tile traits are gone; four remain

## AI.3 Phase 3 is done when

- [ ] The aim guide shows the first wave at the current tier, on hover and long-press
- [ ] It ghosts the next tier's reach
- [ ] The meter's rungs carry pips
- [ ] A held-pair marker exists and changes no rules
- [ ] A suit about to sever is signposted
- [ ] The score builds term by term
- [ ] In playtest, a player declines to match a known pair within their first three runs

## AI.4 Phase 4 is done when

- [ ] Every duration matches §45's table
- [ ] Pitch rises per pair and per wave
- [ ] Shake is a decaying scalar, deterministic, surviving hit-stop
- [ ] Camera Comfort has three positions, reachable from pause
- [ ] The Fever ceremony is 2.6s and byte-identical every time
- [ ] A break of fewer than three pairs does not fire the ceremony (§128.9)
- [ ] The drop falls; it does not shatter
- [ ] A mismatch shows the tint and plays the resolving figure
- [ ] The partner-travel animation is the most distinctive thing on screen
- [ ] The screenshot test passes
- [ ] A greyscale board is playable
- [ ] Reduced motion preserves every timing and every piece of information

## AI.5 Phase 5 is done when

- [ ] Depth is the headline record
- [ ] Five records, no currencies
- [ ] Run end leads with the best break, replayed
- [ ] One input restarts, in under a second
- [ ] The Rematch works and shows a delta
- [ ] N10 and N11 are measurable

## AI.6 Phase 6 is done when

- [ ] Every candidate has a recorded verdict with the number that produced it
- [ ] No candidate was kept because it was expensive to build

## AI.7 Phase 7 is done when

- [ ] Every gate green, every band ratcheted
- [ ] Catalog, Codex, checklist and diagrams regenerated
- [ ] `CHAIN_CHUNK_FEVER_DESIGN.md` is the spec and points here for rationale
- [ ] The screenshot test runs as a capture job
- [ ] A recorded playthrough of floors 1–10 exists
- [ ] This document is updated with what the build taught

---

# Appendix AJ — What Success Looks Like

> Checkpoints, so that "is this working?" has an answer that is not a feeling.

## AJ.1 At the end of Phase 1

**The question:** did removing the layer help the loop?

| Measure | Before | Expect after |
|---|---|---|
| Breakable pairs, level 8 | ~5–7 | ~10 |
| Ladder spread | 2.53 | > 3.0 |
| Ladder min step | 0.39 | > 0.5 |
| Pop rate, floors 1–6 | 0.63–1.00 | > 0.85 across all |
| Silent systems | 11 | 0 |
| Player-facing concepts | ~70 | ~10 |

**If the spread does not widen, §3.3's central prediction is wrong** and the document should be
revisited before Phase 2.

## AJ.2 At the end of Phase 2

**The question:** is the loop complete?

- A new player's first match detonates. (N6)
- A tile flies across the board within ninety seconds. (N7)
- The drop fires on a quarter of floors. (N8)
- A great break is worth two orders of magnitude more than an ordinary one. (N5)
- A bad floor is quiet rather than punishing. (§67)

## AJ.3 At the end of Phase 3

**The question:** is there a game to be good at?

The single test: **in playtesting, does anybody hold a pair?** If a player, unprompted, declines to
match something they clearly know, the strategic layer exists. If nobody ever does, it does not,
regardless of what the code can do.

## AJ.4 At the end of Phase 4

**The question:** does it feel like the reference products?

The test: **does anybody make a noise?** An involuntary sound at a big break is the whole of Part
VI's purpose and it is easy to observe.

## AJ.5 At the end of Phase 5

**The question:** is there a reason to come back?

- N11 positive: players are measurably better on replayed seeds.
- Observed: a player presses `Again` without being asked.

## AJ.6 Six months after shipping

**The question:** was any of this right?

- Do people describe it as a cascade game or as a memory game? (§88)
- Does anybody screenshot a score? (§13.4)
- Has anybody named a strategy? (§8.3)
- Is the occupancy silent list still empty? (§92)

The last one is the only one entirely within our control, and it is the one that says whether the
discipline held.
# Appendix AK — Risk Register

> Every risk in this plan, with its severity, the signal that it is happening, and the mitigation.
> Ordered by severity × likelihood.

| # | Risk | Severity | Likelihood | Signal | Mitigation | §  |
|---|---|---|---|---|---|---|
| R1 | The game is too thin without the removed content | Fatal | Medium | Session length falls after Phase 1 | Fix §30 and §40 before considering content | §62.1 |
| R2 | Phase 3 is deferred as "polish" | Fatal | **High** | It slips a phase | Treat T3.1–T3.6 as loop work; schedule before Phase 4 | §S.1 |
| R3 | The removal destabilises the build for months | High | Medium | A commit deletes a module generation still calls | Stop generating before deleting; G.8's order | §L.9 |
| R4 | Multiplicative scoring hollows out small breaks | High | Medium | N5 above 0.70 | Run §83.4's check before shipping the curve | §S.2 |
| R5 | The severance drop clears floors for free | High | Medium | Turn counts well under par; fat drop tail | T2.4's distribution measurement | §S.3 |
| R6 | Positioning: it reads as a memory game | High | Medium | Feedback describing it as Concentration | §49.1 as a gate; every asset's first frame is a detonation | §S.4 |
| R7 | Fog ships and makes the game stressful | High | Low (it is default off) | N12; session length in the flagged cohort | Kill criterion applied honestly | §S.5 |
| R8 | The first three floors do not teach | High | Low | N6/N7 pass but players still bounce | More authored floors; the attract-mode demo | §62.2 |
| R9 | It is fine and nobody cares | Fatal | Medium | Nobody screenshots anything | Defend the excess from the tuning instinct | §S.7 |
| R10 | The Recall hollows the memory game | Medium | Medium | Mistake rate falls > 25% | T6.1's kill criterion | §F.9 |
| R11 | The ripple window makes it twitchy | Medium | Low | It is not invisible to a player who ignores it | T6.2's kill criterion | §36.3 |
| R12 | The pair curve is wrong at depth | Medium | **High** | Every player stalls at the same floor | §59's memory model, or telemetry | §E.1 |
| R13 | N11 comes back at or below zero | Fatal | Low | The measurement | This would invalidate Part VIII; revisit §56 | §60 |
| R14 | Band C3 breaks (the cascade moves a rating) | Fatal | Very low | The gate | Revert the change; no acceptable explanation | §O.2 |
| R15 | A save migration loses somebody's record | Medium | Low | Any report of it | Never fail to load; keep the migration a year | §L.6 |
| R16 | The document rots and stops matching the code | Medium | **High** | Part V disagrees with a constant | T7.6, and Appendix AG | §AG |

## AK.1 The two risks worth the most attention

**R2 (Phase 3 deferred)** and **R9 (fine and nobody cares)** are both high-likelihood, fatal, and
*failures of nerve rather than of engineering*. Both will present as reasonable decisions made for
good local reasons — "the loop works, let's polish it" and "that ceremony is a bit long".

They are recorded here so that when somebody proposes exactly those things, the proposal can be
recognised.

---

# Appendix AL — The First Week

> A concrete opening, because "start Phase 1" is not an instruction and the first three days of a
> large refactor determine whether it goes well.

## Day 1 — Make the removal safe

1. Confirm every gate is green at the starting commit. Record the numbers.
2. Write the invariant tests that do not pass yet: `tiles.length === 2 × pairCount`, every tile is
   half of a whole pair, nothing enters mid-floor. **They should fail.** They are the target.
3. Write the three greps of §X.5 as a test. It should fail.

You now have a definition of done that the machine checks.

## Day 2 — Collapse the modes

T1.1 through T1.5. This is the lowest-risk part of the removal and it warms up the muscle for the
harder part: you will touch screens, records, save fields and copy, and you will learn how the
project's layers are connected.

**Ship it.** One commit per mode, gates green each time.

## Day 3 — Stop generating

T1.6 and T1.7, the critical path. Two changes:

- Board generation places no hazard tiles.
- Board generation places no dungeon cards.

**Do not delete anything.** After this, the dungeon modules are dead code, the invariant tests from
Day 1 pass, and the game is playable — a board of pairs with no exit, which does not yet end.

## Day 4 — Make the floor end

T1.8. The board empties; the floor clears. This is the change that makes the game whole again.

Run every simulation. Everything will have moved. **Record the numbers before changing any band** —
this is the measurement §3.3 predicts, and it is the single most interesting data point in the whole
plan.

## Day 5 — Cut the rest of the between-floor layer

T1.9 through T1.11: routes, gold, shop, rooms, relics, loadouts. Large but mechanical, because
nothing generates them any more.

## Day 6 — Delete

T1.12 through T1.16. Deleting dead code, which is safe and enormously satisfying.

## Day 7 — Re-baseline

T1.17. Every band re-measured and ratcheted, with before/after in `BALANCE_NOTES.md`, and the
occupancy silent list — with luck — empty for the first time since it was written.

## AL.1 What to do if Day 3 goes badly

T1.7 is the risk. If it turns out that board generation cannot stop placing dungeon cards without a
cascade of failures:

1. **Do not push through.** Revert.
2. Find the smallest thing that still generates a card and remove only that.
3. Repeat.

The property that makes this safe is that *nothing else depends on cards being present* — the loop
never needed them. If something does, that dependency is a finding worth writing down before it is
removed.

---

# Appendix AM — Index

> Every part, section and appendix, with its subject.

## Parts

| Part | Subject | §§ |
|---|---|---|
| I | The question: what we are building and why the current game fails it | 1–3 |
| II | The field: thirteen dissections | 4–17 |
| III | The psychology, with confidence markers | 18–25 |
| IV | The synthesis: the thesis, the loop, the board, the strategy | 26–31 |
| V | The specification (normative) | 32–44 |
| VI | Feel: timing, audio, camera, accessibility, readability | 45–49 |
| VII | The first ten minutes | 50–52 |
| VIII | Retention without dark patterns | 53–56 |
| IX | Measurement: bands, simulations, and what to do when one breaks | 57–60 |
| X | The plan: tasks, risks, and what we are not doing | 61–63 |
| XI | Worked play traces | 64–68 |
| XII | Failure modes | 69 |
| XIII | The interface, surface by surface | 70–73 |
| XIV | The score, at note level | 74–75 |
| XV | The six inputs to a flip | 76–81 |
| XVI | The mathematics of the cascade | 82–84 |
| XVII | Positioning | 85–89 |
| XVIII | Content without content | 90–92 |
| XIX | The long game | 93–97 |
| XX | The loop's emotional beats | 98–100 |
| XXI | What we learned building the wrong game | 101 |
| XXII | Comparative session arcs | 102 |
| XXIII | "Why not just…?" | 103–112 |
| XXIV | Phase briefs | 113–119 |
| XXV | Closing | 120–122 |
| XXVI | The Recall, specified | 123–127 |
| XXVII | Scenarios | 128–129 |

## Sections, by subject

| Looking for | Go to |
|---|---|
| The game in one page | §26 |
| The rules as a player would be told them | Appendix Q |
| Why the dungeon went | §2, §3, §31, Appendix C |
| The turn, beat by beat | §27 |
| Why memory is the right input | §28 |
| The strategic layer | §30, §78, §79, §80 |
| Board generation | §32 |
| Suits | §33 |
| The pop | §35 |
| The ripple | §36 |
| The drop | §37 |
| The ladder | §38 |
| Fever | §39 |
| Scoring | §40, §83, Appendix AH |
| The floor | §41 |
| The run | §42 |
| Difficulty | §43 |
| The one power | §44, Part XXVI |
| Timing | §45, Appendix B.7 |
| Audio | §46, Part XIV |
| Camera and shake | §47 |
| Accessibility | §48 |
| Onboarding | §50–52, Appendix AB |
| Session shape | §53 |
| Records | §55 |
| The Rematch | §56 |
| Bands | §57, Appendix O |
| The tasks | §61, Appendix G |
| What we will not build | §25, §63, Appendix N |
| Objections | Appendix F |
| Open questions | Appendix E |
| Risks | §62, Appendix AK |
| The removal, module by module | Appendix H, Appendix X |
| Where to start reading the code | §P.6 |
| What to do first | Appendix AL |

## Appendices

| # | Subject |
|---|---|
| A | Glossary |
| B | The constant register |
| C | The removed inventory, with verdicts |
| D | Sources, and how to read them |
| E | Open questions |
| F | Objections and answers |
| G | The task register |
| H | Removal manifest |
| I | The measurement history |
| J | Comparative reference data |
| K | The copy deck |
| L | Implementation notes |
| M | Decision log |
| N | Proposed mechanics, pre-judged |
| O | The band register |
| P | The surviving codebase |
| Q | The rules, as told |
| R | Expected values |
| S | Pre-mortem |
| T | Playtest protocol |
| U | Metrics |
| V | The visual specification |
| W | Adding a mechanic, correctly |
| X | The deletion register |
| Y | Team FAQ |
| Z | What counts as a stop |
| AA | Before and after |
| AB | The authored floors, exactly |
| AC | The event contract |
| AD | Reading the old code |
| AE | The counter roster after the removal |
| AF | Reading list |
| AG | Maintaining this document |
| AH | Alternative score curves |
| AI | Definition of done |
| AJ | What success looks like |
| AK | Risk register |
| AL | The first week |
| AM | This index |

---

# Appendix AN — The Complete Feedback Stack

> For every player-visible event, every channel that responds to it. This is the table to check
> when adding an event (does it have all five channels?) and when an event feels weak (which
> channel is missing?).
>
> Channels: **V** visual, **A** audio, **H** haptic, **C** camera, **T** text/announcement.

| Event | V | A | H | C | T |
|---|---|---|---|---|---|
| **Tile flip (first)** | Turn, 180ms, ease-out-back | Card turn, column-panned | Light tick | — | — |
| **Tile flip (second)** | Same | Card turn + rising swell | Light tick | — | — |
| **The gap** | — | Music ducks 3dB | — | — | — |
| **Match** | Both tiles lift and brighten | Bell attack, tier timbre | Medium pulse | Trauma 0.05 | — |
| **Mismatch** | Tiles hold 700ms, then turn | Semitone dissonance resolving to unison | Two soft ticks | — | — |
| **Chain drop** | Meter drains 300ms | Falling minor third | — | — | `Chain lost` |
| **Recognition (§76.1)** | — | Quiet recognition tone | — | — | — |
| **Pop wave** | Shatter outward, staggered 18ms/step | One pentatonic note per pair, ascending | Per-pair micro-tick, capped | Trauma 0.02/pair, cap 0.25 | `Pop` |
| **Wave boundary** | Next wave begins as previous ends | Percussive tick, then octave shift | Medium pulse | Trauma 0.08, hit-stop 40ms | `Ripple ×N` |
| **Partner travel** | The far half **travels** across the board | The note plays at its destination | — | — | — |
| **Halo (Fever)** | Bordering tiles flash their own hue, then go | Wide chord under the run | Strong pulse | — | `Halo` |
| **Drop** | Fall, accelerate, fade | Low thud cluster, off-scale | Low rumble | Trauma 0.15, hit-stop 60ms | `Drop` |
| **Rung reached** | Meter tick enlarges | The rung's tone, held | Strong pulse | Trauma 0.20 | `Clean` / `Sharp` / `Fever` |
| **Score float** | Rise from each tile, converge | — | — | — | — |
| **Score total** | Accelerating count-up | Rising tick | — | — | — |
| **Multiplier build** | Terms appear one at a time | One tick per term | — | — | `12 × Fever ×8 × Ripple ×5.5` |
| **Fever ceremony** | Freeze, zoom, desaturate, `FEVER` at 2× | Run resolves to tonic ff over a held chord | Sustained | Trauma 0.55, hit-stop 180ms | `Fever` |
| **Recall charged** | Mark in the bottom strip | Single quiet chime | Light tick | — | `Recall ready` |
| **Recall used** | Suit flips up 200ms, holds 1.2s, flips back | Sustained tone for the hold | — | — | — |
| **Last pair** | Its own small beat | — | Medium pulse | — | — |
| **Floor clear** | Bonus builds; next board assembles in place | Root, then ascending arpeggio | Medium pulse | Trauma 0.10 | `Floor N cleared — T turns, par P` |
| **Personal best passed** | Marker appears | — | Light tick | — | `Best` |
| **Run end** | Best break replays | Resolution | — | — | `Floor N` |

## AN.1 The audit this table enables

Reading down the columns:

**Visual:** every event has one. Good.

**Audio:** every event has one except the score float and the partner travel's own motion — and the
partner travel is arguably the game's most distinctive visual with no sound of its own. **Gap: the
travel should have a soft doppler as it crosses.** Added as a note to §46.2.

**Haptic:** thin, and deliberately — haptics fatigue fast. The pattern is: light for input, medium
for a match or a boundary, strong for a rung or Fever. Anything more would be noise.

**Camera:** only the big events. Correct — camera is the scarcest channel and spending it on small
events is why so many games feel shaky rather than impactful.

**Text:** only where a *name* adds something. Note that the pop, the ripple, the drop and the rungs
are named and nothing else is. Naming an event is how a player learns its identity (§50.2), and
naming everything would make the rail noise.

## AN.2 The rule this table encodes

> **A big event uses more channels, not louder ones.**

A match uses two channels; a Fever break uses five. That escalation is what makes the ladder felt
without anything being turned up, and it is the presentation-layer equivalent of §16.3's honesty
rule.

---

# Appendix AO — The Teaching Plan, Per Mechanic

> §50 says the game teaches itself. This is the audit: for each mechanic, what teaches it, when, and
> what happens if the teaching fails.

| Mechanic | Taught by | When | If it fails |
|---|---|---|---|
| Tiles flip | Tapping one | Second 1 | Impossible to fail |
| Matching clears | Finding a pair | Turn 1–3 | Impossible |
| **A match takes others with it** | Floor 1's authored board | **Turn 1–2** | The whole product is misread as Concentration (§69.8) |
| The blast is one suit | Floor 2's boundary | Turn 3–6 | The player treats blasts as random; the aim guide never gets used |
| The suit is on the back | Noticing, or never | Turn 3–10 | Board reading is lost; the game becomes reactive |
| A mismatch costs the chain | The meter draining | First mismatch | The chain is not understood as a resource |
| The chain makes blasts bigger | The rung tone and a visibly bigger blast | Floor 1–2 | The ladder is invisible; §69.3 |
| **Clean reaches partners** | Floor 3's split pair | **Turn ~5 of floor 3** | The design's central mechanic is never seen (§AE.3) |
| Sharp runs the reaction | It happening | Floor 2–4 | The top half of the ladder is unmotivated |
| Fever exists | The meter's top tick, visible from turn 1 | Immediately | No aspiration (§52.2c) |
| Fever's halo | Seeing it cross a colour boundary | First Fever | Fever reads as "bigger Sharp" |
| The drop | Pairs falling with no match | Floor 1–3 under §37.3 | Severance strategy never found (§80) |
| Holding a pair is worth more | **Nothing currently teaches this** | — | §69.3; this is Phase 3 |
| A suit can sever | **Nothing currently teaches this** | — | §80; this is Phase 3 |
| The Recall | The charge chime and the mark | First large break | An unused power is dead content |
| Par | The `turns / par` readout | Floor 1 | No pacing signal |

## AO.1 The two rows with nothing in the "taught by" column

**Holding a pair** and **suit severance** are the two deepest strategic mechanics in the design and
neither has any teaching at all. They are both Phase 3, and this table is the clearest single
statement of why Phase 3 is not polish.

## AO.2 The teaching order is also the risk order

The three bolded rows are the ones whose failure is unrecoverable — if the player does not see a
blast on their first match, does not see a partner travel in their first two minutes, and never
learns that holding pays, then they are playing a much smaller game than the one specified, and
nothing later will tell them otherwise.

**Those three are what the authored floors and Phase 3 exist for**, and they are the acceptance
criteria that matter most.

---

# Appendix AP — Every Section's Claim

> One line per section, so the whole argument can be scanned. Where a section is normative rather
> than argumentative, the line states what it specifies.

| § | Claim or specification |
|---|---|
| 1 | The product is a ninety-second session that feels impressive and deepens for forty hours with no new rules |
| 2 | The current game has a working cascade and a dungeon layer with eleven systems that never fire |
| 3 | Removing the layer is correct because depth in this genre comes from geometry, not nouns |
| 4 | Peggle: skill sets up the first step, chaos amplifies it, and the ceremony is disproportionate and identical |
| 5 | Puzzle Bobble: the deepest payoff comes from a structural property the player learns to see |
| 6 | Tetris: a steeply superlinear reward makes deliberate risk-taking correct |
| 7 | Tetris Attack: acting inside the resolution window is the genre's highest skill ceiling |
| 8 | Puyo: determinism is the precondition for a shared strategic vocabulary |
| 9 | Bejeweled's cascade is luck because its uncertainty arrives from off-screen; ours does not |
| 10 | Zuma: pressure should be spatial, reversible, and the same object as the opportunity |
| 11 | Incrementals: the number always moves, one threshold is visible, nothing is ever lost |
| 12 | Vampire Survivors: a compressed, always-palpable ascent, and an absurd top end |
| 13 | Balatro: multiplicative scoring makes finding beat accumulating |
| 14 | Slay the Spire: the run is the unit; choices are few, informed, or absent |
| 15 | 2048 vs Threes: legibility beats depth for reach; a screenshot must teach the game |
| 16 | We take rapid repetition and sensory generosity; we refuse hidden randomness, disguised losses and manufactured near-misses |
| 17 | Our 100ms beat — an act of recall being tested — is unique in the survey and unserved |
| 18 | Cascade joy is prediction error: confident about the first step, uncertain about the extent |
| 19 | We use variable magnitude with deterministic occurrence, not variable ratio |
| 20 | Memory difficulty self-normalises to the player, so no difficulty machinery is needed |
| 21 | Emergent near-misses are narrative; manufactured ones are manipulation |
| 22 | We use within-session incompleteness and refuse between-session sunk cost |
| 23 | Memory gives commitment under self-imposed uncertainty, self-normalising difficulty, and clean attribution |
| 24 | Peak-end: guarantee a peak per session and control the ending |
| 25 | Fifteen techniques we will not build, and the three questions any new system must answer |
| 26 | The game in one page: seven sentences of rules, one strategic decision |
| 27 | The turn, in ten beats, with four invariants |
| 28 | Memory is the best source of cascade uncertainty because it is free, renewable and perfectly attributable |
| 29 | The board must be legible enough to plan against without flipping |
| 30 | The hold decision is the game's strategic centre and is currently invisible |
| 31 | What replaces each thing the dungeon provided, including "nothing, deliberately" |
| 32 | Board generation: pairs only, tempered growth, four surviving traits |
| 33 | Suits: four, one per six pairs, dealt as two clumps apart |
| 34 | A mismatch costs the chain and nothing else, and is framed as an exchange |
| 35 | Every match pops, bounded at two steps below Sharp |
| 36 | The ripple belongs to Sharp; acting inside its window is the top candidate |
| 37 | The drop becomes a severance: a suit that can no longer pop gives up its pairs |
| 38 | The ladder: Clean buys partner reach, Sharp buys the reaction, Fever buys the halo |
| 39 | Fever's ceremony: 2.6s, disproportionate, interrupting, identical |
| 40 | Scoring becomes multiplicative, widening the range from 27× to 768× |
| 41 | A floor ends on an empty board; par and the efficiency bonus replace the exit |
| 42 | No lives; a run ends on a generous turn ceiling or on quitting |
| 43 | Board size is the only difficulty axis; fog is a candidate, default off |
| 44 | One power: the Recall, earned by a large break |
| 45 | The timing table, including the 700ms mismatch hold |
| 46 | Audio: a rising pentatonic run, one note per pair, one octave per wave |
| 47 | A trauma scalar drives shake; Camera Comfort has three positions |
| 48 | Suits never rely on colour; a greyscale board must be playable |
| 49 | Six HUD elements, and a screenshot that teaches the game |
| 50 | No tutorial; ten things taught by play, in order |
| 51 | Three authored floors guarantee the three teaching moments |
| 52 | Show Fever before it is earned; demonstrate it at run end |
| 53 | Session shape, and thirteen stops removed |
| 54 | No daily rewards, no streaks, no notifications about loss |
| 55 | Depth is the record axis; a record is the honest form of ownership |
| 56 | Nobody measures whether a returning player is better; we can, and the Rematch surfaces it |
| 57 | Every band, with the new ones this document requires |
| 58 | A simulation reads the game's counters and never re-derives a rule |
| 59 | A bounded-memory player model would answer the difficulty questions we cannot |
| 60 | What to do when each band breaks, written before it does |
| 61 | The plan, in seven phases |
| 62 | Six risks, worst first |
| 63 | Fifteen things we are deliberately not doing |
| 64–67 | Four play traces: the first ninety seconds, the hold decision, a Fever break, a bad floor |
| 68 | What the traces revealed, including two new tasks |
| 69 | Nine failure modes and the first thing to check for each |
| 70–73 | Four surfaces: board, pause, run end, first launch |
| 74–75 | The audio score at note level |
| 76–81 | The six inputs to a flip, each unpacked |
| 82–84 | The cascade's mathematics, and the sharpest testable prediction in the document |
| 85–89 | Positioning: premium, one purchase, judged on the loop |
| 90–92 | Five sources of longevity that are not content |
| 93–97 | The long game, and the failure case |
| 98–100 | Eight emotional beats, and the one we do not have |
| 101 | Nine transferable lessons from building the wrong game |
| 102 | Our session arc against three references, and the minute 3–7 gap |
| 103–112 | Ten alternative designs and why not |
| 113–119 | One brief per phase |
| 120–122 | The closing argument in three paragraphs |
| 123–127 | The Recall, fully specified |
| 128–129 | Twelve scenarios, four of which changed the specification |

---

# Appendix AQ — Our Loop Against the Genre

> A mechanic-by-mechanic comparison, so that what is borrowed and what is ours is explicit.

| Mechanic | Who does it | Ours | Novel? |
|---|---|---|---|
| Contact clearing | Puzzle Bobble, Puyo, Bejeweled | The pop | No |
| Chain reaction | Puyo, Tetris Attack, Bejeweled | The ripple | No |
| Orphan/severance | Puzzle Bobble | The drop (§37.3) | No, but rare in matchers |
| Escalating multiplier tiers | Peggle (fever), Tetris Attack (chain) | The ladder | No |
| Cross-type clear at the top tier | Peggle's fever board | The halo | Uncommon |
| Multiplicative scoring | Balatro | §40.2 | No |
| Ceremony on the win condition | Peggle | §39.3 | No |
| Rising pitch through a chain | Peggle | §46.1 | No |
| Octave per chain depth | **Nobody in the survey** | §46.1 | **Yes** |
| Difficulty from board size only | Threes, 2048 | §43 | No |
| No refill; a closed board | Puzzle Bobble (partly) | §32.1 | Uncommon |
| **Memory as the input** | **Nobody** | The flip | **Yes** |
| **Uncertainty located in the player, not the game** | **Nobody** | §28 | **Yes** |
| **A pair leaving from off-blast because its partner went** | **Nobody** | The partner reach (§35.2) | **Yes** |
| **Holding a remembered pair to spend at a higher tier** | Tetris's well, abstractly | §30 | **Yes, in this form** |
| **A break making the board easier to remember** | **Nobody** | §20.5 | **Yes** |
| Depth as the record axis | Roguelikes | §55.1 | No |
| Replaying a seed to measure improvement | **Nobody in the survey** | §56.3 | **Yes** |

## AQ.1 The six novel things

Six rows are marked novel, and they cluster: **five of the six are consequences of the memory
input.** That is the design's actual contribution — not a new cascade mechanic, but the discovery
that a memory game's structure gives a cascade properties no other input can.

The sixth (octave per wave) is a presentation idea and is cheap.

## AQ.2 What this means for how the game is described

Not "a cascade game with memory". Not "a memory game with effects".

**"The board detonates, and what it takes depends on what you remembered."**

---

# Appendix AR — Implementation Pitfalls

> Specific traps, at code level, collected from six generations of working on this loop.

| Pitfall | Symptom | Avoid by |
|---|---|---|
| Re-deriving a rule in an instrument | Two measurements disagree | §58.2 — read counters |
| Building a fixture the rule needs | The rule works and never fires | The occupancy census |
| Measuring a board nobody plays | A band passes and the game is broken | Build floors the way a run does |
| Changing a band to make a build green | The band stops meaning anything | §60.1 |
| Tuning against a sample too small | A fixture fails and nothing changed | Widen the sample first |
| Deleting before removing the caller | The build is broken for weeks | §L.9 |
| Changing behaviour and signature together | A bisect cannot separate them | Two passes |
| Reading rules state from presentation | Replay and reduced motion diverge | The event contract (§AC) |
| Shake driven by animations | It breaks under hit-stop and does not replay | A trauma scalar (§47.1) |
| Pitch driven by wall-clock time | It desynchronises from the wave stagger | Drive from the event stream |
| A counter that reads "remaining" | It reads non-zero without anything happening | §57.4's roster rule |
| A new mechanic without a counter | It joins the eleven | §101.8 |
| Regenerating docs before the last source edit | The model goes stale and the gate fails | Regenerate last |
| An assertion on tile *order* | It breaks whenever the deal changes | Assert on content, not position |
| A test that constructs its own board | It tests the rule, not the game | Pair it with a simulation band |

## AR.1 The one that costs the most

**Deleting before removing the caller.** Every other pitfall costs a debugging session; this one
costs the ability to run the game at all, which stops everything else. It is the reason Appendix
AL's first week is ordered the way it is.

---

# Appendix AS — Part Abstracts

> One paragraph per part, for somebody deciding what to read.

**Part I — The Question.** States the product in one sentence and defends every clause of it. Makes
"one loop" an engineering constraint by filtering all twenty-one existing systems through "is this
downstream of flipping two tiles?" — twelve fail. Names the three genre families we are joining and
what we take from each. Ends with six falsifiable claims that would make this document wrong, and
the measurements showing that the current game fails four of them.

**Part II — The Field.** Thirteen dissections, each ending in what we take and what we refuse.
Peggle for the ceremony and the rising pitch; Puzzle Bobble for the severance rule; Tetris for the
superlinear curve; Tetris Attack for the resolution window; Puyo for chain notation and
determinism; Bejeweled for what to avoid; Zuma for reversible pressure; the incrementals for the
always-moving number; Vampire Survivors for the ascent; Balatro for multiplicative scoring; Slay
the Spire for the run as a unit; Threes and 2048 for legibility; slot machines for the line we will
not cross. Ends with a cross-timescale table showing where we are strong, thin and absent.

**Part III — The Psychology.** Reward prediction error as the account of why cascades feel good,
and the design consequence: be confident about the first step and uncertain about the extent.
Variable ratio and its honest replacement. Flow's three requirements, and the observation that
memory difficulty self-normalises. Near-miss, split into the emergent kind we permit and the
manufactured kind we forbid. Sunk cost, endowment and Zeigarnik, with our position on each. What a
memory task actually affords and costs. Ends with fifteen techniques we refuse and the three
questions any new system must answer.

**Part IV — The Synthesis.** The game in one page. The turn in ten beats with four invariants. The
argument that memory is the best available source of cascade uncertainty because it is free,
renewable, and perfectly attributable — and the consequence that we can afford to let every match
pop. The board as a legible field. The hold decision as the strategic centre. What replaces each
thing the dungeon provided.

**Part V — The Specification.** Normative. Board generation, suits, the flip, the pop, the ripple,
the restructured drop, the ladder, Fever, multiplicative scoring, the floor, the run, difficulty,
and the single power. Every constant named, every change marked against what is shipped.

**Part VI — Feel.** Timing to the millisecond, audio at note level, a trauma-based camera,
accessibility, and the screenshot test.

**Part VII — The First Ten Minutes.** No tutorial; ten things taught by play in order; three
authored floors that guarantee the three moments procedural generation cannot.

**Part VIII — Retention Without Dark Patterns.** Session shape, thirteen stops removed, records
rather than currencies, and the measurement nobody in the market makes.

**Part IX — Measurement.** Every band with its consequence, the rule that makes an instrument
trustworthy, the player model we should build, and what to do when each band breaks.

**Part X — The Plan.** Seven phases, sixty tasks, six risks, fifteen things we are deliberately not
doing.

**Part XI — Worked Play Traces.** Four annotated walkthroughs that surfaced four specification
changes not visible from the rules.

**Part XII — Failure Modes.** Nine ways this goes wrong, with the first thing to check for each.

**Parts XIII–XIV — Interface and Score.** Four surfaces and the audio spec at a level a composer
could implement from.

**Parts XV–XVI — The Six Inputs and the Mathematics.** Each input to a flip unpacked, then a model
of what a break should take and what it should score — including the sharpest testable prediction
in the document.

**Parts XVII–XIX — Positioning, Content, The Long Game.** What the product is, five sources of
longevity that are not content, and where this goes if it works.

**Parts XX–XXII — Beats, Lessons, Arcs.** Eight emotional states and the one we lack; nine
transferable lessons from six generations of building the wrong thing; our first ten minutes against
three references.

**Part XXIII — Why Not Just…?** Ten alternative designs, including the closest call: gravity.

**Parts XXIV–XXVII — Briefs, Closing, The Recall, Scenarios.** One page per phase; the argument in
three paragraphs; the single power specified fully; and twelve board scenarios, four of which
changed the spec.

---

# Appendix AT — Quick Reference

> The card to pin above a desk.

## The loop

```
flip → match → POP → RIPPLE → DROP → climb → FEVER → clear
```

## The ladder

| Rung | From | Buys |
|---|---|---|
| — | 0 | Two steps into the clump; both halves must be inside |
| Clean | 3 | Either half suffices — partners come from anywhere |
| Sharp | 40% of the floor | The whole clump, and the reaction |
| Fever | 50% of the floor | The halo, and the ceremony |

## The numbers that matter most

| What | Value | Band |
|---|---|---|
| Ladder spread (none → fever) | 2.53 pairs | ≥ 2.20 |
| Thinnest rung | 0.39 pairs | ≥ 0.30 |
| Clean player's Fever floors | 0.27 | ≥ 0.15 on big floors |
| Fever separation, clean over reference | 2.64 | ≥ 2.00 |
| Systems that never fire | 11 → 0 | exact match to baseline |
| Score range within a floor | 768× | N5: largest break 0.25–0.70 of the floor |

## The three questions before adding anything

1. Is it downstream of flipping two tiles?
2. Which measured band does it move, and by how much?
3. Would the mechanic still be worth having with its flourish removed?

## The four rejection categories

A second verb · punishing the core verb · a menu · the board lies or moves.

## The three things to hold on to

**One loop. Measure it or it is decoration. The excess is the point.**

## Where to start

§26 (the game in one page) · Appendix Q (the rules) · Appendix AL (the first week) ·
`yarn sim:occupancy` (watch the game play itself)

---

# Appendix AU — Glossary of Reference-Game Terms

> Terms borrowed from the reference products in Part II, so that a comment saying "this is the
> Puyo problem" is legible to somebody who has not played Puyo.

| Term | From | Meaning | Our equivalent |
|---|---|---|---|
| **Extreme Fever** | Peggle | The disproportionate, invariant celebration on the win condition | §39.3, §39.4 |
| **The bucket** | Peggle | A moving reward that returns a resource for good play | The Recall's charge (§44.2) |
| **The last orange peg** | Peggle | The endgame where the win condition becomes a low-payoff accuracy test | The floor's tail (§41.2) |
| **Orphan** | Puzzle Bobble | A cluster with nothing holding it, which falls | The drop's severance (§37.3) |
| **Severance** | Puzzle Bobble | Deliberately cutting a cluster's support | §80's strategic input |
| **The well** | Tetris | A deliberately maintained risk held open for a disproportionate payoff | Holding a known pair (§30) |
| **A Tetris** | Tetris | The maximum single clear, worth far more than four singles | A Fever break (§39) |
| **Skill chain** | Tetris Attack | Acting inside the previous action's resolution window | §36.3, unbuilt |
| **Garbage** | Tetris Attack | Incoming pressure that a big play converts into reward | §7.4's shape, in the difficulty curve |
| **Chain (link)** | Puyo | One step of a reaction; the score curve doubles per link | Our waves (§36) |
| **GTR / stairs / sandwich** | Puyo | Player-invented, named build patterns | What §8.3 hopes for and §94 avoids foreclosing |
| **Cascade** | Bejeweled | Automatic re-matching after a clear | The ripple (§36) — but ours is skill, not refill |
| **Refill** | Bejeweled | New pieces arriving from off-screen | **We have none** (§9.3) — the design's structural advantage |
| **Special piece** | Candy Crush | A forward-paying reward created by a large match | The Recall's charge (§44.2) |
| **The line** | Zuma | Spatial, reversible pressure | The fog candidate (§43.3) |
| **Prestige** | Incrementals | Wiping progress for a multiplier | **Refused** (§11.4) |
| **Idle accrual** | Incrementals | Earning while not playing | **Refused** (§11.4) |
| **The ascent** | Vampire Survivors | Weak to absurd inside one run, always palpable | The per-floor chain climb (§12.3) |
| **chips × mult** | Balatro | A multiplicative score built visibly, term by term | §40.2, §40.4 |
| **Ante / blind** | Balatro | A climbing threshold that forces engine-building | The floor par (§41.3) |
| **The run** | Slay the Spire | The unit of play and of storytelling | §42 |
| **Ascension** | Slay the Spire | Optional escalating difficulty for veterans | **We have none** — depth is the axis (§55.1) |
| **The screenshot test** | 2048 vs Threes | A single frame must teach the game | §49.1 |
| **Near-miss** | Gambling design | An outcome arranged or rendered to look close | Emergent only, never manufactured (§21) |
| **Loss disguised as a win** | Gambling design | A net-negative outcome presented with win feedback | **Refused** (§16.3.2) |
| **Variable ratio** | Operant conditioning | Reward after an unpredictable number of responses | Replaced by variable magnitude with deterministic occurrence (§19.2) |

## AU.1 Our own terms that others might borrow

For completeness, the vocabulary this design contributes:

| Term | Meaning |
|---|---|
| **The pop** | Every match's guaranteed detonation of its same-suit neighbourhood |
| **The ripple** | The reaction after the pop, bought at Sharp |
| **Partner reach** | A pair leaving because *either* half was in the blast — the mechanic that makes it a memory cascade |
| **The halo** | Fever's cross-suit take, the only rule that ignores the map |
| **Momentum** | Streak plus cascaded pairs; what climbs the ladder |
| **Severance** | A suit that can no longer pop, whose pairs then drop |
| **Occupancy** | Whether a system ever fires on the floors real players play |
| **A stop** | Any moment the player is neither able to flip nor watching a flip's consequence |

**"Reachability is not occupancy"** is the one worth exporting. It predates this document, it is
what found the eleven silent systems, and it applies to every game with procedural content.

---


# Colophon

**Document:** The Addictive Loop — a thesis on building the most compelling small game we can, by
fusing the memory board with the cascade genre.

**Written at:** Gen 171, immediately before the dungeon layer was removed.

**Method:** Part II is design analysis of thirteen products, marked *(stated)*, *(observed)* or
*(analysis)*. Part III is a literature summary with explicit confidence markers. Parts IV–VI are
specification, marked **[SHIPPED]**, **[CHANGE]** or **[NEW]**. Every measured number comes from one
of `yarn sim:pop`, `yarn sim:cascade`, `yarn sim:occupancy` or `yarn gate:systems` in this
repository and can be reproduced.

**The largest limitation:** no claim in this document has been checked against a real person playing
the game (§D.5). Phases 1 and 2 are justified by measurements of the existing game; every phase
after that is a prediction.

**The strongest evidence in it:** eleven counters reading zero across a hundred and sixty floors.

**Companion documents:** `CHAIN_CHUNK_FEVER_DESIGN.md`, `BALANCE_NOTES.md`, `MARKET_SURVEY.md`,
`RESEARCH_NOTES.md`, `RESEARCH_NOTES_2.md`, `REMOVED_DUNGEON_LAYER.md`, `STEAM_READINESS.md`.

**Changelog:**

| Version | When | What |
|---|---|---|
| 1.0 | Gen 171 | Written. Parts I–XXVII, Appendices A–AM. |

---

*End of document.*

---

## One last note

This document is long because it is meant to be the place an argument is settled once, in full,
with the measurement attached — so that the next person who has an idea for a new card type finds
§25.2's three questions and Appendix N's pre-judged list rather than an empty room.

It will be wrong in places. Appendix E says where I already know it is uncertain; Appendix F says
where the objections are strongest; Appendix AG says what to do when the game contradicts it.

The one thing worth taking from it, if nothing else survives:

> **Build the instruments. They will tell you things you did not want to know, and those are the
> only findings worth having.**


---

## Postscript: how this document was assembled

For anyone auditing the reasoning rather than the conclusions, the order of work was:

1. **The measurements came first**, over six generations, and most of them were taken while trying
   to make the dungeon layer *work* rather than to justify removing it. Gen 167's reserve, Gen 168's
   ladder rebuild and Gen 170's Fever correction were all repairs. The eleven silent systems were
   found by an instrument built for a different question.
2. **The archive came second** — `REMOVED_DUNGEON_LAYER.md`, generated from the catalogs before
   anything was deleted, so the record is the code's own rather than a memory of it.
3. **This document came third**, and its job was to decide what replaces each thing that goes,
   before the removal rather than after it. Several answers — the floor ending on an empty board,
   the severance drop, the multiplicative curve — are specified here precisely because the removal
   would otherwise have left holes to be filled under time pressure.
4. **The implementation comes fourth**, in the seven phases of Part X, and Appendix AL is its first
   week.

Steps 3 and 4 are in that order deliberately. §F.13 answers the obvious objection to it.

