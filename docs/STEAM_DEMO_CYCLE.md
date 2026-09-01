# Steam demo cycle: research and repo-grounded plan

**Date:** 2026-09-01
**Method:** fan-out web research (5 angles, 18 sources fetched, 89 claims extracted, 25 put through
3-vote adversarial verification, 15 killed) plus direct verification against this repository at
`828190e`. Every repo claim below was checked by reading the code, not by trusting prior review notes.

**Fills:** `tasks/refined-experience-gaps/REG-129-demo-versus-full-build-content-matrix.md`, which is
marked Done but contains only process boilerplate — no actual matrix. The matrix is in §4.

---

## 0. The one-paragraph answer

Ship **one mode, one uncapped run arc, a deliberately thin loadout**. The evidence for capping a
roguelite demo by *breadth* (modes, relics, mutators) rather than by *length* (floor caps, run
caps) is the strongest finding in this research, and it converges from three independent
directions. But this repo cannot ship anything today: `main` does not compile, and the single
number that will decide whether the demo reads as a memory game or a coin-flip — the memorize
window — is currently on a curve that *shrinks* as the board *grows*. Fix the build, fix the
curve, then gate content. In that order.

---

## 1. What the research actually supports

Confidence labels are the verifier's, not marketing gloss. Read §2 before acting on any of it.

### 1.1 Cap by breadth, not by run length — HIGH confidence

Valve's own demo documentation frames a demo as "a small playable portion of your game that show
some of the core mechanics and leave the player excited for more."
([Steamworks: Demos](https://partner.steamgames.com/doc/store/application/demos))

The closest shipped comparable to this project is **Replicat** — a memory-matching roguelite
deckbuilder, released 2025-11-18, Very Positive. Its demo advertises "21 levels of escalating
challenge" and "5 card colors": figures **identical to the full game's store page**. The 21 levels
are not a truncation. What the demo *does* cap is breadth — 1 starter deck of 10, 55 cards of 90+,
50 curios (relic-equivalents) of 80+, 4 essence categories of 5, no Endless Mode. The arithmetic on
its "full game will include" ledger reconciles exactly (55+40, 50+30, 14+4), which indicates a real
content ledger rather than vague copy.
([Replicat Demo](https://store.steampowered.com/app/3706490/Replicat_Demo),
[Replicat](https://store.steampowered.com/app/3509430/Replicat))

Independent convergence from **Balatro**: LocalThunk's own timeline records shipping a
50-round-limited demo in May 2023, watching players (Northernlion among them) blow straight through
it, and reversing: *"The plan now is to make the demo content limited instead of round limited. This
means that players can play as much as they want, which is much more sensible."*
([localthunk.com timeline](https://localthunk.com/blog/balatro-timeline-3aarh))

Three sources, three directions, one answer. This is the finding to build on.

### 1.2 Disclose what is locked — MEDIUM confidence, n=1

Replicat's demo page carries an explicit "The Full Game Will Include" ledger. The demo holds Very
Positive (94% of 67); the full game 99% of 213. That is evidence the practice *works*, not evidence
it beats hiding content — no comparative or A/B data exists. Treat as a reasonable default, not a
proven lift.

### 1.3 Playtime: aim 20–40 min median, then discount it — MEDIUM, and internally contested

Zukowski's 2022 survey (130 demos, 62 released games bucketed by revenue) gives median demo
playtimes of 7 / 18 / 38 / 65 minutes across Bronze / Silver / Gold / Diamond revenue tiers.
Mark Brown independently advises 30–90 minutes, with his own Word Play demo at ~1 hour.
([howtomarketagame](https://howtomarketagame.com/2022/10/26/what-is-a-good-median-play-time-for-a-demo-benchmark/),
[GMTK](https://gmtk.substack.com/p/how-to-make-a-great-steam-next-fest))

**Honest caveat: the verification pass was split against itself on these numbers.** The synthesized
finding carries them at medium confidence, but separate verification rounds voted the same tier
figures down 0–3 when extracted from `howtomarketagame.com/benchmarks/`. Independently of that
split, the data is: correlational only (the author asks whether high playtime means success and
never answers), ~12 games per tier, revenue estimated from review counts, 2022 and therefore
predating Valve's 2024 demo overhaul, and — by the author's own warning — **inflated for roguelikes
and procedurally generated games** (replayable 18.5 min median vs linear 14 min).

Use 20–40 minutes as a *sanity floor*, not a target. Do not pad the demo to hit it.

### 1.4 Do not plan on save carry-over for a pre-launch demo — HIGH confidence

Valve documents demo→full save carry-over as first-class, via a "Shared cloud APP ID" partner field,
and explicitly recommends the pattern for achievements: *"We recommend that you disable achievements
in demos. Instead, store the saved game in the shared Steam Cloud... Then grant those achievements on
loading the game in the full game after the user has purchased."*

**But the same document states that "trying to use shared cloud data with an unreleased target/base
app will not sync those files and is not a recommended setup."** A Valve-tracked Linux client bug
exists on this exact path. For a demo shipped months before launch — i.e. the normal case, and the
one this project is in — carry-over is unusable during the pre-release window.
([Demos](https://partner.steamgames.com/doc/store/application/demos),
[Cloud](https://partner.steamgames.com/doc/features/cloud),
[steam-for-linux#12924](https://github.com/ValveSoftware/steam-for-linux/issues/12924))

Actionable consequences for this repo: **turn achievements off in the demo build** (they are already
behind a main-process adapter, so this is a flag, not a refactor), keep demo saves local, and treat
retroactive achievement granting as launch-window work.

### 1.5 Ship the demo early and keep patching it — MEDIUM confidence

LocalThunk on Balatro's pre-release demos: *"They were instrumental. This game really became the
strategy game it is now because of the iteration I was able to do with the community over time."*
([TouchArcade interview](https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/))

The often-quoted "2.5x more wishlists when the demo launched well before Next Fest" survives
verification only 2–1, at r = −0.205 — a weak coefficient, confounded by the fact that games with
early demos also have longer runways and bigger audiences (pre-fest wishlist count correlates at
r = 0.825). **Ship early for iteration time, which is the author's own stated rationale — not for an
assumed algorithmic multiplier.**

### 1.6 The run-end CTA is unmeasured — LOW confidence, mostly a negative finding

Every specific published number about demo CTAs was **refuted 0–3** for tracing to SEO/AI-flavored
aggregators carrying unattributed figures: the "end screen > pause menu > main menu" placement
ranking, "15–25% healthy demo-to-wishlist conversion," "omitting an in-demo wishlist prompt costs
5–10 percentage points," "under 40% completion means the demo is too long," and "a polished
30-minute demo outperforms a rough 2-hour one 3:1." **Do not build a plan on any of these.**

What *is* well sourced is that the target metric is noisy. GameDiscoverCo: *"the performance range
of 'wishlists at launch' compared to 'sales at the end of Week 1' varies by 10-20x, not 10-20%."*
Gamalytic's independent ~700-game dataset gives first-month conversion of 0.06 at p10, 0.27 median,
1.34 at p90 — a ~22x spread from different data and methodology.
([GameDiscoverCo](https://newsletter.gamediscover.co/p/the-state-of-steam-wishlist-conversions),
[Gamalytic](https://gamalytic.com/blog/exploring-steam-wishlist-sale-ratio))

Put a wishlist CTA on the run-end screen because it is the obvious place, not because data says so.
Spend the effort saved on the run itself.

### 1.7 Memory-as-premium-loop: depth from modifiers, not from memorization — LOW confidence, n=1

Replicat carries a premium PC memory-matching roguelite on 5 mechanically distinct card colors, 90+
cards including "reality-breaking Jokers," 80+ curios that "redefine how you match and strategize,"
and boss stages each with "its own game-changing modifiers." Depth lives in **build variety and rule
modification**, not in recall span or grid size.

**This directly validates the direction this repo already took** — relics, mutators, findables,
hazards, route choice, side rooms — and it indicts the memorize curve described in §3.2.

**Critical gap: no source in the entire research set addresses cognitive-load limits, working-memory
span, session fatigue in memory games, or how memorization tedium scales with grid size.** The
attempted second genre comparable (Pairs & Perils) was refuted 0–3 on both claims. Anything asserted
on those points is extrapolation. §3.2 therefore rests on arithmetic from this codebase, not on
borrowed research, and its fix needs playtesting.

---

## 2. What to distrust in §1

- **Source-quality asymmetry is the headline caveat.** Everything *descriptive* is strong: Valve's
  docs, Replicat's store pages. Everything *causal* — does capping by breadth convert better, does a
  longer demo cause revenue, does an end-screen CTA lift wishlists — is weakly sourced or unsourced.
  Treat §1 as informed convergence of practice, not measured effect.
- **n=1 throughout the genre evidence.** Replicat is the only memory-matching roguelite comparable,
  with no conversion data attached. Balatro and Slay the Spire are card games; their lessons transfer
  by analogy only.
- **Time-sensitive.** The shared-Cloud pre-release limitation and Next Fest mechanics have both
  changed more than once. Re-verify in Steamworks before committing.
- **Verification gaps.** TouchArcade returned HTTP 403 and the Internet Archive was blocked, so the
  Balatro quote *wording* was confirmed by exact-phrase search; its substance was confirmed directly
  on LocalThunk's blog. The Slay the Spire GDC deck was image-only and not text-extractable.

---

## 3. Where this repository actually stands

### 3.1 `main` does not compile — blocking

`828190e "chore: apply pending gameplay and UX state work"` half-applied a "route everything through
typed gameplay-core commands" migration: callers were rewritten, the modules they call were not.
Verified by resolving every relative import in `src` against its target's real exported symbols —
**30 broken specifiers across 14 files**:

| Cluster | Detail |
|---|---|
| gameplay-core adapters | 8 `*ThroughGameplayCore` functions imported; `gameplay-core-adapters.ts` exports 6 entirely different ones. Kills memorize-end, pause/resume, gauntlet expiry, tile flip, debug reveal, turn resolution. |
| command factories | 6 `createGameplay*Command` + `createRunProgressionRepairTransition` imported by the solver and simulation layer, never defined. Takes the softlock/fairness gate down with it. |
| run summary | `createGameOverRunSummary` / `createValidatedGameOverRunSummary` imported; `run-summary-rules.ts` exports only `createRunSummary`. No run can reach a game-over summary. |
| board powers | `armRegionShuffleRow` / `toggleStrayRemoveArmed` gone from `board-powers`, still imported and still re-exported by the `shared/game` barrel. |
| test fixtures | `gameplay-feedback-completeness.test.ts` imports `./test/gameplay-event-fixtures`, never committed. `BoardTurnResolvedEvent` not exported by `gameplayFeedbackAdapter`. |

Separately, **`src/shared/side-room-rules.ts` is not TypeScript at all.** It contains one line:

```
cat: /data/data/com.termux/files/home/repos/memory-dungeon/src/shared/side-room-rules.ts: No such file or directory
```

A failed `cat` on a Termux device was captured and committed as the module body. It syntax-errors
the whole repo. Nothing imports it. Delete it.

Three regressions also landed in the still-live UI path: score/miss floaters are called with a
`GameplayEvent` where the builders take `(run, next)` and bail on `!run?.board`, so they silently
never render; `strayRemoveArmed` is never written by `toggleStrayArm`, so the stray-remove power is
permanently unarmable; and the same prop is missing from `useGameScreenPowerTileHints` and
`GameLeftToolbar`, so its board hints never light. That is the concrete mechanism behind "the HTML
layer is 💀" — the UI still renders, but its feedback is wired to values that are now always
null.

Meanwhile the GameScreen decomposition that would have cleaned this up is a **closed island**:
`gameScreenBoardModels` / `BoardFeedbackModel` / `BoardFloaterModel` / `FloorClearFeedbackModel` /
`RouteChoiceModel` and the three `useGameScreen*Projection` / `gameScreenDecisionSignals` modules —
about 3,000 lines — import each other and nothing outside the island imports them.
`useGameScreenFloorClearProjection` has no importers at all. `GameScreen.tsx` does import two other
`gameScreen*` helpers (`gameScreenStoreSelectors`, `gameScreenFeedback`) but none of the island, and
still carries its inline copies at **6,861 lines**.

### 3.2 The memorize curve inverts — this is the demo-defining number

`getMemorizeDuration` (`src/shared/scoring-rules.ts:40`) is a flat decay on level. `pairCount` is
`level + 1`, clamped to 30 (`board-build-rules.ts:181`). The two curves run in opposite directions:

| Floor | Pairs | Tiles | Memorize window | **ms per tile** |
|---:|---:|---:|---:|---:|
| 1 | 2 | 4 | 1300 ms | **325** |
| 3 | 4 | 8 | 1250 ms | **156** |
| 5 | 6 | 12 | 1200 ms | **100** |
| 10 | 11 | 22 | 1100 ms | **50** |
| 20 | 21 | 42 | 850 ms | **20** |
| 29+ | 30 | 60 | 600 ms | **10** |

Locked in by tests (`game.test.ts:6923-6927`). No relic meaningfully offsets it: the best single
bonus is +280 ms and `MAX_PENDING_MEMORIZE_BONUS_MS` caps the accumulator at +500 ms.
`previewActive={run.status === 'memorize'}` (`GameScreen.tsx:4410`) confirms the whole board is shown
during that window.

Past roughly floor 8–10 the memorize phase stops being a memory test and becomes a formality; the
run is then decided by how fast 4 lives drain to trial-and-error. **That crossover, not any design
intent, is what currently sets run length** — and run length is what the §1.3 playtime benchmark
measures. The demo's median-playtime number is downstream of this constant.

Two candidate fixes, both cheap:

1. **Scale the window with the board.** Replace the flat decay with per-tile budget × `pairCount`,
   and put the *difficulty* curve in the per-tile budget rather than in the total. Preserves the
   "it gets harder" intent without inverting the relationship.
2. **Stop growing the board and grow the modifiers instead.** Cap `pairCount` around 8–10 and push
   escalation into mutators, hazards, findables and relic interactions. This is precisely what §1.7's
   one genre comparable does, and this repo already has the systems for it.

Option 2 is better aligned with both the research and the existing content. Option 1 is the smaller
change. Either way the decision belongs *before* the demo content lock, because it determines how
many floors a demo player actually sees.

### 3.3 What is already in good shape

- 5 modes exist (`endless | daily | puzzle | gauntlet | meditation`), and Choose Your Path already
  disables Endless honestly — the demo-gating pattern §1.2 wants is already established in the UI.
- A 3-step playable onboarding (`first_match` → `recovery` → `handoff`) and a 5-row first-run help
  center exist, teaching by highlighting a real pair on a live board rather than a rules wall.
- `docs/reference-comparison/CURRENT_VS_ENDPRODUCT.md` already catalogs the HUD/menu gap against the
  target stills — the UI work is specified, not just felt.
- Steam integration sits behind a main-process adapter with a no-op fallback, so demo-vs-full
  achievement gating (§1.4) is a flag.

---

## 4. Demo vs full build content matrix

The matrix `REG-129` was supposed to contain. Derived from §1.1 — cap breadth, never length.

| Axis | Demo | Full | Rationale |
|---|---|---|---|
| Run length | **Uncapped.** No floor limit, no run limit. | Same | §1.1: Balatro's own reversal; Replicat ships identical level counts in both. |
| Modes | Classic dungeon run only | All 5 | Breadth cap. |
| Locked modes | **Visible and disabled**, labelled "in the full game" | — | §1.2; the Choose Your Path screen already does this for Endless. |
| Relics | Reduced pool | Full roster | Breadth cap; keeps build variety legible without exhausting it. |
| Mutators | Subset of the 12-floor endless cycle | Full catalog | Breadth cap on the system §1.7 says carries the depth. |
| Findables / hazards / side rooms | **Keep** | Same | These *are* the "rule-bending modifiers" the genre comparable validates. Cutting them cuts the hook. |
| Meta-progression / collection / codex | Present, visibly capped | Full | Show the shape of the tail. |
| Steam achievements | **Off** | On | Valve's explicit recommendation (§1.4). |
| Save carry-over | **None.** Local saves only; no shared cloud APP ID | — | Valve: shared cloud will not sync to an unreleased base app (§1.4). |
| Store page | Itemized "the full game adds…" ledger | — | §1.2. |
| Run-end screen | Wishlist CTA | Continue | §1.6 — judgment, not data. |

---

## 5. Sequenced plan

**Phase 0 — make it build.** Delete `src/shared/side-room-rules.ts`. Resolve the 30 broken
specifiers: either land the missing `gameplay-core` adapters/factories or revert the callers to the
pre-migration functions. Reverting is smaller and lower-risk; completing the migration is the better
end state. Pick one and finish it — the half-state is what produced every symptom in §3.1. Restore
the `shared/game` barrel re-exports. Gate on `yarn typecheck && yarn test && yarn lint`.

**Phase 1 — restore live-UI feedback.** Score/miss floater payload arguments; `toggleStrayArm`
writing `AppState.strayRemoveArmed`; the missing `strayRemoveArmed` prop on
`useGameScreenPowerTileHints` and `GameLeftToolbar`. Small, mechanical, and they are the difference
between the board feeling responsive and feeling dead.

**Phase 2 — decide the memorize curve (§3.2).** This gates everything downstream, because it sets
run length and therefore demo playtime. Prototype both options, playtest, pick one. The research base
for cognitive-load limits is empty (§1.7), so this must be decided on playtests, not citations.

**Phase 3 — implement the §4 matrix.** Feature-flag mode locks, relic/mutator pool caps, achievement
suppression. Land it as the real body of `REG-129`, and reconcile with `REG-115` / `REG-118`.

**Phase 4 — HUD and shell pass.** Work the gaps already itemized in
`docs/reference-comparison/CURRENT_VS_ENDPRODUCT.md`. Land the `gameScreen*` model extraction that is
sitting unused rather than leaving 6,861 lines in `GameScreen.tsx`.

**Phase 5 — Steamworks.** Separate demo appid, depot config, achievements off, no shared cloud APP ID
until launch, store-page ledger, capsule and trailer.

**Then ship it early and keep patching it** (§1.5) — well before any Next Fest, for iteration time
rather than for an assumed wishlist multiplier.

---

## 6. Questions the research could not answer

- Does demo→full save carry-over affect conversion at all? Valve documents the mechanism and
  recommends it; nobody measures purchase-rate effect, and the pre-release sync limit means most
  pre-launch demos cannot test it anyway.
- Does disclosing locked content beat hiding it? One example, no comparative data.
- What are the cognitive-load and session-fatigue limits for memory as a repeated core loop — grid
  ceilings, recall span across consecutive floors, when memorization becomes tedium? **Zero usable
  sources.** This needs primary playtesting or working-memory literature, not gamedev writeups. It is
  also the single most important open question for this specific game.
- For a run-based game, is one uncapped run better than several shorter capped runs at conveying
  replayability, and how many runs should a demo afford? LocalThunk's reversal argues against hard
  caps without answering the count.
- Where should the wishlist CTA sit, and does an in-build prompt lift conversion at all? Genuinely
  unmeasured in public data.
