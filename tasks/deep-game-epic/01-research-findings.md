# Research findings that survived verification

Two deep-research passes on 2026-10-19 (104 and 107 agents; 25 claims each put through three-vote adversarial verification). Only findings that survived are listed. Refuted claims are listed so nobody re-imports them. Confidence labels are the verifiers'.

## Pass one: what makes a game compulsively replayable

| Finding | Confidence | Source |
| --- | --- | --- |
| **Competence and autonomy predict the wish to replay.** Within the same player, autonomy predicted preference for future play at beta .96 and competence at .65 (p < .01); achievement, social and immersion motives added nothing once those were in. | High | Ryan, Rigby and Przybylski, Motivation and Emotion 30:347-363, 2006 |
| **The near-miss effect is contested, not a foundation.** A 70-year review with new pigeon and human experiments failed to replicate it (Pisklak, Yong and Spetch 2020); a video-game experiment found near misses more boring than wins (Finseras et al. 2021). One Candy Crush study found a marginal effect (Larche et al. 2017). | Medium | J Gambling Studies 36:611-632; Int J Mental Health and Addiction 19:418-428 |
| **King tunes the whole difficulty curve as one object**, with a per-level engagement model over 15,000 Candy Crush levels. | Medium | GDC 2024, "Sugary Statistics"; Reguera, Wedekind et al., Scientific Reports 2020 |
| **Mobile retention medians** (GameAnalytics, 2024 data): D1 about 22% median, top quartile 26 to 28% (above 30% in 2025 data); D7 3.4 to 3.9% median, top quartile 7 to 8%; 75% of games under 3% at D28; sessions 5 to 6 minutes, 4 a day. | Medium to high | GameAnalytics Mobile Gaming Benchmarks 2025 and 2026 |
| **Regulatory cost of the compulsion toolkit.** FTC, January 2025: $20M HoYoverse order over misrepresented odds and layered currency sold to minors. EU CPC Network, March 2025: any non-adult game presumed to have under-18 players, real-money spend off by default, whale-based models under a stricter fairness test. | High | ftc.gov; CPC Network Ref. Ares(2025)2303808 |
| **Refuted (0-3):** the variable-ratio "highest sustained rate" and fixed-ratio "post-reward pause" derivations from Hopson's Behavioral Game Design; a genre retention ranking; a paraphrase of the near-miss study. | | |

## Pass two: how deep-run games make the late game different

| Finding | Confidence | Source |
| --- | --- | --- |
| **Goal gradient.** Effort accelerates as the *proportion* of distance remaining shrinks (interpurchase time fell 20% first to last stamp); illusory endowed progress (12-stamp card with 2 pre-filled) sped completion about 20% at identical real effort. | High | Kivetz, Urminsky and Zheng, JMR 2006 |
| **Post-reward reset.** Effort drops and quitting peaks immediately after a reward is earned; 17% of all defections happened right after one. | High | Same |
| **Progress must be new, not merely near.** A repeated near-miss revealing nothing new was less motivating and far more frustrating than a first near-miss (preregistered Wordle study, n=66). | Medium | Dixon et al., Scientific Reports 14:24336, 2024 |
| **Curiosity peaks at intermediate uncertainty.** People attend most to what they half-know; the fully predictable and the fully random both lose them (inverted U; replicated 2020, 2024). | High | Kidd and Hayden, Neuron 2015; Kang et al. 2009 |
| **One coefficient, named tiers, priced composition.** Risk of Rain 2 drives difficulty from one number (linear in time, x1.15 per stage), shows it as nine named tiers on a bar, and spends it on a priced spawn table (elites 6x) so late encounters are composed differently, not just larger. | Medium | riskofrain2.wiki.gg Difficulty and Directors (decompiled constants) |
| **A designed end, a build ceiling, evolutions, Endless as an unlock.** Vampire Survivors ends a stage at 30 minutes with the Reaper, caps builds at 6+6 so power must come from planned evolutions, and makes Endless and Limit Break explicit unlocks. | Medium | Wikipedia and fandom wiki, fetched 2026-10-19 |
| **One new verb, scripted troughs.** Tetris Effect's Zone (defer line clears, release as one) was chosen for adding something significant without altering pure Tetris; escalation runs in excitation-relaxation cycles. | Medium | Unreal Engine developer interview, October 2019 |
| **The hardest content is a post-win ladder.** Slay the Spire's Ascension opens after a clear, twenty rungs. | Medium | slaythespire.info |
| **Unlocks are guided tours.** Balatro's achievements, stakes, unlocks and challenges exist "to push players out of their comfort zone and explore the design". | High | LocalThunk, "Solitaire", localthunk.com, 26 February 2025 |
| **Boss drops throttled by tier.** Dead Cells boss blueprints drop in a fixed order with minimum Boss Stem Cell levels; beating a boss above the next drop's tier grants nothing extra. | Medium (2-1) | deadcells.wiki.gg Blueprint |
| **Required power meta is a failure mode** (opinion, contested). | Low | Bycer, Game Developer 2015 |
| **Refuted:** Dead Cells blueprint rarity tiers; Slay the Spire unlock score thresholds; the "layered near-miss" reading of Vampire Survivors. | | |

## Not covered by surviving evidence
Reward prediction error, flow, feedback timing; Balatro's ante maths and boss blinds; Hades Heat; Luck be a Landlord; Noita and Isaac; any GDC postmortem on late-game plateaus; unlock cadence numbers. The thesis document remains the source for those; do not cite this file for them.

## How the plan uses each finding
- Competence and autonomy: every verb is a skill (Hold, Carve, Echo), every act adds a choice.
- Goal gradient and post-reward reset: DGE-004 (fractions, pre-filled tracks, next milestone on the clear beat).
- New not near: DGE-002 (something new every act), DGE-007 (the results screen names what was new).
- Intermediate uncertainty: DGE-009 Wanderers with a trail, DGE-017 Layers; DGE-032's Goldilocks probe.
- One coefficient, named tiers, priced table: DGE-003.
- Designed end, build ceiling, evolutions, Endless unlock: DGE-005, DGE-013, DGE-014, DGE-006, DGE-023.
- One verb per act, troughs: DGE-008, DGE-015, DGE-019; breather floors kept in DGE-002.
- Post-win ladder, guided-tour unlocks, tier-gated drops: DGE-025, DGE-024, DGE-026.
