import {
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    MAX_LIVES,
    type BoardState,
    type LevelResult,
    type RunState
} from './contracts';
import { getDungeonLevelResultTags } from './secondary-objectives';
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
export {
    ENEMY_HAZARD_PATTERN_DEFINITIONS,
    applyEnemyHazardClick,
    getEnemyHazardMovementCandidateIds,
    type EnemyHazardPatternDefinition
} from './dungeon-enemy-hazard-rules';
import { getDungeonBossTrophyCacheResult } from './dungeon-boss-clear-rules';
import { calculateRating } from './scoring-rules';
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
    clearResolveState,
    extendTimerTimestampMs
} from './run-timer-rules';
import { getShopGoldRewardForFloor } from './shop-rules';
import { hasMutator } from './mutators';
import {
    getParasiteFloorsAfterFeaturedObjectiveClear
} from './score-parasite-rules';
import { createFlipTileTransition } from './flip-tile-transition';
import { createActivateDungeonExit, createApplyDestroyPair } from './floor-completion-transitions';
import { createResolveBoardTurnTransition } from './board-turn-transition';
import { appendGameplayJournal } from './gameplay-journal';
import {
    consumeWildMatchThroughGameplayCore,
    resolveBoardTurnThroughGameplayCore,
    resolveFindableMatchRewardThroughGameplayCore,
    resolveSlayerFloorClearThroughGameplayCore
} from './gameplay-core-adapters';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';
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
export {
    chooseDungeonExitActivationSpend,
    type DungeonExitActivationSpend
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

export const finalizeLevel = (run: RunState, board: BoardState): RunState => {
    const floorClearHazards = applyFloorClearEnemyHazardDefeats(run, board);
    run = floorClearHazards.run;
    board = floorClearHazards.board;
    const stats = normalizeSessionStats(run.stats);
    const tries = runNonNegativeInteger(stats.tries);
    const livesBeforeClear = runNonNegativeInteger(run.lives);
    const currentLevelScoreBeforeClear = runNonNegativeInteger(stats.currentLevelScore);
    const totalScoreBeforeClear = runNonNegativeInteger(stats.totalScore);
    const perfect = tries === 0;
    const clearLifeReason = getClearLifeReason(tries);
    const clearLifeGained = clearLifeReason !== 'none' && livesBeforeClear < MAX_LIVES ? 1 : 0;
    const legacyFloorClearObjective = getFloorClearObjectiveResult(run, board);
    const legacyBossTrophyCache = getDungeonBossTrophyCacheResult(run, board);
    const slayerFloorClear = resolveSlayerFloorClearThroughGameplayCore(
        run,
        {
            bossTrophyClaimed: legacyBossTrophyCache.outcome === 'claimed',
            riskWagerOutcome: legacyFloorClearObjective.featuredObjectiveClear.endlessRiskWagerOutcome,
            featuredObjectiveCompleted: legacyFloorClearObjective.featuredObjectiveCompleted,
            scoreParasiteActive: hasMutator(run, 'score_parasite')
        },
        `floor-clear:${run.runSeed}:${board.level}`
    );
    const floorClearObjective = getFloorClearObjectiveResult(run, board, {
        wagerSuretyFavorBonus: slayerFloorClear.riskWagerFavorGain,
        wagerSuretyLossStreakFloor: slayerFloorClear.riskWagerStreakFloor
    });
    const bonusTags: string[] = [...floorClearObjective.bonusTags];
    if (run.traitRouteObjectiveCompletedThisFloor) {
        bonusTags.push('trait_route_objective');
    }
    const objectiveBonus = floorClearObjective.objectiveBonus;
    const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
    const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
    const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;
    const bossTrophyCache = getDungeonBossTrophyCacheResult(run, board, {
        chapterCompassScoreBonus: slayerFloorClear.bossTrophyScoreGain
    });

    const clearScore = calculateFloorClearScore({
        bossTrophyCacheScore: bossTrophyCache.score,
        currentLevelScore: currentLevelScoreBeforeClear,
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
    const bankedScoreBeforeClear = Math.max(0, totalScoreBeforeClear - currentLevelScoreBeforeClear);
    const totalScore = bankedScoreBeforeClear + scoreGained;
    const bestScore = Math.max(runNonNegativeInteger(stats.bestScore), totalScore);
    const rating = calculateRating(tries);
    const lives = Math.min(MAX_LIVES, livesBeforeClear + clearLifeGained);
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
            ? getParasiteFloorsAfterFeaturedObjectiveClear(run, featuredObjectiveCompleted, {
                  reliefAmount: slayerFloorClear.parasiteRelief
              })
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
        mistakes: tries,
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

    const journaledRun = appendGameplayJournal(run, slayerFloorClear.commands, slayerFloorClear.events);
    return {
        ...journaledRun,
        status: 'levelComplete',
        lives,
        bonusRelicPicksNextOffer: relicFavor.bonusRelicPicksNextOffer,
        favorBonusRelicPicksNextOffer: relicFavor.favorBonusRelicPicksNextOffer,
        relicFavorProgress: relicFavor.relicFavorProgress,
        shopGold: runNonNegativeInteger(run.shopGold) + getShopGoldRewardForFloor(board.level),
        shopOffers: run.shopOffers,
        parasiteFloors,
        featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
        endlessRiskWager: featuredObjectiveClear.activeEndlessRiskWager ? null : run.endlessRiskWager,
        gauntletDeadlineMs:
            run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
                ? extendTimerTimestampMs(run.gauntletDeadlineMs, GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS)
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
            ...stats,
            totalScore,
            bestScore,
            currentLevelScore: scoreGained,
            rating,
            levelsCleared: runNonNegativeInteger(stats.levelsCleared) + 1,
            highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), board.level),
            perfectClears: perfect
                ? runNonNegativeInteger(stats.perfectClears) + 1
                : runNonNegativeInteger(stats.perfectClears)
        },
        timerState: clearResolveState(run),
        lastLevelResult
    };
};

export const flipTile = createFlipTileTransition({ finalizeLevel });

export const applyDestroyPair = createApplyDestroyPair({ finalizeLevel });

export const activateDungeonExit = createActivateDungeonExit({ finalizeLevel });



const resolveBoardTurnCompatibility = createResolveBoardTurnTransition({
    finalizeLevel,
    resolveFindableMatchReward: resolveFindableMatchRewardThroughGameplayCore,
    consumeWildMatch: consumeWildMatchThroughGameplayCore
});

export const resolveBoardTurn = (run: RunState, encorePairKeys: string[] = []): RunState => {
    const migrated = resolveBoardTurnThroughGameplayCore(
        run,
        encorePairKeys,
        `board-turn:${run.runSeed}:${run.board?.level ?? 0}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${runNonNegativeInteger(normalizeSessionStats(run.stats).tries)}`
    );
    return migrated.migrated
        ? appendGameplayJournal(migrated.run, [migrated.command], migrated.events)
        : resolveBoardTurnCompatibility(run, encorePairKeys);
};
