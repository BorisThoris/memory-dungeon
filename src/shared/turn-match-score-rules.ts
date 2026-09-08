import { runFiniteFlooredIntegerDelta, runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';

export interface ResolvedMatchScoreInput {
    level: number;
    currentStreak: number;
    matchScoreMultiplier: number;
    recallBonus: number;
    encoreBonus: number;
    findableScoreBonus: number;
    /** What the chunk break paid; zero on a turn with no break. */
    chunkScore: number;
    spotlightDelta: number;
    presentationPenalty: number;
}

export const calculateResolvedMatchScore = ({
    level,
    currentStreak,
    matchScoreMultiplier,
    recallBonus,
    encoreBonus,
    findableScoreBonus,
    chunkScore,
    spotlightDelta,
    presentationPenalty
}: ResolvedMatchScoreInput): number =>
    Math.max(
        0,
        calculateMatchScore(level, currentStreak, matchScoreMultiplier) +
            runNonNegativeInteger(recallBonus) +
            runNonNegativeInteger(encoreBonus) +
            runNonNegativeInteger(findableScoreBonus) +
            runNonNegativeInteger(chunkScore) +
            runFiniteFlooredIntegerDelta(spotlightDelta) -
            runNonNegativeInteger(presentationPenalty)
    );
