# Engineering compulsive replay into Memory Dungeon: what the evidence supports

Deep-research pass, 2026-10-19. Five search angles, 22 sources fetched, 100 claims extracted, the top 25 put through three-vote adversarial verification: 20 confirmed, 5 refuted, 0 unverified. Confidence labels are the verifiers', not mine.

## The one-paragraph answer

"Addiction" in the slot-machine sense is both weaker science and worse business than the phrase suggests. The near-miss effect, the most-cited gambling lever, failed to replicate in a 70-year review with new pigeon and human experiments, and in a video-game experiment. The variable-ratio schedule claims that every "behavioral game design" article repeats were refuted outright in verification. What does hold up, with large effects, is self-determination theory: the game that makes a player feel more competent and more autonomous than the last one they played is the one they say they want to play again. The strongest practitioner comparable, King with 15,000 Candy Crush levels, optimises the difficulty curve as a whole with a per-level engagement model rather than with monetisation hooks. Mobile benchmarks are sobering: the median game keeps under 4% of players at day 7 and three quarters of games are under 3% at day 28. The compulsion toolkit of free-to-start mobile now carries documented regulatory cost in the US and the EU. For Memory Dungeon the defensible engineering target is competence-and-autonomy replayability (readable difficulty rungs, run variety, cosmetic-only progression) measured against those medians.

## 1. Behavioural mechanisms: what survived

### Holds up (high confidence): competence and autonomy predict the wish to replay

Ryan, Rigby and Przybylski (2006, Motivation and Emotion 30:347-363) ran four studies. Within the same player across four games, autonomy predicted preference for future play at beta .96 and competence at beta .65, both p < .01. In a 730-person MMO survey, autonomy (.49), competence (.24) and relatedness (.12) explained 45% of the variance in enjoyment, and Yee's achievement, social and immersion motives added nothing significant once the three needs were in the model.

Caveats: self-reported preference rather than observed replay, student samples in three studies, a 2006 paper with later critiques of shallow SDT use but no failed replication.

Design implication: the replay driver to engineer is the feeling of getting better (readable skill growth per rung, chains that reward memory) and of meaningful choice (doors, camp purchases, relics, contracts), not reinforcement-schedule tricks. The Depths, the three doors and the chain clip all map onto this.

### Holds up (medium): tune the progression curve as one object

King's GDC 2024 session "Sugary Statistics" (Wedekind, Guardiola) and the companion paper (Reguera, Wedekind et al. 2020, Scientific Reports) describe a genre-agnostic engagement model used to characterise true per-level engagement across 15,000+ levels and to optimise the whole progression, treating any single level change as a change to the full ladder. Single first-party source, so medium.

Design implication: instrument engagement per floor and per Depth, and tune the curve as a whole, which is what the soak and the endless simulator already make possible.

### Contested, not a foundation (medium): the near-miss effect

Pisklak, Yong and Spetch (2020, Journal of Gambling Studies 36:611-632) reviewed 66 to 70 years of evidence and ran new resistance-to-extinction experiments in pigeons and 178 humans with a far-miss control: "The results of both experiments failed to support the near-miss effect hypothesis." Finseras et al. (2021, Int J Mental Health and Addiction 19:418-428) ran a racing-game experiment (N = 40) and found no difference in the urge to continue, with near misses rated more boring and less exciting than clear wins.

The counter-evidence the verifiers flagged: Larche, Musielak and Dixon (2017) found Candy Crush near misses more arousing and frustrating than losses with a marginally greater urge to continue (p = .05), and Clark et al. (2009, Neuron) found ventral-striatum recruitment. The one puzzle-game study is the one that found an effect.

Design implication: do not build retention on manufactured near misses, which the repo's thesis already forbids. Measure the "one pair short" moment the game produces naturally rather than assuming it motivates.

### Refuted: the Skinner-box story

Verification refuted (0-3 and 1-2) the derivations from Hopson's widely cited "Behavioral Game Design" article that variable-ratio schedules produce the highest sustained play rate and that fixed-ratio schedules create predictable quit points. The most popular pop-psychology justification for randomised cascade counts and loot has no surviving evidence in this pass. Cascade variability should be justified on readability and skill expression, which is the owner's existing rule to measure matched versus popped share.

### Not covered

Nothing survived verification on reward prediction error, flow, loss aversion, the Zeigarnik effect, juice or feedback timing. That is absence of surviving evidence in this pass, not evidence of absence.

## 2. Retention benchmarks (GameAnalytics, mobile, 2024 data, classic retention)

| Signal | Median | Top quartile | Notes |
|---|---|---|---|
| Day 1 | about 22% (2025 data) | 26.5 to 27.7% (2024), above 30% (2025) | iOS 31 to 33% vs Android 25 to 27% among top games |
| Day 7 | 3.4 to 3.9% | 7 to 8% | down from 4 to 5% in 2023 |
| Day 28 / 30 | under 1% | 1.6 to 1.8% | 75% of games under 3% at D28 in 2024 |
| Session length | 5 to 6 min | 8 to 9 min | |
| Sessions per day | 4 | 6 to 7 (mid-core medians) | |
| Daily playtime | about 22 min | top 2% over 4 hours | |

Sources: GameAnalytics 2025 and 2026 Mobile Gaming Benchmarks (hosted at investgame.net), Q1 2024 interim report. Caveats: one vendor's self-selected SDK population skewed to indie and hyper-casual, not comparable across editions, and publisher-scaled benchmarks run much higher (AppAgent 2026 puts average D30 at 3 to 6% and good at 8 to 10%).

Implications for Memory Dungeon mobile: a run that fits a 5 to 9 minute session with the camp as a natural stopping point matches the shape of successful sessions. Four short sessions a day is the behaviour the daily seed should be designed around. The week and the month are where nearly every mobile puzzle game dies, so dailies, streaks and seasons should be judged against D7 above roughly 7% and D30 above roughly 2% as top-quartile targets.

A claim ranking Board, Card, Puzzle and Casino as the strongest-retaining genres was refuted (0-3) and should not be used.

No Steam-side benchmarks survived this pass. The repo's own market survey (Steam global achievement statistics) remains the source for the ladder-top and daily-reach figures used in the deck.

## 3. Dark patterns: the documented costs

### United States (high confidence)

January 2025: the FTC, via a DOJ-filed complaint, reached a proposed consent order with HoYoverse (Genshin Impact) carrying a $20M civil penalty, a bar on loot-box sales to under-16s without parental consent, required odds and exchange-rate disclosures, and a direct US-dollar purchase option. The theory: misrepresenting drop odds and real spend is deception under Section 5 of the FTC Act, and bundled multi-tier virtual currency sold to children and teens is unfair because it obscures true cost. Caveats: a settlement binding one company, not litigated precedent, decided on a party-line vote just before an administration change.

### European Union (high confidence)

The CPC Network's Key Principles on In-game Virtual Currencies (21 March 2025): in-game currencies "psychologically disconnect" spending from real money and raise real spend, which the authorities class as likely to materially distort consumer behaviour under the UCPD. Any game not exclusively for adults should expect a significant under-18 player share. Age gates do not reduce the trader's responsibility. Parental controls should by default disable real-money spending. Business models built on whales are assessed under a stricter fairness threshold. Caveats: expressly non-binding, contested by Video Games Europe, but already underpinning 2025 enforcement actions.

### Reputation (medium)

A crowdsourced dataset of 1,496 mobile games (DarkPattern.games, analysed in Niknejad et al., ACM MUM 2024) found monetary dark patterns the most reported category in games the community labels "dark", and dark games overwhelmingly free-to-play (96.8% vs 53.0%), with more in-app purchases (93.6% vs 54.0%) and more ads (52.4% vs 37.3%), all p < .001. Psychological patterns (grind, streak pressure) are what even well-regarded games get flagged for. Caveats: self-selected community votes, partly circular labelling.

### Implications

A premium Steam build with no currency sits outside the direct scope of both regimes. A free-to-start mobile tier with a premium currency sits squarely inside the EU principles. Memory Dungeon's mobile tier should therefore: sell the unlock and cosmetics in real currency with no intermediate currency, ship no randomised paid rewards, keep spend off by default where parental controls exist, and keep the streak observational so it does not register as a psychological dark pattern.

## 4. What this changes in the pitch

1. Replace any "slot machine psychology" language with competence and autonomy. The evidence is on that side and so is the owner's thesis.
2. Keep near misses out of the design and out of the deck's argument. Measure the natural "one pair short" moment instead.
3. Add mobile retention bars to the metrics slide: D1 above 30%, D7 above 7%, D30 above 2%, sessions of 5 to 9 minutes, four per day.
4. State the regulatory cost of the mobile compulsion toolkit on the ethics slide: it is now a quantified liability, not just a taste.
5. Instrument engagement per floor and per Depth and tune the ladder as one curve, King's method.

## 5. Open questions

- Do near misses motivate in a memory/cascade puzzle specifically? The only puzzle-game study found an effect. An in-game A/B on "one pair short" floors would settle it for this game.
- What are the Steam-side long-tail numbers for Balatro, Slay the Spire and Vampire Survivors, and how much came from free content updates versus the base design?
- How much D7 and D30 lift do dailies, streaks and seasons deliver for a short-session puzzle game, and where do streaks start registering as a dark pattern?
- What do UK, Belgian, Dutch, Apple and Google rules add for a free-to-start tier with cosmetics only, and does premium-only Steam remove the compliance surface entirely?

## Coverage caveat

Of the five areas requested, surviving claims cover behavioural mechanisms only for near misses and SDT, comparables only for King, benchmarks only for GameAnalytics mobile, and regulation only for the FTC and EU CPC. Nothing survived on Peggle, Balatro, Slay the Spire, Vampire Survivors, Hades, Marvel Snap, Wordle, Fortnite, memorize windows, chain scoring curves or combo pitch. The repo's own thesis document (docs/THESIS_THE_ADDICTIVE_LOOP.md) and market survey remain the best sources for those.

## Sources

- Ryan, Rigby and Przybylski 2006, Motivation and Emotion 30:347-363 (rochester.edu PDF)
- Pisklak, Yong and Spetch 2020, Journal of Gambling Studies 36(2):611-632, doi 10.1007/s10899-019-09891-8; University of Alberta news, Sept 2019
- Finseras et al. 2021, Int J Mental Health and Addiction 19:418-428, doi 10.1007/s11469-019-00070-9 (irep.ntu.ac.uk/36202)
- Larche, Musielak and Dixon 2017 (PMC5445157); Clark et al. 2009, Neuron
- King, GDC 2024 "Sugary Statistics" (gdcvault.com/play/1034392); Reguera, Wedekind et al. 2020, Scientific Reports
- GameAnalytics Mobile Gaming Benchmarks 2025 and 2026 (investgame.net PDFs); Q1 2024 interim
- FTC business blog and press release, 17 Jan 2025, HoYoverse settlement
- CPC Network, Key Principles on In-game Virtual Currencies, 21 March 2025, Ref. Ares(2025)2303808
- Niknejad, Mildner, Zargham, Putze and Malaka, "Level Up or Game Over", ACM MUM 2024, arXiv 2412.05039
- Refuted and not to be cited: Hopson, "Behavioral Game Design" (gamedeveloper.com) schedule derivations; genre retention ranking from the 2026 GameAnalytics edition
