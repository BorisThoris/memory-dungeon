import { describe, expect, it } from 'vitest';
import { MATCH_DELAY_MS, type RelicId } from './contracts';
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
        // Per-tile budget × default board: 4 tiles at floor 1, 8 at floor 3, 60 (capped) at floor 29.
        expect(getMemorizeDuration(1)).toBe(1300);
        expect(getMemorizeDuration(1.9)).toBe(1300);
        expect(getMemorizeDuration(3)).toBe(2408);
        expect(getMemorizeDuration(29)).toBe(6000);
        // A real board wins over the default size: a 10-tile floor 3 gets its own budget.
        expect(getMemorizeDuration(3, 10)).toBe(3010);
        expect(getMemorizeDuration(Number.NaN)).toBe(1300);
        expect(getMemorizeDuration(Number.POSITIVE_INFINITY)).toBe(1300);

        // Run modifiers apply on top of the real board's budget (the level-1 board carries a wild tile).
        const short = createNewRun(0, { activeMutators: ['short_memorize'] });
        const shortBase = getMemorizeDuration(1, short.board!.tiles.length);
        expect(getMemorizeDurationForRun(short, 1)).toBe(shortBase - 350);

        const meditation = createNewRun(0, { gameMode: 'meditation' });
        expect(getMemorizeDurationForRun(meditation, 1)).toBe(
            Math.floor(getMemorizeDuration(1, meditation.board!.tiles.length) * 1.55)
        );
    });

    it('ignores malformed relic ids when calculating run memorize duration', () => {
        const run = {
            ...createNewRun(0, { activeMutators: ['short_memorize'] }),
            relicIds: Number.NaN as unknown as RelicId[]
        };

        expect(getMemorizeDurationForRun(run, 1)).toBe(getMemorizeDuration(1, run.board!.tiles.length) - 350);
    });

    it('applies boss identity pressure to boss-floor memorize time', () => {
        const base = createNewRun(0, { runSeed: 9_100 });
        const rush = {
            ...base,
            board: base.board && { ...base.board, floorTag: 'boss' as const, dungeonBossId: 'rush_sentinel' as const }
        };
        const spire = {
            ...base,
            board: base.board && { ...base.board, floorTag: 'boss' as const, dungeonBossId: 'spire_observer' as const }
        };

        const bossBase = getMemorizeDuration(1, base.board!.tiles.length);
        expect(getMemorizeDurationForRun(rush, 1)).toBe(bossBase - 120);
        expect(getMemorizeDurationForRun(spire, 1)).toBe(bossBase + 80);
        expect(
            getMemorizeDurationForRun(
                { ...base, board: base.board && { ...base.board, floorTag: 'normal' as const, dungeonBossId: 'rush_sentinel' } },
                1
            )
        ).toBe(bossBase);
    });

    it('calculates ratings and score bonuses', () => {
        expect(calculateRating(0)).toBe('S++');
        expect(calculateRating(1)).toBe('S');
        expect(calculateRating(9)).toBe('F');
        expect(calculateMatchScore(2, 3, 1.5)).toBe(82);
        expect(calculateLevelClearBonus(4.9)).toBe(200);
        expect(calculateLevelClearBonus(4)).toBe(200);
        expect(calculateLevelClearBonus(Number.NaN)).toBe(0);
        expect(calculateLevelClearBonus(Number.POSITIVE_INFINITY)).toBe(0);
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

    it('returns no resolve delay for malformed flipped tile ids', () => {
        const run = createNewRun(0, { fixedBoard: null });

        expect(
            computeFlipResolveDelayMs(run, Number.NaN as unknown as string[], {
                resolveDelayMultiplier: 2,
                echoFeedbackEnabled: true
            })
        ).toBe(0);
    });

    it('sums presentation mutator match penalties', () => {
        const run = createNewRun(0, { activeMutators: ['wide_recall', 'silhouette_twist', 'distraction_channel'] });
        expect(getPresentationMutatorMatchPenalty(run)).toBe(14);
    });
});
