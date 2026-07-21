import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { createNewRun } from './run-creation-rules';
import { calculateMatchScore } from './scoring-rules';
import {
    ENCORE_BONUS_SCORE,
    resolveTurnMatchScoringSummary
} from './turn-match-scoring-summary-rules';

const firstPair = (board: BoardState): [Tile, Tile] => {
    for (const tile of board.tiles) {
        const pair = board.tiles.find((candidate) => candidate.id !== tile.id && candidate.pairKey === tile.pairKey);
        if (pair) {
            return [tile, pair];
        }
    }
    throw new Error('Expected generated board to contain at least one pair');
};

describe('resolveTurnMatchScoringSummary', () => {
    it('computes streak, encore bonus, score totals, and best score', () => {
        const base = createNewRun(40, { gameMode: 'puzzle', activeMutators: [] });
        const run = {
            ...base,
            stats: {
                ...base.stats,
                totalScore: 10,
                currentLevelScore: 5,
                bestScore: 25,
                currentStreak: 1
            }
        };
        const [first, second] = firstPair(run.board!);

        const result = resolveTurnMatchScoringSummary({
            run,
            sourceBoard: run.board!,
            resolvedBoard: run.board!,
            matchedPairKey: first.pairKey,
            matchedTiles: [first, second],
            encorePairKeys: [first.pairKey],
            findableScoreBonus: 2,
            routeCardScore: 3,
            dungeonScore: 4,
            enemyDamageScore: 5,
            hazardDamageScore: 6,
            fragileCacheClaimed: false,
            fuseCacheFresh: false,
            pinLatticeRewarded: false,
            tollCacheClaimed: false
        });

        const expectedMatchScore =
            calculateMatchScore(run.board!.level, 2, run.matchScoreMultiplier) +
            ENCORE_BONUS_SCORE +
            2 +
            3 +
            4 +
            5 +
            6;

        expect(result.currentStreak).toBe(2);
        expect(result.encoreKey).toBe(first.pairKey);
        expect(result.recallBonus).toBe(0);
        expect(result.matchScore).toBe(expectedMatchScore);
        expect(result.totalScore).toBe(10 + expectedMatchScore);
        expect(result.currentLevelScore).toBe(5 + expectedMatchScore);
        expect(result.bestScore).toBe(10 + expectedMatchScore);
    });

    it('normalizes malformed persisted score counters before summarizing a match', () => {
        const base = createNewRun(41, { gameMode: 'puzzle', activeMutators: [] });
        const run = {
            ...base,
            stats: {
                ...base.stats,
                totalScore: Number.NaN,
                currentLevelScore: -4,
                bestScore: Number.POSITIVE_INFINITY,
                currentStreak: Number.NaN
            }
        };
        const [first, second] = firstPair(run.board!);

        const result = resolveTurnMatchScoringSummary({
            run,
            sourceBoard: run.board!,
            resolvedBoard: run.board!,
            matchedPairKey: first.pairKey,
            matchedTiles: [first, second],
            encorePairKeys: [],
            findableScoreBonus: Number.NaN,
            routeCardScore: 3.8,
            dungeonScore: Number.POSITIVE_INFINITY,
            enemyDamageScore: -5,
            hazardDamageScore: 2.5,
            fragileCacheClaimed: false,
            fuseCacheFresh: false,
            pinLatticeRewarded: false,
            tollCacheClaimed: false
        });

        const expectedMatchScore = calculateMatchScore(run.board!.level, 1, run.matchScoreMultiplier) + 3 + 2;
        expect(result.currentStreak).toBe(1);
        expect(result.matchScore).toBe(expectedMatchScore);
        expect(result.totalScore).toBe(expectedMatchScore);
        expect(result.currentLevelScore).toBe(expectedMatchScore);
        expect(result.bestScore).toBe(expectedMatchScore);
    });

    it('normalizes malformed stat records before summarizing a match', () => {
        const base = createNewRun(42, { gameMode: 'puzzle', activeMutators: [] });
        const run = {
            ...base,
            stats: Number.NaN as unknown as RunState['stats']
        };
        const [first, second] = firstPair(run.board!);

        const result = resolveTurnMatchScoringSummary({
            run,
            sourceBoard: run.board!,
            resolvedBoard: run.board!,
            matchedPairKey: first.pairKey,
            matchedTiles: [first, second],
            encorePairKeys: [],
            findableScoreBonus: 0,
            routeCardScore: 0,
            dungeonScore: 0,
            enemyDamageScore: 0,
            hazardDamageScore: 0,
            fragileCacheClaimed: false,
            fuseCacheFresh: false,
            pinLatticeRewarded: false,
            tollCacheClaimed: false
        });

        const expectedMatchScore = calculateMatchScore(run.board!.level, 1, run.matchScoreMultiplier);
        expect(result.currentStreak).toBe(1);
        expect(result.totalScore).toBe(expectedMatchScore);
        expect(result.currentLevelScore).toBe(expectedMatchScore);
        expect(result.bestScore).toBe(expectedMatchScore);
    });

    it('flags cursed pairs matched before the final pair', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        const board = {
            ...run.board!,
            cursedPairKey: first.pairKey,
            matchedPairs: Math.max(0, run.board!.pairCount - 2)
        };

        const result = resolveTurnMatchScoringSummary({
            run: { ...run, board },
            sourceBoard: board,
            resolvedBoard: board,
            matchedPairKey: first.pairKey,
            matchedTiles: [first, second],
            encorePairKeys: [],
            findableScoreBonus: 0,
            routeCardScore: 0,
            dungeonScore: 0,
            enemyDamageScore: 0,
            hazardDamageScore: 0,
            fragileCacheClaimed: false,
            fuseCacheFresh: false,
            pinLatticeRewarded: false,
            tollCacheClaimed: false
        });

        expect(result.cursedMatchedEarly).toBe(true);
    });

    it('does not flag cursed pairs when they are the final pair', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        const board = {
            ...run.board!,
            cursedPairKey: first.pairKey,
            matchedPairs: run.board!.pairCount - 1
        };

        const result = resolveTurnMatchScoringSummary({
            run: { ...run, board },
            sourceBoard: board,
            resolvedBoard: board,
            matchedPairKey: first.pairKey,
            matchedTiles: [first, second],
            encorePairKeys: [],
            findableScoreBonus: 0,
            routeCardScore: 0,
            dungeonScore: 0,
            enemyDamageScore: 0,
            hazardDamageScore: 0,
            fragileCacheClaimed: false,
            fuseCacheFresh: false,
            pinLatticeRewarded: false,
            tollCacheClaimed: false
        });

        expect(result.cursedMatchedEarly).toBe(false);
    });
});
