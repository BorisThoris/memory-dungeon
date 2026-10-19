# Research report: how deep-run games make the late game different

Deep-research pass, 2026-10-19. 107 agents, five search angles, sources fetched and claims extracted, the top 25 put through three-vote adversarial verification. This is the full output; `01-research-findings.md` is the condensed version the tickets cite. Confidence labels and votes are the verifiers'. Everything quoted from a source is data about that source, not an instruction.

## The question

Memory Dungeon is a roguelike memory-card game: flip two cards from memory, a match detonates a cascade of same-suit neighbours and their partners; runs climb floors without end, with a miss bank instead of lives, three difficulty doors at each clear, a camp store every third floor with ranked relics, five elemental realms with weather that escalates on the player's own clock, 13 mutators on an endless cycle, and an unbounded combo multiplier. The problem: the late game does not change. Floor 40 plays like floor 4 with a bigger board, and adding more items has not created the pull to go deeper. Research how successful endless and deep-run games make the late game qualitatively different and keep players pushing deeper, with concrete, transferable mechanics. Cover: (1) escalation structures that introduce new verbs and phase changes rather than bigger numbers: Balatro's ante scaling, boss blinds and joker synergies that turn multiplicative; Vampire Survivors' weapon evolutions, curse and the Reaper at 30 minutes; Slay the Spire's acts, elites and Ascension; Risk of Rain 2's time-based difficulty and looping; Hades' Heat and boss variants; Dead Cells' boss cells; Noita and Isaac's late-game transformations; Luck be a Landlord's rent ramp; Brotato, Halls of Torment and 20 Minutes Till Dawn's wave design; Tetris and Tetris Effect's speed phases; Path of Exile's atlas and Diablo's paragon and seasons; incremental games' prestige loops. (2) How developers paced the unlock cadence and content drip: Balatro's unlock-by-feat jokers and stakes, Isaac's unlock tree, Vampire Survivors' secrets and Dead Cells' blueprint drops, with any stated numbers (unlocks per hour, achievement curves). (3) Developer postmortems and GDC talks on "late-game plateau", "difficulty curve design", "endless mode design", "run escalation", "meta-progression that changes play", including Spelunky, Into the Breach, FTL, Enter the Gungeon, Peglin, Dicey Dungeons. (4) Research on novelty, goal gradients, curiosity and the "just one more" effect: Loewenstein's information gap, goal-gradient (Kivetz), the endowed progress effect, novelty and dopamine (Bunzeck and Düzel), and skill-challenge pacing; which hold up. (5) Transferable mechanics for a memory-cascade board specifically: board transformations (merging boards, multi-layer boards, rotating or scrolling boards, boards that grow during play), new card types that change the memory task (decoys, twins, migrating cards, cards that remember you), boss floors with rules of their own, synergy systems where relics multiply rather than add, run-defining choices at fixed depths, named milestones and thresholds the player can see coming, and endless-mode scoring that keeps a run worth continuing (Tetris's levels, Balatro's endless ante, Vampire Survivors' post-30-minute). Prefer developer blogs, GDC Vault, postmortems, Steam achievement data, and peer-reviewed psychology.

## Summary

The evidence that survived verification points to one consistent answer: successful deep-run games make the late game different by adding verbs and phase changes on a visible schedule, not by inflating numbers, and they keep players pushing with goal structures whose psychology is well documented. Risk of Rain 2 drives everything from one compounding coefficient (linear in time, x1.15 per stage) but turns it into named tiers the player can see and into a qualitative shift in encounter composition (elite packs, out-of-event bosses); Vampire Survivors hard-stops the run at 30 minutes with the Reaper, caps the build at 6+6 so growth has to come from planned evolutions, and only then offers Limit Break and Endless as explicit opt-ins; Tetris Effect added one new verb (Zone, deferred line clears) and a deliberate excitation-relaxation cycle; Slay the Spire and Balatro place the hardest content on a post-win ladder and use unlocks as guided tours of the design space. On the psychology side, the goal-gradient literature (Kivetz 2006) shows effort rises as the proportion of distance remaining shrinks, that endowed progress works even when real effort is identical, and that quitting peaks just after a reward is earned; the 2024 Wordle study adds that nearness alone is not enough: progress must feel new, since a repeated near-miss frustrates rather than motivates, and curiosity research shows interest peaks at intermediate uncertainty. For Memory Dungeon the transferable plan is: a visible, named escalation ladder that changes what spawns rather than how much; hard phase changes at fixed depths (a Reaper-style floor, boss floors with their own rules); a build ceiling that forces synergy-based transformations rather than more relics; unlock-by-feat content that steers players into unexplored mechanics; and chaining each milestone's reward directly into a pre-filled next goal to defeat the post-reward reset.

## Findings

### 1. Goal-gradient effects are real and sizeable in the field: effort accelerates as the proportion of distance remaining to a goal shrinks (about 20% faster interpurchase toward the end of a reward card, 16% faster completion overall), the effect is driven by proportional not absolute distance, and illusory 'endowed' progress (a 12-stamp card with 2 pre-filled) speeds completion about 20% with identical real effort.

**Confidence:** high. **Vote:** 3-0 (claims 0, 1, 3 merged).

**Evidence.** Kivetz, Urminsky & Zheng (JMR 2006), peer-reviewed field data with controls: cafe reward program (interpurchase time fell 20% first-to-last stamp; 24.6 vs 29.4 days card completion), randomized 12-stamp-with-2-bonus experiment (12.7 vs 15.6 days, p<.05), and a 148-member music-rating program where visits, ratings per visit and persistence all rose as proportional distance fell (p<.01). Corroborated by Nunes & Dreze (2006) endowed progress. Transfer: show floor progress as proportion toward a named milestone, and open each new milestone track with pre-filled progress (e.g. 'Depth 10: 2 of 10 floors already banked').

**Sources.**
- https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf

### 2. Effort resets to a lower level immediately after a reward is earned and quitting is most likely at that moment (postreward resetting), so the beat right after a floor clear, store stop or milestone is the highest-risk point for a player to end the run.

**Confidence:** high. **Vote:** 3-0.

**Evidence.** Same JMR 2006 study: 'purchase and effort rates reset (to a lower level) after the first reward is earned and then reaccelerate toward the second... customers... were also most likely to defect' just after reward attainment; 17% of all visit terminations in the music program occurred at distance = 1.0 (just after reward). Correlational field pattern, not an experimental manipulation of defection. Transfer: never let a milestone end on a blank slate; the floor-clear/store beat should already display the next named threshold with progress toward it, and Descend should be the path of least resistance.

**Sources.**
- https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf

### 3. Raw proximity to a goal is not enough: progress feedback motivates only when it feels like new approach. In a preregistered Wordle lab study, approach outcomes raised motivation and positive affect over thwarted ones (motivation diff 0.683, t=5.30; affect diff 1.446, t=9.43; frustration t=-8.00, all p<.001), a first-time near-miss raised affect above earlier progress guesses, and the objectively closest outcome (a repeated near-miss revealing nothing new) was less motivating than a first near-miss (diff 0.830, t=4.69, p<.001) and far more frustrating (t=-10.55).

**Confidence:** medium. **Vote:** 3-0 (claims 4, 5, 6 merged).

**Evidence.** Dixon et al., Scientific Reports 14:24336 (Oct 2024), n=66 undergraduates with complete data, within-subject, preregistered, Tukey post-hocs; the authors conclude 'whether one sees classic goal-gradient effects on motivation seems to depend on emotion'. Single lab study with self-report scales; SCR hypothesis not confirmed; 'novelty' is a paraphrase of their approach/thwarted coding. Transfer for a memory game: a late-game floor that merely repeats the same board at larger size is a 'thwarted near-miss' generator; each depth band must reveal something new (a card type, a rule, a board shape) so dying near a threshold reads as new progress rather than repetition.

**Sources.**
- https://doaj.org/article/cdde8b4e865c4a929ed8887df870cf17
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11487082/

### 4. Curiosity and attention peak at intermediate uncertainty: people are most curious about answers they partly know but are not sure of (inverted-U in confidence, Kang et al. 2009, replicated 2020 and 2024), and learners including 7-8-month-old infants attend most to stimuli of intermediate information content, looking away from both the fully predictable and the fully surprising.

**Confidence:** high. **Vote:** 3-0 (claims 7, 8 merged).

**Evidence.** Kidd & Hayden, Neuron 2015 review, summarizing Kang et al. (Psych Science 2009), Kidd, Piantadosi & Aslin (PLoS ONE 2012, Goldilocks effect) and later replications (Dubey & Griffiths 2020; Spitzer et al. 2024). Boundary conditions: information importance can shift the peak; infant data largely from one lab. Transfer: a memory task is pure confidence-about-hidden-state, so the design target is boards where the player half-remembers (partial reveals, migrating cards, lantern light) rather than boards that are either fully solved or fully random; late-game escalation should raise uncertainty to the intermediate band, not to chaos.

**Sources.**
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4635443

### 5. Risk of Rain 2 shows how a single compounding number can still produce qualitative late-game change: difficulty is one global coefficient (linear in minutes, x1.15 per stage cleared, so exponential across loops), surfaced to the player as nine named tiers on an on-screen bar (Easy ... Impossible, I SEE YOU, I'M COMING FOR YOU, HAHAHAHA, capped at ambient level 99) with two notches each, and because spawn-director credits scale linearly with the coefficient while elites cost 6x (36x for Malachite/Celestine) and 'too cheap' groups are skipped, high coefficient shifts encounter composition toward elite packs, mini-bosses and out-of-event Teleporter bosses.

**Confidence:** medium. **Vote:** 3-0 (claims 11, 12, 13 merged).

**Evidence.** Community wiki transcribing decompiled Run.RecalculateDifficultyCoefficentInternal and director code; constants cross-checked between two pages and against GameWith/PCGamesN descriptions. Caveats: Eclipse modifiers and Artifacts sit outside the coefficient; level 99 caps ambient level not the coefficient; current build keeps a floor so cheap enemies become rare rather than vanishing. Transfer: Memory Dungeon's floor count can drive one 'dungeon coefficient' that (a) is shown as named, foreshadowed tiers on the HUD, and (b) buys from a priced spawn table where expensive card types and mutator stacks become the only affordable spends past a threshold, so floor 40 is composed differently from floor 4 rather than only larger.

**Sources.**
- https://riskofrain2.wiki.gg/wiki/Difficulty
- https://riskofrain2.wiki.gg/wiki/Directors

### 6. Vampire Survivors structures a run around hard phase changes and a build ceiling rather than a numeric ramp: stages have a soft limit of 15, 20 or 30 minutes after which all enemies are cleared and the Reaper spawns, with one more Reaper every further minute so the run is designed to end; weapon evolutions require a fully upgraded weapon paired with a specific passive (often maxed) and arrive only via a chest, forcing planned builds; the build is capped at six weapons and six passives, after which level-ups give only gold or healing; Limit Break and Endless mode are the explicit, unlocked mechanisms that remove the build ceiling and the time limit respectively.

**Confidence:** medium. **Vote:** 3-0 (claims 14, 15, 16 merged).

**Evidence.** Wikipedia (fetched 2026-10-19) states each element verbatim, corroborated by the fandom wiki, Prima Games and Steam threads. Caveats: Endless mode replaces Reapers with a looping wave timer (+100% HP, +50% spawn, +25% damage per cycle); the Reaper can be killed with specific builds; the 20-minute cap stage was not independently confirmed; a few DLC gifts relax evolution conditions. Transfer: give runs a designed end-state (a 'Reaper floor' at a fixed depth that clears the board and introduces an unbeatable pursuer unless a planned build exists), cap relic slots so late power must come from relic 'evolutions' (relic + specific second relic at rank max, delivered at the store) rather than more items, and make 'endless' a separately unlocked mode with its own cycle scaling.

**Sources.**
- https://en.wikipedia.org/wiki/Vampire_Survivors

### 7. The 30-minute cap has been framed by an academic as a near-miss generator (every run that fails to reach 30 minutes feels like a near win, driving 'one more go'), and designer Luca Galante did bring prior gambling-industry experience to the game; but the near-miss reading of the timer is the article author's interpretation, not documented designer intent.

**Confidence:** low. **Vote:** 2-1.

**Evidence.** The Conversation (Peter Howell, Univ. of Portsmouth, Apr 2023); Galante's gambling background corroborated by a 2022 news.com.au interview, but his stated gambling influence concerns chest-opening animations, not the timer, and reaching 30 minutes counts as a clear. Split 2-1 vote. Transfer only as a hypothesis: fixed, visible depth thresholds make a death at floor 28 read as 'almost 30'; combine with the Wordle finding so the near-miss carries new information rather than repetition.

**Sources.**
- https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613

### 8. Tetris Effect's late-game feel comes from deliberate pacing and one added verb: visuals and music ramp up and down in a designed cycle of excitation and relaxation to induce flow, at times overstimulating as an added challenge (with a settings opt-out), and the Zone mechanic (a meter that stops time and defers completed line clears) was selected from many time-manipulation prototypes with the explicit constraint of adding something significant without altering 'pure' Tetris.

**Confidence:** medium. **Vote:** 3-0 and 2-1 (claims 9, 10 merged).

**Evidence.** Unreal Engine developer interview (Oct 2019) with Enhance's Mark MacDonald and Monstars' Takanori Uchida, verified via search snippets (site blocks fetches); opt-out corroborated by PlayStation Store accessibility listing and Game Informer; Zone behaviour corroborated by PlayStation Blog and tetris.wiki. The Zone claim passed 2-1 and 'for veterans' slightly overstates the source ('newcomers and long-time players alike'). Transfer: Memory Dungeon's realm weather and music already escalate on the player's clock; the lesson is to script relaxation troughs between escalation peaks and to add one new verb per depth band that layers on top of flip-two-cards without changing it (e.g. a Zone-like meter that holds detonations until released for a mega-cascade).

**Sources.**
- https://www.unrealengine.com/en-US/developer-interviews/how-tetris-effect-became-a-modern-work-of-art

### 9. Slay the Spire places its hardest content on a post-win ladder: Ascension Mode unlocks only after clearing the game with a character and offers 20 chained levels, each trading added difficulty for a larger score bonus, so difficulty escalation is an opt-in ladder the player climbs one rung at a time rather than part of the base run.

**Confidence:** medium. **Vote:** 3-0.

**Evidence.** Blog (2025) corroborated by Highground Gaming, PocketGamer and the TrueAchievements 'Ascend 20' achievement; older Steam threads describe pre-1.0 rules. Act 4 (the Heart) is additional post-win content; +5% score per level not in the quote. Transfer: Memory Dungeon's three difficulty doors could become a persistent ladder (clear depth N on door X to unlock door X+1 for that realm), each rung adding a named rule change rather than only a multiplier.

**Sources.**
- https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/

### 10. Balatro's achievements, stake levels, unlocks and challenges were added deliberately as guides to push players out of their comfort zone and explore the game's design, and as an optional checklist for players who already enjoy the loop, not as artificial playtime padding.

**Confidence:** high. **Vote:** 3-0.

**Evidence.** LocalThunk's own blog post 'Solitaire' (26 Feb 2025) states the two reasons verbatim; Gigazine is a faithful summary. 'Design space' paraphrases 'the design of the game'. Transfer: gate new relics, mutators and card types behind feats that require using an under-used mechanic (e.g. 'detonate a 12-card cascade in the storm realm' unlocks the next storm-only relic), so the unlock tree itself teaches the late game.

**Sources.**
- https://gigazine.net/gsc_news/en/20250228-balatro-vision-solitaire
- https://localthunk.com/blog/solitaire

### 11. Dead Cells throttles its boss content drip by difficulty tier: bosses drop blueprints in a fixed order with minimum Boss Stem Cell levels (outfit series ending at 1+, 2+, 3+, 4+ BSC), one blueprint per kill, and beating a boss on a higher difficulty than its next drop requires grants nothing extra, so the player is nudged to push difficulty one step at a time.

**Confidence:** medium. **Vote:** 2-1.

**Evidence.** Wiki page fetched and corroborated by a fan boss-loot guide and the BSC wiki page. Scope caveats: applies to boss blueprints only (most enemy/secret blueprints are available at 0 BSC), and repeated kills are a second throttle. Split 2-1 vote. Transfer: tie boss-floor rewards to a per-door/per-depth minimum so skipping ahead yields nothing extra, keeping the ladder climbed rung by rung.

**Sources.**
- https://deadcells.wiki.gg/wiki/Blueprint

### 12. Meta-progression that is required to win or go far (Rogue Legacy, Shattered Planet) is classed by critic Josh Bycer as a failure mode: players grind runs to feed the meta layer rather than playing 'for real', so permanent power unlocks should not be the mechanism that makes the deep game reachable.

**Confidence:** low. **Vote:** 3-0.

**Evidence.** Game Developer blog (Bycer, June 2015), an opinion piece; Rogue Legacy was commercially successful and Hades later made required-ish meta work, so it is contested as a universal rule, though community discussion distinguishes criticised power progression from accepted sideways unlocks. Transfer: keep Memory Dungeon's meta unlocks sideways (new card types, mutators, realms, relic variants) rather than stat boosts needed to survive floor 40.

**Sources.**
- https://www.gamedeveloper.com/design/the-pitfalls-of-meta-game-design

## Refuted claims (do not cite)

- Dead Cells distributes its roughly 256 blueprints across five drop-rate tiers: Always (100%, 104 blueprints), Common (10%, 33), Uncommon (1.7%, 53), Rare (0.4%, 64) and Legendary (0.03%, 2), so most of the unlock pool is deliberately rare rather than evenly dripped. (vote 0-3; source https://deadcells.wiki.gg/wiki/Blueprint)
- Near-miss framing extends beyond the time cap to layered sub-goals: players who die may have been close to a level-up, a chest, or an achievement, so multiple overlapping progress bars ensure some goal is always almost reached at run end. (vote 0-3; source https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613)
- Slay the Spire gates card, relic and character unlocks behind cumulative per-character run score thresholds at 300, 750, 1000, 1500 and 2000 points, alternating cards and relics, so unlocks arrive on a fixed drip regardless of whether a run is won. (vote 1-2; source https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/)

## Caveats

Coverage is narrower than the research brief: no verified claims survived for Balatro's ante scaling or boss blinds, Slay the Spire's acts/elites, Hades Heat, Noita/Isaac transformations, Luck be a Landlord, Brotato/Halls of Torment/20 Minutes Till Dawn, Path of Exile/Diablo seasons, incremental prestige loops, or any GDC/postmortem on 'late-game plateau' (Spelunky, Into the Breach, FTL, Gungeon, Peglin, Dicey Dungeons); claims about unlock cadence numbers (Slay the Spire score thresholds, Dead Cells rarity tiers) and the layered near-miss framing were refuted. The psychology findings are strong but come from two sources: Kivetz 2006 (field data, well replicated in direction, exact magnitudes are single estimates; redeemers-only means) and the single 2024 Wordle lab study (n=66 undergraduates, self-report, deviation from preregistration). Game-mechanics claims rest mostly on secondary sources (Wikipedia, community wikis, guides) that transcribe decompiled code or stable rules; they are current as of October 2026 but Vampire Survivors and Risk of Rain 2 continue to receive patches. The Vampire Survivors near-miss framing and the Bycer meta-progression critique are interpretations, not developer testimony or data. Two claims (Tetris Zone origin, Dead Cells BSC gating) passed only 2-1.

## Open questions

- What unlock cadence (unlocks per hour or per run) do Balatro, Isaac and Vampire Survivors actually deliver, and is there any public achievement-curve data showing where players stop climbing stakes or ascensions?
- Do developer postmortems (Spelunky, FTL, Into the Breach, Dicey Dungeons) report a measured late-game plateau and what structural fix moved retention: new verbs, boss rules, or scoring changes?
- Does the goal-gradient 'proportional distance' model survive in games where the goal is open-ended (endless modes) rather than a fixed count, and does the Bonezzi midpoint dip appear in run-length data?
- For a memory-cascade board specifically, which transformation (multi-layer boards, migrating cards, decoys) keeps uncertainty in the intermediate 'Goldilocks' band at 768 to 4096 pairs rather than collapsing into either rote or chaos?

## Sources consulted

- https://gmtk.substack.com/p/balatros-cursed-design-problem (blog)
- https://www.gdcvault.com/browse/gdc-19/play/1025731 (primary)
- https://riskofrain2.wiki.gg/wiki/Difficulty (secondary)
- https://gamespot.com/articles/hades-changes-what-it-means-to-be-a-roguelike/1100-6483420/ (unreliable)
- https://bugnet.io/blog/how-to-design-a-roguelikes-run-structure (blog)
- https://en.wikipedia.org/wiki/Vampire_Survivors (secondary)
- https://deadcells.wiki.gg/wiki/Blueprint (secondary)
- https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/ (blog)
- https://gigazine.net/gsc_news/en/20250228-balatro-vision-solitaire (secondary)
- https://www.gamedeveloper.com/design/the-pitfalls-of-meta-game-design (blog)
- https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613 (secondary)
- https://store.epicgames.com/news/darkest-dungeon-2s-metagame-reboot-was-expected-and-necessary (unreliable)
- https://www.gdcvault.com/play/1025731 (primary)
- https://www.gdcvault.com/play/1026333 (unreliable)
- https://www.gamedeveloper.com/design/design-lessons-from-spelunky (blog)
- https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf (primary)
- https://doaj.org/article/cdde8b4e865c4a929ed8887df870cf17 (primary)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4635443 (primary)
- https://d3nji.itch.io/witch-way (blog)
- https://www.unrealengine.com/en-US/developer-interviews/how-tetris-effect-became-a-modern-work-of-art (primary)
- https://reddit.rtrace.io/r/pathofexile/comments/op73wg/some_thoughts_from_chris (unreliable)
- https://us.forums.blizzard.com/en/d3/t/please-no-infinite-scaling-in-d4/7883 (forum)
- https://www.icy-veins.com/d4/news/why-paragon-may-be-a-bigger-problem-than-diablo-4s-skill-tree/ (unreliable)
- https://gamedev.net/blogs/entry/2294544-how-to-set-up-pacing-difficulty-and-progression-within-an-infinite-metagame (blog)
