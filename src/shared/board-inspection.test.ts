import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { boardHasGlassDecoy, getWildTileIdFromBoard, isBoardComplete } from './board-inspection';
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
        tiles
    }) as BoardState;

describe('board-inspection', () => {
    it('finds a wild joker tile id when present', () => {
        expect(getWildTileIdFromBoard(board([tile('a', 'p'), tile('wild', WILD_PAIR_KEY)]))).toBe('wild');
        expect(getWildTileIdFromBoard(board([tile('a', 'p')]))).toBe(null);
    });

    it('distinguishes glass decoy from mirror decoy hazards', () => {
        expect(boardHasGlassDecoy(board([tile('decoy', DECOY_PAIR_KEY)]))).toBe(true);
        expect(boardHasGlassDecoy(board([tile('mirror', DECOY_PAIR_KEY, { tileHazardKind: 'mirror_decoy' })]))).toBe(false);
    });

    it('requires real tiles to be cleared', () => {
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a', { state: 'matched' })]))).toBe(true);
        expect(isBoardComplete(board([tile('a1', 'a', { state: 'matched' }), tile('a2', 'a')]))).toBe(false);
    });

    it('requires dungeon exits to be activated when present', () => {
        const withExit = board([tile('a1', 'a', { state: 'matched' }), tile('exit', '__exit__')]);

        expect(isBoardComplete({ ...withExit, dungeonExitTileId: 'exit', dungeonExitActivated: false })).toBe(false);
        expect(isBoardComplete({ ...withExit, dungeonExitTileId: 'exit', dungeonExitActivated: true })).toBe(true);
    });

    it('allows hidden glass decoys and flipped mirror decoys after real tiles clear', () => {
        expect(
            isBoardComplete(
                board([
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('decoy', DECOY_PAIR_KEY)
                ])
            )
        ).toBe(true);
        expect(
            isBoardComplete(
                board([
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('mirror', DECOY_PAIR_KEY, { state: 'flipped', tileHazardKind: 'mirror_decoy' })
                ])
            )
        ).toBe(true);
    });

    it('treats sprung trap tiles as settled', () => {
        expect(
            isBoardComplete(
                board([tile('trap', 'trap', { state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' })])
            )
        ).toBe(true);
    });
});
