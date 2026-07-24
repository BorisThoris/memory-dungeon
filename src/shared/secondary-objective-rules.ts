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
import { hasRunRelic } from './relics';
import { runNonNegativeInteger } from './run-number-guards';

export const FEATURED_OBJECTIVE_BONUS_SCORES: Record<FeaturedObjectiveId, number> = {
    scholar_style: SCHOLAR_STYLE_FLOOR_BONUS_SCORE,
    glass_witness: GLASS_WITNESS_BONUS_SCORE,
    cursed_last: CURSED_LAST_BONUS_SCORE,
    flip_par: FLIP_PAR_BONUS_SCORE
};

export const getFeaturedObjectiveBonusScore = (id: FeaturedObjectiveId): number =>
    FEATURED_OBJECTIVE_BONUS_SCORES[id];

export const getFlipParLimit = (pairCount: number): number => Math.ceil(pairCount * 1.25) + 2;

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
            return board.pairCount >= 2 && runNonNegativeInteger(run.matchResolutionsThisFloor) <= getFlipParLimit(board.pairCount);
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
    if (board.pairCount >= 2 && runNonNegativeInteger(run.matchResolutionsThisFloor) <= getFlipParLimit(board.pairCount)) {
        bonusScore += FEATURED_OBJECTIVE_BONUS_SCORES.flip_par;
        bonusTags.push('flip_par');
    }

    return {
        bonusScore,
        bonusTags
    };
};

export interface FeaturedObjectiveClearResult {
    activeEndlessRiskWager: RunState['endlessRiskWager'];
    endlessRiskWagerFavorGained: number;
    endlessRiskWagerOutcome: 'won' | 'lost' | undefined;
    endlessRiskWagerStreakLost: number | undefined;
    featuredObjectiveStreak: number;
    featuredObjectiveStreakBonus: number;
    relicFavorGained: number;
}

export const getFeaturedObjectiveClearResult = ({
    board,
    completed,
    objectiveId,
    run
}: {
    board: BoardState;
    completed: boolean;
    objectiveId: FeaturedObjectiveId | null;
    run: RunState;
}): FeaturedObjectiveClearResult => {
    const activeEndlessRiskWager =
        objectiveId != null && run.endlessRiskWager?.targetLevel === board.level
            ? run.endlessRiskWager
            : null;
    const endlessRiskWagerOutcome =
        activeEndlessRiskWager != null ? (completed ? 'won' as const : 'lost' as const) : undefined;
    const hasWagerSurety = hasRunRelic(run, 'wager_surety');
    const previousFeaturedObjectiveStreak = runNonNegativeInteger(run.featuredObjectiveStreak);
    const featuredObjectiveStreak =
        objectiveId != null
            ? completed
                ? previousFeaturedObjectiveStreak + 1
                : activeEndlessRiskWager
                  ? hasWagerSurety
                      ? 1
                      : 0
                  : Math.max(0, previousFeaturedObjectiveStreak - FEATURED_OBJECTIVE_STREAK_MISS_DECAY)
            : previousFeaturedObjectiveStreak;
    const endlessRiskWagerStreakLost =
        activeEndlessRiskWager != null && !completed
            ? Math.max(0, runNonNegativeInteger(activeEndlessRiskWager.streakAtRisk) - featuredObjectiveStreak)
            : undefined;
    const featuredObjectiveStreakBonus =
        objectiveId != null && completed
            ? Math.min(
                  Math.max(0, featuredObjectiveStreak - 1) * FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
                  FEATURED_OBJECTIVE_STREAK_BONUS_MAX
              )
            : 0;
    const relicFavorGained = objectiveId != null && completed ? (board.floorTag === 'boss' ? 2 : 1) : 0;
    const endlessRiskWagerFavorGained =
        completed && activeEndlessRiskWager
            ? runNonNegativeInteger(activeEndlessRiskWager.bonusFavorOnSuccess) + (hasWagerSurety ? 1 : 0)
            : 0;

    return {
        activeEndlessRiskWager,
        endlessRiskWagerFavorGained,
        endlessRiskWagerOutcome,
        endlessRiskWagerStreakLost,
        featuredObjectiveStreak,
        featuredObjectiveStreakBonus,
        relicFavorGained
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
        board,
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
    return `+${score} score and featured-objective Favor when scheduled.`;
};
