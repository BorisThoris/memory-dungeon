# UI rethink: from the 2026-06-28 baseline to a Steam demo shell

Status: draft, repo-grounded half complete; research citations pending (see §0).
Canvas: https://claude.ai/code/artifact/bc620c87-cd0e-4bd7-9e02-40c1045ac02f
Companion: `docs/STEAM_DEMO_CYCLE.md` (demo content matrix, sequenced plan).

## 0. What this is grounded in

Two things, and the plan says which one each decision rests on:

- **Measurement of this repo.** The clone was shallow until 2026-09-02; unshallowing recovered
  1,167 commits back to 2024-09-10 and made the regression visible. One commit, `e6054d33`
  (2026-07-04, "Improve gameplay feedback readability"), took `GameScreen.tsx` from 2,064 to
  6,289 lines and its stylesheet from 4,948 to 15,371, followed by ~645 July commits named
  "Add HUD reward hot band", "Add board surge band", "Expose cashout reward ladder in compact
  chip", "Focus chain rhythm maps". The last clean commit is `86f8ebd9` (2026-06-28).
- **External research** on comparable roguelike run-loop UIs, Steam Deck / accessibility type
  and target standards, in-run teaching without overlays, run-start and run-end retry loops,
  and web-tech game shells. Findings and citations are appended in §7 when the report lands;
  anything in §2–§6 marked *(research)* is provisional until then.

### 0.1 Per-screen bombardment, measured

Line counts at `86f8ebd9` → `HEAD` (before the September revert):

| Screen | testids | tsx lines | css lines |
|---|---|---|---|
| GameScreen | 13 → 59 | 2,064 → 6,827 | 4,948 → 17,156 |
| GameplayHudBar | 35 → 77 | 910 → 3,381 | — |
| RelicDraftOfferPanel | 2 → 20 | 223 → 1,679 | — |
| SideRoomScreen | 3 → 10 | 199 → 1,490 | 174 → 1,753 |
| ShopScreen | 2 → 6 | 239 → 1,437 | 251 → 1,723 |
| GameOverScreen | 7 → 15 | 382 → 810 | 516 → 1,348 |
| InventoryScreen | 14 → 19 | 438 → 985 | 134 → 1,045 |
| ChooseYourPathScreen | 9 → 9 | 859 → 1,380 | 1,511 → 2,084 |
| GameLeftToolbar | 8 → 8 | 621 → 843 | — |
| CodexScreen | 4 → 4 | 542 → 545 | 214 → 214 |
| SettingsScreen | 10 → 10 | 700 → 701 | 1,230 → 1,230 |

Two screens the user calls "a bit terrible" were never bombarded (Codex, Settings): their
problem is the original design, not accretion. Everything else is accretion first.

### 0.2 What the September revert already did

Commits `9501910f`, `31980c55`, `cd2589e1` on `main`: removed the chain-opportunity chip and
its thirteen sub-lanes, the opportunity compass, the trait-mode cue, the dock's payoff stack /
crescendo / sequence / setup badges / payoff-role-intent chips, and the HUD reward cue; restored
the centred 720×117 dock with 45×45 buttons; generalised the closed-`details` rule. Probed at
1440×900 in the playing phase: 14 chrome panels (the same 14 as 06-28), 165 visible elements
against 06-28's 208, 47 sub-12px text leaves against 73. The in-run HUD is therefore already
at the baseline; §3 starts from there rather than from the bombarded state.

## 1. Principles the plan enforces

1. **No screen adds a panel without removing one.** The bombardment was ~645 commits each
   adding "one more cue". The budget is a number per screen (§1.1), checked by a test.
2. **The 3D board and the main menu are not touched.** They are the two things the user loves.
3. **One statement per fact.** Choose Your Path at HEAD says chain / reward / pressure four
   times per card in four formats. Each screen states each fact once, in one format.
4. **Mouse-first, controller second.** Hover reveals detail; focus rings and 44px targets keep
   a pad viable. Nothing is hover-only that a pad user needs.
5. **12px floor on anything a player reads; 14px on any number they act on.** Already
   enforced for the HUD's must-read lanes by `e2e/gameplay-hud-layout.spec.ts`; extended to
   every screen in §5.
6. **First-run coaching is a line, not a panel.** The 06-28 dock delivered "Flip a marked
   tile" inline; the July UI turned it into three stacked panels. *(research: the case for
   progressive disclosure over persistent advisory overlays is cited in §7.)*

### 1.1 DOM budget per screen (enforced)

Measured the way the revert was measured: elements with a `data-testid` that are visible,
not full-bleed, and hit-testable at their top edge = "chrome panels"; childless visible
elements with text = "text leaves"; leaves whose computed size is under 12px = "sub-12".

| Screen | chrome panels ≤ | text leaves ≤ | sub-12 |
|---|---|---|---|
| In-run HUD (playing) | 14 | 80 | 0 |
| Choose Your Path | 12 | 60 | 0 |
| Floor cleared dialog | 8 | 40 | 0 |
| Shop | 10 | 50 | 0 |
| Side room | 6 | 30 | 0 |
| Relic draft | 6 | 30 | 0 |
| Game over | 10 | 50 | 0 |
| Pause | 4 | 12 | 0 |
| Inventory / Codex / Settings | 16 | 90 | 0 |

The HUD row is the 06-28 measurement; the rest are set from the artboards and will be adjusted
once, downward only, after the first implementation pass.

## 2. Choose Your Path

**Owner files:** `src/renderer/components/ChooseYourPathScreen.tsx` (1,380 lines),
`ChooseYourPathScreen.module.css` (2,084), `src/shared/run-mode-catalog.ts` (mode roster).

**Restore target:** `86f8ebd9` — header row (Back / Settings), eyebrow "Start a run", display
title, one-line subtitle, launch panel (poster, "Recommended", mode title, summary, three
first-run beats, Start run + Browse modes), browse row of cards (kicker, title, two-line
description), footer note. Screenshot: `tmp/ui-redesign/0628/desktop/landscape/01a-choose-your-path.png`.

**Delete:** the `Pace / Payoff / Pressure` lane data (`ChooseYourPathScreen.tsx` lines ~71–130
at HEAD) and every strip that renders it — the "LANES … CHAIN LEADS" strip, the "LAUNCH LOOP"
strip, the three-column grid, and the pace/payoff/pressure strips. The browse cards drop the
same strips and get their description back (they clip at HEAD). The same lane text is
interpolated into each tile's accessible name (`aria-label={`${def.title}. ${signalText}. Open
details.`}` at HEAD, against `${def.title}. Open details.` at 06-28), which is what broke the
visual harness's tile locator; restoring the label restores the harness.

**Keep from HEAD:** locked modes rendered visible-and-disabled with an "In the full game" tag
(this is the demo ledger pattern from `STEAM_DEMO_CYCLE.md` §4).

**Tests that go:** any spec asserting the lane strips. **Acceptance:** the visual scenario
`choose your path` in `e2e/visualScenarioSteps.ts`, plus the §1.1 budget probe.

## 3. In-run HUD

Already at the 06-28 baseline after the revert (§0.2). Remaining work is refinement, not
removal:

- Action feedback becomes a single line under the score pill (artboard `Hud`), not a rail
  drawn over the top card row. Owner: `GameScreen.module.css` `.actionFeedbackRail`.
- The first-run prompt ("Make your first match") stays bottom-right and is the *only*
  coaching surface; it is gated on `onboardingDismissed` and disappears after the first clear.
  Owner: `src/shared/playable-onboarding.ts`, `GameScreen.tsx` around the
  `playable-onboarding-prompt` block.
- The dungeon run strip (room card, bottom-left) keeps its 06-28 content: depth/lane, room
  name, boss countdown, one line.
- Alternate B on the canvas (diegetic, no top band) is the research-dependent option; not
  scheduled unless §7 supports it.

## 4. The retry loop: floor clear, relic draft, shop, side room, game over

These five are where the bombardment multiplied hardest (§0.1: 6–7.5× in tsx). Each is a
delete-then-rebuild against its 06-28 skeleton plus the artboard.

### 4.1 Floor cleared + route choice
**Owner:** `GameScreen.tsx` ~5,880–6,060 (`floor-clear-*` testids) and
`gameScreenFloorClearFeedbackModel.ts`, `useGameScreenFloorClearProjection.ts`.
**At HEAD:** nine strips — result stack, momentum, payoff stack, cashout, carry-forward,
action sequence, objective, causality grid, next-signal. **At 06-28 it was no better:** the
captured dialog (`tmp/ui-redesign/0628/desktop/landscape/07-floor-cleared-modal.png`) is a 3×6
grid of eighteen prose boxes ("Baseline descent: Baseline descent resolved; score, objective
value, and assist discipline remain the main read…") above four stats and two buttons. This
is the one run-loop screen where the baseline is not the target; the artboard is.
**Target (artboard `FloorClear`):**
floor score, four stats (pairs, best streak, misses, plus score), one route-choice row (Safe /
Greed / Mystery, one line each), Continue. **Delete:** everything but result and route choice.
**Tests that go:** `gameScreenFloorClearFeedbackModel.test.ts`, `useGameScreenFloorClearProjection.test.ts`,
and the `floor-clear-*` assertions in `GameScreen.test.tsx`.

### 4.2 Relic draft
**Owner:** `RelicDraftOfferPanel.tsx` (223 → 1,679 lines). **Restore:** the 06-28 shape —
three `relic-offer-card`s with tier, name, one-line effect, plus the service row. **Delete:**
`relic-draft-lane-map`, `relic-draft-payoff-engine`, `relic-draft-primary-lane`.

### 4.3 Shop
**Owner:** `ShopScreen.tsx` (239 → 1,437). **Restore:** header "Vendor alcove" + purse, stock
grid (`shop-offer-*`: name, one line, price, Buy), reroll, leave. **Delete:**
`shop-offer-lane-map`, `shop-offer-lane-map-summary`, `shop-payoff-engine`, `shop-primary-offer-lane`.

### 4.4 Side room
**Owner:** `SideRoomScreen.tsx` (199 → 1,490). **Restore:** title, one line, choice cards
(`side-room-choice-*`), reward feedback. **Delete:** the seven testids added since.

### 4.5 Game over
**Owner:** `GameOverScreen.tsx` (382 → 810), copy in `src/renderer/copy/gameOverScreen.ts`.
**Restore:** hero (Run complete / Expedition Over / score), meta chips, side rail with Play
Again + Main Menu, run snapshot, journal, achievements, detail drawer. **Delete:**
`game-over-payoff-burst(-stack)`, `-payoff-crescendo`, `-payoff-lane-map`, `-payoff-sequence`,
`-primary-payoff-lane`, `-momentum-recap`, `-outcome-signals`. **Add (demo only, flag from
`STEAM_DEMO_CYCLE.md` §4):** a "what ended it" line and the wishlist panel on the artboard.
*(research: what run-summary content drives retry is cited in §7.)*

## 5. Never-bombarded screens: Inventory, Codex, Settings, Pause

Inventory grew 438 → 985 but kept its sections; Codex and Settings are untouched since 06-28.
For these the work is design, not deletion:

- **Inventory** (artboard): three sections that matter mid-run — Relics, Mutators, Charges and
  tokens — with the run snapshot folded into the header line. The 06-28 "Build identity",
  "Contract flags", "Economy" frames go; they restate the codex.
- **Codex** (artboard): one tab rail, a three-column grid of entries in the HUD's own words.
  Owner: `CodexScreen.tsx`, `codexScreenModel.ts`.
- **Settings** (artboard): the sidebar stays; the content column becomes one list of rows
  (label, one line, control) instead of the control-center strip + subsection nav + grids.
  The strip is the concrete problem: at 06-28 and today the Gameplay page opens on four
  developer-facing tiles shown to the player — "Live controls · 18 saved preferences",
  "Reference placeholders · Honest future rows", "Profile trust · Local save shell", "Mobile
  reachability · Sticky footer" (`settings-control-center-strip`). None of them is a setting.
  Owner: `SettingsScreen.tsx`.
- **Pause** (artboard): Resume / Run settings / Main menu, three stats. Owner: the
  `run paused` dialog in `GameScreen.tsx`.

## 6. Phases

Ordered by what a demo player sees first.

| Phase | Work | Gate |
|---|---|---|
| 0 | Commit the DOM-budget probe as `e2e/ui-budget.spec.ts` (from the scratchpad `ui-probe.spec.ts`), with §1.1 numbers as assertions marked `test.fixme` until each screen lands. Repair the repo's own visual harness against HEAD: run as independent tests (`e2e/ui-redesign-capture.spec.ts`), 14 of 15 scenarios pass at `86f8ebd9` and only 4 of 15 pass at HEAD, every failure in `startClassicRunFromModeSelect` — the harness's locators for the recommended-run heading and the `Classic Run. Open details.` library tile no longer match what the bombarded Choose Your Path renders. Restoring the screen (§2) is most of the fix; the rest is the `dismissStartupIntro` poll, which gives up before Play becomes visible (~6 s after load with the injected save). | 15/15 visual scenarios pass at HEAD; probe green on the HUD row |
| 1 | §2 Choose Your Path. | budget row + visual scenario |
| 2 | §3 HUD refinements (feedback line, single coaching surface). | `gameplay-hud-layout.spec.ts` + budget |
| 3 | §4.1 floor clear, §4.2 relic draft. | budget rows + `floor cleared modal` scenario |
| 4 | §4.3 shop, §4.4 side room, §4.5 game over (+ demo wishlist panel behind the demo flag). | budget rows + `shop screen`, `game over screen` scenarios |
| 5 | §5 Inventory, Codex, Settings, Pause. | budget rows |
| 6 | Controller pass: focus order, 44px targets, D-pad on every screen. *(research: Steam Deck requirements cited in §7.)* | `settings-viewport-matrix.spec.ts` at 1280×800 |

Every phase deletes its bombardment-era specs with the code they assert, and lands with the
full gate (`yarn typecheck && yarn test && yarn lint`) green.

## 7. Research findings

Pending — the deep-research report is running. This section will carry the cited findings,
their confidence, and which §2–§6 decisions each one supports or contradicts.
