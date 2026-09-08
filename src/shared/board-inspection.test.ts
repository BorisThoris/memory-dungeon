import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    boardHasGlassDecoy,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    inspectRunFairness,
    isBoardComplete
} from './board-inspection';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...extra
});

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        rows: 2,
        columns: 2,
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        pairCount: Math.floor(tiles.filter((candidate) => ![DECOY_PAIR_KEY, WILD_PAIR_KEY].includes(candidate.pairKey)).length / 2),
        floorArchetypeId: null,
        featuredObjectiveId: null
    });

describe('board-inspection', () => {
    it('finds a wild joker tile id when present', () => {
        expect(getWildTileIdFromBoard(board([tile('a', 'p'), tile('wild', WILD_PAIR_KEY)]))).toBe('wild');
        expect(getWildTileIdFromBoard(board([tile('a', 'p')]))).toBe(null);
    });

    it('finds a glass decoy when the board carries one', () => {
        expect(boardHasGlassDecoy(board([tile('decoy', DECOY_PAIR_KEY)]))).toBe(true);
        expect(boardHasGlassDecoy(board([tile('a', 'p')]))).toBe(false);
    });

    it('requires real tiles to be cleared', () => {
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a', { state: 'matched' })]))).toBe(true);
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a')]))).toBe(false);
    });






    it('allows hidden glass decoys after real tiles clear', () => {
        expect(
            isBoardComplete(
                board([
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('decoy', DECOY_PAIR_KEY)
                ])
            )
        ).toBe(true);
    });






    it('reports malformed flipped tile ids instead of throwing during fairness inspection', () => {
        const malformed = {
            ...board([
                tile('a1', 'a', { state: 'flipped' }),
                tile('a2', 'a')
            ]),
            flippedTileIds: Number.NaN as unknown as string[]
        };

        const inspected = inspectBoardFairness(malformed);

        expect(inspected.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'flipped_tile_reference_missing',
                    message: 'flippedTileIds is malformed and cannot be inspected.'
                })
            ])
        );
    });

    it('reports malformed resolving flip ids as a run-level issue', () => {
        const malformed = {
            status: 'resolving',
            board: {
                ...board([
                    tile('a1', 'a', { state: 'flipped' }),
                    tile('a2', 'a', { state: 'flipped' })
                ]),
                flippedTileIds: Number.NaN as unknown as string[]
            }
        } as unknown as Parameters<typeof inspectRunFairness>[0];

        const inspected = inspectRunFairness(malformed);

        expect(inspected.intentionalBlockers).not.toContain('resolving_flips');
        expect(inspected.issues.map((issue) => issue.code)).toEqual(
            expect.arrayContaining(['flipped_tile_reference_missing', 'run_resolving_without_flipped_tiles'])
        );
    });
});
