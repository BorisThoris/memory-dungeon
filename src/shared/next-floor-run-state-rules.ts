import {
    INITIAL_REGION_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RunState
} from './contracts';
import { hasRewardPerk } from './bonus-rewards';
import {
    boardHasGlassDecoy,
    getWildTileIdFromBoard
} from './board-inspection';
import { countFindablePairs } from './board-tile-generation-rules';
import { createTimerState } from './run-timer-rules';
import { calculateRating } from './scoring-rules';
import { hasRunRelic } from './relics';
import { normalizeSessionStats } from './session-stats-rules';
import { getTraitRouteObjectiveSeed } from './trait-route-objectives';
import { resolveHazardBanisherFloorStart } from './hazard-banisher-rules';

export interface CreateNextFloorRunStateOptions {
    lives: number;
    activeMutators: MutatorId[];
    dungeonRun: RunState['dungeonRun'];
    board: BoardState;
    parasiteFloors: number;
    parasiteWardRemaining: number;
    memorizeRemainingMs: number;
}

export const createNextFloorRunState = (
    run: RunState,
    options: CreateNextFloorRunStateOptions,
    behavior: { resolveHazardBanish?: boolean } = {}
): RunState => {
    const nextBoard = options.board;
    const traitRouteObjective = getTraitRouteObjectiveSeed(nextBoard);
    const stats = normalizeSessionStats(run.stats);

    const nextRun: RunState = {
        ...run,
        status: 'memorize',
        lives: options.lives,
        activeMutators: options.activeMutators,
        dungeonRun: options.dungeonRun,
        pendingRouteCardPlan: null,
        sideRoom: null,
        board: nextBoard,
        debugPeekActive: false,
        pendingMemorizeBonusMs: 0,
        pinnedTileIds: [],
        destroyPairCharges: run.destroyPairCharges,
        parasiteFloors: options.parasiteFloors,
        parasiteWardRemaining: options.parasiteWardRemaining,
        stickyBlockIndex: null,
        freeShuffleThisFloor: hasRunRelic(run, 'first_shuffle_free_per_floor'),
        regionShuffleFreeThisFloor:
            hasRunRelic(run, 'region_shuffle_free_first') || hasRewardPerk(run, 'free_first_swap_per_floor'),
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        peekRevealedTileIds: [],
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(nextBoard),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(nextBoard.tiles),
        recallFocus: 0,
        recallMatchesThisFloor: 0,
        recallMistakesThisFloor: 0,
        recallBonusScoreThisFloor: 0,
        forgottenTileIdsThisFloor: [],
        hazardTileTriggersThisFloor: 0,
        hazardShuffleSnaresThisFloor: 0,
        hazardCascadeCachesThisFloor: 0,
        hazardMirrorDecoysThisFloor: 0,
        hazardFragileCacheClaimsThisFloor: 0,
        hazardFragileCacheBreaksThisFloor: 0,
        hazardTollCachesThisFloor: 0,
        hazardFuseCachesThisFloor: 0,
        hazardFuseCacheExpiredClaimsThisFloor: 0,
        lanternWardScoutsThisFloor: 0,
        omenSealScoutsThisFloor: 0,
        mimicCacheClaimsThisFloor: 0,
        mimicCacheBitesThisFloor: 0,
        mimicCacheGuardBitesThisFloor: 0,
        anchorSealChargesThisFloor: 0,
        anchorSealUsesThisFloor: 0,
        loadedGatewayPlansThisFloor: 0,
        catalystAltarUpgradesThisFloor: 0,
        parasiteVesselConversionsThisFloor: 0,
        pinLatticeRewardsThisFloor: 0,
        safeHazardWardChargesThisFloor: 0,
        safeHazardWardsUsedThisFloor: 0,
        shiftingSpotlightNonce: 0,
        flashPairRevealedTileIds: [],
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        traitRouteObjectiveProgressThisFloor: 0,
        traitRouteObjectiveRequiredThisFloor: traitRouteObjective?.required ?? 0,
        traitRouteObjectiveCompletedThisFloor: false,
        traitRouteObjectiveRewardClaimedThisFloor: false,
        traitRouteObjectiveRewardTextThisFloor: null,
        traitRouteObjectiveTriggeredTagsThisFloor: [],
        shopOffers: [],
        shopRerolls: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonShopVisitedThisFloor: false,
        enemyHazardHitsThisFloor: 0,
        enemyHazardsDefeatedThisFloor: 0,
        wildTileId: getWildTileIdFromBoard(nextBoard),
        timerState: createTimerState({ memorizeRemainingMs: options.memorizeRemainingMs }),
        lastLevelResult: null,
        stats: {
            ...stats,
            tries: 0,
            currentLevelScore: 0,
            rating: calculateRating(0),
            highestLevel: Math.max(stats.highestLevel, nextBoard.level),
            currentStreak: 0
        }
    };
    if (behavior.resolveHazardBanish === false || !hasRewardPerk(run, 'hazard_banish_per_floor')) {
        return nextRun;
    }
    const resolved = resolveHazardBanisherFloorStart(nextRun);
    if (resolved.outcome === 'inactive') {
        throw new Error('Hazard Banish was active before next-floor construction but inactive after it.');
    }
    return resolved.run;
};
