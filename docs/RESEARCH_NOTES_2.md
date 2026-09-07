# Research, second pass: fifteen questions, and what actually survived

Fifteen research passes were run against the questions in `RESEARCH_PLAN.md`. This file records
what came back, and it has to open with the caveat, because the caveat is most of the story.

## 0. What happened, and why most of this is marked unverified

Each pass fans out, fetches sources, extracts falsifiable claims, and puts each claim to a
three-vote adversarial panel. Only what survives that vote is a finding. In the first research
pass (`RESEARCH_NOTES.md`) that vote killed 10 of 25 claims, and it killed the most quotable ones
— which is the whole reason the step exists.

**In this batch the verification stage was cut off by a service rate limit, twice.** 368 claims
were extracted across the fifteen passes; the panels reached a verdict on seven of them. Re-running
the passes after the limit reset hit the limit again.

So the bulk of what follows is **UNVERIFIED**: extracted from a named source, not yet
independently checked. It is not usable as evidence. It is a queue of things to check.

What I did instead, and what makes this file worth keeping: **I verified the highest-value claims
by hand**, fetching each source directly and asking it for the exact wording. Those are marked
CONFIRMED below with the figures as the source states them. Everything else is explicitly parked.

Status of the whole batch:

| | Count |
|---|---|
| Confirmed by hand-checking the source in this session | 19 |
| Confirmed by the automated 3-vote panel | 4 |
| Refuted by the automated panel | 3 |
| Extracted but unverified (rate limit) | ~360 |

---

## 1. CONFIRMED — Steam Deck Verified, as Valve writes it

Source: `partner.steamgames.com/doc/steamdeck/compat`, fetched and quoted directly. All five
verbatim. This matters because this game is Electron and mouse-first, and every one of these is a
hard, checkable gate.

- **"the smallest on-screen font character should never fall below 9 pixels in height at
  1280x800"** — a concrete floor, and one this repo can test against its own HUD.
- **"The default controller configuration must provide users with the ability to access all
  content."** A mouse-first game must ship a working default mapping; the player remapping it does
  not count.
- **"On Steam Deck, this is 30fps at 800p, and on Steam Machine this is 30fps at 1080p."**
- **A native Linux build is NOT required**: "By default, we will test a Linux build if one is
  available. If the Linux build fails compatibility tests... we'll then test the Windows build of
  your game running under Proton."
- **"We're aiming for compatibility reviews to be completed and results available to partners
  within a week of submission."**

Note what is absent: Valve's own documentation makes **no claim that Verified status affects
sales**. Anyone asserting it does is not citing Valve.

## 2. CONFIRMED — the retention question, answered with Valve's own numbers

This is the question the first pass could not answer at all, and the one this project most needs.
Both sets fetched directly from Steam's public global achievement stats.

**Slay the Spire** (`steamcommunity.com/stats/646570`):

| Achievement | Global % |
|---|---|
| Ascend 0 | 66.5% |
| Ascend 10 | 14.9% |
| Ascend 20 | 7.3% |
| My Lucky Day (win a Daily Climb) | 24.1% |

**Dead Cells** (`steamcommunity.com/stats/588650`):

| Achievement | Global % |
|---|---|
| Faster than light! (finish a daily) | 23.5% |
| The Fat and The Furious (first boss) | 72.3% |
| Blade Master (second boss) | 55.8% |
| The last rampart falls... (base final boss) | 40.4% |
| You don't belong in this world! (Dracula, newest DLC) | 7.6% |

Three things follow, and the third is the important one.

**The difficulty ladder is climbed by a small minority.** 7.3% of Slay the Spire owners reach
Ascension 20. Note also that "Ascend 0" at 66.5% is not evidence of elective climbing — it is
granted on a first win, so it measures "beat the game once", not "chose to climb".

**A daily is reached by about a quarter of owners** in both games — 24.1% and 23.5% — which is
more than reach the middle of Slay the Spire's ladder.

**But none of these numbers measure retention, and they cannot.** They are one-time lifetime
unlocks. Nothing in them distinguishes a player who did one daily from one who did five hundred.
They are a ceiling on participation, not a measure of return. **So the honest answer to "do
dailies retain players" remains: Valve's public data cannot tell you, and this pass found no
source that can.** That is the finding — not a number.

One more, verified as an absence: **Dead Cells' Boss Stem Cell ladder — its flagship difficulty
escalation, 0BC to 5BC — has no achievement at all.** Its public stats therefore cannot measure
whether anyone climbs it. Any claim that Steam data shows BC-ladder engagement would be invented.

## 3. CONFIRMED — wishlist conversion, and why the folk rule is wrong

Source: GameDiscoverCo, "The state of Steam wishlist conversions", fetched directly.

- Games launching with **>10,000 wishlists: 0.17x** median wishlist-to-first-week-sales (50k
  wishlists ≈ 8,500 week-one sales).
- Games launching with **>25,000 wishlists: 0.15x** — conversion does **not** improve with a bigger
  list — dropping to 0.14x with adult games excluded.
- Games priced **above $10: 0.10x**. This is the band this game sits in. Plan on roughly one sale
  per ten wishlists in week one, not the folk 20%.
- The spread is the real finding: outcomes vary by **10-20x, not 10-20%**. The author calls the
  metric "near-fatally flawed" for exactly that reason. **A single wishlists x N rule is
  meaningless for one game.**

## 4. CONFIRMED — the memory genre's credibility problem

Source: FTC press release, January 2016, fetched directly. Relevant because this game's core verb
is remembering where a card is, and the largest commercial business built on that verb was a
regulatory casualty.

- **"$50 million judgment against Lumos Labs, which will be suspended due to its financial
  condition after the company pays $2 million to the Commission."**
- The FTC alleged Lumosity claimed its training improved everyday performance at school, work and
  athletics; delayed **"age-related cognitive decline and protect against mild cognitive
  impairment, dementia, and Alzheimer's disease"**; and reduced impairment from stroke, TBI, PTSD,
  ADHD and chemotherapy — "while claiming scientific studies proved these benefits".
- The Bureau of Consumer Protection Director: **"Lumosity preyed on consumers' fears about
  age-related cognitive decline, suggesting their games could stave off memory loss, dementia, and
  even Alzheimer's disease."**

The design consequence is narrow and worth stating plainly: **this game should make no cognitive
benefit claim of any kind**, in store copy, achievements, or tutorial text. It is entertainment
built on a memory verb, and that is the only claim it can support.

## 5. CONFIRMED by the automated panel (before the limit)

- **Steam Next Fest requires a live demo.** "Steam Next Fest only includes games with demos, so
  please be sure to set yours live ahead of the start of Next Fest." (3-0) Running a demo during
  Next Fest is a Valve requirement, not a marketing choice.
- **The bubble-shooter orphan rule is a colour-blind flood fill from the top row.** In the
  canonical open-source implementation, a connected component is floating iff no member has y == 0,
  and `findCluster` is called with `matchtype = false`, so bubbles of every colour caught in the
  orphaned mass fall together. (2-0) Directly relevant to our own drop rule.
- **Panel de Pon combo garbage is a discrete lookup table, not a formula**: 4-combo sends a 3-wide
  rod, 5-combo 4-wide, 6-combo 5-wide, and only a 7-panel clear produces a full-width row; 8-12
  are compound sets. (3-0)
- **The Puyo Nexus reverse-engineering index does NOT contain the scoring tables** — it lists
  "Score calculation" as an open area of interest. (3-0) A useful negative: the chain-power tables
  must come from elsewhere, and a claim citing that page for them is miscited.

## 6. REFUTED — do not repeat these

Each lost 0-3 or was contradicted:

- **"Puzzle Bobble's drop and pop score identically (100 points each)."** Refuted 0-3. The
  super-linear drop premium is the genre's whole scoring economy; the flat-rate claim does not hold.
- **"Valve sends the Next Fest participant list to press 10 days before the event."** Refuted 0-3.
  There is no 10-day press deadline to plan around.
- **"Valve asks developers to disclose in-demo that the demo will be deactivated after Next Fest."**
  Refuted 0-3.

## 7. UNVERIFIED — the queue, not the evidence

Roughly 360 extracted claims across all fifteen topics are parked unverified in the session
scratchpad. The ones most worth checking next, because they would change a decision here:

- Puyo Puyo's exact chain scoring formula and its group/colour bonus tables — the shape of our own
  chain ladder. (Puyo Nexus returned HTTP 403 to a direct fetch; needs another route.)
- Celeste's hit-stop constants (0.01s / 0.05s / 0.1s tiered by event force) — the source file
  returned truncated, so these are **not** confirmed despite appearing twice in the extraction.
- Balatro's ante requirement table and the chips x mult architecture.
- Slay the Spire's pick-rate-and-win-rate method for detecting dead and dominant cards — the
  method behind task 158.
- Dead Cells' and DCSS's generation budgets (monsters per combat tile; CHANCE vs WEIGHT vs PLACE) —
  the method behind tasks 156 and 157.
- Greenworks / steamworks.js as the only Node bindings, and their maintenance status — our stack.

**Nothing in that list should be cited or designed against until it is checked.** The first pass's
lesson stands: the claims that sound most authoritative are the ones most likely to die.

---

## 8. CONFIRMED — the second round, verified by hand against primary sources

After the automated passes died, the remaining topics were redone by fetching each source directly
and quoting it. These are confirmed the same way §§1-4 are.

### Generation budgets — the method tasks 156 and 157 were blocked on

**Dead Cells** (Motion Twin's lead level designer, quoted verbatim):

- The content budget is a **ratio against level geometry**, not a fixed count: *"The number of
  monsters in one level is defined by the total length of the combat based tiles in the level."*
  Worked example: 250 combat tiles at 1 monster per 5 tiles = 50 monsters.
- Expensive content is **weighted against the same budget** — some monsters *"count for 10 tiles"*
  rather than one.
- Room selection is **retry-until-compliant**, not trim-a-finished-list: *"For each node, the
  algorithm tries a random room, among the ones dedicated for this particular biome, and tests to
  see if it complies with the instructions given by the graph."* A node's declared content type
  therefore cannot be silently dropped — which is precisely the failure this repo hit.

**DCSS** (level-syntax documentation, quoted verbatim) separates three things this repo keeps
conflating:

- **CHANCE** — an absolute appearance probability on a 1-in-10000 scale. *"If specified as a raw
  number, the chance of selecting the vault is <number> in 10000."* `CHANCE: 5%`, `CHANCE: 500` and
  `: chance(500)` are equivalent.
- **WEIGHT** — a relative share among competitors, default 10: *"[vault's WEIGHT: / sum of all
  WEIGHT:s of vaults of that type]"*.
- **DEPTH vs PLACE** — the guaranteed-versus-chance split, stated outright. DEPTH *"does not force
  a map to be placed in a particular place; it applies only when the dungeon builder is looking for
  a random vault"*; PLACE *"will force the map... to be picked when D:3 is generated."*
- Both are **depth-scopable**: `WEIGHT: 100 (D:2-4), 20 (Crypt, Zot)` — so a floor band can be
  tuned without disturbing the rest, which is exactly what floors 2-6 need here.

### Detecting dead and dominant content — the method behind task 158

Mega Crit on Slay the Spire (Game Developer interview, quoted verbatim):

- **Two metrics, not one**: pick rate when offered, and how often the card appears in winning decks.
- The operational definition of dead, which the occupancy census arrived at independently: a pick
  rate *"too low and it's 'basically not a card in our game at that point.'"*
- Why they measured at all, which applies exactly here: *"look, we're not going to reasonably be
  able to balance this many cards, we don't have a team of people to do this."* Pool size forced
  the method.
- A worked case of warping: **Dual Wield**, buffed to duplicate any card in hand — *"It was totally
  broken. You could copy skills and go infinite really easily."* Fixed by restricting it to Skill
  cards. The tell was a rule interacting with itself.

### Peggle assists the player, deliberately and secretly

PopCap's Jason Kapalka (Game Developer, quoted verbatim):

- *"The Lucky Bounce that ensures that a ball hits a target peg instead of plunking into the dead
  ball zone is used sparingly."*
- *"We do apply a lot of extra 'luck' to players in their first half-dozen levels or so to keep
  them from getting frustrated while learning the ropes."*

Worth sitting with: the reference product for "a cascade that feels good" tilts the odds for a new
player across **the first half-dozen levels** — the same span, floors 1 to 6, where this game's pop
fired on nothing at all. Kapalka also notes the risk: players who suspect assistance tend to assume
something worse than what is actually happening.

### Balatro's escalation curve

Community wiki, fetched directly. Marked as community documentation rather than a developer
statement, but the numbers are checkable in-game.

Base chip requirement by ante (White Stake): **300, 800, 2000, 5000, 11000, 20000, 35000, 50000**.
Within an ante the blinds are fixed multiples of that base — Small 1x, Big 1.5x, Boss 2x.

Two things about the shape. The requirement grows about 167x across a run, but the *ratio* between
consecutive antes **falls** from 2.67x to about 1.43x — the curve decelerates in relative terms
even as it explodes in absolute ones. And past the designed 8-ante run the table is abandoned for a
formula whose growth rate itself grows:

    Chip Requirement = Ante8 · (1.6 + (0.75(Ante-8))^(1+0.2(Ante-8)))^(Ante-8)

That is what an endless mode looks like when it is a continuation of the same ladder rather than a
separate structure — and it is why Balatro's endless eventually breaks on floating-point rather
than on design.

### Our own stack, and what it actually costs

**Greenworks** (the Node/Electron Steamworks binding, fetched from its repository):

- It is the binding with real shipping history: *"originally developed by Greenheart Games to
  enable Steam integration in Game Dev Tycoon"*, then open-sourced.
- Its maintenance status is stated by its own maintainers, and it is not reassuring: *"maintained
  on a best-effort basis"*, *"active development is not a priority"*, and *"responses to issues and
  pull requests may be slow due to limited time."*
- It targets **Steam SDK v1.62**, supports **Electron v1.0.0+** and NW.js v0.8/v0.11+.
- **Prebuilt binaries are published for NW.js only.** Electron users compile the native addon
  themselves, per Electron version and architecture.

Set that against the Deck Verified requirement confirmed in §1 — *"The default controller
configuration must provide users with the ability to access all content"* — and the shape of the
risk for this project is specific rather than vague: the platform integration for an Electron game
runs through a best-effort-maintained community addon that must be rebuilt per Electron version,
with no published Electron binaries, while the certification we care about turns on controller
behaviour. That is a thing to validate early, not at submission.

### Accessibility as actually shipped, not as specified

The first pass gathered the *specifications* (Steam's Camera Comfort declaration, the XAG text
minimums, the Game Accessibility Guidelines). This asks what shipped puzzle games actually do.

**Tetris Effect: Connected** — the closest analogue in the market to what this game is building, a
cascade-heavy puzzle game whose whole identity is visual spectacle (Can I Play That accessibility
review, quoted):

- **No text size option.** *"The same goes for a text size option, which is a bit lacking."*
- **No option to reduce or disable background and particle effects.** The reviewer's description of
  the consequence is the warning this project should read twice: *"It can be easy to get distracted
  by the background because there's a lot happening"*, and the camera *"can make it harder to see
  your block positioning."*
- The only time-manipulation is the Zone mechanic, which is a *gameplay* system requiring a trigger
  press — not an accessibility option, and no use to a player who cannot operate it.

The lesson is not that Tetris Effect is careless; it is that a celebrated, high-budget,
spectacle-first puzzle game shipped with no reduced-motion option and its own reviewers reporting
that the spectacle costs legibility. This repo is building shatter waves, hit-stop, slow-motion, a
Fever pulse and screen shake into a game whose core verb is *remembering where a card is* — a verb
that depends entirely on the player reading and holding board state. That combination is more
fragile than Tetris Effect's, not less. Tasks 160 and 159 are the response.

### The chain lineage: depth beats width, by design and by an order of magnitude

Puyo Nexus returned HTTP 403 to direct fetches, so this is assembled from multiple concurring
secondary sources rather than quoted from the primary wiki. Treat the **shape** as reliable and the
**exact tables** as not yet verified — chain power values differ per game and per mode, which every
source agrees on.

The formula is a single product:

    points = 10 x (puyo cleared) x (chain power + colour bonus + group bonus)

The asymmetry inside that bracket is the whole design:

- **Chain power starts around 40 for the first link and climbs steeply per link.**
- **Group bonus — the reward for clearing a *bigger* cluster — is single digits.** A five-puyo group
  adds about +2.

Worked, as the sources give it: four puyo on the first link scores (10 x 4) x 40 = 1,600. Five puyo
scores (10 x 5) x (40 + 2) = 2,100. Adding a whole extra puyo to the cluster bought 2 points of
multiplier; adding a *link* multiplies the whole thing.

**Depth is worth an order of magnitude more than width, and the scoring is tuned to say so
explicitly.** Panel de Pon says the same thing through a different mechanism, confirmed 3-0 in §5:
a 4-combo sends a 3-wide rod and only a 7-panel clear produces a full-width row, while chain depth
sends a full row per link.

This is the sharpest external criticism of this game's current cascade, and it is worth stating
plainly. Measured in Gen 151, our break leaves the matched suit with **zero** plain pairs on 92-98%
of matches **at every tier** — none, Clean, Sharp and Fever alike. Width is total and depth changes
almost nothing. The genre this game's ladder is modelled on does the exact opposite, on purpose,
because that is what makes the placement decision matter.

Task 157 (suits are too small) is therefore not a polish item. It is the difference between having
a chain ladder and having a chain ladder that means something.
