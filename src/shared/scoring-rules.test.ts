import { describe, expect, it } from 'vitest';
import { MATCH_DELAY_MS } from './contracts';
import { createNewRun } from './game-core';
import {
    calculateLevelClearBonus,
    calculateMatchScore,
    calculatePerfectClearBonus,
    calculateRating,
    computeFlipResolveDelayMs,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    getPresentationMutatorMatchPenalty,
    tilesArePairMatch
} from './scoring-rules';

describe('scoring-rules', () => {
    it('calculates memorize duration and run modifiers', () => {
        expect(getMemorizeDuration(1)).toBe(1300);
        expect(getMemorizeDuration(3)).toBe(1250);
        expect(getMemorizeDuration(29)).toBe(600);

        const short = createNewRun(0, { activeMutators: ['short_memorize'] });
        expect(getMemorizeDurationForRun(short, 1)).toBe(950);

        const meditation = createNewRun(0, { gameMode: 'meditation' });
        expect(getMemorizeDurationForRun(meditation, 1)).toBe(Math.floor(1300 * 1.55));
    });

    it('calculates ratings and score bonuses', () => {
        expect(calculateRating(0)).toBe('S++');
        expect(calculateRating(1)).toBe('S');
        expect(calculateRating(9)).toBe('F');
        expect(calculateMatchScore(2, 3, 1.5)).toBe(82);
        expect(calculateLevelClearBonus(4)).toBe(200);
        expect(calculatePerfectClearBonus()).toBe(25);
    });

    it('matches regular, wild, and decoy pair keys', () => {
        const tile = (id: string, pairKey: string) => ({ id, pairKey, symbol: id, label: id, state: 'hidden' as const });

        expect(tilesArePairMatch(tile('a', 'p'), tile('b', 'p'))).toBe(true);
        expect(tilesArePairMatch(tile('a', '__wild__'), tile('b', 'p'))).toBe(true);
        expect(tilesArePairMatch(tile('a', '__decoy__'), tile('b', '__decoy__'))).toBe(false);
        expect(tilesArePairMatch(tile('a', 'p'), tile('b', 'q'))).toBe(false);
    });

    it('computes mismatch resolve delay from run tiles and echo setting', () => {
        const run = createNewRun(0, { fixedBoard: null });
        const [first, second] = run.board!.tiles.filter((tile) => tile.pairKey !== run.board!.tiles[0]!.pairKey);
        const mismatched = {
            ...run,
            board: run.board && {
                ...run.board,
                tiles: run.board.tiles.map((tile, index) =>
                    index === 0
                        ? { ...tile, id: 'first', pairKey: 'first' }
                        : index === 1
                          ? { ...tile, id: 'second', pairKey: 'second' }
                          : tile
                )
            }
        };

        expect(first).toBeDefined();
        expect(second).toBeDefined();
        expect(
            computeFlipResolveDelayMs(mismatched, ['first', 'second'], {
                resolveDelayMultiplier: 2,
                echoFeedbackEnabled: true
            })
        ).toBe(MATCH_DELAY_MS * 2 + 380);
    });

    it('sums presentation mutator match penalties', () => {
        const run = createNewRun(0, { activeMutators: ['wide_recall', 'silhouette_twist', 'distraction_channel'] });
        expect(getPresentationMutatorMatchPenalty(run)).toBe(14);
    });
});
