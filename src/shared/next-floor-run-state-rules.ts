import {
    INITIAL_REGION_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RunState
} from './contracts';
import {
    boardHasGlassDecoy,
    getWildTileIdFromBoard
} from './board-inspection';
import { countFindablePairs } from './board-tile-generation-rules';
import { createTimerState } from './run-timer-rules';
import { calculateRating } from './scoring-rules';
import { getTraitRouteObjectiveSeed } from './trait-route-objectives';

export interface CreateNextFloorRunStateOptions {
    lives: number;
    activeMutators: MutatorId[];
    dungeonRun: RunState['dungeonRun'];
    board: BoardState;
    parasiteFloors: number;
    parasiteWardRemaining: number;
    memorizeRemainingMs: number;
}

const banishOneHazardPair = (board: BoardState): { board: BoardState; banished: boolean } => {
    const target = board.tiles.find((tile) =>
        tile.tileHazardKind != null &&
        tile.state !== 'matched' &&
        tile.state !== 'removed'
    );
    if (!target) {
        return { board, banished: false };
    }

    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) =>
                tile.pairKey === target.pairKey && tile.tileHazardKind === target.tileHazardKind
                    ? { ...tile, tileHazardKind: undefined }
                    : tile
            )
        },
        banished: true
    };
};

export const createNextFloorRunState = (
    run: RunState,
    options: CreateNextFloorRunStateOptions
): RunState => {
    const hasRewardPerk = (id: NonNullable<RunState['rewardPerkIds']>[number]): boolean =>
        (run.rewardPerkIds ?? []).includes(id);
    const canUseHazardBanisher = hasRewardPerk('hazard_banish_per_floor') && !run.activeContract?.noDestroy;
    const hazardBanish = canUseHazardBanisher
        ? banishOneHazardPair(options.board)
        : { board: options.board, banished: false };
    const nextBoard = hazardBanish.board;
    const traitRouteObjective = getTraitRouteObjectiveSeed(nextBoard);

    return {
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
        destroyPairCharges:
            run.destroyPairCharges + (canUseHazardBanisher && !hazardBanish.banished ? 1 : 0),
        parasiteFloors: options.parasiteFloors,
        parasiteWardRemaining: options.parasiteWardRemaining,
        stickyBlockIndex: null,
        freeShuffleThisFloor: run.relicIds.includes('first_shuffle_free_per_floor'),
        regionShuffleFreeThisFloor:
            run.relicIds.includes('region_shuffle_free_first') || hasRewardPerk('free_first_swap_per_floor'),
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
        regionShuffleRowArmed: null,
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
            ...run.stats,
            tries: 0,
            currentLevelScore: 0,
            rating: calculateRating(0),
            highestLevel: Math.max(run.stats.highestLevel, nextBoard.level),
            currentStreak: 0
        }
    };
};
