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
