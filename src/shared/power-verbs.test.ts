import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from './game-core';
import { getPowerVerbRows, POWER_VERB_GROUPS } from './power-verbs';
import { assertTokenCoverage, calculateMemoryTaxReview } from './mechanic-feedback';

describe('REG-045 power verb teaching', () => {
    it('groups every shipped toolbar power by cognitive job with cost and consequence copy', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const rows = getPowerVerbRows(run);

        expect(Object.keys(POWER_VERB_GROUPS)).toEqual(['recall', 'search', 'damage_control', 'risk']);
        expect(rows.map((row) => row.id)).toEqual([
            'pin',
            'peek',
            'flash_pair',
            'shuffle',
            'region_shuffle',
            'tile_swap',
            'destroy_pair',
            'stray_remove',
            'undo_resolve',
            'gambit'
        ]);
        expect(rows.every((row) => row.cost.length > 0 && row.perfectMemoryImpact.length > 0)).toBe(true);
        expect(rows.every((row) => row.consequence.length > 0 && row.perfectMemoryCopy.length > 0)).toBe(true);
        expect(rows.every((row) => assertTokenCoverage(row.tokens))).toBe(true);
        expect(rows.find((row) => row.id === 'pin')).toMatchObject({
            mechanicClass: 'tool',
            perfectMemoryImpact: 'allowed',
            perfectMemoryCopy: 'Perfect Memory-safe.'
        });
        expect(rows.filter((row) => row.id !== 'pin').every((row) => row.perfectMemoryImpact === 'locks_perfect_memory')).toBe(
            true
        );
        expect(calculateMemoryTaxReview(rows.find((row) => row.id === 'shuffle')!.memoryTax)).toMatchObject({
            band: 'core_safe',
            total: 4
        });
        expect(calculateMemoryTaxReview(rows.find((row) => row.id === 'gambit')!.memoryTax)).toMatchObject({
            band: 'controlled_assist_or_pressure',
            total: 5
        });
        expect(rows.find((row) => row.id === 'shuffle')?.disabledReason).toBeNull();
        expect(getPowerVerbRows({ ...run, shuffleCharges: 0 }).find((row) => row.id === 'shuffle')?.disabledReason).toBe(
            'No shuffle charges.'
        );
        expect(rows.find((row) => row.id === 'region_shuffle')?.cost).toBe(
            '1 row/swap charge(s); build effects may make the first row shuffle or tile swap free.'
        );
        expect(getPowerVerbRows({ ...run, regionShuffleCharges: 0 }).find((row) => row.id === 'region_shuffle')?.disabledReason).toBe(
            'No row/swap charge or free row shuffle.'
        );
        expect(rows.find((row) => row.id === 'tile_swap')?.cost).toBe(
            '1 row/swap charge(s); build effects may make the first row shuffle or tile swap free.'
        );
        expect(getPowerVerbRows({ ...run, regionShuffleCharges: 0 }).find((row) => row.id === 'tile_swap')?.disabledReason).toBe(
            'No row/swap charge or free swap.'
        );
        const perkRows = getPowerVerbRows({
            ...run,
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            rewardPerkIds: ['free_first_swap_per_floor']
        });
        expect(perkRows.find((row) => row.id === 'region_shuffle')?.disabledReason).toBeNull();
        expect(perkRows.find((row) => row.id === 'tile_swap')?.disabledReason).toBeNull();
        expect(getPowerVerbRows({ ...run, status: 'memorize' }).find((row) => row.id === 'peek')?.disabledReason).toBe(
            'Only while playing.'
        );
    });

    it('normalizes malformed saved counters before projecting power rows', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const rows = getPowerVerbRows({
            ...run,
            activeContract: { noDestroy: false, noShuffle: false, maxMismatches: null, maxPinsTotalRun: 1.9 },
            board: run.board
                ? {
                      ...run.board,
                      flippedTileIds: Number.NaN as unknown as string[]
                  }
                : null,
            destroyPairCharges: Number.POSITIVE_INFINITY,
            flashPairCharges: Number.NaN,
            peekCharges: Number.NaN,
            peekRevealedTileIds: Number.NaN as unknown as string[],
            pinnedTileIds: Number.NaN as unknown as string[],
            pinsPlacedCountThisRun: 1.9,
            regionShuffleCharges: Number.POSITIVE_INFINITY,
            shuffleCharges: Number.NaN,
            strayRemoveCharges: Number.NaN,
            undoUsesThisFloor: Number.NaN
        });

        expect(rows.find((row) => row.id === 'pin')?.disabledReason).toBe('Pin vow placement cap reached.');
        expect(rows.find((row) => row.id === 'pin')?.cost).toBe('0 pinned now; pins are slot-limited.');
        expect(rows.find((row) => row.id === 'peek')?.cost).toBe('0 peek charge(s).');
        expect(rows.find((row) => row.id === 'peek')?.disabledReason).toBe('No peek charges.');
        expect(rows.find((row) => row.id === 'flash_pair')?.disabledReason).toBe('No flash charges.');
        expect(rows.find((row) => row.id === 'shuffle')?.cost).toBe('0 full-board charge(s).');
        expect(rows.find((row) => row.id === 'region_shuffle')?.cost).toBe(
            '0 row/swap charge(s); build effects may make the first row shuffle or tile swap free.'
        );
        expect(rows.find((row) => row.id === 'destroy_pair')?.cost).toBe('0 destroy charge(s).');
        expect(rows.find((row) => row.id === 'stray_remove')?.disabledReason).toBe('No stray-remove charges.');
        expect(rows.find((row) => row.id === 'undo_resolve')?.disabledReason).toBe('No undo uses this floor.');
    });

    it('blocks flip-sensitive teaching rows when open-flip state is malformed', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const rows = getPowerVerbRows({
            ...run,
            board: run.board
                ? {
                      ...run.board,
                      flippedTileIds: Number.NaN as unknown as string[]
                  }
                : null,
            destroyPairCharges: 1,
            peekCharges: 1,
            regionShuffleCharges: 1,
            shuffleCharges: 1
        });

        expect(rows.find((row) => row.id === 'peek')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'shuffle')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'region_shuffle')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'tile_swap')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'destroy_pair')?.disabledReason).toBe('Resolve the current flip first.');
    });
});
