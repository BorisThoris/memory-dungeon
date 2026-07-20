import {
    FUSE_CACHE_FRESH_SCORE_REWARD,
    PIN_LATTICE_SCORE_REWARD,
    TOLL_CACHE_MATCH_SCORE_TOLL
} from './contracts';
import { calculateMatchScore } from './scoring-rules';

export const FRAGILE_CACHE_MATCH_SCORE = 25;

export interface ResolvedMatchScoreInput {
    level: number;
    currentStreak: number;
    matchScoreMultiplier: number;
    recallBonus: number;
    encoreBonus: number;
    findableScoreBonus: number;
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

const nonNegativeScoreTerm = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const finiteScoreDelta = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;

export const calculateResolvedMatchScore = ({
    level,
    currentStreak,
    matchScoreMultiplier,
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
}: ResolvedMatchScoreInput): number =>
    Math.max(
        0,
        calculateMatchScore(level, currentStreak, matchScoreMultiplier) +
            nonNegativeScoreTerm(recallBonus) +
            nonNegativeScoreTerm(encoreBonus) +
            nonNegativeScoreTerm(findableScoreBonus) +
            nonNegativeScoreTerm(routeCardScore) +
            nonNegativeScoreTerm(dungeonScore) +
            nonNegativeScoreTerm(enemyDamageScore) +
            nonNegativeScoreTerm(hazardDamageScore) +
            (fragileCacheClaimed ? FRAGILE_CACHE_MATCH_SCORE : 0) +
            (fuseCacheFresh ? FUSE_CACHE_FRESH_SCORE_REWARD : 0) +
            (pinLatticeRewarded ? PIN_LATTICE_SCORE_REWARD : 0) +
            finiteScoreDelta(spotlightDelta) -
            (tollCacheClaimed ? TOLL_CACHE_MATCH_SCORE_TOLL : 0) -
            nonNegativeScoreTerm(presentationPenalty)
    );
