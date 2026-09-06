import {
    FUSE_CACHE_FRESH_SCORE_REWARD,
    PIN_LATTICE_SCORE_REWARD,
    TOLL_CACHE_MATCH_SCORE_TOLL
} from './contracts';
import { runFiniteFlooredIntegerDelta, runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';

export const FRAGILE_CACHE_MATCH_SCORE = 25;

export interface ResolvedMatchScoreInput {
    level: number;
    currentStreak: number;
    matchScoreMultiplier: number;
    recallBonus: number;
    encoreBonus: number;
    findableScoreBonus: number;
    /** What the chunk break paid; zero on a turn with no break. */
    chunkScore: number;
    routeCardScore: number;
    dungeonScore: number;
    enemyDamageScore: number;
    hazardDamageScore: number;
    fragileCacheClaimed: boolean;
    fuseCacheFresh: boolean;
    pinLatticeRewarded: boolean;
    spotlightDelta: number;
    tollCacheClaimed: boolean;
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
}: ResolvedMatchScoreInput): number =>
    Math.max(
        0,
        calculateMatchScore(level, currentStreak, matchScoreMultiplier) +
            runNonNegativeInteger(recallBonus) +
            runNonNegativeInteger(encoreBonus) +
            runNonNegativeInteger(findableScoreBonus) +
            runNonNegativeInteger(chunkScore) +
            runNonNegativeInteger(routeCardScore) +
            runNonNegativeInteger(dungeonScore) +
            runNonNegativeInteger(enemyDamageScore) +
            runNonNegativeInteger(hazardDamageScore) +
            (fragileCacheClaimed ? FRAGILE_CACHE_MATCH_SCORE : 0) +
            (fuseCacheFresh ? FUSE_CACHE_FRESH_SCORE_REWARD : 0) +
            (pinLatticeRewarded ? PIN_LATTICE_SCORE_REWARD : 0) +
            runFiniteFlooredIntegerDelta(spotlightDelta) -
            (tollCacheClaimed ? TOLL_CACHE_MATCH_SCORE_TOLL : 0) -
            runNonNegativeInteger(presentationPenalty)
    );
