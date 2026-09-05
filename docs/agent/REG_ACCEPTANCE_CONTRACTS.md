# REG acceptance contracts

schema: reg | phase | status | contract | proof

| reg | phase | status | contract | proof |
|---|---:|---|---|---|
| REG-000 | 1 | done | Audit index closure: `reg-state-index.mjs` and this table list Phase 1–7 status through ship plus blocked/deferred where environment requires it. | `reg-state-index.mjs` + `REG_ACCEPTANCE_CONTRACTS` |
| REG-033 | 1 | done | Agent queue, state index, test routing, and deferral ledger exist; first unblocked gates are explicit. | docs parse + git status |
| REG-068 | 1 | done | v1 scope is offline/local + Steam-supported + first-class mobile; online leaderboards/accounts/server realtime are non-blocking. | copy audit + local best-score wording |
| REG-052 | 1 | deferred | Competitive online leaderboard/server authority remains out of v1; local history/export/share may proceed. | deferral ledger + copy audit |
| REG-087 | 1 | done | Softlock/fairness P0 gate has deterministic tests for generated boards and high-risk mechanics; REG-120+ remains deep matrix. | targeted shared tests |
| REG-088 | 1 | done | New player can go from first launch/menu to an early successful run loop with clear local progress and no online dependency. | unit/component + routed e2e if UI changes |
| REG-089 | 1 | done | Save/rules/floor-schedule changes route through local-only version gate with validation commands and migration rules. | version-gate tests |
| REG-024 | 1 | done | Run economy separates score, temporary run currencies, temporary bonuses, durable stats/unlocks, and future shop wallet reset rules. | run-economy tests + HUD/inventory surfacing |
| REG-040 | 1 | done | Save write failures expose a health state, safe recovery action labels, and repeated-failure guidance without PII. | persistBridge tests + main persistence error tests |
| REG-063 | 1 | done | Telemetry distinguishes local debug sinks from remote collection, scrubs PII/path/secrets, and keeps leaderboards separate. | telemetry tests |
| REG-017 | 2 | done | Eligible endless floor clears expose deterministic local route choices before continuing; route hooks remain offline and shop-ready. | game + floor-clear UI tests |
| REG-015 | 2 | done | Runs earn temporary shop gold, expose local vendor offers, and can spend once on eligible floor-clear shops without durable economy changes. | game + floor-clear UI tests |
| REG-018 | 2 | done | Visual Endless remains intentionally locked/upcoming while Classic owns playable procedural endless progression copy. | run-mode catalog + encyclopedia tests |
| REG-019 | 2 | done | Relic draft data exposes build archetypes and UI surfaces those archetype tags alongside contextual reasons. | relic tests + draft UI tests |
| REG-020 | 2 | done | Endless chapter schedule exposes chapter themes and UI telegraphs active mutator roles before/during floors. | floor schedule + GameScreen tests |
| REG-021 | 2 | done | Main menu exposes active/completed/locked local objective board rows from save-derived mastery progress. | objective-board tests + menu surface |
| REG-022 | 2 | done | Built-in puzzle library has metadata/progress rows, persisted local completion slots, and import validation errors. | puzzle-import + save-data tests |
| REG-025 | 2 | done | Cosmetics are scoped to visual-only unlock tags with collection/inventory owned/locked/equipped surfaces and fallbacks. | cosmetics tests + UI typecheck |
| REG-045 | 2 | done | Board powers are grouped as Recall/Search/Damage/Risk verbs with costs, disabled reasons, and Perfect Memory consequences. | power-verbs tests + toolbar UI |
| REG-046 | 2 | done | Default forgiveness profile is explicit: softened memorize curve, first-miss grace, clean/perfect life recovery, and fixed daily comparability. | difficulty-profile + HUD tests |
| REG-047 | 2 | done | Symbol bands expose readability profiles and validation catches duplicate/confusable labels before mobile-facing drift. | tile-symbol catalog tests |
| REG-048 | 2 | done | Secondary objectives expose active/failed/completed copy, HUD state, and floor-clear completion/failure explanation. | secondary-objectives + HUD/GameScreen tests |
| REG-049 | 2 | done | Findables expose reward copy for shard/score pickups across HUD and tile a11y without changing reward values. | findables + HUD/TileBoard tests |
| REG-050 | 2 | done | Wild, Gauntlet, and Meditation mode cards/details/results state distinct player promises, constraints, and achievement eligibility. | run-mode catalog + GameOver tests |
| REG-065 | 2 | done | Puzzle content tail has pack taxonomy, authored metadata, an advanced built-in board, and safe import/library validation. | puzzle-import + save-data tests |
| REG-066 | 2 | done | Card-back theme slots are real cosmetic rows with asset/fallback contracts while selection persistence remains deferred. | cosmetics tests + Settings/Inventory typecheck |
| REG-069 | 2 | done | Route graph contract names deterministic combat/shop/elite/rest node hooks, seed identity, and default selected node without new online state. | run-map tests |
| REG-070 | 2 | done | Vendor offers expose base/scaled cost, stock, sold-out state, and one local reroll with gold-gated failure UX. | game + floor-clear UI tests |
| REG-071 | 2 | done | Shop catalog rows include item families, compatibility, stack caps, and service effects for heal, peek, destroy, and discount services. | game catalog tests + floor-clear UI tests |
| REG-072 | 2 | done | Shop wallet pacing exposes deterministic floor earnings, current wallet, sink total, and run-end expiry. | game wallet tests |
| REG-073 | 2 | done | Rest/shrine services define local heal, favor bargain, costs, risk types, and disabled reasons without adding persisted state. | rest-shrine tests |
| REG-074 | 2 | done | Random event rooms expose deterministic seed-based event selection, choice rewards, risk labels, and no-op invalid choices. | run-events tests |
| REG-075 | 2 | done | Treasure/secret bonus rewards expose deterministic seed-based reveal rules, anti-grind one-claim tokens, economy-safe payouts, and route-map treasure hooks. | bonus-rewards + run-map tests |
| REG-076 | 2 | done | Boss and elite floors expose identity tiers, telegraph copy, reward pressure, placeholder slots, and HUD-readable boss/elite tags. | boss-encounters + floor schedule/HUD tests |
| REG-077 | 2 | done | Endless floors expose stable act, biome, cycle-floor, progress, and gate metadata through schedule helpers, HUD copy, and Codex text. | floor schedule + HUD tests |
| REG-078 | 2 | done | Relic draft services expose shop-gold costs, once-per-round reroll/ban/upgrade availability, deterministic offer mutation, and disabled failure copy. | relics/game/GameScreen tests |
| REG-079 | 2 | done | Run inventory exposes run-scoped loadout slots, consumable stack caps, mutation timing, and offline/non-persistent constraints in rules and Inventory UI. | run-inventory + InventoryScreen tests |
| REG-080 | 2 | done | Permanent meta track exposes local-only upgrade/cosmetic rows, progress gates, unlock tags, no pay-to-skip currency, and Collection surfacing. | meta-progression + cosmetics tests |
| REG-081 | 2 | done | Challenge modes expose offline save-derived gate rows, lock/available states, eligibility notes, and Choose Path detail copy for Gauntlet, puzzles, and contracts. | challenge-progression + run-mode catalog tests |
| REG-082 | 2 | done | Quest campaign ladder exposes authored local quest steps, contract requirements, progress/status rows, failure/retry rules, and Main Menu surfacing. | quest-campaign tests |
| REG-083 | 2 | done | Daily/weekly/season archive rows expose offline UTC identities, local streak/history summaries, share strings without PII, and Collection archive surfacing. | daily-archive tests |
| REG-084 | 2 | done | Puzzle packs expose medal rows, curation tier/order, completion progress, unlock status, and local-only author/version metadata. | puzzle-import tests |
| REG-085 | 2 | done | Run history exposes local journal/build/replay rows from RunSummary/RunState without creating a second save file or leaking PII. | run-history tests |
| REG-086 | 2 | done | Balance simulation exposes deterministic offline economy/drop-rate baselines for shop gold, findables, boss cadence, and relic offer rarity drift. | balance-simulation tests |
| REG-001 | 3 | done | Mobile gameplay chrome gives board-first ratio: tighter HUD/rail footprint, larger camera fit margin, and safe touch targets for common phone portraits. | tileBoardViewport tests + typecheck |
| REG-002 | 3 | done | Desktop gameplay stage uses denser play-dais spacing and wider fit budget to reduce dead space while preserving HUD/toolbar interaction. | tileBoardViewport tests + typecheck |
| REG-003 | 3 | done | Gameplay side rail is a canonical icon spine with integrated chrome, desktop flyout labels, compact mobile footprint, and unchanged keyboard focus order. | GameScreen + typecheck tests |
| REG-004 | 3 | done | Gameplay HUD defines primary/secondary/tertiary hierarchy with score/floor/lives first, tactical context second, and passive stats collapsed into an accessible details drawer. | GameplayHudBar tests |
| REG-005 | 3 | done | In-game rules hints use progressive disclosure: hidden by default after FTUE, explicit Rules toggle, contextual first-exposure nudges, and shortcut help remains available. | GameScreen tests |
| REG-006 | 3 | done | Settings page/modal keeps phone and short-view footer actions sticky, body scrollable, and dense category/subsection controls reachable without schema changes. | SettingsScreen tests |
| REG-007 | 3 | done | Game-over mobile layout keeps score/outcome and replay/menu actions above the fold, with detailed stat grids moved behind a post-run details disclosure. | GameOverScreen tests |
| REG-008 | 3 | done | Overlay modal shell uses explicit decision/sheet classes, internal scroll body, sticky safe-area action footer, and stable focus-trap behavior on mobile. | OverlayModal tests |
| REG-009 | 3 | done | Main menu mobile/landscape density exposes compact quick-action hierarchy, primary Play prominence, and non-competing secondary meta links. | MainMenu tests |
| REG-014 | 3 | done | Design-system density tokens expose compact/roomy panel/button/shell spacing tiers so major screens share dead-space language without one-off padding. | theme tests + typecheck |
| REG-028 | 3 | done | Short/mobile viewport matrix is centralized with expected compact, stack, camera, settings, and modal behaviors for high-traffic screens. | breakpoints/viewport matrix tests |
| REG-034 | 3 | done | Startup intro exposes a single hydration/skip/asset contract: keyboard and pointer skip request an exit, slow assets show readable pending/fallback state, focus returns to menu root, and menu pointer interaction remains blocked underneath. | startup intro contract/component tests + targeted e2e |
| REG-044 | 3 | done | Navigation return behavior is defined by a bounded route contract: menu/meta settings retain return targets, in-run meta overlays freeze/resume run state, invalid/null-run closes route to menu, and tests cover store plus navigation e2e flows. | navigation model/store tests + navigation-flow e2e |
| REG-016 | 3 | done | Meta progression exposes profile level, next reward, long-term goal, reward sources, and explicit gameplay-affecting vs cosmetic-only mode rules without a save schema bump. | meta-progression + save/store tests |
| REG-023 | 3 | done | Daily/weekly results loop exposes local current attempt, personal best/rollup, deterministic share strings, repeat-attempt rules, and explicit online leaderboard deferral in mode and game-over surfaces. | daily-archive + GameOver/ChoosePath tests |
| REG-026 | 3 | done | First-run onboarding is action-gated in live gameplay: fresh profiles get prompt/target guidance from actual board state, keyboard/pointer target selection is constrained to highlighted cards when possible, and completed/dismissed profiles suppress prompts. | playable-onboarding + GameScreen/TileBoard tests |
| REG-032 | 3 | done | Save/profile release shell declares single local profile scope, real profile summary rows, cloud sync unavailability, export/import/backup expectations, and non-destructive reset boundaries without a schema change. | profile-summary + Settings/MainMenu tests |
| REG-035 | 3 | done | Main menu profile/community strip uses real SaveData-derived level/title/crest/bests, clearly states community/social links are offline/local in v1, and preserves mobile density without fake online affordances. | profile-summary + MainMenu/Settings tests |
| REG-036 | 3 | done | Reference settings controls are modeled as live vs future placeholders; difficulty/timer/max-lives/card-theme rows remain disabled, non-persisted, and documented with migration, achievements, daily fairness, and rules-version implications. | settings-control-model + Settings tests |
| REG-010 | 4 | done | Choose Path has an above-fold selected-mode/start strip, explicit browse/search/page state, inline locked-mode explanation, tested discovery copy for filtered/empty library states, and a compact offline/social-scope note (`choose-path-offline-note`) pointing to Profile. | run-mode-discovery + ChooseYourPathScreen.test + e2e visual `01a-choose-your-path`, `01f-profile` |
| REG-011 | 4 | done | Collection, Inventory, and Codex each expose an active reward/progress signal from real save/run data, including next goals, build value, empty-state recovery, and local-only learning/deep-link prompts without new persistence. | meta-reward-signals + Inventory tests |
| REG-012 | 4 | done | Card interaction feedback has explicit material tokens for match, mismatch, invalid, and combo states, with distinct motion budgets and reduced-motion fallbacks aligned to existing WebGL/audio feedback paths. | gameplayVisualConfig + graphicsQuality tests |
| REG-013 | 4 | done | Brand/mode art has a production-intent poster manifest with custom vs fallback status, explicit fallback copy, catalog coverage tests, and Choose Path fallback badges for non-bespoke mode art. | modeArt + ChoosePath tests |
| REG-037 | 4 | done | Audio interaction matrix has a machine-readable runtime coverage map for startup/menu/settings/gameplay/overlay/meta call sites with cue, callsite, mix role, cooldown/polyphony policy, silent decisions, and reduced-motion safety. | audioInteractionCoverage + game/ui SFX tests |
| REG-038 | 4 | done | Music loop state derives menu calm/run focus/pressure/release/silent layers from view/run/hidden state, pauses on meta/pause/game-over, and keeps adaptive intensity observation-only with existing music volume settings. | gameplayMusic tests |
| REG-051 | 4 | done | Social layer is offline/local: share strings plus same-device pass-and-play (2-4 seats, a miss passes the turn). Still no persisted multiplayer field — a shared game sets no personal best, writes no run history and earns no achievement — online challenges remain REG-052-deferred, and the Choose Path scope note is generated from the decision rows rather than restated. | social-play-scope + pass-and-play-rules + runResolutionController + ChoosePath tests |
| REG-053 | 4 | done | Daily streaks use friendly UTC rules with no freeze bank in v1, missed-day reset copy avoids shame/pressure, rewards are cosmetic/profile-only, and menu/Choose Path explain reset timing and non-punitive behavior. | daily-archive + save-data + menu/ChoosePath tests |
| REG-054 | 4 | done | Economy stance is premium/offline-first: ads/IAP/subscriptions/pay-to-win are prohibited, core fairness/accessibility/powers are never monetized, shop gold remains a run system, and future monetization requires a separate product decision. | premium-economy-policy + Settings tests |
| REG-055 | 4 | done | Localization foundation records English-only v1, future react-i18next preference, stable copy owners/surface ids, no non-English UI promise, and guardrails against large new inline component copy. | localization-readiness + mechanics tests |
| REG-059 | 4 | done | Asset drop-in readiness covers UI scenes, mode posters, logos, card textures, audio, and store media with authoritative paths, formats, manifests/barrels, fallback behavior, rights state, risk, and verification commands. | assetDropInReadiness + modeArt tests + renderer asset audit |
| REG-064 | 4 | done | Mechanics glossary locks preferred labels and avoided terms for lives, guard tokens, combo shards, relic Favor, shop gold, relics, mutators, contracts, findables, and Perfect Memory; encyclopedia version and appendix are updated. | mechanics encyclopedia + appendix tests |
| REG-067 | 4 | done | Device motion polish is optional and user-initiated on touch devices, reduced motion hides/suppresses motion CTAs, unsupported platforms degrade silently, and haptics remain non-essential no-op polish in v1. | platformTilt permission/motion tests |
| REG-090 | 4 | done | Choose Path quality rollout is defined as a machine-readable screen-quality contract with per-screen rollout order, dependencies, placeholder/asset slots, offline/leaderboard scope, and verification routing for REG-091+. | REG_090_CHOOSE_PATH_QUALITY_ROLLOUT.md + JSON parse |
| REG-091 | 4 | done | Hub quality rows (mode entry, profile summary, return loop, trust boundary) remain defined from real save/run data via `getMainMenuHubQualityRows`; player-facing copy and stats live on **Profile**, while the main menu stays decluttered with a Profile entry and no fake social affordances. | main-menu-hub-quality.test + ProfileScreen.test + MainMenu tests |
| REG-092 | 4 | done | Settings acts as a control center with live control count, honest reference placeholders, profile trust, and mobile reachability rows surfaced above categories while Settings fields remain locally persisted and mapped. | settings-control-center + Settings tests |
| REG-093 | 4 | done | Collection has a final reward-gallery surface with owned, in-progress, and missing rows derived from local save achievements, profile goals, cosmetics, relic discovery, and run history, with honest local-only empty states. | collection-reward-gallery + Collection tests |
| REG-094 | 4 | done | Inventory has a run-prep board that summarizes active run setup, loadout capacity, mutable windows, and next prep action from REG-079 run inventory data while staying read-only/offline. | inventory-prep + Inventory tests |
| REG-095 | 4 | done | Codex has a final knowledge-base summary for guide depth, table depth, local deep links, and filter recovery derived from mechanics encyclopedia sources without changing run state. | codex-knowledge-base + Codex tests |
| REG-096 | 4 | done | Game Over surfaces a next-run loop with run-it-back, build recap, local share, and next-goal rows derived from local summary/run data, keeping Play Again/Main Menu above fold and no online ranking. | game-over-next-run + GameOver tests |
| REG-097 | 4 | done | Overlay decision sheets expose policy for alert/decision/sheet kinds with sticky one-hand action rails, keyboard/focus contracts, existing chrome, and no final licensed asset requirement. | overlay-decision-policy + OverlayModal tests |
| REG-098 | 4 | done | Main Menu help center replaces wall-of-text onboarding with skippable/replayable guided beats, points deeper help to Codex/Collection, and preserves gameplay first-run prompts from REG-026. | first-run-help-center + MainMenu/App tests |
| REG-099 | 4 | done | Navigation shell chrome/backstack invariants are machine-readable: page Back routes to menu, in-run meta preserves GameScreen, null-run recovery normalizes to menu, and game-over return stays local. | navigationModel + useAppStore tests |
| REG-100 | 4 | done | Empty/loading/error/locked state copy is centralized, actionable, local/offline-safe, and used by Inventory/Codex for no-run, no-relic, no-mutator, no-contract, and no-filter-result states. | ui-state-copy + Inventory/Codex tests |
| REG-101 | 4 | done | Copy tone rules align player-facing microcopy with mechanics glossary, premium/offline economy language, local scope, and concise mobile wording; shop buttons use “Spend shop gold” rather than real-money verbs. | copy-tone + mechanics/GameScreen tests |
| REG-102 | 4 | done | Responsive final device grid covers high-traffic shell screens across phone, tablet, short desktop, and desktop viewports with primary selectors, no-horizontal-scroll expectations, and layout summary helpers. | breakpoints/viewport matrix tests |
| REG-103 | 4 | done | Touch board stage uses `touch-action: none` for custom pan/pinch; 44px-class power targets; contract module documents gesture policy. | `regPhase4PlayContract` + TileBoard |
| REG-104 | 4 | done | Gameplay shell exposes stable `data-reg-gameplay-shell` variant (playing / paused / floor_clear) for composition tests. | GameScreen + `regPhase4PlayContract` tests |
| REG-105 | 4 | done | Board dais and WebGL stage expose `data-reg-board-dais` / `data-reg-stage-viewport` hooks for depth/camera regression. | TileBoard + contract tests |
| REG-106 | 4 | done | HUD exposes `data-reg-hud-primary-lanes` aligned to primary/secondary lane ids in the contract. | GameplayHudBar + `regPhase4PlayContract` |
| REG-107 | 4 | done | Power-verb teaching rail has stable anchor id `gameplay-power-teaching-rail` for toolbar teaching rows. | GameLeftToolbar + `power-verbs` data |
| REG-108 | 4 | done | Card material lanes documented and linked to `gameplayVisualConfig` / contract (`match`, `mismatch`, `invalid`, `combo`, `guard`). | `regPhase4PlayContract` + `gameplayVisualConfig` |
| REG-113 | 4 | done | `REG113_PLACEHOLDER_INVENTORY` re-exports full asset drop-in category table for ship slot tracking. | `assetDropInReadiness` tests |
| REG-114 | 4 | done | `REG114_MIX_DUCKING_TABLE` documents music duck multipliers for pause, overlays, relic draft, and run-critical SFX. | `audioMixDuckingPolicy` tests |
| REG-027 | 5 | done | Visual baseline epoch token for screenshot/CI refresh policy. | `regPhase5Hardening` REG027_VISUAL_BASELINE_EPOCH |
| REG-029 | 5 | done | Input path enumeration (keyboard, pointer, gamepad) for multi-path QA. | `regPhase5Hardening` |
| REG-030 | 5 | done | Local-only playtest telemetry schema token; no PII. | `regPhase5Hardening` |
| REG-031 | 5 | done | WebGL/graphics pass tied to DPR and anisotropy caps via `reg109QualityEnforcesDprAndAniso`. | `graphicsQuality` + `regPhase5Hardening` |
| REG-039 | 5 | done | Achievements: offline/local-first warning copy for Steam sync deferral. | `regPhase5Hardening` |
| REG-041 | 5 | done | Run export share scope string for local string export v1. | `regPhase5Hardening` |
| REG-042 | 5 | done | Toast dedupe window for score-pop hierarchy. | `regPhase5Hardening` |
| REG-043 | 5 | done | Pause contract: music stops with pause shell policy flag. | `regPhase5Hardening` |
| REG-056 | 5 | done | Minimum focus contrast ratio target for cognitive a11y. | `regPhase5Hardening` |
| REG-057 | 5 | done | User-facing WebGL context loss copy and recovery posture string. | `regPhase5Hardening` + TileBoard |
| REG-058 | 5 | done | Dev fixtures namespace token for state matrix. | `regPhase5Hardening` |
| REG-062 | 5 | done | E2E stability mode + worker cap hint for CI sharding. | `regPhase5Hardening` |
| REG-109 | 5 | done | Frame budget target and finite DPR/aniso/menu caps for every quality tier. | `regPhase5Hardening` + `graphicsQuality` |
| REG-110 | 5 | done | WebGL health enum and GPU context-loss copy. | `regPhase5Hardening` |
| REG-111 | 5 | done | Pointer-to-commit SLA in ms for responsiveness QA. | `regPhase5Hardening` |
| REG-112 | 5 | done | Reduced-motion suppression list for FX LOD / visual noise. | `regPhase5Hardening` |
| REG-120 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-121 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-122 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-123 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-124 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-125 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-126 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-127 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-128 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-130 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-131 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-132 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-133 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-134 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-135 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-136 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-137 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-138 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-139 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-140 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-141 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-142 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-143 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-144 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-145 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-146 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-147 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-148 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-149 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-150 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-151 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-152 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-153 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-154 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-155 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-156 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-157 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-158 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-159 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-160 | 6 | done | Phase-6 matrix; anchor in regPhase6Closure. | regPhase6Closure test + task md |
| REG-115 | 7 | done | Offline feature lock / release readiness token. | `regPhase7Ship` |
| REG-116 | 7 | done | Credits/legal surface route token. | `regPhase7Ship` |
| REG-117 | 7 | done | Save trust bundle token for import/export path. | `regPhase7Ship` |
| REG-118 | 7 | done | Demo vs full matrix checklist token. | `regPhase7Ship` |
| REG-119 | 7 | done | Product acceptance report bridge id. | `regPhase7Ship` test |
| REG-129 | 7 | done | Demo build matrix token. | `regPhase7Ship` |
| REG-060 | 7 | blocked | Windows+Steam runtime smoke; blocked until host environment exists. | `REG_BLOCKERS_AND_DEFERRALS` |
| REG-061 | 7 | deferred | Final licensed store media; deferred until assets/rights land. | `REG_BLOCKERS_AND_DEFERRALS` |

default_contracts:
  runtime: implement minimal offline-capable vertical slice; no mandatory online service.
  ui: must meet responsive/touch quality for affected surfaces.
  schema: if SaveData/Settings/PlayerStatsPersisted changes, run REG-089 gate and migration tests.
  rules: if RunState/rules/catalog/generated identity changes, run REG-089 gate and deterministic tests.
  assets: placeholders allowed; final licensed art/audio/store media may be deferred with unblock condition.
