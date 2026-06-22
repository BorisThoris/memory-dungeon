import {
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    MATCH_DELAY_MS,
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    RECALL_FOCUS_MAX,
    type BoardState,
    type LevelResult,
    type RunState
} from './contracts';
import { getDungeonLevelResultTags } from './secondary-objectives';
import {
    applyTraitRouteObjectiveProgress
} from './trait-route-objectives';
export {
    applyRelicOfferServiceToRun,
    computeRelicOfferPickBudget,
    openRelicOffer,
    useRelicOfferService
} from './relic-offer-rules';
import { generateRouteChoices } from './route-choice-rules';
import { gainRelicFavor } from './relic-favor-rules';
import {
    clearCurrentDungeonNode,
    revealDungeonChoices
} from './run-map';
import { getRunDungeonMapState } from './dungeon-run-state-rules';
export {
    countFindablePairs
} from './board-tile-generation-rules';
export {
    createDungeonFloorBlueprint,
    inspectDungeonEncounterBudget,
    type DungeonEncounterBudgetSummary
} from './dungeon-floor-blueprint-rules';
export {
    applyDungeonLayoutPlan,
    assignHazardTilesToGeneratedBoard
} from './dungeon-board-generation-rules';
import {
    clearLastPairEnemyHazardSoftlock
} from './dungeon-enemy-hazard-rules';
export {
    ENEMY_HAZARD_PATTERN_DEFINITIONS,
    applyEnemyHazardClick,
    getEnemyHazardMovementCandidateIds,
    type EnemyHazardPatternDefinition
} from './dungeon-enemy-hazard-rules';
import {
    clearFinalPairEnemyHazardOccupationForRun
} from './enemy-hazard-board-rules';
import {
    revealDungeonCardPair
} from './dungeon-trap-rules';
import {
    revealDungeonRoom
} from './dungeon-room-rules';
import { createDungeonExitActivationTransition } from './dungeon-exit-rules';
import { getDungeonBossTrophyCacheResult } from './dungeon-boss-clear-rules';
import type {
    DungeonExitActivationSpend
} from './dungeon-exit-rules';
import {
    isBoardComplete
} from './board-inspection';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY
} from './tile-identity';
import {
    calculateRating,
    computeFlipResolveDelayMs,
    tilesArePairMatch
} from './scoring-rules';
import {
    applyFloorClearEnemyHazardDefeats,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getClearLifeReason
} from './level-clear-rules';
import {
    getFloorClearObjectiveResult
} from './secondary-objective-rules';
import {
    clearResolveState
} from './run-timer-rules';
import { getShopGoldRewardForFloor } from './shop-rules';
import { applyDestroyPairTransition } from './board-power-actions';
import {
    rotateAnchorSealPressure,
    rotateRunShiftingSpotlight
} from './shifting-spotlight-rules';
import {
    getParasiteFloorsAfterFeaturedObjectiveClear
} from './score-parasite-rules';
import { deriveMatchClaimContext } from './match-claim-rules';
import {
    revealDungeonExit,
    revealDungeonShop
} from './dungeon-reveal-rules';
import { selectGambitMatchedPair } from './gambit-match-rules';
import { resolveMismatchTurnTransition } from './turn-mismatch-rules';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';
import { resolveTurnMatchBoardCleanup } from './turn-match-board-cleanup-rules';
import { resolveTurnMatchEconomy } from './turn-match-economy-rules';
import { resolveTurnMatchProgress } from './turn-match-progress-rules';
import { resolveTurnMatchBoardResolution } from './turn-match-board-resolution-rules';
import { resolveTurnMatchScoringSummary } from './turn-match-scoring-summary-rules';
import { resolveTileTraitEffects } from './tile-trait-rules';
import { addTileTraitCountStats } from './session-stats-rules';
export {
    completeRelicPickAndAdvance
} from './relic-pick-advance-rules';

export {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey,
    isWildPairKey
} from './tile-identity';
export {
    boardHasGlassDecoy,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    inspectRunFairness,
    type BoardFairnessIssue,
    type BoardFairnessIssueCode,
    type BoardFairnessReport,
    type RunFairnessReport,
    isBoardComplete
} from './board-inspection';
export {
    createTimerState,
    disableDebugPeek,
    enableDebugPeek,
    pauseRun,
    resumeRun
} from './run-timer-rules';
export {
    getMatchFloaterAnchorTileIds,
    getMismatchFloaterAnchorTileIds
} from './tile-floater-anchor-rules';
export {
    canRerollShopOffers,
    createRunShopOffers,
    getRunShopReadModel,
    getRunShopStockPlan,
    getRunShopWalletPacing,
    getShopGoldRewardForFloor,
    getShopRerollCostForFloor,
    getShopWalletPacing,
    purchaseShopOffer,
    rerollShopOffers,
    SHOP_ITEM_CATALOG,
    type RunShopReadModel,
    type RunShopSource,
    type RunShopStockPlan
} from './shop-rules';
export {
    revealDungeonRoom
} from './dungeon-room-rules';
export {
    revealDungeonExit,
    revealDungeonShop
} from './dungeon-reveal-rules';
export type {
    DungeonExitActivationSpend
} from './dungeon-exit-rules';
export {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview
} from './board-power-targeting';
export {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap,
    applyDestroyPairTransition,
    cancelResolvingWithUndo
} from './board-power-actions';
export {
    canDestroyPair,
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard,
    canSwapHiddenTiles
} from './board-power-availability';
export {
    armRegionShuffleRow,
    togglePinnedTile,
    toggleStrayRemoveArmed
} from './board-power-state';
export {
    countFullyHiddenPairs
} from './board-inspection';
export {
    eligibleSpotlightPairKeys,
    pickShiftingSpotlightKeys,
    rotateAnchorSealPressure,
    rotateRunShiftingSpotlight,
    rotateShiftingSpotlight,
    shiftingSpotlightMatchDelta
} from './shifting-spotlight-rules';

export {
    PRESENTATION_MUTATOR_MATCH_PENALTIES,
    calculateLevelClearBonus,
    calculateMatchScore,
    calculatePerfectClearBonus,
    calculateRating,
    computeFlipResolveDelayMs,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    getPresentationMutatorMatchPenalty,
    tilesArePairMatch
} from './scoring-rules';
export {
    acceptEndlessRiskWager,
    canOfferEndlessRiskWager
} from './risk-wager-rules';
export {
    buildBoard,
    type BuildBoardOptions
} from './board-build-rules';
export {
    createDailyRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    isGauntletExpired,
    type CreateRunOptions
} from './run-creation-rules';
export {
    advanceToNextLevel
} from './next-floor-transition-rules';
export {
    createRunSummary
} from './run-summary-rules';
export {
    finishMemorizePhase
} from './memorize-phase-rules';
export {
    createDungeonShowcaseRun
} from './dungeon-showcase-run-rules';

const GAMBIT_FAIL_EXTRA_TRIES = 1;

export {
    generateRouteChoices,
    getRouteChoiceAvailability,
    type RouteChoiceAvailability
} from './route-choice-rules';
export {
    applyRouteChoiceOutcome,
    type RouteChoiceOutcomeResult
} from './route-choice-outcome-rules';

export {
    claimRouteSideRoomChoice,
    claimRouteSideRoomPrimary,
    openRouteSideRoom,
    routeNodeKindForSideRoom,
    skipRouteSideRoom
} from './route-side-room-rules';
export {
    DUNGEON_BOSS_DEFEAT_SCORE,
    DUNGEON_BOSS_DEFINITIONS,
    DUNGEON_ELITE_ENCOUNTER_RULES,
    getDungeonBossDefinition,
    getDungeonEliteEncounterRules,
    type DungeonBossDefinition,
    type DungeonBossLifecycleSource,
    type DungeonBossPhase,
    type DungeonBossRewardHook,
    type DungeonEliteEncounterRules
} from './dungeon-boss-rules';

export {
    createDungeonEncounterContext,
    enemyHazardProfileForBoss,
    floorArchetypeForDungeonNode,
    floorTagForDungeonNode,
    type DungeonEncounterContext
} from './dungeon-encounter-context-rules';

export {
    DUNGEON_ROOM_EFFECT_DEFINITIONS,
    DUNGEON_TREASURE_REWARD_DEFINITIONS,
    getDungeonCardCopy,
    getDungeonRoomEffectDefinition,
    getDungeonRoomReadModel,
    getDungeonTreasureReadModel,
    getDungeonTreasureRewardDefinition,
    type DungeonRoomEffectDefinition,
    type DungeonRoomEffectId,
    type DungeonRoomReadModel,
    type DungeonRoomResolvedState,
    type DungeonRoomTrigger,
    type DungeonTreasureReadModel,
    type DungeonTreasureRewardDefinition,
    type DungeonTreasureRewardId,
    type DungeonTreasureTier
} from './dungeon-card-read-model';
export {
    getDungeonBoardPresentation,
    getDungeonBoardStatus,
    getDungeonBossReadModel,
    getDungeonEnemyLifecycleStatus,
    getDungeonExitStatus,
    getDungeonObjectiveStatus,
    getDungeonThreatStatus,
    type DungeonBoardPresentation,
    type DungeonBoardPresentationChip,
    type DungeonBoardPresentationChipTone,
    type DungeonBoardStatus,
    type DungeonBossReadModel,
    type DungeonEnemyLifecycleStatus,
    type DungeonExitStatus,
    type DungeonObjectiveStatus,
    type DungeonThreatStatus
} from './dungeon-board-status';
export {
    grantBonusRelicPickNextOffer
} from './relic-immediate-rules';

export const flipTile = (run: RunState, tileId: string): RunState => {
    const runAfterFinalPairCleanup = clearFinalPairEnemyHazardOccupationForRun(run);
    if (!runAfterFinalPairCleanup.board) {
        return run;
    }

    const gambitThirdWhileResolving =
        runAfterFinalPairCleanup.status === 'resolving' &&
        runAfterFinalPairCleanup.gambitAvailableThisFloor &&
        !runAfterFinalPairCleanup.gambitThirdFlipUsed &&
        runAfterFinalPairCleanup.board.flippedTileIds.length === 2;

    if (runAfterFinalPairCleanup.status !== 'playing' && !gambitThirdWhileResolving) {
        return runAfterFinalPairCleanup;
    }

    const runAfterFlashClear =
        runAfterFinalPairCleanup.flashPairRevealedTileIds.length > 0
            ? { ...runAfterFinalPairCleanup, flashPairRevealedTileIds: [] }
            : runAfterFinalPairCleanup;
    const boardBeforeLastPairFailsafe = runAfterFlashClear.board;
    if (!boardBeforeLastPairFailsafe) {
        return runAfterFlashClear;
    }
    const runAfterLastPairFailsafe = clearLastPairEnemyHazardSoftlock(runAfterFlashClear, boardBeforeLastPairFailsafe);
    const board = runAfterLastPairFailsafe.board;
    if (!board) {
        return runAfterLastPairFailsafe;
    }

    const allowThird =
        runAfterLastPairFailsafe.gambitAvailableThisFloor &&
        !runAfterLastPairFailsafe.gambitThirdFlipUsed &&
        board.flippedTileIds.length === 2;
    const maxFlips = allowThird ? 3 : 2;
    if (board.flippedTileIds.length >= maxFlips) {
        return runAfterLastPairFailsafe;
    }

    const tile = board.tiles.find((candidate) => candidate.id === tileId);

    if (!tile || tile.state !== 'hidden' || board.flippedTileIds.includes(tileId)) {
        return runAfterLastPairFailsafe;
    }

    const tileIndex = board.tiles.findIndex((candidate) => candidate.id === tileId);
    if (
        board.flippedTileIds.length === 0 &&
        runAfterLastPairFailsafe.stickyBlockIndex !== null &&
        tileIndex === runAfterLastPairFailsafe.stickyBlockIndex
    ) {
        return runAfterLastPairFailsafe;
    }

    if (tile.pairKey === EXIT_PAIR_KEY) {
        return revealDungeonExit(runAfterLastPairFailsafe, tileId);
    }
    if (tile.pairKey === SHOP_PAIR_KEY) {
        return revealDungeonShop(runAfterLastPairFailsafe, tileId);
    }
    if (tile.pairKey === ROOM_PAIR_KEY) {
        return revealDungeonRoom(runAfterLastPairFailsafe, tileId);
    }

    const runAfterDungeonReveal =
        tile.state === 'hidden' ? revealDungeonCardPair(runAfterLastPairFailsafe, tile) : runAfterLastPairFailsafe;
    if (runAfterDungeonReveal.status === 'gameOver') {
        return runAfterDungeonReveal;
    }
    const revealedBoard = runAfterDungeonReveal.board;
    if (!revealedBoard) {
        return runAfterDungeonReveal;
    }
    const peekRevealedTileIds =
        runAfterDungeonReveal.peekRevealedTileIds.length > 0 ? ([] as string[]) : runAfterDungeonReveal.peekRevealedTileIds;
    if (
        tile.state === 'hidden' &&
        tile.dungeonCardKind === 'trap' &&
        runAfterDungeonReveal.dungeonTrapsTriggered > runAfterLastPairFailsafe.dungeonTrapsTriggered
    ) {
        const trapResolvedRun: RunState = {
            ...runAfterDungeonReveal,
            status: 'playing',
            peekRevealedTileIds,
            board: {
                ...revealedBoard,
                flippedTileIds: []
            },
            flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
            timerState: clearResolveState(runAfterDungeonReveal)
        };
        return trapResolvedRun.board && isBoardComplete(trapResolvedRun.board)
            ? finalizeLevel(trapResolvedRun, trapResolvedRun.board)
            : trapResolvedRun;
    }

    const flippedTileIds = [...revealedBoard.flippedTileIds, tileId];
    const firstFlippedId = revealedBoard.flippedTileIds[0] ?? null;
    const firstFlippedTile = firstFlippedId
        ? revealedBoard.tiles.find((candidate) => candidate.id === firstFlippedId) ?? null
        : null;
    const revealedTile = revealedBoard.tiles.find((candidate) => candidate.id === tileId) ?? tile;
    const resolvesMatchImmediately =
        flippedTileIds.length === 2 &&
        firstFlippedTile !== null &&
        tilesArePairMatch(firstFlippedTile, revealedTile);

    let resolveRemainingMs = runAfterDungeonReveal.timerState.resolveRemainingMs;
    if (flippedTileIds.length === 2) {
        resolveRemainingMs = resolvesMatchImmediately
            ? 0
            : computeFlipResolveDelayMs(runAfterDungeonReveal, flippedTileIds, {
                  resolveDelayMultiplier: runAfterDungeonReveal.resolveDelayMultiplier,
                  echoFeedbackEnabled: runAfterDungeonReveal.echoFeedbackEnabled
              });
    } else if (flippedTileIds.length === 3) {
        resolveRemainingMs = MATCH_DELAY_MS * runAfterDungeonReveal.resolveDelayMultiplier;
    }

    return {
        ...runAfterDungeonReveal,
        peekRevealedTileIds,
        status: flippedTileIds.length >= 2 ? 'resolving' : 'playing',
        board: {
            ...revealedBoard,
            tiles: revealedBoard.tiles.map((candidate) =>
                candidate.id === tileId ? { ...candidate, state: 'flipped' } : candidate
            ),
            flippedTileIds
        },
        flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
        timerState: {
            ...runAfterDungeonReveal.timerState,
            resolveRemainingMs,
            pausedFromStatus: null
        }
    };
};

const finalizeLevel = (run: RunState, board: BoardState): RunState => {
    const floorClearHazards = applyFloorClearEnemyHazardDefeats(run, board);
    run = floorClearHazards.run;
    board = floorClearHazards.board;
    const perfect = run.stats.tries === 0;
    const clearLifeReason = getClearLifeReason(run.stats.tries);
    const clearLifeGained = clearLifeReason !== 'none' && run.lives < MAX_LIVES ? 1 : 0;
    const floorClearObjective = getFloorClearObjectiveResult(run, board);
    const bonusTags: string[] = [...floorClearObjective.bonusTags];
    if (run.traitRouteObjectiveCompletedThisFloor) {
        bonusTags.push('trait_route_objective');
    }
    const objectiveBonus = floorClearObjective.objectiveBonus;
    const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
    const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
    const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;
    const bossTrophyCache = getDungeonBossTrophyCacheResult(run, board);

    const clearScore = calculateFloorClearScore({
        bossTrophyCacheScore: bossTrophyCache.score,
        currentLevelScore: run.stats.currentLevelScore,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        floorTag: board.floorTag,
        level: board.level,
        objectiveBonus,
        perfect
    });
    const scoreGained = clearScore.scoreGained;
    if (board.floorTag === 'boss') {
        bonusTags.push('boss_floor');
        bonusTags.push(bossTrophyCache.outcome === 'claimed' ? 'boss_trophy_cache' : 'boss_trophy_forfeited');
    }
    bonusTags.push(...getDungeonLevelResultTags(run, board, perfect));
    const totalScore = run.stats.totalScore + scoreGained - run.stats.currentLevelScore;
    const bestScore = Math.max(run.stats.bestScore, totalScore);
    const rating = calculateRating(run.stats.tries);
    const lives = Math.min(MAX_LIVES, run.lives + clearLifeGained);
    const totalRelicFavorGained =
        featuredObjectiveClear.relicFavorGained + featuredObjectiveClear.endlessRiskWagerFavorGained;
    const relicFavor = gainRelicFavor(run, totalRelicFavorGained);
    const routeChoices: LevelResult['routeChoices'] =
        run.gameMode === 'endless' && board.level > 0 ? generateRouteChoices(run, board.level + 1) : undefined;
    const currentDungeonRun = getRunDungeonMapState(run);
    const dungeonRun = routeChoices
        ? revealDungeonChoices(currentDungeonRun, board.level, routeChoices)
        : clearCurrentDungeonNode(currentDungeonRun, board.level);
    const parasiteFloors =
        featuredObjectiveId != null
            ? getParasiteFloorsAfterFeaturedObjectiveClear(run, featuredObjectiveCompleted)
            : run.parasiteFloors;
    const lastLevelResult = createFloorClearLevelResult({
        bossTrophyCacheOutcome: bossTrophyCache.outcome,
        bossTrophyCacheScore: bossTrophyCache.score,
        bonusTags,
        clearLifeGained,
        clearLifeReason,
        endlessRiskWagerFavorGained: featuredObjectiveClear.endlessRiskWagerFavorGained,
        endlessRiskWagerOutcome: featuredObjectiveClear.endlessRiskWagerOutcome,
        endlessRiskWagerStreakLost: featuredObjectiveClear.endlessRiskWagerStreakLost,
        featuredObjectiveCompleted,
        featuredObjectiveId,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
        level: board.level,
        livesRemaining: lives,
        mistakes: run.stats.tries,
        objectiveBonusScore: objectiveBonus,
        perfect,
        rating,
        relicFavorGained: totalRelicFavorGained,
        routeChoices,
        run,
        scoreGained,
        traitRouteObjectiveCompleted: run.traitRouteObjectiveCompletedThisFloor,
        traitRouteObjectiveProgress: run.traitRouteObjectiveProgressThisFloor,
        traitRouteObjectiveRequired: run.traitRouteObjectiveRequiredThisFloor,
        traitRouteObjectiveReward: run.traitRouteObjectiveRewardTextThisFloor ?? undefined
    });

    return {
        ...run,
        status: 'levelComplete',
        lives,
        bonusRelicPicksNextOffer: relicFavor.bonusRelicPicksNextOffer,
        favorBonusRelicPicksNextOffer: relicFavor.favorBonusRelicPicksNextOffer,
        relicFavorProgress: relicFavor.relicFavorProgress,
        shopGold: run.shopGold + getShopGoldRewardForFloor(board.level),
        shopOffers: run.shopOffers,
        parasiteFloors,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        endlessRiskWager: featuredObjectiveClear.activeEndlessRiskWager ? null : run.endlessRiskWager,
        gauntletDeadlineMs:
            run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
                ? run.gauntletDeadlineMs + GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS
                : run.gauntletDeadlineMs,
        board,
        pinnedTileIds: [],
        peekRevealedTileIds: [],
        flashPairRevealedTileIds: [],
        strayRemoveArmed: false,
        regionShuffleRowArmed: null,
        stickyBlockIndex: null,
        dungeonRun,
        stats: {
            ...run.stats,
            totalScore,
            bestScore,
            currentLevelScore: scoreGained,
            rating,
            levelsCleared: run.stats.levelsCleared + 1,
            highestLevel: Math.max(run.stats.highestLevel, board.level),
            perfectClears: perfect ? run.stats.perfectClears + 1 : run.stats.perfectClears
        },
        timerState: {
            ...run.timerState,
            resolveRemainingMs: null,
            pausedFromStatus: null
        },
        lastLevelResult
    };
};

export const applyDestroyPair = (run: RunState, tileId: string): RunState => {
    const transition = applyDestroyPairTransition(run, tileId, {
        isBoardComplete,
        rotateShiftingSpotlight: rotateRunShiftingSpotlight
    });

    if (!transition.changed) {
        return run;
    }

    return transition.boardComplete && transition.run.board
        ? finalizeLevel(transition.run, transition.run.board)
        : transition.run;
};

export const activateDungeonExit = (
    run: RunState,
    spend: DungeonExitActivationSpend = 'none'
): RunState => {
    const transition = createDungeonExitActivationTransition(run, spend);
    if (!transition) {
        return run;
    }
    return finalizeLevel(transition.run, transition.board);
};

const resolveGambitThree = (run: RunState, encorePairKeys: string[]): RunState => {
    if (!run.board || run.board.flippedTileIds.length !== 3) {
        return run;
    }
    const [aId, bId, cId] = run.board.flippedTileIds;
    const ta = run.board.tiles.find((t) => t.id === aId)!;
    const tb = run.board.tiles.find((t) => t.id === bId)!;
    const tc = run.board.tiles.find((t) => t.id === cId)!;
    const selection = selectGambitMatchedPair(run.board);

    if (selection) {
        const { firstTileId: matchA, secondTileId: matchB, thirdTileId: thirdId } = selection;
        const tileMatchA = run.board.tiles.find((t) => t.id === matchA)!;
        const tileMatchB = run.board.tiles.find((t) => t.id === matchB)!;
        const matchClaimContext = deriveMatchClaimContext({
            firstTile: tileMatchA,
            firstTileId: matchA,
            run,
            secondTile: tileMatchB,
            secondTileId: matchB
        });
        const {
            anchorSealClaimed,
            catalystAltarUpgraded,
            dungeonReward,
            dungeonTrapResolvedDelta,
            findableComboShardGain,
            findableSafeHazardWardGain,
            findableScoreBonus,
            findablesClaimedDelta,
            loadedGatewayClaimed,
            matchedDungeonKeyKind,
            matchedDungeonKind,
            matchedPairKey,
            mimicCacheBite,
            mimicCacheClaimed,
            mimicCacheFatalBite,
            mimicCacheGuardBite,
            parasiteVesselConverted,
            pinLatticeRewarded,
            routeCardReward,
            usedWild
        } = matchClaimContext;

        const resolution = resolveTurnMatchBoardResolution({
            run,
            board: run.board,
            context: matchClaimContext,
            firstTile: tileMatchA,
            secondTile: tileMatchB,
            firstTileId: matchA,
            secondTileId: matchB,
            thirdTileId: thirdId
        });
        const {
            board,
            findableScout,
            cascadeHazard,
            fragileCacheClaimed,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            enemyDamage,
            hazardDamage,
            lastPairHazardClear,
            lanternScout,
            omenScout
        } = resolution;
        const traitReward = resolveTileTraitEffects({
            run,
            board: run.board,
            sourceTiles: [tileMatchA, tileMatchB],
            source: 'match'
        });
        const scoring = resolveTurnMatchScoringSummary({
            run,
            sourceBoard: run.board,
            resolvedBoard: board,
            matchedPairKey,
            matchedTiles: [tileMatchA, tileMatchB],
            encorePairKeys,
            findableScoreBonus: findableScoreBonus + traitReward.scoreBonus,
            routeCardScore: routeCardReward.score,
            dungeonScore: dungeonReward.score,
            enemyDamageScore: enemyDamage.score,
            hazardDamageScore: hazardDamage.score,
            fragileCacheClaimed,
            fuseCacheFresh,
            pinLatticeRewarded,
            tollCacheClaimed
        });
        const survivalReward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded,
            currentStreak: scoring.currentStreak,
            dungeonReward,
            findableComboShardGain: findableComboShardGain + traitReward.comboShardGain,
            mimicCacheBite,
            mimicCacheFatalBite,
            mimicCacheGuardBite,
            routeCardReward,
            run
        });
        const traitRouteObjective = applyTraitRouteObjectiveProgress(run, traitReward.interactionTags);
        const lives = survivalReward.lives;
        const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor + traitReward.relicFavorGain);
        const wildMatchesRemaining = usedWild ? 0 : run.wildMatchesRemaining;

        const spunG = rotateAnchorSealPressure(run, board);
        const followup = resolveTurnMatchFollowup({
            run,
            matchedPairKey,
            encoreKey: scoring.encoreKey,
            loadedGatewayClaimed,
            dungeonGatewayRouteType: dungeonReward.gatewayRouteType
        });
        const boardCleanup = resolveTurnMatchBoardCleanup({
            run,
            board: run.board,
            matchedTileIds: [matchA, matchB],
            firstMatchedTileId: matchA,
            recallBonus: scoring.recallBonus
        });
        const economy = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: routeCardReward.shopGold,
            dungeonShopGold: dungeonReward.shopGold,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            matchedDungeonKind,
            matchedDungeonKeyKind
        });
        const defeatedDungeonEnemies =
            dungeonReward.enemiesDefeated +
            enemyDamage.defeated +
            hazardDamage.bossDefeated +
            lastPairHazardClear.bossesDefeated;
        const defeatedEnemyHazards = hazardDamage.defeated + lastPairHazardClear.defeated;
        const progress = resolveTurnMatchProgress({
            run,
            cursedMatchedEarly: scoring.cursedMatchedEarly,
            findablesClaimedDelta,
            routeCardSafeHazardWardCharges: routeCardReward.safeHazardWardCharges,
            findableSafeHazardWardGain,
            cascadeHazardTriggered: cascadeHazard.triggered,
            fragileCacheClaimed,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            lanternScouted: lanternScout.scouted,
            findableScouted: findableScout.scouted,
            omenScouted: omenScout.scouted,
            mimicCacheClaimed,
            mimicCacheBite,
            mimicCacheGuardBite,
            anchorSealUsed: spunG.anchorSealUsed,
            anchorSealClaimed,
            loadedGatewayClaimed,
            catalystAltarUpgraded,
            parasiteVesselConverted,
            pinLatticeRewarded,
            defeatedDungeonEnemies,
            defeatedEnemyHazards,
            openedDungeonTreasures: dungeonReward.treasuresOpened,
            resolvedDungeonTraps: dungeonTrapResolvedDelta,
            usedDungeonGateways: dungeonReward.gatewaysUsed
        });

        const nextRun: RunState = {
            ...run,
            gambitThirdFlipUsed: true,
            gambitAvailableThisFloor: false,
            powersUsedThisRun: true,
            status: mimicCacheFatalBite ? 'gameOver' : 'playing',
            lives,
            board: spunG.board,
            shiftingSpotlightNonce: spunG.shiftingSpotlightNonce,
            wildMatchesRemaining,
            peekCharges: run.peekCharges + traitReward.peekChargeGain,
            shuffleCharges: run.shuffleCharges + traitReward.shuffleChargeGain,
            regionShuffleCharges: run.regionShuffleCharges + traitReward.regionShuffleChargeGain,
            flashPairCharges: run.flashPairCharges + traitReward.flashPairChargeGain,
            shopGold: economy.shopGold + traitReward.shopGoldGain,
            dungeonKeys: economy.dungeonKeys,
            bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: routeFavor.relicFavorProgress,
            nBackMatchCounter: followup.nBackMatchCounter,
            nBackAnchorPairKey: followup.nBackAnchorPairKey,
            matchedPairKeysThisRun: [...run.matchedPairKeysThisRun, scoring.encoreKey],
            pendingRouteCardPlan: followup.pendingRouteCardPlan,
            pinnedTileIds: boardCleanup.pinnedTileIds,
            recallFocus: Math.min(RECALL_FOCUS_MAX, boardCleanup.recallFocus + traitReward.recallFocusGain),
            recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
            recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
            forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
            stickyBlockIndex: traitReward.stickyBlockIndex ?? boardCleanup.stickyBlockIndex,
            ...traitRouteObjective.runPatch,
            ...progress,
            stats: {
                ...run.stats,
                totalScore: scoring.totalScore + traitRouteObjective.scoreBonus,
                currentLevelScore: scoring.currentLevelScore + traitRouteObjective.scoreBonus,
                bestScore: Math.max(scoring.bestScore, scoring.totalScore + traitRouteObjective.scoreBonus),
                matchesFound: run.stats.matchesFound + 1,
                currentStreak: scoring.currentStreak,
                bestStreak: Math.max(run.stats.bestStreak, scoring.currentStreak),
                highestLevel: Math.max(run.stats.highestLevel, board.level),
                guardTokens: Math.min(MAX_GUARD_TOKENS, survivalReward.guardTokens + traitReward.guardTokenGain),
                comboShards: Math.min(MAX_COMBO_SHARDS, survivalReward.comboShards + traitRouteObjective.comboShardGain),
                tileTraitMatches: addTileTraitCountStats(run.stats.tileTraitMatches, [tileMatchA, tileMatchB])
            },
            timerState: clearResolveState(run)
        };
        const cleanedNextRun = clearFinalPairEnemyHazardOccupationForRun(nextRun);
        const completionBoard = cleanedNextRun.board ?? spunG.board;
        return cleanedNextRun.status === 'gameOver'
            ? cleanedNextRun
            : isBoardComplete(completionBoard)
              ? finalizeLevel(cleanedNextRun, completionBoard)
              : cleanedNextRun;
    }

    const gambitDecoy =
        ta.pairKey === DECOY_PAIR_KEY || tb.pairKey === DECOY_PAIR_KEY || tc.pairKey === DECOY_PAIR_KEY;
    const mismatch = resolveMismatchTurnTransition({
        run,
        board: run.board,
        tileIds: [aId, bId, cId],
        sourceTiles: [ta, tb, tc],
        triesDelta: GAMBIT_FAIL_EXTRA_TRIES,
        decoyTouched: gambitDecoy
    });
    return {
        ...mismatch,
        gambitThirdFlipUsed: true,
        gambitAvailableThisFloor: false,
        powersUsedThisRun: true
    };
};

const resolveTwoFlippedTiles = (run: RunState, encorePairKeys: string[]): RunState => {
    if (!run.board || run.board.flippedTileIds.length !== 2) {
        return run;
    }

    const [firstId, secondId] = run.board.flippedTileIds;
    const firstTile = run.board.tiles.find((tile) => tile.id === firstId);
    const secondTile = run.board.tiles.find((tile) => tile.id === secondId);

    if (!firstTile || !secondTile) {
        return run;
    }

    const isMatch = tilesArePairMatch(firstTile, secondTile);

    if (isMatch) {
        const matchClaimContext = deriveMatchClaimContext({
            firstTile,
            firstTileId: firstId,
            run,
            secondTile,
            secondTileId: secondId
        });
        const {
            anchorSealClaimed,
            catalystAltarUpgraded,
            dungeonReward,
            dungeonTrapResolvedDelta,
            findableComboShardGain,
            findableSafeHazardWardGain,
            findableScoreBonus,
            findablesClaimedDelta,
            loadedGatewayClaimed,
            matchedDungeonKeyKind,
            matchedDungeonKind,
            matchedPairKey,
            mimicCacheBite,
            mimicCacheClaimed,
            mimicCacheFatalBite,
            mimicCacheGuardBite,
            parasiteVesselConverted,
            pinLatticeRewarded,
            routeCardReward,
            usedWild
        } = matchClaimContext;

        const resolution = resolveTurnMatchBoardResolution({
            run,
            board: run.board,
            context: matchClaimContext,
            firstTile,
            secondTile,
            firstTileId: firstId,
            secondTileId: secondId
        });
        const {
            board,
            findableScout,
            cascadeHazard,
            fragileCacheClaimed,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            enemyDamage,
            hazardDamage,
            lastPairHazardClear,
            lanternScout,
            omenScout
        } = resolution;
        const traitReward = resolveTileTraitEffects({
            run,
            board: run.board,
            sourceTiles: [firstTile, secondTile],
            source: 'match'
        });
        const scoring = resolveTurnMatchScoringSummary({
            run,
            sourceBoard: run.board,
            resolvedBoard: board,
            matchedPairKey,
            matchedTiles: [firstTile, secondTile],
            encorePairKeys,
            findableScoreBonus: findableScoreBonus + traitReward.scoreBonus,
            routeCardScore: routeCardReward.score,
            dungeonScore: dungeonReward.score,
            enemyDamageScore: enemyDamage.score,
            hazardDamageScore: hazardDamage.score,
            fragileCacheClaimed,
            fuseCacheFresh,
            pinLatticeRewarded,
            tollCacheClaimed
        });
        const survivalReward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded,
            currentStreak: scoring.currentStreak,
            dungeonReward,
            findableComboShardGain: findableComboShardGain + traitReward.comboShardGain,
            mimicCacheBite,
            mimicCacheFatalBite,
            mimicCacheGuardBite,
            routeCardReward,
            run
        });
        const traitRouteObjective = applyTraitRouteObjectiveProgress(run, traitReward.interactionTags);
        const lives = survivalReward.lives;
        const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor + traitReward.relicFavorGain);

        const wildMatchesRemaining = usedWild ? 0 : run.wildMatchesRemaining;

        const spun = rotateAnchorSealPressure(run, board);
        const followup = resolveTurnMatchFollowup({
            run,
            matchedPairKey,
            encoreKey: scoring.encoreKey,
            loadedGatewayClaimed,
            dungeonGatewayRouteType: dungeonReward.gatewayRouteType
        });
        const boardCleanup = resolveTurnMatchBoardCleanup({
            run,
            board: run.board,
            matchedTileIds: [firstId, secondId],
            firstMatchedTileId: firstId,
            recallBonus: scoring.recallBonus
        });
        const economy = resolveTurnMatchEconomy({
            run,
            routeCardShopGold: routeCardReward.shopGold,
            dungeonShopGold: dungeonReward.shopGold,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            matchedDungeonKind,
            matchedDungeonKeyKind
        });
        const defeatedDungeonEnemies =
            dungeonReward.enemiesDefeated +
            enemyDamage.defeated +
            hazardDamage.bossDefeated +
            lastPairHazardClear.bossesDefeated;
        const defeatedEnemyHazards = hazardDamage.defeated + lastPairHazardClear.defeated;
        const progress = resolveTurnMatchProgress({
            run,
            cursedMatchedEarly: scoring.cursedMatchedEarly,
            findablesClaimedDelta,
            routeCardSafeHazardWardCharges: routeCardReward.safeHazardWardCharges,
            findableSafeHazardWardGain,
            cascadeHazardTriggered: cascadeHazard.triggered,
            fragileCacheClaimed,
            tollCacheClaimed,
            fuseCacheClaimed,
            fuseCacheFresh,
            lanternScouted: lanternScout.scouted,
            findableScouted: findableScout.scouted,
            omenScouted: omenScout.scouted,
            mimicCacheClaimed,
            mimicCacheBite,
            mimicCacheGuardBite,
            anchorSealUsed: spun.anchorSealUsed,
            anchorSealClaimed,
            loadedGatewayClaimed,
            catalystAltarUpgraded,
            parasiteVesselConverted,
            pinLatticeRewarded,
            defeatedDungeonEnemies,
            defeatedEnemyHazards,
            openedDungeonTreasures: dungeonReward.treasuresOpened,
            resolvedDungeonTraps: dungeonTrapResolvedDelta,
            usedDungeonGateways: dungeonReward.gatewaysUsed
        });

        const nextRun: RunState = {
            ...run,
            status: mimicCacheFatalBite ? 'gameOver' : 'playing',
            lives,
            board: spun.board,
            shiftingSpotlightNonce: spun.shiftingSpotlightNonce,
            powersUsedThisRun: usedWild ? true : run.powersUsedThisRun,
            wildMatchesRemaining,
            peekCharges: run.peekCharges + traitReward.peekChargeGain,
            shuffleCharges: run.shuffleCharges + traitReward.shuffleChargeGain,
            regionShuffleCharges: run.regionShuffleCharges + traitReward.regionShuffleChargeGain,
            flashPairCharges: run.flashPairCharges + traitReward.flashPairChargeGain,
            shopGold: economy.shopGold + traitReward.shopGoldGain,
            dungeonKeys: economy.dungeonKeys,
            bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: routeFavor.relicFavorProgress,
            nBackMatchCounter: followup.nBackMatchCounter,
            nBackAnchorPairKey: followup.nBackAnchorPairKey,
            matchedPairKeysThisRun: [...run.matchedPairKeysThisRun, scoring.encoreKey],
            pendingRouteCardPlan: followup.pendingRouteCardPlan,
            pinnedTileIds: boardCleanup.pinnedTileIds,
            recallFocus: Math.min(RECALL_FOCUS_MAX, boardCleanup.recallFocus + traitReward.recallFocusGain),
            recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
            recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
            forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
            stickyBlockIndex: traitReward.stickyBlockIndex ?? boardCleanup.stickyBlockIndex,
            ...traitRouteObjective.runPatch,
            ...progress,
            stats: {
                ...run.stats,
                totalScore: scoring.totalScore + traitRouteObjective.scoreBonus,
                currentLevelScore: scoring.currentLevelScore + traitRouteObjective.scoreBonus,
                bestScore: Math.max(scoring.bestScore, scoring.totalScore + traitRouteObjective.scoreBonus),
                matchesFound: run.stats.matchesFound + 1,
                currentStreak: scoring.currentStreak,
                bestStreak: Math.max(run.stats.bestStreak, scoring.currentStreak),
                highestLevel: Math.max(run.stats.highestLevel, board.level),
                guardTokens: Math.min(MAX_GUARD_TOKENS, survivalReward.guardTokens + traitReward.guardTokenGain),
                comboShards: Math.min(MAX_COMBO_SHARDS, survivalReward.comboShards + traitRouteObjective.comboShardGain),
                tileTraitMatches: addTileTraitCountStats(run.stats.tileTraitMatches, [firstTile, secondTile])
            },
            timerState: clearResolveState(run)
        };

        const cleanedNextRun = clearFinalPairEnemyHazardOccupationForRun(nextRun);
        const completionBoard = cleanedNextRun.board ?? spun.board;
        return cleanedNextRun.status === 'gameOver'
            ? cleanedNextRun
            : isBoardComplete(completionBoard)
              ? finalizeLevel(cleanedNextRun, completionBoard)
              : cleanedNextRun;
    }

    const decoyTouch =
        firstTile.pairKey === DECOY_PAIR_KEY || secondTile.pairKey === DECOY_PAIR_KEY;
    return resolveMismatchTurnTransition({
        run,
        board: run.board,
        tileIds: [firstId, secondId],
        sourceTiles: [firstTile, secondTile],
        triesDelta: 1,
        decoyTouched: decoyTouch
    });
};

export const resolveBoardTurn = (run: RunState, encorePairKeys: string[] = []): RunState => {
    if (run.status === 'gameOver') {
        return run;
    }
    if (!run.board) {
        return run;
    }
    if (run.board.flippedTileIds.length === 3) {
        return resolveGambitThree(run, encorePairKeys);
    }
    if (run.board.flippedTileIds.length !== 2) {
        return run;
    }
    return resolveTwoFlippedTiles(run, encorePairKeys);
};
