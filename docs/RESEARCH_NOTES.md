# Research notes: what the outside world knows that this repo should

A fan-out research pass (108 agents, 25 sources fetched, 114 claims extracted, 25 adversarially
verified by 3-vote majority) run against five questions about where this game goes next. Ten
claims survived; ten were voted down. **This file records only what survived, with its vote, and
is explicit about what did not** - a refuted claim is not a weak claim here, it is one that three
independent checks could not stand up, and several of the most quotable ones died.

Read the "What did not survive" section before planning anything that depends on market evidence.

## 1. The finding that validates the census - and names its missing half

**Slay the Spire's balance target was two-sided: no content dead, *and none dominant*.** The goal
as stated in the GDC 2019 postmortem is "Every card should have a place! (also avoid anything too
warping)", measured against an in-house metrics server ranking per-card pick-vs-skip rates with
confidence intervals across tens of thousands of runs, with event-outcome distributions on the
same surface. (3-0 on the goal and the telemetry parity; the specific run counts were voted 1-2
and are excluded.)

This repo has the first half and not the second. `system-occupancy-simulation.ts` answers "does
this ever fire", which is the dead side. Nothing answers "is this taken every time it is offered",
which is the dominant side, and a warping relic is as much a balance failure as a silent one.
That gap is a task.

**Instrumentation has to be designed alongside the feature, and the gap reopens whenever content
lands after the measurement gate.** Assassin's Creed Brotherhood's optional full-sync Constraint
system was implemented too late to enter the tracking design and was never directly tracked,
leaving the team inferring from proxy data. (3-0.)

That is exactly this repo's last two failures, from the outside. The pop (Gen 143-145) was
implemented, unit-tested, e2e-tested and documented, and fired on 0% of matches on real floors
because *generation* was never measured against it. The drop (Gen 137) was measured when it
shipped and was killed later by the ripple landing on top of it - a rule starved by a change made
after its gate. Both are the same shape as the AC finding, and both were caught only because a
census was built after the fact.

## 2. Game feel, with the numbers designers actually publish

**Screen shake** (Eiserloh, GDC 2016, *Juicing Your Cameras With Math*; 3-0 on all three):

- Drive shake from a decaying `trauma` scalar in [0,1], not per-frame randomness. Events add
  `+= 0.2` to `+= 0.5`; trauma decays linearly; applied shake is `trauma^2` or `trauma^3`.
- The published mapping - trauma .30/.60/.90 gives 3%/22%/73% shake - is the **cubic** branch.
  Squared gives 9/36/81, so the exponent is a deliberate choice, not a detail.
- 2D and 3D recipes are not interchangeable. For 2D: rotational alone is "kinda lame",
  translational alone is "nice", **translational + rotational** is best. For 3D it inverts to
  rotational only.
- Use smoothed fractal (Perlin) noise as the driver, not uniform random: it feels better, it
  behaves correctly under pause and slow-motion, its frequency is adjustable, and it is
  reproducible on replay.

The last two properties matter here specifically: this game has hit-stop and slow-motion on a
Fever break (Gen 139) and deterministic replay (share codes, daily runs). A noise-driven shake is
a pure function of time, so it survives both; a random-per-frame shake survives neither.

The deck gives the curve shape and the per-event increment and **leaves `maxOffset` and `maxAngle`
as project tunables** - it publishes no magnitudes.

**Cascade audio** (Peggle 2, Audio Gang; 3-0 on both):

- What makes a cascade feel musical is **pitching hits as melody, not layering SFX**. Each
  successive peg hit plays the next step of an ascending diatonic scale chosen to harmonise with
  the music phrase *currently playing*, and the scale changes when the phrase changes - including
  mid-shot, while still continuing to ascend.
- The score is authored as a two-axis matrix - per-instrument stems crossed with short phrase
  chunks - not as linear loops. A single level advances through exactly **7 variable phrases**
  before resolving into the "Fever" win state or a lose stinger.

This repo already raises pitch per pair in a break (Gen 124) and layers shatter audio (Gen 128).
The part it does not do is key the scale to the music phrase and re-key it when the phrase turns.
Also worth noting: Peggle's terminal state is called Fever and is reached through seven phrases,
which is a close cousin of this game's own Fever tier and its chain ladder.

## 3. Accessibility, which has externally specified targets rather than judgement calls

Verified (3-0, merged from four claims):

- Steam has a **declarable store-page accessibility feature, "Camera Comfort"**, covering screen
  shake, camera bob and motion blur. It is satisfied either by offering a toggle or adjustment,
  **or by not using the effects at all**. Declarations are self-reported and unaudited.
- The Game Accessibility Guidelines list **"adjust the game speed"** as Basic (Motor), and **"do
  not make precise timing the only path"** - a rule this game touches wherever a window or a
  streak gates a reward.
- Xbox Accessibility Guidelines set **text minimums: 18px at 1080p on PC, scalable to 200%**.

The last one is a concrete gap: this repo's own rule (Gen 27) is a 12px minimum on the HUD, which
is below the cited guideline. XAG says "should" rather than "must" and is Microsoft guidance, not
a Steam or Xbox certification requirement - but the number is specific and the repo's is lower.

## 4. Process precedent

- **Ship a public playable build and iterate on mass feedback before committing to full
  production.** Four Quarters extended their Ludum Dare 45 jam build, released it on itch.io, and
  used hundreds of responses to fix balance, UI and UX before building Loop Hero proper. (3-0,
  medium confidence - a single-studio anecdote about a successful game.)
- **A mechanic added in the final week, after testing, generated launch bugs.** Loop Hero's
  bandits. (3-0.) The counterpart to the AC finding above: late content is content nothing has
  measured.
- **Content-pool scale, as one reference point only:** Slay the Spire 1.0 shipped 3 characters,
  250+ cards, 150+ items, 50+ combats, 50+ events, balanced by two developers over ~2.5 years
  including a year of Early Access. (2-1, medium.) It is an outlier endpoint and a survivorship
  case - not a scope target and not an upper bound.

## 5. What did not survive - do not plan against any of this

Angle 1, "which retention systems are proven rather than cargo-culted", produced **zero**
surviving claims. Refuted 0-3 each: that an endless mode established a durable concurrent-player
floor; that Steam's New & Trending supplied over 75% of launch-week impressions; that Early Access
buys extended New & Trending placement; that Ascension ladders plus Daily Challenge are the
standard difficulty stratification. **Meta-progression, endless modes, daily challenges and
difficulty ladders are unverified here.** This repo ships all four. Nothing in this research says
they are wrong - it says nothing supports them either, and the question the project most needs
answered was not answered.

Angle 5, launch readiness, produced nothing at all beyond the accessibility declaration surface:
no verified source on Next Fest timing, wishlist thresholds, store-page conversion, Deck
verification cost, achievement design, price points, or whether short sessions raise refund rate
inside the two-hour window.

Also refuted, and notable because they sound authoritative: four specific Xbox Accessibility
Guideline claims about disabling moving content, per-effect intensity sliders, the gameplay-core
exemption, and the tiering of colour-alone and reduced-motion guidance. The three XAG claims in
§3 survived; these did not.

Angle 2 produced **no verified numbers for hit-stop frame counts, easing curves, cascade step
timing, or particle budgets**. Angle 4 rests on a single studio, with no verified figure for a
per-floor generation budget, a synergy-density target, or the appearance rate below which a
mechanic counts as never firing - which is precisely the threshold `SYSTEM_OCCUPANCY_BANDS` picks
by judgement today.

## 6. Source age

The juice math is 2016; the Peggle audio 2014, about a 2013 title; the AC telemetry 2010/2014;
Loop Hero 2021; Slay the Spire 2019. All are durable craft and process precedent. **None is
2024-2026 market evidence**, which is what the market questions asked for.
