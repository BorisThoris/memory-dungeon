import type { RunState } from './contracts';
import type { ChainTier } from './chain-tier-rules';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchProgressResult {
    cursedMatchedEarlyThisFloor: boolean;
    matchResolutionsThisFloor: number;
    findablesClaimedThisFloor: number;
    safeHazardWardChargesThisFloor: number;
    hazardTileTriggersThisFloor: number;
    hazardCascadeCachesThisFloor: number;
    chunkBreaksThisFloor: number;
    chunkPairsBrokenThisFloor: number;
    chunkScoreThisFloor: number;
    chunkPairsThisChain: number;
    feverBreaksThisFloor: number;
    bestChainThisFloor: number;
    feverBreaksThisRun: number;
    biggestChunkPairs: number;
    chunkWardenKills: number;
    bestChainThisRun: number;
    hazardFragileCacheClaimsThisFloor: number;
    hazardTollCachesThisFloor: number;
    hazardFuseCachesThisFloor: number;
    hazardFuseCacheExpiredClaimsThisFloor: number;
    lanternWardScoutsThisFloor: number;
    omenSealScoutsThisFloor: number;
    mimicCacheClaimsThisFloor: number;
    mimicCacheBitesThisFloor: number;
    mimicCacheGuardBitesThisFloor: number;
    anchorSealChargesThisFloor: number;
    anchorSealUsesThisFloor: number;
    loadedGatewayPlansThisFloor: number;
    catalystAltarUpgradesThisFloor: number;
    parasiteVesselConversionsThisFloor: number;
    pinLatticeRewardsThisFloor: number;
    parasiteFloors: number;
    dungeonEnemiesDefeated: number;
    dungeonEnemiesDefeatedThisFloor: number;
    enemyHazardsDefeatedThisFloor: number;
    dungeonTreasuresOpened: number;
    dungeonTreasuresOpenedThisFloor: number;
    dungeonTrapsResolvedThisFloor: number;
    dungeonGatewaysUsed: number;
    dungeonGatewaysUsedThisFloor: number;
}

export interface TurnMatchProgressInput {
    run: RunState;
    /** Pairs the chunk break took this turn; zero when the chain did not buy one. */
    chunkPairsBroken: number;
    chunkScore: number;
    /** The tier the break landed at, and the chain the run holds after this match. */
    chunkTier: ChainTier;
    chainAfter: number;
    /** Wardens the chunk finished this turn. */
    chunkWardensDefeated: number;
    cursedMatchedEarly: boolean;
    findablesClaimedDelta: number;
    routeCardSafeHazardWardCharges: number;
    findableSafeHazardWardGain: number;
    cascadeHazardTriggered: boolean;
    fragileCacheClaimed: boolean;
    tollCacheClaimed: boolean;
    fuseCacheClaimed: boolean;
    fuseCacheFresh: boolean;
    lanternScouted: boolean;
    findableScouted: boolean;
    omenScouted: boolean;
    mimicCacheClaimed: boolean;
    mimicCacheBite: boolean;
    mimicCacheGuardBite: boolean;
    anchorSealUsed: boolean;
    anchorSealClaimed: boolean;
    loadedGatewayClaimed: boolean;
    catalystAltarUpgraded: boolean;
    parasiteVesselConverted: boolean;
    pinLatticeRewarded: boolean;
    defeatedDungeonEnemies: number;
    defeatedEnemyHazards: number;
    openedDungeonTreasures: number;
    resolvedDungeonTraps: number;
    usedDungeonGateways: number;
}

export const resolveTurnMatchProgress = ({
    run,
    chunkPairsBroken,
    chunkScore,
    chunkTier,
    chainAfter,
    chunkWardensDefeated,
    cursedMatchedEarly,
    findablesClaimedDelta,
    routeCardSafeHazardWardCharges,
    findableSafeHazardWardGain,
    cascadeHazardTriggered,
    fragileCacheClaimed,
    tollCacheClaimed,
    fuseCacheClaimed,
    fuseCacheFresh,
    lanternScouted,
    findableScouted,
    omenScouted,
    mimicCacheClaimed,
    mimicCacheBite,
    mimicCacheGuardBite,
    anchorSealUsed,
    anchorSealClaimed,
    loadedGatewayClaimed,
    catalystAltarUpgraded,
    parasiteVesselConverted,
    pinLatticeRewarded,
    defeatedDungeonEnemies,
    defeatedEnemyHazards,
    openedDungeonTreasures,
    resolvedDungeonTraps,
    usedDungeonGateways
}: TurnMatchProgressInput): TurnMatchProgressResult => {
    const safeFindablesClaimedDelta = runNonNegativeInteger(findablesClaimedDelta);
    const safeRouteWardCharges = runNonNegativeInteger(routeCardSafeHazardWardCharges);
    const safeFindableWardGain = runNonNegativeInteger(findableSafeHazardWardGain);
    const safeDefeatedDungeonEnemies = runNonNegativeInteger(defeatedDungeonEnemies);
    const safeDefeatedEnemyHazards = runNonNegativeInteger(defeatedEnemyHazards);
    const safeOpenedDungeonTreasures = runNonNegativeInteger(openedDungeonTreasures);
    const safeResolvedDungeonTraps = runNonNegativeInteger(resolvedDungeonTraps);
    const safeUsedDungeonGateways = runNonNegativeInteger(usedDungeonGateways);

    return {
        cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedMatchedEarly,
        matchResolutionsThisFloor: runNonNegativeInteger(run.matchResolutionsThisFloor) + 1,
        findablesClaimedThisFloor: runNonNegativeInteger(run.findablesClaimedThisFloor) + safeFindablesClaimedDelta,
        safeHazardWardChargesThisFloor: Math.min(
            1,
            runNonNegativeInteger(run.safeHazardWardChargesThisFloor) + safeRouteWardCharges + safeFindableWardGain
        ),
        hazardTileTriggersThisFloor:
            runNonNegativeInteger(run.hazardTileTriggersThisFloor) +
            (cascadeHazardTriggered ? 1 : 0) +
            (fragileCacheClaimed ? 1 : 0) +
            (tollCacheClaimed ? 1 : 0) +
            (fuseCacheClaimed ? 1 : 0),
        hazardCascadeCachesThisFloor:
            runNonNegativeInteger(run.hazardCascadeCachesThisFloor) + (cascadeHazardTriggered ? 1 : 0),
        chunkBreaksThisFloor:
            runNonNegativeInteger(run.chunkBreaksThisFloor) + (runNonNegativeInteger(chunkPairsBroken) > 0 ? 1 : 0),
        chunkPairsBrokenThisFloor:
            runNonNegativeInteger(run.chunkPairsBrokenThisFloor) + runNonNegativeInteger(chunkPairsBroken),
        chunkScoreThisFloor: runNonNegativeInteger(run.chunkScoreThisFloor) + runNonNegativeInteger(chunkScore),
        chunkPairsThisChain: runNonNegativeInteger(run.chunkPairsThisChain) + runNonNegativeInteger(chunkPairsBroken),
        feverBreaksThisFloor:
            runNonNegativeInteger(run.feverBreaksThisFloor) +
            (runNonNegativeInteger(chunkPairsBroken) > 0 && chunkTier === 'fever' ? 1 : 0),
        bestChainThisFloor: Math.max(runNonNegativeInteger(run.bestChainThisFloor), runNonNegativeInteger(chainAfter)),
        feverBreaksThisRun:
            runNonNegativeInteger(run.feverBreaksThisRun) +
            (runNonNegativeInteger(chunkPairsBroken) > 0 && chunkTier === 'fever' ? 1 : 0),
        biggestChunkPairs: Math.max(runNonNegativeInteger(run.biggestChunkPairs), runNonNegativeInteger(chunkPairsBroken)),
        chunkWardenKills: runNonNegativeInteger(run.chunkWardenKills) + runNonNegativeInteger(chunkWardensDefeated),
        bestChainThisRun: Math.max(runNonNegativeInteger(run.bestChainThisRun), runNonNegativeInteger(chainAfter)),
        hazardFragileCacheClaimsThisFloor:
            runNonNegativeInteger(run.hazardFragileCacheClaimsThisFloor) + (fragileCacheClaimed ? 1 : 0),
        hazardTollCachesThisFloor:
            runNonNegativeInteger(run.hazardTollCachesThisFloor) + (tollCacheClaimed ? 1 : 0),
        hazardFuseCachesThisFloor:
            runNonNegativeInteger(run.hazardFuseCachesThisFloor) + (fuseCacheClaimed ? 1 : 0),
        hazardFuseCacheExpiredClaimsThisFloor:
            runNonNegativeInteger(run.hazardFuseCacheExpiredClaimsThisFloor) + (fuseCacheClaimed && !fuseCacheFresh ? 1 : 0),
        lanternWardScoutsThisFloor: runNonNegativeInteger(run.lanternWardScoutsThisFloor) + (lanternScouted ? 1 : 0),
        omenSealScoutsThisFloor:
            runNonNegativeInteger(run.omenSealScoutsThisFloor) + (findableScouted ? 1 : 0) + (omenScouted ? 1 : 0),
        mimicCacheClaimsThisFloor: runNonNegativeInteger(run.mimicCacheClaimsThisFloor) + (mimicCacheClaimed ? 1 : 0),
        mimicCacheBitesThisFloor: runNonNegativeInteger(run.mimicCacheBitesThisFloor) + (mimicCacheBite ? 1 : 0),
        mimicCacheGuardBitesThisFloor:
            runNonNegativeInteger(run.mimicCacheGuardBitesThisFloor) + (mimicCacheGuardBite ? 1 : 0),
        anchorSealChargesThisFloor:
            decrementRunCounter(run.anchorSealChargesThisFloor, anchorSealUsed ? 1 : 0) +
            (anchorSealClaimed ? 1 : 0),
        anchorSealUsesThisFloor: runNonNegativeInteger(run.anchorSealUsesThisFloor) + (anchorSealUsed ? 1 : 0),
        loadedGatewayPlansThisFloor:
            runNonNegativeInteger(run.loadedGatewayPlansThisFloor) + (loadedGatewayClaimed ? 1 : 0),
        catalystAltarUpgradesThisFloor:
            runNonNegativeInteger(run.catalystAltarUpgradesThisFloor) + (catalystAltarUpgraded ? 1 : 0),
        parasiteVesselConversionsThisFloor:
            runNonNegativeInteger(run.parasiteVesselConversionsThisFloor) + (parasiteVesselConverted ? 1 : 0),
        pinLatticeRewardsThisFloor:
            runNonNegativeInteger(run.pinLatticeRewardsThisFloor) + (pinLatticeRewarded ? 1 : 0),
        parasiteFloors: parasiteVesselConverted
            ? decrementRunCounter(run.parasiteFloors)
            : runNonNegativeInteger(run.parasiteFloors),
        dungeonEnemiesDefeated: runNonNegativeInteger(run.dungeonEnemiesDefeated) + safeDefeatedDungeonEnemies,
        dungeonEnemiesDefeatedThisFloor:
            runNonNegativeInteger(run.dungeonEnemiesDefeatedThisFloor) + safeDefeatedDungeonEnemies,
        enemyHazardsDefeatedThisFloor:
            runNonNegativeInteger(run.enemyHazardsDefeatedThisFloor) + safeDefeatedEnemyHazards,
        dungeonTreasuresOpened: runNonNegativeInteger(run.dungeonTreasuresOpened) + safeOpenedDungeonTreasures,
        dungeonTreasuresOpenedThisFloor:
            runNonNegativeInteger(run.dungeonTreasuresOpenedThisFloor) + safeOpenedDungeonTreasures,
        dungeonTrapsResolvedThisFloor:
            runNonNegativeInteger(run.dungeonTrapsResolvedThisFloor) + safeResolvedDungeonTraps,
        dungeonGatewaysUsed: runNonNegativeInteger(run.dungeonGatewaysUsed) + safeUsedDungeonGateways,
        dungeonGatewaysUsedThisFloor:
            runNonNegativeInteger(run.dungeonGatewaysUsedThisFloor) + safeUsedDungeonGateways
    };
};
