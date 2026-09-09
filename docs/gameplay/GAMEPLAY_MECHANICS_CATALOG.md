# Gameplay mechanics — full catalog

**Purpose:** Single checklist of **every** rule-level mechanic and player action, mapped to code. Use this to verify nothing is missing from epics or future design docs.

**Maintenance:** Hand-edited (not generated from source). When simulation rules change, update the relevant rows; align player-facing blurbs with `src/shared/mechanics-encyclopedia.ts` where applicable. Systems the game no longer has (the dungeon layer: hazards, routes, shops, relics, wagers, keys, exits, wardens, the retired mode cards) are listed in [REMOVED_DUNGEON_LAYER.md](../REMOVED_DUNGEON_LAYER.md), not here.

**Machine snapshot:** [`GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md`](./GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md) — regenerated with `yarn docs:mechanics-appendix` (rule versions, catalog entry counts).

**Scope:** Game rules (`src/shared/game.ts` and the `src/shared/*-rules.ts` modules it composes), run shape (`src/shared/contracts.ts`), player/store actions (`src/renderer/store/useAppStore.ts`), assists that affect play (`Settings`, `pairProximityHint.ts`).  
**Out of scope here:** Pure layout/CSS, Electron shell, Steam plumbing (except achievement unlock hook).

**Legend:** **Sim** = `game.ts`, rule modules, or contracts; **Store** = `useAppStore`; **UI** = renderer; **Set** = settings/save.

---

## 1. Run lifecycle & session flow

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Run statuses: memorize → playing → resolving → (levelComplete \| gameOver) + paused | `RunStatus`, `RunState` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Memorize phase duration | `getMemorizeDuration`, `getMemorizeDurationForRun` (`scoring-rules.ts`) | [epic-lives-and-pressure](./epic-lives-and-pressure.md), [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Finish memorize → playing | `finishMemorizePhase` (`memorize-phase-rules.ts`) | [epic-run-session-flow](./epic-run-session-flow.md) |
| Resolve timer after 2+ flips | `computeFlipResolveDelayMs`, `timerState.resolveRemainingMs` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Pause / resume (timers) | `pauseRun`, `resumeRun` (`run-timer-rules.ts`) | [epic-run-session-flow](./epic-run-session-flow.md) |
| Level complete → next floor | `finalizeLevel` (`floor-clear-transition.ts`), `advanceToNextLevel` (`next-floor-transition-rules.ts`); store `continueToNextLevel` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Floor resident (curio) chosen for the next floor and applied on arrival | `pickFloorCurio`, `applyFloorCurio` (`floor-curio-rules.ts`) | [epic-run-session-flow](./epic-run-session-flow.md) |
| Greet the floor resident (once per floor, free) | `greetFloorCurio`, `canGreetFloorCurio` (`floor-curio-greeting-rules.ts`); store `greetFloorResident` | [epic-run-session-flow](./epic-run-session-flow.md) |
| Game over / summary | `createRunSummary` (`run-summary-rules.ts`), store `applyResolvedRun` | [epic-meta-progression](./epic-meta-progression.md) |
| Restart / end run | store `restartRun`, `endRun` | [epic-modes-and-runs](./epic-modes-and-runs.md), [epic-run-session-flow](./epic-run-session-flow.md) |
| Debug peek (face reveal) | `enableDebugPeek`, `disableDebugPeek`, `debugRevealRemainingMs` | [epic-run-session-flow](./epic-run-session-flow.md) |

---

## 2. Board & tiles

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Board build (procedural) | `buildBoard` (`board-build-rules.ts`), `BuildBoardOptions` | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Grid geometry | `BoardState.columns`, `rows`, `tiles` | core |
| Tile states: hidden, flipped, matched, removed | `TileState` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Suits dealt in clumps (four suits on tile backs) | `dealBoardSuits`, `dealTilesInClumps`, `scatterTiles`, `SUIT_DEAL_PROFILE_BY_ARCHETYPE` (`tile-suit-rules.ts`) | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Clump outline and Sharp-break preview on focus | `largestHiddenSuitClump`, `findSuitRegion` | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Flip queue | `flippedTileIds` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Flip action | `flipTile`; typed path `applyTileFlipThroughGameplayCore` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Sticky fingers block index | `stickyBlockIndex` + flip guard | [epic-mutators](./epic-mutators.md) |
| Board complete check | `isBoardComplete`, `countFullyHiddenPairs` (`board-inspection.ts`) | Sim |
| Pair proximity hint (Manhattan) | `getPairProximityGridDistance` | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Focus dim set (assist) | `computeFocusDimmedTileIds` in `focusDimmedTileIds.ts` | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Tile traits assigned from floor 4 (the three authored floors carry none) | `assignTileTraitsToGeneratedBoard` (`tile-trait-rules.ts`), `Tile.tileTraitKind` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Findable pickup pairs assigned | `assignFindableKindsToTiles` (`board-tile-generation-rules.ts`), `Tile.findableKind` | [epic-mutators](./epic-mutators.md), [FINDABLES.md](../FINDABLES.md) |

---

## 3. Matching & resolution

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Pair match predicate (incl. wild/decoy rules) | `tilesArePairMatch` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Two-/three-flip resolution | `board.turn_resolve` via `resolveBoardTurnThroughGameplayCore`; legacy `resolveBoardTurn` remains a compatibility export | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Gambit three-flip pair selection | `selectGambitMatchedPair` (`gambit-match-rules.ts`) | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Wild pair key | `WILD_PAIR_KEY`, `wildMatchesRemaining` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Wild tile identity | `BoardState.tiles` + `WILD_PAIR_KEY`; derived query `getWildTileIdFromBoard` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Glass / decoy | `boardHasGlassDecoy`, `DECOY` handling | [epic-mutators](./epic-mutators.md), core |
| Chunk break: every match pops the same-suit clump and its partners | `resolveChunkBreak`, `tileCanBreakInChunk`, `breakClumpReach` (`chunk-break-rules.ts`) | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Ripple waves, the severance drop, the halo | `rippleWaves`, `suitCanStillPop`, `RIPPLE_MAX_WAVES` (`chunk-break-rules.ts`) | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Chain tiers (Clean / Sharp / Fever) and momentum | `getChainTier`, `chainTierRungs`, `chainMomentum`, `chainMeter` (`chain-tier-rules.ts`) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Break score, multiplicative: a pair's worth × pairs × tier (`CHAIN_MULT`) × ripple (`waveMult`); shards | `chunkBreakScore`, `chunkScorePerPair`, `chunkBreakComboShards` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Shifting spotlight scoring + rotation | `shiftingSpotlightMatchDelta` (`shifting-spotlight-rules.ts`), `shiftingSpotlightNonce` | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Cursed pair early match flag | `cursedMatchedEarlyThisFloor` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Findables on match, spilled by a break, forfeited by Destroy | `findableKind`, `findablesClaimedThisFloor`, `resolveFindableMatchRewardThroughGameplayCore` | [epic-mutators](./epic-mutators.md) |
| Tile trait match rewards / mismatch penalties | `resolveTileTraitEffects`, `calculateTileTraitMatchRewards`, `calculateTileTraitMismatchPenalty`, `releaseStrandedStasisBlock` | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Magpie theft every third miss, scared off by a guard token | `isMagpieVisitTurn`, `resolveMagpieVisit`, `applyMagpieTheft` (`magpie-rules.ts`) | [epic-mutators](./epic-mutators.md) |
| Recall Focus and forgotten tiles | `increaseRecallFocus`, `decreaseRecallFocus`, `rememberForgottenTiles`, `settleForgottenTiles` (`recall-rules.ts`); `getMemoryRecallFeedback` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| N-back anchor counter / key | `nBackMatchCounter`, `nBackAnchorPairKey` | [epic-mutators](./epic-mutators.md), [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| Encore pair keys (spaced bonus) | `matchedPairKeysThisRun`, `encorePairKeysLastRun` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Pass and Play seat credit and handoff | `applyResolvedTurnToPassAndPlay`, `acknowledgePassAndPlayHandoff`, `resolvePassAndPlayOutcome` (`pass-and-play-rules.ts`) | [epic-modes-and-runs](./epic-modes-and-runs.md) |

---

## 4. Scoring & ratings

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Per-match score | `calculateMatchScore`, streak, `matchScoreMultiplier` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Recall match bonus | `calculateRecallMatchBonus` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Presentation mutator flat penalty | `getPresentationMutatorMatchPenalty` | [epic-mutators](./epic-mutators.md) |
| The floor par and the turns taken against it | `parTurnsForFloor`, `turnsTakenThisFloor` (`floor-par.ts`), `turnsThisFloor` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Floor-end bonus: 100 × floor × tier at clear (`FLOOR_TIER_MULT`) + 50 × floor per turn under par; boss multiplier | `calculateFloorClearBonus` (`level-clear-rules.ts`), `finalizeLevel` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Featured objective bonus and objective streak kicker | `getFloorClearObjectiveResult`, `getFeaturedObjectiveClearResult`, `FEATURED_OBJECTIVE_BONUS_SCORES` (`secondary-objective-rules.ts`) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Chain-standing floor-end payout (Extreme Fever) | `finalizeLevel` reads `runChainTier` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Rating letter | `calculateRating` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Shuffle score tax | `shuffleScoreTaxActive`, multiplier decay | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |

---

## 5. Lives, mistakes & pressure

| Mechanic | Where | Epic / note |
|-----------|--------|-------------|
| Lives loss / guard / combo shards / chain heal | `calculateResolvedMatchSurvivalReward` (`turn-match-reward-rules.ts`), `applyComboShardGain` (`combo-shard-rules.ts`), mismatch path in board-turn resolution | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Contract max mismatches → game over | `activeContract.maxMismatches` | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| Score parasite: every fourth advance costs a life | `advanceScoreParasiteFloor` (`score-parasite-rules.ts`), `parasiteFloors` | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Echo feedback (resolve delay) | `echoFeedbackEnabled`, `computeFlipResolveDelayMs` | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Resolve delay multiplier | `resolveDelayMultiplier` (from settings or the setup sheet's calm pacing at run start) | Settings + [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Lost life banks memorize time for the next floor | `addPendingMemorizeBonusForLostLives`, `pendingMemorizeBonusMs` | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |

---

## 6. Powers & charges (sim + store)

| Mechanic | Sim | Store | Epic |
|-----------|-----|-------|------|
| Full shuffle | `applyShuffle`, `canShuffleBoard` | `shuffleBoard` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Weaker shuffle mode | `weakerShuffleMode` on run | from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Shuffle charges / nonce | `shuffleCharges`, `shuffleNonce` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Scholar: shuffle used flag | `shuffleUsedThisFloor` | — | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Region shuffle | `canRegionShuffle`, `canRegionShuffleRow`, `applyRegionShuffle`; typed command carries the chosen row directly | `toggleRegionShuffleArmed`, `pressTile`; no serialized arm state | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Tile swap | `canSwapHiddenTiles`, `applyTileSwap` | `toggleTileSwapArmed`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Region charges | `regionShuffleCharges`; spent by row shuffle and tile swap alike | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Destroy pair | `applyDestroyPair`, `canDestroyPair` | `toggleDestroyPairArmed`, `pressTile` when armed | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Destroy charges | `destroyPairCharges` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Destroy used floor flag | `destroyUsedThisFloor` | — | objectives |
| Peek | `applyPeek` | `pressTile` + `togglePeekMode` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Peek charges / revealed ids | `peekCharges`, `peekRevealedTileIds` | — | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Pin tiles | `togglePinnedTile`, `pinnedTileIds`, `pinsPlacedCountThisRun` | `toggleBoardPinMode`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Stray remove | `applyStrayRemove` removes completion-safe hidden singleton tiles; `tileIsStrayEligiblePreview`; the glass decoy is refused | transient `strayRemoveArmed`, `toggleStrayArm`, `pressTile` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Stray charges / intent | `strayRemoveCharges`; `RunState` contains no serialized arm intent | live arming belongs exclusively to transient `AppState.strayRemoveArmed` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Undo resolving | `cancelResolvingWithUndo` | `undoResolvingFlip` | [epic-powers-and-interactions](./epic-powers-and-interactions.md), [epic-run-session-flow](./epic-run-session-flow.md) |
| Undo uses / floor | `undoUsesThisFloor` | — | [epic-run-session-flow](./epic-run-session-flow.md) |
| Flash pair reveal | `applyFlashPair`, `flashPairCharges`, `flashPairRevealedTileIds` | `applyFlashPairPower` | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Typed HUD completeness registry | `GAMEPLAY_FEEDBACK_CRITICAL_FIELD_SOURCES` maps the normalized HUD/resource facts to graph state fields; every accepted core command must emit typed feedback or the board-turn envelope when one changes | AI model marks the same state nodes `playerVisible` and rejects registry/graph drift | [epic-audio-feedback](./epic-audio-feedback.md) |
| Gambit availability / used | `gambitAvailableThisFloor`, `gambitThirdFlipUsed` | `pressTile` third path | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Powers used (achievement gate) | `powersUsedThisRun` | many actions set it | [epic-meta-progression](./epic-meta-progression.md) |

---

## 7. Contracts (challenge runs)

| Mechanic | Where | Epic |
|-----------|--------|------|
| `noShuffle`, `noDestroy`, `maxMismatches`, `maxPinsTotalRun` | `ContractFlags`, guards in `game.ts` | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| Vows chosen on the setup sheet | `buildVowContract` (`classic-run-setup.ts`) → `createNewRun` options | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |

---

## 8. Mutators & the floor schedule

| Mechanic | Where | Epic |
|-----------|--------|------|
| Active mutator list | `activeMutators`, `MUTATOR_CATALOG`, floor schedule | [epic-mutators](./epic-mutators.md) |
| Twelve-floor endless cycle: chapter, act, biome, mutators, featured objective, pacing tag | `pickFloorScheduleEntry`, `usesEndlessFloorSchedule`, `FLOOR_ARCHETYPE_CATALOG`, `CHAPTER_ACT_BIOME_STRUCTURE`, `ENDLESS_CYCLE_FLOOR_COUNT` (`floor-mutator-schedule.ts`) | [epic-mutators](./epic-mutators.md) |
| Featured objective per floor | `BoardState.featuredObjectiveId`, `isFeaturedObjectiveCompleted`, `FEATURED_OBJECTIVE_HUD_TOOLTIPS` | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Chaos option adds mutators from the setup sheet | `CHAOS_MUTATORS` (`classic-run-setup.ts`) | [epic-mutators](./epic-mutators.md) |

---

## 9. Modes & run constructors

| Mechanic | Where | Epic |
|-----------|--------|------|
| `createNewRun`, options (practice, contract, mutators, clock, …) | `run-creation-rules.ts` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Classic Run setup sheet: pacing, pressure (clock), vows, chaos, unrecorded run | `ClassicRunSetup`, `buildClassicRunOptions`, `classicRunSetupFromRun`, `describeClassicRunSetup` (`classic-run-setup.ts`) | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Pass and Play: a shared game of the same rules on one device | `createPassAndPlayState`, `PASS_AND_PLAY_FLOORS`, seat bounds (`pass-and-play-rules.ts`); store `startPassAndPlayRun` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Wild / joker run | `createWildRun` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Practice / scholar / wild / pin vow flags | `practiceMode`, `wildMenuRun`, `activeContract` | [epic-modes-and-runs](./epic-modes-and-runs.md), contracts epic |
| Share key: encode a run's seed and setup, start a run from one | `describeRunShareKey`, `encodeRunShareKey`, `parseRunShareKey` (`run-share-key.ts`), `createRunFromShareKey`; store `startSharedRun` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Mode catalog shown on Choose Your Path | `RUN_MODE_CATALOG`, `CHOOSE_PATH_HERO_MODE_IDS` (`run-mode-catalog.ts`) | [epic-choose-your-path](./epic-choose-your-path.md) |

---

## 10. Meta: achievements, save, telemetry, export

| Mechanic | Where | Epic |
|-----------|--------|------|
| Achievement evaluation | `achievements.ts`, `applyResolvedRun` | [epic-meta-progression](./epic-meta-progression.md) |
| Save schema / settings | `save-data.ts`, `Settings` | various |
| Telemetry events | `telemetry.ts`, `trackEvent` in store | [epic-meta-progression](./epic-meta-progression.md) |
| Run share key export/import | `run-share-key.ts`, `run-from-share-key.ts`, store | [epic-modes-and-runs](./epic-modes-and-runs.md) |

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
| `masterVolume` / `sfxVolume` | Scale gameplay SFX (sampled with procedural fallback) in renderer | [epic-audio-feedback](./epic-audio-feedback.md) |

---

## 12. Read-only meta UI (does not change rules)

| Surface | Role |
|---------|------|
| Codex | Canonical copy in `mechanics-encyclopedia.ts`; `game-catalog.ts` re-exports for renderer imports |
| Collection | Save stats, achievements, symbol gallery |
| Inventory | Current run charges and mutators (readout) |

See [epic-readonly-meta-ui](./epic-readonly-meta-ui.md).

---

## 13. Player input channels

| Channel | Where | Notes |
|---------|--------|--------|
| Canvas pick (pointer) | `TileBoardScene` pick mesh → `onTilePick` → store `pressTile` | Primary interaction. |
| Keyboard | Board `role="application"` — arrows + Enter; focus ring gating | [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) / TileBoard |
| Gamepad | Directional focus driver over every screen; the board keeps first refusal on a direction | `src/shared/gamepad-input.ts`, `src/renderer/input/` |
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
| `passAndPlay` | Same-device seats, or null on every single-player run; lives and board stay shared, only credit is split | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `board` | Current floor grid; null when no board | Appendix C |
| `stats` | Cumulative run counters | Appendix B |
| `achievementsEnabled` | When false (practice, or an unrecorded run from the setup sheet), achievement unlock evaluation skipped | [epic-meta-progression](./epic-meta-progression.md) |
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
| `runSeed` | Deterministic RNG for tiles, suits, residents and shuffles | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `runRulesVersion` | Ruleset version for schedule / export | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `gameMode` | `endless` — the one member of `GameMode` | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `shuffleNonce` | Increments per shuffle for deterministic order | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `activeMutators` | Active mutator ids | [epic-mutators](./epic-mutators.md) |
| `featuredObjectiveStreak` | Consecutive featured-objective clears; a miss decays it by 2 | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `gameplayCommandJournal` | Run-local deterministic command journal; persisted only through the bounded final summary | [epic-meta-progression](./epic-meta-progression.md) |
| `gameplayEventJournal` | Run-local deterministic event journal; same persistence rule | [epic-meta-progression](./epic-meta-progression.md) |
| `activeContract` | Scholar / pin vow constraints | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| `practiceMode` | Practice run flag | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `dailyDateKeyUtc` | Create-run option nothing live sets; kept on the type so old saves still parse | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `puzzleId` | Create-run option nothing live sets; kept on the type so old saves still parse | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `stickyBlockIndex` | Sticky fingers: blocked slot for next opening flip | [epic-mutators](./epic-mutators.md) |
| `parasiteFloors` | Score parasite pressure counter | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `flipHistory` | Recent flip ids (ghost / export) | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `peekCharges` | Peek power budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `peekRevealedTileIds` | Ephemeral peek faces | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `undoUsesThisFloor` | Undo resolving budget | [epic-run-session-flow](./epic-run-session-flow.md) |
| `gambitAvailableThisFloor` | Third flip allowed once | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `gambitThirdFlipUsed` | Gambit consumed | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `wildMatchesRemaining` | Wild joker uses left | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `strayRemoveCharges` | Stray remover budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `matchScoreMultiplier` | Shuffle tax stacks | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `nBackMatchCounter` | N-back mutator cadence | [epic-mutators](./epic-mutators.md) |
| `nBackAnchorPairKey` | Current anchor pair key | [epic-mutators](./epic-mutators.md) |
| `matchedPairKeysThisRun` | Encore / spaced bonus bookkeeping | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `weakerShuffleMode` | Copied from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `shuffleScoreTaxActive` | Copied from settings | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `resolveDelayMultiplier` | Copied from settings; the setup sheet's calm pacing raises it | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `echoFeedbackEnabled` | Copied from settings | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `wildMenuRun` | Wild menu restart routing | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| `shuffleUsedThisFloor` | Scholar-style objective | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `destroyUsedThisFloor` | Scholar-style objective | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `decoyFlippedThisFloor` | Glass decoy touched in mismatch | [epic-mutators](./epic-mutators.md) |
| `glassDecoyActiveThisFloor` | Board includes decoy tile | [epic-mutators](./epic-mutators.md) |
| `cursedMatchedEarlyThisFloor` | Cursed objective failed | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `matchResolutionsThisFloor` | Matches resolved this floor (seeds deterministic rolls) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `turnsThisFloor`, `largestChunkScoreThisFloor` | Turns against the par; the biggest break's score (band N5) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `flashPairCharges` | Practice / wild flash reveal | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `flashPairRevealedTileIds` | Tiles shown by flash | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `regionShuffleCharges` | Row shuffle / tile swap budget | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| `pinsPlacedCountThisRun` | Contract pin cap | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| `findablesClaimedThisFloor` | Successful findable pickup matches this floor | [epic-mutators](./epic-mutators.md) |
| `findablesTotalThisFloor` | Total pickup pairs spawned this floor (claimed or not) | [epic-mutators](./epic-mutators.md) |
| `recallFocus` | Clean-recall momentum; matches raise it, misses and disruptive assists lower it | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `recallMatchesThisFloor` | Clean remembered matches this floor | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `recallMistakesThisFloor` | Memory slips this floor (trait misses can deepen it) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `recallBonusScoreThisFloor` | Recall bonus score paid this floor | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `forgottenTileIdsThisFloor` | Tiles whose remembered position a miss, peek or shuffle invalidated; settled when their pair is matched | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `floorCurioId` | Who is resident on this floor; null before the first floor opens | [epic-run-session-flow](./epic-run-session-flow.md) |
| `floorCurioGreeted` | True once this floor's resident has been greeted | [epic-run-session-flow](./epic-run-session-flow.md) |
| `chunkBreaksThisFloor` | Chunk breaks a chain has bought on this floor | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `chunkPairsBrokenThisFloor` | Pairs those breaks took with them | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `chunkScoreThisFloor` | Score the chunks paid this floor, findables and spilled treasure included | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `chunkPairsThisChain` | Pairs chunks broke since the chain last dropped: momentum the tier ladder counts | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `feverBreaksThisFloor` | Breaks that landed at the Fever rung this floor | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `bestChainThisFloor` | Longest chain the floor saw | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `feverBreaksThisRun` | Run-wide Fever breaks; records and achievements read it | [epic-meta-progression](./epic-meta-progression.md) |
| `biggestChunkPairs` | Biggest single chunk in pairs this run | [epic-meta-progression](./epic-meta-progression.md) |
| `bestChainThisRun` | Longest chain this run | [epic-meta-progression](./epic-meta-progression.md) |
| `sharpFloorsThisRun` | Cleared floors whose chain reached Sharp | [epic-meta-progression](./epic-meta-progression.md) |
| `feverFloorsThisRun` | Cleared floors whose chain reached Fever | [epic-meta-progression](./epic-meta-progression.md) |
| `chunkPairsDroppedThisFloor` | Pairs that fell because a break left their suit with too few to hold | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `chunkDropsThisRun` | Count of drops this run | [epic-meta-progression](./epic-meta-progression.md) |
| `bestRippleThisFloor` | Longest ripple this floor, in waves | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `bestRippleThisRun` | Longest ripple this run, in waves | [epic-meta-progression](./epic-meta-progression.md) |
| `magpieTheftsThisFloor` | Pairs the magpie has taken back on this floor | [epic-mutators](./epic-mutators.md) |
| `magpieScaredOffThisFloor` | Times a guard token drove the magpie off on this floor | [epic-mutators](./epic-mutators.md) |
| `shiftingSpotlightNonce` | Ward/bounty rotation seed step | [epic-mutators](./epic-mutators.md) |

### Appendix A2 — `RunTimerState` (nested in `RunState.timerState`)

| Field | Role | Epic |
|-------|------|------|
| `memorizeRemainingMs` | Countdown for memorize phase | [epic-run-session-flow](./epic-run-session-flow.md) |
| `resolveRemainingMs` | Delay before the board turn resolves | [epic-core-memory-loop](./epic-core-memory-loop.md) |
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
| `currentStreak` | Match streak (the chain) | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `bestStreak` | Best streak this run | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `perfectClears` | Floors with zero tries | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `guardTokens` | Mismatch buffer tokens | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `comboShards` | Combo shard progress toward a life | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| `tileTraitMatches` | Clean matches per trait kind (feeds `ACH_TRAIT_SCHOLAR`) | [epic-meta-progression](./epic-meta-progression.md) |
| `tileTraitMismatches` | Misses per trait kind | [epic-core-memory-loop](./epic-core-memory-loop.md) |
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
| `floorArchetypeId` | Authored chapter identity from the endless schedule; null outside it | [epic-mutators](./epic-mutators.md) |
| `featuredObjectiveId` | The one visible goal for this floor; null outside the schedule | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| `cycleFloor` | 1-based position within the 12-floor cycle | [epic-mutators](./epic-mutators.md) |
| `actTitle` | Act name for HUD and Codex | [epic-mutators](./epic-mutators.md) |
| `actFloorNumber` | Position within the act | [epic-mutators](./epic-mutators.md) |
| `actFloorCount` | Floors in the act | [epic-mutators](./epic-mutators.md) |
| `biomeTitle` | Biome name for HUD and Codex | [epic-mutators](./epic-mutators.md) |
| `biomeTone` | One-line biome tone for the floor banner | [epic-mutators](./epic-mutators.md) |

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
| `suit` | Ember / Tide / Moss / Bone, visible on the back from the moment the floor opens | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `brokenByChunk` | True on a tile a chunk break took off the board | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| `brokenAtTier` | Tier the break landed at (`none` for a pop), so the shatter can play a Fever break slower | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| `brokenAtWave` | Which wave of the ripple took this tile (0 = the match's own region) | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| `atomicVariant` | Optional deck art variant index | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| `findableKind` | Optional pickup kind: `shard_spark` or `score_glint` | [epic-mutators](./epic-mutators.md) |
| `tileTraitKind` | Optional pair modifier: echo, heavy, conduit, or stasis (floor 4 onward) | [epic-core-memory-loop](./epic-core-memory-loop.md) |

---

## Maintenance

- **When adding a mechanic:** Update §1–13 first, then **Appendices A–D** if `contracts.ts` changes, then the relevant epic.
- **When removing one:** Delete its rows here and record it in [REMOVED_DUNGEON_LAYER.md](../REMOVED_DUNGEON_LAYER.md); a row for a rule that no longer exists is worse than no row.
- **Epics** remain narrative + refinement; **this file** is the completeness matrix (mechanisms + field-by-field).
