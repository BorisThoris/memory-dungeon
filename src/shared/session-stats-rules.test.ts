import { describe, expect, it } from 'vitest';
import { createSessionStats } from './session-stats-rules';

describe('session-stats-rules', () => {
    it('creates a fresh session stat block while preserving the known best score', () => {
        expect(createSessionStats(321)).toEqual({
            totalScore: 0,
            currentLevelScore: 0,
            bestScore: 321,
            tries: 0,
            rating: 'S++',
            levelsCleared: 0,
            matchesFound: 0,
            mismatches: 0,
            highestLevel: 1,
            currentStreak: 0,
            bestStreak: 0,
            perfectClears: 0,
            guardTokens: 0,
            comboShards: 0,
            tileTraitMatches: {
                echo: 0,
                volatile: 0,
                mirror: 0,
                cursed: 0,
                sealed: 0,
                heavy: 0
            },
            tileTraitMismatches: {
                echo: 0,
                volatile: 0,
                mirror: 0,
                cursed: 0,
                sealed: 0,
                heavy: 0
            },
            volatileTraitShuffles: 0,
            shufflesUsed: 0,
            pairsDestroyed: 0
        });
    });
});
