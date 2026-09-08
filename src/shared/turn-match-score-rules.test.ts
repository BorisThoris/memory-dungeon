import { describe, expect, it } from 'vitest';

import { calculateMatchScore } from './scoring-rules';
import { calculateResolvedMatchScore, type ResolvedMatchScoreInput } from './turn-match-score-rules';

const baseInput: ResolvedMatchScoreInput = {
    level: 3,
    currentStreak: 2,
    matchScoreMultiplier: 1,
    recallBonus: 0,
    encoreBonus: 0,
    findableScoreBonus: 0,
    chunkScore: 0,
    spotlightDelta: 0,
    presentationPenalty: 0
};

describe('turn match score rules', () => {
    it('adds match bonuses on top of the base match score', () => {
        expect(calculateResolvedMatchScore({
            ...baseInput,
            recallBonus: 2,
            encoreBonus: 3,
            findableScoreBonus: 4,
            chunkScore: 5,
            spotlightDelta: 9
        })).toBe(
            calculateMatchScore(baseInput.level, baseInput.currentStreak, baseInput.matchScoreMultiplier) + 2 + 3 + 4 + 5 + 9
        );
    });

    it('subtracts the presentation penalty but floors at zero', () => {
        expect(calculateResolvedMatchScore({
            ...baseInput,
            presentationPenalty: 10_000
        })).toBe(0);

        expect(calculateResolvedMatchScore({
            ...baseInput,
            spotlightDelta: -4,
            presentationPenalty: 1
        })).toBe(
            Math.max(
                0,
                calculateMatchScore(baseInput.level, baseInput.currentStreak, baseInput.matchScoreMultiplier) - 4 - 1
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
            chunkScore: Number.POSITIVE_INFINITY,
            spotlightDelta: -6.5,
            presentationPenalty: Number.NaN
        })).toBe(20 + 4 - 7);
    });
});
