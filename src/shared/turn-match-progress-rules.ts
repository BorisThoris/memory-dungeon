import type { RunState } from './contracts';

const nonNegativeProgressCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export interface TurnMatchProgressResult {
    cursedMatchedEarlyThisFloor: boolean;
    matchResolutionsThisFloor: number;
    findablesClaimedThisFloor: number;
    safeHazardWardChargesThisFloor: number;
    hazardTileTriggersThisFloor: number;
    hazardCascadeCachesThisFloor: number;
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
    const safeFindablesClaimedDelta = nonNegativeProgressCount(findablesClaimedDelta);
    const safeRouteWardCharges = nonNegativeProgressCount(routeCardSafeHazardWardCharges);
    const safeFindableWardGain = nonNegativeProgressCount(findableSafeHazardWardGain);
    const safeDefeatedDungeonEnemies = nonNegativeProgressCount(defeatedDungeonEnemies);
    const safeDefeatedEnemyHazards = nonNegativeProgressCount(defeatedEnemyHazards);
    const safeOpenedDungeonTreasures = nonNegativeProgressCount(openedDungeonTreasures);
    const safeResolvedDungeonTraps = nonNegativeProgressCount(resolvedDungeonTraps);
    const safeUsedDungeonGateways = nonNegativeProgressCount(usedDungeonGateways);

    return {
        cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedMatchedEarly,
        matchResolutionsThisFloor: nonNegativeProgressCount(run.matchResolutionsThisFloor) + 1,
        findablesClaimedThisFloor: nonNegativeProgressCount(run.findablesClaimedThisFloor) + safeFindablesClaimedDelta,
        safeHazardWardChargesThisFloor: Math.min(
            1,
            nonNegativeProgressCount(run.safeHazardWardChargesThisFloor) + safeRouteWardCharges + safeFindableWardGain
        ),
        hazardTileTriggersThisFloor:
            nonNegativeProgressCount(run.hazardTileTriggersThisFloor) +
            (cascadeHazardTriggered ? 1 : 0) +
            (fragileCacheClaimed ? 1 : 0) +
            (tollCacheClaimed ? 1 : 0) +
            (fuseCacheClaimed ? 1 : 0),
        hazardCascadeCachesThisFloor:
            nonNegativeProgressCount(run.hazardCascadeCachesThisFloor) + (cascadeHazardTriggered ? 1 : 0),
        hazardFragileCacheClaimsThisFloor:
            nonNegativeProgressCount(run.hazardFragileCacheClaimsThisFloor) + (fragileCacheClaimed ? 1 : 0),
        hazardTollCachesThisFloor:
            nonNegativeProgressCount(run.hazardTollCachesThisFloor) + (tollCacheClaimed ? 1 : 0),
        hazardFuseCachesThisFloor:
            nonNegativeProgressCount(run.hazardFuseCachesThisFloor) + (fuseCacheClaimed ? 1 : 0),
        hazardFuseCacheExpiredClaimsThisFloor:
            nonNegativeProgressCount(run.hazardFuseCacheExpiredClaimsThisFloor) + (fuseCacheClaimed && !fuseCacheFresh ? 1 : 0),
        lanternWardScoutsThisFloor: nonNegativeProgressCount(run.lanternWardScoutsThisFloor) + (lanternScouted ? 1 : 0),
        omenSealScoutsThisFloor:
            nonNegativeProgressCount(run.omenSealScoutsThisFloor) + (findableScouted ? 1 : 0) + (omenScouted ? 1 : 0),
        mimicCacheClaimsThisFloor: nonNegativeProgressCount(run.mimicCacheClaimsThisFloor) + (mimicCacheClaimed ? 1 : 0),
        mimicCacheBitesThisFloor: nonNegativeProgressCount(run.mimicCacheBitesThisFloor) + (mimicCacheBite ? 1 : 0),
        mimicCacheGuardBitesThisFloor:
            nonNegativeProgressCount(run.mimicCacheGuardBitesThisFloor) + (mimicCacheGuardBite ? 1 : 0),
        anchorSealChargesThisFloor:
            Math.max(0, nonNegativeProgressCount(run.anchorSealChargesThisFloor) - (anchorSealUsed ? 1 : 0)) +
            (anchorSealClaimed ? 1 : 0),
        anchorSealUsesThisFloor: nonNegativeProgressCount(run.anchorSealUsesThisFloor) + (anchorSealUsed ? 1 : 0),
        loadedGatewayPlansThisFloor:
            nonNegativeProgressCount(run.loadedGatewayPlansThisFloor) + (loadedGatewayClaimed ? 1 : 0),
        catalystAltarUpgradesThisFloor:
            nonNegativeProgressCount(run.catalystAltarUpgradesThisFloor) + (catalystAltarUpgraded ? 1 : 0),
        parasiteVesselConversionsThisFloor:
            nonNegativeProgressCount(run.parasiteVesselConversionsThisFloor) + (parasiteVesselConverted ? 1 : 0),
        pinLatticeRewardsThisFloor:
            nonNegativeProgressCount(run.pinLatticeRewardsThisFloor) + (pinLatticeRewarded ? 1 : 0),
        parasiteFloors: parasiteVesselConverted
            ? Math.max(0, nonNegativeProgressCount(run.parasiteFloors) - 1)
            : nonNegativeProgressCount(run.parasiteFloors),
        dungeonEnemiesDefeated: nonNegativeProgressCount(run.dungeonEnemiesDefeated) + safeDefeatedDungeonEnemies,
        dungeonEnemiesDefeatedThisFloor:
            nonNegativeProgressCount(run.dungeonEnemiesDefeatedThisFloor) + safeDefeatedDungeonEnemies,
        enemyHazardsDefeatedThisFloor:
            nonNegativeProgressCount(run.enemyHazardsDefeatedThisFloor) + safeDefeatedEnemyHazards,
        dungeonTreasuresOpened: nonNegativeProgressCount(run.dungeonTreasuresOpened) + safeOpenedDungeonTreasures,
        dungeonTreasuresOpenedThisFloor:
            nonNegativeProgressCount(run.dungeonTreasuresOpenedThisFloor) + safeOpenedDungeonTreasures,
        dungeonTrapsResolvedThisFloor:
            nonNegativeProgressCount(run.dungeonTrapsResolvedThisFloor) + safeResolvedDungeonTraps,
        dungeonGatewaysUsed: nonNegativeProgressCount(run.dungeonGatewaysUsed) + safeUsedDungeonGateways,
        dungeonGatewaysUsedThisFloor:
            nonNegativeProgressCount(run.dungeonGatewaysUsedThisFloor) + safeUsedDungeonGateways
    };
};
