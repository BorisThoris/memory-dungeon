import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RouteSpecialKind,
    Tile
} from './contracts';
import {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    isCompletionSafeStrayPairKey,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview
} from './board-power-targeting';
import {
    DECOY_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    WILD_PAIR_KEY
} from './tile-identity';

const tile = (
    id: string,
    pairKey: string,
    state: Tile['state'] = 'hidden',
    routeSpecialKind?: RouteSpecialKind
): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state,
    routeSpecialKind
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
    it('collects only fully hidden non-decoy pairs for destroy targeting', () => {
        const state = board([
            tile('a1', 'A'),
            tile('a2', 'A'),
            tile('b1', 'B'),
            tile('b2', 'B', 'matched'),
            tile('d1', DECOY_PAIR_KEY)
        ]);

        expect(tileIsDestroyEligiblePreview(state, 'a1')).toBe(true);
        expect(tileIsDestroyEligiblePreview(state, 'b1')).toBe(false);
        expect(tileIsDestroyEligiblePreview(state, 'd1')).toBe(false);
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
            tile('shop1', SHOP_PAIR_KEY),
            tile('room1', ROOM_PAIR_KEY),
            tile('d1', DECOY_PAIR_KEY),
            tile('matchedWild', WILD_PAIR_KEY, 'matched')
        ]);

        expect(isCompletionSafeStrayPairKey(WILD_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey(SHOP_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey(ROOM_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey('A')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'w1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'shop1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'room1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'a1')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'd1')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'matchedWild')).toBe(false);
    });

    it('protects route specials that are unsafe to remove as stray tiles', () => {
        const state = board([
            tile('keystone', WILD_PAIR_KEY, 'hidden', 'keystone_pair'),
            tile('ward', WILD_PAIR_KEY, 'hidden', 'final_ward'),
            tile('omen', WILD_PAIR_KEY, 'hidden', 'omen_seal'),
            tile('secret', WILD_PAIR_KEY, 'hidden', 'secret_door')
        ]);

        expect(tileIsStrayEligiblePreview(state, 'keystone')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'ward')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'omen')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'secret')).toBe(true);
    });
});
