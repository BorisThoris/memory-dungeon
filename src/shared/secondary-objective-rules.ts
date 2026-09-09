import {
    type BoardState,
    CURSED_LAST_BONUS_SCORE,
    FEATURED_OBJECTIVE_STREAK_BONUS_MAX,
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    FEATURED_OBJECTIVE_STREAK_MISS_DECAY,
    FLIP_PAR_BONUS_SCORE,
    GLASS_WITNESS_BONUS_SCORE,
    type RunState,
    SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    type FeaturedObjectiveId
} from './contracts';
import { usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { parTurnsForFloor, turnsTakenThisFloor } from './floor-par';
import { runNonNegativeInteger } from './run-number-guards';

export const FEATURED_OBJECTIVE_BONUS_SCORES: Record<FeaturedObjectiveId, number> = {
    scholar_style: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    glass_witness: GLASS_WITNESS_BONUS_SCORE,
    cursed_last: CURSED_LAST_BONUS_SCORE,
    flip_par: FLIP_PAR_BONUS_SCORE
};

export const getFeaturedObjectiveBonusScore = (id: FeaturedObjectiveId): number =>
    FEATURED_OBJECTIVE_BONUS_SCORES[id];

/**
 * Within par: the floor's turns, match or miss, at or under its stated par (`floor-par.ts`).
 *
 * Gen 181: this used to compare match resolutions to `ceil(pairs × 1.25) + 2`, and a floor of N
 * pairs cannot resolve more than N matches, so it could not be failed. It reads the real par now.
 */
export const isWithinFloorPar = (run: RunState, board: BoardState): boolean =>
    board.pairCount >= 2 && turnsTakenThisFloor(run) <= parTurnsForFloor(board.pairCount);

export const isFeaturedObjectiveCompleted = (
    run: RunState,
    board: BoardState,
    objectiveId: FeaturedObjectiveId
): boolean => {
    switch (objectiveId) {
        case 'scholar_style':
            return !run.shuffleUsedThisFloor && !run.destroyUsedThisFloor;
        case 'glass_witness':
            return run.glassDecoyActiveThisFloor && !run.decoyFlippedThisFloor;
        case 'cursed_last':
            return Boolean(board.cursedPairKey) && !run.cursedMatchedEarlyThisFloor;
        case 'flip_par':
            return isWithinFloorPar(run, board);
        default:
            return false;
    }
};

export interface DefaultClearObjectiveBonusResult {
    bonusScore: number;
    bonusTags: FeaturedObjectiveId[];
}

export const getDefaultClearObjectiveBonus = (
    run: RunState,
    board: BoardState
): DefaultClearObjectiveBonusResult => {
    let bonusScore = 0;
    const bonusTags: FeaturedObjectiveId[] = [];

    if (!run.shuffleUsedThisFloor && !run.destroyUsedThisFloor) {
        bonusScore += FEATURED_OBJECTIVE_BONUS_SCORES.scholar_style;
        bonusTags.push('scholar_style');
    }
    if (run.glassDecoyActiveThisFloor && !run.decoyFlippedThisFloor) {
        bonusScore += FEATURED_OBJECTIVE_BONUS_SCORES.glass_witness;
        bonusTags.push('glass_witness');
    }
    if (board.cursedPairKey && !run.cursedMatchedEarlyThisFloor) {
        bonusScore += FEATURED_OBJECTIVE_BONUS_SCORES.cursed_last;
        bonusTags.push('cursed_last');
    }
    if (isWithinFloorPar(run, board)) {
        bonusScore += FEATURED_OBJECTIVE_BONUS_SCORES.flip_par;
        bonusTags.push('flip_par');
    }

    return {
        bonusScore,
        bonusTags
    };
};

export interface FeaturedObjectiveClearResult {
    featuredObjectiveStreak: number;
    featuredObjectiveStreakBonus: number;
}

export const getFeaturedObjectiveClearResult = ({
    completed,
    objectiveId,
    run
}: {
    completed: boolean;
    objectiveId: FeaturedObjectiveId | null;
    run: RunState;
}): FeaturedObjectiveClearResult => {
    /*
     * The Endless risk wager and its Favor payout went in Gen 175 with the relic draft the Favor
     * fed. A featured objective still builds a streak and pays a score kicker; a miss decays it.
     */
    const previousFeaturedObjectiveStreak = runNonNegativeInteger(run.featuredObjectiveStreak);
    const featuredObjectiveStreak =
        objectiveId != null
            ? completed
                ? previousFeaturedObjectiveStreak + 1
                : Math.max(0, previousFeaturedObjectiveStreak - FEATURED_OBJECTIVE_STREAK_MISS_DECAY)
            : previousFeaturedObjectiveStreak;
    const featuredObjectiveStreakBonus =
        objectiveId != null && completed
            ? Math.min(
                  Math.max(0, featuredObjectiveStreak - 1) * FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
                  FEATURED_OBJECTIVE_STREAK_BONUS_MAX
              )
            : 0;
    return {
        featuredObjectiveStreak,
        featuredObjectiveStreakBonus
    };
};

export const isEndlessFeaturedObjectiveBoard = (run: RunState, board: BoardState): boolean =>
    run.gameMode === 'endless' &&
    usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
    board.featuredObjectiveId != null;

export interface FloorClearObjectiveResult {
    bonusTags: string[];
    featuredObjectiveClear: FeaturedObjectiveClearResult;
    featuredObjectiveCompleted: boolean;
    featuredObjectiveId: FeaturedObjectiveId | null;
    objectiveBonus: number;
}

export const getFloorClearObjectiveResult = (run: RunState, board: BoardState): FloorClearObjectiveResult => {
    const featuredObjectiveId = isEndlessFeaturedObjectiveBoard(run, board) ? board.featuredObjectiveId : null;
    const featuredObjectiveCompleted =
        featuredObjectiveId != null ? isFeaturedObjectiveCompleted(run, board, featuredObjectiveId) : false;
    const featuredObjectiveClear = getFeaturedObjectiveClearResult({
        completed: featuredObjectiveCompleted,
        objectiveId: featuredObjectiveId,
        run
    });
    const bonusTags: string[] = [];
    let objectiveBonus = 0;

    if (featuredObjectiveId != null) {
        if (featuredObjectiveCompleted) {
            objectiveBonus += FEATURED_OBJECTIVE_BONUS_SCORES[featuredObjectiveId];
            bonusTags.push(featuredObjectiveId);
            if (featuredObjectiveClear.featuredObjectiveStreakBonus > 0) {
                bonusTags.push('objective_streak');
            }
        }
    } else {
        const defaultObjectiveBonus = getDefaultClearObjectiveBonus(run, board);
        objectiveBonus += defaultObjectiveBonus.bonusScore;
        bonusTags.push(...defaultObjectiveBonus.bonusTags);
    }

    return {
        bonusTags,
        featuredObjectiveClear,
        featuredObjectiveCompleted,
        featuredObjectiveId,
        objectiveBonus
    };
};

export const getFeaturedObjectiveRewardCopy = (id: FeaturedObjectiveId): string => {
    const score = getFeaturedObjectiveBonusScore(id);
    return `+${score} score when scheduled.`;
};
