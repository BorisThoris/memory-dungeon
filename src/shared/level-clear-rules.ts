import {
    BOSS_FLOOR_SCORE_MULTIPLIER,
    type ClearLifeReason,
    type FeaturedObjectiveId,
    type FloorTag,
    type LevelResult,
    type RunState
} from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import type { FloorClearMomentumBonus } from './floor-clear-momentum-bonus-rules';
import type { ChainTier } from './chain-tier-rules';

/**
 * The floor-end bonus (thesis §40.5). A floor pays for being cleared, more for being cleared
 * with the chain still up, and more again for being cleared under par: Peggle's Extreme Fever
 * disproportion, where the ceremony pays more than the floor. Clearing at Fever is worth five
 * times clearing cold. The efficiency term is what replaced the exit's "leave early" option: a
 * floor that went badly pays less, and needs no escape hatch.
 */
export const FLOOR_CLEAR_BASE_PER_LEVEL = 100;
export const FLOOR_TIER_MULT: Record<ChainTier, number> = { none: 1, clean: 1.5, sharp: 2.5, fever: 5 };
export const FLOOR_EFFICIENCY_PER_TURN_PER_LEVEL = 50;

export interface FloorClearBonus {
    base: number;
    tier: ChainTier;
    tierMult: number;
    /** `base × tierMult`, whole. */
    tierBonus: number;
    turnsUnderPar: number;
    efficiencyBonus: number;
    total: number;
}

export const calculateFloorClearBonus = ({
    level,
    tier,
    parTurns,
    turnsTaken
}: {
    level: number;
    tier: ChainTier;
    parTurns: number;
    turnsTaken: number;
}): FloorClearBonus => {
    const safeLevel = Math.max(1, runNonNegativeInteger(level));
    const base = FLOOR_CLEAR_BASE_PER_LEVEL * safeLevel;
    const tierMult = FLOOR_TIER_MULT[tier];
    const tierBonus = Math.floor(base * tierMult);
    const turnsUnderPar = Math.max(0, runNonNegativeInteger(parTurns) - runNonNegativeInteger(turnsTaken));
    const efficiencyBonus = turnsUnderPar * FLOOR_EFFICIENCY_PER_TURN_PER_LEVEL * safeLevel;
    return { base, tier, tierMult, tierBonus, turnsUnderPar, efficiencyBonus, total: tierBonus + efficiencyBonus };
};

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
    floorBonus: FloorClearBonus;
    preBossSubtotal: number;
    scoreGained: number;
}

export const calculateFloorClearScore = ({
    currentLevelScore,
    featuredObjectiveStreakBonus,
    floorBonus,
    floorTag,
    objectiveBonus
}: {
    currentLevelScore: number;
    featuredObjectiveStreakBonus: number;
    floorBonus: FloorClearBonus;
    floorTag: FloorTag | undefined;
    objectiveBonus: number;
}): FloorClearScoreResult => {
    const preBossSubtotal =
        runNonNegativeInteger(currentLevelScore) +
        floorBonus.total +
        runNonNegativeInteger(objectiveBonus) +
        runNonNegativeInteger(featuredObjectiveStreakBonus);
    return {
        floorBonus,
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
    floorBonus: FloorClearBonus;
    level: number;
    livesRemaining: number;
    mistakes: number;
    momentumBonus: FloorClearMomentumBonus;
    objectiveBonusScore: number;
    parTurns: number;
    perfect: boolean;
    playScore: number;
    rating: LevelResult['rating'];
    run: RunState;
    scoreGained: number;
    turnsTaken: number;
}

export const createFloorClearLevelResult = ({
    bonusTags,
    clearLifeGained,
    clearLifeReason,
    featuredObjectiveCompleted,
    featuredObjectiveId,
    featuredObjectiveStreak,
    featuredObjectiveStreakBonus,
    floorBonus,
    level,
    livesRemaining,
    mistakes,
    momentumBonus,
    objectiveBonusScore,
    parTurns,
    perfect,
    playScore,
    rating,
    run,
    scoreGained,
    turnsTaken
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
    ...getFloorClearStatLevelResultFields(run),
    chainMomentumAtClear: momentumBonus.momentum > 0 ? momentumBonus.momentum : undefined,
    momentumBonusTier: momentumBonus.tier !== 'none' ? momentumBonus.tier : undefined,
    momentumBonusShards: momentumBonus.shards > 0 ? momentumBonus.shards : undefined,
    parTurns,
    turnsTaken,
    playScore: runNonNegativeInteger(playScore),
    floorBonus: floorBonus.total,
    floorBonusTierMult: floorBonus.tierMult,
    floorEfficiencyBonus: floorBonus.efficiencyBonus > 0 ? floorBonus.efficiencyBonus : undefined,
    largestBreakScore: positive(runNonNegativeInteger(run.largestChunkScoreThisFloor))
});
