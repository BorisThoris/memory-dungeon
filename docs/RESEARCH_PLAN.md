# The fifteen research passes

The first research pass (recorded in `RESEARCH_NOTES.md`) answered three of five questions and
lost two entirely: everything about **what retention systems actually sell** and everything about
**launch readiness** was voted down 0-3. Those are the two questions this project most needs
answered, and they failed because the sources offered were dev-blog assertions rather than
measured evidence.

These fifteen passes are the second attempt, deliberately re-weighted. Two of them re-run the
questions that failed, with tighter sourcing demands. The rest are what the first pass did not
ask at all: **how specific comparable products handle specific systems**, named product by named
product, because "how does the market handle this" is answerable from primary design sources in a
way that "what sells" is not.

Each pass is fanned out, its claims extracted and adversarially verified 3-vote, and only what
survives is recorded. A refuted claim is recorded as refuted, because the first pass showed that
the most quotable claims are the ones most likely to die.

**Outcome (recorded after the fact):** the automated passes ran but their verification stage was
cut off by a service rate limit twice, so 368 claims came back unverified and only seven reached a
verdict (`RESEARCH_NOTES_2.md` §0). The passes were then redone by hand against primary sources.
That produced two documents: `RESEARCH_NOTES_2.md` for what was confirmed source-by-source, and
`MARKET_SURVEY.md` — nine comparable products measured against Steam's own published statistics,
which is the market half of the question and the part the automated passes never reached.

| # | Pass | Why this repo needs it |
|---|---|---|
| 1 | Puzzle-roguelike retention, with measured evidence only | Re-run of the failed angle. This game ships meta-progression, endless, dailies and a difficulty ladder on no verified basis. |
| 2 | Launch readiness for a small premium puzzle game | Re-run of the failed angle. Nothing survived on Next Fest, wishlists, conversion, Deck, pricing or refunds. |
| 3 | Memory and concentration games as a commercial genre | This game's core verb is memory, and the first pass never looked at whether that genre sells or how. |
| 4 | Chain systems in Puyo Puyo, Panel de Pon and Tetris Attack | Our chain ladder and tier names are modelled on these; nothing has checked the modelling against the originals. |
| 5 | Cluster pops and the drop in Puzzle Bobble | Our drop is dead (Gen 151). The genre it comes from solved this. |
| 6 | Peggle and Peggle 2 feedback, Fever and adaptive audio | Partly answered; the phrase-keyed melody finding needs its implementation detail. |
| 7 | Relic and synergy pools: Slay the Spire, Balatro, Luck be a Landlord | Pool sizing and synergy density, which the first pass got one endpoint for and no method. |
| 8 | Balatro in depth | The genre's 2024 breakout, and the closest living relative to a scoring-escalation puzzle roguelike. |
| 9 | Run and floor structure across the genre | How long a run is, how many floors, and how that is chosen rather than inherited. |
| 10 | Procedural generation budgets and mechanic-appearance guarantees | The exact failure of Gen 148: generation starved a shipped rule. Who solves this, and how. |
| 11 | Telemetry that detects a feature never firing | Expands the one finding that named this repo's failure shape. |
| 12 | Published numbers for cascade game feel | The first pass produced a shake curve and no hit-stop, easing, timing or particle numbers. |
| 13 | Accessibility as shipped in puzzle and match games | Specifications were found; how shipped games actually meet them was not. |
| 14 | Web-tech games shipping on Steam | This is an Electron game aiming at Steam and Deck. Nobody has checked what that costs. |
| 15 | Daily challenges and shared seeds across the genre | This game ships both; the first pass could not verify that either retains anyone. |
