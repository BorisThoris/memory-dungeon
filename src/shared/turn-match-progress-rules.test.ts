import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchProgress } from './turn-match-progress-rules';

const baseInput = (run = createNewRun(0)) => ({
    run,
    cursedMatchedEarly: false,
    findablesClaimedDelta: 0,
    routeCardSafeHazardWardCharges: 0,
    findableSafeHazardWardGain: 0,
    cascadeHazardTriggered: false,
    chunkPairsBroken: 0,
    chunkScore: 0,
    chunkTier: 'none' as const,
    chainAfter: 0,
    fragileCacheClaimed: false,
    tollCacheClaimed: false,
    fuseCacheClaimed: false,
    fuseCacheFresh: false,
    lanternScouted: false,
    findableScouted: false,
    omenScouted: false,
    mimicCacheClaimed: false,
    mimicCacheBite: false,
    mimicCacheGuardBite: false,
    anchorSealUsed: false,
    anchorSealClaimed: false,
    loadedGatewayClaimed: false,
    catalystAltarUpgraded: false,
    parasiteVesselConverted: false,
    pinLatticeRewarded: false,
    defeatedDungeonEnemies: 0,
    defeatedEnemyHazards: 0,
    openedDungeonTreasures: 0,
    resolvedDungeonTraps: 0,
    usedDungeonGateways: 0
});

describe('resolveTurnMatchProgress', () => {
    it('increments match, findable, hazard, scout, and cache counters', () => {
        const run = {
            ...createNewRun(0),
            matchResolutionsThisFloor: 2,
            findablesClaimedThisFloor: 1,
            hazardTileTriggersThisFloor: 3,
            safeHazardWardChargesThisFloor: 0
        };

        const result = resolveTurnMatchProgress({
            ...baseInput(run),
            cursedMatchedEarly: true,
            findablesClaimedDelta: 2,
            routeCardSafeHazardWardCharges: 1,
            findableSafeHazardWardGain: 1,
            cascadeHazardTriggered: true,
            chunkPairsBroken: 0,
            chunkScore: 0,
            chunkTier: 'none' as const,
            chainAfter: 0,
            fragileCacheClaimed: true,
            tollCacheClaimed: true,
            fuseCacheClaimed: true,
            fuseCacheFresh: false,
            lanternScouted: true,
            findableScouted: true,
            omenScouted: true,
            mimicCacheClaimed: true,
            mimicCacheBite: true,
            mimicCacheGuardBite: true,
            loadedGatewayClaimed: true,
            catalystAltarUpgraded: true,
            pinLatticeRewarded: true
        });

        expect(result.cursedMatchedEarlyThisFloor).toBe(true);
        expect(result.matchResolutionsThisFloor).toBe(3);
        expect(result.findablesClaimedThisFloor).toBe(3);
        expect(result.safeHazardWardChargesThisFloor).toBe(1);
        expect(result.hazardTileTriggersThisFloor).toBe(7);
        expect(result.hazardCascadeCachesThisFloor).toBe(1);
        expect(result.hazardFragileCacheClaimsThisFloor).toBe(1);
        expect(result.hazardTollCachesThisFloor).toBe(1);
        expect(result.hazardFuseCachesThisFloor).toBe(1);
        expect(result.hazardFuseCacheExpiredClaimsThisFloor).toBe(1);
        expect(result.lanternWardScoutsThisFloor).toBe(1);
        expect(result.omenSealScoutsThisFloor).toBe(2);
        expect(result.mimicCacheClaimsThisFloor).toBe(1);
        expect(result.mimicCacheBitesThisFloor).toBe(1);
        expect(result.mimicCacheGuardBitesThisFloor).toBe(1);
        expect(result.loadedGatewayPlansThisFloor).toBe(1);
        expect(result.catalystAltarUpgradesThisFloor).toBe(1);
        expect(result.pinLatticeRewardsThisFloor).toBe(1);
    });

    it('updates anchor pressure, parasite floors, and dungeon totals', () => {
        const run = {
            ...createNewRun(0),
            anchorSealChargesThisFloor: 1,
            anchorSealUsesThisFloor: 2,
            parasiteFloors: 2,
            dungeonEnemiesDefeated: 5,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 3,
            dungeonTreasuresOpened: 4,
            dungeonTreasuresOpenedThisFloor: 2,
            dungeonTrapsResolvedThisFloor: 6,
            dungeonGatewaysUsed: 7,
            dungeonGatewaysUsedThisFloor: 8
        };

        const result = resolveTurnMatchProgress({
            ...baseInput(run),
            anchorSealUsed: true,
            anchorSealClaimed: true,
            parasiteVesselConverted: true,
            defeatedDungeonEnemies: 4,
            defeatedEnemyHazards: 2,
            openedDungeonTreasures: 3,
            resolvedDungeonTraps: 1,
            usedDungeonGateways: 1
        });

        expect(result.anchorSealChargesThisFloor).toBe(1);
        expect(result.anchorSealUsesThisFloor).toBe(3);
        expect(result.parasiteVesselConversionsThisFloor).toBe(1);
        expect(result.parasiteFloors).toBe(1);
        expect(result.dungeonEnemiesDefeated).toBe(9);
        expect(result.dungeonEnemiesDefeatedThisFloor).toBe(5);
        expect(result.enemyHazardsDefeatedThisFloor).toBe(5);
        expect(result.dungeonTreasuresOpened).toBe(7);
        expect(result.dungeonTreasuresOpenedThisFloor).toBe(5);
        expect(result.dungeonTrapsResolvedThisFloor).toBe(7);
        expect(result.dungeonGatewaysUsed).toBe(8);
        expect(result.dungeonGatewaysUsedThisFloor).toBe(9);
    });

    it('does not let anchor charges or parasite floors go below zero', () => {
        const result = resolveTurnMatchProgress({
            ...baseInput({ ...createNewRun(0), anchorSealChargesThisFloor: 0, parasiteFloors: 0 }),
            anchorSealUsed: true,
            parasiteVesselConverted: true
        });

        expect(result.anchorSealChargesThisFloor).toBe(0);
        expect(result.parasiteFloors).toBe(0);
    });

    it('normalizes malformed persisted counters and match progress deltas', () => {
        const run = {
            ...createNewRun(0),
            matchResolutionsThisFloor: Number.NaN,
            findablesClaimedThisFloor: -2,
            safeHazardWardChargesThisFloor: Number.POSITIVE_INFINITY,
            hazardTileTriggersThisFloor: Number.NaN,
            hazardCascadeCachesThisFloor: Number.POSITIVE_INFINITY,
            hazardFragileCacheClaimsThisFloor: -2,
            hazardTollCachesThisFloor: 1.9,
            hazardFuseCachesThisFloor: Number.NaN,
            hazardFuseCacheExpiredClaimsThisFloor: Number.POSITIVE_INFINITY,
            lanternWardScoutsThisFloor: -2,
            omenSealScoutsThisFloor: Number.NaN,
            mimicCacheClaimsThisFloor: -2,
            mimicCacheBitesThisFloor: Number.POSITIVE_INFINITY,
            mimicCacheGuardBitesThisFloor: 1.9,
            anchorSealChargesThisFloor: Number.NaN,
            anchorSealUsesThisFloor: -2,
            loadedGatewayPlansThisFloor: Number.POSITIVE_INFINITY,
            catalystAltarUpgradesThisFloor: Number.NaN,
            parasiteVesselConversionsThisFloor: 1.9,
            pinLatticeRewardsThisFloor: Number.NaN,
            parasiteFloors: 1.9,
            dungeonEnemiesDefeated: Number.NaN,
            dungeonEnemiesDefeatedThisFloor: -2,
            enemyHazardsDefeatedThisFloor: Number.POSITIVE_INFINITY,
            dungeonTreasuresOpened: 1.9,
            dungeonTreasuresOpenedThisFloor: Number.NaN,
            dungeonTrapsResolvedThisFloor: Number.POSITIVE_INFINITY,
            dungeonGatewaysUsed: -2,
            dungeonGatewaysUsedThisFloor: Number.NaN
        };

        const result = resolveTurnMatchProgress({
            ...baseInput(run),
            findablesClaimedDelta: 2.9,
            routeCardSafeHazardWardCharges: Number.NaN,
            findableSafeHazardWardGain: 1.9,
            cascadeHazardTriggered: true,
            chunkPairsBroken: 0,
            chunkScore: 0,
            chunkTier: 'none' as const,
            chainAfter: 0,
            fragileCacheClaimed: true,
            tollCacheClaimed: true,
            fuseCacheClaimed: true,
            fuseCacheFresh: false,
            lanternScouted: true,
            findableScouted: true,
            omenScouted: true,
            mimicCacheClaimed: true,
            mimicCacheBite: true,
            mimicCacheGuardBite: true,
            anchorSealUsed: true,
            anchorSealClaimed: true,
            loadedGatewayClaimed: true,
            catalystAltarUpgraded: true,
            parasiteVesselConverted: true,
            pinLatticeRewarded: true,
            defeatedDungeonEnemies: 2.9,
            defeatedEnemyHazards: Number.NaN,
            openedDungeonTreasures: 3.9,
            resolvedDungeonTraps: 2.9,
            usedDungeonGateways: 1.9
        });

        expect(result.matchResolutionsThisFloor).toBe(1);
        expect(result.findablesClaimedThisFloor).toBe(2);
        expect(result.safeHazardWardChargesThisFloor).toBe(1);
        expect(result.hazardTileTriggersThisFloor).toBe(4);
        expect(result.hazardCascadeCachesThisFloor).toBe(1);
        expect(result.hazardFragileCacheClaimsThisFloor).toBe(1);
        expect(result.hazardTollCachesThisFloor).toBe(2);
        expect(result.hazardFuseCachesThisFloor).toBe(1);
        expect(result.hazardFuseCacheExpiredClaimsThisFloor).toBe(1);
        expect(result.lanternWardScoutsThisFloor).toBe(1);
        expect(result.omenSealScoutsThisFloor).toBe(2);
        expect(result.mimicCacheClaimsThisFloor).toBe(1);
        expect(result.mimicCacheBitesThisFloor).toBe(1);
        expect(result.mimicCacheGuardBitesThisFloor).toBe(2);
        expect(result.anchorSealChargesThisFloor).toBe(1);
        expect(result.anchorSealUsesThisFloor).toBe(1);
        expect(result.loadedGatewayPlansThisFloor).toBe(1);
        expect(result.catalystAltarUpgradesThisFloor).toBe(1);
        expect(result.parasiteVesselConversionsThisFloor).toBe(2);
        expect(result.pinLatticeRewardsThisFloor).toBe(1);
        expect(result.parasiteFloors).toBe(0);
        expect(result.dungeonEnemiesDefeated).toBe(2);
        expect(result.dungeonEnemiesDefeatedThisFloor).toBe(2);
        expect(result.enemyHazardsDefeatedThisFloor).toBe(0);
        expect(result.dungeonTreasuresOpened).toBe(4);
        expect(result.dungeonTreasuresOpenedThisFloor).toBe(3);
        expect(result.dungeonTrapsResolvedThisFloor).toBe(2);
        expect(result.dungeonGatewaysUsed).toBe(1);
        expect(result.dungeonGatewaysUsedThisFloor).toBe(1);
    });
});

describe("the chain's floor", () => {
    it('counts a Fever break and keeps the longest chain the floor saw', () => {
        const first = resolveTurnMatchProgress({ ...baseInput(), chunkPairsBroken: 3, chunkTier: 'fever', chainAfter: 6 });
        expect(first.feverBreaksThisFloor).toBe(1);
        expect(first.bestChainThisFloor).toBe(6);
        // A Sharp break is not a Fever break, and a shorter chain does not lower the best.
        const run = { ...createNewRun(0), feverBreaksThisFloor: 1, bestChainThisFloor: 6 };
        const second = resolveTurnMatchProgress({ ...baseInput(run), chunkPairsBroken: 2, chunkTier: 'sharp', chainAfter: 2 });
        expect(second.feverBreaksThisFloor).toBe(1);
        expect(second.bestChainThisFloor).toBe(6);
        // Fever tier with nothing broken is a tier, not a break.
        const third = resolveTurnMatchProgress({ ...baseInput(run), chunkPairsBroken: 0, chunkTier: 'fever', chainAfter: 9 });
        expect(third.feverBreaksThisFloor).toBe(1);
        expect(third.bestChainThisFloor).toBe(9);
    });
});
