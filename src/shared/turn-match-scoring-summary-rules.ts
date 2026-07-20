import type { BoardState, RunState, Tile } from './contracts';
import { calculateRecallMatchBonus } from './recall-rules';
import { getPresentationMutatorMatchPenalty } from './scoring-rules';
import { shiftingSpotlightMatchDelta } from './shifting-spotlight-rules';
import { calculateResolvedMatchScore } from './turn-match-score-rules';

export const ENCORE_BONUS_SCORE = 18;

export interface TurnMatchScoringSummaryResult {
    currentStreak: number;
    encoreKey: string;
    cursedMatchedEarly: boolean;
    recallBonus: number;
    matchScore: number;
    totalScore: number;
    currentLevelScore: number;
    bestScore: number;
}

export interface TurnMatchScoringSummaryInput {
    run: RunState;
    sourceBoard: BoardState;
    resolvedBoard: BoardState;
    matchedPairKey: string;
    matchedTiles: readonly Tile[];
    encorePairKeys: readonly string[];
    findableScoreBonus: number;
    routeCardScore: number;
    dungeonScore: number;
    enemyDamageScore: number;
    hazardDamageScore: number;
    fragileCacheClaimed: boolean;
    fuseCacheFresh: boolean;
    pinLatticeRewarded: boolean;
    tollCacheClaimed: boolean;
}

const nonNegativeScoringCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const resolveTurnMatchScoringSummary = ({
    run,
    sourceBoard,
    resolvedBoard,
    matchedPairKey,
    matchedTiles,
    encorePairKeys,
    findableScoreBonus,
    routeCardScore,
    dungeonScore,
    enemyDamageScore,
    hazardDamageScore,
    fragileCacheClaimed,
    fuseCacheFresh,
    pinLatticeRewarded,
    tollCacheClaimed
}: TurnMatchScoringSummaryInput): TurnMatchScoringSummaryResult => {
    const currentStreak = nonNegativeScoringCount(run.stats.currentStreak) + 1;
    const encoreKey = matchedPairKey;
    const cursedMatchedEarly =
        Boolean(sourceBoard.cursedPairKey && encoreKey === sourceBoard.cursedPairKey && sourceBoard.matchedPairs < sourceBoard.pairCount - 1);
    const encoreBonus = encorePairKeys.includes(encoreKey) ? ENCORE_BONUS_SCORE : 0;
    const spotlightDelta = shiftingSpotlightMatchDelta(sourceBoard, encoreKey);
    const presentationPenalty = getPresentationMutatorMatchPenalty(run);
    const recallBonus = calculateRecallMatchBonus(run, matchedTiles);
    const matchScore = calculateResolvedMatchScore({
        level: resolvedBoard.level,
        currentStreak,
        matchScoreMultiplier: run.matchScoreMultiplier,
        recallBonus,
        encoreBonus,
        findableScoreBonus,
        routeCardScore,
        dungeonScore,
        enemyDamageScore,
        hazardDamageScore,
        fragileCacheClaimed,
        fuseCacheFresh,
        pinLatticeRewarded,
        spotlightDelta,
        tollCacheClaimed,
        presentationPenalty
    });
    const totalScore = nonNegativeScoringCount(run.stats.totalScore) + matchScore;
    const currentLevelScore = nonNegativeScoringCount(run.stats.currentLevelScore) + matchScore;
    const bestScore = Math.max(nonNegativeScoringCount(run.stats.bestScore), totalScore);

    return {
        currentStreak,
        encoreKey,
        cursedMatchedEarly,
        recallBonus,
        matchScore,
        totalScore,
        currentLevelScore,
        bestScore
    };
};
