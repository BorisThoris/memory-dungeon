import { type RunState } from './contracts';
export {
    applyRelicOfferServiceToRun,
    computeRelicOfferPickBudget,
    openRelicOffer,
    useRelicOfferService
} from './relic-offer-rules';
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
import { createFlipTileTransition } from './flip-tile-transition';
import { createActivateDungeonExit, createApplyDestroyPair } from './floor-completion-transitions';
import { createResolveBoardTurnTransition } from './board-turn-transition';
import { createFinalizeLevelTransition } from './floor-clear-transition';
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
export { togglePinnedTile } from './board-power-state';
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

export const finalizeLevel = createFinalizeLevelTransition({
    resolveSlayerFloorClear: resolveSlayerFloorClearThroughGameplayCore,
    appendGameplayJournal
});

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
