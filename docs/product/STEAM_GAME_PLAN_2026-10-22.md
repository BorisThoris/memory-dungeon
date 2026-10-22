# Memory Dungeon plan for a replayable Steam game

22 October 2026. Proposed product direction, grounded in [the code and task audit](STEAM_PRODUCT_AUDIT_2026-10-22.md) of main `4bbbb057e`. Proposed targets below are decision rules for this project, not published industry benchmarks or measured retention results.

**Build a compact memory-cascade roguelite: remember a pair, choose where the detonation begins, and build a run that turns that choice into something spectacular. Prove that unfamiliar players deliberately do this and start a second run before expanding the late-game feature list.**

Suggested store sentence: “Remember your cards. Plan the chain reaction. Descend through a living dungeon, shape your build, and unleash the cascade that brings down the Warden.”

## The product to aim for

The audience hypothesis is people who enjoy compact tactical puzzles and short roguelite runs: players who want an understandable action with a surprising consequence, then a build to master. Test against that audience. Treat Pass and Play as a useful existing extra; the core commercial promise is solo Classic.

The distinctive selling points should be visible in actual gameplay:

1. **Memory becomes a shot.** Two known pairs are available; one starts a small break, the other reaches a chain across the room. Choosing the second is satisfying because the player understood enough to cause it.
2. **Holding changes the decision.** An immediate break buys safety; keeping several pairs for Release risks the stack for a larger planned payoff.
3. **A build changes what is worth remembering.** A light build opens in the middle to reveal routes; a chain economy build preserves links and gold; a Hold/Carve build lines up a release.
4. **The descent has landmarks.** Acts change the problem, bosses test a learned rule, and a clear win exists. Endless extends mastery after that win.

The game should be worth replaying because the next run supports a different plan, because the player sees how to improve, and because the inputs feel good. Random seeds, achievements, more floors and more particles are supporting tools; none guarantees that reason by itself.

Keep the owner's current rules: punishing earned/expiring misses; average-player Warden reach judged against the existing stated bar; Classic and local Pass and Play; no mandatory network; painted, living rooms; readable cards; combo-driven presentation that keeps climbing; reduced motion; no progressive combo music overlays; no cell-grid ground squares. Use existing Electron/shared-rules infrastructure.

## Make the first session teach the actual pleasure

| Beat | Player experience | Acceptance to observe |
| --- | --- | --- |
| First screen | The obvious action starts Classic quickly. Optional setup and reference material remain available. | A cold player reaches the first playable board without coaching. Record launch-to-input time; investigate delays over 30 seconds separately from asset loading. |
| First minute | Read a small board, recall a pair, see a meaningful cascade. Symbols teach pairing; elemental suit teaches the break. | Player distinguishes matching a symbol from merely choosing two cards of one suit. At least 10 of 12 cold testers cause a cascade unaided by 90 seconds. |
| Next few boards | A second remembered pair offers a visibly different cascade route. A real miss teaches the bank. | At least 8 of 12 explain one consequence of their chosen pair. Do not force a fake miss or fabricate a near win. |
| First camp | Choose immediate help, study/light, or chain investment; save gold is a legitimate option. | Player can state what they bought and what action it changes on the next floor. No silent evolution purchase or irreversible decline due only to being short of gold. |
| First meaningful defeat | The reason is clear and the next attempt has an achievable intention. | At least 10 of 12 identify why the run ended. Retry is one clear action, with same-key retry and fresh run distinguishable. |
| Act II | Hold has a short playable teaching moment and a visible Release result. | Player can demonstrate Hold/Release and explain the cost of missing while holding. Preserve floor-13 unlock until evidence justifies changing the live schedule. |

Use optional authored hall examples to demonstrate a future tool early without adding another mode or overwhelming the first live board. Never require reading the full Codex to play the opener.

Show causality in three steps: the pair matched, the connected clump broke, the remote partners/ripple followed. A brief, local “1 match → 5 popped” receipt can explain the payoff. Keep faces readable and input responsive. A preview may use public suit information and remembered/revealed knowledge; it must not leak hidden symbol identities or solve memory for the player. Give keyboard, pad, touch and reduced-motion users the same information.

## Build identity before build quantity

The current six-recipe list yields only two blueprint opportunities before the first Warden. Four sold relics fit four slots, and automatic camp tends toward buying a similar set. The vertical slice should change that practical choice space first.

### Prototype three understandable plans

| Plan | Start with existing systems | What the player should do differently | Main tradeoff |
| --- | --- | --- | --- |
| Recall | Long Look, Tallow Candle, Lantern of Recall | Open an inward pair, light useful neighbors, preserve positional information | Spend gold on information instead of immediate bank recovery or chain income |
| Chain economy | Gilded Chain, Deep Pockets, Miser's Vault | Take reliable pairs in sequence, protect the chain, keep a gold reserve for the eventual save | Build income and reserve rather than spend every camp on rescue tools |
| Planned release | Hold, Carve, Keystone Heart | Select seeds and direction, keep the stack, release before the board or bank collapses | Delay the immediate pop and accept that a miss loses part of the stack |

These are design examples using the current ingredients, not claims that all three are currently available before floor 60. Blueprint timing is part of the prototype. Keep the miss-bank punishment; create informed alternatives within it.

At the first eligible boss reward, offer a compact deterministic choice among live, relevant blueprint paths rather than always the next global list entry. A player should be able to plan one of the three payoff paths before the final boss. Show ingredient ranks, cost and the next opportunity, and allow saving toward it. Gate out recipes whose effects do not exist. A choice must not require discovering a wiki.

At every third-floor reward beat, implement the compact camp stop required by current owner instructions: buy an upgrade, buy help, or save. The current renderer auto-continues; a purchase screen is proposed work, not an already shipped surface. Keep automatic preference as an optional convenience with a visible preview. Any evolution offer should say exactly what is gained and spent; lack of funds is not consent to discard it permanently. Compare the resulting friction with the current automatic behavior rather than assuming that more choice always improves flow, and require the UI test to observe the camp instead of merely clicking Descend if it happens to appear.

The slice succeeds when three plans produce different pair/route/tool choices on the same test seeds and players can describe the difference. Do not count “three names, same safest move” as three builds. Expand to roughly 9–12 consequential upgrades only after those plans work; do not chase Replicat's item count.

## Give runs a shape that can be replayed

Keep the four-act Descent as the starting structure. Measure real wall-clock times before deciding whether sixty floors are the right length. Initial product hypothesis: an experienced successful descent fits roughly 30–45 minutes, with meaningful shorter learning runs. This is a pacing budget to test, not permission to slow players down or quietly soften the owner's survival target.

If the descent is too long, first remove redundant transitions, repeated low-decision boards and explanation delays. Only then test a more compact schedule. Preserve named landmarks and a clear victory. The current accelerated test pace is useful QA, but its fifteen-board route does not measure normal playtime.

Finish the Cartographer only after the first two acts and the builds pass their tests. Its lower-layer rotation must be taught and traceable; if players cannot reason about what moved, simplify it. The Keeper should read as room swaps, the Cartographer as an understandable layer transformation, and the Warden as the final Hold or calm-clear test. Bosses need their own rules and legible anticipation more than extra hit points.

Keep calm and harder Warden routes explicit. Before choosing the hard route, show the twelve-held-pair condition; do not reveal that requirement only after a long run reaches an endlessly rebuilding board. Test the hard path in the actual UI with a planned player. Do not reinstate the old design's mandatory evolved-relic check: the current rule deliberately allows a build without one.

Implement durable suspend/resume for a long run. Store a versioned stable run checkpoint, not just profile statistics. Restore the board, lower layer, held pairs, powers, bank expiry and remaining relative timers without giving a free memorize reveal or counting the same result twice. Provide recovery for unreadable or incompatible checkpoints. Start with safe transition/turn boundaries, clear the checkpoint on a committed run end, and test close/reopen plus an interrupted write. Ordinary pause is not this feature.

Endless should remain an earned continuation of Classic. Keep expanding challenge and presentation, but validate usable card size, camera navigation and memory decisions on real hardware. A solver's ability to clear 4,096 pairs does not make an 8,192-card screen a desirable product. Hold broad ultra-deep expansion until floors 60–120 have a tested experience budget.

## Give the next run a purpose

Use existing history, share keys, records, collection and Descent stats. Add a small coherent first set of 6–9 sideways feats, not thirty loosely connected chores. Examples: make a three-wave ripple, win through a Fold doorway, release a large Hold, beat a harder boss, finish with a chosen evolution. Reward a cosmetic or a clearly explained alternative within Classic, with no permanent stat advantage required to win.

After a run show one useful comparison and one next intention: “The Keeper moved your last known pair; try pinning it before turn four” or “You built Lantern of Recall; next run try a Hold blueprint.” Use actual event evidence; do not manufacture explanations. Include biggest deliberate release and build identity alongside score/depth. A fresh run and the same-key rematch should be easy to choose.

Add three to five optional difficulty rungs as Classic setup choices after the base game has been won, reusing vows and existing mutators. Each rung should change a decision and say so. This is a bounded version of DGE-025, not a new mode card or an automatic commitment to twenty rungs. Leave a weekly key as an optional later Classic convenience; the local WIP is not grounds to restore Daily mode.

Avoid expiry chores, login streaks, energy, paid power and hidden difficulty changes. A player should return because they want another attempt, and be able to leave and resume without losing their investment.

## Validate the hook with people

First run a six-person formative test with unfamiliar target players. Observe quietly; use the results to repair comprehension before collecting larger numbers. Then test with at least twelve new players. Friends who already know the design, omniscient solvers and an agent pressing tile IDs cannot substitute for this sample.

Capture a local, consent-based report: build/rules version, anonymous test-session key, run start, first input, first pop, first planned large pop, first miss, floor reached, choice offered/taken, blueprint/evolution acquired, Hold armed/released, boss outcome, run end, quit/suspend/resume and next run started. Export a bounded JSON/CSV file; never collect player names or paths for this purpose. A remote service is unnecessary for the first tests.

| Decision gate | Proposed bar | If it misses |
| --- | --- | --- |
| Understand the hook | 10/12 cold testers create a cascade by 90 seconds; 8/12 explain why their chosen pair was useful | Fix opener, preview and causal feedback; freeze late content |
| Own a build | 8/12 can describe their plan and make a corresponding purchase/pair decision; three viable plans observed across sessions | Fix camp and blueprint access; do not add recipes to cover it up |
| Choose another run | At least 7/12 voluntarily start run two within an unhurried 45–60 minute session, with no “please replay” instruction | Ask what stopped them, inspect run length and loss clarity, revise the loop |
| Return later | Invite the same players to optional access for a week; aim for at least half to return on another day | A small sample is diagnostic, not a retention forecast; collect reasons and iterate |
| Trust the game | No unrecoverable run loss/softlock in the test; players can explain death; close/reopen restores a checkpoint | Treat trust failures as blockers |

Always record denominators, audience, build and session constraints. A person who runs out of available time is censored, not automatically a gameplay rejection. Report assisted versus unaided behavior. These thresholds are internal go/no-go hypotheses, not statistical proof of market demand. Avoid changing three systems at once: compare explicit versus automatic camp with matched seeds and otherwise identical rules.

## One execution queue

Use this order as a release overlay on existing tasks. It replaces indiscriminate backlog completion; it does not reopen every historical ticket. Sizes are focused developer working days for scoping, excluding recruitment, art contracting, platform waiting and revision loops.

| Order | Slice and existing anchors | Concrete deliverable | Exit evidence | Size |
| --- | --- | --- | --- | ---: |
| 1 | Trust baseline, DGE-032/REG-087/REG-129 | Make unfinished simulation floors fail; distinguish measurement-only gates; remove inert offers and retired demo promises | Reproducing regression fixtures, meaningful nonzero regression bands approved against current measurements, demo/full contract test | 2–4 |
| 2 | Observation, DGE-028 | Bounded local test-session export and six cold-player sessions | Reproducible funnel with no personal data; ranked observed friction list | 2–3 + recruitment |
| 3 | First cascade, existing onboarding and DGE-008/029 | First-session path, causal receipts, readable Hold introduction and input closure | Twelve-player comprehension bar, keyboard/pad/touch/reduced-motion evidence | 4–7 |
| 4 | Build choice, DGE-013/014/026 | Explicit camp prototype, live blueprint choice/timing, three plans, visible recipe progress | Paired-seed strategy runs plus players choosing and describing distinct plans; no unaffordable auto-decline | 5–9 |
| 5 | Run trust, persistence/REG-040 | Versioned suspend/resume and safe checkpoint recovery | Close/reopen and interrupted-write tests across normal, Fold, Hold, Layers, boss and game-over transitions | 4–7 |
| 6 | Run shape, DGE-018/023/032 | Selected Act III boss, taught hard Warden, wall-clock pacing budget | Normal-paced human runs; real UI hard-Warden win; no hidden win condition; fair bank bar preserved | 5–9 |
| 7 | Replay purpose, DGE-024/025/007 | 6–9 feats, 3–5 optional Classic rungs, actionable results/rematch comparison | Voluntary second-run and return tests; deterministic difficulty and save normalization | 4–7 |
| 8 | Coherent presentation, DGE-029/030 | Final selected boss cues, live evolution icons, layer-rise readability, consistent audio/copy | Look at actual captures; preload/input/reduced-motion and pad checks; rights manifest | 4–8 |
| 9 | Sell the slice, REG-061/129 | Accurate demo/full ledger, store copy draft, readable capsule, actual-play trailer and screenshots | Cold viewers describe the hook; demo tests pass; owner-approved media package ready for Steam review | 4–7 |
| 10 | Ship safely, REG-060/115–119 | Steam-installed demo/full builds, real app IDs, partner setup, Cloud proof, minimum-hardware matrix | Release checklist with actual external evidence, full release gates at a pinned commit, rollback/hotfix plan | 4–7 + platform review |

The day ranges sum to 38–68 working days before feedback loops and external waits. Budget an initial two-week decision point around slices 1–3; stop new content if the hook fails. A plausible whole effort is roughly 10–16 focused development weeks with time for iteration, but a launch date should be set only after the replayable slice passes. Asset staffing and access to testers/Steam hardware can change the schedule materially.

Treat steps 3–7 as iterative experiments. A failed choice prototype may mean retaining automatic camp and choosing a build elsewhere; the required outcome is player ownership, not a particular menu layout.

## What to finish, defer and retire

**Finish for the selected v1:** DGE-018's boss if it earns its place; DGE-027 coverage; DGE-028 observation; DGE-029 copy for shipped features; DGE-030 selected final assets; DGE-032 honest gates; DGE-008 input/feedback exceptions; useful Fold/Layer readability fixes; REG-060/061 release work. Maintain schema/version discipline, saves, controller support and responsive fit.

**Reduce:** DGE-024 to a coherent first feat set; DGE-025 to a small Classic difficulty ladder. DGE-014 needs attainable, working evolutions before more recipes. Do not make finishing every original acceptance sentence a launch dependency when the owner has already accepted a different rule.

**Defer until replay evidence:** DGE-019 Echo, DGE-020 Sleepers, DGE-021 Spiral and DGE-022 adaptive rules. These stack complexity on top of already moving, layered boards; implement only if a named player problem justifies each one. Keep Echo Chamber unavailable while Echo is deferred. Also defer a priced Dread composition system unless curated scheduling is demonstrably failing, plus the full twenty-rung ladder and ultra-large Endless support.

**Retire as execution sources:** old dungeon locks/keys/traps/routes/combat/drafts, removed modes and their poster work, redundant screenshot-parity backlogs superseded by The Margin/current owner art instructions, and repeated stabilization prose. Preserve their history and useful regressions. Competitive online leaderboard development remains intentionally deferred; do not expand the optional global record into a launch requirement.

## Steam sales and launch plan

The first commercial test is whether a stranger understands and wants this specific cascade game. The closest direct comparison is [Replicat](https://store.steampowered.com/app/3509430/Replicat/): its store sells memory rule changes, builds and varied starting decks. Position Memory Dungeon around spatial chain reactions, Hold/Release and the living dungeon presentation rather than claiming an unoccupied genre. [Dungeon Clawler](https://store.steampowered.com/app/2356780/Dungeon_Clawler/) and [Shogun Showdown](https://store.steampowered.com/app/2084000/Shogun_Showdown/) are useful presentation/decision comparables, not sales forecasts.

Use **US$9.99 as a provisional price to test**, with $7.99 and $12.99 as comparison points in discussions about the finished slice. This is a positioning hypothesis, not a researched optimum or a promise of revenue. Current store prices vary by region and promotion; no USD competitor price was established by this audit's region-dependent page responses. Price against the experienced quality, variety and support burden, not the number of task cards closed.

Prepare a 30–45 second actual-play trailer draft: show the pair and first chain in the first five seconds, a different planned route, Hold/Release, a build changing the next decision, then a boss and a clear title/wishlist end card. Keep the gameplay readable at small size. Test the clip with cold viewers: can they say what they do and why they might replay? Produce a coherent, legible capsule; preserve the game's own art direction and document the rights/provenance of shipped assets.

Create a private reviewable store package first. Publish Coming Soon once the identity and core footage are stable and the owner authorizes publication. Begin small creator outreach only when explicitly authorized and when the demo supports what the clip promises. Match creators to puzzle/roguelite audiences. Record link clicks, store visits, wishlists and demo behavior by source; do not use view counts as demand. Test two clip openings before spending heavily on acquisition.

The demo should retain the essential match/cascade/build/boss arc and limit a truthful subset of content breadth. Preserve the current uncapped-run direction unless evidence changes that product decision. Re-audit deep mechanics in the demo: filtering mutators alone is not a complete content contract. Its full-game ledger must describe only actual, intended differences. Make the route to wishlisting clear after a satisfying payoff, without recurring interruptions. Valve supports a demo link to the full store page and requires that the full page be Coming Soon before an unreleased game's demo goes live ([Demos](https://partner.steamgames.com/doc/store/application/demos)).

Start the Steam administration track before the end of development. As checked on 22 October 2026, Valve's live [onboarding documentation](https://partner.steamgames.com/doc/gettingstarted/onboarding) lists a US$100-equivalent product fee and a **21-day** waiting period; its [Coming Soon documentation](https://partner.steamgames.com/doc/store/coming_soon) requires at least two public weeks before release. Some cached summaries still say thirty days. Confirm the account's actual release eligibility in Steamworks and leave schedule buffer. Valve asks for at least seven business days for review planning, with store and build reviewed separately ([Review Process](https://partner.steamgames.com/doc/store/review_process)).

Complete the real product/demo app IDs, depots and launch options, achievement names, presence tokens and Auto-Cloud configuration. Prove a save round trip on two machines before advertising Cloud. Test clean install, update over an old build, offline launch, overlay, controller reconnect, suspend/resume, graphics failure and save recovery. Test a modest integrated-GPU Windows machine; the development PC's RTX 3090 cannot establish minimum specs. Advertise Deck/controller compatibility only to the extent actually tested, and distinguish device testing from Valve's certification.

Review shipped AI-assisted artwork/audio/text against the current [Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey) and accurately disclose applicable generated content. The repo already includes generation pipelines, so provenance is a concrete release deliverable. The algorithmic daily music composer should be described according to how it actually works; do not equate procedural composition with a live AI service.

Do not predict sales from another game's reviews or set a magic wishlist launch threshold. Once the demo is live, use its actual funnel, qualitative feedback, acquisition sources and an explicit remaining-budget calculation to decide whether to launch, iterate or reduce scope. A game can pass every engineering gate and still fail that commercial test.

## The first implementation handoff

Begin with slice 1, then the observation/opener slices. Keep the runtime untouched until implementing those tasks deliberately. Its first change should be small and reviewable: honest demo promises, no inert purchases, and survival simulation failures that cannot silently advance an unfinished floor. Capture the baseline and use actual cold-player sessions to choose the next gameplay change. This produces evidence for the Steam product instead of another untested expansion pack.
