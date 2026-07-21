import { describe, expect, it } from 'vitest';
import {
    addTileTraitCountStats,
    createSessionStats,
    normalizeSessionStats,
    normalizeTileTraitCountStats,
    TILE_TRAIT_COUNT_KINDS
} from './session-stats-rules';
import { makePair } from './test/game-fixtures';

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
                heavy: 0,
                drift: 0,
                conduit: 0,
                stasis: 0
            },
            tileTraitMismatches: {
                echo: 0,
                volatile: 0,
                mirror: 0,
                cursed: 0,
                sealed: 0,
                heavy: 0,
                drift: 0,
                conduit: 0,
                stasis: 0
            },
            volatileTraitShuffles: 0,
            shufflesUsed: 0,
            pairsDestroyed: 0
        });
    });

    it('normalizes partial trait counts and counts each trait pair once', () => {
        const [driftA, driftB] = makePair('drift', 'D');
        const [stasisA] = makePair('stasis', 'S');

        const counts = addTileTraitCountStats(
            { echo: 2 },
            [
                { ...driftA, tileTraitKind: 'drift' },
                { ...driftB, tileTraitKind: 'drift' },
                { ...stasisA, tileTraitKind: 'stasis' }
            ]
        );

        expect(Object.keys(counts)).toEqual(TILE_TRAIT_COUNT_KINDS);
        expect(counts.echo).toBe(2);
        expect(counts.drift).toBe(1);
        expect(counts.stasis).toBe(1);
        expect(counts.conduit).toBe(0);
    });

    it('normalizes malformed trait counts and session stats', () => {
        expect(normalizeTileTraitCountStats({ echo: 2.8, drift: Number.NaN })).toMatchObject({
            echo: 2,
            drift: 0,
            stasis: 0
        });

        expect(normalizeSessionStats(Number.NaN, 77)).toEqual(createSessionStats(77));
        expect(normalizeSessionStats({
            bestScore: 123.9,
            comboShards: 2.6,
            highestLevel: Number.NEGATIVE_INFINITY,
            rating: 'bad',
            tileTraitMatches: { sealed: 3.2 },
            tries: 2.1
        })).toMatchObject({
            bestScore: 123,
            comboShards: 2,
            highestLevel: 1,
            rating: 'A',
            tileTraitMatches: expect.objectContaining({ sealed: 3 }),
            tries: 2
        });
    });
});
