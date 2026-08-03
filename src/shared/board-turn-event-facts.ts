import { RECALL_FOCUS_MAX, type RunState } from './contracts';
import type { BoardTurnAnnouncementFacts } from './gameplay-core-contracts';
import { getGameplayFeedbackObjectiveSnapshot } from './gameplay-feedback-facts';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats, TILE_TRAIT_COUNT_KINDS } from './session-stats-rules';

const optionalNonNegativeInteger = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : null;

export const getBoardTurnAnnouncementFacts = (
    before: RunState,
    after: RunState
): BoardTurnAnnouncementFacts => {
    const statsBefore = normalizeSessionStats(before.stats);
    const statsAfter = normalizeSessionStats(after.stats);

    return {
        matchedPairsBefore: runNonNegativeInteger(before.board?.matchedPairs),
        matchedPairsAfter: runNonNegativeInteger(after.board?.matchedPairs),
        pairCountBefore: runNonNegativeInteger(before.board?.pairCount),
        pairCountAfter: runNonNegativeInteger(after.board?.pairCount),
        shopGoldBefore: runNonNegativeInteger(before.shopGold),
        shopGoldAfter: runNonNegativeInteger(after.shopGold),
        shuffleChargesBefore: runNonNegativeInteger(before.shuffleCharges),
        shuffleChargesAfter: runNonNegativeInteger(after.shuffleCharges),
        regionShuffleChargesBefore: runNonNegativeInteger(before.regionShuffleCharges),
        regionShuffleChargesAfter: runNonNegativeInteger(after.regionShuffleCharges),
        stickyBlockIndexBefore: optionalNonNegativeInteger(before.stickyBlockIndex),
        stickyBlockIndexAfter: optionalNonNegativeInteger(after.stickyBlockIndex),
        matchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter(
            (kind) => statsAfter.tileTraitMatches[kind] > statsBefore.tileTraitMatches[kind]
        ),
        mismatchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter(
            (kind) => statsAfter.tileTraitMismatches[kind] > statsBefore.tileTraitMismatches[kind]
        ),
        volatileTraitShufflesBefore: statsBefore.volatileTraitShuffles,
        volatileTraitShufflesAfter: statsAfter.volatileTraitShuffles,
        objectiveBefore: getGameplayFeedbackObjectiveSnapshot(before),
        objectiveAfter: getGameplayFeedbackObjectiveSnapshot(after),
        recallFocusBefore: Math.min(RECALL_FOCUS_MAX, runNonNegativeInteger(before.recallFocus)),
        recallFocusAfter: Math.min(RECALL_FOCUS_MAX, runNonNegativeInteger(after.recallFocus)),
        recallMatchesBefore: runNonNegativeInteger(before.recallMatchesThisFloor),
        recallMatchesAfter: runNonNegativeInteger(after.recallMatchesThisFloor),
        recallMistakesBefore: runNonNegativeInteger(before.recallMistakesThisFloor),
        recallMistakesAfter: runNonNegativeInteger(after.recallMistakesThisFloor),
        recallBonusScoreBefore: runNonNegativeInteger(before.recallBonusScoreThisFloor),
        recallBonusScoreAfter: runNonNegativeInteger(after.recallBonusScoreThisFloor),
        forgottenTileCountBefore: runArrayCount(before.forgottenTileIdsThisFloor),
        forgottenTileCountAfter: runArrayCount(after.forgottenTileIdsThisFloor),
        dungeonEnemiesDefeatedBefore: runNonNegativeInteger(before.dungeonEnemiesDefeatedThisFloor),
        dungeonEnemiesDefeatedAfter: runNonNegativeInteger(after.dungeonEnemiesDefeatedThisFloor),
        enemyHazardHitsBefore: runNonNegativeInteger(before.enemyHazardHitsThisFloor),
        enemyHazardHitsAfter: runNonNegativeInteger(after.enemyHazardHitsThisFloor),
        enemyHazardsDefeatedBefore: runNonNegativeInteger(before.enemyHazardsDefeatedThisFloor),
        enemyHazardsDefeatedAfter: runNonNegativeInteger(after.enemyHazardsDefeatedThisFloor),
        hazardTilesBefore: {
            totalTriggers: runNonNegativeInteger(before.hazardTileTriggersThisFloor),
            shuffleSnares: runNonNegativeInteger(before.hazardShuffleSnaresThisFloor),
            cascadeCaches: runNonNegativeInteger(before.hazardCascadeCachesThisFloor),
            mirrorDecoys: runNonNegativeInteger(before.hazardMirrorDecoysThisFloor),
            fragileCacheClaims: runNonNegativeInteger(before.hazardFragileCacheClaimsThisFloor),
            fragileCacheBreaks: runNonNegativeInteger(before.hazardFragileCacheBreaksThisFloor),
            tollCaches: runNonNegativeInteger(before.hazardTollCachesThisFloor),
            fuseCaches: runNonNegativeInteger(before.hazardFuseCachesThisFloor),
            fuseExpiredClaims: runNonNegativeInteger(before.hazardFuseCacheExpiredClaimsThisFloor)
        },
        hazardTilesAfter: {
            totalTriggers: runNonNegativeInteger(after.hazardTileTriggersThisFloor),
            shuffleSnares: runNonNegativeInteger(after.hazardShuffleSnaresThisFloor),
            cascadeCaches: runNonNegativeInteger(after.hazardCascadeCachesThisFloor),
            mirrorDecoys: runNonNegativeInteger(after.hazardMirrorDecoysThisFloor),
            fragileCacheClaims: runNonNegativeInteger(after.hazardFragileCacheClaimsThisFloor),
            fragileCacheBreaks: runNonNegativeInteger(after.hazardFragileCacheBreaksThisFloor),
            tollCaches: runNonNegativeInteger(after.hazardTollCachesThisFloor),
            fuseCaches: runNonNegativeInteger(after.hazardFuseCachesThisFloor),
            fuseExpiredClaims: runNonNegativeInteger(after.hazardFuseCacheExpiredClaimsThisFloor)
        },
        scoutsBefore: {
            lanternWard: runNonNegativeInteger(before.lanternWardScoutsThisFloor),
            omenSeal: runNonNegativeInteger(before.omenSealScoutsThisFloor)
        },
        scoutsAfter: {
            lanternWard: runNonNegativeInteger(after.lanternWardScoutsThisFloor),
            omenSeal: runNonNegativeInteger(after.omenSealScoutsThisFloor)
        },
        mimicCacheBefore: {
            claims: runNonNegativeInteger(before.mimicCacheClaimsThisFloor),
            bites: runNonNegativeInteger(before.mimicCacheBitesThisFloor),
            guardBites: runNonNegativeInteger(before.mimicCacheGuardBitesThisFloor)
        },
        mimicCacheAfter: {
            claims: runNonNegativeInteger(after.mimicCacheClaimsThisFloor),
            bites: runNonNegativeInteger(after.mimicCacheBitesThisFloor),
            guardBites: runNonNegativeInteger(after.mimicCacheGuardBitesThisFloor)
        },
        routeSpecialsBefore: {
            anchorSealUses: runNonNegativeInteger(before.anchorSealUsesThisFloor),
            loadedGatewayPlans: runNonNegativeInteger(before.loadedGatewayPlansThisFloor),
            catalystAltarUpgrades: runNonNegativeInteger(before.catalystAltarUpgradesThisFloor),
            parasiteVesselConversions: runNonNegativeInteger(before.parasiteVesselConversionsThisFloor),
            pinLatticeRewards: runNonNegativeInteger(before.pinLatticeRewardsThisFloor)
        },
        routeSpecialsAfter: {
            anchorSealUses: runNonNegativeInteger(after.anchorSealUsesThisFloor),
            loadedGatewayPlans: runNonNegativeInteger(after.loadedGatewayPlansThisFloor),
            catalystAltarUpgrades: runNonNegativeInteger(after.catalystAltarUpgradesThisFloor),
            parasiteVesselConversions: runNonNegativeInteger(after.parasiteVesselConversionsThisFloor),
            pinLatticeRewards: runNonNegativeInteger(after.pinLatticeRewardsThisFloor)
        },
        safeHazardWardsUsedBefore: runNonNegativeInteger(before.safeHazardWardsUsedThisFloor),
        safeHazardWardsUsedAfter: runNonNegativeInteger(after.safeHazardWardsUsedThisFloor)
    };
};
