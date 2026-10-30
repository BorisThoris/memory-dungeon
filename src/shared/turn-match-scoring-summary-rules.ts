import { chainMomentum, runChainMomentumPairs } from './chain-tier-rules';
import { comboMultiplierFor, comboPays } from './combo-pay-rules';
import type { BoardState, RunState } from './contracts';
import { relicScoreMultiplier } from './snowball-relic-rules';
import { calculateRecallMatchBonus } from './recall-rules';
import { getPresentationMutatorMatchPenalty } from './scoring-rules';
import { normalizeSessionStats } from './session-stats-rules';
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
    encorePairKeys: readonly string[];
    findableScoreBonus: number;
    chunkScore: number;
}

export const resolveTurnMatchScoringSummary = ({
    run,
    sourceBoard,
    resolvedBoard,
    matchedPairKey,
    encorePairKeys,
    findableScoreBonus,
    chunkScore
}: TurnMatchScoringSummaryInput): TurnMatchScoringSummaryResult => {
    const stats = normalizeSessionStats(run.stats);
    const currentStreak = stats.currentStreak + 1;
    const encoreKey = matchedPairKey;
    const cursedMatchedEarly =
        Boolean(sourceBoard.cursedPairKey && encoreKey === sourceBoard.cursedPairKey && sourceBoard.matchedPairs < sourceBoard.pairCount - 1);
    const encoreBonus = encorePairKeys.includes(encoreKey) ? ENCORE_BONUS_SCORE : 0;
    const spotlightDelta = shiftingSpotlightMatchDelta(sourceBoard, encoreKey);
    const presentationPenalty = getPresentationMutatorMatchPenalty(run);
    const recallBonus = calculateRecallMatchBonus(run);
    // The combo pays (`combo-pay-rules.ts`, rules 106): the match at the ladder's multiplier, in place of ten a link.
    const comboMultiplier = comboPays(run) ? comboMultiplierFor(chainMomentum(currentStreak, runChainMomentumPairs(run)), resolvedBoard.pairCount) : 1;
    const base = calculateResolvedMatchScore({
        level: resolvedBoard.level,
        currentStreak: comboPays(run) ? 0 : currentStreak,
        matchScoreMultiplier: run.matchScoreMultiplier * comboMultiplier,
        recallBonus,
        encoreBonus,
        findableScoreBonus,
        chunkScore,
        spotlightDelta,
        presentationPenalty
    });
    // The relics that grow (`snowball-relic-rules.ts`, rules 100): every one held multiplies the match.
    const relicMultiplier = relicScoreMultiplier(run);
    const matchScore = relicMultiplier > 1 ? Math.floor(base * relicMultiplier) : base;
    const totalScore = stats.totalScore + matchScore;
    const currentLevelScore = stats.currentLevelScore + matchScore;
    const bestScore = Math.max(stats.bestScore, totalScore);

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
