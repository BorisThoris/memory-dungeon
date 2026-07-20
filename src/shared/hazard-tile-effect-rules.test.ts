import { describe, expect, it } from 'vitest';

import type { BoardState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    applyCascadeCacheHazard,
    applySafeHazardWardMismatch,
    applyShuffleSnareHazard,
    breakFragileCacheHazards,
    hazardKindsInTiles
} from './hazard-tile-effect-rules';

describe('hazard tile effect rules', () => {
    it('triggers shuffle snare only when at least two safe hidden targets exist', () => {
        const run = createNewRun(0);
        const board = boardWith([tile('a', 'a'), tile('b', 'b')]);

        expect(applyShuffleSnareHazard(boardWith([tile('a', 'a')]), run)).toMatchObject({ triggered: false });
        expect(applyShuffleSnareHazard(board, run).triggered).toBe(true);
    });

    it('removes a complete safe target pair for cascade cache', () => {
        const run = createNewRun(0);
        const board = boardWith([
            tile('match-a', 'matched-a'),
            tile('safe-a', 'safe-a'),
            tile('safe-b', 'safe-a')
        ]);

        const result = applyCascadeCacheHazard(board, run, 'matched-a');

        expect(result.triggered).toBe(true);
        expect(result.board.matchedPairs).toBe(board.matchedPairs + 1);
        expect(result.board.tiles.filter((candidate) => candidate.pairKey === 'safe-a')).toEqual(
            expect.arrayContaining([expect.objectContaining({ state: 'removed' })])
        );
    });

    it('breaks fragile cache hazards on both tiles in the source pair', () => {
        const board = boardWith([
            tile('a', 'fragile-a', { tileHazardKind: 'fragile_cache' }),
            tile('b', 'fragile-a', { tileHazardKind: 'fragile_cache' })
        ]);
        const result = breakFragileCacheHazards(board, board.tiles);

        expect(result.brokenCount).toBe(1);
        expect(result.board.tiles.every((candidate) => candidate.tileHazardKind == null)).toBe(true);
    });

    it('uses safe hazard wards to block snare before fragile breakage', () => {
        const run = { ...createNewRun(0), safeHazardWardChargesThisFloor: 1 };
        const board = boardWith([
            tile('snare-a', 'snare-a', { tileHazardKind: 'shuffle_snare' }),
            tile('fragile-a', 'fragile-a', { tileHazardKind: 'fragile_cache' })
        ]);
        const result = applySafeHazardWardMismatch(run, board, board.tiles, new Set(['shuffle_snare', 'fragile_cache']));

        expect(result).toMatchObject({
            wardUsed: true,
            wardChargeSpent: true,
            traitWardUsed: false,
            snareHazard: { triggered: false },
            fragileBreak: { brokenCount: 1 }
        });
    });

    it('normalizes malformed ward charges before blocking hazard effects', () => {
        const run = { ...createNewRun(0), safeHazardWardChargesThisFloor: Number.POSITIVE_INFINITY };
        const board = boardWith([
            tile('snare-a', 'snare-a', { tileHazardKind: 'shuffle_snare' }),
            tile('safe-a', 'safe-a'),
            tile('safe-b', 'safe-b')
        ]);
        const result = applySafeHazardWardMismatch(run, board, [board.tiles[0]!], new Set(['shuffle_snare']));

        expect(result).toMatchObject({
            wardUsed: false,
            wardChargeSpent: false,
            traitWardUsed: false,
            snareHazard: { triggered: true }
        });
    });

    it('lets Stasis absorb one snare mismatch without spending ward charges', () => {
        const run = { ...createNewRun(0), safeHazardWardChargesThisFloor: 0 };
        const board = boardWith([
            tile('snare-a', 'snare-a', { tileHazardKind: 'shuffle_snare', tileTraitKind: 'stasis' }),
            tile('safe-a', 'safe-a'),
            tile('safe-b', 'safe-b')
        ]);
        const result = applySafeHazardWardMismatch(run, board, [board.tiles[0]!], new Set(['shuffle_snare']));

        expect(result).toMatchObject({
            wardUsed: true,
            wardChargeSpent: false,
            traitWardUsed: true,
            snareHazard: { triggered: false }
        });
        expect(result.board).toBe(board);
    });

    it('lets Stasis absorb one fragile cache mismatch without breaking the cache', () => {
        const run = { ...createNewRun(0), safeHazardWardChargesThisFloor: 0 };
        const board = boardWith([
            tile('fragile-a', 'fragile-a', { tileHazardKind: 'fragile_cache', tileTraitKind: 'stasis' }),
            tile('safe-a', 'safe-a')
        ]);
        const result = applySafeHazardWardMismatch(run, board, board.tiles, new Set(['fragile_cache']));

        expect(result).toMatchObject({
            wardUsed: true,
            wardChargeSpent: false,
            traitWardUsed: true,
            fragileBreak: { brokenCount: 0 }
        });
        expect(result.board.tiles[0]?.tileHazardKind).toBe('fragile_cache');
    });

    it('collects hazard kinds by tile id', () => {
        const tiles = [
            tile('a', 'a', { tileHazardKind: 'shuffle_snare' }),
            tile('b', 'b', { tileHazardKind: 'fragile_cache' }),
            tile('c', 'c')
        ];

        expect(hazardKindsInTiles(tiles, ['a', 'c'])).toEqual(new Set(['shuffle_snare']));
    });
});

const boardWith = (tiles: Tile[]): BoardState => ({
    ...createNewRun(0).board!,
    tiles,
    matchedPairs: 0
});

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    ...extra
});
