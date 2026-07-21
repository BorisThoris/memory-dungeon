import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RunState,
    Tile
} from './contracts';
import {
    canDestroyPair,
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard,
    canSwapHiddenTiles
} from './board-power-availability';
import { DECOY_PAIR_KEY, EXIT_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

const board = (tiles: Tile[], columns = 4): BoardState => ({
    level: 1,
    pairCount: 0,
    columns,
    rows: Math.ceil(tiles.length / columns),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: board([
        tile('a1', 'A'),
        tile('a2', 'A'),
        tile('b1', 'B'),
        tile('b2', 'B')
    ]),
    shuffleCharges: 1,
    freeShuffleThisFloor: false,
    regionShuffleCharges: 1,
    regionShuffleFreeThisFloor: false,
    destroyPairCharges: 1,
    relicIds: [],
    ...overrides
} as RunState);

describe('board power availability rules', () => {
    it('requires playing state, clear flips, a shuffle charge, and enough hidden pairs for shuffle', () => {
        expect(canShuffleBoard(run())).toBe(true);
        expect(canShuffleBoard(run({ status: 'memorize' }))).toBe(false);
        expect(canShuffleBoard(run({ board: { ...run().board!, flippedTileIds: ['a1'] } }))).toBe(false);
        expect(canShuffleBoard(run({ shuffleCharges: 0 }))).toBe(false);
        expect(canShuffleBoard(run({ activeContract: { noShuffle: true } as RunState['activeContract'] }))).toBe(false);
        expect(canShuffleBoard(run({
            shuffleCharges: 0,
            freeShuffleThisFloor: true,
            relicIds: ['first_shuffle_free_per_floor']
        }))).toBe(true);
    });

    it('fails closed when board power open-flip state is malformed', () => {
        const malformed = run({
            board: { ...run().board!, flippedTileIds: Number.NaN as unknown as string[] }
        });

        expect(canShuffleBoard(malformed)).toBe(false);
        expect(canDestroyPair(malformed, 'a1')).toBe(false);
        expect(canRegionShuffle(malformed)).toBe(false);
        expect(canRegionShuffleRow(malformed, 0)).toBe(false);
        expect(canSwapHiddenTiles(malformed, 'a1', 'b1')).toBe(false);
    });

    it('checks destroy availability through the shared targeting predicate', () => {
        expect(canDestroyPair(run(), 'a1')).toBe(true);
        expect(canDestroyPair(run({ destroyPairCharges: 0 }), 'a1')).toBe(false);
        expect(canDestroyPair(run({ board: { ...run().board!, flippedTileIds: ['a1'] } }), 'a1')).toBe(false);
        expect(canDestroyPair(run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A', 'matched'),
                tile('d1', DECOY_PAIR_KEY)
            ])
        }), 'a1')).toBe(false);
    });

    it('blocks destroy from deleting the only primary-exit lever source', () => {
        const lockedBoard = board([
            { ...tile('lever-a', 'lever'), dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' },
            { ...tile('lever-b', 'lever'), dungeonCardKind: 'lever', dungeonCardEffectId: 'lever_floor' },
            tile('safe-a', 'safe'),
            tile('safe-b', 'safe'),
            {
                ...tile('exit', EXIT_PAIR_KEY),
                dungeonCardKind: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 1
            }
        ]);
        const state = run({
            board: {
                ...lockedBoard,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'lever',
                dungeonExitRequiredLeverCount: 1
            }
        });

        expect(canDestroyPair(state, 'lever-a')).toBe(false);
        expect(canDestroyPair(state, 'safe-a')).toBe(true);
    });

    it('blocks destroy from deleting the only primary-exit key source', () => {
        const lockedBoard = board([
            { ...tile('key-a', 'key'), dungeonCardKind: 'key', dungeonKeyKind: 'iron' },
            { ...tile('key-b', 'key'), dungeonCardKind: 'key', dungeonKeyKind: 'iron' },
            tile('safe-a', 'safe'),
            tile('safe-b', 'safe'),
            {
                ...tile('exit', EXIT_PAIR_KEY),
                dungeonCardKind: 'exit',
                dungeonExitLockKind: 'iron'
            }
        ]);
        const state = run({
            board: {
                ...lockedBoard,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'iron'
            }
        });

        expect(canDestroyPair(state, 'key-a')).toBe(false);
        expect(canDestroyPair(state, 'safe-a')).toBe(true);
    });

    it('allows region shuffle when any hidden pair exists, then gates each row by hidden tile count', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B', 'matched')
            ], 2)
        });

        expect(canRegionShuffle(state)).toBe(true);
        expect(canRegionShuffleRow(state, 0)).toBe(true);
        expect(canRegionShuffleRow(state, 1)).toBe(false);
        expect(canRegionShuffle(run({ regionShuffleCharges: 0 }))).toBe(false);
        expect(canRegionShuffle(run({
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            relicIds: ['region_shuffle_free_first']
        }))).toBe(true);
        expect(canRegionShuffle(run({
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            relicIds: Number.NaN as unknown as []
        }))).toBe(false);
    });

    it('allows tile swap only for two hidden tiles with row/swap payment and no open flip', () => {
        expect(canSwapHiddenTiles(run(), 'a1', 'b1')).toBe(true);
        expect(canSwapHiddenTiles(run({ status: 'memorize' }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ board: { ...run().board!, flippedTileIds: ['a1'] } }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ activeContract: { noShuffle: true } as RunState['activeContract'] }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ regionShuffleCharges: 0 }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({
            regionShuffleCharges: 0,
            regionShuffleFreeThisFloor: true,
            relicIds: ['region_shuffle_free_first']
        }), 'a1', 'b1')).toBe(true);
        expect(canSwapHiddenTiles(run(), 'a1', 'a1')).toBe(false);
        expect(canSwapHiddenTiles(run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A', 'matched'),
                tile('b1', 'B'),
                tile('b2', 'B')
            ])
        }), 'a1', 'a2')).toBe(false);
    });
});
