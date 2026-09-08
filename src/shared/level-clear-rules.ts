import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type ClearLifeReason,
    type FeaturedObjectiveId,
    type FloorTag,
    type LevelResult,
    type RunState
} from './contracts';
import {
    calculateLevelClearBonus,
    calculatePerfectClearBonus
} from './scoring-rules';
import { runNonNegativeInteger } from './run-number-guards';
import type { FloorClearMomentumBonus } from './floor-clear-momentum-bonus-rules';

export const getClearLifeReason = (tries: number): ClearLifeReason => {
    if (tries === 0) return 'perfect';
    if (tries === 1) return 'clean';
    return 'none';
};

export type FloorClearStatLevelResultFields = Pick<
    LevelResult,
    | 'bestChain'
    | 'chunkBreaks'
    | 'chunkPairsBroken'
    | 'feverBreaks'
    | 'recallBonusScore'
    | 'recallMatches'
    | 'recallMistakes'
>;

const positive = (value: number): number | undefined => (value > 0 ? value : undefined);

export const getFloorClearStatLevelResultFields = (run: RunState): FloorClearStatLevelResultFields => ({
    bestChain: positive(run.bestChainThisFloor),
    chunkBreaks: positive(run.chunkBreaksThisFloor),
    chunkPairsBroken: positive(run.chunkPairsBrokenThisFloor),
    feverBreaks: positive(run.feverBreaksThisFloor),
    recallBonusScore: positive(run.recallBonusScoreThisFloor),
    recallMatches: positive(run.recallMatchesThisFloor),
    recallMistakes: positive(run.recallMistakesThisFloor)
});

export interface FloorClearScoreResult {
    levelBonus: number;
    perfectBonus: number;
    preBossSubtotal: number;
    scoreGained: number;
}

export const calculateFloorClearScore = ({
    currentLevelScore,
    featuredObjectiveStreakBonus,
    floorTag,
    level,
    objectiveBonus,
    perfect
}: {
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
        runNonNegativeInteger(featuredObjectiveStreakBonus);
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
    bonusTags: readonly string[];
    clearLifeGained: number;
    clearLifeReason: ClearLifeReason;
    featuredObjectiveCompleted: boolean;
    featuredObjectiveId: FeaturedObjectiveId | null;
    featuredObjectiveStreak: number;
    featuredObjectiveStreakBonus: number;
    level: number;
    livesRemaining: number;
    mistakes: number;
    momentumBonus: FloorClearMomentumBonus;
    objectiveBonusScore: number;
    perfect: boolean;
    rating: LevelResult['rating'];
    run: RunState;
    scoreGained: number;
    traitRouteObjectiveCompleted?: boolean;
    traitRouteObjectiveProgress?: number;
    traitRouteObjectiveRequired?: number;
    traitRouteObjectiveReward?: string | undefined;
}

export const createFloorClearLevelResult = ({
    bonusTags,
    clearLifeGained,
    clearLifeReason,
    featuredObjectiveCompleted,
    featuredObjectiveId,
    featuredObjectiveStreak,
    featuredObjectiveStreakBonus,
    level,
    livesRemaining,
    mistakes,
    momentumBonus,
    objectiveBonusScore,
    perfect,
    rating,
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
    featuredObjectiveStreak: featuredObjectiveId != null ? featuredObjectiveStreak : undefined,
    featuredObjectiveStreakBonus:
        featuredObjectiveId != null && featuredObjectiveStreakBonus > 0
            ? featuredObjectiveStreakBonus
            : undefined,
    traitRouteObjectiveCompleted: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveCompleted : undefined,
    traitRouteObjectiveProgress: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveProgress : undefined,
    traitRouteObjectiveRequired: traitRouteObjectiveRequired > 0 ? traitRouteObjectiveRequired : undefined,
    traitRouteObjectiveReward:
        traitRouteObjectiveRequired > 0 && traitRouteObjectiveCompleted
            ? traitRouteObjectiveReward
            : undefined,
    ...getFloorClearStatLevelResultFields(run),
    chainMomentumAtClear: momentumBonus.momentum > 0 ? momentumBonus.momentum : undefined,
    momentumBonusTier: momentumBonus.tier !== 'none' ? momentumBonus.tier : undefined,
    momentumBonusShards: momentumBonus.shards > 0 ? momentumBonus.shards : undefined
});
