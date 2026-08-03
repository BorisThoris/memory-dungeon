# Gameplay mechanics — full catalog

**Purpose:** Single checklist of **every** rule-level mechanic and player action, mapped to code. Use this to verify nothing is missing from epics or future design docs.

**Maintenance:** Hand-edited (not generated from source). When simulation rules change, update the relevant rows; align player-facing blurbs with `src/shared/mechanics-encyclopedia.ts` where applicable.

**Machine snapshot:** [`GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md`](./GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md) — regenerated with `yarn docs:mechanics-appendix` (rule versions, catalog entry counts).

**Scope:** Game rules (`src/shared/game.ts`), run shape (`src/shared/contracts.ts`), player/store actions (`src/renderer/store/useAppStore.ts`), assists that affect play (`Settings`, `pairProximityHint.ts`).  
**Out of scope here:** Pure layout/CSS, Electron shell, Steam plumbing (except achievement unlock hook).

**Legend:** **Sim** = `game.ts` or contracts; **Store** = `useAppStore`; **UI** = renderer; **Set** = settings/save.

---

## 1. Run lifecycle & session flow

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Run statuses: memorize → playing → resolving → (levelComplete \| gameOver) + paused | `RunStatus`, `RunState` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Memorize phase duration | `getMemorizeDuration`, `getMemorizeDurationForRun` | [epic-lives-and-pressure](./epic-lives-and-pressure.md), [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Finish memorize → playing | `finishMemorizePhase` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Resolve timer after 2+ flips | `computeFlipResolveDelayMs`, `timerState.resolveRemainingMs` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Pause / resume (timers) | `pauseRun`, `resumeRun` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Level complete → advance or relic offer | `openRelicOffer`, `completeRelicPickAndAdvance`, `advanceToNextLevel` | [epic-relics](./epic-relics.md), [epic-run-session-flow](./epic-run-session-flow.md) |
| Route choice → side room → next board plan | `applyRouteChoiceOutcome`, `openRouteSideRoom`, `claimRouteSideRoomPrimary`, `skipRouteSideRoom`, `pendingRouteCardPlan` | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Game over / summary | `createRunSummary`, store `applyResolvedRun` | [epic-meta-progression](./epic-meta-progression.md) |
| Restart / end run | `restartRun`, `endRun` | [epic-modes-and-runs](./epic-modes-and-runs.md), [epic-run-session-flow](./epic-run-session-flow.md) |
| Gauntlet expiry | `isGauntletExpired`, `gauntletDeadlineMs` | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Debug peek (face reveal) | `enableDebugPeek`, `disableDebugPeek`, `debugRevealRemainingMs` | [epic-run-session-flow](./epic-run-session-flow.md) |

---

## 2. Board & tiles

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Board build (procedural) | `buildBoard` (internal `createTiles`), `BuildBoardOptions` | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Fixed puzzle boards | `buildBoard` + `fixedTiles`, `createPuzzleRun` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Grid geometry | `BoardState.columns`, `rows`, `tiles` | core |
| Tile states: hidden, flipped, matched, removed | `TileState` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Flip queue | `flippedTileIds` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Flip action | `flipTile` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Sticky fingers block index | `stickyBlockIndex` + flip guard | [epic-mutators](./epic-mutators.md) |
| Board complete check | `isBoardComplete`, `countFullyHiddenPairs` | Sim |
| Pair proximity hint (Manhattan) | `getPairProximityGridDistance` | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Focus dim set (assist) | `computeFocusDimmedTileIds` in `focusDimmedTileIds.ts` | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Route-world profile and route cards | `deriveRouteWorldProfile`, `assignRouteWorldSpecials`, Guard Cache / Lantern Ward / route reward specials, `BoardState.routeWorldProfile`, `Tile.routeCardKind`, `Tile.routeSpecialKind` | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Boss/elite route anchors | `keystone_pair`, `elite_cache`, `final_ward`, `omen_seal` route specials | [epic-route-world-pipeline](./epic-route-world-pipeline.md), [boss-encounters](../../src/shared/boss-encounters.ts) |
| Hazard tiles | `Tile.tileHazardKind`, `assignHazardTilesToGeneratedBoard`, `src/shared/hazard-tiles.ts` | [hazard-tile-matrix](./hazard-tile-matrix.md), theory `PSB-006` |

---

## 3. Matching & resolution

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Pair match predicate (incl. wild/decoy rules) | `tilesArePairMatch` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Two-/three-flip resolution | `board.turn_resolve` via `resolveBoardTurnThroughGameplayCore`; legacy `resolveBoardTurn` remains a compatibility export | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Gambit three-flip resolution | `resolveGambitThree` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Wild pair key | `WILD_PAIR_KEY`, `wildMatchesRemaining` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Wild tile id (HUD / export) | `wildTileId`; discovery helper `getWildTileIdFromBoard` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Glass / decoy | `boardHasGlassDecoy`, `DECOY` handling | [epic-mutators](./epic-mutators.md), core |
| Shifting spotlight scoring + rotation | `shiftingSpotlightMatchDelta`, `withRotatedShiftingSpotlight` | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Cursed pair early match flag | `cursedMatchedEarlyThisFloor` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Findables on match | `findableKind`, `findablesClaimedThisFloor` | [epic-mutators](./epic-mutators.md) |
| Route rewards on match | `getRouteCardReward`, Guard Cache ward banking, Lantern/Omen scout reveals, Mimic Cache controlled/blind claim branches, route special cleanup in match resolution | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Hazard tile resolution | `applyShuffleSnareHazard`, `applyCascadeCacheHazard`, Guard Cache ward block, mirror decoy handling, floor trigger counters | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| N-back anchor counter / key | `nBackMatchCounter`, `nBackAnchorPairKey` | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Encore pair keys (spaced bonus) | `matchedPairKeysThisRun`, `encorePairKeysLastRun` | [epic-scoring-objectives](./epic-scoring-objectives.md) |

---

## 4. Scoring & ratings

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Per-match score | `calculateMatchScore`, streak, `matchScoreMultiplier` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Presentation mutator flat penalty | `getPresentationMutatorMatchPenalty` | [epic-mutators](./epic-mutators.md) |
| Level clear bonus / perfect / boss multiplier | `finalizeLevel` (internal; invoked from resolution paths) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Objective tags (scholar, glass, cursed last, flip par, boss) | `finalizeLevel` (internal) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Rating letter | `calculateRating` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Shuffle score tax | `shuffleScoreTaxActive`, multiplier decay | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |

---

## 5. Lives, mistakes & pressure

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Lives loss / guard / combo shards / chain heal | mismatch + match paths in `resolveTwoFlippedTiles` / gambit | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Contract max mismatches → game over | `activeContract.maxMismatches` | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| Score parasite floors / ward | `parasiteFloors`, `parasiteWardRemaining` | [epic-lives-and-pressure](./epic-lives-and-pressure.md), [epic-relics](./epic-relics.md) |
| Echo feedback (resolve delay) | `echoFeedbackEnabled`, `computeFlipResolveDelayMs` | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Resolve delay multiplier | `resolveDelayMultiplier` (from settings at run start) | Settings + [epic-lives-and-pressure](./epic-lives-and-pressure.md) |

---

## 6. Powers & charges (sim + store)

| Mechanic | Sim | Store | Epic |
|-----------|-----|-------|------|
| Full shuffle | `applyShuffle`, `canShuffleBoard` | `shuffleBoard` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Weaker shuffle mode | `weakerShuffleMode` on run | from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Shuffle charges / nonce | `shuffleCharges`, `shuffleNonce` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Free shuffle per floor (relic) | `freeShuffleThisFloor` | — | [epic-relics](./epic-relics.md) |
| Scholar: shuffle used flag | `shuffleUsedThisFloor` | — | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Region shuffle | `canRegionShuffle`, `canRegionShuffleRow`, legacy `armRegionShuffleRow`, `applyRegionShuffle` | direct typed `shuffleRegionRow`; no renderer arm action | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Tile swap | `canSwapHiddenTiles`, `applyTileSwap` | `toggleTileSwapArmed`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Region charges / arm row / free first | `regionShuffleCharges`, `regionShuffleRowArmed`, `regionShuffleFreeThisFloor`; also spent by tile swap | — | [epic-relics](./epic-relics.md) |
| Destroy pair | `applyDestroyPair`, `canDestroyPair` | `pressTile` when armed | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Destroy-denied route rewards | `applyDestroyPair` clears route metadata before reward resolution | `pressTile` when armed | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Destroy charges | `destroyPairCharges` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Destroy used floor flag | `destroyUsedThisFloor` | — | objectives |
| Peek | `applyPeek` | `pressTile` + `togglePeekMode` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Peek route reveal | `applyPeek` sets `routeSpecialRevealed` for Mystery Veil, Secret Door, Omen Seal | `pressTile` + `togglePeekMode` | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Omen Seal scout | `resolveBoardTurn` scouts one hidden hazard, dungeon danger, or Mystery route special after a clean Omen Seal match | `pressTile` pair match | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Mimic Cache claim | `resolveBoardTurn` pays full loot if route-revealed first; blind match bites guard/life and pays reduced loot | `pressTile` pair match | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Peek charges / revealed ids | `peekCharges`, `peekRevealedTileIds` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Pin tiles | `togglePinnedTile`, `pinnedTileIds`, `pinsPlacedCountThisRun` | `toggleBoardPinMode`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Stray remove | `applyStrayRemove` removes completion-safe hidden singleton/special tiles; typed command carries intent without a serialized arm flag | transient `strayRemoveArmed`, `toggleStrayArm`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Stray-protected route anchors | `tileIsStrayEligiblePreview`, `applyStrayRemove` deny Keystone Pair, Final Ward, Omen Seal | `toggleStrayArm`, `pressTile` | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Stray charges / intent | `strayRemoveCharges`; serialized `strayRemoveArmed` retained only for save compatibility | live arming belongs to transient `AppState.strayRemoveArmed` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Undo resolving | `cancelResolvingWithUndo` | `undoResolvingFlip` | [epic-powers-and-interactions](./epic-powers-and-interactions.md), [epic-run-session-flow](./epic-run-session-flow.md) |
| Undo uses / floor | `undoUsesThisFloor` | — | [epic-run-session-flow](./epic-run-session-flow.md) |
| Flash pair reveal | `applyFlashPair`, `flashPairCharges`, `flashPairRevealedTileIds` | `applyFlashPairPower` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Gambit availability / used | `gambitAvailableThisFloor`, `gambitThirdFlipUsed` | `pressTile` third path | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Powers used (achievement gate) | `powersUsedThisRun` | many actions set it | [epic-meta-progression](./epic-meta-progression.md) |

---

## 7. Contracts (challenge runs)

| Mechanic | Where | Epic |
|-----------|--------|------|
| `noShuffle`, `noDestroy`, `maxMismatches`, `maxPinsTotalRun` | `ContractFlags`, guards in `game.ts` | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| Scholar / Pin Vow starts | `createNewRun` options via store | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |

---

## 8. Mutators & relics

| Mechanic | Where | Epic |
|-----------|--------|------|
| Active mutator list | `activeMutators`, `MUTATOR_CATALOG`, daily table, floor schedule | [epic-mutators](./epic-mutators.md) |
| Relic ids & milestones | `relicIds`, `relicTiersClaimed`, `relicOffer`, `bonusRelicPicksNextOffer`, `metaRelicDraftExtraPerMilestone` | [epic-relics](./epic-relics.md) |
| Relic draft open / pick / bonus | `openRelicOffer`, `completeRelicPickAndAdvance`, `grantBonusRelicPickNextOffer`, `computeRelicOfferPickBudget` | [epic-relics](./epic-relics.md) |
| Route-aware relic draft weighting | pending/active route context in relic offer weighting and reason copy | [epic-route-world-pipeline](./epic-route-world-pipeline.md), [epic-relics](./epic-relics.md) |
| Relic immediate effects on run | `applyRelicImmediate` (internal in `game.ts`) | [epic-relics](./epic-relics.md) |

---

## 9. Modes & run constructors

| Mechanic | Where | Epic |
|-----------|--------|------|
| `createNewRun`, options (practice, contract, mutators, …) | `game.ts` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Daily / gauntlet / puzzle / meditation / wild / import | dedicated `create*` functions | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Practice / scholar / wild / pin vow flags | `practiceMode`, `wildMenuRun`, `activeContract` | [epic-modes-and-runs](./epic-modes-and-runs.md), contracts epic |

---

## 10. Meta: achievements, save, telemetry, export

| Mechanic | Where | Epic |
|-----------|--------|------|
| Achievement evaluation | `achievements.ts`, `applyResolvedRun` | [epic-meta-progression](./epic-meta-progression.md) |
| Save schema / settings | `save-data.ts`, `Settings` | various |
| Telemetry events | `telemetry.ts`, `trackEvent` in store | [epic-meta-progression](./epic-meta-progression.md) |
| Run export/import | `run-export.ts`, store | [epic-modes-and-runs](./epic-modes-and-runs.md) |

---

## 11. Settings that affect gameplay

| Setting | Effect | Epic |
|---------|--------|------|
| `resolveDelayMultiplier` | Copied to run at start | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `weakerShuffleMode` | Row-only vs full shuffle | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `echoFeedbackEnabled` | Copied to run | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `shuffleScoreTaxEnabled` | `shuffleScoreTaxActive` at run start | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `tileFocusAssist` | Dims tiles (when dim set computed) | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| `distractionChannelEnabled` | HUD + mutator overlay behavior | [epic-mutators](./epic-mutators.md) |
| `pairProximityHintsEnabled` | Distance badge on flipped tiles | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| `reduceMotion` | Skips many FX; some shader/UI branches | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| `graphicsQuality` / AA / bloom | Renderer performance & FX | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| `boardPresentation` | `standard` / `spaghetti` / `breathing` — CSS board stage framing only (not sim rules) | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| `masterVolume` / `sfxVolume` | Scale **procedural** gameplay SFX (Web Audio) in renderer | [epic-audio-feedback](./epic-audio-feedback.md) |

---

## 12. Read-only meta UI (does not change rules)

| Surface | Role |
|---------|------|
| Codex | Canonical copy in `mechanics-encyclopedia.ts`; `game-catalog.ts` re-exports for renderer imports |
| Collection | Save stats, achievements, symbol gallery |
| Inventory | Current run relics/mutators/charges (readout) |

See [epic-readonly-meta-ui](./epic-readonly-meta-ui.md).

---

## 13. Player input channels

| Channel | Where | Notes |
|---------|--------|--------|
| Canvas pick (pointer) | `TileBoardScene` pick mesh → `onTilePick` → store `pressTile` | Primary interaction. |
| Keyboard | Board `role="application"` — arrows + Enter; focus ring gating | [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) / TileBoard |
| HUD / toolbar | Shuffle, peek, destroy, etc. | Call same store actions as arms + `pressTile` rules |
| Gestures (pan/zoom) | `TileBoard` viewport — does not flip tiles | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |

---

## 14. Field-by-field coverage (contracts)

Sections 1–13 map **mechanisms** to code paths. **Appendices A–D** list **every field** on `RunState`, `SessionStats`, `BoardState`, and `Tile` in [`contracts.ts`](../../src/shared/contracts.ts) so the catalog matches the type definitions line-for-line. If you add a contract field, update the relevant appendix and an epic.

---

## Appendix A — `RunState` (every field)

Source: [`RunState`](../../src/shared/contracts.ts) interface.

| Field | Role | Epic / pointer |
|-------|------|----------------|
| `status` | memorize / playing / resolving / levelComplete / gameOver / paused | [epic-run-session-flow](./epic-run-session-flow.md) |
| `lives` | Current life count | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `board` | Current floor grid; null when no board | Appendix C |
| `stats` | Cumulative run counters | Appendix B |
| `achievementsEnabled` | When false (e.g. practice), achievement unlock evaluation skipped | [epic-meta-progression](./epic-meta-progression.md) |
| `debugUsed` | Set when debug-only paths affect the run | [epic-run-session-flow](./epic-run-session-flow.md) |
| `debugPeekActive` | Longer face reveal when debug peek active | [epic-run-session-flow](./epic-run-session-flow.md) |
| `pendingMemorizeBonusMs` | Banked ms applied on next floor memorize | [epic-run-session-flow](./epic-run-session-flow.md) |
| `shuffleCharges` | Full-board shuffle budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `destroyPairCharges` | Destroy-pair power budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `pinnedTileIds` | Tiles user pinned | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `powersUsedThisRun` | Gates `ACH_PERFECT_CLEAR` among other uses | [epic-meta-progression](./epic-meta-progression.md) |
| `timerState` | Nested `RunTimerState`; see Appendix A2 | [epic-run-session-flow](./epic-run-session-flow.md) |
| `lastLevelResult` | Last cleared floor result payload | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `lastRunSummary` | Optional ghost summary carried for UI / export parity | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `runSeed` | Deterministic RNG for tiles and shuffles | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `runRulesVersion` | Ruleset version for schedule / export | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `gameMode` | endless / daily / puzzle / gauntlet / meditation | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `shuffleNonce` | Increments per shuffle for deterministic order | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `activeMutators` | Active mutator ids | [epic-mutators](./epic-mutators.md) |
| `relicIds` | Relics taken this run | [epic-relics](./epic-relics.md) |
| `relicTiersClaimed` | Milestone visits completed this run (cadence in `relics.ts`; capped) | [epic-relics](./epic-relics.md) |
| `bonusRelicPicksNextOffer` | Extra relic selections for the **next** milestone draft only (consumed in `openRelicOffer`) | [epic-relics](./epic-relics.md) |
| `metaRelicDraftExtraPerMilestone` | Copied at run start from save meta (`relicShrineExtraPickUnlocked`): +1 pick at each milestone | [epic-meta-progression](./epic-meta-progression.md), [epic-relics](./epic-relics.md) |
| `relicOffer` | Pending pick options before advance | [epic-relics](./epic-relics.md) |
| `activeContract` | Scholar / pin vow constraints | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| `practiceMode` | Practice run flag | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `dailyDateKeyUtc` | Daily challenge date key | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `puzzleId` | Built-in id or caller-supplied puzzle id; no user puzzle JSON menu flow is wired | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `stickyBlockIndex` | Sticky fingers: blocked slot for next opening flip | [epic-mutators](./epic-mutators.md) |
| `parasiteFloors` | Score parasite pressure counter | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `freeShuffleThisFloor` | Relic: first shuffle free this floor | [epic-relics](./epic-relics.md) |
| `gauntletDeadlineMs` | Run-wide countdown or null | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `gauntletSessionDurationMs` | Configured gauntlet length (ms) at run start; used for **restart** | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `dailyStreakCount` | Cosmetic streak on run | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `flipHistory` | Recent flip ids (ghost / export) | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `peekCharges` | Peek power budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `peekRevealedTileIds` | Ephemeral peek faces | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `undoUsesThisFloor` | Undo resolving budget | [epic-run-session-flow](./epic-run-session-flow.md) |
| `gambitAvailableThisFloor` | Third flip allowed once | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `gambitThirdFlipUsed` | Gambit consumed | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `wildTileId` | Contract field; pairing uses `pairKey` in sim | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `wildMatchesRemaining` | Wild joker uses left | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `strayRemoveCharges` | Stray remover budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `strayRemoveArmed` | Legacy serialized compatibility field; live renderer intent is transient application state | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `matchScoreMultiplier` | Shuffle tax stacks | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `nBackMatchCounter` | N-back mutator cadence | [epic-mutators](./epic-mutators.md) |
| `nBackAnchorPairKey` | Current anchor pair key | [epic-mutators](./epic-mutators.md) |
| `matchedPairKeysThisRun` | Encore / spaced bonus bookkeeping | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `weakerShuffleMode` | Copied from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `shuffleScoreTaxActive` | Copied from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `resolveDelayMultiplier` | Copied from settings | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `echoFeedbackEnabled` | Copied from settings | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `wildMenuRun` | Wild menu restart routing | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `shuffleUsedThisFloor` | Scholar-style objective | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `destroyUsedThisFloor` | Scholar-style objective | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `decoyFlippedThisFloor` | Glass decoy touched in mismatch | [epic-mutators](./epic-mutators.md) |
| `glassDecoyActiveThisFloor` | Board includes decoy tile | [epic-mutators](./epic-mutators.md) |
| `cursedMatchedEarlyThisFloor` | Cursed objective failed | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `matchResolutionsThisFloor` | Flip-par / efficiency counter | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `parasiteWardRemaining` | Relic ward vs parasite | [epic-relics](./epic-relics.md), [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `flashPairCharges` | Practice / wild flash reveal | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `flashPairRevealedTileIds` | Tiles shown by flash | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `regionShuffleCharges` | Row shuffle / tile swap budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `regionShuffleRowArmed` | Pending row index | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `regionShuffleFreeThisFloor` | Relic free row shuffle or tile swap | [epic-relics](./epic-relics.md) |
| `pinsPlacedCountThisRun` | Contract pin cap | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| `findablesClaimedThisFloor` | Successful findable pickup matches this floor | [epic-mutators](./epic-mutators.md) |
| `findablesTotalThisFloor` | Total pickup pairs spawned this floor (claimed or not) | [epic-mutators](./epic-mutators.md) |
| `hazardTileTriggersThisFloor` | Total promoted hazard triggers this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardShuffleSnaresThisFloor` | Shuffle Snare triggers this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardCascadeCachesThisFloor` | Cascade Cache triggers this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardMirrorDecoysThisFloor` | Mirror Decoy reads this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardFragileCacheClaimsThisFloor` | Fragile Cache matched claims this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardFragileCacheBreaksThisFloor` | Fragile Cache mismatch breaks this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardTollCachesThisFloor` | Toll Cache claims this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardFuseCachesThisFloor` | Fuse Cache claims this floor | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `hazardFuseCacheExpiredClaimsThisFloor` | Late Fuse Cache claims after the full payout expires | [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `lanternWardScoutsThisFloor` | Lantern Ward scout reveals this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| `omenSealScoutsThisFloor` | Omen Seal scout reveals this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| `mimicCacheClaimsThisFloor` | Mimic Cache route-special claims this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| `mimicCacheBitesThisFloor` | Blind Mimic Cache bite branches this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| `mimicCacheGuardBitesThisFloor` | Mimic Cache bites absorbed by guard tokens this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| `safeHazardWardChargesThisFloor` | Guard Cache banked ward charge against Safe-route hazards | [epic-route-world-pipeline](./epic-route-world-pipeline.md), [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `safeHazardWardsUsedThisFloor` | Guard Cache hazard ward blocks this floor | [epic-route-world-pipeline](./epic-route-world-pipeline.md), [hazard-tile-matrix](./hazard-tile-matrix.md) |
| `shiftingSpotlightNonce` | Ward/bounty rotation seed step | [epic-mutators](./epic-mutators.md) |

### Appendix A2 — `RunTimerState` (nested in `RunState.timerState`)

| Field | Role | Epic |
|-------|------|------|
| `memorizeRemainingMs` | Countdown for memorize phase | [epic-run-session-flow](./epic-run-session-flow.md) |
| `resolveRemainingMs` | Delay before `resolveBoardTurn` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `debugRevealRemainingMs` | Debug peek countdown | [epic-run-session-flow](./epic-run-session-flow.md) |
| `pausedFromStatus` | Resume target | [epic-run-session-flow](./epic-run-session-flow.md) |

---

## Appendix B — `SessionStats` (every field)

Nested under `RunState.stats`. Drives score display, rating, and HUD.

| Field | Role | Epic |
|-------|------|------|
| `totalScore` | Run total score | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `currentLevelScore` | Score accrued this floor | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `bestScore` | Best score seen this run session | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `tries` | Mismatch / mistake counter (rating input) | [epic-scoring-objectives](./epic-scoring-objectives.md), [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `rating` | Letter grade from `calculateRating(tries)` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `levelsCleared` | Floors finished | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `matchesFound` | Successful pair clears | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `mismatches` | Failed match count | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `highestLevel` | Max floor reached | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `currentStreak` | Match streak | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `bestStreak` | Best streak this run | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `perfectClears` | Floors with zero tries | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `guardTokens` | Mismatch buffer tokens | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `comboShards` | Combo shard progress toward rewards | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `shufflesUsed` | Position-changing shuffle/swap powers consumed | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `pairsDestroyed` | Pairs removed via destroy power | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |

---

## Appendix C — `BoardState` (every field)

Nested under `RunState.board`.

| Field | Role | Epic |
|-------|------|------|
| `level` | Floor number | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `pairCount` | Pairs on this floor | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `columns` | Grid width | §2, [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `rows` | Grid height | §2 |
| `tiles` | Tile entities (id, pairKey, state, …) | [epic-core-memory-loop](./epic-core-memory-loop.md), [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `flippedTileIds` | Current flip queue | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `matchedPairs` | Pairs cleared this floor | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `cursedPairKey` | Objective: match last among reals | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `wardPairKey` | Shifting spotlight penalty pair | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| `bountyPairKey` | Shifting spotlight bonus pair | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| `floorTag` | normal / breather / boss pacing | [epic-scoring-objectives](./epic-scoring-objectives.md) |

---

## Appendix D — `Tile` (every field)

Elements of `BoardState.tiles`. Source: [`Tile`](../../src/shared/contracts.ts).

| Field | Role | Epic |
|-------|------|------|
| `id` | Stable tile id (flip queue, removal) | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `pairKey` | Pairing key (includes wild `WILD_PAIR_KEY`) | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `symbol` | Face symbol key for render / Codex | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `label` | Accessible / HUD label text | [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) |
| `state` | hidden / flipped / matched / removed | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `atomicVariant` | Optional deck art variant index | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `findableKind` | Optional pickup kind: shard, score, ward, or scout reward | [epic-mutators](./epic-mutators.md) |
| `tileHazardKind` | Optional promoted hazard tile marker: shuffle snare, cascade cache, mirror decoy, fragile cache, toll cache, or fuse cache | [hazard-tile-matrix](./hazard-tile-matrix.md) |

---

## Maintenance

- **When adding a mechanic:** Update §1–13 first, then **Appendices A–D** if `contracts.ts` changes, then the relevant epic.
- **Epics** remain narrative + refinement; **this file** is the completeness matrix (mechanisms + field-by-field).
