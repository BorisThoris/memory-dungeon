import type { RunState } from './contracts';

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
}: TurnMatchProgressInput): TurnMatchProgressResult => ({
    cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedMatchedEarly,
    matchResolutionsThisFloor: run.matchResolutionsThisFloor + 1,
    findablesClaimedThisFloor: run.findablesClaimedThisFloor + findablesClaimedDelta,
    safeHazardWardChargesThisFloor: Math.min(
        1,
        (run.safeHazardWardChargesThisFloor ?? 0) + routeCardSafeHazardWardCharges + findableSafeHazardWardGain
    ),
    hazardTileTriggersThisFloor:
        run.hazardTileTriggersThisFloor +
        (cascadeHazardTriggered ? 1 : 0) +
        (fragileCacheClaimed ? 1 : 0) +
        (tollCacheClaimed ? 1 : 0) +
        (fuseCacheClaimed ? 1 : 0),
    hazardCascadeCachesThisFloor: run.hazardCascadeCachesThisFloor + (cascadeHazardTriggered ? 1 : 0),
    hazardFragileCacheClaimsThisFloor: run.hazardFragileCacheClaimsThisFloor + (fragileCacheClaimed ? 1 : 0),
    hazardTollCachesThisFloor: run.hazardTollCachesThisFloor + (tollCacheClaimed ? 1 : 0),
    hazardFuseCachesThisFloor: run.hazardFuseCachesThisFloor + (fuseCacheClaimed ? 1 : 0),
    hazardFuseCacheExpiredClaimsThisFloor:
        run.hazardFuseCacheExpiredClaimsThisFloor + (fuseCacheClaimed && !fuseCacheFresh ? 1 : 0),
    lanternWardScoutsThisFloor: run.lanternWardScoutsThisFloor + (lanternScouted ? 1 : 0),
    omenSealScoutsThisFloor:
        run.omenSealScoutsThisFloor + (findableScouted ? 1 : 0) + (omenScouted ? 1 : 0),
    mimicCacheClaimsThisFloor: run.mimicCacheClaimsThisFloor + (mimicCacheClaimed ? 1 : 0),
    mimicCacheBitesThisFloor: run.mimicCacheBitesThisFloor + (mimicCacheBite ? 1 : 0),
    mimicCacheGuardBitesThisFloor: run.mimicCacheGuardBitesThisFloor + (mimicCacheGuardBite ? 1 : 0),
    anchorSealChargesThisFloor:
        Math.max(0, run.anchorSealChargesThisFloor - (anchorSealUsed ? 1 : 0)) + (anchorSealClaimed ? 1 : 0),
    anchorSealUsesThisFloor: run.anchorSealUsesThisFloor + (anchorSealUsed ? 1 : 0),
    loadedGatewayPlansThisFloor: run.loadedGatewayPlansThisFloor + (loadedGatewayClaimed ? 1 : 0),
    catalystAltarUpgradesThisFloor: run.catalystAltarUpgradesThisFloor + (catalystAltarUpgraded ? 1 : 0),
    parasiteVesselConversionsThisFloor:
        run.parasiteVesselConversionsThisFloor + (parasiteVesselConverted ? 1 : 0),
    pinLatticeRewardsThisFloor: run.pinLatticeRewardsThisFloor + (pinLatticeRewarded ? 1 : 0),
    parasiteFloors: parasiteVesselConverted ? Math.max(0, run.parasiteFloors - 1) : run.parasiteFloors,
    dungeonEnemiesDefeated: run.dungeonEnemiesDefeated + defeatedDungeonEnemies,
    dungeonEnemiesDefeatedThisFloor: (run.dungeonEnemiesDefeatedThisFloor ?? 0) + defeatedDungeonEnemies,
    enemyHazardsDefeatedThisFloor: (run.enemyHazardsDefeatedThisFloor ?? 0) + defeatedEnemyHazards,
    dungeonTreasuresOpened: run.dungeonTreasuresOpened + openedDungeonTreasures,
    dungeonTreasuresOpenedThisFloor: (run.dungeonTreasuresOpenedThisFloor ?? 0) + openedDungeonTreasures,
    dungeonTrapsResolvedThisFloor: (run.dungeonTrapsResolvedThisFloor ?? 0) + resolvedDungeonTraps,
    dungeonGatewaysUsed: run.dungeonGatewaysUsed + usedDungeonGateways,
    dungeonGatewaysUsedThisFloor: (run.dungeonGatewaysUsedThisFloor ?? 0) + usedDungeonGateways
});
