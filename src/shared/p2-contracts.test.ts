import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import { buildBoard, createNewRun, finishMemorizePhase, resolveBoardTurn } from './game';
import { getPowerVerbRows } from './power-verbs';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state
});

describe('GLD-P2 board, power, and resolution contracts', () => {
    it('copies fixed tiles exactly when fixedTilesMode is exact', () => {
        const fixedTiles = [tile('a1', 'A'), tile('a2', 'A')];
        const board = buildBoard(8, {
            fixedTiles,
            fixedTilesMode: 'exact',
            gameMode: 'endless',
            runSeed: 42_001
        });

        expect(board.tiles).toEqual(fixedTiles);
        expect(board.dungeonExitTileId).toBeNull();
        expect(board.dungeonShopTileId).toBeNull();
        expect(board.dungeonBossId).toBeNull();
        expect(board.enemyHazards).toEqual([]);
    });

    it('gives back exactly the fixed tiles it was handed, and nothing else', () => {
        // The branch used to add an exit, a shop, a room and a layout plan to a board a caller
        // had already authored. It hands back what it was given now (docs/REMOVED_DUNGEON_LAYER.md).
        const board = buildBoard(8, {
            fixedTiles: [tile('a1', 'A'), tile('a2', 'A')],
            gameMode: 'endless',
            runSeed: 42_001
        });

        expect(board.tiles).toHaveLength(2);
        expect(board.dungeonExitTileId).toBeNull();
        expect(board.dungeonBossId).toBeNull();
    });

    it('does not spend wild capacity when a gambit third wild is not part of the selected match', () => {
        const base = finishMemorizePhase(createNewRun(0, { gameMode: 'endless', enableWildJoker: true }));
        const run = {
            ...base,
            status: 'resolving' as const,
            wildMatchesRemaining: 1,
            board: {
                ...base.board!,
                level: 2,
                pairCount: 1,
                flippedTileIds: ['a1', 'a2', 'wild'],
                tiles: [
                    tile('a1', 'A', 'flipped'),
                    tile('a2', 'A', 'flipped'),
                    tile('wild', '__wild__', 'flipped')
                ]
            }
        };

        const resolved = resolveBoardTurn(run);

        expect(resolved.wildMatchesRemaining).toBe(1);
        expect(resolved.board?.tiles.find((candidate) => candidate.id === 'wild')?.state).toBe('hidden');
    });

    it('reports Destroy and Peek as unavailable when their next target path cannot execute', () => {
        const base = finishMemorizePhase(createNewRun(0, { gameMode: 'endless' }));
        const openFlipRun = {
            ...base,
            destroyPairCharges: 1,
            peekCharges: 1,
            board: {
                ...base.board!,
                flippedTileIds: [base.board!.tiles[0]!.id],
                tiles: base.board!.tiles.map((candidate, index) =>
                    index === 0 ? { ...candidate, state: 'flipped' as const } : candidate
                )
            }
        };
        const rows = getPowerVerbRows(openFlipRun);

        expect(rows.find((row) => row.id === 'destroy_pair')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'peek')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'region_shuffle')?.disabledReason).toBe('Resolve the current flip first.');
        expect(rows.find((row) => row.id === 'tile_swap')?.disabledReason).toBe('Resolve the current flip first.');
        expect(
            getPowerVerbRows({ ...base, activeContract: { noDestroy: true, noShuffle: false, maxMismatches: null }, destroyPairCharges: 1 }).find(
                (row) => row.id === 'destroy_pair'
            )?.disabledReason
        ).toBe('Scholar contract disables destroy.');
    });
});
