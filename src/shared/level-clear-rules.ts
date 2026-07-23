import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type BoardState,
    type ClearLifeReason,
    type FeaturedObjectiveId,
    type FloorTag,
    type LevelResult,
    type RunState
} from './contracts';
import { defeatEnemyHazardsForFloorClear } from './dungeon-enemy-hazard-rules';
import {
    calculateLevelClearBonus,
    calculatePerfectClearBonus
} from './scoring-rules';
import { runNonNegativeInteger } from './run-number-guards';

export const getClearLifeReason = (tries: number): ClearLifeReason => {
    if (tries === 0) return 'perfect';
    if (tries === 1) return 'clean';
    return 'none';
};

export interface FloorClearEnemyHazardDefeatResult {
    run: RunState;
    board: BoardState;
}

export const applyFloorClearEnemyHazardDefeats = (
    run: RunState,
    board: BoardState
): FloorClearEnemyHazardDefeatResult => {
    const floorClearHazards = defeatEnemyHazardsForFloorClear(board);
    const finalizedBoard: BoardState = { ...floorClearHazards.board, flippedTileIds: [] };
    if (floorClearHazards.defeated <= 0) {
        return {
            run,
            board: finalizedBoard
        };
    }

    return {
        run: {
            ...run,
            dungeonEnemiesDefeated:
                runNonNegativeInteger(run.dungeonEnemiesDefeated) + floorClearHazards.bossesDefeated,
            dungeonEnemiesDefeatedThisFloor:
                runNonNegativeInteger(run.dungeonEnemiesDefeatedThisFloor) + floorClearHazards.bossesDefeated,
            enemyHazardsDefeatedThisFloor:
                runNonNegativeInteger(run.enemyHazardsDefeatedThisFloor) + floorClearHazards.defeated
        },
        board: finalizedBoard
    };
};

export type FloorClearStatLevelResultFields = Pick<
    LevelResult,
    | 'anchorSealUses'
    | 'catalystAltarUpgrades'
    | 'hazardCascadeCaches'
    | 'hazardFragileCacheBreaks'
    | 'hazardFragileCacheClaims'
    | 'hazardFuseCacheExpiredClaims'
    | 'hazardFuseCaches'
    | 'hazardMirrorDecoys'
    | 'hazardShuffleSnares'
    | 'hazardTileTriggers'
    | 'hazardTollCaches'
    | 'lanternWardScouts'
    | 'loadedGatewayPlans'
    | 'mimicCacheBites'
    | 'mimicCacheClaims'
    | 'omenSealScouts'
    | 'parasiteVesselConversions'
    | 'pinLatticeRewards'
    | 'recallBonusScore'
    | 'recallMatches'
    | 'recallMistakes'
    | 'safeHazardWardsUsed'
>;

const positive = (value: number): number | undefined => (value > 0 ? value : undefined);

export const getFloorClearStatLevelResultFields = (run: RunState): FloorClearStatLevelResultFields => ({
    anchorSealUses: positive(run.anchorSealUsesThisFloor),
    catalystAltarUpgrades: positive(run.catalystAltarUpgradesThisFloor),
    hazardCascadeCaches: positive(run.hazardCascadeCachesThisFloor),
    hazardFragileCacheBreaks: positive(run.hazardFragileCacheBreaksThisFloor),
    hazardFragileCacheClaims: positive(run.hazardFragileCacheClaimsThisFloor),
    hazardFuseCacheExpiredClaims: positive(run.hazardFuseCacheExpiredClaimsThisFloor),
    hazardFuseCaches: positive(run.hazardFuseCachesThisFloor),
    hazardMirrorDecoys: positive(run.hazardMirrorDecoysThisFloor),
    hazardShuffleSnares: positive(run.hazardShuffleSnaresThisFloor),
    hazardTileTriggers: positive(run.hazardTileTriggersThisFloor),
    hazardTollCaches: positive(run.hazardTollCachesThisFloor),
    lanternWardScouts: positive(run.lanternWardScoutsThisFloor),
    loadedGatewayPlans: positive(run.loadedGatewayPlansThisFloor),
    mimicCacheBites: positive(run.mimicCacheBitesThisFloor),
    mimicCacheClaims: positive(run.mimicCacheClaimsThisFloor),
    omenSealScouts: positive(run.omenSealScoutsThisFloor),
    parasiteVesselConversions: positive(run.parasiteVesselConversionsThisFloor),
    pinLatticeRewards: positive(run.pinLatticeRewardsThisFloor),
    recallBonusScore: positive(run.recallBonusScoreThisFloor),
    recallMatches: positive(run.recallMatchesThisFloor),
    recallMistakes: positive(run.recallMistakesThisFloor),
    safeHazardWardsUsed: positive(run.safeHazardWardsUsedThisFloor)
});

export interface FloorClearScoreResult {
    levelBonus: number;
    perfectBonus: number;
    preBossSubtotal: number;
    scoreGained: number;
}

export const calculateFloorClearScore = ({
    bossTrophyCacheScore,
    currentLevelScore,
    featuredObjectiveStreakBonus,
    floorTag,
    level,
    objectiveBonus,
    perfect
}: {
    bossTrophyCacheScore: number;
    currentLevelScore: number;
    featuredObjectiveStreakBonus: number;
    floorTag: FloorTag | undefined;
    level: number;
    objectiveBonus: number;
    perfect: boolean;
}): FloorClearScoreResult => {
    const levelBonus = calculateLevelClearBonus(level);
    const perfectBonus = perfect ? calculatePerfectClearBonus() : 0;
    const preBossSubtotal =
        runNonNegativeInteger(currentLevelScore) +
        levelBonus +
        perfectBonus +
        runNonNegativeInteger(objectiveBonus) +
        runNonNegativeInteger(featuredObjectiveStreakBonus) +
        runNonNegativeInteger(bossTrophyCacheScore);
    return {
        levelBonus,
        perfectBonus,
        preBossSubtotal,
        scoreGained:
            floorTag === 'boss'
                ? Math.floor(preBossSubtotal * BOSS_FLOOR_SCORE_MULTIPLIER)
                : preBossSubtotal
    };
};

export interface CreateFloorClearLevelResultInput {
    bossTrophyCacheOutcome: LevelResult['bossTrophyCacheOutcome'];
    bossTrophyCacheScore: number;
    bonusTags: readonly string[];
    clearLifeGained: number;
    clearLifeReason: ClearLifeReason;
    endlessRiskWagerFavorGained: number;
    endlessRiskWagerOutcome: LevelResult['endlessRiskWagerOutcome'];
    endlessRiskWagerStreakLost: LevelResult['endlessRiskWagerStreakLost'];
    featuredObjectiveCompleted: boolean;
    featuredObjectiveId: FeaturedObjectiveId | null;
    featuredObjectiveStreak: number;
    featuredObjectiveStreakBonus: number;
    level: number;
    livesRemaining: number;
    mistakes: number;
    objectiveBonusScore: number;
    perfect: boolean;
    rating: LevelResult['rating'];
    relicFavorGained: number;
    routeChoices: LevelResult['routeChoices'];
    run: RunState;
    scoreGained: number;
    traitRouteObjectiveCompleted?: boolean;
    traitRouteObjectiveProgress?: number;
    traitRouteObjectiveRequired?: number;
    traitRouteObjectiveReward?: string | undefined;
}

export const createFloorClearLevelResult = ({
    bossTrophyCacheOutcome,
    bossTrophyCacheScore,
    bonusTags,
    clearLifeGained,
    clearLifeReason,
    endlessRiskWagerFavorGained,
    endlessRiskWagerOutcome,
    endlessRiskWagerStreakLost,
    featuredObjectiveCompleted,
    featuredObjectiveId,
    featuredObjectiveStreak,
    featuredObjectiveStreakBonus,
    level,
    livesRemaining,
    mistakes,
    objectiveBonusScore,
    perfect,
    rating,
    relicFavorGained,
    routeChoices,
    run,
    scoreGained,
    traitRouteObjectiveCompleted = false,
    traitRouteObjectiveProgress = 0,
    traitRouteObjectiveRequired = 0,
    traitRouteObjectiveReward
}: CreateFloorClearLevelResultInput): LevelResult => ({
    level,
    scoreGained,
    rating,
    livesRemaining,
    perfect,
    mistakes,
    clearLifeReason,
    clearLifeGained,
    bonusTags: bonusTags.length > 0 ? [...new Set(bonusTags)] : undefined,
    objectiveBonusScore: objectiveBonusScore > 0 ? objectiveBonusScore : undefined,
    featuredObjectiveId: featuredObjectiveId ?? undefined,
    featuredObjectiveCompleted: featuredObjectiveId != null ? featuredObjectiveCompleted : undefined,
    relicFavorGained: featuredObjectiveId != null ? relicFavorGained : undefined,
    featuredObjectiveStreak: featuredObjectiveId != null ? featuredObjectiveStreak : undefined,
    featuredObjectiveStreakBonus:
        featuredObjectiveId != null && featuredObjectiveStreakBonus > 0
            ? featuredObjectiveStreakBonus
            : undefined,
    endlessRiskWagerOutcome,
    endlessRiskWagerFavorGained:
        endlessRiskWagerFavorGained > 0
            ? endlessRiskWagerFavorGained
            : undefined,
    endlessRiskWagerStreakLost,
    bossTrophyCacheOutcome,
    bossTrophyCacheScore: bossTrophyCacheScore > 0 ? bossTrophyCacheScore : undefined,
    traitRouteObjectiveCompleted: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveCompleted : undefined,
    traitRouteObjectiveProgress: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveProgress : undefined,
    traitRouteObjectiveRequired: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveRequired : undefined,
    traitRouteObjectiveReward:
        traitRouteObjectiveRequired > 0 && traitRouteObjectiveCompleted
            ? traitRouteObjectiveReward
            : undefined,
    ...getFloorClearStatLevelResultFields(run),
    routeChoices
});
