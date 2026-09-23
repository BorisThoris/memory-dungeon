# Balance notes (K2)

Post-relic / post-mutator tuning. Constants live in `src/shared/contracts.ts` unless noted.

## Recent intent

- **2026-09-23 the pop was taking the board, and the hook was reworked around a capped break (`chunk-break-rules.ts`, `tile-suit-rules.ts`, `floor-par.ts`, `chain-tier-rules.ts`):** the player said a match popped half the board, and measured on the scheduled floors with a clean player it was worse - the pops took 65% of a floor's pairs, the biggest break averaged two thirds of the board, and 172 floors of 192 saw a single break take at least half of what stood. A lone match now takes nothing; the pop is Clean's, capped at one pair, two at Sharp, four at Fever, one step of reach, a two- or three-wave reaction, the bridge Fever's alone, the drop one pair, no two-suit floors past the first, the breather's rest moved from its palette to a +1 on the cap. After: the player matches 61%, the biggest break is 13-20% of a floor. Par re-derived at 0.72 turns a pair (clamped at the pair count, two-turn opening allowance, no palette factor - measured, two suits and four are now the same board); Sharp and Fever shares 0.55 / 0.75; cascade bands re-drawn (chunk share 0.25-0.6, largest break 0.1-0.5, reference ceiling 0.03); pop-reach floors read at Clean; the drop banded `core`. `docs/CHAIN_CHUNK_FEVER_DESIGN.md` §13. Codex v43.
- **Gen 249 the 9px Deck floor is met by six tenths of a pixel, and nothing was measuring it (`e2e/uiFit.ts`, `ui-scale-ceiling.spec.ts`):** #204's first criterion is Valve's, quoted: *"the smallest on-screen font character should never fall below 9 pixels in height at 1280x800"*. The repo answers it with a **12 declared px** floor, which reads like 3px of margin. **It is not.** The UI scale is a `zoom` and the slider's BOTTOM is 0.8, so a 12px declaration reaches the eye at **9.6px**. Measured on a 1280x800 panel at 0.8: **9.6px** on the main menu ("Seeker of Shards"), **9.98px** in a run ("Best"). It clears Valve's floor - by six tenths of a pixel. **And the rule that guards readability could not have seen a violation:** `undersized` in the fit report read `getComputedStyle().fontSize`, the LAYOUT size, which is 12 at every scale. **The same unit error as the chrome clearance (Gen 237) and the chain rail (Gen 239), this time in the check itself** - three instances now, in three subsystems, all invisible because scale 1 is where the two units agree. Fixed: `undersized` measures painted px, with a hundredth-of-a-pixel epsilon because at scale 1 the ratio is a division of two measured boxes and can land on 0.9999, which would report every screen as undersized. The change can only fire MORE at scales below 1 and LESS above, which is the correct direction in both. And the criterion now has a check that pins **the number that ships rather than the number that is declared**, with its negative control run: raising the floor to 10 fails with *"Seeker of Shards paints at 9.6px on a Deck panel at the slider's floor; Valve's minimum is 10px"*.

- **Gen 248 the chrome rows answer for themselves too, and #253 is closed (`navigationModel.test.ts`):** The other half of the decorative layer. The four rows are mostly prose - `route` and `chrome` are sentences - but `preservesRun` is a claim the code can be asked about: **"the run survives this move" and `boardMounted` are the same statement in different words**, since a mounted board is what keeps gameplay alive under the overlay. Each row now names the case it describes (page back, in-run meta, null-run recovery, game-over return), and the test builds that case and asks `getNavigationShellChromeContract` - the if-chain App.tsx actually uses. **Negative control run:** flipping `in_run_meta` to `preservesRun: false` fails with *"row in_run_meta says preservesRun=false, but the shell keeps the board (gameplay_modal)"*. The row count is pinned too, so a new row cannot be added without naming its case. **Baseline 107 → 106, 4 exempt by name**, and every one of those four exemptions is a symbol whose test checks the game rather than the description. **#253 closed: both layers of `navigationModel` are now load-bearing.** The module that began this thread as "six exports nothing reaches" ends it with two sets and two tables the app cannot quietly contradict.

- **Gen 247 the route table is checked against the app now, not against itself (`navigationModel.test.ts`):** #253 said the two layers speak different vocabularies - the table keyed `(from, to, action)` on a navigation surface, the resolver switching on a store action like `openInventoryFromPlaying` - and that reconciling them was the work. **They reconcile:** every store action IS a route triple. So rather than rewrite the resolver to read the table (the risky direction), the test now asserts the **behaviour against the record**: for each action the row must exist, `resolveNavigationTransition` must land on the view the row promises, and `timerPolicy: 'freeze-on-open'` must mean the transition actually freezes the run. **Negative control run, not described:** flipping the `playing -> inventory` row to `timerPolicy: 'none'` fails with *"openInventoryFromPlaying: the contract says timerPolicy none, the resolver freezes"* - the table and the app can no longer disagree in silence. That changes what `getNavigationRouteContract` IS: it was a getter whose test checked the description was self-consistent, and it is now the lookup a behaviour check reads, so it leaves the baseline as an **exemption with its reason written down** rather than as debt - **107, 3 exempt by name.** `getNavigationShellChromeRows` is still decorative and stays in the baseline; the chrome half of #253 is not done and the task says so.

- **Gen 246 classified the remaining 108, then caught the classification being wrong (`test-only-exports-baseline.json`):** Five generations of one-cluster-at-a-time triage is slow, so I tried to split the rest by the distinction that mattered in Gen 245: is the module holding the export **live**, or is it a record whose test is meant to be its only consumer? The script said 63 live modules (99 entries) and **six modules with no runtime importer at all** (9 entries) - names that read exactly like record-by-design: `softlock-generator-contract`, `audioInteractionCoverage`, `content-security-policy`, `color-vision`, `power-verbs`, `long-run-depth`. **Spot-checked all six rather than believing it, and it was wrong on every one.** Four have runtime importers in `src/` (`gameplay-interaction-graph.ts`, `audioMixDuckingPolicy.ts`, `release-checklist.ts`, `tile-trait-rules.ts`) and two are consumed by `scripts/`. My grep under-counted importers. **The error is only in one direction, which is what saves the result:** a false negative moves a module INTO the live bucket, never out, so the corrected conclusion is the stronger one - **every module holding a baselined export is live, and none of the 108 is a record-by-design symbol.** Each is a decorative tail on working code and wants the Gen 245 treatment. Written into the baseline's own `why` field, where the next triage will read it, **including the warning that the heuristic under-counts and that nothing may be excused on its strength**. No code change: the deliverable is a map that is honest about its own error bars, which is worth more than five more generations of guessing where to start.

- **Gen 245 a record that contradicted the code it described (`navigationModel.ts`):** Next cluster of the baseline triage - six navigation exports nothing but their own test reaches. **The module is live** (App.tsx, metaOverlayExecutor and metaOverlayState import it), so this is not a dead module; it is a live one carrying a **decorative tail**. `NAVIGATION_ROUTE_CONTRACTS` is read only by a getter that is itself test-only, and the live `resolveNavigationTransition` is a hand-written switch that never consults it; `getNavigationShellChromeRows` has no reader at all, and the live `getNavigationShellChromeContract` is an if-chain that ignores it. **And the two layers had already drifted, demonstrably:** `IN_RUN_META_VIEWS` said `['inventory', 'codex', 'settings']`, it had a TWIN (`IN_RUN_OVERLAY_VIEWS`) with the identical three entries and a predicate of its own, and the code that decides this for real inlined `view === 'inventory' || view === 'codex'` - **excluding settings**, which is answered by its own branch above. Record said one thing, shipped behaviour did another, nothing could catch it because nothing connected them. **Fixed by making the record load-bearing rather than by tidying it:** one set, spelling what the app does, and the app reads it - change the set now and the shell changes. The twin and its predicate are gone. **No behaviour change** (the set is exactly the condition it replaced; 38 tests across navigationModel, metaOverlayState and App pass), and **two entries leave the baseline by gaining a caller rather than by being excused: 110 → 108.** The route table and the chrome rows are still decorative and are #253, with the reconciliation named as the actual work: the two layers are keyed on different vocabularies, and **a description nothing enforces is worse than none, because a reader trusts it.**

- **Gen 244 the exemption list, sized by a sweep rather than by convenience (`scripts/test-only-exports.ts`):** Gen 241 flagged two baselined exports as mislabelled - they have real consumers the audit cannot see, because Playwright specs and build scripts reach into the app through a DYNAMIC module URL (`import('/src/renderer/components/tileTextures.ts')`) and this audit reads static relative imports. **Rather than exempt the two I happened to notice, I swept all 112** for a mention anywhere in `e2e/` or `scripts/`: **exactly two hits, the same two.** `clearTileTextureCachesForDebug` (a bake script plus two illustration specs) and `getIllustrationPipelineDebugState` (two regression specs). The other 110 really are reached by nothing but their own test, which is worth knowing precisely: it means the baseline is debt rather than a measurement artefact. Both are now exemptions **named with their reason**, the module's "what this cannot see" paragraph names the blind spot alongside the `import * as` one it already admitted, and the sweep is recorded there too - **an exemption list is only honest if someone checked how long it should be.** Baseline **112 → 110, 2 exempt by name.**

- **Gen 243 deleting dead code found a live starvation bug (`tileTextures.ts`):** #251 asked whether `prewarmTileFaceOverlayTextures` - a finished optimisation with no caller - should be wired or deleted, and said to measure first. **The cheapest question answered it without a stopwatch:** `runDemandDrivenTileFaceOverlayPrewarmSession` **is** wired (`useTileBoardSceneResources.ts`) and its doc says it enqueues *"only pairKeys the board currently cares about"* - the narrower, smarter version of the same job. The eager whole-board prewarm was **superseded**, not forgotten, so it goes. **Then the deletion earned its keep.** One of the two tests it owned covered the idle-scheduler FALLBACK, machinery the surviving session shares, so rather than lose that coverage I re-pointed both tests at the demand session - **and the fallback test went red.** Read: `pumpDemandOverlayPrewarm` breaks out when `deadline.timeRemaining() <= 2`, and the timer fallback in `schedulePrewarmStep` hands over a deadline whose `timeRemaining()` is **0**. So whenever `requestIdleCallback` is missing or throws - **the exact case the fallback exists for** - the demand prewarm bailed on the first key every time, left the queue untouched, rescheduled, and span an endless chain of zero-work timers **without warming a single bitmap**. The eager path made progress there, so deleting it blind would have taken the only code that worked under the fallback with it and left the starvation in place, unnoticed, behind a passing suite. **Fix:** draw at least one before yielding (`processed > 0 &&`). The red test is the negative control, demonstrated in both directions. **Baseline 113 → 112**, and the class of finding is worth more than the count: *dead code is worth deleting carefully, because what it covers may be the only thing covering something live.*

- **Gen 242 the red spec was right, the bookkeeping was stale, and nothing was watching (`package.json`, `e2e/fixtures/tile-card-face-illustration-regression.json`):** Gen 241 found `tile-card-face-illustration-regression.spec.ts` failing at HEAD. **Read properly, the hashes passed and only the metadata failed:** `textureVersion` 49 expected against 51 received. Regenerated and diffed: **all 72 hashes identical, zero keys differing** - the only change in the fixture is that one number. **Why:** the two bumps came with `b1c4f7a1` ("Regenerate art and audio on upgraded local models") and `ac80c37e` ("Restore the SDXL card fronts"), which replace **authored PNG card fronts**, while this spec hashes **procedural** illustrations drawn from fixed seeds. Authored assets cannot move a procedural hash, so the hashes holding is the correct result and the fixture was simply behind. **The assertion is not the problem and was not weakened.** `writeUpdatedFixtures` refuses to regenerate when hashes change without a version bump, so the pinned version is half of a real contract - "bump a version before the art may change" - and pinning it also catches the inverse, a cache invalidated for every player with nothing to show for it. **What was missing was a gate.** `test:e2e:illustration-regression` existed as a standalone script that `fullcheck` never called, so two art drops landed, the spec went red, and nobody heard. Now `gate:illustration-regression`, in `fullcheck` beside `gate:ui-fit`, **16 seconds** against that gate's 19 minutes. **Third time this week the finding was that the instrument was not wired:** Gen 236 for the fit contract, Gen 241 for this spec's existence, this one for the gate.

- **Gen 241 one of the 114 test-only exports was a second copy of a live constant (`cardFace/staticCardTextureSize.ts`, `tileTextures.ts`, `cardRasterDeck.ts`):** Left the layout work and took the broadest non-layout item in the queue - the 114 exports the audit says only their own test can reach - starting with the two biggest single-file clusters. **The first entry I checked was not debt at all.** `getStaticCardTexturePixelSize` reads as test-only because `cardRasterDeck.ts` does not import it: it **defines its own copy**, `getStaticCardTexturePixelSizeLocal`, over the same two constants, with the reason in a comment - *"no import - avoids cycles"*. **The reason is true** (`tileTextures.ts` line 38 imports `cardRasterDeck` for the composed overlay, so the other direction is a genuine cycle) **and the copies did agree** - but nothing checked that they would keep agreeing, and the failure mode is silent: raise the height in one and the raster deck keeps computing its illustration rect against the old number, which shows up as slightly wrong art rather than as a red test. Both now import one leaf module; `tileShatter` imports only three leaves of its own, so neither side imports the other and the cycle never forms. **Baseline 114 → 113, and the audit named the stale line itself** rather than needing to be told. **The rest of the cluster, triaged:** two entries (`clearTileTextureCachesForDebug`, `getIllustrationPipelineDebugState`) have real non-test consumers - a bake script and two e2e specs - reached through dynamic `import('/src/…')` URLs the audit cannot follow, so they are mislabelled rather than dead. One (`prewarmTileFaceOverlayTextures`) is a finished optimisation that **never had a caller at all**: `git log -S` over `TileBoard.tsx` and `GameScreen.tsx` returns nothing, so it did not lose one, it never got one - the `createInventoryScreenModel` shape again (#251, and it needs the timing measured before anyone wires it). **And verifying this change found something bigger than it:** `tile-card-face-illustration-regression.spec.ts` is **red at HEAD** - confirmed by stashing every file this generation touched, the untracked one included, and watching it fail anyway - and **no gate runs it**. `package.json` has it as a standalone script and `fullcheck` never calls it, which is Gen 236's finding again in a different corner: an instrument nothing invokes rots and reports nothing. Filed as #252 with the order of operations spelled out, because `regenerate:illustration-regression` makes the wrong fix one command away.

- **Gen 240 measured #250 and refuted both of its candidate fixes, then stopped rather than guess (`RunShell.module.css`, diagnosis only):** The task said the chain rail is drawn over the floor-clear beat and offered two fixes - hide the rail during the beat, or inset the beat from the rail - with an instruction to measure before choosing. **Measured on a 1280x800 Deck panel, fresh arrival per scale, both are wrong about where the collision is.** The boxes, in layout px and constant across scales: `.chain` declares **64..272** (13rem) and `.ladder` fills it, **64..272**; the beat's panel is **282..1216**, already clear of the rail's declared box by 10px. What the beat actually meets is **`.chainRead` at 176..408** - `position: absolute; left: 7rem; white-space: nowrap` inside a 13rem container, **overflowing its own box by 136px**. The beat's title is 445..1053 at scale 1 (37px of clearance) and 387..995 at 1.1, which puts it 21px inside the read. So the rail's declared width has never contained its own content, and the two surfaces have been 37px apart at the only scale anything measured. **Neither candidate survives that.** Hiding the rail loses a live read - the chain that produced the floor's result is still the one on screen, and `chunkPairsThisChain` does not reset until the next floor. Insetting the beat past 408 moves its title from 445 to about 516 **at scale 1**, a 71px shift on a hand-designed screen that currently passes at every window. Moving the read left instead buries it under the ladder, which spans the rail's full width, and it would have to start at about 2rem to hold at 1.2. **No measured winner, so no change shipped:** the fix is a design decision about what the left column is, not a number to correct, and this session's own record says an unmeasured hypothesis is the expensive path (Gen 233's refuted `.chainGoalValue` change, Gen 234's self-inflicted laptop regression). #250 carries the geometry, the three refutations and the numbers behind them.

- **Gen 239 the chain rail was frozen in the window while the game shrank around it (`RunShell.module.css`, `uiScaleLimits.ts`, `ui-scale-ceiling.spec.ts`):** Gen 238 found the run to be the lowest ceiling in the game - at **1.1, the cap the slider was shipping**, the rung goal sat under the caption on a Deck panel. **Measured, the cause was two CSS lengths:** `--ladder-h: clamp(15rem, 44vh, 25rem)` and `top: clamp(11rem, 27vh, 15.5rem)`. `vh` is a viewport unit and a viewport does not zoom, so inside the UI scale's `zoom` both resolve to a share of the WINDOW and are then used as layout lengths. The block sat at **216..672 layout px at 1, 1.05, 1.1 AND 1.2 - identical, frozen** - while the shell it lives in shrank **800 → 762 → 727 → 667**. Everything else in the run moves with the box, so the run line under the board rose into the rail's goal and covered it, and by 1.4 the whole block was past the bottom edge. **Fix:** a share of `--ui-zoomed-dvh` instead, the property `App.module.css` publishes for exactly this - at scale 1 it is the same number `vh` gave, so the block is byte-identical (216..672) at the size everything was drawn at, and tracks the box above it (196..621 at 1.1, 180..578 at 1.2). **The run went 1.05 → 1.2**, verified at 1 / 1.05 / 1.1 / 1.2 on both windows with 1.4 still failing as the control. **Then the floor-clear beat was measured, and it is the new lowest.** The same rail is drawn over it: at 1.1 on the Deck it lands on the beat's own title, par line and personal best, and a stash confirmed that predates this change. So **the cap stays 1.05** - the same number as an hour ago, for a different and now-named reason, which is the whole point of a row per screen. The beat has its own row and its own check now; fixing it (#250) takes the cap to 1.2, then 1.4 where Codex and Settings wait. **A measurement lesson worth more than the fix:** the beat is TRANSIENT, and the first probe opened it once and changed the scale three times - two runs of it disagreed about the same scale because they were reading three different instants of a surface that clears itself. The spec re-arrives per scale and says why.

- **Gen 238 the cap was never Profile's, and it was never a menu screen's (`MetaShell.module.css`, `ProfileScreen.module.css`, `CodexScreen.tsx`, `uiScaleLimits.ts`, `save-data.ts`):** Task #246 said Profile pinned `UI_SCALE_MAX` at 1.1 by clipping at 1.4 on a Deck panel. **Measured, the cause was a unit error, not a layout one.** Profile owns a compact arrangement - hide the tier rail, six numbers in a fixed six-column row - written as `@media (max-height: 560px)`, and **a media query reads the WINDOW**. The UI scale is a `zoom`: it shrinks the box a screen lays out in and leaves the viewport alone. At 1.4 on a 1280x800 panel Profile lays out in **914x571** - laptop-sized - and every rung it owns still saw 800px, so the desktop arrangement was drawn into a box that could not hold it: the summary wrapped to two rows (66 -> 157 layout px), and the ledger, the only flexible region, took the whole cost and fell to a **44px** frame that clipped every card. The rung it needed was already written and worth the exact deficit ("its 75px is the difference between the ledger measuring a 25px frame and one that fits a row"). **Fix:** `MetaShell` is a **size container** and Profile's three rungs ask the box (`@container meta-shell`) instead of the window, thresholds re-derived from the box heights measured at every window and scale. Profile went from **1.1 to 1.6**. **Then the sweep that was supposed to justify raising the cap found two things instead.** Codex clipped an entry's summary from **1.1** - its card row was sized at 146px for a one-line title, and the columns narrow as the scale rises (249 -> 235px) until the longer titles take two lines and the 24px comes out of the summary below; sized for its own worst case (160px, measured) it holds to **1.4**. And then the run itself was probed **for the first time at any scale but 1**, and it is the lowest of everything: at **1.1, the cap the slider was already shipping**, the chain goal line sits on the chain state on a Deck panel. **Every ceiling this system had ever recorded was a menu screen - the screen a player spends the whole game on was not on the list.** So the cap comes **down, 1.1 -> 1.05**, in `SCREEN_SCALE_CEILINGS` and in the slider's own range, because a rung the game cannot render in play is worse than a shorter slider: the player who most needs large text is the one who reaches the top of it. `ui-scale-ceiling.spec.ts` now carries five rows including the run, each with its negative control breaking one rung above (6 passed, 9.0m), and its ladder is deduped, sorted and carries 1.05/1.1/1.2 because these failures are close together and Codex's was not even monotonic. Fixing the run's chain HUD (#249) takes the cap to 1.4, not 1.6. **`gate:ui-fit` after all of it: 20 passed, 18.5m** - the 18 fit-contract specs at 18 screens x 6 windows plus Gen 237's two clearance specs - so making `MetaShell` a size container, which every meta screen sits inside, regressed nothing at scale 1.

- **Gen 237 the in-run chrome clearance was measured in painted px and written back as a CSS length (`useGameplayChromeClearance.ts`, `ui/cssZoom.ts`, `e2e/gameplay-chrome-clearance.spec.ts`):** A lead filed rather than acted on in Gen 228, with the instruction to **measure first**. Measured, on a 1280x800 Deck panel and a 1440x900 desktop, same run on screen at each scale: **the HUD occupies 118.4 layout px at every scale**, and the hook published **95px at 0.8, 118px at 1, 130px at 1.1** - the span times the zoom. The hook took both numbers off `getBoundingClientRect()`, which reports the PAINTED box, and wrote them out as CSS lengths, which the same zoomed subtree reads as LAYOUT px. **What that did to the game, which is the measurement that counts:** the board stage insets itself by exactly those properties, so at 0.8 it began **18.7px under the HUD** - the cards printing beneath the score, the precise fault the inset exists to prevent - and at 1.1 it stopped **12.8px short**, a dead strip. At scale 1 it was flush to within 0.4px, **and scale 1 is what every automated check in this repository pins**, which is why a system built to prevent this, running every frame, could be wrong for its whole life without a single red test. **Fix:** one divide, by a zoom read off the shell's own two boxes (`readCssZoom`, the same visual-vs-layout distinction Gen 228 named in `readFrameBox`). Re-measured: -0.31 / -0.39 / -0.42 across the three scales, flush everywhere. **The gate, with its negative control done rather than described:** `gameplay-chrome-clearance.spec.ts` checks the painted result - the stage's top against the HUD's bottom - at the bottom, middle and top of the slider's own travel read from `SETTINGS_NUMERIC_RANGES`, and asserts the measured zoom matches the scale it asked for, because a probe that silently applies nothing reports three identical passes (how the Gen 222 ceiling was measured wrong). Reverting the divide, the spec fails with four named rows; with it, 2 passed. Folded into `gate:ui-fit`, +54s on a 17-minute gate. **Swept for siblings:** three `setProperty` call sites in the renderer, and this was the only one writing a rect-derived length; the other two write unitless tilt and theme tokens. `FittedGrid` was the same class, fixed in Gen 228. **The class is now empty.**

- **Gen 236 I had said it seven times and half of it was false (`package.json`):** Every write-up this week ended on the same line - *"neither `yarn build` nor the fit contract is in the routine verification path"* - offered as the reason all eleven fit defects shipped. Read properly, **`fullcheck` is `lint && gate:security && gate:package-hygiene && gate:desktop-build && gate:build-output && gate:systems && gate:ui-reachability && verify`, and `ci` is `yarn fullcheck`.** `gate:desktop-build` **is** `yarn build:electron`; `gate:build-output` runs a `vite build`. **The build was gated the whole time.** What misled me is that I ran `gate:systems` each generation and called that the routine path; it is one line of eight. **The other half was true and is now fixed:** `gate:ui-reachability` runs `ui-reachability-gate.spec.ts`, a different spec - the fit contract appeared in **no** gate, which is why eleven defects across nine screens reached `main` under a green `fullcheck`. `gate:ui-fit` runs it, in `fullcheck`, beside the reachability gate it is the twin of. **The cost, stated rather than discovered by whoever runs it next:** 17.3 minutes, the longest gate in the file by a wide margin. That is the price of the only instrument that can see this class at all, and this week it found eleven. **What this is an instance of:** a claim repeated until it sounded established, never re-derived - the exact defect this session has spent a dozen generations removing from the codebase (a ledger stamped before the game moved, an exemption naming a blocker gone for eight generations, a spec asking for a mode retired at the collapse). It is worth more as a correction than the gate is as a gate: **the seven repetitions were mine, in the same week I was fixing other people's.**

- **Gen 235 the last two: a column of full-width buttons spends width to save no height, and the mode was named twice (`GameOverScreen.module.css`, task #248):** Game over was over the edge at the two smallest windows - **866px of page in an 844px phone** and **419px of rail in a 375px landscape** - dropping the next-run loop past the fold in both. **Landscape:** the rail's bulk is `.actionButtons`, 231px of buttons stacked one per row in a rail **350px wide**. Width was never the problem on this screen and height always was, so a single column was spending the one to save nothing of the other; two-up turns four rows into two and gives back about 110px, which is twice what the landscape needed. **The phone did not move, and the reason is worth keeping:** a rule at `max-width: 760px` had *already* made those buttons two-up, so the new rule only newly applied to the 812-960 band - which is exactly why landscape changed and the phone did not. Measuring rather than assuming the fix had landed everywhere is what caught that in one run instead of two. **The phone's own 29px came from a line that says what the line above it says:** `.modeIdentity` - *"Classic descent: chain..."* - under a heading reading *"Run complete · Classic"*. It is 40px on a phone, and the overflow was 29. That rule already existed for short landscape, with the argument already written into the file (*"the heading directly above it already names the mode, so it was spending a seventh of the window saying the same thing twice"*); this extends the same rule to the one other window with no room for it. It stays everywhere else, because it is the one place a run summary says what the mode's contract actually was. **The fit contract is green at all eighteen screens and all six windows.** Four defects were enumerated at Gen 231 by the harness that stopped hiding them; they are closed at Gen 232, 234 and 235. **Eleven fit defects found and fixed this week**, every one of them shipped, none of them visible to `yarn lint`, `tsc`, 2800 unit tests or `yarn gate:systems` - which remains the gap worth naming: **neither `yarn build` nor the fit contract is in the routine path.**

- **Gen 234 two grid items were pinned to opposite edges of one cell, which is a row only while the cell is wider than both (`RunShell.module.css`, task #248):** The last defect on floor clear: at 812x375 the HUD printed *"Chain 2 - Sharp"* over *"3 momentum to Fever"*. **Measured:** the compact `.chain` is a named-area grid, `'mult read' / 'mult ladder'`, and BOTH labels are assigned **`grid-area: read`** - one `justify-self: start`, one `justify-self: end`. The cell is 222.6px, the labels are 122 and 118, so they collide by exactly the **17px** they are over. A layout that works above a width nothing checks. The cure is the row the code had already asked for: `.chainRead` dissolves at compact layouts (`display: contents`) so its three children can take named areas, and that **threw away its own `flex-direction: column` and 0.15rem gap** along with the box they applied to - the goal gets that row back. **The hypothesis that died first, recorded at Gen 233 so it would not be tried twice:** the goal's tail `×8 per pair` repeats what `.rungValue` already prints as a large numeral in the same row, so hiding it looked like a §105 duplication fix and a 60px saving at once. Applied and measured: the rule took effect (computed `display: none`, width 0) and **the goal box did not move** - still 674..792. Grid places these labels, not their text, so removing text cannot close the gap. Reverted rather than shipped with a comment claiming a fix it did not deliver. **And the first version of the real fix broke a window it was not aimed at, which is the part worth keeping.** Applied to all three compact layouts, the extra row grew the tablet HUD - and since Gen 230 the floor-clear beat is inset by the HUD's **published clearance**, so a taller HUD pushed the beat's notes past the board stage's clip on a **1024x768 laptop**, a window that had been passing. The new one-assertion-per-sweep harness from Gen 231 is what said so in the same run rather than two generations later. Scoped to `phone-landscape` on that measurement, not on taste: the collision is a short-landscape problem and the cure belongs where the problem is. **`floorClearWithRouteChoices` now passes at every window**; the board and the four-seat run bar still do. **Two left, both on game over:** a phone clips *"Next: Bronze Crest"* and drops the next-run loop, and short landscape clips *"No chain yet..."* with the same loop below the fold.

- **Gen 232 the board's own keyboard entry point was off the bottom of a phone, because one of two paths to the same box was only ever checked where it worked (`GameScreen.tsx`, task #248):** The fit contract reported the board stage below the fold on a 390x844 phone during the floor-clear beat, and - worse - `[tile-board-application]` **unreachable**: the `role="application"` node that is the keyboard and controller entry point for the entire board, with its centre outside the window. **Measured: the frame laid out at 398..1242 in an 844px window**, nearly 400px past the bottom, because it computed `position: relative` and took `height: 100%` of a stage it had been pushed 398px down inside. **The attribution took four probes and two of my own hypotheses died on the way, which is worth recording because the wrong ones were the plausible ones.** It was not the cascade: a bare element carrying the same two classes computes `absolute`, so the rule is served and the class list is right. It was not an inline override on the phone: the phone element's `style` attribute holds nothing but two tilt variables. What the probes actually found is an **asymmetry between two code paths that are supposed to produce the same box** - `frameStyle={cameraViewportMode ? undefined : DESKTOP_FULL_BLEED...}`. Desktop gets the fill as an **inline style**, which cannot lose; the phone was left to `.frameMobileCamera`, which declares the identical four properties and, in the frame's real ancestor chain, **does not win**. One path guaranteed, one path hoped, and the hoped one was only ever looked at on the viewport where it happened to hold. **The fix is to stop having two paths:** the constant is `FULL_BLEED_TILE_BOARD_FRAME_STYLE` now and both modes get it. The phone board goes **398..1242 to 0..844**, its centre lands inside the window on the board's own canvas, and both the below-fold and the unreachable readings clear; desktop is unchanged at 118..809 and `the board fits every window` still passes. **What I did not settle, said plainly:** which rule in the ancestor chain beats `.frameMobileCamera`. The inline style makes the question moot for the box that matters, but the class is still there and still losing, and a later generation that leans on it will meet this again. **One left on this screen:** at 812x375 the HUD's "Chain 2 - Sharp" and "3 momentum to Fever" share pixels.

- **Gen 231 the contract stopped at the first window that failed, so four generations each fixed the head of a queue (`e2e/ui-fit-contract.spec.ts`, `GameOverScreen.module.css`, task #248):** Game over put its next-run loop past the bottom edge on an **834x1112** tablet. Measured, the screen is **1133px tall in a 1112px window**: at that width `@media (max-width: 960px)` stacks the two columns, and stacked they sum instead of taking the taller. **The fix was already written down in the file, in words, keyed to the wrong thing.** Twelve rules further on, the short-landscape block says exactly the right principle - *"The width is there, so the result and the next move stay side by side rather than stacking into a page twice the window's height"* - but it is keyed `max-height: 560px`, so a **tall** tablet never reaches it. It is keyed on the width it talks about now, for 700-960px, and the page is **692px** rather than 1133. **The previous attempt is in the same file and was honest about stopping short:** a comment records that putting the two next-run cards side by side in the stacked rail saved 83px off a column that "already ran 44px past the bottom". Shaving 83 off 127 leaves 44, and 44 is what was still over the edge. Fixing the stacking removes the 127. **The larger finding is about the instrument, not the screen.** `atEverySize` asserted per viewport, so the sweep **stopped at the first window that failed** and the later ones were never measured at all. That is why the last four generations each read as "fixed it, and now a new failure appeared": the desktop clip on floor clear was hiding a phone defect, the tablet overflow on game over was hiding a phone one **and** a landscape one, and the mode sheet's stale locator was hiding a landscape clip. Every one of those was present the whole time; nothing had ever looked past the head of the queue. It collects every viewport and asserts once at the end now, and the very first run proved the point - **one run reported both remaining game-over windows** where the old shape would have taken two more fix-and-rerun cycles to discover the second. **What the new instrument says is left, in full, because enumerating it is now cheap:** game over clips *"Next: Bronze Crest"* and drops the next-run loop on a **phone**, and clips *"No chain yet..."* with the same loop below the fold in **landscape**; floor clear puts the **board stage** below the fold on a phone with the board's own application node unreachable, and overlaps *"Chain 2 - Sharp"* with *"3 momentum to Fever"* in landscape. Four defects across two screens, none of them new, all of them now visible in two runs instead of four generations.

- **Gen 230 the floor's numeral was not a watermark, it was a 406px banner, and one `:not()` is the difference (`FloorClearBeat.module.css`, task #248):** The fit contract said floor clear clipped a route line on a **1440x900 desktop** - the most ordinary window there is - and the line it cut was *"Downstairs: ..."*, the one that tells you who you are about to share a room with. **The cause was two rules with the same specificity and the wrong one last.** `.watermark` sets `position: absolute` so the floor's numeral sits behind the text at 9% opacity; twelve lines later `.colophon > *` sets `position: relative` to lift the real children above it. One class each, so equal specificity, and the later one wins - **the watermark had been in the flow all along**, a 336px glyph occupying **406px** above the title. The card measured **719px in a stage 691px tall**, so it overhung the stage's clip and the last note went over the edge. It is `.colophon > :not(.watermark)` now and the card is **383px**. Nothing in the CSS said which of the two it was rendering, and nothing at any viewport had ever asked. **Fixing it exposed the defect it had been hiding, which is the second finding and the more interesting one.** With the accidental 406px spacer gone, the beat's title rose into the HUD on a phone: measured A/B at 390x844, **0 covered and 0 overlapping before, 1 and 8 after** - the bug had been holding the title clear of the run bar by accident. The real fault is older and was simply never reachable: `.beat` was `inset: 0`, centring itself in the whole stage **as though the HUD above and the dock below were not there**. The shell already publishes `--gameplay-hud-top-clearance` and `--gameplay-dock-bottom-clearance` for exactly this and **four other rules read them**; this one guessed. It reads them now, and the beat sits at 145 rather than 0 on a phone with both counts back to zero. **Why that A/B was run rather than reasoned:** the numbers going up after a fix is what a regression looks like, and the only way to tell a regression from an unmasking is to measure the same viewport both ways. **Two remain, both pre-existing and both recorded rather than forced into this generation:** floor clear on a phone still puts the **board stage** below the fold (present in both arms of the A/B, so nothing to do with the beat), and game over still puts its next-run loop past the bottom edge on a tablet. Neither had ever been reported before this week, because the contract stops at the first failing viewport and desktop was failing first.

- **Gen 229 four of the six "broken specs" were the fit contract working, and one of them had been hiding a defect for generations (`RunShell.module.css`, `ChooseYourPathScreen.tsx`, task #248):** Gen 228 recorded that the fit contract reports 6 failed / 12 passed and called them all `toBeVisible()` locator failures - the specs "cannot open their screen at all". **That was wrong, and wrong in the way this repository keeps catching itself:** one error line from a summary was read as the shape of all six. Read individually, **five are real fit failures** at real viewports and only one is a stale locator. **Defect one, three specs, one line.** At 812x375 the run's feedback line had `white-space: nowrap` with `text-overflow: ellipsis`, and 267px in which to say 329px of sentence: the pause message reached the player as *"Run paused. Timers are frozen un..."*. It looked like three problems because in-run inventory, codex and settings all pause the run to open, so all three read the same truncated line. **Ellipsis is the wrong tool for this element**: it is the run's voice, and its content is not a label of known length but whichever message the turn produced, so any fixed line budget is a guess about the longest sentence the game will ever want to say. It wraps now; the caption sits in a footer anchored bottom with `align-items: flex-end`, so extra lines grow **upwards over the board** rather than pushing the dock off a 375px screen. **The copy was separately stale:** "Timers are frozen" is plural for a thing a player cannot meet - the run clock left at Gen 178, and what remains is the memorize window and a dev-only reveal. It says **"Run paused. Nothing moves until you resume."**, which is true whatever the timers turn out to be. **The stale spec was stale for much longer than Gen 228 said.** The mode detail spec asks for a mode called **'Puzzle'**; the catalog has held exactly two modes since it collapsed, so the spec had been dead for many generations. What the Margin pass changed was `hasLibrary` (`browseModes.length > 1`), which hides the filter when the library is one mode - so the failure changed its **error message** from "no tile named Puzzle" to "no filter at all", and that is what made an old corpse look like a fresh one. The spec now reads the mode off the catalog, because **a name in a test is a claim about the game** and this one had stopped being true with nothing saying so; the helper says which of the two things went wrong and names what IS on the page. **And repairing it immediately surfaced the defect it had been hiding**, which is the whole argument for fixing a dead test rather than deleting it: at 812x375 the sheet's body clips at y=307 while the gate line lays out at 310-330 and the action row is painted over it at 321-357 - **cut and covered at once**. The gate line read *"Gate: <condition> - 1/1 - Unlocked locally"* **on an unlocked mode**: a requirement stated to the one player who has already met it, beside a paragraph that had just said the same thing in words. It renders only while the mode is actually gated now, which removes the duplication and the overflow in the same edit. **The cost, said plainly:** a player who wanted reassurance that a mode is unlocked no longer reads it in those words - the mode simply opens. **Two remain**, both real and both recorded rather than half-fixed: floor clear clips a route line **on a 1440x900 desktop**, the most ordinary window there is, and game over puts its next-run loop below the fold on a tablet.

- **Gen 228 the grid that never scrolls was measuring itself in a unit it does not lay out in (`src/renderer/ui/fittedGridFit.ts`, `FittedGrid.tsx`, task #246):** Gen 227 named Profile as the screen holding the UI-scale cap down, on the reading that it clips its objective cards at 1.4. Going to fix the card found the defect was not in the card, not in Profile, and **not confined to scales above the cap**. `FittedGrid` is the never-scrolling grid behind Profile's ledger, Collection, the Codex, the mode records and the run history: it measures the space it was given, works out how many cards fit, and pages the rest. It measured with **`getBoundingClientRect()`**, and the app applies the UI scale as **`zoom`** on the shell - so the rect is the **visual** box, with the zoom already multiplied in, while the CSS the same function goes on to emit (`minmax(220px, 1fr)`, `gridAutoRows`) is laid out in **unzoomed** px. **Measured in one unit, laid out in the other.** Exactly the shape of the `100dvh`-inside-a-`zoom` defect Gen 222 found in the Settings shell, in JavaScript this time, and the reason nothing caught it is the reason nothing caught that one: **every check the fit contract makes runs at `uiScale: 1`,** where the two boxes are the same number. **The mechanism, from the numbers rather than from how it reads:** on the Deck panel at 1.4 the frame is 823×132 in layout px and 1152×185 as a rect. Both boxes fit one row, so the overshoot is in the **columns** - five against three - and the page was filled with five cards while the grid had three cells in its one row. The extra two wrapped onto a second row inside a frame that **clips rather than scrolls**, which is a card with its bottom cut off and nothing to scroll it back. **It was wrong at scales a player can pick today, which is the part that matters.** Measured A/B on the Deck's 1280×800, through the app's own settings path, at the two ends of the shipped slider: at **1.05 - the cap itself** - one card spilled past the clip before the fix and none after; at **0.8** the cards came out **101px** tall where the space held **163**, so the smallest scale was throwing away 40% of the card and calling it a fit. A 1440×900 desktop is unaffected at those two scales by a coincidence of geometry, which is why this shipped. **The fix is one unit** - `clientWidth`/`clientHeight`, the layout box - lifted into a named `readFrameBox` rather than left as a property read, because choosing the wrong one of an element's two boxes is invisible until someone changes the scale, and a named function is something a comment can be attached to and a test can address. The test pins both boxes as the browser actually reported them and carries its own negative control: the two fits are required to **disagree**, so if a later change makes the distinction stop mattering the test says so instead of passing quietly. **What it did for Profile, and what it did not:** Profile now **fits at 1.4 on a desktop**, where before it clipped two progress lines and pushed the grid below the fold. On the Deck it still fails at 1.4, and the reason is no longer the grid: the ledger frame is handed **44 layout px** at that scale, so the cards are squeezed to 42 with 77 of content, and a section given 44px cannot be shown whatever the grid does. That is a budget question in the Profile layout above the grid, so `SCREEN_SCALE_CEILINGS.profile` stays at **1.1** and the cap stays 1.1 - raised only by measurement, never by a fix that looks like it should have worked. **One thing this generation did not cause and will not claim to have found clean:** the full fit contract reports **6 failed / 12 passed** on this tree, and the six were run again with this change stashed - **identical, with and without it**. They are `expect(locator).toBeVisible()` failures, which is a navigation failure rather than a fit failure: the spec cannot reach in-run inventory, codex or settings, the mode detail sheet, floor clear or game over at all, so it never gets as far as measuring them. They arrived with the Margin pass that landed on `main` from another session, and **nothing in the routine path could have said so** - `yarn lint`, `tsc`, 2797 unit tests and `yarn gate:systems` are all green on a tree whose e2e suite cannot open six screens, and `yarn build` is not in that path either. Recorded as its own task rather than folded into this one, because a fix for it is a different piece of work and hiding it inside a green-sounding generation is the failure this file exists to stop.

- **Gen 227 the screen the UI-scale cap was blamed on had become the most scalable one in the game (`src/renderer/uiScaleLimits.ts`, `e2e/ui-scale-ceiling.spec.ts`, task #245):** Xbox's guidelines ask for text scalable to **200%** (`docs/RESEARCH_NOTES.md` §3) and this build capped at **1.05**, with a reason written down beside the constant: the main menu's container-query ladder ended at `max-height: 760px` with no rung below it. **Two things were wrong with that sentence.** Gen 223 had already **refuted** the ladder story - widening the rungs changed no output at any scale on either viewport, because `@container` adds no specificity and the rungs were never winning the cascade - and the menu has since been rebuilt as a fluid title page with no ladder to miss a rung from. The constant kept the dead reason anyway, which is the failure this repository keeps finding in a new place: **a claim nothing re-derives.** **The re-measurement was blind on its first run, which is worth saying rather than tidying away:** lifting `UI_SCALE_MAX` alone changed nothing, because the applied scale stayed at 1.05 at every stored value - the save normalizer clamps `uiScale` too, so the cap is enforced in two places and the probe was reading its own floor. With **both** lifted, at 1.1 / 1.4 / 1.6 / 1.8 / 2 on the two windows a launch checklist names: **main menu 1.6, settings 1.4, profile 1.1.** The main menu is now the **most** scalable of the three, and the screen the cap has actually been standing on is **Profile** - which nothing had ever named. It clips its objective cards' progress lines at 1.4 on both windows, and on the Deck panel the progress grid also runs below the fold and the pager overlaps the objective board. **The cap is 1.1 now, and it is derived rather than declared:** `SCREEN_SCALE_CEILINGS` records a ceiling per screen and `UI_SCALE_MAX` is the smallest of them, so a screen whose layout improves raises the cap by moving its own row and cannot leave the constant stale. **The gate checks each ceiling from both sides**, which is the part that matters: a screen must fit at its ceiling *and must fail at the next step above it*. A ceiling nothing has been measured to break through is a ceiling nobody has checked, and the likely error runs the expensive way - a screen quietly holding at 1.8 while its row says 1.4 costs players scale they could have had. That assertion is the one that fails first when a layout is fixed, which is exactly the moment to raise the row. Scales above the cap are applied as `--ui-scale` directly, because the question is what the layout does at that zoom rather than what the app is willing to store. The numbers are **probe steps, not bisections** - settings' true ceiling is somewhere in [1.4, 1.6) and Profile's in [1.1, 1.4) - and recording the step measured beats recording a figure nothing measured. The accessibility target `xag.text_scaling` stays **open** and now names the right blocker (task #246); 1.1 is not 2.0 and the audit says so.

- **Gen 226 the held-pair marker had a control already, and it was the one nobody wanted to duplicate (`src/shared/held-pair-rules.ts`, task #230):** Thesis §30.3(c) asks for a marker that lets a player claim a pair they mean to save, so that holding a chain becomes a nameable strategy rather than a thing good players happen to do. Gen 188 found the collision and stopped there: the game already ships a memory marker - the **pin**, up to `MAX_PINNED_TILES` hidden tiles, toggled from the dock, changing no rules - and that is the job description almost word for word, except **a pin marks a tile and the hold decision's unit is a pair**. The thesis offers three ways out and recommends extending the pin into a pair link with one new verb. **This takes the recommendation and removes the verb: two pins ARE the claim.** A player who pins two tiles has already made the two-tile gesture the section says the claim has to be, so a "link these" press on top would be a second way to say the same thing - the duplication §105 exists to remove. Exactly two pins is a held pair, a third dissolves it back into three loose notes, and **nothing new appears on the dock**. Two consequences follow rather than being declared: the cap of one held pair falls out of the pin cap, and the choice between holding a pair and keeping three notes is the commitment (c) asks for instead of a notebook. **Both §30.3 constraints are structural here, not remembered.** *It never validates*: the module reads no tile identity at all, and the test gives the same two positions a matching and a mismatching identity and asserts every output is identical - plus a source scan for `pairKey`, `symbol`, `tilesArePairMatch` and `label`, because the assertion only holds while the file stays ignorant, and a later generation adding a "they match!" tint would be adding a free match test: no turn, no mismatch, strictly better than playing. *The span (T3.6) rides on the claim and only on it*: a span on an unmarked tile hands back part of the memory game (the finding at G.3), while on a claimed pair it restates the distance between two tiles the player picked - and if the claim is wrong it is the span of the pair they **think** they have, which is what they are deciding about. It is **Manhattan** rather than straight-line because the board is a grid and a break walks it in steps. **The cost, said rather than left to be discovered:** a player who pins two unrelated tiles as loose notes is told the span anyway - the price of not adding a control, and inert, since it is a distance between two positions they chose. **What this does not settle:** whether the marker becomes a crutch that does the remembering (thesis E.6). That needs players; a simulation cannot answer it, because the reference player has no memory to aid.

- **Gen 225 the cascade climbed nine notes and hit none of them (`src/renderer/audio/musicalScale.ts`, task Gen 161):** Peggle 2's audio team (`docs/RESEARCH_NOTES.md` §2) say a cascade feels musical because each hit is the next step of an ascending scale that harmonises with the music. The break's phrase here was `720 + index * 46` Hz per pair, each note gliding 720 to 1080 while the next began. Pitch is logarithmic and that is a straight line: the steps run **107 cents, then 101, then 96, down to 75** by the ninth, and measured against the notes the run loop actually plays, **zero of the nine land on one** - a negative control the test states as `toEqual([])` rather than "mostly off". **The music was measured, not assumed.** `yarn audit:music-key` (new, in `gate:systems`) re-derives the chroma from `run-loop.wav` - 64 windows, a Goertzel filter per pitch class across five octaves, each window normalised by its own peak: `A 0.300, D 0.170, F 0.096, E 0.095, C# 0.074, C 0.074, F# 0.073, B 0.046, A# 0.041, G 0.019, G# 0.008, D# 0.006`. **What it will not settle:** the third is a tie - C and C# at 0.0737 each - and the Krumhansl-Schmuckler correlation flips between A major and A minor with the analysis window (A minor 0.792 / A major 0.775 under one implementation; A major 0.782 / A minor 0.716 under another). So the cascade uses the four pitch classes both candidate keys share and the measurement is confident in: **A, B, D, E**, clear of the contested third and of a seventh the loop barely plays (G 0.019, G# 0.008). Committing to a seven-note scale would have meant picking a side in a tie and calling it measurement. **The cost, where it is paid:** four notes to the octave means a nine-pair break climbs two, so the phrase opens at A4 440Hz rather than 720Hz and most breaks - two to four pairs - now sound LOWER than the ramp did. **The three chain milestones moved too:** 1360, 1680 and 1960Hz were near E6, G#6 and B6, and G# is the pitch class this loop has least of - the middle rung was the one note in the piece that is not in the piece. They are E6, A6 and B6 now, and the beats decide how far up the set the accent sweeps rather than how many Hz it is lifted by, so both ends of the sweep are notes. **The blocked half is sized, not hand-waved:** `docs/AUDIO_PHRASE_SIZING.md`. Re-keying per phrase needs the score re-authored as phrase chunks crossed with instrument stems and the `<audio>` element replaced with a Web Audio scheduler; the run music is one 24-second loop, so there are no phrases to key to. The task stays open on that, and the fixed set is written as a fixed set rather than as a `currentPhrase` parameter that would always answer the same.

- **Gen 221 the only shake in the game fired on a miss, so the Fever break shook nothing (`src/renderer/components/boardTrauma.ts`, task Gen 159):** Eiserloh, GDC 2016, *"Juicing Your Cameras With Math"* (verified 3-0 in `docs/RESEARCH_NOTES.md` §2). What was here was `Math.sin(t * 36) * 0.022` on the two mismatched cards, switched on while `resolvingSelection === 'mismatch'` and off the frame it left - **written twice**, in `tileBoardLayoutMotionState.ts` and again in `tileFrameActivity.ts`, with two different time variables, so the frame that decides whether a card is idle was computing the shake separately from the frame that draws it. Three defects, two of them load-bearing for this game rather than matters of taste: **it could not stack** (two events in a turn shook the same as one, and a Fever break - the biggest thing that happens on this board, the thing Gen 139's hit-stop exists to let the player watch - shook nothing at all); **it could not decay** (a shake that ends on a state change ends mid-swing, which reads as a dropped frame); and **it was a tone, not noise**. **The model:** a `trauma` scalar in [0, 1], events add 0.2-0.5, linear decay, applied shake is **trauma cubed** - the cubic branch, because the talk's published mapping .30/.60/.90 -> 3%/22%/73% is 0.027/0.216/0.729 and the squared branch gives 9/36/81; `boardTrauma.test.ts` pins those three figures so a later swap to squared fails rather than passing. Offsets are sampled from **1-D Perlin gradient noise**, translational *and* rotational together (the source's 2D advice; its 3D advice inverts and does not apply to a board seen flat on). **Two subjects, two spaces:** the board shakes as a room - a pop 0.2, Clean 0.3, Sharp 0.4, Fever 0.5, a miss 0.2 - read off the board the way the match wave key is, so no event is threaded from the store; the two cards of a miss shake as themselves at 0.5 in their own maxima, sized so a miss peaks at 0.021 board units where the sine sat at 0.022. **What the cubic does, said rather than left to be read off the maxima:** a miss is now a whisper on the board (0.8% of maximum) where it used to be the loudest shake in the game, which is the intended correction - a miss already has the red tint, the danger rim and the miss floater - while a Fever break is 12.5% and stacked events reach a quarter of a card. **Why the model and not a nicer curve:** the shake is a pure function of the clock, so the Fever hit-stop slows and holds it with everything else (a per-frame random shake keeps jittering at full speed through exactly the moment being held), and it is resamplable, so a share code, a daily run and the endless simulation's replay verification all draw the same board twice. The determinism test carries its own negative control - the same assertion against `Math.random` fails. **The maxima are this game's**; the source publishes none and says so.

- **Gen 220 the opening was the tightest part of the game, and every reading was in the wrong unit (`src/shared/floor-par.ts`, `scripts/sim-difficulty-curve.ts`, task Gen 166):** `docs/RESEARCH_NOTES_2.md` quotes PopCap's Jason Kapalka on Peggle: *"We do apply a lot of extra 'luck' to players in their first half-dozen levels or so to keep them from getting frustrated while learning the ropes."* This game did the opposite, and no instrument here could see it, because **every reading of the curve was in turns**. In turns the opening is the shortest part of the game and looks generous. **Divided by par it was the tightest.** Measured over all fifty-two floors, ten seeds: floors 1-6 spent a mean **0.797** of their allowance, floors 7-52 spent **0.640**, and the two tightest floors in the whole curve were the **second (0.900)** and the **sixth (0.900)** - against a deep-game worst of 0.857 on floor 10. The new player had the least slack exactly where the reference product gives the most. (Read as absolute headroom first, which flatters big-par floors; the finding survives the fairer ratio, which is why the ratio is what got gated.) **The fix is a turn of par on every board the opening deals** - `PAR_OPENING_FLOORS` 6, one turn, so floors 1-6 read 4, 5, 6, 7, 7, 7 rather than 3, 4, 5, 6, 6, 6. After: floors 1-6 mean **0.658**, worst **0.771**, under the deep game's worst on every floor. **Why it stops at one turn:** a second would put floor 1's par at five turns on a four-pair board, and par above the pair count is a target a perfect memory cannot miss even with the cascade switched off - `floor-par.test.ts` holds par at or under the pair count on every reachable floor, and floor 1 now sits exactly on that line, so the constant cannot be raised without failing it. **What it also does, said rather than discovered later:** the floor-end efficiency term pays 50 x level per turn under par, so an opening floor cleared the same way now pays 50 x level more - +1050 over floors 1-6 of a run. That is the tilt reaching the score as well as the target, in the same direction, and `sim:cascade`, `sim:run`, `sim:occupancy` and `sim:endless` all hold with it in. **The hypothesis that measurement destroyed:** the first lever reached for was the suit deal - floor 2 is `speed_trial` on every seed, the only archetype in floors 1-30 mapping to `SUIT_DEAL_PROFILE_BY_ARCHETYPE` `'scattered'`. Swapping floors 2 and 8 in `ENDLESS_FLOOR_CYCLE` moved floor 2 **not at all** (floors 1-3 are authored layouts, so the deal profile never reaches them) and made floor 8 **faster**, 5.2 turns to 3.7, because fewer suits mean bigger clumps and more pops. Reverted; the causal story was wrong in both directions. **The gate:** `sim:curve` prints a new `of par` column and `CURVE_BANDS` gains two rules - no opening floor over `maxOpeningParRatio` 0.8, and the opening's worst ratio never above the deep game's worst. Run with `PAR_OPENING_ALLOWANCE` taken back to 0 they fire on floors 2, 5 and 6 and name the inversion, so they are measuring the game rather than agreeing with it.

- **Gen 219 the helper named `flipTileAtGridCellKeyboard` had never pressed a key (`e2e/deck-controller-reach.spec.ts`, task Gen 163):** Steam Deck Verified, criterion two, verbatim from Valve: **"The default controller configuration must provide users with the ability to access all content."** The pad has no input path of its own in this game - `gamepadNavigation.ts` drives the focus ring spatially and synthesises the arrow keys and Enter each screen already answers, which is what gave the whole game controller support at once. So the criterion reduces to a keyboard question, and the board is where that question is hard: the tiles are three.js meshes with no DOM node, and what stands in for them is **one `role="application"` container with `tabIndex={0}`**, an arrow-key cursor over the pickable tiles, and Enter to commit. **Nothing proved that path ran.** Every "keyboard" flip in the e2e suite goes through a helper called `flipTileAtGridCellKeyboard` which calls a dev-only pick hook and flips the tile directly - `handleBoardApplicationKeyDown` was never reached by it. Ten spec files import that helper. A helper named for the thing it skips is worse than no helper, because it reads as coverage; it is `flipTileAtGridCellViaDevHook` now, with a comment saying what it does and why it stays. **The new spec uses the keyboard**, at the Deck's 1280x800: focus the board container, `ArrowRight`, `ArrowDown`, `Enter`, and the hidden-tile count must fall. **It passes.** And because a bar nothing has failed is a bar nobody has checked, it was run once with `F9` in place of `Enter` - **it fails**, so the assertion is measuring the press rather than the page. **Where the other four criteria stand, checked rather than asserted.** The font floor - *"the smallest on-screen font character should never fall below 9 pixels in height at 1280x800"* - is enforced at **12px**, Valve's recommendation rather than its minimum, by `audit:min-type-size`: 251 declarations across 33 stylesheets, 0 below the floor, 5 left to the cascade and covered by the fit contract. A **native Linux build is not required** and there is not one: the build targets Windows x64 NSIS, which Valve tests under Proton. The **week-long review turnaround** is a fact about Valve, not work here. The remaining one - **30fps at 800p** - is **not verifiable in this environment** and is not claimed: it needs a frame-time measurement on the hardware or a throttled profile, and saying anything else about it would be the exact failure this session keeps finding.
- **Gen 218 the one rule with a regulator behind it was a paragraph in a research note (`scripts/health-claims.ts`, task Gen 164):** This is a memory game, and memory games are the genre with a precedent attached: the **FTC fined Lumosity $2M in 2016** for advertising that its brain-training program sharpened performance, staved off age-related cognitive decline, and protected against mild cognitive impairment, dementia and Alzheimer's. `docs/RESEARCH_NOTES_2.md` records the case and draws the consequence in one sentence - *this game should make no cognitive claim* - and **nothing was behind that sentence.** It was written once and read by whoever happened to open the file, which is the shape of every claim this repository has since had to go back and fix. **The product is clean, and that is the finding rather than the relief:** one occurrence of the word "cognitive" in shipped source, in a comment naming the W3C accessibility guideline, and a package description that says what the game is. Nothing was keeping it that way, and store copy is written under deadline by whoever is shipping. `yarn audit:health-claims` checks **501 shipped source files** and the package description against **eleven claim shapes** drawn from the complaint - brain training, brain age, mental fitness, memory workout, improves/boosts/sharpens memory, keeps your brain sharp, cognitive benefit or decline, dementia and Alzheimer's, neuroplasticity, IQ gain, clinically proven. Comments are stripped, because a comment explaining why a phrase is banned is the record of the rule and not a breach of it. **The distinction the gate has to hold is between a word and a promise.** "Cognitive load" is a property of a screen, "cognitive accessibility" is a standard this game follows, and neither tells a player their brain will improve - so those are masked out **by phrase, with a stated reason each**, rather than the files that contain them being exempted. A word-level ban would have been exempted away within a generation. `health-claims-audit.test.ts` holds twelve claim sentences open as fixtures and six lines of legitimate copy beside them, so the gate is known to bite rather than known to pass: the bar this repository keeps warning itself about is the one nothing has ever failed.
- **Gen 217 re-read all ten census exemptions, and two of them were describing a game that had moved (`scripts/mechanic-accountability.ts`):** Gen 216 found `objective.featured_streak` excused by a line naming a blocker that had been gone for eight generations, and said the remaining ten were suspect in the same way until someone looked. This is someone looking, and the answer is **two of ten**. **(1) `inventory.mutator_loadout`** said "a run setup, chosen before the first floor and unchanged by any of them". The floor schedule hands a **different mutator to every floor** - wide recall, short memorize, findables floor, silhouette twist, n-back anchor, the magpie, sticky fingers, category letters on floors one to eight of seed 42001. It is a per-floor selection and has been for a long time. The exemption stands on a different footing now, and a true one: the census counts what *accumulates within* a floor, and a selection has no rise to measure, so its accountability is `audit:mutator-effects` (Gen 209), which presses all ten and requires each to move a channel a player could notice. **(2) `persistence.run_summary`** said "written once when a run ends; the census plays floors, not runs". The census has played runs since Gen 207. The exemption survives for the **opposite** reason to the one written down: no censused run ever *ends*. All ten reference runs reach the floor cap at 24 without a game over - which is its own small reading of the game at a 15% miss rate, and consistent with what Gen 211 measured about the turn ceiling. The other eight held and are restated in current terms rather than left as they were - each now names the gate that stands behind it (the HUD reach test, the softlock seed sweep, the long-run depth gate, the 384-step replay, the endless simulation, the mutator-effect audit) instead of asserting a bare category. **The mechanism, because a re-read that is not gated is a re-read that happens once.** `MECHANIC_CENSUS_EXEMPTION_SWEEP_GENERATION` is 217 and every exemption carries the generation it was last read against the game; the gate requires all of them to be at or after it. Raising the constant is the act of re-reading all ten. The summary line - *mechanics: 42, censused: 32, exempt: 10, unanswered: 0* - counts exemptions, and a count cannot tell a live argument from a dead one; this is what the count was missing.
- **Gen 216 an exemption that names its own blocker is a debt with a due date, and nothing was checking the dates (`system-occupancy-simulation.ts`, `scripts/mechanic-accountability.ts`):** `audit:mechanic-accountability` has read *mechanics: 42, censused: 31, exempt: 11, unanswered: 0* for generations, and its own comment says an exemption "is a debt with a name on it, not a pass: the list below is meant to shrink". Reading the eleven lines rather than the summary, one of them said: **"objective.featured_streak - spans floors, and the census resets between them. Needs the run-level census (task Gen 150)."** **The run-level census shipped at Gen 207.** The line went on excusing the mechanic for eight generations after the blocker it named was gone, because nothing re-reads an exemption once it is written - the summary counts them, and a count cannot tell a live argument from a dead one. This is the same shape as Gen 213's ledger currency and Gen 214's dead exports, arrived at from a third direction. **Counting it took a counter and a comment.** `featuredObjectiveStreak` is a run-cumulative number settled by `advanceToNextLevel`, which the run census already steps, and it *decays* on a miss - so the census's zero-clamped delta reads a rise as "this floor cleared its objective" and a decay as a silent floor, which is the reading worth having. **0.829 of a run's floors clear their featured objective, and every floor carries one** (`flip_par`, `scholar_style`, `cursed_last`, in a 45/45/30 split over 120 scheduled floors). Banded `common`, which is where 0.829 honestly sits. Census coverage is **32 of 42** mechanics, exemptions **10**. Recorded rather than acted on, because it is a balance decision and not a defect: a featured bonus that pays on five floors in six is close to a participation award, and the reference census player satisfies `scholar_style` by construction - it has no tools to refrain from using - so the 0.829 is a ceiling on how hard that third of the schedule can be measured to be, not a reading of it. The remaining ten exemptions are now all suspect in the same way until someone re-reads them, and the audit's comment says so.
- **Gen 215 the list of unreachable exports was 152 long, and a third of it was the audit being wrong (`scripts/test-only-exports.ts`, `cosmetics.ts`, `run-mode-identity.ts`):** Gen 214 shipped `audit:test-only-exports` with a 149-line baseline and said the honest next step was to work the list down one decision at a time. Working it down started by asking whether the list was right, and **35 of the lines were not findings at all.** **(1) Inheritance.** `test-only-modules.ts` already exempts ten modules as records whose test IS the consumer - contract tables, coverage matrices, readiness records. Every export of such a module is reached only by its own test *by design*, so the export audit was restating an argument the repository had already accepted, 29 times. It now inherits that list rather than duplicating it, which also means a module that stops being exempt stops being exempt here on the same day. **(2) Re-exports.** `export { X } from './y'` puts a symbol on another module's surface, and whoever imports it from there is reaching the original - the floater anchor rules are exported by `tile-floater-anchor-rules.ts`, re-exported by `game.ts` and `turn-resolution.ts`, and used by `board-turn-event-facts.ts` through the barrel. Counting only `import` statements called those unreachable; there are **25 re-export statements** in this repository and all of them were invisible. Both rules are pinned on fixtures, because the lesson from Gen 214 still holds: a gate that cries wolf gets exempted rather than fixed, and this one has now over-reported in three distinct ways. **What was left was real.** Six exports removed: `getCosmeticRows` and `resolveEquippedCardTheme` (second and third names for functions that already had one), `unlockedCosmeticIds`, `buildRunJournalRows` and `runModeIdentityText` (one-line wrappers with no caller), and the repointed tests. Two stale claims fell out of repointing those tests rather than out of looking for them: the run identity a player reads in the pause menu said the Scholar contract means **"No shuffle, no destroy"** - Destroy left in Gen 200, and what the flag gates is the two shuffle charges, one of which is what the tile swap spends - and its test fixture carried `bonusRelicDraftPick`, a contract field that has not existed since the relic draft left in Gen 175. **And one thing worth saying plainly, because the tidy version would be a lie.** Repointing the cosmetics and run-history tests at the "live" names surfaced three more test-only exports: `getOwnedCosmeticIds`, `getEquippedCardTheme` and `buildRunJournalEntry` have no game caller either - only `getCosmeticCollectionRows` (Collection screen) and `buildRunJournalRowsFromSave` (profile summary) do. Those three went onto the baseline as debt rather than being quietly relabelled as design, and the comments in both files now say so. The list stands at **114**, down from 152, and the assertion in `test-only-export-audit.test.ts` moves with it so a later generation cannot re-record a new finding as known debt.
- **Gen 214 the reachability gates had never been asked about a symbol, only about a file, and 1,040 lines of read model were living in that gap (`scripts/test-only-exports.ts`, `docs/REMOVED_READ_MODELS.md`, `viewportMatrix.ts`):** Gen 213 tripped over `createInventoryScreenModel` - eleven projections assembled for a screen that renders a run line, mutator chips and a charge table - and recorded it rather than acting. Acting on it is this generation, and the finding was never one export. **Three things could have caught it and none did.** `audit:test-only-modules` asks whose only importer is its own test, has read zero for a long time, and was *right*: every module in this chain was imported by `inventoryScreenModel.ts`, which the screen imports. The module was reachable; the export was not. `knip --exports` counts a test file as a consumer, so an export a test imports is used. And every test passed, because the tests were the consumers. **The audit.** `yarn audit:test-only-exports` reports an export when every file that imports it is that module's own test AND the module does not use it - both halves, because a helper a test imports and the module also calls is over-exported rather than unreachable, and a gate that cries wolf gets exempted. It found **152**. Its own first two readings were wrong in the over-reporting direction and both were arithmetic: it counted the declaration line as a use (`dealTilesInClumps` and `suitCountForPairs` reported dead while their own module calls both), and its import-clause pattern matched lazily from the first `import` in a file, so a module imported after `node:fs` had its bindings read off the wrong statement (`buildMechanicsCatalogAppendixMarkdown` reported dead while every docs regeneration calls it). Both rules are now pinned on fixtures in `test-only-export-audit.test.ts`, which promptly found a third: `export type { X as Y }` was not being read as an export at all. **The removal.** Pulling the head of the chain brought out all of it: `createInventoryScreenModel` and its two signal helpers, then `inventory-prep.ts`, `long-run-feedback.ts` and `meta-reward-signals.ts` (their only live consumer), then `run-economy.ts` and `memory-recall-feedback.ts` (theirs). **783 lines of read model and 257 of test**, correct, green and unreachable, recorded in `docs/REMOVED_READ_MODELS.md`. Nothing a player can see changed: Perfect Memory looked like a casualty and is not - `getPerfectMemoryAttribution` was a superseded duplicate, and the run bar reads `perfect-memory-status.ts`, which `GameScreen` calls directly. The module audit is back to **0** after the chain, and the export audit's **149 survivors** are baselined by file and symbol so the count can only go down: a new one fails, and a line that no longer applies fails too. **And the same failure once more, in the fit contract.** Two of the eight viewport-matrix rows named a `primaryActionSelector` no component has rendered since the meta screens were rebuilt: the Inventory row pointed at `inventory-prep-strip`, whose read model went in this pass, and the Codex row at `codex-knowledge-base-summary`. The matrix's own summary checked `primaryActionSelector.length > 0` - a bar no string has ever failed. `breakpoints.test.ts` now reads the renderer and requires every selector to name a testid a component writes, and it had to learn both spellings (`data-testid=` and the `testId` prop the shared Panel and OverlayModal forward) before it stopped false-alarming on the Collection grid and the pause overlay.
- **Gen 213 the ledger had no notion of currency, and six systems it called settled were still describing a game that left (`system-refinement-ledger.ts`, `run-economy.ts`, `TileBoard.tsx`, `boss-encounters.ts`, `scripts/run-mode-scope.ts`):** `SYSTEM_REFINEMENT_LEDGER` is the record behind the claim that every system in the game has been examined, and it is gated for completeness against the 42-mechanic interaction graph. What it never recorded is **when relative to the game**: **34 of its 48 entries were stamped Gen 200-202** - written before the deal became a shuffle (204), before the three authored floors were redrawn (205), before the census could measure a run rather than a heap of first floors (207), and before par stopped being a flat rate (210-211). Nothing about reading those entries distinguished them from current evidence, which is the failure this repository keeps finding in a new place each generation. **The mechanism.** `SYSTEM_REFINEMENT_SWEEP_GENERATION` is now 213 and every entry must be stamped at or after it, so raising the constant is the act of re-walking all forty-eight. On its own that is a stamp, so it is not on its own: every entry must also carry evidence a test re-checks. Three kinds, and **all 48 carry at least one** - `counter` (18 entries; the census re-measures the share, now matched as the printed three-decimal figure rather than to two decimals, because at two the pin's 0.163 and the 0.158 it replaced are the same number), `gone` (25 tokens re-grepped against live source with comments stripped, because a comment saying a thing went is the record and not the thing), and `present` (27 tokens a standing entry depends on - a charge field, a gate, a slot range). There is deliberately **no exemption**: the three systems argued exempt from the *census* - the memorize window, the run frame, the tuning simulation - are not exempt from being *checked*, and each now names something whose presence says the argument still holds. **What the sweep found, which is the point of doing it rather than stamping it.** Six systems the ledger called settled were not. **(1)** Both temporary-run economy rows described sinks the game does not have - a pickup "forfeited by destroying the carrier" and charges spent on "destroy" and "stray-remove" actions. Gen 200 removed those *rows*; nobody read the prose inside the rows that stayed, and the pickup sentence contradicted the very rule Gen 202 wrote to replace it. **(2)** The board still published a **seven-lane** trait contract - `shard guard tool risk block recall score` - cast to the four-lane id type to make it compile, three generations after Gen 202 cut shard, guard and risk; and because the audio-cue function branched on the dead lanes and **fell through to `trait-lane-shard`**, the one surviving lane that reached the default, `score`, was being announced under the name of a currency removed in Gen 184. **(3)** The boss floor's mechanics list still injected a **"Keystone Pair board anchor"** - thirty lines below the comment saying it "appears nowhere in the game at all - no field, no rule, no generator". Gen 201 fixed the constant and missed the builder every real floor goes through, and **the test asserted the phantom**, which is what kept the builder honest to it. **(4-6)** The mode-scope record - the file that decides which entries earn a place on Choose Your Path - described **Classic**, the row every other row is measured against, as "floors, routes, shop gold, relic milestones", three of four gone in Gen 173-175; credited **Wild** with a stray-remove charge three generations after it left; and said the **Scholar** contract forbids "shuffle, swap and destroy" when the flag it sets gates the two shuffle charges, and the row-shuffle charge is what the swap spends. Ledger verdicts are now 25 changed / 22 confirmed / 1 removed. Recorded and not acted on: `createInventoryScreenModel` builds eleven projections and is reached only by its own test - a dead screen model, which is a removal decision with a chain behind it rather than a sentence to correct.
- **Gen 212 the HUD had never been laid out around a number a real run produces (`e2e/gameplay-hud-layout.spec.ts`, `src/renderer/App.tsx`):** the run census (Gen 207) made it possible to ask what a long run's numbers actually are, and the answer is **1,605,856 after sixty floors** at a 15% miss rate - seven digits, plus a two-digit floor and a par of 14/19. Every layout test in this repository starts a fresh run, and the fixtures the long-run HUD specs open carry `totalScore: 0`, so the score lane - a fixed `min-width` box with `overflow: hidden` under it at small sizes - had been measured only against a single digit. Nobody plays sixty floors in a browser to find out, so a dev-only seam hands the shell the numbers and the spec checks that no text node in the Floor, Score or Par lanes exceeds the box it is painted in, at five viewports including the Deck's 1280x720 and the 620px narrow layout. **It holds - nothing clips.** That is a confirmation rather than a fix, and it is worth having as one: the question was open, it is now answered and gated, and the answer could have gone the other way. What makes it worth a generation is the gap it closes, which is the same gap as the last five: a surface checked only against the smallest value the game can produce is a surface nobody has checked.
- **Gen 211 par was a flat rate on a game whose pop is a hill, so the deep floors were unbeatable (`floor-par.ts`, `scripts/sim-difficulty-curve.ts`):** Gen 210 measured the opening and found a clean player over par on floors 1, 2 and 6. Measuring the other end, to floor 100, found the same defect larger: **11.6 turns against a par of 9 on floor 30, 14.0 against 10 on floor 40, 15.8 against 11 on floor 100.** From about floor 20 the under-par bonus and the within-par objective were out of reach of competent play - the deep game asked for a standard it did not supply the means to meet. One cause at both ends, and it is the pop: measured across a hundred floors, the pop's share of a board is **a hill, not a line** - 0.50 at four pairs, 0.65 at eleven, **0.75 at fourteen**, 0.60 at seventeen, 0.48 by twenty-two - because four suits of six pairs spread over forty-eight cells give a bounded wave a smaller fraction of each suit to walk. A flat rate calibrated to the peak is too tight on both sides of it. Par now has two terms and both come from the mechanism rather than from a fit: the rate is flat to thirteen pairs and **rises by 0.025 a pair after it**, where the measurement says the pop stops keeping up; and every floor carries **one turn of miss allowance**, because par allowed for none at all while a competent player makes 0.2 misses on the early floors and 2.6 to 3.0 on the deep ones. Gen 210's small-floor slack is gone - it was this rule seen from one end, and it now falls out rather than sitting beside it. Par runs 3 at four pairs to 19 at twenty-four, against a flat rate's 2 and 11. **A clean player is under par on every floor from 1 to 100**, and `sim:cascade` under-par shares went 0.97 -> 1.00, 0.89 -> 0.97, 0.68 -> 0.81 across the miss rates, so the target still bites for a player who is missing. Two things the deep measurement settled that nothing had asked before: the board stops growing at floor 52 (24 pairs, 48 tiles, 7 columns, 24 symbols, memorize 5280ms - all frozen from there on, which is what `PAIRS_MAX` means), and Fever still lands on the deepest floors (0.4 to 1.0 a floor at floor 70-100), so the ladder has not gone flat where nobody was looking. `yarn sim:curve` now covers floors 1 to 52 rather than 1 to 12, and `gate:difficulty-curve` runs it in `gate:systems`.
- **Gen 210 the first floors were the only ones in the game a competent player could not beat par on (`floor-par.ts`, `scripts/sim-opening-curve.ts`):** nothing had ever measured the opening as a player meets it - `sim:cascade` reports bands over all floors and the censuses report shares, and neither says how long a floor takes or what happens to that as the boards grow. Measured over ten runs at a 15% miss rate, floor by floor: **2.4 turns on floor 1 against a par of 2, 3.6 on floor 2 against 3, 5.4 on floor 6 against 5, and 6.0 on floor 10 against 6.** Par is one rate times the board (`0.45 x pairs`), and the pop is what makes that rate work - but the pop's share of a board GROWS with it: 2.0 of 4 pairs taken by pops on floor 1, 9.6 of 14 by floor 12. So the rate that is generous at fourteen pairs is the theoretical minimum at four, and floor 1's par of 2 was exactly what four pairs less two popped leaves - meetable only by never missing. The first board anyone plays told them they were behind. One turn back at or below thirteen pairs, floors 1 to 10, nothing above it changed; the line is where the measurement put it and not where the story wanted it, because eleven was tried first and left floor 10 tied at 6.0 to 6. Every band moved the right way: `sim:cascade` under-par shares **0.96 -> 0.97, 0.84 -> 0.89, 0.60 -> 0.68**, and the turn ceiling (three times par) is correspondingly kinder on the floors where a new player is learning. The second finding is recorded rather than acted on, because it is a design position and not a defect: **a floor does not get longer as the board grows.** From floor 3 on it is four to five turns whatever its size, at 15% miss and at 35% alike - the board doubles from 7 pairs to 14 and the pop grows with it, so the game gets denser rather than longer. That is not what `pair-curve.ts` describes, and until `yarn sim:opening` nobody could see the difference. The gate bands the opening around what was measured so a change to the pop reach, the pair curve or par cannot quietly flatten or spike the first floors again - which this repository has done twice (Gen 148, Gen 191).
- **Gen 209 every mutator now has to prove it changes the game (`scripts/mutator-effect-audit.ts`):** the occupancy censuses ask whether a system ever *happens*; nothing asked whether a mutator that happens *does anything*, which is the same failure one layer up - and seven of the ten mutators move no counter either census watches. `yarn audit:mutator-effects` plays the same floor twice, once carrying the mutator and once without, same seed and same player, and asks whether any channel a player could notice moved: the score, the memorize window, the symbols, the findables, the spotlight keys, the sticky block, the n-back anchor, the magpie's thefts. All ten pass, and what each moves is printed rather than asserted in prose: sticky fingers the sticky block, category letters the symbols, short memorize the window (3406ms against 3756ms), n-back the anchor, findables floor the pickups (2 against 1), shifting spotlight the ward and bounty keys, and **wide recall, silhouette twist and distraction channel the score** - they are presentation mutators whose mechanical half is a 5/5/4 point match penalty, with the visible half in the renderer (a cooler face, a silhouette, a chaff readout), so a first pass that watched only run state read them as doing nothing. That was the instrument, not the game, and it is worth recording because the same blind spot bit twice more in one sitting: **the magpie read NOTHING OBSERVED here too**, for the Gen 208 reason - it arrives on the third mismatch OF THE RUN, and a probe that starts every floor from a fresh run cannot reach it. The audit now primes the run to where a run would be by that floor (two mismatches already made) and the bird steals. Three instruments in three generations have been blind to the same thing: a floor inside a run is not a first floor.
- **Gen 208 the ledger's own numbers had gone stale, the magpie was not in the game's list of its systems, and two removed powers still had state in the graph (`system-refinement-ledger.ts`, `gameplay-interaction-graph-data.json`, `system-occupancy-simulation.ts`):** a pass over the refinement ledger with the Gen 207 run census in hand. **(1) The numbers.** Seven ledger notes quote a measurement, and a measurement written into prose rots: the turn resolution said 1.000 x **4.46** against a census reading **4.95**, the gambit said **0.408** against **0.446**, and the peek's 1.000 was a floor-census reading of a charge the run hands out once (**0.904** across runs). None is a large number, which is the point - nobody catches these by reading, and later generations reason from them. An entry now names the counter behind its figure and the test re-measures it, reading run-scoped charges off the run census. **(2) The magpie.** Task 156, open since Gen 113: the one mechanic that takes finished work back off the player had no occupancy counter, no test that it steals in a run, and **was not in the interaction graph at all** - so the ledger's completeness gate, which walks the graph, had never covered it. Given a counter it reads **SILENT across 240 floors** and **0.013 across whole runs**: it arrives on every third mismatch *of the run*, so a census that starts a fresh run every floor almost never reaches it. Gen 207 found a system called `core` on a fresh-run reading; this is the same error inverted, and the worse direction - a mechanic that ships, works, is announced when it fires, and reads as absent. **(3) The debris.** Gen 200 deleted the Destroy and Stray powers; `destroyPairCharges` and `strayRemoveCharges` stayed declared in the graph for seven generations - read by the HUD and the command core, written by the run flow - and the graph's own validator could not see it, because its rule is that a write must have a reader and these had each other. Six declarations stripped, and a test now refuses any field belonging to a removed mechanic. The graph is 42 mechanics and 115 edges, version 38. **(4) The instrument.** The floor census passed each floor's mutators to `buildBoard` but never onto the run, and eight rules read them off the run - the magpie, sticky fingers, the n-back anchor, the shifting spotlight and the four the memorize window reads. It changed no published number, because none of those has a counter yet, and it is fixed anyway: a census that cannot see a mutator cannot answer the question it exists to answer.
- **Gen 207 every simulation in the repository measured a heap of first floors and called it a run (`system-occupancy-simulation.ts`, `scripts/sim-run-occupancy.ts`):** `sim:occupancy`, `sim:cascade` and `sim:endless` all build a fresh `RunState` for every floor. That is the right instrument for asking what a *board* does and the wrong one for asking what a *run* does, because the run is where the game keeps everything that does not reset - the charges a player spends and never gets back, the score, the turn ceiling. Measured a floor at a time, a tool a player meets **once a run** reads exactly like a tool they meet on **every** floor. Task 191 asked for a run census at Gen 150 and it stayed open for fifty-seven generations. `yarn sim:run` now plays one continuous run per seed through the game's own `advanceToNextLevel`, and reports two numbers a floor census cannot have: the share of floors *inside a run*, and the deepest floor a system was ever seen on. Three systems fail their band the moment they are measured this way, all for the same reason - `createNextFloorRunState` refills the region shuffle and nothing else. **The wild joker read 1.000 x 1.00 and `core`; across a real run it is spent on floor 1 and never seen again, on all ten seeds.** The full shuffle read 1.000 `core` and is **0.196** of a run's floors (one charge at the start, one curio that grants another). The flash pair read 0.158 `common` and is **0.042**. The peek survives its `core` bar honestly at **0.904**, because three of the floor curios grant a peek charge. None of the three powers changed: the setup sheet sells one joker a run and that is what it delivers, so the bands were describing the instrument, and they are now `rare`, `common` and `rare`. Structurally, a counter declares which census may band it (`scope: 'run'`), the floor census still reports those rows but no longer grades them, and `judgeRunOccupancy` names anything last seen on floor 1 while runs reach floor 24 - because 'once a run' and 'rarely' are different games and only one of them is a cadence. Two artifacts were caught while building it and are pinned by tests: a counter the run keeps rather than the floor (`pinsPlacedCountThisRun`, the trait tallies in the session stats) reads as a running total unless the census takes the delta across the floor - measured wrong, the traits read 0.80-0.83 of floors instead of 0.44-0.65. The run census also answers how a run ends, which nothing measured before: at the reference 15% miss rate a run never ends on its own (40 floors, every seed), at 30% one run in ten hits the turn ceiling, at 45% seven do and the mean run is 28.6 floors, at 60% every run ends by floor 8. The ceiling is a real gradient and a clean run ends when the player stops, which is thesis §42.2 exactly. `yarn gate:run-occupancy` runs in `gate:systems`.
- **Gen 206 the record of every generation, checked against the repository for the first time (`scripts/audit-generation-claims.ts`, `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.md`):** this repository writes its history into its documents and its comments - **613 sentences across 111 files** that name a generation and say what it changed - and until now not one of them was checked against the code. A claim nothing checks rots the way a test nobody runs does: it goes on being read as true. Two rules, both mechanical. **A reference has to resolve**: every backticked file or symbol in a sentence naming a generation must exist today, unless the sentence itself says it is gone ('removed', 'went', 'was'), because a record is allowed to name what it buried - and files whose whole subject is the game as it was (`BALANCE_NOTES.md`, the `REMOVED_*` files, an epic carrying a superseded banner) are exempt for that reason. **Nothing may still be pending in a generation that has shipped**: 'leaves in Gen 184' was true when it was written and became false the day Gen 184 landed. Which generations have shipped is read off this file rather than off the highest number anyone has written down, so a plan ('lands in Gen 240') stays a plan instead of certifying itself - and only this file's entry headings count, not the prose inside them, because the first version of this very entry raised the ceiling to Gen 240 with the example above and switched the rule off for everything beneath it. The audit found **three stale claims, all about the combo shards Gen 184 removed, still standing twenty-one generations later**: two rows in the live mechanics catalog - one in the pressure section, one in the appendix that calls itself every field of `SessionStats` - naming `applyComboShardGain`, `combo-shard-rules.ts`, `calculateResolvedMatchSurvivalReward` and `MAX_COMBO_SHARDS`, none of which exist, and a superseded epic that still said the shards were going to leave. Rows deleted, epic corrected. Everything else resolved: the other seventeen references the first pass flagged were all dated history naming what it had buried, correctly. `yarn audit:generations` runs in `gate:systems`, and its rules are held open by fabricated fixtures in `generation-claim-audit.test.ts` rather than by the repository happening to pass - the bar has failed three times, which is where it came from.
- **Gen 205 the first three boards were the most obviously arranged boards in the game, and one gate was passing by nothing at all (`authored-floors.ts`, `system-occupancy-simulation.ts`, `tile-trait-rules.ts`):** Gen 204 had just made the procedural deal read like a shuffle; the three authored floors still announced themselves as drawn by hand. Same-suit orthogonal neighbours: floor 1 **0.800** (two solid 2x2 blocks), floor 2 **0.529** (three bands of four), floor 3 **0.600**, against the 0.430 / 0.273 / 0.296 a shuffle of the same tiles gives. All three were re-derived by exhaustive search over every arrangement satisfying the floor's lesson - for floors 1 and 2, that every one of the three ways the seed can pair a suit's four cells leaves the other pair whole inside one bounded wave; for floor 3, that plus a far Ember cell no wave can reach - taking the arrangement whose rate sits **closest to chance rather than lowest**: 0.400 / 0.294 / 0.300, no suit run longer than two. Lowest is a checkerboard (floor 1 has two valid arrangements reading 0.000) and a checkerboard is the same lie as a block told backwards, which is the mistake `mixMaxRunForSuits` exists to undo. Floor 1 nearly lost its layout on a measurement that said an ordinary deal at four pairs pops every match on 300 of 300 seeds - true, and irrelevant, because `suitCountForPairs(4)` is **one suit**: that measurement was of a board with no map on it. Given two suits only **0.371** of the arrangements of eight cells pop from every pair, so the layout buys the map and the guarantee both. Two geometric tests were restated as the walk the wave actually walks, corners included (Gen 204), rather than the Manhattan distance they were written as when it did not. Redrawing the boards then failed `sim:occupancy` by one floor in 240 - and the row it failed, `regionShuffle`, was reading **exactly 0.900 against a core bar of 0.900**. The 24 floors that missed were not floors where a shuffle was impossible: the census player pressed it when half the pairs were gone, and on a tenth of floors a break carries the board from under half to empty in one turn, so the halfway state never exists. That is a fact about the cascade being reported as a fact about the shuffle. Pressed once the floor is underway - one match resolved, cards still hidden - both shuffles read 1.000, which is a reachability claim and not a rate. Last, the trait fill reshuffled its pool inside the loop and then indexed it by the pair's position: a uniform draw wearing a round-robin's shape, and the shape was the one that would have evened the floor out. It matters because Conduit and Stasis each appear in two of the three interaction couples and Echo and Heavy in one, so the seeding spends the first two twice as often and a uniform fill leaves the skew alone. Filling from the least-dealt trait: **0.350 / 0.375 / 0.521 / 0.533 -> 0.392 / 0.404 / 0.508 / 0.512**, gap 0.183 -> 0.120. Every band held: cascade, pop, occupancy and the 200-floor endless check pass unchanged.
- **Gen 170 two simulations disagreed about Fever by five times, and the one that was wrong was the one everything was tuned against (`cascade-balance-simulation.ts`, `chain-tier-rules.ts`):** `sim:cascade` said a clean player reached Fever on 26% of floors; `sim:occupancy`, reading the run's own `feverBreaksThisFloor`, said 4%. The cascade sim was counting a break as Fever when `runChainTier(run)` read fever **after** the turn resolved - which is the tier the break's own pairs had just bought, not the tier the break happened at. The game increments the counter when the break itself resolves at Fever, and that is the honest reading. A simulation that re-derives a rule instead of reading the ledger the game keeps is the exact mistake the occupancy census exists to catch, one level up, and it is fixed the same way. With the counter read straight, a clean player's Fever share falls 0.26 → 0.14 and **every Fever band in the file turns out to have been tuned against an inflated number.** Then the real question, which is task 152's: a clean player's momentum reaches the Fever rung on 61% of floors but a Fever *break* lands on 8%, because at two thirds of a floor the rung arrives on the last match or two - when the board is nearly empty and there is nothing left for a Fever break to take. The halo, the celebration and the shard burst are all break-time effects, so Fever was content the game almost never showed. `CHAIN_TIER_FEVER_SHARE` moves 0.65 → 0.5: Fever is now "you ran half this floor clean". Measured across the share - 0.65 leaves a clean player at 0.08 of floors, 0.55 at 0.20, 0.5 at 0.27, 0.45 at 0.28 but takes the clean-over-reference separation to 1.88 against a band of 2, because half a floor is a run a sloppy player also puts together. At 0.5 the separation is 2.64, the relic loadout sits inside its bands at 0.13 clean against 0.037 reference, and the occupancy census at its own 15% miss rate goes 0.050 → 0.119, over the 0.1 bar a `common` system has to clear. **`feverBreaksThisFloor` leaves the thin list, which is now empty.** The census ratchet also moves from twelve floors to sixteen - `simulateSystemOccupancy`'s own default - so the ratchet and the aspirational check read the same census instead of two different ones; twelve held the ratchet to the first act, where floors are small, and Fever cleared its bar at sixteen (0.119) while still reading thin at twelve (0.050). Two more sample-size fixtures widened for the reason Gen 168 recorded: the release checklist's cascade row ran three seeds where the Fever bands are shares of a few dozen floors, so one floor either way moved the ratio past its band with nothing about the game changed.
- **Gen 169 the census could only see the dead half (`system-occupancy-simulation.ts`):** every bar in the occupancy census was a minimum, so it could name a system that never happens and nothing else. A system fails its own design just as completely from the other side: something written to be occasional that fires on a third of floors is not a flourish a player notices, it is part of the floor, and something written as one system among several that fires on nearly all of them has quietly become the loop while its neighbours went quiet. Each cadence now carries a ceiling as well as a floor - `rare` 0.005-0.25, `common` 0.1-0.9, `core` 0.9-1 - the report has a **Dominant systems** section beside its silent and thin ones, and the ratchet baseline records the dominant set the same way it records the other two. Run against the ceilings for the first time, two rows breached and **both were mislabels rather than generation faults**, which is worth stating because it is the answer a good diagnostic gives most often: `dungeonGatewaysUsedThisFloor` at 0.369 was filed `rare` and `findablesClaimedThisFloor` at 0.944 was filed `common`, and taking a route gateway or claiming a findable is something this game means to happen on most floors. They are relabelled `common` and `core` rather than tuned, and the dominant baseline ships empty - a result, not a placeholder. The table also prints per-floor intensity beside floor share now, because a system firing five times a floor and one firing once read identically as a share: matches resolve 5.31 times a floor, a chunk breaks 1.94, a findable is claimed 1.34. The test that proves the ceiling is wired hands the judge a census with a `rare` row pushed to 0.8, because everything real passes today and a bar nothing has ever failed is a bar nobody has checked.
- **Gen 168 the chain ladder had no middle, and the suits were why (`chunk-break-rules.ts`, `tile-suit-rules.ts`, `pop-reach-simulation.ts`):** measured at the rung each tier actually sits on - not at a fixed chain, which on a small floor is already Fever - the ladder paid 1.67 pairs per match at chain one, 1.91 at Clean, 1.92 at Sharp and 3.34 at Fever. **Sharp was worth one hundredth of a pair over Clean**, and the entire payoff sat at Fever, whose payoff is the halo: the neighbourhood of the clump whatever its suit, which is width, not depth. Two causes, and the second is the one the task named. (1) Every wave walked the whole connected same-suit region whatever the chain behind it - the reach ladder the design doc has described since Gen 143 was never in the code - so the tier decided only how many times that happened. (2) A suit averaged four and a half pairs, of which about half can break, so Clean's two waves swept everything a suit had and Sharp arrived at a clump already gone. Fixed together: a bounded wave stops two steps in (`BOUNDED_BREAK_REACH`, reach one was measured and takes the chain-one pop to 0.26 pairs, which is Gen 148's regression), the ripple moves from Clean to Sharp so each rung buys one thing, and the palette deals one suit per six pairs instead of one per two. The ladder now reads **1.18 / 2.32 / 2.71 / 3.71**, spread 1.66 → 2.53, thinnest rung 0.01 → 0.39, and `yarn sim:pop --check` bands both so it cannot flatten again. The chain-one pop is deliberately smaller - 1.67 → 1.18 pairs, and the early floors pop on 0.63-1.00 of matches where they used to pop on 0.94-1.00 - because a match with no chain behind it was taking most of what a Fever break takes, which is what left the ladder nothing to sell. **The drop came off the occupancy silent list**, exactly as Gen 151 predicted it would when a suit was big enough to leave a remnant; that baseline is updated and the two silences the reserve was supposed to wake keep their own tasks. Two relics needed repair, both because they were written against the flat ladder. Suit Lens capped a floor at three suits, which under the new palette is almost never binding - dead content - so it now deals one suit fewer than the floor would have, down to two; taking it to one was measured and is worse than dead, because a board with no map clears in 4.8 turns instead of 8.4 and Fever fell to zero across every band. Tuning Fork's partner reach at chain one makes floors clear faster (5.2 turns against 5.8) while the Fever rung is a share of the floor's pairs, so with the chain loadout held a clean player's Fever share on big floors fell to 0.08 against a 0.15 band - the chain build's centrepiece relic was buying width at the bottom of the ladder by taking the top away. It now sustains a Sharp or Fever break, whose pop feeds the chain in full rather than at half: clean 0.13, reference 0.05, separation 2.8. Full credit at every tier (separation 1.9) and from Clean up (1.81) were both measured and rejected - a chain of three is well within a sloppy player's reach, which is Gen 145's finding reproduced. Three test fixtures were widened rather than re-pointed, because in each case the sample was what disagreed and not the band: the clumped-deal control needed eight seeds rather than four (a shuffle landed at 0.56 against a 0.48 mean), the cascade bands six seeds rather than three, and the shop's trait-build preview was reading whichever traits the generated board happened to deal beside the two it sets up.
- **Gen 167 the reserve, third attempt and shipped (`dungeon-blueprint-policy-rules.ts`, `dungeon-card-recipe-rules.ts`):** the dungeon's paired-card capacity was the identical expression to the one deciding how many pairs the floor has at all, so a key, a lever, a gateway and an enemy could take every pair. It now keeps `LOOP_RESERVE_SHARE = 0.25` of the floor's pairs back, expressed as a ratio against the floor's own count the way Dead Cells derives its monster budget from combat-tile length, floored by `DUNGEON_MIN_PAIRS = 2` so no floor is reserved out of its own content. Per floor: 3 pairs keeps 1, 6 keeps 2, 13 keeps 3. Pop rate by floor moved 0.52 → 0.94 on floor 4, 0.90 → 1.00 on floor 7, 1.00 → 1.00 on 8 with pairs-per-match 1.80 → 2.60, and suits per floor came back from 1 to 2-4 on floors 9-11 because there are finally enough breakable pairs to spread a palette over. `sim:cascade --check` passes with every band held and rating drift 0. **What the reserve did NOT do, against the earlier prediction: nothing came off the silent list.** The Gen 149 note measured shuffle snares and the safe-hazard ward returning at a 40% share; at the 25% that shipped they do not, and neither does the drop (0.006 at 16 floors, 0 at the census's 12 — unchanged from before the reserve). Those three keep their own tasks rather than being counted as solved here. The two earlier attempts failed on the trim, not the reserve, and `capDungeonCardRecipeForBudget` needed four passes it did not have. (1) `pacify_floor` and `defeat_boss` were not in the objective-protection list at all, so an elite lost the enemies it exists to pacify. (2) A boss floor overrides its archetype's objective, so a boss `trap_hall` lost its traps; the trim now protects the live objective and the archetype's own. (3) Threat is protected in full before anything optional, because paying the reserve out of enemies and traps took `routeRiskRejections` to zero across all nine builds of `build-strategy-playthrough-simulation` — a route the risk policy would refuse had stopped existing, so the reserve was buying loop material by quietly disarming the dungeon and would have shown up later as a whole system going silent. (4) An objective made of several kinds now keeps one of each before any gets a second copy: `loot_cache` is the cache, the lock and the key, the recipe writes the treasures first, and a straight take filled a treasure gallery with three caches and no lock and no key while its exit still asked for a treasure key — the floor's own objective trimmed into something uncompletable. That is the same breadth-before-depth rule the generic fill uses, applied one level earlier. Reading `objectiveContributions` off the card definitions instead was tried and is worse: `find_exit` is contributed to by nearly every card, so that take swallows the whole capacity. Three assertions moved with the change and are recorded as layout shifts rather than losses: the capacity numbers, the deterministic shop stock (six items still, a different six), and the boss-overlay test, which was asserting a damage-per-turn rate that was never its point and now matches safe pairs until the boss falls. Nothing else in 4064 tests moved: the blueprint recipe and the dungeon-routing fixtures both went back to passing untouched once the four passes were in, which is the check that the trim is protecting content rather than the fixtures being rewritten around it.
- **Gen 151 the drop is subsumed by the ripple, and `sim:pop` was measuring a board nobody plays (`chunk-break-rules.ts`, `pop-reach-simulation.ts`):** the census said the drop fires on no floor. Probing 1053 matches through the real turn path over 120 generated floors says why, and it is two things. The small one is the drop's own: a pair with a job - the exit, a key, an enemy, a treasure - left in the matched suit used to veto the whole drop, and that refused 483 of 501 Sharp and Fever breaks. A key is not what holds the plain tiles up, so it no longer stops them falling; it simply is not taken. The large one is not the drop's to fix: at Sharp the ripple runs until a wave takes nothing, so it has already swept the suit - 0 plain pairs left on 92-98% of breaks at *every* tier (none 92%, clean 98%, sharp 98%, fever 97%). The drop was written for a break that took only the touching clump, and Gens 143-145 gave the break the whole suit. Two ways out were measured and rejected. Letting it run at the bounded tiers takes it to 11.3% of floors and Fever from 4% to 6.9%, but on a four-pair suit it hands a chain-one match the whole suit - the tier ladder collapsing, and three ripple tests said so. Tightening the census's `rare` band from 0.005 to 0.02 so the fixed drop's 0.6% would register honestly as thin called three hazard caches thin too, which sit at 4-7% over 160 floors: the bar was measuring the sample, not the game. So the drop stays a Sharp reward and stays on the silent list, with one of its two reasons gone, and `ACH_NOTHING_HELD_IT` stays unearnable until a suit is big enough to leave a remnant. That is the task. Separately, `sim:pop` was asking `buildBoard` for a bare floor - no tag, archetype, objective or mutators - which is the same mistake one level up as the one it exists to catch. It now builds floors through `pickFloorScheduleEntry` like a run does. Measured both ways the scheduled floors pop at least as often (0.52-1.00 against 0.50-1.00), so no band moved; the number now describes the game.
- **Gen 149 the occupancy census, and the reserve measured then set down (`system-occupancy-simulation.ts`, `dungeon-card-recipe-rules.ts`):** the run's own per-floor counters, played over 120 generated floors, say which systems ever happen to a player. Twelve never fire at all (the drop, roaming hazard hits, shuffle snares, mirror decoys, mimic caches, the magpie's theft, anchor seals, catalyst altars, parasite vessels, pin lattices, lantern wards, safe-hazard wards) and one is thin (a break lands at Fever on 4% of floors against a 10% bar). Four of the twelve are route specials the census cannot reach because it plays floors rather than runs, which is its own task. Reserving pairs from the dungeon's budget for the loop was implemented and measured twice and then reverted: at a 40% share it lifted floors 3-6 of the pop rate by about a tenth and woke shuffle snares and the safe-hazard ward, but gutted floor identity (an elite floor paid no reward, a treasure gallery held no treasure); at 25% it kept most of the gain and still cost a long tail of floors the card their archetype is named for. It is worth doing with the recipe taught to cut optional content before identity, and that is its own change. The attempt also proposed a trim order for `capDungeonCardRecipeForBudget` - one key of each kind before anything optional, so a floor that hands you a key and a lock still hands you both after a cut. That belongs with the reserve rather than ahead of it, for two reasons found by measuring it: with the capacity still equal to the floor's whole pair count nothing is ever cut, so it buys nothing today; and the order of `selected` is the order the cards are laid, so reordering it moves cards between board slots - it took the locksmith build's master-key uses to zero across every seed, because the locks that build buys a master key for are the ones the recipe writes keyless on purpose. A keyless lock is not a softlock: a master key opens any of them, the exit included, and the shop sells one.
- **Gen 148 the pop, on floors a player actually plays (`tile-suit-rules.ts`, `chunk-break-rules.ts`, `pop-reach-simulation.ts`):** the live pop from Gens 143-145 fired on nothing for the first six floors of a real run. Measured per floor with the new `yarn sim:pop`: floors 1-3 popped on 0% of matches on every seed, floor 5 on 19%. Two generation causes, both fixed. (1) The suit palette was four suits however small the floor, so on a two- or three-pair floor no two pairs shared a suit and a pop was impossible; the palette now scales with the floor's *breakable* pairs (`suitCountForPairs`: one suit under four, four at eight). (2) Caches and snares (`tileHazardKind`) were excluded from breaking alongside keys and levers, and they were one to two of the three to seven pairs on early floors; a pop now takes them without springing them, losing their reward. After: floors 1-6 pop on 50/79/56/90/94/100% of matches, floors 7-12 on 61-85%. The dungeon's paired-card budget was left alone - reserving pairs from it moved the rate by a few points and broke 13 tests across the dungeon, route and simulation layers, so it is a batch of its own. Consequences: a floor clears in 6.3 turns rather than 9.2, so the ladder was re-tuned - the pop's own wave feeds momentum at half credit and every wave the chain bought at full (measured against full credit, where a 25%-miss player reached Fever on 22% of floors against a clean player's 35%, and against no credit, where the ladder starved at 4%). Final: Fever on 20% of clean floors against 6% at the reference miss rate, chunk share of score 0.15, cleared 1.00, rating drift 0. One band moved with the design: `cleanFeverShareOnBigFloors` 0.5 → 0.15, because Fever is now the celebration on a loop that already pays, and a new band `feverCleanOverReference ≥ 2` carries what the old one protected. Design doc §10.
- **Gens 143–145 the live pop (`chunk-break-rules.ts`, `tile-suit-rules.ts`):** every match now pops the whole same-suit clump touching it, chain or no chain — a pair goes when both its halves touch — and the chain buys the ripple: from Clean, a partner pulled from across the board takes its own clump (two waves), Sharp runs the reaction until a wave takes nothing, Fever adds the halo. The deal lays every suit of three pairs or more as two islands seeded apart (1.7–1.9 islands per suit, ~30% of pairs straddling), which is what gives the ripple something to bridge. Cascade pay gains ×(1 + 0.2·(waves−1)), capped ×2. Measured on the same 6 seeds × 24 floors × 3 miss rates: miss 0 → 8.3 turns (9.2 before), 5.15 pairs a floor from breaks (4.13), chunk share of score 0.16, Fever on 50% of floors (59%), a second wave on 14%; miss 0.1 → 14.0 turns, Fever 34%; miss 0.25 → cleared 0.92, 20.1 turns, Fever 19%, rippled 10%. Every band holds; rating drift 0. Two variants were measured and rejected: a ladder fed by the ripple alone (Fever 4% of clean floors — partners rarely sit outside their clump) and one clump per suit (the ripple fired on about 5% of floors). Design doc §8.
- **Gen 137 the drop (`chunk-break-rules.ts`, `DROP_MAX_PAIRS = 2`):** a Sharp or Fever break that leaves the matched suit with two plain pairs or fewer takes them too. Measured on the same 6 seeds × 24 floors × 3 miss rates: miss 0 → 4.13 pairs a floor (4.2 before), chunk share of score 0.12 (unchanged), Fever on 59% of floors; miss 0.1 → 3.74 pairs, Fever 33%; miss 0.25 → 2.81 pairs, Fever 15%. Every bare band and every relic-loadout band holds without change. The drop moves pairs from the end of a suit into the break that emptied it rather than adding pairs: a suit's remnant was going to be matched anyway, so the sim's clear rate and rating drift (0) are untouched.

- **Gen 132 closing sweep:** `yarn sim:cascade --check` and `--relics --check` re-run after Gens 127–131; every band holds and the report numbers are those recorded under Gen 130 and Gen 126 — nothing in the clump read, the feel layer, the records, the relic registrations or the chain's carry into daily and shared play touched the cascade's pay.

- **Gen 130 chain relics (`relics.ts`, `chunk-break-rules.ts`, `tile-suit-rules.ts`):** Tuning Fork (`tuning_fork`, Clean depth 2), Magpie's Ledger (`magpie_ledger`, spilled treasure gold ×2) and Suit Lens (`suit_lens`, three suits a floor). Measured alone on 6 seeds × 24 floors, each keeps every bare band: 25%-miss Fever share 0.14 / 0.15 / 0.19, clean chunk share of score 0.14 / 0.12 / 0.13. Held together the reference Fever share is 0.23 and the clean chunk share 0.14, so the full loadout is held to `CASCADE_RELIC_BANDS` (reference Fever ≤ 0.3) rather than the bare 0.2 — a build of three chain relics is meant to move that number, and the relaxation is written down rather than absorbed into the bare bands.

- **Gen 126 deal profiles (`tile-suit-rules.ts`):** the floor archetype now chooses how suits are dealt — clumped (breather, treasure gallery, gate, shadow read, anchor chain, script room, parasite tithe), scattered (speed trial, trap hall, rush recall) or two-suit (spotlight hunt). Clean-player sim on 6 seeds × 24 floors: clumped floors cascade 4.25 pairs a floor with Fever on 60%; scattered 2.07 and 50%; two-suit 7.83 and 75%. Overall bands unchanged and green (chunk share of score 0.12 clean, 0.10 at 25% misses; Extreme Fever 0.75 / 0.45 / 0.21).

- **Gen 125 Extreme Fever (`floor-clear-momentum-bonus-rules.ts`):** the floor's end pays the momentum still standing when the last pair goes — one gold at Clean or Sharp, a shard (capped at `MAX_COMBO_SHARDS`) and two gold at Fever, tagged `extreme_fever`; never score or rating. Sized against the floor's own gold (three to eight, `getShopGoldRewardForFloor`) and the vendor's prices (two to five) so it reads as a tip, not a wage. Measured on 6 seeds × 24 floors: Extreme Fever share 0.76 at zero misses, 0.47 at 10%, 0.19 at 25%; the band `extremeFeverCleanOverReference ≥ 1.5×` holds at 4×. The per-floor counters it reads (`feverBreaksThisFloor`, `bestChainThisFloor`) also feed the floor-clear recap.

- **Gen 121 cascade balance (`cascade-balance-simulation.ts`, `yarn sim:cascade`):** the chain → chunk → Fever loop is now tuned against a report, not a feel. The sim plays a fresh endless floor at each level with a player who attempts a miss on a stated share of turns (a miss is a real mismatch: two hidden tiles from different pairs, never the shop or the exit), records turns to clear, mistakes as the game counted them, the rating, the score and the share of it the chunks paid (`chunkScoreThisFloor`, a run ledger, not a re-derivation), how many pairs the chunks took, and whether a Fever break happened. Bands live in `CASCADE_BALANCE_BANDS` and are gated by `cascade-balance-simulation.test.ts` (3 seeds × floors 1–18) and `yarn sim:cascade --check`. What the first runs found, and what changed: (1) with the rungs fixed at ×6/×10, Fever arrived on 0% of floors for a player who never missed, because chunks shorten the floor — Sharp and Fever are now shares of the floor's pairs (`max(4, 40%)`, `max(7, 65%)`); (2) with floor-relative rungs but a streak-only ladder, a 0%-miss player reached Fever *less* often than a 10%-miss player (0.22 vs 0.33) — the ladder now climbs on momentum, streak plus pairs cascaded since the chain last dropped, and a miss zeroes the cascade part; (3) on floors 3–9 the chunk broke on almost nothing (1–3 plain tiles, the rest dungeon cards, mostly treasure) — treasure pairs now spill with the chunk and pay as matched; (4) a Fever rung with no breakable neighbour was a Fever with nothing to show — Fever takes the clump's halo; (5) `settledShare` 0.94 turned out to be the sim player flipping the shop as a "miss", not a softlock. Final report on 6 seeds × 24 floors: miss 0 → cleared 1.00, 9.2 turns, chunk share of score 0.12, 2.4 breaks / 4.2 pairs per floor, Fever on 59% of floors; miss 0.1 → cleared 0.99, 15.0 turns, Fever 36%; miss 0.25 → cleared 0.90 (the rest died, none stuck), 21.7 turns, chunk share 0.10, Fever 14%. Rating equalled `calculateRating(mistakes)` on every one of 432 floors: a chunk never moved a rating. Cascade pay: 60% of a base match per pair plus `6·n·(n−1)` for size, ×1.5 at Fever; shards one per two pairs, one per pair at Fever. Not done: per-floor clustering profiles on the cycle (no authored per-floor table to hang them on), and the milestone copy (`x6`/`x10`) still names the fixed score rungs, not the floor's tier rungs.

- **V4 cycle 47 first-run/onboarding stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current first screen, fresh Classic recommendation, first-room playable prompt, first reward/floor-clear route-choice setup, Safe / Greed / Mystery teaching, and onboarding persistence remain integrated. No runtime code, score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flow changed. Verification is green on May 27, 2026 for the focused first-run slice (8 files / 120 tests), shared typecheck, adjacent GameScreen/HUD/gameplay reward-choice slice (4 files / 338 tests), full typecheck, scoped ESLint, anchored conflict-marker scan, diff whitespace check with only existing LF-to-CRLF normalization warnings, and isolated renderer build with the known large-chunk/media warnings. Remaining proof is quiet-server/manual actual fresh Classic first miss/recovery, full first-room clear without fixture injection, all three Safe / Greed / Mystery route branches, mobile-width line length, and rerunning standard playable-path e2e on a quiet server.

- **V4 cycle 8 first-run/onboarding stabilization:** continuation stayed verification-, browser-smoke-, and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current first screen, fresh Classic recommendation, first-room playable prompt, first reward/floor-clear route-choice setup, Safe / Greed / Mystery teaching, and onboarding persistence remain integrated. No runtime code, score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flow changed. Verification is green on May 27, 2026 for the focused first-run slice (8 files / 119 tests), shared typecheck, adjacent GameScreen/HUD/gameplay reward-choice slice (4 files / 338 tests), full typecheck, scoped ESLint, balance-note drift test, diff whitespace check with only existing LF-to-CRLF normalization warnings, isolated Edge first-screen-to-Classic-level-1 smoke, isolated Edge floor-clear route-choice smoke, and isolated renderer build with the known large-chunk/media warnings. Standard Playwright proof remains blocked by local harness contention: the compact Classic helper exceeded a 5-minute outer timeout and the reporter hit `EPIPE` after termination. Remaining manual proof is actual fresh Classic first miss/recovery, full first-room clear without fixture injection, all three Safe / Greed / Mystery route branches, mobile-width line length, and rerunning standard playable-path e2e on a quiet server.

- **V4 cycle 17 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused on May 27, 2026 after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain inside guardrails, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants changed. Verification passed: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, balance-note drift test (1 file / 3 tests), scoped ESLint for balance-adjacent shared files, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining proof is still quiet-server/manual fresh Classic through floor-1 clear into Safe / Greed / Mystery, with route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density checked before threshold changes.

- **V4 cycle 16 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, focused long-run/balance slice (6 files / 44 tests), and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 7 first-run/onboarding stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree. Current first screen, first-room playable prompts, miss-recovery copy, first reward/final-pair setup, route-choice teaching, and onboarding persistence remain green under focused first-run tests, adjacent GameScreen/gameplay prompt checks, shared and full typecheck, full Vitest, lint, strict conflict-marker scan, diff whitespace check, and isolated renderer build on May 27, 2026. No runtime code changed. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, balance constants, or broad UI flows changed. Browser proof remains blocked before app assertions: the bounded Classic Playwright helper timed out at `page.goto('/', waitUntil: 'domcontentloaded')` on `127.0.0.1:5173` with the known artifact ENOENT noise. Remaining proof is quiet-server/manual active-onboarding Classic through first miss/recovery, first room clear, Safe / Greed / Mystery route selection, and mobile-width line length.

- **V4 cycle 15 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree and preserving concurrent edits. Current scaling, resources, healing pressure, reward pacing, route-share, wallet-carry, low-life, unhealed low-life, and seed-variance diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 361 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1337 tests), full lint, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof remains blocked locally: `yarn playwright test e2e/navigation-flow.spec.ts --grep "Play opens Choose Your Path" --workers=1 --reporter=list` exceeded the outer timeout before useful runner output amid many concurrent Node/Chrome sessions. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 13 combat stabilization:** continuation stayed stabilization-focused after inspecting the dirty `main` worktree. One scoped test-fixture integration fix landed in `src/shared/game.test.ts`: the paused zero-health stale shop fixture now uses the current `heal_life` shop item shape, including compatibility fields, so shared typecheck covers the existing death/resume guard without weakening the contract. Focused combat tests, the broad combat slice, shared and full typecheck, balance-note drift, 1000-floor endless schedule smoke, full Vitest, lint, conflict-marker scan, diff whitespace check, and isolated renderer build are green on May 27, 2026. No enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop price, scoring, hazard-cadence, combat-read, patrol-movement, save-schema, or economy constants changed. The bounded `e2e/gameplay-readability.spec.ts` Playwright attempt reached the runner but failed all 11 cases before app assertions because `127.0.0.1:5173` reset/refused connections after `page.goto`. Remaining proof is quiet-server browser/manual combat QA for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, fatal/invalid armed-power contact feedback, guard-spent contact, trap mismatch with and without ward, boss HP chip updates, and death/retry flow on desktop/mobile.

- **V4 cycle 6 first-run/onboarding stabilization:** continuation stayed focused on first screen, first room, first choice, first reward/failure, and goal clarity after inspecting the dirty `main` worktree. Current first-run launcher/help-center split, playable first-pair prompts, miss-recovery copy, final-pair reward setup, route-choice teaching, and onboarding persistence remained green under focused first-run tests, adjacent GameScreen/gameplay prompt checks, shared and full typecheck, full Vitest, lint, strict conflict-marker scan, diff whitespace check, and isolated renderer build on May 27, 2026. One scoped build-gate fix aligned ESLint ignores with generated artifact directories already ignored by git so `yarn lint` no longer fails when `test-results/` is absent. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema fields, onboarding persistence semantics, economy, or balance constants changed. Remaining proof is quiet-server browser/manual active-onboarding Classic through first miss/recovery, first room clear, Safe / Greed / Mystery route selection, and mobile-width line length.

- **V4 cycle 14 balance/difficulty stabilization:** continuation stayed verification- and documentation-focused after inspecting the dirty `main` worktree. Current balance/resource/reward diagnostics remain within bounds, so no score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, save schema, or gameplay constants were changed. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 360 tests), shared and full typecheck, balance-note drift test, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1334 tests), full lint after a concurrent test cleanup landed, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof remains blocked before app assertions: `e2e/navigation-flow.spec.ts` still times out on `page.goto('/', waitUntil: 'domcontentloaded')` against `127.0.0.1:5173` and reports Playwright artifact ENOENT noise. Remaining manual proof is fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 5 first-run/onboarding wrap-up:** continuation stayed stabilization- and verification-focused after inspecting the dirty `main` worktree. Focused shared first-run, renderer onboarding/menu, app/store, full typecheck, full Vitest, lint, isolated renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. Production preview browser smoke passed main menu -> Choose Your Path -> Classic level 1 with screenshot `output/playwright/first-run-v4c5-level1.png`; full guided floor-clear browser proof remains a quiet-server follow-up because standard `127.0.0.1:5173` Playwright failed before app assertions and isolated Vite dev servers timed out serving `/`, while production preview lacks the DEV-only board-pick hook used by the floor-clear helper. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, economy, or balance constants changed.

- **V4 cycle 13 balance/difficulty stabilization:** fixed one integration breakage from the current dirty worktree without changing runtime balance math: a stale renderer store test side-room fixture now uses `rest_shrine`, matching the shared `RouteSideRoomKind` contract while preserving `nodeKind: 'rest'`. Verification is green on May 27, 2026: focused balance/resource/gameplay slice (9 files / 360 tests), shared and full typecheck, affected store + balance simulation tests (2 files / 71 tests), 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest (179 files / 1329 tests), lint, isolated renderer build, strict conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Browser proof is still blocked: an isolated `127.0.0.1:5193` Vite server became reachable but the in-app browser timed out on `domcontentloaded` and exposed an empty accessibility tree, and the existing `e2e/navigation-flow.spec.ts` smoke also exceeded the outer timeout. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, save schema, or gameplay constants changed. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 12 balance/difficulty wrap-up:** added one reporting-only long-run gate row for the existing stranded low-life diagnostic: `max_profile_unhealed_low_life_streak`. The 48-floor gate now prints both worst-seed unhealed low-life share and the longest unhealed low-life streak, making recovery cliffs visible in standard balance output without changing score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, wallet, route-share, profile-bound, or gameplay constants. Verification is green on May 27, 2026: focused balance/resource/gameplay slice, shared and full typecheck, 48-floor long-run gate (`max_profile_worst_seed_unhealed_low_life_share=0.29`, `max_profile_unhealed_low_life_streak=2`), 1000-floor endless schedule smoke, full Vitest, lint, isolated renderer build, conflict-marker scan, and diff whitespace check with only existing LF-to-CRLF normalization warnings. Remaining manual proof is still fresh Classic through floor-1 clear into Safe / Greed / Mystery, route toll clarity, rest/heal affordance, Greed risk readability, boss pressure tooltip, reward overflow messaging, low-life recovery reads, wallet/readout clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 10 memory mechanic depth wrap-up:** continuation stayed stabilization- and verification-focused after inspecting the dirty `main` worktree. Focused memory/HUD checks, shared and full typecheck, broader shared recall gameplay checks, lint, isolated renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No recall scoring, focus cap, clue bonus, burden threshold, route readiness logic, life, route payout, shop cost, assist charge, reward, economy, memory-pressure, or gameplay constants were changed. Remaining work is quiet-server/manual browser proof for fresh Classic through floor-1 clear into Safe / Greed / Mystery, checking the memory read panel, route readiness labels, polite recall announcements, capped focus display, burden line length, repeated-copy cadence, patrol-only strained recall copy, compact HUD recent-action priority, and desktop/mobile density.

- **V4 cycle 4 first-run/onboarding wrap-up:** continuation stayed stabilization- and verification-focused on the dirty `main` worktree. Focused shared, renderer, app/store, full Vitest, full typecheck, diff hygiene, conflict-marker scan, and alternate renderer build are green on May 27, 2026. A custom real Chromium smoke on an isolated `127.0.0.1:5183` Vite server passed main menu -> Choose Your Path -> guided Classic level 1 -> floor clear -> Safe / Greedy / Mystery route-choice setup, confirming the first screen, first room, first reward, and first choice path in-browser. The standard Playwright config path on reusable `127.0.0.1:5173` still failed before app assertions with a `page.goto('/')` `domcontentloaded` timeout and artifact ENOENT noise, so repo-spec browser proof remains a quiet-server follow-up. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants changed.

- **V4 cycle 11 balance/difficulty wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, lint, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, economy, or gameplay constants were changed. Remaining manual proof is still live Classic route-choice readability for Safe / Greed / Mystery, low-life recovery reads, boss pressure reads, reward overflow messaging, wallet clarity, and desktop/mobile density before changing thresholds.

- **V4 cycle 9 memory mechanic depth wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused memory/HUD checks, shared and full typecheck, broader shared recall gameplay checks, full Vitest, lint, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No recall scoring, focus cap, clue bonus, burden threshold, route readiness logic, life, route payout, shop cost, assist charge, reward, economy, memory-pressure, or gameplay constants were changed. Remaining work is quiet-server/manual browser proof for fresh Classic through floor-1 clear into Safe / Greed / Mystery, checking the memory read panel, route readiness labels, polite recall announcements, capped focus display, burden line length, repeated-copy cadence, patrol-only strained recall copy, and desktop/mobile density.

- **V4 cycle 9 combat stabilization:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared/renderer combat checks, shared/full typecheck, full Vitest, balance-note drift, conflict-marker scan, diff whitespace checks, and an isolated renderer build are green on May 27, 2026. No enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop, scoring, hazard-cadence, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser attempt did not reach app assertions because the local Vite web server exited with code `4294967295`, followed by goto timeout/reset/refused connection failures. Remaining work is still live browser/manual proof for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, invalid/fatal armed-power contact feedback, boss HP chip updates, and death/retry flow on desktop/mobile.

- **V4 cycle 10 balance/difficulty wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, full Vitest, lint, the 48-floor long-run gate, the 1000-floor endless schedule smoke, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, economy, or gameplay constants were changed. Remaining manual proof is still live Classic route-choice readability for Safe / Greed / Mystery, low-life recovery reads, boss pressure reads, wallet clarity, and desktop/mobile density.

- **V4 cycle 3 first-run/onboarding wrap-up:** continuation stayed verification- and documentation-only after inspecting the dirty `main` worktree. The current fresh-profile Classic launcher, guided first-room target prompts, first miss recovery, first reward/final-pair setup, route-choice teaching, and app/store onboarding persistence remain green under focused tests, full typecheck, full Vitest, and the alternate renderer build on May 27, 2026. Browser proof is now partially green on a fresh healthy Vite server: the first-screen-to-level-1 navigation smoke and compact Classic helper passed, while the heavier floor-clear playable-path browser case still exceeded a six-minute outer timeout during concurrent local reloads. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants changed.

- **V4 cycle 9 balance/difficulty diagnostics:** added stranded low-life profile diagnostics without changing runtime balance constants. Balance profiles now track low-life floors that do not have immediate shop healing access, expose max unhealed low-life streaks, gate worst-seed unhealed low-life exposure, and print the worst-seed unhealed-low-life row in the 48-floor long-run gate. The current greedy profile still reaches low-life pressure but remains fall-free, with worst-seed unhealed low-life share at 0.29 against the 0.45 bound.
- **V4 cycle 8 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/gameplay checks, shared and full typecheck, balance-note drift, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, profile-bound, route-share, wallet, or economy constants were changed.
- **V4 cycle 2 first-run/onboarding wrap-up:** stabilization preserved the current first-screen Classic launch, guided first-room prompt flow, first miss recovery copy, and first route-choice teaching without changing score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants. The only runtime hardening was startup raster preload fail-open behavior so a stuck image decode cannot block boot. Focused first-run checks, full typecheck, full Vitest, and alternate renderer build are green on May 27, 2026; live playable-path browser proof remains blocked by local Vite connection resets/refusals and needs a quiet-server rerun.
- **Rules v16 higher tension rebalance:** objective and boss rewards are larger, but missed objective streaks decay faster, first-mismatch grace narrows after floor 1, mistake recovery grants less memorize time, clean clears no longer award destroy charges, and shop / relic services cost more.
- **V4 cycle 1 combat stabilization:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, balance-note drift, the 1000-floor endless schedule smoke, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, status-effect, or patrol movement constants were changed. The closest browser gameplay-readability smoke exceeded a 10-minute local timeout without runner output, and broad `yarn test` is blocked outside combat by startup asset preload tests, so live fatal-patrol/boss-pressure proof and full-suite signoff remain pending.
- **Rules v29 long-run balance pass:** floor-clear shop gold starts at 2 and caps at 8 per floor so long runs cannot outgrow shop sinks indefinitely; boss floors keep a single moving patrol overlay and carry an explicit guard shrine utility pair to reduce late-cycle survivability cliffs without removing boss pressure.
- **Cycle 1 difficulty-ramp refinement:** generated dungeon runs keep floor 1 free of runtime hazard tiles, then introduce deterministic hazard tiles from floor 2 onward. Moving enemies were already gated off floor 1; this makes the first playable floor a true onboarding floor without reducing later resource pressure.
- **Cycle 2 survivability diagnostics:** balance profiles now carry lives, heal purchases, run falls, healing-spend share, and repeated at-risk streaks per seed. Greedy profiles still claim more reward value, but they must buy healing before last-life collapse so long-run averages cannot hide run-ending survivability cliffs.
- **Cycle 3 safe-route sustain sink:** Safe-route rest side rooms still rescue damaged runs, but no longer bypass scarcity for free when the wallet has value; claiming the heal spends 1 shop gold if available. This keeps Safe as the recovery route while preventing repeated safe rests from becoming a dominant no-cost sustain loop.
- **Cycle 4 direct safe-route sink:** The immediate Safe route recovery/guard payout now also spends 1 shop gold when the run has any gold, while remaining free when broke and free when already capped. Safe remains the survival route, but choosing it repeatedly no longer preserves a growing wallet for later shop spikes.
- **Cycle 5 destroy-charge scarcity:** Floor advancement no longer grants destroy charges for clean/perfect clears. Destroy remains an uncapped run bank, but inflow now comes from explicit economy sources (shops, relics, events, rooms, and pickups), so clean-clear skill rewards do not snowball into a dominant assist loop.
- **Cycle 6 route dominance diagnostics:** balance profiles now model Safe, Greed, and Mystery route choices, including Safe toll spend and Greed life costs. Bounds fail when any profile leans too hard on one route or when greed cadence creates run falls, keeping route rewards from becoming a single dominant strategy.
- **Cycle 7 wallet-carry diagnostics:** balance profiles now report discretionary shop spend, ending shop gold, and peak gold held. Long-run gates fail if survivable profiles are also carrying runaway unspent wallets, so scarcity checks cover both healing pressure and late-run purchasing power.
- **Cycle 8 recovery-debt diagnostics:** pressure floors now report local guard/shop/room/key relief and max net-pressure streaks. Profile bounds fail when pressure clusters outrun nearby recovery even if total lives, wallet, and boss win rates still look healthy.
- **Cycle 9 low-life exposure diagnostics:** profile simulations now count floors ending at 2 or fewer lives, plus max low-life streaks. Bounds fail when a run survives on paper but spends too much time near collapse, covering survivability cliffs that do not show up as deaths.
- **Cycle 10 seed-variance diagnostics:** balance profiles now retain per-seed outcomes and gate worst-seed clear share, worst-seed low-life exposure, per-seed run falls, max seed wallet, and best-vs-worst clear spread. Aggregate averages can no longer hide one rough seed inside an otherwise healthy profile.
- **V3 cycle 10 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance, difficulty, combat-adjacent shared checks, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, or difficulty constants were changed.
- **V3 cycle 11 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, endless schedule smoke, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 12 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, endless schedule smoke, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 13 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, difficulty ramp, floor-mutator schedule, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V3 cycle 14 balance/difficulty wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance profile checks, long-run depth, boss identity, difficulty ramp, floor-mutator schedule, balance-note/relic-doc drift, shared typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, and diff whitespace checks remain green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 1 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/gameplay checks, shared and full typecheck, full Vitest, alternate renderer build, long-run gate metrics, 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 2 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused balance/resource/reward checks, shared and full typecheck, 48-floor long-run gate metrics, 1000-floor endless schedule smoke, and diff whitespace checks are green on May 27, 2026. Full Vitest is blocked by two startup-asset preload test timeouts outside this lane; no score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants were changed.
- **V4 cycle 4 balance/difficulty wrap-up:** continuation pass added focused regression coverage for existing Safe-route toll and Greed life-cost diagnostics in `src/shared/balance-simulation.test.ts`, then reran balance profile, long-run, endless schedule, shared/full typecheck, and diff-whitespace verification. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, or economy constants were changed. Full Vitest remains load-sensitive outside this lane: the full run timed out in one renderer app-flow test at the default 5s timeout, while `src/renderer/App.test.tsx` passed alone with a 10s timeout.
- **V4 cycle 5 balance/difficulty wrap-up:** continuation pass stayed verification- and documentation-only. Focused balance/resource/gameplay checks, balance-note drift, long-run depth, economy ledger, shared/full typecheck, the 48-floor long-run gate, the 1000-floor endless schedule smoke, full Vitest, and diff whitespace checks are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, economy, route-share, wallet, or profile-bound constants were changed.
- **V4 cycle 6 balance/difficulty wrap-up:** continuation pass added one focused dominant-strategy regression in `src/shared/balance-simulation.test.ts`: Greedy profiles must still pay Greed life costs, remain fall-free, and keep their long-run reward premium at or below 1.6x the cautious profile. Focused balance/resource/gameplay checks, shared typecheck, the 48-floor long-run gate, and the 1000-floor endless schedule smoke are green on May 27, 2026. No score, life, route payout, shop price, healing amount, reward, hazard cadence, boss multiplier, memory-pressure, or economy constants were changed.
- **V4 cycle 5 combat stabilization:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared/renderer combat checks, shared/full typecheck, full Vitest, balance-note drift, alternate renderer build, the 1000-floor endless schedule smoke, conflict-marker scan, and diff whitespace checks are green on May 27, 2026; no enemy damage, life, guard-token, boss HP, status-effect, route, reward, shop, scoring, hazard-cadence, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser smoke exceeded an 8-minute local timeout without useful runner output, so remaining work is quiet-server browser/manual proof for occupied moving-enemy tiles with Peek, Destroy, Stray, and Gambit, fatal-contact game-over transition, guard-token spend reads, boss HP chip updates, and death/retry flow on desktop/mobile.
- **V3 cycle 1 memory mechanic depth wrap-up:** memory recall feedback is covered as a read-only presentation layer over existing run state: focus tier, forgotten markers, remembered clues, route choice readiness, patrol pressure, symbol-map counters, active memory taxes, and owned recall assists. No score, life, charge, or route outcome constants were changed in this stabilization lane.
- **V3 cycle 1 progression/meta stabilization:** profile progression now exposes capped honor-mark sources, profile difficulty tiers, milestone copy, deferred-upgrade handling, and per-run meta delta rows. Challenge gates can reference the active profile tier without making online services or paid skips part of progression.
- **V3 cycle 1 first-run/onboarding wrap-up:** playable onboarding remains a presentation/targeting layer over the real first-floor board. The harness regression now asserts two actual target tile ids plus the current split between title copy and action prompt copy; no score, life, route, hazard, or economy constants were changed.
- **V3 cycle 2 first-run/onboarding wrap-up:** first-run guidance now covers the miss-recovery beat, final-pair route-choice setup, ordered scenario completion, and Main Menu help-center room-choice copy. No score, life, route payout, hazard cadence, reward, shop, relic, or economy constants were changed.
- **V3 cycle 3 first-run/onboarding wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer checks, save persistence, shared typecheck, full typecheck, diff whitespace, and balance-note drift are green on May 27, 2026; browser playable-path/navigation smoke timed out locally and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, or economy constants were changed.
- **V3 cycle 4 first-run/onboarding wrap-up:** final one-hour lane stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer/app/store checks, shared typecheck, full typecheck, balance-note drift, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser smoke exceeded a five-minute outer timeout under concurrent local load and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V3 cycle 5 first-run/onboarding wrap-up:** final one-hour lane stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused first-run shared/renderer/app/store/save checks, shared typecheck, full typecheck, balance-note drift, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser slice exceeded a five-minute outer timeout and remains follow-up work. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V4 cycle 1 first-run/onboarding wrap-up:** stabilization kept the existing first screen, first room, first choice, and first reward/failure guidance intact while removing a full-suite startup preload test isolation failure. Focused first-run checks, shared typecheck, full typecheck, full Vitest, and diff whitespace are green on May 27, 2026; the navigation/playable-path browser slice still exceeded a 10-minute outer timeout under heavy local Node/Playwright process load. No score, life, route payout, hazard cadence, reward, shop, relic, save-schema, onboarding persistence, or economy constants were changed.
- **V3 cycle 2 progression/meta stabilization:** no new economy or pressure constants were changed. The wrap-up verified that local-only honor marks, profile tier copy, reward-ready versus reward-owned states, post-run meta deltas, challenge progression, save normalization, collection projections, core run results, and balance profile diagnostics still agree after concurrent V3 edits.
- **V3 cycle 3 progression/meta wrap-up:** no new progression economy constants were changed. Focused verification is green for profile honor marks, tier/milestone copy, deferred upgrade handling, challenge gates, save normalization, collection projection, and game-over next-run delta surfacing.
- **V3 cycle 4 progression/meta wrap-up:** no new progression, reward, honor-mark, challenge-gate, save-schema, route, or economy constants were changed. Focused shared and renderer-facing progression verification is green on May 26, 2026; remaining work is broader typecheck/build/e2e after the active renderer/audio/content edits settle.
- **V3 cycle 5 progression/meta wrap-up:** no new progression, reward, honor-mark, challenge-gate, save-schema, route, shop, relic, or economy constants were changed. Focused shared and renderer-facing progression verification remains green on May 26, 2026; remaining work is full repo typecheck/test/build/e2e once concurrent renderer/audio/content edits settle.
- **V3 cycle 6 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared progression, renderer-facing profile/collection/game-over surfaces, shared typecheck, and full typecheck are green on May 26, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, or balance constants were changed.
- **V3 cycle 7 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, and full typecheck checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, or balance constants were changed.
- **V3 cycle 8 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed.
- **V3 cycle 9 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work stays in browser/manual profile-to-post-run smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 10 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark, reward, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work stays in live browser/manual profile-to-post-run smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 11 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 12 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 13 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V3 cycle 14 progression/meta wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge, collection, game-over, profile renderer, shared typecheck, full typecheck, balance-note drift, and diff whitespace checks remain green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is still live browser/manual post-run-to-profile smoke for meta delta copy, reward-ready versus owned states, tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy.
- **V4 cycle 2 progression/meta wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge gates, collection, game-over, profile renderer, shared typecheck, full typecheck, full Vitest, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, or balance constants were changed. Remaining work is live browser/manual post-run-to-profile smoke plus the product decision on whether the seven-daily relic-shrine upgrade remains save-normalized or moves to explicit claim UI.
- **V4 cycle 6 progression/meta wrap-up:** continuation pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused progression/meta, save normalization, challenge gates, collection, game-over, profile/main-menu renderer surfaces, shared/full typecheck, full Vitest, alternate renderer build, conflict-marker scan, and diff whitespace checks are green on May 27, 2026; no progression economy, profile-level threshold, honor-mark cap, reward ownership, challenge-gate, save-schema, route, shop, relic, reward-math, score/life, or difficulty constants were changed. Remaining work is live browser/manual post-run-to-profile smoke plus the explicit-claim versus auto-activation product decision for the seven-daily relic-shrine upgrade.
- **V3 cycle 1 combat stabilization:** fatal direct contact with a moving enemy now reveals the patrol state but does not advance enemy movement after the run has already reached `gameOver`. This keeps terminal combat boards deterministic and avoids post-death patrol drift in retry/results surfaces.
- **V3 cycle 3 combat stabilization:** added renderer coverage for fatal patrol contact so the game-over combat read keeps the occupied card hidden, keeps patrol movement frozen, and surfaces the revealed-patrol status plus terminal next-step copy. No combat, life, guard, route, or reward constants were retuned.
- **V3 cycle 4 combat stabilization:** focused combat verification is green on May 26, 2026. No enemy damage, guard-token, boss, route, reward, hazard-cadence, or scoring constants were changed; remaining combat work is browser/e2e proof of the fatal moving-patrol game-over path and manual boss-floor playtest notes.
- **V3 cycle 5 combat stabilization:** final wrap-up stayed verification- and documentation-only on May 26, 2026. Focused shared combat, boss, balance, drift, renderer game-screen, and store checks remain green; no combat, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, or scoring constants were changed.
- **V3 cycle 6 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared combat, boss identity, softlock, exploit, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, or scoring constants were changed.
- **V3 cycle 7 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck plus focused combat, boss identity, softlock, exploit, balance drift, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 8 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared combat, boss identity, softlock, exploit, balance, renderer store, and GameScreen checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 9 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck plus focused combat, boss identity, softlock, exploit, balance, renderer store, GameScreen, and TileBoard checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 10 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Shared typecheck, full typecheck, diff whitespace, and focused combat, boss identity, softlock, exploit, balance drift, renderer store, GameScreen, and TileBoard checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, or combat-read constants were changed.
- **V3 cycle 11 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, or patrol movement constants were changed. Remaining work is browser/e2e proof for the fatal moving-patrol game-over path plus manual boss-floor playtest notes on a quiet local server.
- **V3 cycle 12 combat stabilization:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused shared/renderer combat checks, shared typecheck, full typecheck, and diff whitespace checks remain green; no enemy damage, life, guard-token, boss, route, reward, hazard-cadence, shop, assist, scoring, combat-read, or patrol movement constants were changed. The `e2e/gameplay-readability.spec.ts` browser smoke exceeded the five-minute local timeout, so browser proof for fatal moving-patrol game-over and manual boss-floor playtest notes remain pending on a quiet local server.
- **V3 cycle 8 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build are green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 9 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build remain green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Existing Vite chunk-size warnings remain for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB); remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 10 performance/polish wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree on May 27, 2026. Focused preload/image/audio/viewport/tilt tests, full typecheck, diff whitespace, and the alternate renderer production build remain green; no preload breadth, warmup concurrency, code-splitting, compression, asset payload, rendering, audio, UI, gameplay, economy, or balance constants were changed. Existing Vite chunk-size warnings remain for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.15 kB); remaining work is a browser startup trace plus lower-end device smoke before changing bundle structure or asset payloads.
- **V3 cycle 1 closeout:** balance/difficulty stabilization is test-green for the current shared simulation lane (`balance-simulation`, core `game`, bonus reward, and boss encounter tests). Remaining balance work should stay data-driven: expand the seed set beyond the current smoke seeds, capture real playtest floor-6/floor-12 outcomes, and tune only one economy or pressure constant per pass.
- **V3 cycle 2 final wrap-up:** no balance constants were retuned in the deadline lane. The existing shared balance and docs drift guards are green for `balance-simulation` plus `balance-notes-drift` on May 26, 2026; keep remaining changes focused on verification, wider seed coverage, and manual playtest notes rather than last-minute economy math.
- **V3 cycle 2 core gameplay loop closeout:** no new gameplay, economy, score, life, route, shop, or assist constants were changed in the final wrap-up lane. Current `main` is typecheck-clean and unit-test-clean after the concurrent V3 edits: shared typecheck, full renderer/shared typecheck, focused core gameplay checks, balance-note drift, and the full Vitest suite all passed on May 26, 2026.
- **V3 cycle 3 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/softlock/exploit checks, balance-note drift, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 26, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, or reward constants were changed.
- **V3 cycle 4 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, or reward constants were changed.
- **V3 cycle 5 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, or map-generation constants were changed.
- **V3 cycle 6 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed.
- **V3 cycle 7 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, the 1000-floor endless schedule smoke, and the full Vitest suite are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work stays in browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 8 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work stays in browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 9 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work is still browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 10 core gameplay loop closeout:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, full typecheck, focused core gameplay/balance/navigation/inventory checks, balance-note drift, sim-endless output, diff whitespace, and the 1000-floor endless schedule smoke are green on May 27, 2026; no gameplay, economy, score, life, route, shop, assist, boss, hazard, reward, inventory, map-generation, or balance constants were changed. Remaining work is still browser/manual smoke for fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density.
- **V3 cycle 2 memory mechanic depth wrap-up:** the recall-focus loop and feedback ledger are stable under focused shared checks. No additional score, life, route, shop, or assist constants were retuned in the final hour; remaining work is renderer surfacing, route-choice e2e coverage, and playtest calibration of diagnostic burden labels.
- **V3 cycle 3 memory mechanic depth wrap-up:** focused memory-depth verification is green on May 26, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, shop, assist, or reward constants were retuned; the lane remains safe stabilization plus documentation while concurrent renderer/audio/content edits settle.
- **V3 cycle 4 memory mechanic depth wrap-up:** focused shared verification is still green on May 26, 2026, and the route-choice renderer unit path now covers the memory read panel plus Safe / Greed / Mystery recall copy. No recall scoring, focus cap, burden threshold, life, route, shop, assist, or reward constants were retuned in this final hour.
- **V3 cycle 5 memory mechanic depth wrap-up:** focused shared and renderer verification remains green on May 26, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned; final work stayed on verification and remaining-work documentation while preserving unrelated concurrent edits.
- **V3 cycle 6 memory mechanic depth wrap-up:** focused memory-depth verification remains green on May 27, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned; this pass stayed on safe stabilization, route-choice/read-panel verification, and remaining-work documentation.
- **V3 cycle 7 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared and renderer memory-depth checks remain green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 8 memory mechanic depth wrap-up:** copy-only stabilization now distinguishes enemy/patrol-only strained recall from forgotten-marker strain, with focused shared verification green on May 27, 2026. No recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 9 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Shared typecheck, focused recall-feedback tests, and the renderer route-choice memory-read assertion remain green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, or memory-pressure constants were retuned.
- **V3 cycle 10 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, route-choice memory read, shared typecheck, and diff whitespace checks are green on May 27, 2026 with only existing CRLF normalization warnings; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 11 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, Choose Path first-run route setup, renderer GameScreen route-choice memory read, store integration, and shared typecheck are green on May 27, 2026; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 12 memory mechanic depth wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused recall feedback, renderer route-choice memory read, balance-note drift, shared typecheck, and diff whitespace checks are green on May 27, 2026 with only existing LF-to-CRLF normalization warnings; no recall scoring, focus cap, burden threshold, route readiness, life, route, shop, assist, reward, economy, or memory-pressure constants were retuned. Remaining work stays in live browser floor-clear-to-route-choice smoke and manual floor-6/floor-12 burden-label calibration.
- **V3 cycle 7 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, and TypeScript checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service hooks, or economy constants were changed.
- **V3 cycle 11 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, full TypeScript, balance-note drift, and diff hygiene checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, or economy constants were changed.
- **V3 cycle 12 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, reward, prep, meta-signal, balance, renderer inventory, full TypeScript, balance-note drift, and diff hygiene checks remain green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, or economy constants were changed.
- **V3 cycle 3 dungeon navigation / room-flow wrap-up:** focused navigation and side-room checks are green on May 26, 2026. No route payouts, side-room rewards, life costs, shop costs, or map cadence constants were retuned in this final lane; current stabilization stays scoped to route graph repair, first-room launch flow, disabled Greed copy, side-room feedback clarity, and documentation.
- **V3 cycle 4 dungeon navigation / room-flow wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, store, side-room, choose-path, and app navigation checks remain green on May 26, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, or map-generation constants were changed.
- **V3 cycle 5 dungeon navigation / room-flow wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, store, side-room, choose-path, app navigation, and shared typecheck checks remain green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, or economy math were changed.
- **V3 cycle 7 dungeon navigation / room-flow wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, route foundation, store, side-room, choose-path, app navigation, and shared typecheck checks remain green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, or economy math were changed.
- **V3 cycle 10 dungeon navigation / room-flow wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused route-map, route rules, core game, renderer navigation, side-room, choose-path, store, shared typecheck, full typecheck, and diff hygiene checks are green on May 27, 2026; no route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, or economy math were changed.
- **V4 cycle 1 dungeon navigation / room-flow wrap-up:** stabilized the dirty `main` worktree's in-progress route graph and side-room work. Focused route-map, route foundation, core game, store, Choose Path, and Side Room checks are green on May 27, 2026, along with shared/full TypeScript and diff hygiene; browser navigation/playable-path smoke still times out locally before useful runner output. No route payouts, side-room rewards, life costs, shop costs, boss cadence, score rules, reward math, or economy math were changed in this lane.
- **V3 cycle 2 narrative / atmosphere / content wrap-up:** no new content systems or balance math were added in the deadline lane. The authored event room, memory recall feedback, copy-tone, and long-run feedback contracts are green on May 26, 2026; remaining work should be integration polish, visual/audio pairing, and localization readiness rather than late copy expansion.
- **V3 cycle 3 narrative / atmosphere / content wrap-up:** no new content systems, reward math, route consequences, or memory thresholds were changed in the final stabilization lane. Focused narrative/content verification is green on May 26, 2026; remaining work stays in renderer surfacing, audio/visual pairing, and localization cleanup.
- **V3 cycle 4 narrative / atmosphere / content wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. The authored event atmosphere catalog, memory recall feedback beats, copy-tone audit, and long-run feedback rows are green on May 26, 2026; no content systems, reward math, route consequences, recall thresholds, or relic-offer behavior were changed.
- **V3 cycle 5 narrative / atmosphere / content wrap-up:** final stabilization kept `main` on the existing dirty worktree and made no runtime retune. Focused narrative/content verification is green on May 26, 2026 across memory recall feedback, event atmosphere rows, copy-tone rules, long-run feedback, and Choose Path first-run copy; remaining work stays in browser smoke, final audio/visual pairing, and localization extraction.
- **V3 cycle 6 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification remains green on May 27, 2026 across memory recall feedback, authored event atmosphere rows, copy-tone rules, long-run feedback, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, or economy constants were changed.
- **V3 cycle 7 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification remains green on May 27, 2026 across memory recall feedback, authored event atmosphere rows, copy-tone rules, long-run feedback, dungeon card labels, relic copy/eligibility, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, or economy constants were changed.
- **V3 cycle 8 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, balance-note drift, and whitespace checks remain green on May 27, 2026 across copy-tone rules, dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run feedback, authored event atmosphere rows, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 9 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 10 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, or economy constants were changed.
- **V3 cycle 11 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across copy-tone guidance, dungeon card labels, first-run help copy, memory recall feedback, long-run feedback, event atmosphere rows, relic copy, and Choose Path first-run copy; no content systems, reward math, route consequences, recall thresholds, relic-offer behavior, card taxonomy semantics, localization architecture, or economy constants were changed.
- **V3 cycle 12 narrative / atmosphere / content wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused narrative/content verification, shared/full typecheck, and whitespace checks remain green on May 27, 2026 across recall feedback, event atmosphere, copy-tone, long-run feedback, first-run help, encyclopedia glossary, dungeon card labels, relic copy, Choose Path first-run copy, and Game Over copy; no content systems, route consequences, reward math, recall thresholds, relic-offer behavior, card taxonomy semantics, localization architecture, or economy constants were changed.
- **V3 cycle 1 performance / polish wrap-up:** startup-critical preload now keeps heavyweight card illustrations and mode posters on idle/fallback warmup, image warmup dedupes pending decodes with bounded concurrency, UI SFX preload uses shared buffer loading, viewport resize commits are animation-frame throttled, and platform tilt avoids redundant CSS variable writes.
- **V3 cycle 2 performance / polish wrap-up:** no additional performance code changes were needed after focused verification. The current preload, image warmup, audio buffer preload, viewport resize, and platform tilt guards are test-green with renderer TypeScript on May 26, 2026; remaining work is browser trace capture and lower-end device smoke rather than late behavior changes.
- **V3 cycle 3 performance / polish wrap-up:** focused preload, image warmup, audio buffer, viewport resize, and platform tilt checks remain green on May 26, 2026. No additional runtime behavior changes were made in this deadline lane; remaining work stays in measured browser trace capture, lower-end device smoke, and bundle profiling.
- **V3 cycle 4 performance / polish wrap-up:** final one-hour pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, or economy behavior was retuned.
- **V3 cycle 5 performance / polish wrap-up:** final one-hour pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance constants were retuned.
- **V3 cycle 6 performance / polish wrap-up:** final pass stayed verification- and documentation-only on May 27, 2026 after inspecting the dirty `main` worktree. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks remain green. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance behavior was retuned.
- **V3 cycle 7 performance / polish wrap-up:** final pass made one test-only stabilization so startup background warmup timers do not leak raster requests between preload tests. Focused preload, image warmup, audio buffer, viewport resize, platform tilt, full renderer TypeScript, whitespace, and alternate renderer build checks are green on May 27, 2026. No startup preload, image warmup, audio preload, viewport, tilt, gameplay, route, reward, economy, or balance behavior was retuned.
- **V3 cycle 3 balance/difficulty wrap-up:** focused shared balance verification is green on May 26, 2026, so no deadline-lane economy, life, route, boss, hazard, or reward constants were retuned. Current stabilization should remain documentation and verification only unless a reproducible seed/profile failure appears.
- **V3 cycle 4 balance/difficulty wrap-up:** focused shared, long-run, and endless schedule checks are green on May 26, 2026. No economy, life, route, boss, hazard, reward, or memory-pressure constants were changed in this final hour; remaining work stays in seed expansion and manual playtest calibration.
- **V3 cycle 2 bug and edge-case hunt wrap-up:** current `main` stayed code-stable under broad verification on May 26, 2026. No gameplay, economy, reward, route, audio, rendering, or balance constants were changed; full TypeScript, full Vitest, and lint all pass, with only the pre-existing `GameScreen.tsx` Fast Refresh warnings still open.
- **V3 cycle 5 balance/difficulty wrap-up:** focused shared balance, long-run profile, and endless schedule checks remain green on May 26, 2026. No economy, life, route, boss, hazard, reward, assist, or memory-pressure constants were retuned; final work stayed on verification and remaining-work documentation.
- **V3 cycle 6 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run, endless schedule, and balance-doc drift checks remain green on May 26, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, or memory-pressure constants were retuned.
- **V3 cycle 7 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, endless schedule, and balance-doc drift checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, or shop constants were retuned.
- **V3 cycle 8 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, endless schedule, and balance-doc drift checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, shop, or relic constants were retuned.
- **V3 cycle 9 balance/difficulty wrap-up:** final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused shared balance, long-run profile, core game, exploit, economy-ledger, endless schedule, and shared TypeScript checks remain green on May 27, 2026; no economy, life, route, boss, hazard, reward, assist, symbol-band, memory-pressure, shop, relic, or difficulty constants were retuned.

- **V3 cycle 4 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, bonus reward, prep, meta reward signal, balance simulation, and renderer inventory checks are green on May 26, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, or inventory UI behavior were retuned.
- **V3 cycle 5 inventory/items/rewards wrap-up:** final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Focused inventory, bonus reward, prep, meta reward signal, balance simulation, renderer inventory checks, shared typecheck, and full typecheck are green on May 27, 2026; no reward math, stack limits, item sources, shop sinks, route payouts, or inventory UI behavior were retuned.

- **Memorize:** the window is a per-tile budget × tile count (`MEMORIZE_PER_TILE_BASE_MS` 325ms at floor 1, −12ms per floor, floor 110ms; total clamped to 600–6000ms). Floor 1 (4 tiles) still gets 1300ms; a 42-tile floor 20 gets ~4.6s instead of the old 850ms, because the old total-only curve ran opposite to board growth and collapsed to 20ms per tile. `getLegacyMemorizeDuration` keeps the old shape for simulation comparisons. Mutator `short_memorize` stacks with relic memorize bonus — floor 1 should never feel instant-fail.  
- **Lives:** `INITIAL_LIVES` / `MAX_LIVES` — `score_parasite` drain must not kill from full health in a single floor transition without telegraph (floors advanced counter).  
- **Powers:** `INITIAL_SHUFFLE_CHARGES`; destroy charges are uncapped run-local pickups. Relics and shops that add charges should not trivialize **Scholar** contract runs; contract still hard-disables shuffle/destroy where set.  
- **Gauntlet:** Menu presets **5 / 10 / 15** minutes; default factory still **10m** when unspecified. Each cleared floor extends the deadline by **+30s**, rewarding pace without removing the timer fail state.
- **Routes:** Floor clears expose **Safe / Greed / Mystery** choices. Shared rules can now apply outcomes: Safe recovers life or guard, Greed pays gold/score for life risk, Mystery rolls deterministic local gold/shard/Favor rewards.
- **Wild joker identity:** `BoardState.tiles` and `WILD_PAIR_KEY` are authoritative; `getWildTileIdFromBoard` derives the tile id when an inspection surface needs it. Matching remains `pairKey`-driven.

## V3 cycle 1 progression/meta wrap-up

- Stabilized scope: `src/shared/meta-progression.ts`, `src/shared/meta-progression-delta.ts`, `src/shared/challenge-progression.ts`, `src/shared/profile-summary.ts`, honor unlocks, save-data migration, and collection gallery projections now agree on local-only profile level, honor marks, owned cosmetics, deferred upgrades, and reward-ready versus reward-owned states.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Remaining work: wire the meta delta result into the post-run/profile UI if it is not already surfaced by concurrent UI work; add a focused renderer assertion for the tier/milestone copy once that surface lands; run `yarn typecheck:shared` and the full shared progression cluster before release freeze.
- Product/balance follow-up: keep `upgrade_scholar_prep_slot` deferred until its feature flag and balance pass exist. Do not let fully progressed deferred rows become the short-term next reward, and do not count unclaimed ready rewards as owned.

## V3 cycle 2 progression/meta wrap-up

- Stabilized scope: no code changes were needed in this final lane after inspecting the dirty worktree. Existing progression/meta changes were left intact, and unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/game-over-next-run.test.ts src/shared/run-history.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts` passed on May 26, 2026 (325 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Remaining work: surface `buildMetaProgressionRunDelta` in the renderer post-run/profile flow if concurrent UI work has not already done so; add renderer assertions for profile tier, milestone, next-goal, and claim feedback copy; keep the deferred `upgrade_scholar_prep_slot` excluded from short-term next-reward selection until its feature flag and balance pass exist.

## V3 cycle 3 progression/meta wrap-up

- Stabilized scope: no balance constants, reward costs, honor-mark caps, route outcomes, or economy math were changed in this final lane. The current main worktree already carries the progression/meta implementation, and unrelated concurrent renderer/audio/content edits were left intact.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts` passed on May 26, 2026 (50 tests).
- Verified integration point: `src/shared/game-over-next-run.ts` consumes `buildMetaProgressionRunDelta`, and `src/renderer/components/GameOverScreen.tsx` passes `runStartSaveData` into the next-run row builder, so post-run delta copy has a renderer path.
- Remaining work: add focused renderer assertions for game-over delta copy, profile tier/milestone copy, collection next-milestone copy, and claim feedback copy; run the broader `yarn typecheck`, game-over next-run tests, and renderer screen tests after concurrent edits settle.

## V3 cycle 4 progression/meta wrap-up

- Stabilized scope: documentation and verification only. No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, or shop/relic reward math were changed in this final lane.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts` passed on May 26, 2026 (57 tests).
- Verification run: `yarn vitest run src/renderer/components/GameOverScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (11 tests).
- Current integration read: Collection and Profile already expose tier/milestone/progression motivation copy; Game Over has a post-run delta path through `buildMetaProgressionRunDelta`; Choose Path challenge gates can consume profile tier state without online services or paid skips.
- Remaining work: run full `yarn typecheck`, `yarn test`, `yarn build`, and the navigation/playable-path e2e lane after concurrent renderer/audio/content edits settle. Add a browser smoke that completes a run, lands on Game Over, and verifies the same meta-delta copy with the full UI shell.

## V3 cycle 5 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, or reward math were changed in this final lane.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts` passed on May 26, 2026 (57 tests).
- Verification run: `yarn vitest run src/renderer/components/GameOverScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (11 tests).
- Remaining work: run full `yarn typecheck`, `yarn test`, `yarn build`, and the navigation/playable-path e2e lane after concurrent edits settle. Add a live browser smoke that completes a run into Game Over and verifies meta-delta copy, profile tier/milestone copy, collection next-goal copy, and challenge gate copy through the full UI shell.

## V3 cycle 7 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, and local-only wording across Profile, Collection, Choose Your Path, and Game Over. Keep `upgrade_scholar_prep_slot` deferred until its feature flag and balance pass ship, and keep unclaimed ready rewards distinct from owned rewards.

## V3 cycle 8 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 10 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (52 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 11 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/profile-summary.test.ts src/shared/save-data.test.ts src/shared/challenge-progression.test.ts src/shared/collection-reward-gallery.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (58 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 13 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx` passed on May 27, 2026 (65 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 14 progression/meta wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing progression/meta implementation and unrelated concurrent renderer/audio/content/performance/combat/navigation/inventory edits were preserved.
- No progression economy constants, profile level thresholds, honor-mark caps, reward ownership rules, challenge gates, save-schema fields, route outcomes, shop costs, relic rules, reward math, or balance constants were changed in this final lane.
- Verification run: `yarn vitest run src/shared/meta-progression.test.ts src/shared/meta-progression-delta.test.ts src/shared/challenge-progression.test.ts src/shared/profile-summary.test.ts src/shared/honorUnlocks.test.ts src/shared/save-data.test.ts src/shared/collection-reward-gallery.test.ts src/shared/meta-reward-signals.test.ts src/shared/game-over-next-run.test.ts src/renderer/components/ProfileScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (65 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser post-run-to-profile smoke that verifies meta delta copy, reward-ready versus reward-owned states, profile tier/milestone copy, challenge recommendation copy, collection next-goal copy, local-only wording, and deferred `upgrade_scholar_prep_slot` copy across Profile, Collection, Choose Your Path, and Game Over. Keep unclaimed ready rewards distinct from owned rewards, and do not ship the Scholar prep-slot unlock until its feature flag and balance pass are complete.

## V3 cycle 1 first-run / onboarding wrap-up

- Stabilized scope: first-run help center rows, menu/Choose Path onboarding entry, playable onboarding prompt derivation, first-floor safe target selection, and `GameScreen` prompt rendering. This pass only corrected the renderer harness regression for the current title/action-prompt copy contract.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/MainMenu.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (46 tests). `yarn typecheck` also passed on May 26, 2026.
- E2E note: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` was attempted on May 26, 2026, but exceeded a 10-minute local command timeout before returning runner output. Treat this as not verified, not as a product failure.
- Remaining work: rerun the renderer navigation/playable-path E2E lane on a quiet machine before release freeze; add a persisted-dismissal/reload E2E assertion for onboarding completion; manually smoke a fresh profile from menu help through first clear and first route choice on desktop and short mobile viewports.

## V3 cycle 2 first-run / onboarding wrap-up

- Stabilized scope: safe deadline-lane hardening only. Existing first-run work now covers Main Menu help-center room-choice copy, Choose Path first-run entry, action-gated playable prompts, first-miss recovery copy, final-pair route-choice setup, ordered scenario completion, and app/store onboarding dismissal persistence.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/MainMenu.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (50 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn vitest run src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 26, 2026 (89 tests).
- Remaining work: run `yarn test:e2e:playable-path:full` or the smaller `e2e/navigation-flow.spec.ts` plus `e2e/playable-path-navigation.spec.ts` browser slice after concurrent renderer/audio edits settle; add a persisted-dismissal/reload e2e assertion; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## V3 cycle 3 first-run / onboarding wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing first-run help-center, Choose Path entry, playable prompts, route-choice setup, and onboarding dismissal persistence changes were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 27, 2026 (137 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- E2E note: `yarn test:e2e:playable-path:audit` and a navigation-flow browser smoke were attempted on May 27, 2026, but both exceeded a five-minute local command timeout while other Playwright lanes were active. Treat this as not verified, not as a product failure.
- Remaining work: rerun `yarn test:e2e:playable-path:full` or the smaller navigation/playable-path browser slice on a quiet machine; add a persisted-dismissal/reload e2e assertion; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## V3 cycle 5 first-run / onboarding wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing first-run help-center, split help/onboarding dismissal, Choose Path entry, playable prompts, route-choice setup, and onboarding persistence changes were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- No balance constants, scoring rules, life rules, route payouts, hazard cadence, reward math, shop costs, relic rules, save-schema fields, onboarding persistence behavior, or economy constants were changed in this first-run/onboarding pass.
- Verification run: `yarn vitest run src/shared/playable-onboarding.test.ts src/shared/first-run-help-center.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx src/renderer/store/useAppStore.test.ts src/shared/save-data.test.ts` passed on May 27, 2026 (137 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- E2E note: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` was attempted on May 27, 2026, but exceeded a five-minute outer command timeout before useful runner output. Treat this as not verified, not as a product failure.
- Remaining work: rerun `yarn test:e2e:playable-path:full` or the smaller `e2e/navigation-flow.spec.ts` plus `e2e/playable-path-navigation.spec.ts` browser slice on a quiet server; add a persisted-dismissal/reload e2e assertion for both help-center and playable onboarding dismissal; manually smoke a fresh profile from Main Menu help through first clear, Safe / Greed / Mystery route choice, and no-repeat onboarding on desktop plus short mobile viewports.

## Process

After meaningful mutator/relic changes: run three scripted seeds (arcade, daily, scholar) to floor 6 and record score, lives, powers used. Adjust one constant at a time.

## V3 cycle 3 balance/difficulty wrap-up

- Stabilized scope: no balance constants were changed in the final wrap-up lane. The current difficulty curve keeps the existing floor-1 hazard grace, Safe / Greed / Mystery route diagnostics, wallet-carry gates, low-life exposure gates, recovery-debt gates, and per-seed variance checks intact.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts` passed on May 26, 2026 (309 tests).
- Remaining work: expand the profile seed bucket beyond the current smoke set, capture manual floor-6 and floor-12 runs for cautious / average / greedy / high-skill play, and only retune one pressure or economy constant at a time after a failing seed or playtest pattern is recorded.
- Release risk: broad renderer, e2e, and full `yarn test` coverage are still outside this balance-only wrap-up while concurrent UI/audio/content edits are active.

## V3 cycle 4 balance/difficulty wrap-up

- Stabilized scope: no balance constants or gameplay reward rules were changed in this deadline lane. Current main already has the floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, and seed-variance gates needed for the balance curve.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts` passed on May 26, 2026 (309 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 26, 2026. Key bounds remained within range: minimum profile lives remaining 1, run falls 0, max at-risk streak 3, worst-seed clear share 1, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: widen the profile seed set before any release retune; add a manual floor-6 and floor-12 playtest ledger for cautious, average, greedy, and high-skill play; keep future changes limited to one pressure or economy constant per measured failure.
- Release risk: broad renderer, e2e, build, and full `yarn test` coverage remain outside this balance-only stabilization lane while unrelated concurrent edits are active.

## V3 cycle 5 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, and endless schedule cadence were preserved without retuning economy, life, route, boss, hazard, reward, assist, or memory-pressure constants.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/bonus-rewards.test.ts src/shared/long-run-depth.test.ts src/shared/sim-endless-output.test.ts` passed on May 26, 2026 (316 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 26, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, worst-seed clear share 1, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: expand deterministic profile seeds and add manual floor-6/floor-12 playtest rows before any new retune; capture cautious, average, greedy, and high-skill outcomes with score, lives, route choice, shop-gold carry, assist use, and the highest perceived pressure point.
- Release risk: full renderer typecheck, full `yarn test`, build, and browser/e2e coverage remain outside this balance-only wrap-up while unrelated renderer/audio/content edits are still active in the dirty worktree.

## V3 cycle 6 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 26, 2026 (6 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Remaining work: promote the wider release-freeze seed set from notes into a checked-in balance artifact; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; then compare worst-seed clear share, low-life floor share, route mix, and ending wallet before changing any shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 7 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, and peak wallet before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 8 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, relic balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 9 balance/difficulty wrap-up

- Stabilized scope: verification and documentation only after inspecting the current dirty `main` worktree. Existing floor-1 hazard grace, route dominance diagnostics, wallet-carry bounds, low-life exposure bounds, recovery-debt gates, seed-variance gates, long-run profile rows, endless schedule cadence, and current Cycle 9 low-life exposure diagnostics were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/game.test.ts src/shared/exploit-surface.test.ts src/shared/sim-endless-output.test.ts src/shared/economy-ledger.test.ts` passed on May 27, 2026 (306 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported 584 normal, 250 breather, and 166 boss floors.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing shipped pressure or economy constants.
- Release risk: full renderer typecheck, full Vitest, build, and Playwright/e2e lanes remain outside this balance-only wrap-up while unrelated concurrent edits are active.

## V3 cycle 4 combat system wrap-up

- Stabilized scope: verification and documentation only. Existing fatal patrol-contact handling, guard-token-first contact damage, last-pair hazard softlock relief, boss patrol lifecycle reads, and renderer store game-over routing were preserved without retuning combat constants.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/softlock-fairness.test.ts src/shared/boss-encounters.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 26, 2026 (412 tests).
- Remaining work: add a browser/e2e smoke that reaches a real moving-patrol game-over through input and verifies the terminal board read with the full `TileBoard` implementation; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, and boss exit-block copy before any pressure retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 5 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, boss encounter identity/read models, deterministic balance guardrails, and renderer store game-over routing were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 26, 2026 (378 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 6 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, and renderer game-over routing were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (405 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full `yarn typecheck`, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 8 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, and GameScreen combat reads were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (412 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, occupied-card keyboard/controller selection, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: shared typecheck, full renderer typecheck, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 9 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, GameScreen combat reads, and TileBoard occupied-patrol accessibility reads were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/TileBoard.test.tsx` passed on May 27, 2026 (440 tests).
- Remaining work: add the browser/e2e smoke for a real moving-patrol game-over through input with the full `TileBoard`; manually playtest floor-6 and floor-12 boss/combat rooms for contact readability, guard-token spend clarity, boss exit-block copy, occupied-card keyboard/controller selection, and whether pressure feels tense rather than punitive before any combat retune.
- Release risk: full renderer typecheck, broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## V3 cycle 10 combat system wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing fatal moving-patrol game-over handling, guard-token contact absorption, enemy/boss lifecycle read models, last-pair hazard softlock relief, exploit guards, balance pressure diagnostics, renderer store routing, GameScreen combat reads, and TileBoard occupied-patrol accessibility reads were preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/boss-encounters.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/TileBoard.test.tsx` passed on May 27, 2026 (443 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser/e2e proof for fatal moving-patrol game-over, occupied-card keyboard/controller selection, and boss-floor pressure readability; capture manual floor-6/floor-12 combat playtest rows before changing enemy damage, guard-token, patrol, boss, or reward constants.
- Release risk: broad `yarn test`, build, and Playwright renderer lanes remain outside this combat-only wrap-up while unrelated renderer/audio/content edits are active.

## Remaining balance work

- Expand deterministic balance profiles to a wider seed bucket before changing shipped pressure constants; current smoke coverage is good for regression detection, not final win-rate calibration.
- Add a release-freeze seed set that includes at least eight seeds across Classic, Daily, Scholar, Endless, and Gauntlet starts; record worst-seed clear share, low-life floor share, and ending wallet before any V3 balance retune.
- Add a small manual playtest ledger for floor 6 and floor 12 runs covering cautious, average, greedy, and high-skill behavior; use it to validate whether low-life exposure feels tense or punitive.
- Convert the manual ledger into a tiny checked-in fixture once the team agrees on target bands for floor-6 lives, floor-12 boss clears, route choice mix, and shop-gold carry.
- Capture the V3 cycle 2 smoke output as a release artifact if this branch proceeds to freeze: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (10 tests), `yarn typecheck:shared` passed, `yarn typecheck` passed, `yarn test` passed (179 files, 1301 tests), and `yarn build` passed. Browser e2e checks are still pending while concurrent edits settle.
- Revisit Safe / Greed / Mystery route payout after manual runs. The simulation now guards route dominance, but player-facing route appeal still needs qualitative confirmation.
- Keep boss pressure changes paired with nearby recovery checks. Recovery-debt and seed-variance diagnostics should be updated whenever boss cadence, moving enemy damage, guard rewards, shop healing cost, or rest services change.
- Combat follow-up: broaden from the now-covered fatal patrol renderer assertion into a browser/e2e smoke that reaches a real moving-patrol game-over from input and verifies the same stable terminal read with the full `TileBoard` implementation.

## V3 cycle 2 core gameplay loop closeout

- Stabilized scope: no additional code changes were required after inspection. Existing concurrent changes around game state, route flow, memory recall feedback, balance diagnostics, UI/audio, and docs were preserved.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/shared/memory-recall-feedback.test.ts` passed on May 26, 2026 (350 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/game-over-next-run.test.ts src/shared/long-run-feedback.test.ts src/shared/run-history.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn test` passed on May 26, 2026 (179 test files, 1301 tests).
- Verification run: `yarn build` passed on May 26, 2026; Vite reported the existing large-chunk warning for bundled renderer chunks, but the renderer and Electron builds completed successfully.
- Remaining work: run the highest-value browser/e2e lane (`yarn test:e2e:renderer-qa` or at least navigation/playable-path/gameplay-readability) after concurrent UI/audio edits settle. Keep any follow-up tuning data-driven from wider seed buckets and floor-6/floor-12 playtest notes.

## V3 cycle 3 core gameplay loop closeout

- Stabilized scope: documentation and verification only. The current dirty `main` worktree already carries the core-loop stabilization work, and unrelated concurrent renderer/audio/content/progression edits were preserved.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (360 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 26, 2026 and produced the expected long-run floor tag / mutator / dungeon objective schedule summary.
- Verification run: `yarn test` passed on May 26, 2026 (179 test files, 1302 tests).
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially route selection, playable path navigation, gameplay readability, side-room reward claim/skip, fatal patrol game-over, boss-floor pressure, and mobile HUD density. Keep any future retune tied to expanded seed buckets and manual floor-6/floor-12 playtest notes.

## V3 cycle 4 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, route outcomes, balance diagnostics, inventory rewards, boss pressure, and run-map flow was preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/exploit-surface.test.ts src/shared/route-foundation.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts` passed on May 27, 2026 (352 tests).
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (4 tests).
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density. Keep future gameplay-loop retunes tied to expanded seed buckets and floor-6/floor-12 manual playtest notes.

## V3 cycle 5 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, recall feedback, post-run recap, balance diagnostics, inventory rewards, boss pressure, run-map flow, softlock guards, and exploit guards was preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (383 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, and mobile HUD density. Keep future gameplay-loop retunes tied to expanded seed buckets, checked-in seed artifacts, and floor-6/floor-12 manual playtest notes.

## V3 cycle 6 core gameplay loop closeout

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing core-loop stabilization across lifecycle guards, recall feedback, post-run recap, balance diagnostics, inventory rewards, boss pressure, run-map flow, softlock guards, exploit guards, and route/economy drift checks was preserved; unrelated concurrent renderer/audio/content/progression/performance/navigation edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/game.test.ts src/shared/memory-recall-feedback.test.ts src/shared/game-over-next-run.test.ts src/shared/balance-simulation.test.ts src/shared/softlock-fairness.test.ts src/shared/exploit-surface.test.ts src/shared/bonus-rewards.test.ts src/shared/boss-encounters.test.ts src/shared/run-map.test.ts src/shared/run-inventory.test.ts src/shared/balance-notes-drift.test.ts src/shared/sim-endless-output.test.ts` passed on May 27, 2026 (383 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026 and produced the expected long-run floor tag, mutator, objective, boss, card-kind, and exit-lock schedule summary.
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Verification run: `yarn test` passed on May 27, 2026 (179 test files, 1302 tests).
- Remaining work: run browser/e2e gameplay proof after concurrent UI/audio edits settle, especially fresh Classic floor clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip, stale-room recovery, fatal patrol game-over, boss-floor pressure, route-choice return from pause/menu, mobile HUD density, and gameplay-readability smoke. Keep future gameplay-loop retunes tied to expanded seed buckets, checked-in seed artifacts, and floor-6/floor-12 manual playtest notes.

## Remaining memory-depth work

- Current V3 cycle 2 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (298 tests), and `yarn typecheck:shared` passed. Broader renderer/e2e/build verification is still pending while concurrent edits settle.
- Current V3 cycle 3 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (298 tests), and `yarn typecheck:shared` passed. No code changes were needed in this lane after inspection.
- Current V3 cycle 4 verification: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts` passed on May 26, 2026 (291 tests). The renderer route-choice unit test already asserts the memory read panel pressure, focus, bonus, learned clue, recall lapse, and Safe / Greed / Mystery readiness copy.
- Current V3 cycle 7 verification: `yarn typecheck:shared` passed on May 27, 2026. `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (329 tests).
- Keep the current recall scoring constants (`RECALL_FOCUS_MATCH_SCORE` 8, `RECALL_CLUE_MATCH_SCORE` 12, focus cap 3) unchanged until real playtest data shows the bonus is either invisible or dominant.
- Keep `getMemoryRecallFeedback` read-only in renderer surfaces; any further HUD / room-result expansion should reuse the same helper instead of adding scoring side effects.
- Add a small e2e smoke that reaches a route-choice screen with remembered clues and verifies the displayed safe/greed/mystery readiness copy.
- Playtest whether `burden.score` thresholds (`loaded` at 3, `taxed` at 5, `breaking` at 7) need adjustment after the UI lands; current thresholds are diagnostic labels only.
- Expand assist copy if future relics or powers create new recall-safe tools; update `memory-recall-feedback.test.ts` alongside any new mutator/relic memory tax.
- Release risk: memory feedback has shared and renderer unit coverage, but is still not proven by browser e2e or manual route-choice playtest. Do not change diagnostic wording or thresholds until the route-choice e2e smoke and real playtest notes exist.

## V3 cycle 1 dungeon navigation / room-flow wrap-up

- Stabilized scope: route graph repair now prefers a single current node, dedupes duplicate node ids, closes stale revealed backtracks/future rooms, preserves skipped sibling branches after selection, and rebuilds missing next-room choices from deterministic local rules.
- Room-flow guardrails: stale side-room actions no-op when a side-room has already transitioned, invalid event choices leave the room open, no-run side-room actions recover to menu, and relic-pick feedback is tested only from a valid level-complete relic-offer state.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (84 tests).
- Remaining work: run the renderer navigation e2e lane before release freeze (`yarn test:e2e:renderer-qa` or at least `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`), then manually smoke a floor-1 clear into Safe / Greed / Mystery selection and a floor-5-to-boss transition to confirm the room copy reads correctly in the live shell.

## V3 cycle 2 dungeon navigation / room-flow wrap-up

- Stabilized scope: no additional balance constants, route payouts, or economy math were changed in this deadline pass. Current main already contains the route graph repair and side-room presentation guardrails needed for the final navigation/room-flow lane.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (84 tests); `yarn vitest run src/renderer/App.test.tsx` passed on May 26, 2026 (23 tests); `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: the branch still needs the heavier browser navigation lane before release freeze: `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`. Manual QA should still cover a fresh Classic first room into route choice, last-life Greed disabled copy, side-room claim/skip transitions, and floor-5-to-boss approach copy in the live shell.

## V3 cycle 3 dungeon navigation / room-flow wrap-up

- Stabilized scope: no code retune was needed after inspecting the dirty `main` worktree. Existing route-map repair, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, and side-room reward feedback changes were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 26, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, visual mobile captures, and the Playwright navigation lane remain outside this final focused verification while concurrent edits are active.

## V3 cycle 4 dungeon navigation / room-flow wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route graph repair, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, side-room reward feedback, and run-surface reset behavior were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- No route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, objective values, score rules, or economy math were changed in this final hour.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 26, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `git diff --check` passed on May 26, 2026 with only existing CRLF normalization warnings.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, route-choice return from pause/menu surfaces, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, build, visual mobile captures, and the Playwright navigation lane remain outside this focused deadline verification while concurrent edits are active.

## V3 cycle 5 dungeon navigation / room-flow wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route graph repair, persistent route-choice recovery, first-run Classic launch messaging, last-life Greed disabling, boss approach copy, side-room reward feedback, and run-surface reset behavior were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- No route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, objective values, score rules, reward math, or economy math were changed in this final hour.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run the heavier browser navigation lane before release freeze (`playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`) and manually smoke a fresh Classic floor-1 clear into Safe / Greed / Mystery selection, last-life Greed disabled copy, side-room claim/skip transitions, stale side-room recovery, route-choice return from pause/menu surfaces, and the floor-5-to-boss approach copy in the live shell.
- Release risk: full renderer typecheck, broad `yarn test`, build, visual mobile captures, and the Playwright navigation lane remain outside this focused deadline verification while concurrent edits are active.

## V3 cycle 1 narrative / atmosphere / content wrap-up

- Stabilized scope: authored run-event outcome copy, atmosphere-family catalog rows, memory-recall pressure beats, relic draft labels, and game-over copy. No score, life, route, hazard, wallet, or relic-offer math was changed in this lane.
- Verification focus: keep `memory-recall-feedback`, `run-events`, `copy-tone`, and `long-run-feedback` as the fast narrative/content gate before broader shared or renderer checks.
- Remaining work: pair event atmosphere families with distinct visual/audio hooks, audit long-run UI line length once recall feedback is visible in renderer surfaces, and migrate late-copy strings into localization keys when the i18n pass resumes.

## V3 cycle 2 narrative / atmosphere / content final wrap-up

- Stabilized scope: no mechanics or constants changed. The final lane verified the existing authored room-event atmosphere catalog, memory recall feedback beats, copy-tone guardrails, and long-run feedback rows after concurrent edits landed in the working tree.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests). `yarn typecheck:shared` also passed on May 26, 2026.
- Remaining work: wire recall and event atmosphere rows into the final renderer surfaces, then run a manual floor-clear-to-route-choice smoke to check line length and repeated-copy cadence. Pair each event atmosphere family with final audio/visual cues before release freeze, and move late-stage strings into localization keys when the i18n pass resumes.
- Release caution: do not add new event-room rewards, route consequences, or memory-burden thresholds during final copy polish unless the balance simulation and the focused narrative/content gate are rerun together.

## V3 cycle 3 narrative / atmosphere / content final wrap-up

- Stabilized scope: no additional content systems, event outcomes, route consequences, scoring rules, life rules, reward values, memory-burden thresholds, or relic-offer math were changed in this final lane. Existing copy/catalog edits were preserved, and unrelated concurrent renderer/audio/progression changes were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: surface `getMemoryRecallFeedback` and event atmosphere families in final renderer screens, manually smoke floor-clear-to-route-choice copy for line length and repeated phrasing, pair each atmosphere family with final audio/visual cues, and migrate late-stage narrative strings into localization keys when the i18n pass resumes.
- Release caution: keep further narrative edits data- and screen-driven. Any new event reward, route consequence, recall threshold, or relic-offer behavior must rerun this focused narrative gate plus the relevant balance simulation checks.

## V3 cycle 4 narrative / atmosphere / content final wrap-up

- Stabilized scope: no code or content retune was needed after inspecting the current dirty `main` worktree. Existing authored event atmosphere profiles, memory recall feedback beats, copy-tone guardrails, and long-run feedback rows were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts` passed on May 26, 2026 (30 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: wire `getMemoryRecallFeedback` and `RUN_EVENT_ATMOSPHERE_PROFILES` into the final renderer surfaces, then manually smoke floor-clear-to-route-choice copy for line length, repeated phrasing, and Safe / Greed / Mystery readiness clarity. Pair each atmosphere family with final audio/visual hooks before release freeze, and migrate late-stage narrative strings into localization keys when the i18n pass resumes.
- Release caution: keep any follow-up screen-driven. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, or reward values remain out of scope unless the focused narrative/content gate and relevant balance checks are rerun together.

## V3 cycle 5 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, relic/game-over copy edits, and fresh-profile Choose Path first-room copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 26, 2026 (33 tests).
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Remaining work: run a browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, line length, and repeated phrasing in the live shell. Pair each `RUN_EVENT_ATMOSPHERE_PROFILES` family with final audio/visual hooks before release freeze, then migrate late-stage narrative, recall, and event-result strings into localization keys.
- Release caution: keep follow-up copy screen-driven. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, or economy constants remain out of scope unless the focused narrative/content gate and relevant balance checks are rerun together.

## V3 cycle 6 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, relic/game-over copy edits, and first-run Choose Path copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (33 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, line length, repeated phrasing, and audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, or economy constants remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 7 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing expanded event atmosphere profiles, memory recall feedback, long-run/HUD narrative feedback rows, dungeon card labels, relic/game-over copy edits, and first-run Choose Path copy were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (71 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, route-choice line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 8 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, and authored event atmosphere profiles were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (40 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card label clarity, route-choice line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 9 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (73 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that checks first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card label clarity, relic-offer phrasing, game-over line length, repeated phrasing, and final audio/visual pairing across desktop and mobile widths. Migrate late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings into localization keys when the i18n pass resumes.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 10 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/copy-tone.test.ts src/shared/dungeon-cards.test.ts src/shared/first-run-help-center.test.ts src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/shared/run-events.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (73 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 11 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/first-run-help-center.test.ts src/shared/mechanics-encyclopedia.test.ts` passed on May 27, 2026 (44 tests).
- Verification run: `yarn vitest run src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, localization architecture, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 12 narrative / atmosphere / content final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing atmospheric copy-tone guidance, themed dungeon card labels, first-run route-choice help copy, memory recall feedback, long-run/HUD narrative feedback rows, authored event atmosphere profiles, relic-offer copy, encyclopedia glossary copy, and game-over copy edits were preserved; unrelated concurrent renderer/audio/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/run-events.test.ts src/shared/copy-tone.test.ts src/shared/long-run-feedback.test.ts src/shared/first-run-help-center.test.ts src/shared/mechanics-encyclopedia.test.ts --reporter=dot` passed on May 27, 2026 (44 tests).
- Verification run: `yarn vitest run src/shared/dungeon-cards.test.ts src/shared/relics.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx --reporter=dot` passed on May 27, 2026 (47 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke across desktop and mobile widths for first-run Classic copy, memory recall rows, event-room atmosphere, Safe / Greed / Mystery readiness language, themed dungeon card labels, relic-offer phrasing, game-over line length, repeated-copy cadence, and final audio/visual pairing. Keep localization extraction queued for late-stage narrative, recall, route-choice, relic-offer, card-label, help-center, game-over, encyclopedia, and event-result strings.
- Release caution: keep follow-up copy screen-driven and avoid late content expansion. New event rewards, route consequences, recall burden thresholds, relic-offer behavior, reward values, economy constants, localization architecture, or card taxonomy semantics remain out of scope unless this focused narrative/content gate and the relevant balance checks are rerun together.

## V3 cycle 5 memory mechanic depth final wrap-up

- Stabilized scope: no code retune was needed after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker, remembered-clue, symbol-map, route-readiness, memory-tax, and recall-assist feedback stayed intact; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 26, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/GameplayHudBar.test.tsx` passed on May 26, 2026 (60 tests).
- Remaining work: add a browser route-choice smoke that clears a floor and verifies the live memory read panel, Safe / Greed / Mystery readiness copy, and long-line behavior at mobile and desktop widths. Follow with manual playtest calibration for burden labels (`light`, `loaded`, `taxed`, `breaking`) before changing thresholds.
- Release caution: keep future memory-depth edits presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, or shop pressure should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 6 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker repair, remembered clues, symbol-map counts, patrol pressure rows, route-choice readiness, first-run route setup, memory-tax copy, and recall-assist feedback were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/long-run-feedback.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (51 tests).
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 7 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall focus, forgotten-marker repair, remembered clues, symbol-map counters, patrol pressure rows, route-choice readiness, first-run route setup, memory-tax copy, and recall-assist feedback were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts src/shared/balance-notes-drift.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx` passed on May 27, 2026 (329 tests).
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 8 memory mechanic depth final wrap-up

- Stabilized scope: safe copy-only hardening after inspecting the dirty `main` worktree. Strained recall feedback now distinguishes enemy/patrol-only memory strain from forgotten-marker recovery, while preserving existing recall focus, score, route-readiness, burden threshold, assist, life, route, shop, reward, and memory-pressure behavior.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts --reporter=dot` passed on May 27, 2026 (9 tests).
- Verification run: `yarn vitest run src/renderer/components/GameScreen.test.tsx -t "featured objective" --reporter=dot` passed on May 27, 2026 (1 test; 34 skipped), covering the route-choice memory read panel path.
- Verification note: the combined shared plus renderer memory lane was attempted but timed out locally at 120s before returning useful runner output; rerun the full renderer route-choice check after concurrent renderer edits settle.
- Remaining work: run a live browser smoke that starts fresh Classic, clears floor 1, reaches Safe / Greed / Mystery selection, and verifies the memory read panel, route readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds or route-readiness language.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, or memory-pressure constants should rerun this focused memory gate plus the relevant balance simulation checks.

## V3 cycle 10 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx` passed on May 27, 2026 (12 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 11 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, first-run route setup, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/GameScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 27, 2026 (97 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 12 memory mechanic depth final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing recall-focus presentation, forgotten-marker recovery prompts, patrol-only strain copy, symbol-map counters, route readiness labels, burden scoring, memory tax copy, and recall assist copy stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts --reporter=dot` passed on May 27, 2026 (9 tests).
- Verification run: `yarn vitest run src/renderer/components/GameScreen.test.tsx -t "featured objective" --reporter=dot` passed on May 27, 2026 (1 test; 34 skipped), covering the route-choice memory read panel path.
- Verification run: `yarn vitest run src/shared/balance-notes-drift.test.ts --reporter=dot` passed on May 27, 2026 (3 tests).
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, or memory-pressure constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 13 memory mechanic depth final wrap-up

- Stabilized scope: added defensive Recall Focus normalization at the match-score and recall-feedback read boundaries so stale or migrated run state cannot award or preview more than the shipped focus cap. The shipped cap, score-per-focus value, clue bonus, burden thresholds, route readiness language, and memory-pressure thresholds were not retuned; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/memory-recall-feedback.test.ts src/shared/game.test.ts --reporter=dot` passed on May 27, 2026 (290 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Remaining work: run a live browser floor-clear-to-route-choice smoke that verifies the memory read panel, Safe / Greed / Mystery readiness labels, patrol-only strain copy, capped focus display, burden label line length, and repeated-copy cadence across desktop and mobile widths. Follow with manual floor-6/floor-12 playtest notes before changing burden thresholds, route-readiness language, memory-pressure constants, or recall scoring constants.
- Release caution: keep memory-depth follow-up presentation- or evidence-driven. Any change to recall scoring, focus caps, forgotten-marker behavior, route readiness, burden thresholds, assist eligibility, life/reward outcomes, shop pressure, economy pressure, or memory-pressure constants should rerun focused memory feedback checks plus the relevant balance simulation gate.

## V3 cycle 1 performance / polish wrap-up

- Stabilized scope: startup asset loading, card illustration image warmup, UI SFX buffer preload, viewport resize handling, and platform tilt field writes. No balance constants, route outcomes, scoring, life, shop, or reward values were changed in this lane.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests). `yarn typecheck` also passed on May 26, 2026.
- Remaining work: capture a browser startup trace to confirm first interactive paint is no longer contending with full card illustration and mode poster decodes; run a lower-end mobile visual smoke before changing warmup concurrency; revisit audio preload breadth only if real-device memory pressure appears in profiling.

## V3 cycle 2 performance / polish final wrap-up

- Stabilized scope: no code retune was made in the final hour after inspecting the dirty `main` worktree. Existing concurrent changes to startup preload, card illustration warmup, shared audio buffer loading, viewport resize throttling, and platform tilt CSS writes were preserved.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 26, 2026. Vite still reports existing large chunk warnings for the `three`, `pixi`, and main bundles.
- Remaining work: capture a browser startup trace on the live app to confirm first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing preload concurrency or audio preload breadth; profile whether the large renderer chunks need code-splitting after the release lane settles; keep any follow-up scoped to measured regressions rather than new presentation or economy behavior.

## V3 cycle 3 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 26, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 26, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 26, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke; profile the large renderer chunks before deciding on code-splitting or preload breadth changes.

## V3 cycle 4 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks before deciding on code-splitting.

## V3 cycle 5 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,481.98 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks before deciding on code-splitting or asset preload breadth changes.

## V3 cycle 6 performance / polish final wrap-up

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing startup-critical preload deferral, bounded card illustration warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay/combat/balance edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, or audio preload breadth; profile the large renderer chunks and large raster/audio assets before deciding on code-splitting, compression, or asset preload breadth changes.

## V3 cycle 7 performance / polish final wrap-up

- Stabilized scope: test-only startup preload isolation after inspecting the dirty `main` worktree. The runtime startup-critical preload deferral, bounded card illustration warmup, background mode-poster warmup, shared audio buffer preload, animation-frame viewport resize commits, and platform tilt CSS write guards were preserved; unrelated concurrent renderer/audio/content/progression/gameplay/combat/balance/navigation/inventory edits were not reverted.
- Verification run: `yarn vitest run src/renderer/assets/preloadStartupAssets.test.ts src/renderer/cardFace/cardIllustrationImages.test.ts src/renderer/audio/preloadAudioBuffers.test.ts src/renderer/audio/uiSfx.test.ts src/renderer/hooks/useViewportSize.test.tsx src/renderer/platformTilt/usePlatformTiltField.test.ts --reporter=dot` passed on May 27, 2026 (18 tests).
- Verification run: `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` passed on May 27, 2026 with only the existing LF-to-CRLF normalization warnings.
- Verification run: `yarn build:renderer:alt-out` passed on May 27, 2026. Vite still reports the existing chunk-size warnings for `vendor-three` (752.00 kB), `vendor-pixi` (850.54 kB), and `main` (1,482.12 kB) after minification.
- Remaining work: capture a browser startup trace on the live shell to measure first interactive paint and idle warmup timing; run a lower-end mobile visual/performance smoke before changing image warmup concurrency, startup preload breadth, audio preload breadth, code-splitting, compression, or asset payloads; keep follow-up tied to measured regressions.

## Automated sanity (REF-098 / schedule)

- `yarn sim:endless --floors=1000 --seed=42001` — CSV summary of `floorTag` and mutator counts over a long endless slice; use after edits to `floor-mutator-schedule.ts` or `FLOOR_SCHEDULE_RULES_VERSION`. Spot-check that `breather` / `boss` tags appear at expected cadence for the cycle.
- REG-086 lightweight balance snapshot lives in `src/shared/balance-simulation.ts`. It is offline-only and checks floor schedule, shop wallet pacing, findable target ranges, and relic draft rarity mix without server authority or competitive leaderboard data.

## V3 cycle 1 wrap-up verification

- 2026-05-26 core gameplay loop stabilization: shared typecheck passed; focused core gameplay, memory recall feedback, game-over, balance, softlock, and exploit regression tests passed.
- `yarn gate:gameplay` passed `typecheck:shared`, the shared gameplay gate suite (378 tests), and `yarn sim:endless --floors=1000 --seed=42001`.
- Follow-up broad `yarn test` drift from this note was resolved in the bug-and-edge-case hunt: startup preload timer isolation, tile-board viewport margin expectations, gauntlet pressure audio coverage, and encyclopedia snapshot version 15 now pass under the full Vitest run.

## V3 cycle 10 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing seed-variance diagnostics, low-life exposure bounds, recovery-debt checks, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss pressure, shop sinks, and reward inflow diagnostics were preserved; unrelated concurrent renderer/audio/content/progression/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/balance-notes-drift.test.ts src/shared/difficulty-profile.test.ts src/shared/game.test.ts src/shared/softlock-fairness.test.ts src/shared/boss-encounters.test.ts` passed on May 27, 2026 (323 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Long-run rows stayed within range, including `min_profile_lives_remaining=1`, `max_profile_run_falls=0`, `max_profile_ending_gold_per_floor=4.71`, `max_profile_gold_held_per_floor=4.98`, `min_profile_worst_seed_clear_share=1`, and route shares Safe `0.33`, Greed `0.39`, Mystery `0.28`.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026. The schedule smoke reported `normal=584`, `breather=250`, and `boss=166`, with findable target weights still `35/15/35/15`.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: expand the deterministic balance seed set beyond `[42001, 42077, 42123]`; capture manual floor-6 and floor-12 Classic, Daily, Scholar, and Gauntlet playtest outcomes; add browser/e2e proof for route-choice pressure reads and boss-floor survivability; keep score, life, route payout, hazard cadence, shop, relic, reward, and economy constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 11 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing seed-variance diagnostics, low-life exposure bounds, recovery-debt checks, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss pressure, shop sinks, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Tooling note: direct `tsx scripts/gate-long-run.ts --floors=48` failed in PowerShell because `tsx` was not on PATH outside Yarn; `yarn tsx scripts/gate-long-run.ts --floors=48` is the working local command.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads and boss-floor survivability; compare worst-seed clear share, low-life exposure, route mix, ending wallet, peak wallet, and perceived boss-floor pressure before changing score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, or difficulty constants.

## V3 cycle 12 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/sim-endless-output.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts` passed on May 27, 2026 (24 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 13 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, difficulty-profile coverage, floor-mutator schedule coverage, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/difficulty-profile.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts --reporter=dot` passed on May 27, 2026 (42 tests).
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Tooling note: direct `tsx scripts/gate-long-run.ts --floors=48` still fails in this PowerShell shell because `tsx` is not on PATH outside Yarn; `yarn tsx scripts/gate-long-run.ts --floors=48` is the working command.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## V3 cycle 14 wrap-up - Balance and Difficulty Curve

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing per-seed balance profile bounds, low-life exposure checks, recovery-debt rows, route-dominance checks, wallet-carry checks, floor-1 hazard gate, boss-floor identity, difficulty-profile coverage, floor-mutator schedule coverage, relic-balance doc checks, and endless schedule cadence were preserved; unrelated concurrent renderer/audio/content/progression/navigation/performance/combat/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/balance-simulation.test.ts src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts src/shared/difficulty-profile.test.ts src/shared/floor-mutator-schedule.test.ts src/shared/balance-notes-drift.test.ts src/shared/relicBalanceDoc.test.ts --reporter=dot` passed on May 27, 2026 (42 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `yarn tsx scripts/gate-long-run.ts --floors=48` passed on May 27, 2026. Key rows stayed within range: average hazard pressure 5.65, average contact pressure 2.94, minimum profile lives remaining 1, run falls 0, max at-risk streak 3, ending wallet per floor 4.71, peak wallet per floor 4.98, worst-seed clear share 1, worst-seed low-life share 0.38, seed clear spread 0, and Safe / Greed / Mystery route shares 0.33 / 0.39 / 0.28.
- Verification run: `yarn sim:endless --floors=1000 --seed=42001` passed on May 27, 2026; the schedule reported `normal=584`, `breather=250`, and `boss=166`, with findable target weights still `35/15/35/15`.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: promote the wider release-freeze seed set into a checked-in balance artifact with per-profile seed rows; capture manual floor-6 and floor-12 playtest rows for Classic, Daily, Scholar, Endless, and Gauntlet; add browser/e2e proof for route-choice pressure reads, boss-floor survivability, and perceived low-life exposure; keep score, life, route payout, hazard cadence, boss, shop, relic, reward, economy, symbol-band, memory-pressure, and difficulty constants unchanged until a reproducible seed failure or playtest note justifies a single-variable retune.

## Release playtest script (quick bar)

Use three fixed seeds or saves (e.g. classic/new run, daily of the day, Scholar from the main menu). For each: reach **floor 6** (or fail honestly), then jot **final score**, **lives remaining**, **shuffle / destroy charges used**, and **highest pain point** (memorize window, symbol band, mutator combo). Re-run after any change to `contracts.ts`, `game.ts` match/scoring paths, or presentation mutator penalties.

## V3 cycle 1 wrap-up - Inventory, Items, Rewards

- Stabilized run-only inventory reward handling around capped pickups, malformed reward amounts, and stale reward-room ledgers. Capped inventory rewards now report feedback instead of pretending the pickup was gained, and all-capped pickup rewards convert to small overflow score so bonus rooms do not feel empty.
- Verified the current scope with `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx`, `yarn typecheck:shared`, and `yarn typecheck`.
- Remaining balance work: run floor-6 manual playtest seeds for Classic, Daily, and Scholar after the concurrent UI/audio lanes settle; confirm overflow score values (`+5` partial, `+10` all-capped) feel like compensation rather than a new farm; add an end-to-end claim path once bonus-room UI is wired beyond shared services.

## V3 cycle 2 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no reward math or stack limits were retuned. The final pass kept the existing capped-pickup and stale-ledger behavior intact, corrected stale inventory source copy so destroy charges no longer imply clean-clear farming, and left unrelated concurrent renderer/audio/content edits untouched.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add an end-to-end claim path for bonus-room rewards once the UI wiring is final; manual-playtest the `+5` partial and `+10` all-capped overflow score compensation before changing those constants.

## V3 cycle 3 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no additional reward math, stack limits, source/sink constants, or inventory UI behavior were changed in the final-hour lane. Current capped-pickup feedback, malformed reward amount guards, stale reward-room ledger checks, and overflow-score compensation remain intact while unrelated concurrent renderer/audio/content edits are preserved.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values before any retune.

## V3 cycle 4 wrap-up - Inventory, Items, Rewards

- Stabilized scope: no code retune was needed after inspecting the current dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, and overflow-score compensation were preserved while unrelated concurrent renderer/audio/content/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 26, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 26, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging plus the `+5` partial and `+10` all-capped overflow score values; avoid retuning reward values, stack limits, or source/sink constants until those playtest notes or a reproducible seed failure justify it.

## V3 cycle 5 wrap-up - Inventory, Items, Rewards

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, and route payouts unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 6 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, and relic/service reward hooks unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 7 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 8 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final wrap-up pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup feedback, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 9 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 10 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 11 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 12 wrap-up - Inventory, Items, Rewards

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing capped-pickup previews, malformed reward amount guards, stale reward-room ledger normalization, supply-cache variety, key/peek/destroy pickup wiring, inventory full-state copy, run-only consumable/loadout separation, gambit-token rearm behavior, relic service costs, and overflow-score compensation were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/navigation/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-inventory.test.ts src/shared/bonus-rewards.test.ts src/shared/inventory-prep.test.ts src/shared/meta-reward-signals.test.ts src/shared/balance-simulation.test.ts src/renderer/components/InventoryScreen.test.tsx` passed on May 27, 2026 (41 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `yarn vitest run src/shared/balance-notes-drift.test.ts` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing LF-to-CRLF normalization warnings.
- Remaining work: add browser/e2e coverage for the bonus-room reward claim path once final UI wiring lands; manual-playtest floor-6 Classic, Daily, and Scholar seeds to validate capped pickup messaging, gambit-token rearm readability, relic service affordance clarity, supply-cache claim clarity, and the `+5` partial / `+10` all-capped overflow score values; keep reward math, stack limits, item sources, shop sinks, route payouts, relic/service reward hooks, and economy constants unchanged until playtest notes or a reproducible seed failure justify a retune.

## V3 cycle 6 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: verification and documentation only after inspecting the dirty `main` worktree. Existing route progression repair, duplicate node/edge guards, stale current-floor repair, first-run Classic launcher copy, and side-room reward feedback stayed intact; unrelated concurrent renderer/audio/content/progression/performance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip and stale-room recovery, route-choice return from pause/menu surfaces, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 8 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route progression repair, duplicate node/edge guards, stale current-floor repair, first-run Classic launcher copy, last-life Greed disablement, side-room reward feedback, and exhausted bonus-room single-action behavior stayed intact; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/renderer/store/useAppStore.test.ts src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/App.test.tsx` passed on May 27, 2026 (107 tests).
- Verification run: `yarn typecheck:shared` passed on May 27, 2026.
- Verification run: `git diff --check` completed on May 27, 2026 with only existing CRLF normalization warnings.
- Remaining work: run `playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1`; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room claim/skip and stale-room recovery, route-choice return from pause/menu surfaces, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 9 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route choice presentation, map progression invariants, side-room action flow, shop handoff, stale-room recovery, and store-level navigation transitions were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-rules.test.ts src/shared/game.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx src/renderer/store/useAppStore.test.ts` passed on May 27, 2026 (379 tests).
- Verification run: `yarn typecheck:shared` and `yarn typecheck` passed on May 27, 2026.
- Browser note: `yarn playwright test e2e/playable-path-interludes.spec.ts --workers=1 --reporter=list` exceeded a six-minute outer command timeout while many pre-existing local Node/browser processes were active, so the route/shop/side-room browser contract remains unverified in this pass rather than a confirmed regression.
- Remaining work: rerun `e2e/playable-path-interludes.spec.ts`, `e2e/playable-path-navigation.spec.ts`, and `e2e/navigation-flow.spec.ts` on a quiet local server; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room primary/choice/skip, side-room-to-shop handoff, route-choice return from pause/menu surfaces, relic draft into next floor, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## V3 cycle 10 wrap-up - Dungeon Navigation / Room Flow

- Stabilized scope: final one-hour pass stayed verification- and documentation-only after inspecting the dirty `main` worktree. Existing route choice presentation, map progression repair, duplicate node/edge guards, side-room action flow, shop handoff, stale-room recovery, boss-approach copy, and store-level navigation transitions were preserved; unrelated concurrent renderer/audio/content/progression/performance/combat/inventory/balance edits were not reverted.
- Verification run: `yarn vitest run src/shared/run-map.test.ts src/shared/route-foundation.test.ts src/shared/route-rules.test.ts src/shared/game.test.ts src/renderer/components/GameScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/store/useAppStore.test.ts src/renderer/App.test.tsx --reporter=dot` passed on May 27, 2026 (421 tests).
- Verification run: `yarn typecheck:shared`, `yarn typecheck`, and `git diff --check` passed on May 27, 2026; diff hygiene reported only the existing LF-to-CRLF normalization warnings.
- Browser note: `yarn playwright test e2e/navigation-flow.spec.ts --workers=1 --reporter=list` passed the first three navigation cases, then the local Vite server stopped responding and the remaining cases failed at `page.goto('/')` with `net::ERR_CONNECTION_REFUSED`. Treat this as unresolved local browser-server stability, not a confirmed navigation assertion regression. The combined `e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts` command also exited early with code `4294967295` before useful spec output.
- Remaining work: rerun `e2e/navigation-flow.spec.ts`, `e2e/playable-path-navigation.spec.ts`, and `e2e/playable-path-interludes.spec.ts` on a quiet local server; manually smoke fresh Classic floor-1 clear into Safe / Greed / Mystery, last-life Greed disabled copy, side-room primary/choice/skip, side-room-to-shop handoff, stale-room recovery, route-choice return from pause/menu surfaces, relic draft into next floor, daily launch from Choose Your Path, and floor-5-to-boss approach copy. Keep route payouts, side-room rewards, life costs, shop costs, boss cadence, map-generation constants, score rules, reward math, and economy math unchanged until browser/manual QA finds a reproducible issue.

## Symbol band thresholds (`tile-symbol-catalog.ts`)

Current defaults (floor level = run floor):

| Band | Level range | Notes |
|------|-------------|--------|
| Numeric two-digit ranks | 1–`SYMBOL_BAND_LAST_LEVEL_NUMERIC` (8) | Dense, readable on small tiles. |
| Letter / digit hybrid | 9–`SYMBOL_BAND_LAST_LEVEL_LETTER` (16) | Step up in discrimination load before callsigns. |
| Callsign pairs | 17+ | Longer labels; keep bracket jumps playtested for “first callsign floor” feel. |

`category_letters` mutator still forces the letter hybrid set regardless of level. Changing the two `SYMBOL_BAND_*` constants requires updating [`tile-symbol-catalog.test.ts`](../src/shared/tile-symbol-catalog.test.ts) bracket expectations and bumping `GAME_RULES_VERSION` if pair generation semantics change.

REG-047 readability guardrails now live in `tile-symbol-catalog.ts`: each band exposes a readability purpose, target difficulty, max label length, and confusable-token denylist. Current catalog tests assert labels stay within each band limit, symbols remain unique, and common distractors (`O`, `0`, `I`, `1`, `l`) do not appear together in a band.

## Relic roster (cross-check `src/shared/relics.ts` + `game.ts`)

Shipped pool ids: `extra_shuffle_charge`, `first_shuffle_free_per_floor`, `memorize_bonus_ms`, `destroy_bank_plus_one`, `combo_shard_plus_step`, `memorize_under_short_memorize`, `parasite_ward_once`, `region_shuffle_free_first`, `peek_charge_plus_one`, `stray_charge_plus_one`, `pin_cap_plus_one`, `guard_token_plus_one`, `shrine_echo`, `chapter_compass`, `wager_surety`, `parasite_ledger`.

**Standing-rule relics.** The ids above pay out once, when they are taken. These six pay on a condition the board keeps offering, so they change which tiles a player goes for rather than only which number the floor starts on. Each is one `relic.active` content definition applied from the live trait path in `tile-trait-rules.ts` (`STANDING_RULE_RELIC_DEFINITIONS` in `gameplay-core-contracts.ts`):

| Relic | Rarity | Fires when | Pays |
|-------|--------|-----------|------|
| `opening_ledger` | common | the first match resolved on any floor | +25 score |
| `tithe_conduit` | common | any Conduit match | +1 shop gold, +8 score |
| `bulwark_plate` | uncommon | any Heavy match | +1 guard token, or +18 score at the guard cap |
| `stasis_broker` | uncommon | any Stasis match | +1 full-board shuffle charge (barred under `noShuffle`) |
| `echo_relay` | rare | an Echo match with an adjacent Heavy tile | +1 flash pair |
| `drift_appraiser` | rare | a Drift match with an adjacent Cursed tile | +2 shop gold, +15 score |

Their draft weights sit a notch under the equivalent-rarity charge relics, because a rule that fires all run is worth more than a number that fires once. `opening_ledger` and `tithe_conduit` are in the demo pool so the demo still shows what the class is; the other four are full-game only.

Milestone offers: first at floor **3**, then every **3** floors (**3, 6, 9, 12, …**); max **12** milestone **visits** per run (`RELIC_FIRST_MILESTONE_FLOOR`, `RELIC_MILESTONE_STEP`, `MAX_RELIC_PICKS_PER_RUN` in `relics.ts`). **Puzzle** runs skip relic drafts. Each offer rolls **three** distinct relics using `RELIC_DRAFT` weights (common / uncommon / rare) with **tier scaling** so later drafts relatively favor higher rarities (`effectiveRelicDraftWeight`, `rollRelicOptions`, `weightedPick.ts`). **Pick budget** per visit stacks: `shrine_echo` relic (bank for next shrine), **Daily** mode (+1), **generous_shrine** mutator (+1), claimed Week of Archives meta unlock after 7 dailies (`relicShrineExtraPickUnlocked` → `metaRelicDraftExtraPerMilestone`), Scholar contract (`bonusRelicDraftPick`) — see `computeRelicOfferPickBudget` in `game.ts`.

Scheduled Endless drafts guarantee one contextual option when an eligible relic answers the current/next chapter, active wager, or near-complete Favor bank; Daily / gauntlet / meditation use the base picker. Hard contract filters remove shuffle relics under `noShuffle` and `destroy_bank_plus_one` under `noDestroy`.

Memorize modifiers (see `getMemorizeDurationForRun` in `game.ts`): **`+280ms`** with `memorize_bonus_ms`; **`+220ms`** when `memorize_under_short_memorize` and `short_memorize` mutator are both active.

## Endless cycle reachability (`floor-mutator-schedule.ts`)

The twelve-floor cycle is the only thing that schedules mutators in Endless, so a mutator absent
from it is absent from the game. Two problems, both found by walking the schedule rather than
reading it:

- `generous_shrine` appeared in `MUTATOR_IDS`, had working rules in `relic-offer-open-rules.ts` and
  `relic-offer-rules.ts` granting **+1 relic pick per milestone draft**, and had a Codex entry — and
  no floor scheduled it. It had never reached a player. It now sits on floor 10.
- Floors 3 and 10 were byte-for-byte identical (`treasure_gallery` / `scholar_style` /
  `findables_floor`), so one cycle showed the same room twice. Floor 10 is now the shrine breather.

`distraction_channel` remains deliberately occasional: a seeded roll on roughly a quarter of boss
floors, so it is reachable but not guaranteed inside the first cycle. That is a design choice, and
`floor-schedule-reachability.test.ts` encodes it as the one mutator allowed to miss cycle one —
every other mutator must appear on every seed, and no two floors in a cycle may be identical.

## Board colour and colour vision (`color-vision.ts`)

Five palettes on the board carry rules rather than decoration: tile traits, enemy hazards, hazard
tiles, trap state, and trait interaction lanes. Each is gated against normal vision plus the three
dichromacies at a CIE76 floor of dE 25, roughly ten times the just-noticeable step.

As shipped, every one of them had pairs a player could not separate — the worst by palette:

| Palette | Worst pair as shipped | After |
|---|---|---|
| Tile trait | Sealed vs Stasis, dE **2.1** (deuteranopia) | 29.8 |
| Trait lane | Guard vs fallback, dE **1.0** (protanopia) | 27.2 |
| Enemy hazard | Boss vs Warden, dE **5.5** (tritanopia) | 42.6 |
| Hazard tile | dE **7.6** | 45.2 |
| Trap state | Resolved vs Armed, dE **16.1** (deuteranopia) | 51.1 |

Each hue stayed within 16-20 degrees of the colour it replaced, so the board still reads the way a
returning player learned it. Lightness is doing most of the separation work, because lightness is
the one axis every dichromat keeps — so an edit that only adjusts hue will not move the gate.

## Honor mark ceiling (`meta-progression.ts`)

Honor marks come from four capped sources: achievements (`earned x 2`), the daily archive (7),
no-powers mastery (5) and relic mastery (5). The profile ladder charges `META_MARKS_PER_LEVEL = 5`
per level and its top milestone is level **8**, so **40** marks are needed to reach Legend.

With seven achievements the ceiling across all four sources was **31**, and Legend was therefore
unreachable — the milestone existed in `META_PROGRESS_MILESTONES` and no save could ever satisfy it.
Widening the achievement set to twenty raises the ceiling to **57**, which makes Legend reachable for
the first time and still requires most of the roster. The two permanent upgrades cost 7 and 12 marks,
so the meta track keeps a real spend-versus-save decision against that ceiling.

Recheck this arithmetic whenever `ACHIEVEMENT_IDS`, a source cap, `META_MARKS_PER_LEVEL`, or the top
milestone level changes; `meta-progression.test.ts` pins the per-source rows but not the ceiling.

## Presentation mutator match penalties (`game.ts`)

Flat per-match score subtractions from `getPresentationMutatorMatchPenalty` (stack additively when multiple are active):

| Mutator | Penalty per successful match |
|---------|------------------------------|
| `wide_recall` | 5 |
| `silhouette_twist` | 5 |
| `distraction_channel` | 4 |

These are defined next to `getPresentationMutatorMatchPenalty` in `game.ts` (not `contracts.ts`). Tuning them affects endless/daily runs that stack presentation mutators; keep `game.test.ts` presentation penalty test in sync when values change.

## V3 cycle 1 UI / HUD / feedback wrap-up

- 2026-05-26 final stabilization pass found the scoped HUD feedback lane stable after the current active changes. Focused verification passed for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx`, covering visual HUD follow-up copy, compact recent-action feedback, polite live-announcement priority, and UI/audio feedback contracts.
- 2026-05-26 V3 cycle 2 final wrap-up kept the lane documentation-only after verification: `yarn typecheck` passed; focused HUD feedback checks passed (89 tests); focused renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests).
- 2026-05-26 V3 cycle 3 final wrap-up fixed one renderer test fixture to use the current `DungeonObjectiveId` vocabulary (`pacify_floor` instead of stale `defeat_enemies`) and made no runtime UI, HUD, scoring, life, route, or reward changes.
- V3 cycle 3 verification passed: `yarn typecheck`; `yarn vitest run src/renderer/components/GameScreen.test.tsx src/renderer/components/GameplayHudBar.test.tsx src/renderer/hooks/useHudPoliteLiveAnnouncement.test.ts src/renderer/audio/uiSfx.test.ts` (90 tests); and `yarn vitest run src/renderer/App.test.tsx src/renderer/components/ChooseYourPathScreen.test.tsx src/renderer/components/CollectionScreen.test.tsx src/renderer/components/GameOverScreen.test.tsx src/renderer/components/InventoryScreen.test.tsx src/renderer/components/ProfileScreen.test.tsx src/renderer/components/SideRoomScreen.test.tsx` (42 tests).
- Full renderer TypeScript also passed after a longer run. The first `yarn typecheck` attempt timed out at two minutes without diagnostics; rerun with a five-minute window completed successfully.
- 2026-05-26 V3 cycle 4 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed, the focused HUD feedback slice passed (90 tests), and the adjacent renderer screen slice passed (42 tests). No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 5 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, and `useHudPoliteLiveAnnouncement` passed (84 tests); adjacent UI/audio screen checks passed for `uiSfx`, app navigation, route choice, collection, game over, inventory, profile, and side room surfaces (48 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 6 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx` passed (90 tests); adjacent renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 7 final wrap-up stayed verification- and documentation-only after inspecting the dirty `main` worktree. `yarn typecheck` passed; focused HUD feedback checks for `GameScreen`, `GameplayHudBar`, `useHudPoliteLiveAnnouncement`, and `uiSfx` passed (90 tests); adjacent renderer screen checks for app navigation, route choice, collection, game over, inventory, profile, and side room surfaces passed (42 tests); and `git diff --check` reported only the existing LF-to-CRLF normalization warnings. No runtime UI, HUD, scoring, life, route, reward, economy, or balance constants were changed.
- 2026-05-27 V3 cycle 7 browser smoke: `yarn playwright test e2e/long-run-feedback-hud.spec.ts --workers=1` passed both phone HUD viewport cases, but the desktop case timed out while dismissing the startup intro before HUD layout assertions. A desktop-only rerun exceeded the outer command timeout without useful runner output, so desktop browser HUD proof remains unproven rather than a confirmed HUD regression.
- Browser follow-up: `yarn playwright test e2e/long-run-feedback-hud.spec.ts --workers=1` did not produce HUD layout assertions in this local pass. The first run timed out at `page.goto('/')` before `domcontentloaded` for all three cases; a warmed rerun exceeded the outer command timeout. Keep this as pending browser infrastructure/manual verification, not a confirmed HUD regression.
- Remaining work: rerun the heavier browser visual/a11y slice on a clean server (`e2e/long-run-feedback-hud.spec.ts`, mobile HUD density checks, and a fresh screenshot sweep), then manually smoke floor clear into Safe / Greed / Mystery with recent-action feedback, compact recent-action chip priority, live-announcement cadence, and audio feedback visible.

## V3 cycle 1 bug and edge-case hunt wrap-up

- 2026-05-26 final one-hour stabilization kept the repo on `main` and preserved concurrent edits. Fixed stale verification edges only: isolated startup preload tests from cross-file timer bleed, aligned tile-board viewport tests to the current mobile/desktop fit margins, added `gauntlet_pressure` to the gameplay audio coverage expectation, and refreshed the mechanics appendix snapshot for `ENCYCLOPEDIA_VERSION` 15.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1301 tests), and `yarn lint`. Lint has two warnings in `src/renderer/components/GameScreen.tsx` for `react-refresh/only-export-components`; no lint errors.
- Remaining work: run the browser/e2e stabilization lane before release signoff (`yarn test:e2e:renderer-qa` or a smaller navigation plus visual smoke slice), manually smoke floor clear into Safe / Greed / Mystery and gauntlet final countdown audio, and decide whether the `GameScreen.tsx` Fast Refresh warnings are worth splitting into a constants/helper module before freeze.

## V3 cycle 2 bug and edge-case hunt wrap-up

- 2026-05-26 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Remaining work: run the browser/e2e stabilization lane before release signoff (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path plus gameplay-readability smoke), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## V3 cycle 3 bug and edge-case hunt wrap-up

- 2026-05-27 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, navigation, inventory, balance, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Browser smoke attempt: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` exceeded a 10-minute outer command timeout while other Codex lanes and Vite/Vitest/build processes were active, so it remains unproven rather than a confirmed navigation regression.
- Remaining work: rerun the browser/e2e stabilization lane on a quiet server (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path/gameplay-readability), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## V3 cycle 4 bug and edge-case hunt wrap-up

- 2026-05-27 final stabilization stayed verification/documentation-only after inspecting the dirty `main` worktree. Existing concurrent renderer, audio, shared gameplay, progression, navigation, inventory, balance, performance, and docs edits were preserved; no unrelated changes were reverted.
- Verification passed: `yarn typecheck`, `git diff --check` with only existing LF-to-CRLF normalization warnings, `yarn test` (179 files / 1302 tests), and `yarn lint`. Lint still reports the two existing `react-refresh/only-export-components` warnings in `src/renderer/components/GameScreen.tsx`; there are no lint errors.
- Browser smoke attempt: `yarn playwright test e2e/navigation-flow.spec.ts e2e/playable-path-navigation.spec.ts --workers=1` exceeded a 15-minute outer command timeout without useful assertion output. The timed-out navigation/playable-path process tree from this pass was stopped; other local processes were left untouched as likely concurrent lanes or existing servers.
- Remaining work: rerun the browser/e2e stabilization lane on a quiet server (`yarn test:e2e:renderer-qa`, or at least navigation/playable-path/gameplay-readability), manually smoke floor clear into Safe / Greed / Mystery, confirm gauntlet final countdown audio in the live shell, and decide whether the `GameScreen.tsx` exported helpers/constants should move to a small module to silence Fast Refresh warnings before freeze.

## Gen 171: one mode

`GameMode` is now `'endless'` and nothing else. The daily, the puzzle set, the gauntlet and the
meditation run are gone; `docs/REMOVED_MODES.md` holds what each of them was, generated from the
catalogs on the commit before they were deleted.

Nothing a player could set up was lost. The setup sheet (`classic-run-setup.ts`) had already
absorbed every one of them as an option on the one mode: the gauntlet's clock is **Pressure**
(`timed_5 / timed_10 / timed_15`), the meditation's slower window is **Calm pacing**, the wild run
is **Chaos**, practice is **Unrecorded**, and both contracts are **Vows**. What went with the modes
is what only they had: the daily's shared seed and its streak, and the three authored puzzle boards.

Three balance terms moved as a result, and each is a real change to what the one mode pays:

- **Memorize window.** The 1.55× stretch was `gameMode === 'meditation'`; it now reads
  `resolveDelayMultiplier > 1`, which only Calm pacing sets. Same window, reachable from the sheet.
- **Streak rewards.** Meditation suppressed the guard token, the combo shard and the chain heal on
  a streak. That was a mode rule with nowhere to live, so it is gone: every run pays the streak.
- **Recall focus.** The puzzle branch returned 0 from `calculateRecallMatchBonus`, and a great many
  score units were written against runs built with `gameMode: 'puzzle'` for exactly that quiet. Those
  fixtures now say `recallFocus: 0` outright; a real run still opens at `INITIAL_RECALL_FOCUS`, so
  every match in the one mode pays `RECALL_FOCUS_MATCH_SCORE` on top of the terms those units name.

The bands did not move and did not need to: `sim:pop --check`, `sim:cascade --check`,
`sim:cascade --check --relics` and `sim:occupancy` all pass unchanged after the collapse, which is
the point of the exercise — what the simulations measure is now what everyone plays.

The daily's meta layer was re-sourced rather than deleted, because the reward at the end of it is
real. **Week of Archives** (+1 relic pick at every milestone shrine) asked for seven daily clears; it
now asks for seven floors whose chain reached **Sharp** (`playerStats.sharpFloors`), a counter the
one mode moves and the chain quest already keeps. The honor that carried the bronze crest was
re-pointed the same way (`honor_sharp_initiate`). Four achievements and four honors that only a
removed mode could earn were deleted outright rather than left standing unearnable — which is the
failure `achievement-reachability.test.ts` exists to catch.

## Gen 172: the floor is pairs

Board generation stopped placing the dungeon layer. Every generated floor is now a board of pairs
dealt in clumps and nothing else — no card recipe, no filler pass, no exit tile, no shop, no room,
no hazard pass, no layout plan that pinned them. `board-build-rules.test.ts` asserts it over 768
boards, across four seeds, sixteen floors, four archetypes and three floor tags.

### What it did to the cascade

The thesis's central claim was that the dungeon budget was starving the pop of pairs to reach, and
this is the first measurement of it rather than an argument for it:

| | before | after |
|---|---|---|
| Fever share, clean player (`sim:cascade`) | ~0.13 | **0.51** |
| Pop ladder spread (`sim:pop --check`) | — | 4.74, every rung rising |
| Silent systems (`sim:occupancy`) | 11 | **0** |

The occupancy census passes its aspirational check outright for the first time since it was written.
Its silent list did not empty because eleven quiet systems woke up; it emptied because they were
deleted. That distinction is written into `system-occupancy-simulation.ts` so the next reader does
not mistake one for the other.

### The bands that moved, and why each moved

Two retunes, both measured, neither a widening to get past a red test:

- **`avg_guard_reward_potential_per_floor` min 0.1 → 0.05** (measured 0.08). Guard used to come from
  shrine pairs and rest nodes as well as the ward-spark findable; only the findable is left. Guard is
  still reachable, just scarcer, which is a real change to how safe a floor feels.
- **`trait_board_power_interaction_floor_share` min 0.5 → 0.4** (measured 0.42). A swap or block
  wants two traited tiles adjacent, and the dungeon cards padding a floor out were carrying traits
  too.

Five rows left the balance report rather than sitting at nought against a minimum forever: the
moving-hazard average, the hazard-tile average, the floor-1 hazard opener, the contact-risk average,
and recovery relief on high-pressure floors. `max_pressure_step_up` and `max_recovery_debt_streak`
stay, because a ceiling passes honestly at nought.

### The finding this surfaced: the route offer has gone flat

The profile simulation's own guardrail caught something worth keeping in front of whoever picks up
Phase 1's remaining tasks. It exists so that "one route cannot silently become the default answer",
and for the greedy profile that is now exactly what has happened — five faces of one cause:

1. `dominantRouteShare = 1`. Greedy takes the greedy route on all 144 floors.
2. `endingShopGold = 801/144` (5.56/floor, ceiling 5). A player who never takes a safe route never
   pays a safe route's toll, so gold goes in and nothing takes it out.
3. `greedy.rewardClaims / cautious.rewardClaims` 1.60 → 1.68. The denominator moved: cautious used
   to take greed when a floor made safe unattractive, and no floor does that any more.
4. `lowLifeFloorShare` is nought for both greedy and high skill.
5. `greedy.minLivesRemaining` 1 → 4. A greedy player can no longer get into trouble.

Greed used to be withheld on the floors the dungeon layer shaped — a boss floor, an elite node — and
with those gone the offer is the same three doors twelve times over. The answer is the between-floor
layer going too (Phase 1, T1.9–T1.17), not a wider bound. Each of the five is asserted exactly, with
the reasoning at the assertion, so a sixth face fails rather than blending in.

### A softlock the exit tile had been hiding

`selectStasisBlockIndex` refuses to place a Stasis block when one pair is left, but it decided
against the board as it stood at the moment of the match — and the pop that follows that match can
take pairs off the board after the decision is made. Two pairs at decision time, one once the cascade
settles, and the survivor is the blocked one: the floor never ends.

It was live and invisible for as long as every floor carried an exit, because a stranded player could
still leave through it. Seed 172707 floor 3 is where it surfaced, and that is an ordinary floor, not
a corner. `releaseStrandedStasisBlock` re-checks the block against the board the turn actually
produced and drops it when there is nothing else to play.

### The cascade after the cut, and one debt it exposed

`sim:cascade --check` and `sim:pop --check` both pass. Two numbers moved and one band had to move
with them, and one band moved for a reason that is a debt rather than a recalibration.

**Recalibrated.** `referenceFeverShare` max 0.2 → 0.25, measured 0.201. The ceiling was set against a
floor whose pair count the dungeon budget was eating; a floor of pairs deals 9.5 of them, so there
are more matches and more chances to climb. Every rung rose together — clean 0.13 → 0.51, reference
0.08 → 0.20 — and `feverCleanOverReference` came out at 2.54 against a floor of 2, essentially where
it was. A ladder whose rungs all rise by the same factor is the same ladder held higher.

**A debt, recorded not hidden.** `CASCADE_RELIC_BANDS.feverCleanOverReference` min 2 → 1.6, measured
1.65. With all three chain relics held, the ladder barely separates a clean player from a sloppy
one, and the cause is in the same output:

| | bare | holding Tuning Fork + Magpie Ledger + Suit Lens |
|---|---|---|
| turns to clear, clean | 4.1 | **2.9** |
| Fever share, clean | 0.51 | **0.19** |
| clean/reference Fever ratio | 2.54 | **1.65** |

Three relics bought specifically to serve the chain cut the chain's best payoff to a third. They
extend the pop's reach, the floor empties sooner, and there are not enough matches left to climb a
chain with — they work against the thing they exist for. This was masked while the dungeon budget
kept floors small for everyone; on a floor of pairs the reach finally has room to matter, and what
it does with it is end the floor.

The bare bands are untouched. Only the relic path is relaxed, only to the measurement, so any
further flattening fails immediately. The fix is the relics' own numbers, and it belongs with Phase
2, where the shape of a floor is being decided anyway.

## Gen 173: no door between floors

The route offer is gone. A cleared floor goes straight to the next one: no safe, greedy or mystery
door, no gateway pair that picked the door for you, no side room behind it, no run event, no route
card or route special dealt onto the next board. Cut at the source — `generateRouteChoices` and the
route-special layer of board generation no longer exist — and the seven route modules, `run-events`
and the side-room surface went with them (`docs/REMOVED_DUNGEON_LAYER.md` lists them). A
`route.choose` or `side_room.resolve` command in an old journal is rejected with a reason instead of
being replayed; the command types themselves stay in the schema until the journal migration in T1.14.

### The debt list is empty

Gen 172 recorded three findings in `KNOWN_LONG_RUN_DEBT`, each asserted exactly, each answered "by
the between-floor layer going, not by moving a bound". It went, and all three went with it:

| finding (Gen 172) | Gen 173 |
|---|---|
| `greedy … dominantRouteShare=1` | no route to dominate |
| `greedy … endingShopGold=801/144` | gone — it was the toll a never-taken safe route never collected |
| `max_profile_ending_gold_per_floor:5.56 outside 0-5` | inside the band |

`gate:long-run`, `balance-simulation.test.ts` and `long-run-depth.test.ts` now assert an empty issue
list, and the greedy profile's five faces collapse to one line: it loses no life at all over 48
floors and three seeds, because nothing between floors costs one and nothing on the floor does
either. That is the gap Phase 2 exists to fill, and it is asserted exactly.

### The build catalog: seventeen became twelve, and moved

`build-strategy-playthrough-simulation.test.ts` asserts its viability issues exactly. The count went
17 → 12, but not by subtraction:

- **Gone with the metric.** Route risk assessments, route risk rejections, adaptive route selections
  and side-room resource assessments read zero on every build with no route to assess, so the four
  columns were removed rather than baselined, and the two "greed policy with nothing to decline"
  rows with them.
- **Gone with the route, unexpectedly.** Eight hazard-pressure rows. The safe route every policy was
  taking had been keeping the hazard-pressure mutators off the schedule; with no route, one lands
  on one floor a seed. Every matchup is sampled again and The Saboteur's region shuffle fires — the
  Gen 172 note that "its gate never opens" is no longer true, and the assertion says so.
- **Arrived.** The Engine short of shard conversions (2 of 3; seed 42077 never converts, because a
  run that never loses a life has nothing to convert for), one seed with no scout glint for The
  Cartographer, and four more turn-ratio breaches — seven now, all The Cartographer against
  everyone else at 1.53–1.65 — as the last thing that made builds' floors differ in length went.

### Smaller things the cut moved

- **Memory burden.** The same strained board reads 6 ("taxed") → 4 ("loaded"): three route
  decisions no longer weigh on it.
- **The payoff stack.** A route card was one of four reward channels; the same match now cashes
  three and reads "Stack cashout" rather than "Super stack". The build lane behind it becomes
  visible in the four-lane map.
- **The interaction graph** drops `route.choice`, `route.mystery` and `progression.route_side_room`
  (26 edges) and gains a declared reader for `peekRevealedTileIds`, which only the mystery route
  had been reading on paper; the peek power reads it in fact.
- **Bands.** None moved. `sim:cascade`, `sim:pop` and `sim:occupancy` hold exactly where Gen 172
  left them.

## Gen 174: nothing purchasable

Gold is gone, and the shop with it. A cleared floor pays no gold; a match pays none, whatever it
touched — the route card, the dungeon treasure, the toll cache and the fuse cache all paid into the
same wallet, and the wallet is closed; the momentum ladder pays none at Clean and Sharp; the relic
draft's services, still priced on the card, take none. The floor-clear vendor, the vendor a shop
card opened from the board, the store dock button, the shop view, the shop rules and the economy
ledger are deleted (`docs/REMOVED_DUNGEON_LAYER.md`). A `shop.purchase` or `shop.reroll` command in
an old journal is rejected with a reason, like a route choice. `shopGold` stays on the run shape
reading nought until the save migration in T1.14.

### What it did to the numbers

Nothing moved. `sim:cascade`, `sim:pop` and `sim:occupancy` hold exactly where Gen 172 and 173
left them (Fever 0.51 clean, ladder spread 4.74, no silent system), which is the measurement of
the thesis's claim that the wallet was never part of the loop: it was a number the loop fed and
nothing on the board ever read back.

### What left the reports rather than being baselined at nought

The balance profile simulation was a wallet model — gold in from the floor, healing bought when
lives ran low, the rest spent on stock — and with no gold there is no wallet to carry. Gone from it:
the shop-sink row, the gold-per-seed row, the live gold-inflow row, the consumable and power-charge
inflow rows (keys and the vendor's stock), the healing-purchase share, the unhealed low-life
exposure (low life *without healing to buy* is now just low life), the ending and peak wallet
ceilings, and the `shopVisitBias` profile knob. The long-run soak drops the currency-inflow fatigue
row, the two unhealed rows and the wallet rows, and the economy ledger — whose every source was a
dungeon card or the shop — is deleted rather than summarised at nought.

The build catalog loses The Vaultbreaker: its signature was a purchase, its favourable matchup a
treasure floor, its every input gone. Seven builds remain and the `economy` axis, which only it
scored on, goes with it. The viability issue list is asserted exactly as before, one build shorter.
The relic archetype of the same name stays in `relics.ts`, and so does its graph node, because six
relics and the Vaultbreaker definitions still declare it; it reads no gold and enables no shop, and
it goes with the rest of the relic layer in Gen 175.

The lint pass that closed this commit also cleared the last of Gen 173's leftovers: the route
readiness copy in `memory-recall-feedback.ts`, the gateway route resolver
(`loaded-gateway-rules.ts`, deleted), and the side-room assessment helpers in the playthrough
simulation, none of which anything called any more.

### One thing that got slightly worse, and is recorded as such

The Extreme Fever ladder paid a gold at Clean and Sharp and two at Fever, and a shard at Fever. With
gold gone, Clean and Sharp pay nothing: a name on the floor-clear line and no reward behind it. That
is a real loss to the floor-end beat and it is not fixed here. Phase 2's floor-end bonus (T2.7) is
where the tiers get paid again, in score with a tier multiplier, which is what the thesis wanted the
ladder to be in the first place.

## Gen 175: no draft, no loadout

The milestone relic draft never opens. The floor clear used to stop every third floor for it; now
a cleared floor goes straight to the next one, whatever floor it is. The draft surface, its store
slice and its copy are deleted, and so are the offer rules, the pick transition, the sealed fourth
option and the draft services (`docs/REMOVED_DUNGEON_LAYER.md`). A `relic.offer_open`,
`relic.pick` or `relic.offer_service_use` command in an old journal is rejected with a reason, like
a route choice or a purchase. `relicOffer` stays on the run shape reading null until T1.14.

The four starting loadouts are gone from run creation: a run starts with what every run starts
with. `startingLoadoutId` stays on the run and the summary reading null until T1.14, and the
loadout line leaves the game-over build recap and the inventory model.

The build-strategy simulations are deleted rather than emptied: their subject was which relic to
draft, and there is nothing to draft. The build viability issue list (12 rows, asserted exactly
since Gen 173) goes with them. Nothing else that reads a relic moved yet: the relic definitions,
their in-play effects, the favor counters and the relic graph nodes come out in the second half of
this generation, and the reports that count them are re-baselined there.

### What it did to the numbers

Nothing moved. `sim:cascade --check` holds at Fever 0.38 (miss 0.1) / 0.20 (miss 0.25), Extreme
Fever 0.58 / 0.43, ripple 1.09 / 1.06; `sim:pop --check` holds the ladder spread at 4.74; the
occupancy census reports no silent system. The draft was a stop between floors, not a thing on
the board.

### The second half: nothing feeds a draft that never opens

Favor existed to bank relic picks. With no draft it was a counter on the HUD and the floor-clear
line that climbed toward nothing, so it is no longer earned anywhere: not from a featured
objective, not from a boss floor, not from a cursed match, not from a secret room. The counters
stay on the run shape reading nought until T1.14, and a `relic_favor.grant` effect in an old
journal is recorded as changing nothing. The Endless risk wager staked an objective streak for
Favor and paid nothing else, so it is gone from the floor-clear dialog, the rules and the core; a
`risk_wager.accept` in an old journal is rejected with a reason. A featured objective still builds
its streak and pays its score kicker; a miss still decays it.

Everything that counted relic picks across runs is gone with it: the Collection's relic section,
the three relic achievements (Steam has never seen them), the Relic Habit honor, the Relic
Apprentice quest, the relic-mastery honor-mark source and the Week of Archives permanent upgrade,
which bought an extra pick at a shrine that no longer opens. The Profile's next-reward slot now
falls to the cosmetic tracks. The relic loadout leaves the run inventory.

Nothing on the board moved: `sim:cascade --check`, `sim:pop --check` and the occupancy census hold
exactly where the first half left them.

## Gen 176: the dungeon modules go

The thirty `dungeon-*` modules, the hazard-tile and roaming-hazard modules, the dungeon run map,
the relic definitions and their in-play effects, the bonus rewards, the build perks and the
between-floor exit transition are deleted, with their tests (`docs/REMOVED_DUNGEON_LAYER.md` names
every file). Gen 172 had already made all of it unreachable from a generated floor; this is the
commit that stops the turn path asking. A flip is a flip: it no longer clears a roaming enemy off
the last pair, reveals an exit, a vendor or a room, or springs a trap. A match no longer damages
an enemy, scouts a hidden card, pays a key or spills a treasure; a miss no longer wakes one. The
chunk break takes plain pairs and nothing else, and the Tuning Fork and Magpie's Ledger branches,
relics no run has carried since Gen 175, go with the relic pool. A `dungeon.exit_activate`,
`enemy_hazard.contact` or `floor.hazard_banish` command in an old journal is rejected with a
reason.

What stays for one more half-generation is the shape: the run, board and tile fields that carried
the layer (`dungeonRun`, `dungeonKeys`, `enemyHazards`, `tileHazardKind`, the `hazard*ThisFloor`
counters, `relicIds`) are still declared and read nought, so the occupancy diff below is readable
against Gen 175. The second half strips them with the save shape and a one-way upgrade for
existing profiles (T1.14).

The save-field policy table survives the module it lived in. `dungeon-save-migration.ts` was
never about the dungeon; it is the list of which persisted fields need a migration when they
change, `audit:save-field-policy` holds every `SaveData` field to it, and it is now
`save-field-policy.ts`.

The interaction graph loses every relic, build, reward, perk, boss, exit, lock, room and topology
node (version 30); the repo model loses the relic, build-archetype and bonus-reward content
registries; the topology audit and its gate are gone from `gate:systems`, and `gate:softlock-full`
is the softlock stress sweep alone.

### The second half: the shape goes with the modules

The fields are gone from the contract. `RunState` loses the relic, shop, wager, route, side-room,
dungeon-map, ledger, perk, key and enemy fields and the twenty-two hazard, scout, mimic, seal,
gateway, altar, vessel and lattice counters; `BoardState` loses the exit, shop, key, lever, boss,
objective and roaming-hazard fields; `Tile` loses the route, dungeon, hazard and scout marks;
`LevelResult` and `RunSummary` lose the rows that reported them; `PlayerStatsPersisted` loses the
relic pick counts and the shrine unlock. The command core loses the eleven commands and
twenty-four events the layer issued, the twelve content definition sets it drafted from and every
condition and effect that fed them; what the effects engine still resolves is one trait interaction
and two pickups.

Two pickups go with it. The ward spark armed a ward against hazard tiles and the scout glint
revealed a hidden dungeon card; with neither on any floor, both paid nothing, and a pickup that
pays nothing is a stop by the same rule that removed the cards. `FindableKind` is `shard_spark`
and `score_glint`, weighted evenly. That is a generation change, so `GAME_RULES_VERSION` is 34.

The save schema is 7. The upgrade is one-way and it is the normalizer: a schema-6 profile loads
with its best score, achievements, run history and chain records intact and none of the removed
fields; a journal entry naming a command this build no longer has fails its schema and is dropped;
`save-data.test.ts` proves both. The save-field policy table is `save-176-v6`, with the run-local
rows for the dungeon fields gone because the fields are.

## Gen 177: the HUD, the book, and the bands

Phase 1 closes here: what the dungeon left on the screen, in the Codex and in the bands.

### The bar

`RunShell` carries numbers and nothing about which run this is. The line that named the run
(Classic, Practice, Wild, a vow) and the perfect-memory badge move into the pause menu, which is a
menu and not the HUD; the floor number gains the one thing the thesis asked for that was missing, a
marker once the run passes the profile's deepest floor (`profileDeepestFloor`, the greater of the
last summary, the run history and the no-powers record, because `SaveData` never kept one number
for it). The trait-route objective - "trigger two trait routes this floor" for a shard or a score
kicker - was an objective, and objectives go with the dungeon; it is removed with its six run
fields, its floor-clear rows, its inventory row and its SFX accent, and `GAME_RULES_VERSION` is 35.
What stays on the bar still has a rule behind it: lives, shards and guards leave with T2.9, turns
against par arrives with T2.6, the clock with Gen 178, and the mutator name goes when the §33.4
profile rotation replaces the schedule's mutator output.

### The book

`generous_shrine` leaves the mutator roster: its only effect was an extra relic pick. Floor 10 of
the cycle keeps its pickup breather and takes `flip_par` as its objective so it is not floor 3
again, and the guard that forbids a repeated room is back. The Codex loses sixteen glossary terms
and nine entries that described relics, Favor, shop gold, routes, side rooms, wagers, enemies,
keys, exits and the daily challenge; every surviving entry is rewritten to the game that exists
(`ENCYCLOPEDIA_VERSION` 28), and a test now greps every term, topic, mode, mutator and achievement
for the vocabulary of the removed layer. Fourteen trait-interaction tags that named relics and
perks nothing produces any more are gone from the interaction copy, the locked "Endless Mode"
Codex card for a mode that does not exist is gone, and so are the relic overlay tone, the
relic-draft overlay policy row and the three sampled cues nothing played.

### The bands, re-baselined

Every simulation, run on this commit:

| | Gen 176 (six seeds) | Gen 177 (forty-eight seeds) |
|---|---|---|
| Fever share, clean / 10% miss / reference (`sim:cascade`) | 0.48 / 0.39 / 0.24 | **0.46 / 0.37 / 0.20** |
| clean/reference Fever ratio | 2.00 | **2.30** |
| Turns to clear, clean / reference | 4.1 / 6.1 | 4.1 / 6.3 |
| Chunk share of score, clean | 0.31 | 0.31 |
| Extreme Fever, clean / reference | 0.72 / 0.47 | 0.71 / 0.41 |
| Pop ladder (`sim:pop --check`) | 1.93 / 3.22 / 3.58 / 6.82, spread 4.71 | 1.93 / 3.22 / 3.58 / 6.82, spread **4.89** |
| Silent / thin / dominant systems (`sim:occupancy`) | 0 / 0 / 0 | **0 / 0 / 0** |
| `sim:endless --floors=200`, fairness and playable issues | 0 / 0 | 0 / 0 |
| Rating drift from a chunk | 0 | 0 |

**The sample was the finding.** On the six seeds the check used to run, the rules-version bump
alone - the same code, different boards - moved the clean/reference Fever ratio from 2.00 to 1.67
against a band of 2, and the twelve-seed gate read 1.83. The reference player's share is the noisy
half: 0.24 at six and twelve seeds, 0.22 at twenty-four, 0.20 from forty-eight to ninety-six,
where it stops moving. `sim:cascade` and `cascade-balance-simulation.test.ts` both run forty-eight
seeds now (six seconds), and the number they agree on is 2.3.

**Ratcheted, both toward the measurement.** `cleanFeverShareOnBigFloors` min 0.15 → 0.3 (measured
0.45; the 0.15 was set when the dungeon budget kept floors small, and a band at a third of the
measurement would let half the loop's payoff go unnoticed). `referenceFeverShare` max 0.25 → 0.22
(measured 0.20). `feverCleanOverReference` stays at 2 with 0.3 of margin. The pop bands and the
occupancy ratchet were already at their measurements.

### The three recorded debts

- `KNOWN_LONG_RUN_DEBT` emptied in Gen 173 and stays empty; `gate:long-run` asserts it.
- The build-catalog issue list (`build-strategy-playthrough-simulation.test.ts`, seventeen then
  twelve exact issues) went with the builds in Gen 175: there is no catalog to have issues.
- The relic ladder debt - `CASCADE_RELIC_BANDS.feverCleanOverReference` relaxed 2 → 1.6 in Gen 172
  because three chain relics cut the clean player's Fever to a third - went with the relics in
  Gen 175. The bare band it was relaxed from is the only one left, and it holds at 2.3.

## Gen 178: no timer

The Gauntlet card went in Gen 171; its clock did not. The setup sheet's Pressure option could still
start a run against five, ten or fifteen minutes and end it by the wall clock with lives left, which
is the one thing the thesis rules out in so many words (§43.4, §23.5(b)). The clock is gone end to
end: the run and timer fields, the expire command and event, the pause extension that shifted the
deadline, the HUD Clock stat, the polite countdown announcements, the countdown music layer and its
sampled cue, the timed-run identity, the gauntlet quest and the share-key variant. `GAME_RULES_VERSION`
is 36. The last run summary and the run history recorded the clock's length, so the save schema is 8
and the normalizer drops the field on load, one-way, with every record kept; a journal entry naming
the expire command fails its schema and is dropped. The save-field policy table is `save-178-v7`.

No balance constant changed. Every band, re-run on rules 36 with the Gen 177 sample sizes:

| | Gen 177 | Gen 178 |
|---|---|---|
| Fever share, clean / 10% miss / reference (`sim:cascade`, 48 seeds) | 0.46 / 0.37 / 0.20 | 0.48 / 0.35 / 0.20 |
| clean/reference Fever ratio | 2.30 | 2.40 |
| Turns to clear, clean / reference | 4.1 / 6.3 | 4.1 / 6.3 |
| Pop ladder spread (`sim:pop --check`) | 4.89 | 4.79 |
| Silent / thin / dominant systems (`sim:occupancy`) | 0 / 0 / 0 | 0 / 0 / 0 |
| `sim:endless --floors=200`, fairness and playable issues | 0 / 0 | 0 / 0 |

The rules-version bump alone moves the Fever shares by a few hundredths and the ladder by a tenth,
which is the seed noise Gen 177 measured; every band holds with the margin it was given.

## Gen 179: the tempered curve, the three authored floors, four traits

Phase 2 opens with the floor itself (thesis T2.1, T2.2, T2.11).

### The curve

`pairsForFloor(n) = clamp(round(3 + 2.6 * sqrt(n - 1)), 2, 24)` in `pair-curve.ts`, replacing
`level + 1`. Floors 1–6 deal 3, 6, 7, 8, 8, 9 pairs where they dealt 2–7; floor 12 deals 12 where it
dealt 13; floor 30 deals 17 where the old line had already hit its cap of 24. Larger early because a
two-pair board cannot pop and a three-pair board barely can; slower deep because interference makes
memory difficulty superlinear in board size (§23.3). The memorize window follows the same curve.

### The authored floors

Floors 1–3 are laid once, the same for everyone, with the symbols still dealt from the seed
(`authored-floors.ts`). Floor 1 is six tiles of one suit in a 3×2 grid, so any correct match pops
at least one other pair; floor 2 is six pairs in two solid clumps with one boundary line, so a break
stops at a colour; floor 3 is seven pairs with one pair split, its far half touching only the other
suit, so a Clean chain pulls a tile out of nowhere. `authored-floors.test.ts` drives the real break
rule over eight seeds and asserts the three teaching moments (N6, N7) and the board invariants
(N1, N2) on every one. Traits start on floor 4.

### The traits

The roster is the thesis's four: echo, heavy, conduit, stasis. Mirror, cursed, sealed, volatile and
drift go with their effects, copy, marks, colours, interaction tags, counters and simulation metrics
(§32.4's verdicts: a board that changes under the player's reading, a rule you must read, a stop).
The four surviving interaction tags are conduit's three and stasis's block; the effects engine's one
trait definition is now the conduit–echo peek. The interaction graph loses five nodes and fifteen
edges (version 32) and gains the two heavy–stasis synergies and a swap counterplay for the stasis
block. `ACH_TRAIT_SCHOLAR` asks for all four kinds; it asked for five of nine and was unreachable.

### The bands, on the new floors

`GAME_RULES_VERSION` is 37. Forty-eight seeds on the cascade as before:

| | Gen 178 | Gen 179 |
|---|---|---|
| Pairs per floor over floors 1–24, clean | 9.4 | **7.7** |
| Turns to clear, clean / reference | 4.1 / 6.3 | **3.6 / 5.2** |
| Fever share, clean / 10% miss / reference | 0.48 / 0.35 / 0.20 | **0.37 / 0.29 / 0.17** |
| clean/reference Fever ratio | 2.40 | 2.18 |
| Extreme Fever, clean / reference | 0.71 / 0.38 | 0.78 / 0.47 |
| Chunk share of score, clean | 0.31 | 0.30 |
| Pop ladder none / clean / sharp / fever | 1.98 / 3.31 / 3.63 / 6.77 | 1.95 / 3.27 / 3.57 / 7.06 |
| Pop ladder spread | 4.79 | **5.10** |
| Fever breaks on the census (15% miss, 160 floors) | 0.18 | **0.11** |
| Silent / thin / dominant systems | 0 / 0 / 0 | 0 / 0 / 0 |
| `sim:endless --floors=200`, fairness / playable issues | 0 / 0 | 0 / 0 |

Two things moved and both are the curve. Floors are smaller over the first twenty-four (7.7
pairs against 9.4) because the tempered line is below the linear one from floor seven on, and a
floor with fewer pairs has fewer matches to climb a ladder whose Fever rung is half the floor's
pairs: the clean player's Fever share reads 0.37 where it read 0.48, and the census at its 15%
miss rate reads 0.11 where it read 0.18, just over the `common` floor of 0.1. The separation the
band cares about holds at 2.18, the big-floor share holds at 0.35 against 0.3, and floors clear
faster with the same chunk share. This is §52's finding reproduced: Fever is rarer on small floors,
and the thesis's answer is to show the ladder before the player climbs it (option C), not to
lower the rung. The severance drop (T2.3) and multiplicative scoring (T2.5) are the next two
generations and both change what a floor is worth, so the Fever bands are re-read then rather
than moved now.

**One band recalibrated.** `POP_REACH_BANDS.ladderMinStep` 0.3 → 0.25: Sharp pays 0.30 over
Clean on the tempered curve where it paid 0.33 on the linear one. The early floors are bigger but
still one or two suits, so Clean's two waves sweep most of what Sharp's full reaction could reach;
the ladder still rises at every rung (spread 5.10, up from 4.79). The severance drop is the rung
that gives Sharp something back, and this band is re-read there.

## Gen 180: the severance drop

**A pair drops when its suit can no longer pop** (thesis §37.3, T2.3). A suit can pop while two
whole pairs of it sit within a chain-zero pop's reach of each other; when a match or a break
leaves a suit that fails that test, its plain pairs fall, at any tier. `suitCanStillPop` in
`chunk-break-rules.ts` is the test, and it is the pop rule's own reach, so it cannot drift from
the thing it derives from. That replaces Gen 137's remnant threshold (`DROP_MAX_PAIRS`: at Sharp or
better, two plain pairs or fewer left in the matched suit), which fired on 0.6% of floors because
a threshold on a remnant fires when a numeric accident occurs and cannot be aimed at.

### The distribution, and the cap (T2.4)

Measured before any cap, with the pop-reach simulation's new `drop` report over eight seeds and
twelve floors:

| | uncapped | capped at a two-pair remnant |
|---|---|---|
| Chain-one matches that dropped something | 0.284 | **0.250** |
| Pairs a drop takes | 1.44 | **1.20** |
| Drops by pairs taken | 1: 167 · 2: 41 · 3: 21 · 4: 7 | 1: 167 · 2: 41 |
| Floors a drop touched, census at 15% miss | 0.456 | **0.444** (24 floors: 0.508) |

One drop in eight took three or four pairs - F.7's own example, a clump that was cut off rather
than a remnant that was nearly gone. `SEVERANCE_DROP_MAX_PAIRS = 2`: a severed suit down to two
plain pairs falls; with more left it stands, and those pairs are matched from memory like any
other. Two is the remnant §41.2's last-pair problem is about. N8 asked for the drop on at least a
quarter of floors; it is on half.

### What the drop is worth to the chain

Dropped pairs feed momentum in full, as a later wave does. Measured the other way - the drop
feeding the ladder nothing, on the argument that structure giving way is not the chain's work -
Fever on the census fell from 0.11 to 0.05 of floors: a floor the drop clears faster leaves too
few matches to climb. The severance is aimable, and in Puzzle Bobble's economy what falls pays
more than what pops; the credit stays. The ladder itself is now read on the waves alone
(`sim:pop` subtracts dropped pairs), because the drop fires at every tier and was inflating the
chain-one rung by 0.4 pairs while adding nothing to the separation between rungs.

### The census horizon

The occupancy census plays twenty-four floors, matching `sim:cascade`, for the reason Gen 170 gave
when it moved from twelve to sixteen: on the tempered curve floors seven to sixteen are smaller
than the linear ones were, and the drop clears their tails, so sixteen was the shallow half again.
Fever read 0.094 at sixteen floors and 0.233 at twenty-four on the same code, against a `common`
floor of 0.1.

### The bands

| | Gen 179 | Gen 180 |
|---|---|---|
| Turns to clear, clean / reference (`sim:cascade`, 48 seeds) | 3.6 / 5.2 | **3.1 / 4.3** |
| Fever share, clean / 10% miss / reference | 0.37 / 0.29 / 0.17 | 0.38 / 0.32 / 0.19 |
| clean/reference Fever ratio | 2.18 | 2.00 |
| Extreme Fever, clean / reference | 0.78 / 0.47 | 0.78 / 0.50 |
| Chunk share of score, clean | 0.30 | 0.33 |
| Pop ladder none / clean / sharp / fever (waves only) | 1.95 / 3.27 / 3.57 / 7.06 | 1.95 / 3.27 / 3.56 / 7.05 |
| Drop: share of matches / pairs per drop / max | 0.006 of floors | **0.25 / 1.20 / 2** |
| Fever breaks on the census | 0.11 (16 floors) | **0.23** (24 floors) |
| Silent / thin / dominant systems | 0 / 0 / 0 | 0 / 0 / 0 |

A floor clears half a turn faster for everyone, because the last pairs of a severed suit no longer
have to be found by hand, and the chunk's share of score rises with the pairs it takes. The
clean/reference Fever ratio sits on its floor of 2: the drop is worth the same to a sloppy player
as to a clean one, which is the price of a rule that fires at chain zero, and the ladder above it
still separates. `ACH_NOTHING_HELD_IT`, unearnable since Gen 141, is earnable on most floors.

## Gen 181: multiplicative scoring, the floor par, the floor-end bonus

Thesis §40.2, §40.5 and §41.3, implemented as specified and then measured (`sim:cascade`, 48 seeds,
floors 1-24, three miss rates), with two constants set from the measurement rather than the page.

### The break's score

`chunkBreakScore = perPair × pairs × CHAIN_MULT[tier] × waveMult(waves)`, with `CHAIN_MULT` none 1,
Clean 2, Sharp 4, Fever 8 and `waveMult(w) = min(6, 1 + 0.75 (w - 1))`. The per-pair figure stays
derived from the base match score (`floor(match × 0.6)`), so a change to match scoring still
propagates. The size bonus (`6 × n × (n - 1)`), the Fever lift of 1.5 and the ripple lift of 0.2 a
wave capped at 2 are gone, not zeroed. A twelve-pair Fever reaction over seven waves is worth 528
chain-one pops; it was worth 27.

| Break | Old | New |
|---|---|---|
| A chain-one pop, one pair | perPair | perPair |
| Three pairs at Clean | 3 perPair + 36 | 6 perPair |
| Four pairs at Sharp, three waves | (4 perPair + 72) × 1.4 | 40 perPair |
| Twelve pairs at Fever, seven waves | (12 perPair + 792) × 1.5 × 2 | 528 perPair |

### The par

`parTurnsForFloor(pairs) = ceil(pairs × 0.4)`, not the thesis's 0.85. A turn is a pair of flips
resolved, match or miss (the gambit's three are one), counted on a new `turnsThisFloor` ledger the
run bar shows as `turns / par`. The thesis wrote 0.85 assuming a twelve-pair floor takes about ten
turns; measured, with every match popping, it takes 3.5 for a player who never misses and 4.6 for
one who misses a quarter of their flips, so a par of eleven was under on every floor at every miss
rate and said nothing. Per-floor means (clean / 25% miss): 8 pairs 3.0 / 4.5, 12 pairs 3.5 / 4.6,
15 pairs 3.9 / 5.2. At 0.4 a twelve-pair floor pars at five: the clean player is under par on 0.99
of floors, the reference player on 0.78, and that gap is what makes it a goal. Both are bands now.

The `flip_par` objective read the same par. It used to compare matches resolved to
`ceil(pairs × 1.25) + 2`, and a floor of N pairs cannot resolve more than N matches, so it had
never once been failed.

### The floor-end bonus

`100 × floor × {none 1, Clean 1.5, Sharp 2.5, Fever 5}[tier at clear] + 50 × floor × max(0, par - turns)`,
where the tier is the momentum still standing when the last pair went (the Extreme Fever reading,
which used to pay a shard and a name and now multiplies the clear). The flat 50 × floor and the
perfect clear's 25 are gone; a perfect floor is a rating, not a payment. `LevelResult` carries the
par, the turns, the play score, the bonus and its two terms, and the floor-clear dialog says
`Floor 12 · 4 turns, par 5` and `Floor bonus +6,600: Fever ×5 · 1 under par +600.`

Measured, the bonus is a multiple of the floor's play on most floors: at floor 12 the play (matches
and breaks) pays about 1,500 and a Fever clear 6,000 plus efficiency. That is the thesis's own
proportion - its worked table puts a floor-12 Fever clear (6,000) beside a huge Fever reaction
(5,280) - but our real breaks are smaller than its examples (the largest break on a clean floor 12
is about 700), so the ceremony pays eight times the best thing that happened rather than about the
same. Recorded here, not changed: Phase 3's scoring re-read (§40.4, the score built term by term)
is where the proportion gets looked at with the presentation in place. The score shares below are
read against the play score for that reason; against the total they measure the bonus.

### The bands

| | Gen 180 | Gen 181 |
|---|---|---|
| Chunk share of play score, clean | 0.33 (of level score) | **0.71** |
| Largest break's share of play score, clean (N5, 0.25-0.70) | - | **0.50** |
| Under par, clean / reference | - | **0.99 / 0.78** |
| Turns to clear, clean / reference | 3.1 / 4.3 | 3.1 / 4.2 |
| Fever share, clean / reference | 0.38 / 0.19 | 0.33 / 0.19 |
| clean/reference Fever ratio | 2.00 | **1.70** |
| Extreme Fever, clean / reference | 0.78 / 0.50 | 0.78 / 0.52 |

`cleanChunkShareOfScore` moves from 0.08-0.4 to 0.5-0.85: the break is the score now, by design,
and N5 is the band that keeps the small ones from being decoration.

The score milestones are a new record season, as the design doc said a new scoring regime would
be: Gold Mind moves from 1,000 to 10,000 and Vault Mind from 10,000 to 100,000. A clean player
banks a thousand by floor two now and ten thousand by about floor seven; a hundred thousand is
floor fifteen or so for the clean player and later for the reference one. The ids stay, because
they are Steam API names.

Two bands moved for a reason that is not this generation's. Scoring cannot touch the ladder, yet
the clean/reference Fever ratio fell 2.00 → 1.70 and Extreme Fever's 1.56 → 1.49. The rules version
went 37 → 38, which re-deals every seed's board, and that alone is the movement:

| | 48 seeds v37 | 48 seeds v38 | 96 seeds v37 | 96 seeds v38 |
|---|---|---|---|---|
| Fever clean / reference | 0.364 / 0.187 | 0.327 / 0.193 | 0.368 / 0.190 | 0.349 / 0.199 |
| ratio | 1.95 | 1.70 | 1.94 | 1.75 |
| Extreme Fever ratio | 1.55 | 1.49 | 1.53 | 1.48 |

Forty-eight seeds settle the reference player's share (Gen 177's finding still holds: 0.19-0.20
everywhere) but not the ratio of two shares, and doubling the seeds does not close the gap between
versions. A version's boards are one draw, and a band at 2 or 1.5 sat inside the spread between
two draws of the same rules. `feverCleanOverReference` moves 2 → 1.5 and
`extremeFeverCleanOverReference` 1.5 → 1.3, under the worse draw with the margin the old floors had
over the better one. What the bands are for - the clean player reaches Fever and finishes at it
markedly more often than the sloppy one - holds on both draws; a ratio near 1 is the failure they
exist to catch.

## Gen 183: lives out, the turn ceiling in

Thesis §42.2 and §67. There are no lives. A run ends when the player stops, when a contract's
mismatch limit is passed, when a shared game's last floor is done, or when a floor is not cleared
within its turn ceiling, `parTurnsForFloor(pairs) × 3`. A miss is still a try against the rating
and a turn against the par, and it still drops the chain's momentum; it costs nothing else.

### What went with the lives

Lives (4 to start, 5 at most), the life lost on a miss, the first-mismatch grace, guard tokens
(one every fourth chain step, two at most, spent on a miss or on the magpie), the chain heal (a
life every eighth step), three combo shards for a life, the clean and perfect clear's life, the
memorize time banked for a lost life, and the score parasite - a mutator that ate a life every
four floors and did nothing else. The magpie cannot be scared off any more; the off-duty guard
lends a peek instead of a token. Combo shards stay one more generation, banked to their cap and
buying nothing, so this diff reads; Gen 184 takes them. The history is in
`docs/REMOVED_LIVES.md`.

### The ceiling, measured

`sim:cascade`, 48 seeds, floors 1-24, the share of floors the ceiling ended:

| Miss rate | Cleared | Ceiling | Turns to clear | Under par |
|---|---|---|---|---|
| 0 | 1.000 | 0.000 | 3.1 | 0.99 |
| 0.10 | 1.000 | 0.000 | 3.5 | 0.93 |
| 0.25 (reference) | 1.000 | 0.000 | 4.2 | 0.77 |
| 0.40 | 0.996 | 0.004 | 5.6 | 0.57 |
| 0.50 | 0.971 | 0.029 | 6.6 | 0.45 |
| 0.60 | 0.914 | 0.086 | 8.3 | 0.31 |
| 0.70 | 0.764 | 0.236 | 10.0 | 0.23 |

The reference player never meets it, and a player missing half their flips meets it on three
floors in a hundred: a floor under competence, as the thesis asked, not a gate. It is a band now
(`referenceCeilingShare`, max 0.02). The reference player's cleared share moved 0.99 → 1.00 - the
one floor in a hundred they used to die on was a life lost to a miss, and there is no such floor.

Every other band is where Gen 181 left it, within the deal's noise: rules version 38 → 39 re-deals
the boards (Fever clean 0.35 / reference 0.21, ratio 1.67; Extreme Fever 0.79 / 0.54; chunk share
0.70; largest break 0.49; under par 0.99 / 0.77).

## Gen 184: combo shards out

Thesis §44.4 and §40. The combo shard was the life economy's bank and, after Gen 183, a number that
filled to two on the first chain and never moved. It is gone: from the streak, the chunk break, the
Extreme Fever finish and the board, where the **Shard Spark** findable went with it and the Score
Glint takes the whole spawn roll. `GAME_RULES_VERSION` 39 → 40 for the changed roll. The record is in
`docs/REMOVED_LIVES.md`.

### The findable census

`sim:occupancy --ratchet`, 240 floors, the reward row before and after:

| | Floors with a claim | Claims a floor |
|---|---|---|
| Gen 183 (two kinds, 50/50) | 1.000 | 1.54 |
| Gen 184 (one kind) | 1.000 | 1.54 |

Unmoved, as expected: the number of findable pairs a floor deals is decided before the kind roll, and
every claim pays score now rather than half of them paying a shard.

### The bands

`sim:cascade --check`, 48 seeds, after: clean player Fever 0.34 / reference 0.20 (ratio 1.70), Extreme
Fever 0.78 / 0.52, chunk share 0.70, largest break 0.49, under par 0.99 / 0.75, ceiling 0.000 at every
miss rate the bands watch. `sim:pop --check` and `sim:endless --check` pass. The rules-version re-deal
moves the reference player's Fever share 0.21 → 0.20 and under-par share 0.77 → 0.75, inside the
noise Gen 181 measured for a re-deal; nothing was retuned.

## Gen 186: what a rung is worth, measured and shown

Thesis §30.3(a). The chain meter said where the player stood on the ladder and never what standing
there bought, so the pairs a rung takes are now a cluster of pips beside the tier - one per pair -
and the whole ladder sits in the hover hint and the meter's accessible label.

### The ladder, re-measured

`simulatePopReach()`, eight seeds, twelve levels, each tier measured at its own rung:

| Rung | Pairs a break takes | Step over the rung below |
|---|---|---|
| A lone match | 1.91 | — |
| Clean | 3.19 | 1.28 |
| Sharp | 3.50 | **0.32** |
| Fever | 6.95 | 3.44 |

Spread 5.04 against a band floor of 2.2, so the climb as a whole is worth making. The constants the
HUD draws (2 / 3 / 4 / 7) are pinned to this measurement by `chain-rung-value-rules.test.ts`, which
re-runs the simulation and fails if a rung walks more than 0.6 of a pair away from what it promises.
A meter that says three pairs while the rule pays one is worse than a meter that says nothing.

### The finding: the middle rung is thin again — **corrected at Gen 189, see below**

**Sharp pays 0.32 pairs over Clean.** The band floor is 0.25, so this passes, but it is the same
failure Gen 168 existed to fix: measured then at 0.01, repaired to 0.39, and the Phase 1 and 2 board
changes have walked it back to 0.32. Clean's partner reach already sweeps most of what Sharp's
unbounded reaction could find, and the floors are bigger now, which helps Clean more than Sharp.

The pips make it visible for the first time - the cluster barely changes when a player reaches Sharp
- which is the honest outcome of putting a number on an interface: it showed the design something it
had been hiding from itself. Not retuned here, because an interface generation is the wrong place to
move a rule: it has its own task.

## Gen 189: the ladder was not thin, the measurement was

Gen 186 put the pairs a rung takes on the HUD and reported Sharp finding 0.32 of a pair more than
Clean, against a band floor of 0.25 - the same failure Gen 168 existed to repair. That finding was
measured on the wrong quantity, and this generation says so rather than acting on it.

**Pairs are the ladder's input. Score is its payoff.** The tier multiplies what a break finds
(`CHAIN_MULT` = ×1 / ×2 / ×4 / ×8), so a rung that finds barely more pairs still pays twice as much
for every pair it finds. Measured both ways over eight seeds and twelve levels:

| Rung | Pairs a break takes | Step in pairs | Score a break pays | Step in score |
|---|---|---|---|---|
| A lone match | 1.91 | — | 70 | — |
| Clean | 3.19 | 1.28 | 226 | **×3.24** |
| Sharp | 3.50 | **0.32** | 506 | **×2.24** |
| Fever | 6.95 | 3.44 | 2036 | **×4.02** |

Every rung more than doubles what the rung below pays. The ladder is healthy; the pair column is
what made it look otherwise, and Gen 186's pips inherited that. `scorePerMatch` and `scoreStep` are
now in the pop simulation's report and banded (`ladderScoreMinStep`, min 1.8×), so from here the
thing that is guarded is the thing the player feels. The pairs band stays as a secondary guard: it
caught a real failure at Gen 168, when a rung bought literally nothing.

### The reach experiment, and why it was rejected

Before measuring the payoff I tried to widen Sharp's step by shrinking the rungs below it, since the
pop had grown fat (1.18 pairs at Gen 168, 1.91 now). Measured, with the wave's reach as a per-tier
record and the drop's reach decoupled from it:

| Reach (pop / Clean) | Pairs ladder | Sharp's step | Verdict |
|---|---|---|---|
| 2 / 2 (shipped) | 1.91 / 3.19 / 3.50 / 6.95 | 0.32 | — |
| 1 / 1 | 0.63 / 2.43 / 3.50 / 6.95 | **1.07** | **rejected** |
| 1 / 2 | 0.63 / 3.19 / 3.50 / 6.95 | 0.32 | no gain |
| 1 / 3 | 0.63 / 3.35 / 3.50 / 6.95 | 0.15 | worse |
| 2 / ∞, partner at Sharp | 1.91 / 2.95 / 3.50 / 6.95 | 0.56 | breaks floor 3 |
| 2 / 2, partner at Sharp | 1.91 / **1.91** / 3.50 / 6.95 | 1.60 | Clean buys nothing |

Reach 1 gives much the best pair ladder and fails twice over: a player missing a quarter of their
flips reaches Fever on **0.326** of floors against a band of 0.22, because a weaker pop means more
matches per floor and the Fever rung is a share of the floor's pairs - so shrinking the pop hands
Fever to everyone and destroys the clean-over-reference separation the tier exists to create. It
also breaks all three authored floors: floor 1's guarantee is that on a 3×2 no cell is further than
the pop's reach from the nearer half of any pair, and at reach 1 a deal exists where the first match
pops nothing, which is the one thing §51 authored those floors to prevent.

The last row is the useful one for whoever tunes this next: with the partner reach moved off Clean,
Clean buys **exactly nothing** over a lone match. Clean's entire value is the partner reach, and
Sharp's problem is that a reach-2 region on a six-pair suit is already most of the suit. Making
Sharp find more pairs means changing the *boards* - suits that spread past reach 2 - not the reach.
Nothing was retuned: the rules are as they shipped, and `BREAK_CLUMP_REACH` / `BREAK_PARTNER_REACH`
are now records so the next attempt is a one-line change with the numbers above to check it against.

## Gen 190: the settle — the board packs toward the middle

Every card a match or a break takes now leaves the board, and the cards left behind fall in toward
the centre to close the gap (`board-settle-rules.ts`, wired into the turn at
`turn-match-board-resolution-rules.ts`). The rule is one move repeated: take the closest gap-and-card
pair on the board and put the card in the gap, where a card may only ever move to a cell nearer the
middle than the one it is in. Because the pair is chosen globally, a card moves as short a distance
as the settle allows and the gap walks outward, rather than one card being flung across the grid.

Measured over the same forty-eight seeds the cascade simulation always uses, with everything else
held still:

| Reference player | Turns a floor takes | Pairs a floor pays | Fever share | Score | Ripple mean | Breaks that rippled |
|---|---|---|---|---|---|---|
| No settle, miss 0 | 3.1 | 8.13 | 0.37 | 9668 | 1.08 | 0.07 |
| Settle, miss 0 | 3.0 | 8.19 | 0.34 | 9608 | **1.00** | **0.00** |
| No settle, miss 0.25 | 4.3 | 7.92 | 0.20 | 7436 | 1.06 | 0.06 |
| Settle, miss 0.25 | 4.1 | 8.08 | 0.19 | 7480 | **1.00** | **0.00** |

Every band still holds and `yarn sim:cascade --check` passes. The occupancy census moves the same
way: the drop's share of floors falls from 0.442 to 0.388 and matches per floor from 3.18 to 3.04,
both inside their bands.

**The finding, recorded because it is a regression and not a win.** The ripple stops firing. It was
already marginal - 7% of breaks reached a second wave before the settle - and the settle takes it to
zero. The cause is not that reactions got smaller: `largest` is 0.49 either way and pairs per floor
went *up*. A packed board simply makes the first wave's clump big enough to swallow the partners
that used to seed the second, so the ripple's work moved into wave 0 where it has no name and no
beat. The player loses the "Ripple ×N" line, not the payout.

The fix is the one the Gen 189 note already pointed at from the other direction: the boards are too
small and carry too few suits for any of this to have room. A floor is **three turns long** and
shows **two suits** up to floor 12 (`yarn sim:pop`), so the whole screen clears in two goes and no
reaction ever needs a second wave. Gen 191 widens the palette and the pair curve, and the ripple is
the number to re-measure there.

## Gen 191: the boards grew, and the palette grew with them

Gen 190's note ended by naming the reason the ripple had nowhere to fire: a floor was three turns
long and showed two suits until floor twenty, so the whole screen went in two goes and no reaction
ever needed a second wave. This generation is that repair. Three constants moved, and the third
moved because the first two did.

### The pair curve, anchored to the authored floors

`pairsForFloor` used to be one square-root curve over every floor, which quietly collided with the
three authored teaching floors: a layout the deal cannot fill is abandoned for the ordinary deal
with nothing failing, so a curve that stopped returning 3, 6 and 7 would have turned floors 1 to 3
off in silence. The curve now returns the authored sizes for those floors by name and takes over
from floor 4, anchored on the last of them. `pair-curve.test.ts` fails if the two ever disagree.

| Floor | 4 | 6 | 8 | 12 | 20 | 30 | 50 |
|---|---|---|---|---|---|---|---|
| Was | 8 | 9 | 10 | 12 | 14 | 17 | 21 |
| Now | 9 | 11 | 12 | 14 | 17 | 19 | 23 |

### The palette, one suit per four pairs instead of six

With bigger boards a suit can be one in four rather than one in six and still hold about as many
pairs as it did. A floor now reaches three suits at floor 5 and four by floor 11, against two suits
until floor twenty.

The cost is real and it is not evenly spread. A **scattered** floor - a rush, speed or trap floor -
has no regions by construction, and every suit added to one thins what is left until a match
touches nothing of its own kind: measured, a third suit takes a scattered floor's pop rate from
about 0.7 of matches to **0.36**, which is exactly the failure Gen 148 existed to fix. So the
palette is now capped by how a floor deals: a scattered floor keeps two suits however big it is,
a spotlight floor keeps its two by definition, and a clumped floor grows. With that cap the worst
floor in the first twelve pops on 0.63 of matches, unchanged from before this generation.

### The tier shares, 0.45 and 0.6

Momentum counts the pairs a break took as well as the matches made, so it climbs faster on a bigger
board than the pair count it is measured against. On the new curve a reference player reached Fever
on 0.32 of floors against a band of 0.22 - Fever stops being a thing you reach and becomes a thing
that happens. Raising the shares from 0.4 and 0.5 corrects it without touching the reaction itself.

| Reference player (misses a quarter) | Turns | Pairs a floor | Fever share | Score |
|---|---|---|---|---|
| Gen 190 | 4.1 | 8.08 | 0.19 | 7480 |
| Gen 191, shares unchanged | 5.5 | 9.37 | 0.35 | 7755 |
| Gen 191, shares raised | 5.4 | 9.26 | **0.18** | 6796 |

A clean player reaches Fever on 0.45 of floors, so the separation is 2.5 against a band of 1.5.

### What it bought, and what it did not

The ladder got deeper, which is the thing Gen 189's reach experiment concluded could only be bought
by changing the boards:

| Rung | Pairs, Gen 190 | Pairs, Gen 191 | Score step, Gen 190 | Score step, Gen 191 |
|---|---|---|---|---|
| A lone match | 1.91 | 1.76 | — | — |
| Clean | 3.19 | 2.97 | ×3.24 | ×3.35 |
| Sharp | 3.50 | 3.47 | ×2.24 | **×2.52** |
| Fever | 6.95 | 7.84 | ×4.02 | **×4.73** |

Sharp's step over Clean in pairs goes 0.32 to 0.50, the spread from a lone match to Fever 5.04 to
6.08, and every rung's score step is more even than it was. A floor now takes 5.4 turns for the
reference player against 4.1, which is the "two goes and the screen is gone" complaint answered.

**The ripple is still not back.** It reads 0.02 of breaks at zero misses and 0.00 at the reference
rate, against 0.07 before the settle. Bigger boards moved it from nothing to nearly nothing, and
that is as far as board size can carry it: the cause is a rule, not a size. A Sharp or Fever break
has unbounded reach, so it takes the whole suit in the first wave and leaves nothing for a second;
the ripple only ever lived at Clean, where the reach is bounded, and a packed board puts Clean's
partners inside the clump the first wave already took. Making the ripple fire again means changing
what a wave is allowed to take, which is its own generation and its own risk. Recorded here rather
than quietly left as a number nobody looks at.

## Gen 192: the settle out, and the ripple back on its own

The settle went, on the player's call, for the reason no measurement was going to argue with: a
memory game may not move a card the player has learned. `docs/REMOVED_SETTLE.md` keeps the whole
record. Cleared cards still leave the board; the holes they leave now stay.

The interesting part is what the measurement said afterwards. Two generations had been spent
chasing the ripple - Gen 190 recorded it dying, Gen 191 widened the boards and the palette partly to
revive it and got it back only to 0.02, and a task was filed to change what a wave is allowed to
take. Removing the settle answered all of it at once:

| | Ripple mean | Breaks that rippled | Drop, share of floors | Turns a floor takes |
|---|---|---|---|---|
| Before the settle (Gen 189 boards) | 1.08 | 0.07 | 0.442 | 4.3 |
| With the settle (Gen 190) | 1.00 | 0.00 | 0.388 | 4.1 |
| With it, on the wider boards (Gen 191) | 1.02 | 0.02 | 0.463 | 5.4 |
| **Without it, on the wider boards** | **1.16** | **0.16** | **0.588** | **5.7** |

The ripple is not merely restored, it is healthier than it has ever been: 0.16 of breaks reach a
second wave at zero misses and 0.07 at the reference miss rate, against 0.07 and roughly nothing
before any of this. The severance drop moved the same way, from 0.463 of floors to 0.588. Both had
the same cause, and it was not the reach or the board size: a packed board lets the first wave
swallow the partners and the orphans that the second wave and the drop existed to find.

The finding worth keeping is procedural. Gen 191 was a real improvement on its own terms - the pair
curve and the palette both stand - but it was reached for partly as a repair for a number that a
different change had broken, and it could not have fixed it. When a metric falls the generation a
mechanic lands, suspect the mechanic before tuning around it.

### One band re-tuned

`CHAIN_TIER_FEVER_SHARE` goes 0.6 to 0.62. Longer floors mean more matches and more momentum, so
with the settle out the reference player landed on 0.22 of floors reaching Fever against a band
whose ceiling is exactly 0.22 - passing, with no margin for the next change. At 0.62 that reads
0.17, with a clean player at 0.44, so the separation is 2.6 against a band of 1.5.

`CHAIN_TIER_SHARP_SHARE` stays at 0.45. The ladder is unchanged in shape: 1.74 / 3.00 / 3.40 / 7.88
pairs per rung, paying x3.33 / x2.37 / x4.84.

## Gen 193: two suits on the first board, three on the second

The first three floors are authored, and they were dealing one suit, then two, then two. A board of
one colour is not a board with a map on it, it is a field, and the palette then sat at two until the
procedural floors caught up. This generation opens them.

| Floor | 1 | 2 | 3 | 4 | 6 | 10 |
|---|---|---|---|---|---|---|
| Suits, was | 1 | 2 | 2 | 2 | 3 | 3 |
| Suits, now | **2** | **3** | **3** | **3** | 3 | 4 |
| Pairs, was | 3 | 6 | 7 | 9 | 11 | 13 |
| Pairs, now | **4** | 6 | 7 | 9 | 11 | 13 |

### Floor 1 needed a fourth pair, and the reason is the cursed pair

Two suits over three pairs is 2 and 1, and a suit of one pair cannot pop at all - the pop needs two
whole pairs of a suit within reach of each other. Four pairs gives two suits of two, laid as two
solid 2×2 blocks on a 4×2 grid, where every cell of a suit is within `BOUNDED_BREAK_REACH` of every
other. So whatever the player matches first, the suit's other pair pops, and it visibly stops at the
colour boundary - the pop and the boundary taught on one board instead of two.

That still failed on measurement, and the cause is worth recording: **an authored floor was taking
an incidental cursed pair**, and a break never takes the cursed pair. A suit of two pairs whose other
pair is cursed pops nothing, whatever the layout promised. The guarantee those three boards exist to
make was being cancelled silently on any seed that put the cursed pair on floor 1.

Authored floors now take no incidental cursed pair. One asked for by the floor's own objective is
still honoured, because that is content the player was told about; the schedule never puts a cursed
objective on floors 1 to 3 in any case. This is the same rule the authored floors already applied to
traits, which start on floor 4.

Floor 2 is three bands of four on a 4×3 grid, two pairs to a band: a row of four holds any two pairs
within reach of each other however the seed lays them, so every band pops from any of its pairs, and
three bands make the boundary a rule rather than the coincidence of one line. Floor 3 keeps its seven
pairs and its split pair and moves to a 5×3 grid with three suits.

### The palette rounds up now, so it never goes backwards

With rounding-to-nearest, floor 4's nine pairs asked for two suits - the palette narrowing the moment
the tutorial ended, which is the opposite of what the player has just been taught to read. Rounding
the ratio up instead gives floor 4 three suits and floor 10 all four, and the count never decreases
as the boards grow.

### What it cost

| | Lone match, pairs | Sharp step | Spread | Score rungs | Ripple | Fever, reference |
|---|---|---|---|---|---|---|
| Gen 192 | 1.74 | 0.40 | 6.13 | ×3.33 / ×2.37 / ×4.84 | 0.16 | 0.17 |
| Gen 193 | 1.47 | 0.43 | 6.08 | ×3.42 / ×2.47 / ×5.10 | 0.14 | 0.18 |

The ladder is unchanged in shape and slightly more even in score. The real cost is the pop rate on
the early procedural floors: floors 4 to 6 fall from about 0.95 of matches popping to about 0.76,
because three suits over nine to eleven pairs is three pairs to a suit and a three-pair region does
not always hold two whole pairs within reach. Every band still passes, and the scattered-floor cap
from Gen 191 keeps the worst floors where they were. It is the price of the palette and it is worth
watching: if it drops further, the lever is the pair curve, not the palette.

## Gen 196 — the decoy left, and nothing moved

The `glass_floor` mutator, the `__decoy__` card and the `glass_witness` objective all went, along
with the `__exit__` pair key that had outlived the exit card by twenty generations. The full record
is in [`REMOVED_DECOY.md`](./REMOVED_DECOY.md); this is the measurement.

| | Lone match, pairs | Sharp step | Spread | Score rungs | Ripple | Fever, reference | Occupancy |
|---|---|---|---|---|---|---|---|
| Gen 195 | 1.46 | 0.44 | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.44 | 11 counters, baseline |
| Gen 196 | 1.46 | 0.44 | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.44 | 11 counters, unchanged |

Every number is identical to four significant figures, which is the correct result and worth saying
out loud rather than skipping past. The decoy was an *extra* card, dealt on top of the pair budget,
on two floors of a twelve-floor cycle. It never entered a clump, never popped, never rippled, never
dropped, and never appeared in a chain-tier calculation. Taking it away therefore moves nothing the
cascade measures.

That is the whole indictment. A mechanic that costs nothing to remove was, by the same arithmetic,
contributing nothing — and it was doing that while occupying a Codex entry, a mutator slot, an
objective slot, two `RunState` fields, a fairness issue code, a renderer prop chain through five
components, and a corner ring in the WebGL board. The Gen 194 accountability audit exists to find
exactly this shape: a mechanic on the board with no counter answering for it. The decoy was on the
exemption list, and the honest resolution of an exemption is sometimes deletion rather than
instrumentation.

Two lines did change, and both are administrative rather than behavioural: `MUTATOR_CATALOG` is 10
entries rather than 11, and `SINGLETON_UTILITY_PAIR_KEYS` holds one key rather than two.
`tile-identity.test.ts` now pins that count, so the next singleton anyone adds has to argue for
itself against the rule the removal doc states: **every card on the board has a partner**, and the
wild joker's exception is one that makes the player's read worth *more*, not worthless.

## Gen 197 — contact, not distance

The pop stopped reaching cards it was not touching. `docs/BREAK_TOUCHES_ONLY.md` is the full record:
what was measured, why the partner reach and the halo went, and what replaced them. This is the
balance side of it.

| | Lone match | Clean | Sharp | Fever | Spread | Score rungs | Rippled | Severance floors |
|---|---|---|---|---|---|---|---|---|
| Gen 196 | 1.46 | 2.62 (+1.16) | 3.05 (+0.43) | 7.59 (+4.54) | 6.13 | ×3.56 / ×2.49 / ×5.11 | 0.16 | 0.583 |
| Gen 197 | 1.46 | 2.10 (+0.65) | 5.79 (+3.69) | 8.46 (+2.67) | 7.00 | ×2.89 / ×8.99 / ×2.81 | 0.25 | 0.779 |

Every band passes. Three readings worth keeping.

**The middle rung got thicker, not thinner.** The whole risk of this change was that removing the two
long-range rules would flatten the ladder, and the first measurement said exactly that: bounded to
one suit clump the rungs paid 1.46 / 2.10 / 2.20 / 2.66, Sharp worth **0.10 pairs** over Clean. The
fix was not to give the reach back but to find a lever that stays inside the rule — the **bridge**,
which spreads the wave into a clump the broken cards were in contact with. With it Sharp pays 3.69
over Clean, against the 0.43 it paid before the change. `CHAIN_RUNG_PAIRS` moved from `{1, 3, 3, 8}`
to `{1, 2, 6, 8}`; Clean and Sharp stopped rounding to the same number for the first time since
Gen 186.

**The score rungs got less even while the pair rungs got more even.** ×2.89 / ×8.99 / ×2.81 against
×3.56 / ×2.49 / ×5.11. Sharp is now the loud step in both currencies, which is defensible — it is the
rung where a break stops being one clump and becomes two, and that is a thing a player can see happen.
It is worth watching rather than tuning immediately: the pair ladder is what the aim guide previews,
and it now reads 1 / 3 / 5 / 7 on the reference fixture, two pairs a rung, which is the cleanest that
ghost has ever been.

**The severance drop is doing a lot more work**: 0.583 → 0.779 of floors. That is the direct
consequence of a pop that only takes what it touches — more suits end up stranded, and the drop is
the rule that clears a stranded suit. It is inside its band. If it climbs much further it stops being
a surprise and becomes a second, quieter pop, and the lever is `SEVERANCE_DROP_MAX_PAIRS`, not the
break reach.

The bridge also had to be capped, and the measurement is the argument: uncounted, a Sharp break took
**8.26** pairs against Clean's 2.10, because a clump touches several others at once and the fire ran
until the floor was gone. One clump at Sharp, three at Fever, and the bridge fires on one wave only.

## Gen 198 — the deal did not feel random, and the measurement agreed

> "the algorithm for spawning needs to mesh all the cards together. It doesnt feel random. We get a
> bunch of cards spawning next to eachother that are matching etc."

Measured before touching anything, over six seeds × twenty floors (1512 pairs): **0.228 of pairs
landed with their two halves orthogonally touching**, and a further **0.144 at a corner**. More than
a third of every floor's pairs sat beside their own twin.

The interesting part is that this is roughly what *chance* gives. On a board of twenty cells a given
cell has about four of the other nineteen as orthogonal neighbours, so a shuffle lands a pair's
halves adjacent about one time in five on its own. The deal was not biased; it was uniform, and
uniform is the problem. A memory game whose boards hand the player one free pair in five reads as
arranged rather than random, because they keep finding pairs they never had to remember — and the
lesson generalises: **in a game about remembering where things are, a uniform shuffle is not neutral,
it is generous.**

The fix is in the last step of `dealTilesInClumps`, which used to shuffle a suit's tiles into that
suit's cells. It now lays whole pairs first, drawing the second half at random from every cell at
least `PAIR_HALF_SEPARATION` (3) grid steps from the first, then a repair sweep of swaps for pairs
that a greedy placement painted into a corner. It is a floor with a random draw above it, not a
target: the halves end up as far apart as the board happens to put them.

| | Mean distance between halves | Touching | At a corner | Either |
|---|---|---|---|---|
| Gen 197 | 3.02 | 0.228 | 0.144 | 0.372 |
| Gen 198 | 3.60 | **0.053** | 0.104 | **0.157** |

**The residual is structural and worth stating rather than chasing.** Four suits over twenty cells
gives each suit about five cells, dealt as a clump — and a tight clump's own diameter is often two,
so a pair inside it *cannot* be three apart. The suit clumping is what the pop needs; the separation
is what the memory needs; on a small board they genuinely compete. The rule takes the farthest cell
available rather than refusing to place a tile, and `tile-suit-rules.test.ts` ratchets both rates so
a regression cannot creep back.

Two side effects, both in the game's favour:

| | Lone match | Clean | Sharp | Fever | Severance floors |
|---|---|---|---|---|---|
| Gen 197 | 1.46 | 2.10 | 5.79 | 8.46 | 0.779 |
| Gen 198 | 1.70 | 2.17 | 5.91 | 8.74 | 0.667 |

**A chain-one pop got bigger, not smaller** — 1.46 to 1.70 pairs. Spreading a pair's halves through
its suit's clump puts more *whole* pairs inside any given wave, which is exactly what the contact
rule needs. And the severance drop fell back from 0.779 to 0.667 of floors, because a pop that takes
more whole pairs strands fewer suits.

The one cost is on the meter's hover sentence. `CHAIN_RUNG_PAIRS` re-baselined to `{2, 2, 6, 9}`, so
the bottom two rungs now round to the same number of pairs. That is the case Gen 189 already ruled
on — the meter shows the **multiplier**, precisely because pairs alone can read flat while the payoff
doubles — and the rung test now asserts the strict climb on the multiplier and allows one level step
in pairs.

## Gen 200 — the two dead powers, and what their absence moved

Rules version 47 → 48. This entry records the measurements the removal changed, not the argument
for the removal itself; that lives in [REMOVED_POWERS.md](./REMOVED_POWERS.md).

**The wild joker re-banded from `common` to `core`.** The occupancy census bands each system by how
much of the game it occupies: `core` wants 0.9 or more of the floors it can act on, `common` wants
0.1 to 0.9. The wild joker had been sitting in `common`, and after Gen 200 it reads **1.000** on the
setup pass — the census failed with "wildMatch is now dominant and is not in the baseline".

That is not a regression to tune away. Stray was the only thing in the game that could take the
joker off the board before it was spent, because after Gen 196 the joker was Stray's only legal
target. Remove Stray and a run that holds the token spends it on every single floor. The band moved
to match the measurement, which is the direction that rule is supposed to travel.

**Counterplay edges: floor 14 → 11.** Both powers were the graph's named answer to other mechanics,
so pulling them pulled the edges pointing at them. Re-baselined against the graph rather than
propped up; a counterplay edge to a power nobody can press was never counterplay.

**The census now reads 30 of 41 mechanics, not 30 of 45.** The four that left were Destroy, its
charge, Stray and its charge. Two of them carried UNREACHABLE exemption lines — the census's way of
recording that no code path in the game could reach them — and those lines are gone with the
mechanics. The coverage ratio improved by deleting the debt rather than covering it, which is worth
saying out loud so the number is not read as progress on instrumentation.

**Nothing moved in the cascade.** `sim:cascade`, `sim:pop` and `sim:endless` are unchanged: neither
power was reachable in a plain endless run, so neither had ever appeared in those numbers. The
absence of movement here is itself the confirmation that Destroy was dead code and Stray was a
setup-only button.

## Gen 201 — every system read back against the game that exists

Not a balance change so much as a truth pass, so the numbers below are the ones that moved and the
rest of the entry is what was found. The method: take each system in turn, read what it *claims* —
in its band, in its Codex entry, in the sentence a player reads mid-run — and check the claim
against the code that runs.

### The tools' occupancy numbers were measuring the census

Three of them read exactly `1.000 x 1.00` on every floor of every seed. That is not a measurement,
it is a construction: the setup-pass census player pressed the pin, the swap and the flash on floor
open, unconditionally, before a card had been turned. All three were then banded `core` — a claim
that the game does this on nearly every floor, which nothing had ever checked.

Each is now reached for when the board gives it the reason the tool exists for, and the share falls
where it falls:

| Tool | Reason it is now pressed | Before | After | Band |
|---|---|---|---|---|
| Pin | a miss happened; there is a seen card to hold | 1.000 (constructed) | **0.158** | core → common |
| Flash pair | a miss happened; the floor gave nothing up | 1.000 (constructed) | **0.158** | core → common |
| Tile swap | a pair's halves are dealt not touching | 1.000 (constructed) | **0.988** | core (now earned) |
| Peek | an unrevealed card exists at floor open | 1.000 | 1.000 | core (already honest) |
| Wild joker | the joker always has a partner | 1.000 | 1.000 | core (already honest) |

0.158 is the reference miss rate, and that is the right shape: the pin and the flash both answer
going wrong, so they happen about as often as going wrong. The swap staying `core` is now a fact
about the deal rather than about the script — Gen 198's separation rule is what puts a non-touching
pair on nearly every board.

The rule is written into `SYSTEM_OCCUPANCY_COUNTERS` so the next counter added has to face it: **a
counter the census presses unconditionally measures the census.**

### The in-run coaching taught a game removed twenty-five generations ago

`getFloorIdentityContract` is four sentences a player reads on the floor they are standing on. Its
seven branches named trap bounties and clean disarms, the Trap Workshop and the Rune Seal, keys and
locks and cache extraction, guard and scout value, the parasite clock, boss blockers and finding
the exit. Every one of those left with the dungeon layer, the hazards, the lives and the exits.

A floor archetype now decides exactly one thing — how the deal lays the suits out, `clumped`,
`scattered` or `two_suit` — and that is what decides how far a pop reaches. So the coaching says
that instead. A scattered floor tells you a swap is worth more there than anywhere else; a
two-suit floor tells you it is where the deepest chains of the run live; a breather tells you it is
the cheapest place to spend a charge.

The boss identity was worse than stale: it promised `+2 Favor` (a currency removed in Gen 175) and
a "Keystone Pair board anchor" that appears nowhere in the game — no field, no rule, no generator —
in a string shown in the HUD title.

Why it rotted: `FloorArchetypeId` was a bare type union, so nothing could enumerate the archetypes
at runtime and the table's tests only ever sampled five of its branches. It is now
`FLOOR_ARCHETYPE_IDS`, a list, and the test walks all 100 floor variants (eleven archetypes × three
tags × three mutator sets, plus the null fallback) asserting that no floor coaches a removed noun.

### Eleven Codex entries and four objective strings said the same kind of thing

Findables, powers, dense pickups, shifting spotlight, charges, perfect memory, recall focus, the
scholar objective and the scholar contract all still taught Destroy and Stray, one day after both
were removed. The scholar objective's copy also named three tools while its rule watched one field
— though that one turned out to be honest, because `applyTileSwap` sets `shuffleUsedThisFloor` too.

Heavy's trait line promised "costs +1 extra try but never drains peek charges". Nothing in the game
drains a peek charge on a mismatch — no trait, no mutator, no rule. The clause promised the absence
of a penalty that cannot happen, which is a way of teaching a player to fear the game wrongly.

## Gen 202 — the surfaces that talk to the player, checked the same way

Same method as Gen 201, pointed at the three systems that speak: the in-run feedback rail, the
trait interaction lanes on the card backs, and the session stats.

### Twenty-one in-run feedback branches could never fire

`gameScreenFeedback.ts` reads the *text* of a run announcement and decides what chip to show and
what to advise. That makes it rot in a way the type checker cannot see: remove the system that
produced "Guard Cache ward blocked" and the branch watching for those words still compiles, is
still tested, and is now unreachable.

Twenty-one were: guard caches and lantern wards, omen and anchor seals, loaded gateways, mimic
caches, shuffle snares, cascade/fragile/toll/fuse caches, shop gold, hazard wards, moving and
dungeon enemies, and the exit being ready. Each was a line of advice waiting to tell a player to
manage something the game does not have — "pause on the patrol path", "bank gold for shops, rests,
or route events". Checked mechanically: collect every string the shipping code can emit, and a
branch whose needle appears nowhere in that corpus cannot fire.

`gameScreenFeedbackReach.test.ts` now runs that check on every build.

### A peek charge was being drawn on the board as a combo shard

The trait interaction lane map had seven lanes. Four interactions exist. Against those four:

| Lane | Verdict |
|---|---|
| `shard` | reachable, and **wrong** — "Conduit + Echo: peek spark" matched on the word *spark*, so a payoff that hands the player a peek charge was labelled "Shard · Cash shard". Combo shards left in Gen 184. |
| `guard` | matched guard/ward/braced/shield/armor; no live interaction says any of them |
| `risk` | matched risk/danger/penalty/damage/doom; nor any of those |
| `tool`, `block`, `recall`, `score` | reachable and correct |

Three lanes gone, and the peek spark now reads "Tool · Use tool", which is what it is. The lane
colours, the marker patterns drawn on the card back, and the beat-count tiers all went with them.
The test that "proved" the dead lanes worked was feeding the grouper phrases — "Braced guard ward",
"Doom pays penalty" — that no trait has ever said; it is rebuilt on `TILE_TRAIT_INTERACTION_TAGS`.

### `pairsDestroyed` was a stat that could only ever be zero

Destroy was its only writer. It survived Gen 200 as a `SessionStats` field, a normalizer entry, and
a branch in the long-run feedback that listed "destroy pair" among the actions a player took. All
three are gone.

Also: the findable reward row carried a `destroyText` field, the Codex's `mechanic-feedback` token
called an effect "a hazard", the meta-reward copy pointed players at tables of relics, the inventory
prep hint promised rows that "update between floor decisions" for rests and shops, and the viewport
matrix reasoned about "route/shop decisions". All repointed at what ships.

## Gen 203 — the ledger, so "every system" is checkable rather than asserted

Generations 200–202 worked system by system. This records the result of that pass in a shape a test
can walk, because a claim about coverage is worth exactly what the thing checking it is worth.

`src/shared/system-refinement-ledger.ts` carries one entry per system: an id, a verdict, the
generation that last passed over it, and a note saying what was found. Forty-seven entries — the
forty-one mechanics the interaction graph models, plus six surfaces it does not (the floor coaching,
the boss identity, the trait lanes, the Codex, the audio, and the record of the removed powers).

Nineteen **changed**, twenty-seven **confirmed**, one **removed**.

`confirmed` is the verdict worth being suspicious of, so it is the one the gate constrains hardest:
every note must be a real sentence over sixty characters and must say what was checked and what the
evidence was. "Occupancy 0.512, banded common" is a finding; a tick in a box is not.

Three checks hold it up:

- every mechanic in the graph must have an entry — a new mechanic cannot ship without someone
  writing down what state it is in, because the graph will list it and the gate will fail;
- no entry may name a mechanic the graph does not have, so the ledger cannot drift into fiction;
- the verdict counts are pinned, so the pass cannot be quietly downgraded to all-confirmed later.

The ledger is printed into `docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md` by the same
generator that emits the version snapshot. A record of what state every system is in belongs where
a person will read it, not in a source file only its own gate opens.

## Gen 204 — the deal is a shuffle now, and a corner counts as touching

Two changes, one asked for and one forced by it.

### Yes, the clustering was on purpose. It went much further than intended.

`SUIT_DEAL_PROFILE_BY_ARCHETYPE` deals `clumped` on eight of eleven archetypes, and the dealer grew
each suit as a solid region — its own comment said round-robin growth "at small board sizes is
indistinguishable from a shuffle", which is exactly what it was avoiding. The reason was real: the
pop reaches through same-suit contact, and a grown region is contact by construction.

Measured against what a shuffle gives, it overshot badly:

| profile | suits | a shuffle gives | before | after |
|---|---|---|---|---|
| `clumped` (8 of 11 floors) | 4 | 0.25 | **0.569** | **0.287** |
| `scattered` | 2 | 0.50 | 0.496 | **0.463** |
| `two_suit` | 2 | 0.50 | **0.733** | **0.460** |

Biggest single-suit blob, as a share of the board: 30% → 17%, 35% → 22%, 49% → 24%.

The deal is now a uniform shuffle followed by one repair pass that cuts any connected same-suit run
over `MIX_MAX_RUN` — four cells on a four-suit board, eight on a two-suit one, because a shuffle's
runs get longer as the palette shrinks and holding a two-suit board to the four-suit cap produces a
checkerboard, which is as arranged as a blob. Every profile now sits just *under* its own chance
baseline: a shuffle with the walls knocked down, not an anti-clustered lattice.

`scattered` also stopped taking its own code path. It was a bare shuffle that skipped both the blob
repair and the Gen 198 pair-half separation, which is why 0.144 of its pairs sat touching their own
twin against 0.025 on the dealt path. One deal for every floor; the profile still decides the
palette, which is a real difference — two suits is a board where almost everything can chain, four
is a board where the route has to be found.

### The pop collapsed, and the fix was to stop charging for the word "touching"

A mixed board has far less same-suit contact, so the contact-only pop (Gen 197) nearly stopped
firing at the bottom of the ladder:

| tier | clumped board | mixed, orthogonal only | mixed + corners |
|---|---|---|---|
| none | 1.72 pairs | **0.51** | **1.52** |
| clean | 2.19 | 0.62 | **2.08** |
| sharp | 6.03 | 2.51 | **5.57** |
| fever | 8.64 | 7.28 | **7.28** |

0.51 means a match took its own pair and nothing else, on most floors, most of the time — the pop
rate fell to 0.464 overall and 0.135 on some floors.

The corner step used to be Fever's privilege. That was defensible on a board of grown regions,
where orthogonal contact was already plentiful; on a shuffled board it meant the game charged the
top rung for the *definition* of touching. Two cards meeting at a corner have no gap between them,
which is the whole rule the pop is built on, so counting them does not loosen the promise — it stops
pretending a card diagonally against the match is somewhere else. Eight neighbours instead of four,
on a board where a quarter of them share your suit, is what makes a shuffled board poppable.

The ladder still sells reach, waves and bridges. It stopped selling what "touching" means.

### What moved with it

- **Par: 0.4 → 0.45 turns per pair.** A clean player took 4.3 turns a floor on the clumped board and
  4.7 on the shuffled one, because the pairs a break takes now have to be found rather than handed
  over. Held at 0.4, the clean player came in under par on 0.862 of floors against the 0.9 that
  target means to hold. Par follows the board rather than the board being clumped back to fit par.
- **`CHAIN_RUNG_PAIRS` fever: 9 → 7.** Only the top rung moved. A mixed board has no painted region
  left for Fever to swallow whole, so its take is what its waves and bridges reach.
- **Floors run longer and score the same**: 4.7 turns against 4.3, 10543 against 10062 at a clean
  clear. More of the floor is remembered rather than collected.

## Gen 250 — B did nothing on any meta screen, and it was never a pad problem

Deck Verified's controller criterion is *"The default controller configuration must provide users
with the ability to access all content"* (`RESEARCH_NOTES_2.md` §1). The existing
`controller-navigation.spec.ts` had three tests: the focus ring moves, the ring is visible, and the
board answers a press. All three stop at the main menu and the board, so "all content" was never
checked.

Walking the five meta screens with a fake pad found B opening nothing back up. The first reading
blamed the pad — but the probe's own regex was wrong (focus labels read `IIICollectionCards and
relics`, not `Collection`), and once that was corrected the pad reached four of five and returned
from none. Isolating it by **keyboard** settled it:

```
ESC Collection: opened=true escapeReturned=false
ESC Profile:    opened=true escapeReturned=false
ESC Inventory:  opened=true escapeReturned=false
ESC Codex:      opened=true escapeReturned=false
ESC Settings:   opened=true escapeReturned=false
```

`b` maps to `back` (`shared/gamepad-input.ts`), `back` dispatches Escape
(`input/gamepadNavigation.ts`) — and not one of the five screens listened for Escape. The pad
mapping was correct the whole way down; the screens had no handler at the end of it. A player who
opened the Codex on a Deck had to hunt the on-screen Back button with the stick.

### The fix

`hooks/useEscapeLeaves.ts`, used by `MetaShell` (Collection, Profile, Codex) and by
`InventoryScreen` and `SettingsScreen`, which are not `MetaShell` — the assumption that all five
shared one frame was wrong, and wiring only `MetaShell` left Inventory and Settings still red.
It listens on `window` in the bubble phase, so `OverlayModal` and `GameScreen`'s shortcut overlay —
both `document` capture with `preventDefault` — still win, and `OverlayModal`'s own
`targetAllowsOverlayEscape` moved into the hook rather than being copied.

### What it is measured against

Six new tests in `controller-navigation.spec.ts`: one per menu screen (d-pad walk, A opens, B
returns to the menu), plus B from an in-run Codex landing back on the board rather than the main
menu. Negative control: with the hook's `active` defaulted to `false`, all six fail; with it on,
all six pass.

Two facts worth keeping:

- **The ring is spatial, not cyclic.** D-pad down stops at the bottom of the menu, so Collection
  and Play are reached by going *up*. A down-only walk reports Collection unreachable, which is how
  this test was nearly written as a bug report.
- **Two tests in that spec were already red on `main`** before any of this — the menu walk and the
  board walk — measured by stashing the change and re-running. No gate runs this spec, which is the
  same shape as Gen 242's illustration regression. Left for its own generation.

## Gen 251 — the controller spec was red on main, and it measured the machine it ran on

Gen 250 left two tests failing in `controller-navigation.spec.ts` that were already failing before
it, measured by stashing the change and re-running. Neither was a product defect. Both were the
instrument.

**The menu walk asserted a label that no longer exists.** It matched `/^play/i` against
`document.activeElement.textContent`; the menu's roman-numeral eyebrow makes that string
`IPlayBegin the descent`, so the walk never recognised Play, ran off the top of the menu, and
failed on the skip link. Focus is now asked of the element — `mainMenuPlayButton(page)` against
`document.activeElement` — because a label is copy and identity is the thing being asserted. The
same shape sank a probe during Gen 250 (`IIICollectionCards and relics` vs `^collection`); it is
worth stating once that in this menu no focus label is the word on the button.

**The board walk timed its button hold in Playwright round trips.** `pressPad` set the fake pad's
buttons in one `evaluate`, waited 120 ms, and cleared them in another. Under load the round trips
dominate: a logged run showed one "tap" of right arriving as **four** ArrowRight events —
`GAMEPAD_REPEAT_DELAY_MS` is 420 and the interval 130, so the pad was really held ~700 ms. The
board consumed the first arrow, ran out of grid on a four-pair floor, and handed the repeat back,
which walked the focus ring out of the board *exactly as designed*:

```
ArrowDown  target=tile-board-application prevented=true    <- consumed, cursor moved
ArrowDown  target=tile-board-application prevented=false   <- edge: handed back, ring left
```

The hold now happens inside the page, in one round trip, so a tap is a tap regardless of how loaded
the machine is. This is the same class as Gen 239's transient-surface artefact: a measurement whose
answer depended on the harness rather than the app.

### The gate

`gate:controller` runs `controller-navigation.spec.ts` and `deck-controller-reach.spec.ts`, and is
in `fullcheck` after `gate:illustration-regression`. Both specs existed and neither was in any
gate — the third time this session an instrument was found unwired (Gen 236 the fit contract, Gen
241/242 the illustration spec). Negative control: with one assertion in
`deck-controller-reach.spec.ts` inverted, `yarn gate:controller` exits 1 with 1 failed / 9 passed.

## Gen 252 — "all content" was a list I picked by hand, and it missed two screens

Gen 250 proved B leaves five meta screens. Five is what I chose to look at. Taking `ViewState` as
the question instead of my own list found two more views that swallow B:

```
VIEW modeSelect: still open=true  back at menu=false
VIEW gameOver:   still open=true  back at menu=false
```

Choose Your Path and the run summary. Both now call `useEscapeLeaves`, against the routes
`NAVIGATION_ROUTE_CONTRACTS` already documents — `modeSelect -> menu` and `gameOver -> menu`. On
game over the run is already finished, so back costs nothing and Play again stays a deliberate
press. Measured afterwards: both close to the menu, and a sheet open over Choose Your Path still
takes Escape first (`OverlayModal` is `document` capture, the hook is `window` bubble), so B closes
the sheet and leaves the screen behind it standing.

### The census

`controller-navigation.spec.ts` now keys its table by `ViewState`. Three views are exempt, each
with the reason in the table: `boot` is a frame before hydration, `menu` is the root, and
`playing` is the one place B is deliberately **not** a leave — a stray press must not cost a run,
so the way out is Start, and the pause menu it opens answers B itself.

Two things this cost, and both are worth keeping:

- **`Record<ViewState, ...>` does not constrain an e2e spec.** `e2e/` is not in `tsconfig.json`
  and Playwright transpiles without typechecking, so the annotation was documentation. The
  negative control was deleting the `gameOver` row and running `tsc`: clean. Completeness is now
  asserted at runtime against `VIEW_STATES`, and that check fails with `- "gameOver"` when a row
  goes missing. **Nothing typechecks the e2e suite** — a separate config finds 11 errors there,
  one of them a real latent bug (`offsetHeight` read off an `HTMLElement | SVGElement`). Its own
  generation.
- **The view list had four copies.** `contracts.ts` now exports `VIEW_STATES` and derives
  `ViewState` from it; `navigationModel`'s `NavigationSurface`, `scripts/e2e-surface-coverage.ts`
  and this spec all read that one list. A hand-copied list is a list that stops matching, and what
  these copies exist for is proving nothing was forgotten.

## Gen 253 — nothing typechecked the e2e suite, and the main menu's heading was one word

Gen 252 found this by accident: `Record<ViewState, ...>` in a spec constrained nothing, because
`e2e/` is not in `tsconfig.json` and Playwright transpiles each spec without checking types. Every
annotation in the suite was documentation. `tsconfig.e2e.json` is `tsconfig.json` plus `e2e/`, and
`typecheck:e2e` runs inside `gate:systems`.

It found 11 errors. Eight were the `/src/...` dynamic-import idiom the browser-side specs use —
those are Vite dev-server URLs, not paths, so a `paths` mapping and `allowImportingTsExtensions`
resolve them to the real modules instead of suppressing them. Resolving them immediately produced
four more: `state: 'hidden'` in a tile literal widens to `string` and is not a `TileState`. Two
were independent:

- `visualScreenHelpers.ts` read `offsetHeight` off an `HTMLElement | SVGElement`. On an SVG that is
  `undefined`, which would have written a silent hole into the HUD diagnostics rather than failing.
- `demo-readiness.spec.ts` asserted a plain function to `typeof Audio`. It works at runtime — a
  constructor returning an object yields that object — but the assertion is one TypeScript rejects
  outright. Widened through `unknown`, with the reason.

Negative control: `const negativeControl: number = page;` in a helper, and `yarn typecheck:e2e`
reports `TS2322: Type 'Page' is not assignable to type 'number'`.

### The heading nobody could hear

Running the two specs turned up `demo-readiness.spec.ts` red — and red on `main` before this
change, measured by stashing. Its assertion was `/memory dungeon/i` against the `h1`. The `h1` is:

```tsx
<h1><span>Memory</span><span>Dungeon</span></h1>
```

Its text content is `MemoryDungeon`. `.title` is a column flex container, so the words stack and
the missing space is invisible — but the accessible name is one word, and that is what a screen
reader says. The fix is a real space between the spans, which a flex container does not render and
the accessible name does carry. The test was right and had been right, unheard, for as long as it
had been failing.

`gate:demo-readiness` is now in `fullcheck` as well. Negative control: take the space back out and
the gate exits 1 with 2 failed. That is the fifth instrument this session found unwired or red —
the fit contract, the illustration spec, its gate, the controller spec, and now this.

## Gen 254 — the security gate went red, and the pins had been overtaken

A full `yarn fullcheck` stopped at its second step:

```
reaching a shipped build: 0; build-only: 39 (baseline 30)
audit gate: build-only advisories grew from 30 to 39
```

Nothing reached shipped code. But every one of the nine new groups named a version this repo's own
`resolutions` block was **pinning** — `tar 7.5.16`, `postcss 8.5.15`, `ip-address 10.1.1`,
`joi 18.2.1`, `shell-quote 1.8.4`, `baseline-browser-mapping 2.10.23`, and the `brace-expansion`
and `js-yaml` pins. Those pins were correct the day they were written. A pin is a snapshot of a
judgement, and it keeps looking deliberate long after it has been overtaken.

Bumping each to the version its own advisory names as patched, plus the three direct dev
dependencies the advisories name (`vitest 4.1.2 → 4.1.11`, `svgo ^4.0.1 → ^4.1.0`,
`electron-builder 26.8.1 → 26.15.0`), took **39 → 9**.

The nine that remain are all `brace-expansion`, on three incompatible major lines that different
build tools require: `^1` under eslint's pinned `minimatch 3.1.5`, `^2` under depcheck and jake's
`filelist`, `^5` under rimraf's `glob` and `@electron/universal`. A yarn resolution names a path,
not a range, so a single `**/brace-expansion` pin would force one major on all three. The
path-specific pins that can be written are already there and took — the lock shows 1.1.18, 2.1.4
and 5.0.9 resolved — and what is left is reached through stale transitive range entries under
those three parents. Each is a denial-of-service on crafted input in a tool that runs on a
developer's machine. Bumping `minimatch` at those three parents should take it to zero.

**The baseline is ratcheted to 9**, per the rule written above it — lower it whenever a bump clears
some. Negative control: set it to 8 and the gate reports `build-only advisories grew from 8 to 9`.

That baseline had sat at 30 since Gen 8, when 64 advisories had accumulated behind a red light
nobody looked at. The number has been a ceiling nobody pushed down since. It is 9 now.

### And `gate:package-hygiene` was red too, behind a message that said otherwise

With the advisories cleared the sweep moved on and stopped at the next gate:

```
depcheck failed to run or returned invalid JSON.
```

depcheck ran fine. It exits non-zero when it **finds** something, `execFileSync` raises that as an
error, and `check-depcheck-clean.mjs` caught the throw, printed "failed to run", and dropped the
report depcheck had already written to stdout. The wrapper now reads the JSON off the thrown error,
so a finding is printed as a finding and only a genuinely unparsable run is called a failure.
Negative control: add an unused devDependency and the gate prints `"devDependencies": ["left-pad"]`
rather than a diagnostic about the tool.

Behind it: `graphology` and `graphology-types`, declared and imported nowhere — the only two
mentions in the repository are the package.json lines themselves. Measured at HEAD by stashing, so
this predates today's work; `fullcheck`'s third step has been red for as long as they have been
there. Removed.

One of the nine advisories was mine: `yarn upgrade brace-expansion` on a package this project does
not depend on ADDED it to `dependencies`, and depcheck caught it on the next run. A tool that tells
you what you just did wrong is worth more than the ten minutes it cost.

## Gen 255 — the repo model treated two generated files as inputs

`fullcheck` got past security and hygiene and stopped at `gate:systems`:

```
Error: .ai/repo-model.json is stale. Run yarn ai:model.
```

The whole drift was two sha256 entries: `project-media/capture.json` and `project.meta.json`. Both
are **outputs** — `scripts/capture-project-shots.mjs` and `scripts/generate-project-meta.mjs` write
them and `.github/workflows/project-meta-refresh.yml` commits the result back on a schedule. The
last three `[meta-bot]` commits touched those two paths and nothing else, so **every scheduled bot
run leaves `gate:systems` red on `main`** until a person happens to regenerate.

`GENERATED_PATHS` in `ai-repo-model.mjs` already existed for exactly this, holding one entry: the
model itself, excluded because the model cannot be part of what proves the model current. The same
argument covers these two, one step removed. Checked before excluding — nothing under either path
is imported, so no edge in the graph passes through them; an exclusion that hides a real dependency
would be worse than the churn it removes.

Both controls run. Positive: edit `project.meta.json` and `ai:model --check` stays green. Negative:
append a line to `src/shared/contracts.ts` and it reports stale, which is the half that matters.

## Gen 256 — the controller row was proved by something that could not prove it

The release checklist carries *"Every screen is reachable on a controller, not just the board"*,
owner `repo`, and repo rows are re-proved against live modules. This is what proved it:

```ts
expect(actions).toContain('confirm');
expect(actions).toContain('up');
expect(GAMEPAD_STICK_DEADZONE).toBeGreaterThan(0);
```

Three true facts about a pure function that never sees a screen. The row read `done` through the
entire period when B opened nothing back up on seven views — because the mapping was never what
was broken, and nothing here could have noticed.

`src/shared/controller-back-contract.ts` now holds the claim as a row per `ViewState`: where B
lands, or the reason it is deliberately not a leave. Two readers, which is the point. The checklist
verifier asserts the table covers every view, that no row claims an exemption without saying why,
that more than half the views actually leave (a table where nothing leaves would satisfy the first
two and mean nothing), and that every leave names a view that exists — plus `b → back`, the first
link, which the old verifier never checked either. `controller-navigation.spec.ts` reads the same
table and drives a real pad at the real screens, and asserts every view the contract says answers
back has an arrival here, so a row cannot be added and left unexercised.

Negative controls, both run: make one view exempt without a reason and the checklist fails with
`a view claims no back path and gives no reason: [ 'codex' ]`; point a leave at a view that does
not exist and it fails with `profile leaves to a view that does not exist`.

The row's evidence moved from `gamepad-input.ts` to the contract. `evidence` is only checked for
non-emptiness, so it is a pointer for a reader rather than a constraint — worth knowing when
reading any other row on that list.

### Two things the new contract's own gates caught

`audit:shared-reach` refused `controller-back-contract.ts` as a shared module no shipping entry
point reaches — correctly, since only the checklist test and the e2e spec import it. It is exempt
by name in the "records and contract tables whose consumer is a test" section, beside
`release-checklist.ts` itself, with the reason spelled out: the screens already know their own back
target through the store, and making them look it up would add indirection without adding truth.
What the table buys is that the claim and the behaviour are one list.

`audit:generation-claims` then reported `no file named .ai/repo-model.json` about a file sitting
right there and tracked in git. `.ai` is in the auditor's `SKIPPED_DIRECTORIES` — not reading three
megabytes of generated JSON is sensible, but the skip also removed those paths from the set a claim
resolves against, so **no comment anywhere could name the repo model**. Found by writing the first
one that ever did. The auditor now resolves against those paths while still not scanning them, with
existence checked on disk rather than assumed. Negative control: point the same sentence at
`.ai/no-such-model.json` and it reports `no file named .ai/no-such-model.json`.

## Gen 257 — #250 closed: the box never contained its own read

The task said the chain rail is drawn over the floor-clear beat at 1.1. Gen 240 measured that and
refuted both proposed fixes, then stopped rather than guess. What it could not know is that the
scale it measured at stopped being reachable one generation earlier: **Gen 238 brought the cap down
to 1.05.** Re-measured on a 1280x800 Deck panel, fresh arrival per scale:

| scale | read ends | beat title starts | clearance |
|---|---|---|---|
| 1.0 | 408 | 445 | 37px |
| 1.025 | 408 | 429 | 21px |
| **1.05 (cap)** | **408** | **414** | **6px** |

So the reported collision is unreachable — and six px is not clearance, it is a coincidence that
survived a cap change.

### The defect underneath, which is what the task was really about

`.chain` declared `width: 13rem` (64..272) while `.chainRead` sits at `left: 7rem` with
`white-space: nowrap` and runs 14.5rem wide, so the column painted to **408** and the declared box
stopped at **272**. 136 layout px of content outside its own container. The comment above it said,
in these words, *"it is as wide as its rung labels … and nothing spills past it"* — a record
contradicting shipped behaviour, the fourth this session. Anything positioned against that box got
a number wrong by 136px, which is exactly what made the beat's inset look safe: the beat clears
272 and meets a read that ends at 408.

The design decision Gen 240 asked for: **the left column is the ladder plus its read, 21.5rem.**
The 13rem was only ever describing the ladder. So `.chain` is the column, `--ladder-w: 13rem` pins
the ladder to its own width rather than inheriting the container's, and the comment now says what
is true. Measured after: box 64..408, read 176..408, title unmoved at all three scales — **nothing
a player sees moved.**

Widening a box that had `pointer-events: auto` would have put 136px of invisible target over the
board, so the box gives them up and `.chainRead` takes them; the only thing in the column a pointer
wants is the depth line's `title`. The surface that eats clicks got *smaller*, and
`demo-readiness`, `deck-controller-reach` and `board-3d-value` all still flip tiles.

### The check, and two ways I got it wrong first

`gameplay-chrome-clearance.spec.ts` (in `gate:ui-fit`) now holds the pair apart at every scale
`SETTINGS_NUMERIC_RANGES` allows, and requires the box to contain its read. Its negative control is
the scale this task started at — 1.1 is forced directly, past the cap, and must report the overlap:

```
BEAT x0.8:  title clears read by 196.54px, box spill -0.27px
BEAT x1:    title clears read by  36.31px, box spill -0.48px
BEAT x1.05: title clears read by   6.01px, box spill -0.33px
BEAT control x1.1: title clears read by -21.75px
```

−21.75 against Gen 240's measured 21px. Two mistakes on the way there, both already recorded
lessons of this session: the first version opened the fixture once and re-zoomed, and the beat is a
**transient surface** — it reported `surfaces missing` at two of three scales (Gen 239's artefact,
same screen). And the first version returned `Math.min` of the two margins, which passed while
printing `-0.33px` at every scale because the containment term always won: the log said nothing
about the 37 / 21 / 6 series the test is named for. A check that cannot be read is a check nobody
will read.

## Gen 258 — the dock declared a toolbar and wired none of it

Three of the 106 test-only exports live in `a11y/toolbarRoving.ts`. Asking the Gen 245 question of
them found the fourth kind of answer again: not debt, **live behaviour missing its wiring.**

The game ships exactly one `role="toolbar"` — the in-run action dock — and the WAI-ARIA toolbar
pattern is one tab stop for the toolbar with arrow keys between its controls. The module implements
all of it, with tests. The dock wired none of it. The only live import was
`acquireToolbarRovingPause`, which pauses roving that was never running.

Measured in a real run, before:

```
DOCK fresh:  tabIndices [0,0,0,0,0,0,0,0,0]
DOCK arrow:  "Shuffle hidden tiles" -> "Shuffle hidden tiles"
DOCK after a modal opened and closed: [-1,0,-1,-1,-1,-1,0,0,-1]
```

Arrow keys did nothing, and the tab order *changed shape* after any modal — because
`acquireToolbarRovingPause` releases by calling `applyToolbarTabIndices`, which **installs** the
roving indices it is meant to be restoring. A screen reader announced "toolbar, Game controls" and
then the thing behaved like a plain row of buttons.

After wiring `handleHorizontalToolbarKeyDown` and the tab-index sync: one tab stop on arrival,
arrows and Home/End move, zero tab stops behind a modal, one again after.

### Two things I got wrong on the way, both caught by measuring

**"Nine tab stops" was my own unsupported claim.** All nine buttons carried `tabIndex 0`, but a
disabled button is not tabbable whatever its tabindex, and the dock disables a tool whose charges
are spent. The probe was changed to count `!disabled && tabIndex >= 0` rather than read tabindex
values, which is the difference between a number and the thing it stands for.

**Keying the sync on the visible tool ids was not enough.** With that, the dock held **four** tab
stops on arrival and fell to one only after a modal. A spent tool stays mounted and goes `disabled`,
so the id list never changed while the set roving applies to did — `getToolbarButtons` skips
disabled buttons, and the ones it skipped kept React's `tabIndex 0`. The sync runs every render now,
passing the current stop back in so a player arrowing along the dock is not yanked to the first tool
by the next score tick.

### What resolved, and what went

`handleHorizontalToolbarKeyDown` is now live. `handleVerticalToolbarKeyDown` and
`syncVerticalToolbarTabIndices` are **deleted**: no vertical toolbar ships, and the second was a
pass-through to `syncToolbarTabIndices` with no behaviour of its own. `handleToolbarKeyDown` takes
its keys as an argument, so a vertical toolbar is three lines away on the day one exists.

Baseline **106 → 103**. Gated in `controller-navigation.spec.ts` (`gate:controller`), in a browser
rather than beside the module, because the module was always right — what was missing was that
anything used it. Two negative controls, both run: drop the `onKeyDown` and it reports
`ArrowRight left focus on "Shuffle hidden tiles"`; drop the sync and it reports `the toolbar is more
than one tab stop`.

### Gen 258, continued: the next five, and none were debt either

**`breakpoints.ts` — superseded, and by something better.** `safeSubscribeWindowResize` and
`readWindowInnerSizeFallback` read `window.innerWidth` and listened to `resize` alone.
`hooks/useViewportSize.ts`, which the app actually uses, prefers `window.visualViewport`, coalesces
through `requestAnimationFrame`, and listens for `orientationchange` and the visual viewport's own
resize as well. On a Deck or a phone the visual viewport is the one that moves — the layout viewport
does not shrink for an on-screen keyboard — so these two read the wrong number, which is the same
mistake this session found three times in painted-versus-layout px. One of their comments said to
*prefer* it over `window.innerWidth`: advice pointing at the weaker option. **Deleted**, with their
tests. Their SSR default of 1280x800 did match `useViewportSize`; that part was true.

**`getAudioCoverageRows` — a pass-through, again.** It returned the exported
`AUDIO_INTERACTION_COVERAGE` unchanged, another suite already reads that constant directly, and the
only thing ever asserted about the accessor was `expect(getAudioCoverageRows()).toBe(
AUDIO_INTERACTION_COVERAGE)` — a test that the identity function is the identity. Second one of these
in this generation, after `syncVerticalToolbarTabIndices`. **Deleted.**

**Three are records whose consumer is a test because the test IS the check** — the
`getNavigationRouteContract` category, exempt by name with the reason:
`audioCoverageRowsByDomain` (REG-037 checks every gameplay row's mix role, cooldown policy,
semantic moment and callsite one by one, and the domain filter is what that reads);
`getModePosterArtRows` and `modePosterHasCustomArt` (REG-013 asserts every mode in
`RUN_MODE_CATALOG` has custom poster art rather than the shared fallback, and that every row
resolves to a non-empty asset URL — content completeness).

**Baseline 106 → 97** across nine entries: three wired live, three deleted (two pass-throughs and a
superseded pair), three named as records. Still **not one plain debt entry** in fourteen resolved
across Gens 245 and 258. Whatever that baseline is, it is not a list of things nobody needs.

## Gen 259 — par knew how big a board was and not how wide its palette was

`gate:difficulty-curve` prints a `suits` column beside every floor's turns and its par, and it had
been printing a sawtooth for as long as the column existed. Floors 7, 9 and 12 drop to two suits
between three- and four-suit neighbours, and those were the floors coming in furthest under par.
Grouped by palette across all fifty-two floors:

```
suits  floors  mean of-par
    2      16       0.496
    3       6       0.682
    4      30       0.712
```

A clean player spent **half** a two-suit floor's allowance and three quarters of a four-suit floor's.
That is sixteen of fifty-two floors — the floor-end efficiency bonus and the within-par objective a
formality on nearly a third of the game and a real target on the rest, decided by which archetype the
schedule happened to draw. Relief landing where the seed puts it rather than where `breather` puts it.

**The two suits are not the bug.** `SCATTERED_SUIT_CEILING` holds every scattered and spotlight floor
to two however big its board, and that is measured: Gen 191 found a third suit halves a scattered
floor's pop rate, 0.7 of matches to 0.36. What was wrong is that par did not know. `floor-par.ts`'s
own doctrine, written at Gen 211, is *"par follows the pop, because the pop is what makes par
achievable and its help is not flat"* — and Gen 211 made it follow the pop for board **size** only.
Palette width was the same rule, unwritten.

### The first model was wrong, and the controlled deal is what said so

Grouping live floors by palette confounds the palette with the archetype that chose it. Read that
way, a two-suit board's turns per pair looked **flat** as the board grew (0.318 / 0.328 / 0.334 over
the 12-15, 16-19 and 20-24 pair buckets) while a four-suit board's climbed (0.424 / 0.488 / 0.533) —
which reads as `PAR_RATE_RISE_PER_PAIR` starting later on a narrow palette, and that is what this
generation first shipped into the file.

The controlled measurement refuted it. One board per seed, built from a single archetype with no
mutators, its suits **re-dealt** at two, three and four — twenty-four seeds, eight board sizes,
nothing moving but the palette. Turns per pair as a fraction of the same board's four-suit cost:

```
pairs      12     13     14     16     17     19     22     24    mean
two        0.736  0.766  0.711  0.820  0.728  0.688  0.733  0.727  0.739
three      0.943  0.873  0.855  1.093  0.937  0.952  1.106  0.948  0.963
```

The discount is a **constant fraction of the rate at every board size**: a two-suit board's cost per
pair rises with the board exactly as steeply as a four-suit board's (0.358 → 0.412 across 12 → 24
pairs against 0.486 → 0.566). So it is a factor on the whole rate, not a later start to the rise. The
"flat" reading was the archetype, not the palette.

And **three suits and four are the same board** — 0.963, with three of eight sizes above one. Which
is what `tile-suit-rules.ts` already said in words: a clumped floor gives each suit one region, so a
third and a fourth suit cost the break almost nothing, and it is the step down to two, where one suit
holds half the board, that changes the pop. So `PAR_NARROW_PALETTE_RATE_FACTOR = 0.74` applies at
`SCATTERED_SUIT_CEILING` or below and nowhere else, and **every clumped floor's par is unchanged to
the turn**.

### Two things this shook out that were nobody's plan

**Par could fall as the board grew.** `PAR_OPENING_ALLOWANCE` is a step *down* at the largest board
the opening deals, sitting on top of a rate rather than inside it. At the full palette the rate's own
growth across that step happens to cover it — which is why `floor-par.test.ts` asserts that step
rather than assuming it. Scaled by 0.74 it no longer does: an eleven-pair two-suit board came out at
six turns and a twelve-pair one at **five**, so a player crossing floor 6 to floor 7 on scattered
floors would have been handed a smaller allowance for a bigger board. Par now takes the larger of its
own reading and the reading at the last board the allowance covers. The new test found this, not a
player.

**`suitCountForPairs` is the wrong default.** It reads a six-pair board as two suits where the deal
gives it three, so defaulting the new parameter to it cut floor 2's par from five turns to four in
silence. The default is the full palette — the board every rate in the file was calibrated against —
and a test now walks every pair count asserting the no-palette call is identical to the four-suit one.

### After

```
suits  n     mean   median   p90    max   over-par share
    2  640    0.630    0.571  0.923  1.667           0.055
    3  240    0.658    0.600  1.000  1.571           0.037
    4 1200    0.731    0.727  1.000  1.714           0.055
```

0.494 → **0.630** on the narrow floors, against 0.658 at three suits: the palette-attributable gap is
closed, and what is left is board size (three-suit boards are small boards, where the flat allowances
are a bigger share of par). Over-par share was 0.019 / 0.037 / 0.055 and is now 0.055 / 0.037 / 0.055
— the same demand at every palette, which is the property, rather than a number that looked right.
In the curve's printed table floor 7 goes 0.471 → 0.550, floor 9 0.586 → 0.683, floor 12 0.613 →
0.817; the spread across all fifty-two floors narrows from 0.372-0.857 to 0.500-0.857.

### The band, with its control run

Every band in `CURVE_BANDS` reads the curve along the floor number. None read it across the palette,
which is exactly where it was bent — so `maxPaletteParGap: 0.12`, the largest allowed gap between the
mean of-par of the narrow floors and the wide ones. Measured after: 0.638 against 0.707, a gap of
**0.069**. Negative control, run: `PAR_NARROW_PALETTE_RATE_FACTOR` back to 1 and `yarn sim:curve
--check` fails with *"16 floors of 2 suits or fewer spend a mean 0.496 of their par against 36 wider
floors' 0.707, a gap of 0.211 over 0.12"* — the pre-change numbers, to three places.

The curve sim also stopped reading par off the floor number. It computes `parTurnsForBoard(run.board)`
per seed and means it, because two seeds can deal the same floor different archetypes and a par read
from `pairsForFloor` cannot see the palette it is judging.

### What moved downstream, and what the repo's own records made me say

Five call sites now read par off the board instead of off a pair count: the within-par objective and
its projection, the floor-clear bonus, the cascade sim's sample, and the last-turn achievement (via
`turnCeilingForRun`). The turn ceiling is three times par, so it follows the palette without being
read separately.

`system-refinement-ledger.test.ts` then went red: the ledger's note for `objective.featured_streak`
quoted **0.829** of a run's floors clearing their featured objective and the census now reads
**0.821**. That is the change working — the within-par objective is a target on scattered floors now
— but the note said otherwise, and the test that compares a quoted figure to what the census would
print today is the reason it could not be left saying it.

## Gen 260 — the floor whose job is a rest was the tightest floor of the five roles

Gen 259 left an archetype table on screen that I had not read across: eleven archetypes, and
`pressureRoleForArchetype` sorts them into five pacing jobs — baseline, pressure, reward, recovery,
mystery. `sim:curve` reads the curve along the floor number, `sim:cascade` reads it over all floors.
Neither reads it by archetype, so nothing in this repository had ever checked whether those five roles
describe anything a player experiences.

### The first reading was wrong, and for the same reason as last time

Grouping *live* floors by archetype said the breather was among the tightest floors in the game
(0.742 of its par against `survey_hall`'s 0.674). That is a confound, not a finding: turns-against-par
rises with board size and no two archetypes sit on the same floors, so an archetype that lands
shallow looks generous and one that lands deep looks tight. Full runs with the magpie as the only
thing moving said the opposite — breather 0.701, baseline 0.720 — and the schedule's own comment about
the bird turned out approximately honest: it fires on 0.31 of the floors it rides and costs 0.016 of
par. Two mutators I suspected of being inert are measured in other currencies entirely: `wide_recall`
costs five score a match and `short_memorize` shortens the memorize window, neither of which is a turn.

### The controlled reading

One board per floor and seed, no mutators, the archetype id swapped and everything else held — floor,
seed, pair count, objective. Thirty seeds, floors 18/22/30/42:

```
treasure_gallery 0.795   parasite_tithe 0.780   breather 0.778   shadow_read 0.775
anchor_chain     0.769   script_room    0.767   survey_hall 0.758
trap_hall        0.727   spotlight_hunt 0.716   rush_recall 0.711   speed_trial 0.697
```

Every clumped archetype between 0.758 and 0.795. Every narrow-palette one between 0.697 and 0.727.
The split falls exactly on `SUIT_DEAL_PROFILE_BY_ARCHETYPE` and nowhere near the archetype id. **The
archetype is a label; its suit-deal profile is the whole of its difficulty.** That is worth saying
plainly rather than dressing up: eleven archetypes, five declared roles, one lever with two settings.

Read by role, the cycle's pacing was upside down:

```
recovery 0.778    reward 0.795    mystery 0.767    baseline 0.758    pressure 0.739
```

The floor whose job is to let a run heal spent **more** of its allowance than the average floor whose
job is to press — because the narrow palette, which Gen 259 established is the looser board against
its own par, had been handed out to `pressure` archetypes only, and the recovery floor was left on the
wide one.

### The fix is the deal its own hint already asked for

The breather's hint is *"A calmer floor to steady the board and rebuild the chain"* and its risk
profile is *"Lower pressure"*. Two suits is what that describes: one suit over half the board means
almost every match touches its own kind, the pop reaches far, and a broken chain is cheap to rebuild.
Measured, the floor goes from 0.743 of its par to **0.682** and from 0.498 turns per pair to 0.348 —
below the pressure mean of 0.729 and below the baseline's 0.798. Its copy said the opposite ("deals
the full palette, which makes it the cheapest place to spend a peek or a flash") and now says what it
does.

`gate:archetype-pressure` is the instrument, in `gate:systems`. It bands the one claim the catalog
makes out loud — the recovery floor may not cost more of its par than the average pressure floor — and
deliberately does **not** band the archetypes against each other, because they are within noise of one
another and a band there would be inventing a structure the game does not have. It reads its roles
from `pressureRoleForArchetype` rather than keeping a copy, since a gate holding its own private role
map could not check whether the schedule's roles mean anything. Negative control, run: breather back to
`clumped` and it fails with *"the recovery floor is not a rest: breather spends 0.797 of its par
against the 7 pressure archetypes' 0.729"*.

### What four more narrow floors a cycle moved downstream

Everything here is the same mechanism seen from a different counter, and every one of these was a red
test rather than something I went looking for:

- **The meter was understating Fever.** `CHAIN_RUNG_PAIRS` promised seven pairs; re-measured by
  `sim:pop` a Fever break now takes 7.70, past `CHAIN_RUNG_PAIRS_TOLERANCE`. A narrow palette puts one
  suit in bigger clumps, so a break that takes the clump takes more with it. The meter says eight now.
- **Fever reaches fewer floors**, 0.246 → 0.217, because a two-suit floor ends sooner and a shorter
  floor has less room to build a chain. Still far above the 10% bar Gen 152 set.
- **The drop takes a severed suit on 0.854 of floors**, from 0.871: a narrow palette leaves fewer
  suits to sever.
- **Turn resolution 4.95 → 4.80 a floor.** Par follows it, so this is the shorter floor rather than a
  looser one.
- **Nine trait, power and hazard shares moved** by a few thousandths each, all in the ledger's prose,
  all caught by the test that compares a quoted figure to what the census prints today.
- **The magpie got rarer**, 0.013 → 0.008 of floors: the breather it rides ends in fewer turns, so the
  bird's every-third-miss trigger lands on it less often. Both occupancy gates still pass and the run
  census still bands it, but this is the one cost of the change rather than a benefit of it — a thief
  is not relief, and the nest is now the wrong floor. Left as a task rather than folded in here.

## Gen 261 — the record of "every system refined" was forty-eight verdicts about a game that had moved

`system-refinement-ledger.ts` is this repository's own answer to "is the whole game refined?" — a
verdict per system, gated so a new mechanic cannot ship without someone writing down what state it is
in. It also carries the rule that condemns it when it goes stale, written at Gen 213:

> *"An entry written before any of that is not evidence about this game; it is evidence about a game
> that used to be here, indistinguishable from the real thing by reading."*

By its own rule it was due. **Forty-six of the forty-eight entries still said Gen 213.** Since then par
gave the opening a turn (220), stopped being one rate for every palette and started being read off the
board rather than the floor number (259), the recovery floor's deal changed (260), and the in-run
chrome was rebuilt three times (239, 240, 257, 258). The gate passed the whole time, because all it
ever asked was whether the stamp was at or after the constant — and the constant had not moved. A bar
nothing has ever failed is a bar nobody has checked, and this was the bar checking the claim that
everything else had been checked.

### What the walk re-ran rather than re-read

The gate re-checks two kinds of evidence on every run — a census counter's live share, and `gone`/
`present` tokens grepped against real source — so those forty-eight claims were already true. What is
**not** re-checked is every other number in the prose, and that is where the staleness was. So:

```
softlock sweep        430/430 playable, 0 fairness issues, every seed
endless health        430 sampled floors, 0 issue floors, 997 trait floors, 0 dead
core replay           384 steps, replayDeterministic true, 0 invariant violations
run census            peek 0.908, shuffle 0.196, wildMatch 0.042, flashPair 0.042,
                      undo 0.483, gambit 0.563, pin 0.212, magpie 0.008
sampled audio         11 manifest keys
mutator ids           10
singleton pair keys   1 (`__wild__`)
```

The first three had last been run against the boards of Gen 205 and the par of Gen 211. This is the
first time any of them has been checked since par stopped being one rate for every palette.

### What it found wrong

**Three floor-identity surfaces named a palette the board does not deal.** The keystone floor told
every player *"two suits, long chains"* — true of `trap_hall`, `rush_recall` and `spotlight_hunt`, and
false of `treasure_gallery`, which the position-nine rotation also tags boss and which deals **four**.
One boss floor in three, wrong in three sentences at once. The boss mechanics list asserted
`'Scattered suit deal: short chains, many small pops.'` for every boss floor regardless of archetype.
And both had the physics backwards: scattered means `SCATTERED_SUIT_CEILING`, which is two suits, and
two suits is the **widest** reach a pop gets — 0.74 of a four-suit board's turns per pair (Gen 259).
This file's own narrow-palette branch said so correctly, three lines away from the branch saying the
opposite about the same board.

**And one of them was mine, from last generation.** The new gate's first run failed on
`survey_hall/breather`, because the `breather` *tag* is not the `breather` *archetype*: the cycle tags
floors 3 and 10 breather and gives both `treasure_gallery`. Gen 260 rewrote that block for the
archetype's new two-suit deal and so told two four-suit floors they dealt two — and left the clear
line beside it still saying "Four suits", contradicting the two sentences above it. I changed two of
three strings and did not read the third. Every palette sentence reads `floorPaletteRead` now, and
`boss-encounters.test.ts` walks all eleven archetypes against the board each one actually deals, in
both directions, with both branches asserted non-empty so neither goes untested.

**Five numbers in the prose had drifted.** `power.undo_resolve` quoted a miss-rate ceiling of 0.483
where the census reads 0.471 — so the margin it describes as comfortable is 0.004, not 0.016, and undo
now sits within a rounding step of the rate that bounds it. `power.pin` called 0.158 "the reference
miss rate"; the miss rate is 0.471. `feedback.gameplay_hud` stopped at Gen 212 and so said nothing
about the most-changed surface in the game.

### The stamp

All forty-eight entries stamped Gen 261 and `SYSTEM_REFINEMENT_SWEEP_GENERATION` raised to match.
Negative control, run: put `power.pin` back to 213 and the gate fails with *"entries predating Gen
261: expected [ 'power.pin' ] to deeply equal []"*. The constant is what makes the claim cost
something, and it should be raised again the next time par, the deal or the chrome moves — which, on
this session's evidence, is roughly every twenty generations.
