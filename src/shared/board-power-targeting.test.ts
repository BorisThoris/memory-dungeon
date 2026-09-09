import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    isCompletionSafeStrayPairKey,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview
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
    it('collects only fully hidden real pairs for destroy targeting', () => {
        const state = board([
            tile('a1', 'A'),
            tile('a2', 'A'),
            tile('b1', 'B'),
            tile('b2', 'B', 'matched'),
            tile('w1', WILD_PAIR_KEY)
        ]);

        expect(tileIsDestroyEligiblePreview(state, 'a1')).toBe(true);
        expect(tileIsDestroyEligiblePreview(state, 'b1')).toBe(false);
        expect(tileIsDestroyEligiblePreview(state, 'w1')).toBe(false);
        expect(collectDestroyEligibleTileIds(state)).toEqual(new Set(['a1', 'a2']));
    });

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

    it('limits stray targeting to hidden completion-safe singleton tiles', () => {
        const state = board([
            tile('a1', 'A'),
            tile('w1', WILD_PAIR_KEY),
            tile('matchedWild', WILD_PAIR_KEY, 'matched')
        ]);

        expect(isCompletionSafeStrayPairKey(WILD_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey('A')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'w1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'a1')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'matchedWild')).toBe(false);
    });
});
