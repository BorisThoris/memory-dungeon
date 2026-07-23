import { describe, expect, it } from 'vitest';

import {
    FUSE_CACHE_FRESH_SCORE_REWARD,
    PIN_LATTICE_SCORE_REWARD,
    TOLL_CACHE_MATCH_SCORE_TOLL
} from './contracts';
import { calculateMatchScore } from './scoring-rules';
import {
    FRAGILE_CACHE_MATCH_SCORE,
    calculateResolvedMatchScore,
    type ResolvedMatchScoreInput
} from './turn-match-score-rules';

const baseInput: ResolvedMatchScoreInput = {
    level: 3,
    currentStreak: 2,
    matchScoreMultiplier: 1,
    recallBonus: 0,
    encoreBonus: 0,
    findableScoreBonus: 0,
    routeCardScore: 0,
    dungeonScore: 0,
    enemyDamageScore: 0,
    hazardDamageScore: 0,
    fragileCacheClaimed: false,
    fuseCacheFresh: false,
    pinLatticeRewarded: false,
    spotlightDelta: 0,
    tollCacheClaimed: false,
    presentationPenalty: 0
};

describe('turn match score rules', () => {
    it('adds match bonuses and hazard rewards', () => {
        expect(calculateResolvedMatchScore({
            ...baseInput,
            recallBonus: 2,
            encoreBonus: 3,
            findableScoreBonus: 4,
            routeCardScore: 5,
            dungeonScore: 6,
            enemyDamageScore: 7,
            hazardDamageScore: 8,
            fragileCacheClaimed: true,
            fuseCacheFresh: true,
            pinLatticeRewarded: true,
            spotlightDelta: 9
        })).toBe(
            calculateMatchScore(baseInput.level, baseInput.currentStreak, baseInput.matchScoreMultiplier) +
                2 +
                3 +
                4 +
                5 +
                6 +
                7 +
                8 +
                FRAGILE_CACHE_MATCH_SCORE +
                FUSE_CACHE_FRESH_SCORE_REWARD +
                PIN_LATTICE_SCORE_REWARD +
                9
        );
    });

    it('subtracts toll and presentation penalties but floors at zero', () => {
        expect(calculateResolvedMatchScore({
            ...baseInput,
            tollCacheClaimed: true,
            presentationPenalty: 10_000
        })).toBe(0);

        expect(calculateResolvedMatchScore({
            ...baseInput,
            tollCacheClaimed: true,
            presentationPenalty: 1
        })).toBe(
            Math.max(
                0,
                calculateMatchScore(baseInput.level, baseInput.currentStreak, baseInput.matchScoreMultiplier) -
                    TOLL_CACHE_MATCH_SCORE_TOLL -
                    1
            )
        );
    });

    it('normalizes malformed score inputs before resolving match score', () => {
        expect(calculateMatchScore(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN)).toBe(20);
        expect(calculateResolvedMatchScore({
            ...baseInput,
            level: Number.NaN,
            currentStreak: Number.POSITIVE_INFINITY,
            matchScoreMultiplier: Number.NaN,
            recallBonus: Number.NaN,
            encoreBonus: -3,
            findableScoreBonus: 4.8,
            routeCardScore: Number.POSITIVE_INFINITY,
            dungeonScore: -2,
            enemyDamageScore: 5.5,
            hazardDamageScore: Number.NaN,
            spotlightDelta: -6.5,
            presentationPenalty: Number.NaN
        })).toBe(20 + 4 + 5 - 7);
    });
});
