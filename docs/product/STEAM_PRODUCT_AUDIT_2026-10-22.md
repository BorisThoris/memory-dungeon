# Memory Dungeon Steam product audit

22 October 2026. Source snapshot: `origin/main` at `4bbbb057e350dad025efbfcaa6e06ef5ed30c431`, game rules 81, save schema 10, floor schedule 7.

**Memory Dungeon has enough working machinery to test a compelling product. Its strongest opportunity is a memory game where the pair you choose sets off a spatial cascade. The next investment should prove that players can deliberately create that payoff, form different builds, and want another run. Completing every historical ticket would move the game away from that goal.**

The execution proposal is in [the Steam game plan](STEAM_GAME_PLAN_2026-10-22.md). The complete file-level task census is in [task reconciliation](TASK_RECONCILIATION_2026-10-22.md).

## Source and audit scope

The original checkout was on `codex/seeded-opening-layouts`, at `bcb6fafc2`, with 99 modified tracked files and additional untracked work at the initial inspection. After fetching, its committed history was one commit ahead and 639 commits behind `origin/main`. Updating it in place would require reconciling substantial unrelated work. It was preserved.

Latest main was checked out cleanly at `D:/agent-work/memory-dungeon/2026-10-22-steam-product-audit/source`. Its dependency lock exactly matches the original checkout; a junction reuses the installed dependencies. No dependency reinstall, game changes, merge, deployment, or public communication was needed. The original tracked patch, status and local-only commit were saved under the audit's `evidence/` directory. Twenty untracked files in that saved inventory have no same-path counterpart on main, including environment cues, opening prompts, rematch comparisons, local records and a weekly Classic key. They are work in progress, not shipped features.

The census reads all tracked Markdown, inventories source/test files, extracts every checkbox and numbered task file, and checks literal code-reference existence. The substantive code review follows run creation, turn resolution, cascades, Hold/Carve, moving cards, layers, bosses, camp/evolutions, progression, content locks, telemetry and Steam integration. It does not pretend that reading a task's status proves its acceptance, or that every one of 113,363 production source lines received a manual review.

GitHub's connected search returned no issues and one open PR, #2, a Cloudflare Wrangler naming change. The repository's Markdown is the main task system; the hosting PR is not a game-design dependency. Nothing was posted to it.

## What the task inventory actually says

| Inventory | Count | Interpretation |
| --- | ---: | --- |
| Tracked Markdown documents | 784 | Includes research, archived plans and repeated QA forms |
| Numbered task or epic files | 453 | 452 after excluding the `UC-000` template; epic-level and atomic files are not equivalent units |
| Task ID occurrences in headings/table first columns | 1,530 | Repeated declarations/references; 630 distinct IDs, not 630 verified open jobs |
| Checklist entries | 1,885 | 188 checked; 1,697 unchecked |
| Unchecked entries under visual captures | 1,604 | Repeated audit forms dominate the unchecked total |
| Unchecked entries elsewhere | 93 | Still includes standing criteria and research; not a clean feature backlog |
| Literal task code references | 596 | 105 point to absent paths, across 72 task files |
| Source/tool/test files inventoried | 1,431 | 640 `.test`/`.spec` files |
| Production files under `src/` | 678 | 113,363 lines, excluding test files and assets |

Do not report this game as 10% complete because only 188 boxes are ticked. Do not report it as almost shipped because hundreds of tickets say Done. Both calculations confuse administrative history with a playable product.

### Reconciliation by task family

| Family | Recorded state | Current treatment |
| --- | --- | --- |
| Deep Game Epic, DGE-001 to DGE-032 | 21 labelled Done or Done in part; 1 standing In progress; 10 Not started | The active gameplay track. Several Done labels contain explicit shortfalls. See the next table. |
| Refined Experience Gaps, REG-000 to REG-160 | 158 Done, including 3 partially superseded; REG-052 deferred, REG-060 blocked, REG-061 deferred | Reuse surviving infrastructure and release work. Earlier dailies, route maps, dungeon combat and draft acceptance are historical. |
| Dungeon Epic | 48 tickets Done | Historical implementation. The old dungeon layer was intentionally removed in generations 171–177. Do not restore it from this pack. |
| Gameplay Logic Ultra Deep Dive | 36 implementation specs Done; 20 research passes plus rollups | Retain fairness/persistence lessons; references to retired modes, hazards and relic drafts need remapping. |
| Gameplay Theory Conversion | 27 task files Done | Historical acceptance report is not a current feature manifest. Several cited files were removed. |
| Next Gameplay Epics | 7 epic files; README claims vertical slices implemented except presentation/tuning | Historical architecture and mechanics. Reconcile against current purchased relics, automatic camp and Descent. |
| Playable Path Improvements | 10 Done | Regression leads for current navigation; revalidate changed surfaces. |
| User critiques | 5 Done; one Open template | No actual open critique ticket in this set. Lives/trap language belongs to older rules. |
| REF-001 to REF-100 | Completion rollup claims all addressed; most individual cards have no explicit Status section | Historical closure, not 100 new tasks. Preserve surviving persistence, input and rendering requirements. |
| GLD-FB | 10 Done | Historical feedback work; some pickup kinds/read models were removed. |
| UI tasks | 5 Completed | Earlier mobile fixes; current UI must still pass current viewport/input checks. |
| New design/parity packs | Task rows in area documents, archived completion log, 3 asset deferrals | Current owner art rules take precedence over old screenshots. Mode-poster work for retired modes is obsolete. |
| Relic draft/UI epics | 8 numbered subtask files plus table/checkbox tasks | Earlier draft flow and visual proposals. Do not recreate the deleted draft screen. |

Every numbered file, its recorded status, reference counts and audit disposition is listed in the reconciliation. Separate CSVs preserve table-level task occurrences and every checkbox, covering tasks that have no individual ticket file. Missing literal references flag drift; they do not establish a runtime bug. Generic historical dispositions intentionally do not claim a semantic re-verification of every card.

### Active Deep Game status against code

| Tickets | What exists | What remains |
| --- | --- | --- |
| 001, 002, 004, 007 | Plateau research, four-act schedule, milestone fractions, results with act/distance | Research and older decision notes contain superseded measurements; consolidate the current baseline. |
| 003 | Dread calculation, named tiers, HUD/record/results | No priced composition table. Dread is a reading of depth/severity, not the implemented generator budget proposed in the plan. |
| 005, 006, 023 | Warden at 60; win or Endless; Endless cycle/rent; hard Warden requires a Hold of 12, calm Warden clears normally | Human tuning, hard-path browser proof and long Endless readability remain. An evolved relic is not required by the implemented Warden, despite the original design. |
| 008 | Hold meter, stacked matches, release, miss halves the stack | Feedback/controller/tool proof needs closure. Its proposed pop-share increase was explicitly not delivered; this is an accepted design exception, not a reason to silently change it. |
| 009, 010, 011 | Wanderers, Fold, Keeper at 24 with room swaps | Priced Dread composition absent; Fold weather/distance and phone presentation exceptions; boss art/stinger absent. |
| 012, 032 | Pop measurement, survival/uncertainty/curve gates | Pop threshold is zero; uncertainty model is synthetic; Endless to 120 is not gated. Green scripts do not measure human enjoyment. |
| 013, 014, 015, 016, 017 | Four slots, ranked relics, evolutions, Carve, Masks, lower deck | Five of six evolution effects live; Echo Chamber inactive. Layer rise animation absent. Blueprint timing restricts build variety; see findings. |
| 026, 031 | Boss-door reward tiers, schema 10 and Descent records | Full feat/Depths progression absent. Schema support does not prove the unbuilt progression features. |
| 027 | Standing hall/soak coverage, planned Hold player | Stays open with new mechanics; coverage is infrastructure, not a finite content task. |
| 018 | Not started | Cartographer at 40; current floor 40 uses a stacked room, not its planned bespoke boss. |
| 019–022 | Not started | Echo, Sleepers, Spiral and announced adaptive rule. Treat as experiments, not mandatory launch scope. |
| 024, 025 | Not started | Thirty feat unlocks and twenty Depths rungs. A smaller proven progression set is preferable for v1. |
| 028–030 | Not started as pack-wide tasks | Some older telemetry, achievements, copy, audio and art already exist. DGE-specific coverage, final assets and retention measurement are unfinished. |

## Working product and architecture

The current application is Electron, React, TypeScript, Zustand and three.js, with shared rules and optional Steamworks integration. Classic and local Pass and Play are the live catalog entries. Endless is a continuation after the Warden, not another mode card. Keep that boundary.

The core is no longer a conventional crawler with locks, keys, enemies and route-map screens. It is a memory/cascade game with elemental rules and realm weather. A remembered pair seeds a same-suit contact break; chain momentum increases its payoff. Expiring earned misses provide pressure. New verbs/board structures arrive at deeper acts. These are enough ingredients for a product hypothesis.

The useful engineering assets are substantial: seeded rules, state-transition modules, save normalization/versioning, journal/share infrastructure, board fairness inspection, authored test-hall rooms, simulations, soak invariants, controller/navigation work, reduced-motion paths and asset preloading. Preserve these. A rewrite into a different engine would spend the product budget without resolving the uncertainty about fun.

Presentation integration is concentrated: `TileBoard.tsx` is 3,333 lines, `GameScreen.tsx` 2,665, and the shared hall fixture file 3,269. This is a maintenance risk when several mechanics move the same cards. Extract a named turn-phase sequence and selectors as needed for the next slice; keep behavior tests around ordering and do not launch a general refactor campaign.

## Findings that change the production plan

### 1. The pre-Warden build menu is much smaller than six recipes suggest

`boss-reward-rules.ts` always drops blueprints in `BLUEPRINT_ORDER`. `isActBossFloor` makes only floors 24, 40 and 60 award them in the first Descent. The direct rules probe produced:

| Floor, every boss taken raging | Blueprint |
| ---: | --- |
| 24 | Lantern of Recall |
| 40 | Miser's Vault |
| 60 | Cartographer's Thread |
| 72 | Keystone Heart |
| 80 | Unmasking Glass |
| 90 | Echo Chamber |

Only the first two blueprints arrive before the first Warden. The third arrives after defeating it; the Hold-related Keystone Heart is fourth, in Endless. Actual evolution also needs two rank-3 ingredients, 30 gold and a subsequent camp. The `live` flag alone says nothing about practical availability. Lantern and Cartographer's Thread also share the first ingredient, which prevents owning both evolutions under the existing rule.

**Product implication:** late content counts conceal a narrow first-run build space. Fix choice and timing before adding twenty more relics. Probe seed/strategy reachability and measure when real players first see a build payoff. This is not an argument to make the Warden require an evolution; the current calm/hard-path distinction should remain.

### 2. Echo Chamber can be an empty reward

In `relic-evolution-rules.ts`, Echo Chamber has `live: false`, but `availableEvolutions` does not filter on `live`; `applyEvolution` can buy it, and `automaticCampReward` can spend on it. Its blueprint is late, but reachable in Endless. An inactive reward should not consume the player's gold or be offered as a benefit. Implement Echo first or exclude the recipe/blueprint from attainable offers until its effect exists. The old comment also incorrectly says Unmasking Glass is still inactive; its table entry is live now.

### 3. Automatic camp weakens the proposed build fantasy

`automaticCampReward` chooses one purchase on advancement, with a setup preference for study, score or survival. Evolution purchases precede that preference. An evolution unaffordable at its offer is marked declined for the rest of the run. These are intentional current behaviors, not accidental transaction bugs.

There is also a concrete instruction/UI discrepancy: current `CLAUDE.md` calls for a camp stop every third floor, but `GameScreen.tsx` automatically continues ordinary clears after the payout beat, and `buyStoreItem` has no live renderer caller outside its store definition. The old store copy and purchase action survive without a purchase screen. The opening browser test's name says it passes through a store stop, but its loop only clicks Descend if visible; it never requires a camp to appear. Its five captures contain no camp screen. The passing test therefore does not prove the owner's camp-stop requirement.

The design risk is that a player receives upgrades without making an interesting commitment, then loses a recipe without deliberately declining it. Implement the compact third-floor stop required by the owner, with explicit purchase/save/evolve choices and an optional automatic preference, and assert that stop in the UI test. Compare choice friction in playtests; no claim about actual churn follows from static code alone.

### 4. Demo copy promises content that is not in the full catalog

`content-lock.ts` advertises Daily Challenge, Puzzle sets and Meditation in `FULL_GAME_LEDGER`. `GameOverScreen` renders that ledger in the demo. Those modes are retired in `run-mode-catalog.ts` and prohibited from restoration by current owner instructions. Replace the ledger with actual full-build differences and verify demo/full paths. Do not solve the copy problem by rebuilding retired modes.

### 5. Some green checks are measurements or proxies rather than product gates

`POP_BY_ACT_MIN = 0` means the pop-by-act gate cannot fail for a shortfall against the original 0.6 target. The owner accepted that shortfall; preserve the decision and establish an honest regression floor separately. The current probe reports pop shares of 0.64 / 0.64 / 0.59 / 0.57 by act, on its eight fixed seeds and omniscient policy, without a Hold strategy.

`sim-survival.ts` can leave the inner loop while a floor is still `playing`, then force `status: 'levelComplete'` before advancing. That can happen at its turn cap or when it finds no group. Its control flow therefore has a false-success path for incomplete floors. How often that path occurs in the normal sample was not instrumented in this audit. Make such cases explicit failures before interpreting its reach percentage as a reliable progression gate.

The uncertainty probe holds the miss bank open and exempts several moving boss rooms. That is useful for its stated certainty question, not evidence of real-player survival, session length or willingness to replay. The hard-Warden test also needs its own playthrough; the existing accelerated win playtest deliberately takes the calm path.

### 6. Production retention is not observed

`trackEvent` is a no-op without a sink. `App.tsx` installs a console sink only in development. Existing run-start/end events lack the complete first-cascade/build/quit/retry funnel. Local records and run counts are useful player features, but do not constitute a retention study. Add a consent-based local playtest export before considering any remote collection. Offline play must keep working.

### 7. Steam integration exists; Steam release proof is still open

The adapter, achievement mappings, presence and stable save location exist. Partner entries, the real app identity, packaged install/update smoke, actual two-machine Cloud round trips and reviewed store media are separate work. `REG-060` remains blocked and `REG-061` deferred in the task records. A 1280×800 browser fit test is not Steam Deck certification or evidence of Proton/controller/suspend performance on the device.

The game also has an optional external global-record service now. Its failures are handled without blocking play; tests stub the service. Older blanket statements that there is no online surface are stale. Do not base replayability on this service or promise trusted competitive rankings without a separate trust design.

### 8. Profile persistence does not save an unfinished descent

`SaveData` in `contracts.ts` stores settings, achievements, summaries, history, stats and unlocks, but no active run. The main save repository persists that schema; the source search found no separate suspended-run store. In-session pause/resume is implemented, but closing and reopening the application is a different promise. A sixty-floor run needs a durable suspend path if players are expected to invest in a build and return later. Include this in the Steam slice rather than treating existing profile saves as sufficient.

## Test evidence and limits

Machine-readable results and exact commands are retained in the audit's `evidence/` folder. [Verification record](STEAM_AUDIT_VERIFICATION_2026-10-22.md) records the final exits and scope.

This is a product/design audit with supporting engineering checks, not a release certification. Human first-session understanding, replay behavior, actual Steam partner configuration, minimum hardware and Deck/Proton behavior require the proposed validation work. Historical gate logs are not substituted for runs performed in this audit.

## Market implication

[Replicat](https://store.steampowered.com/app/3509430/Replicat/) already sells a memory roguelike built around rule-changing combinations, varied starting decks and curiosity items. Its [demo](https://store.steampowered.com/app/3706490/Replicat_Demo/) exposes a replayable arc while limiting content breadth. This demonstrates a direct competitor, not Memory Dungeon's demand or sales potential.

[Dungeon Clawler](https://store.steampowered.com/app/2356780/Dungeon_Clawler/) pairs a familiar input with visibly different builds; [Shogun Showdown](https://store.steampowered.com/app/2084000/Shogun_Showdown/) emphasizes compact tactical decisions and tile combinations. The inference for this project is to sell the consequence of the remembered pair: where its cascade travels, when to release it, and how a chosen build changes that action. Competing on card/relic counts would erase the project's strongest distinction.

The next milestone is a convincing replayable vertical slice, tested by unfamiliar players, followed by a store/demo test. A finished backlog is not a substitute for either.
