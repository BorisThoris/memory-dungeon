import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    collectPeekEligibleTileIds,
    tileIsPeekEligiblePreview,
} from './board-power-targeting';
import { WILD_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

const board = (tiles: Tile[]): BoardState => ({
    level: 1,
    pairCount: 0,
    columns: 4,
    rows: 2,
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

describe('board power targeting rules', () => {

    it('allows peek targeting hidden tiles that have not already been revealed by peek', () => {
        const state = board([
            tile('a1', 'A'),
            tile('a2', 'A', 'flipped'),
            tile('w1', WILD_PAIR_KEY)
        ]);

        expect(tileIsPeekEligiblePreview(state, ['w1'], 'a1')).toBe(true);
        expect(tileIsPeekEligiblePreview(state, [], 'a2')).toBe(false);
        expect(tileIsPeekEligiblePreview(state, ['w1'], 'w1')).toBe(false);
        expect(collectPeekEligibleTileIds(state, ['w1'])).toEqual(new Set(['a1']));
    });

});
