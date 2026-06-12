import { describe, expect, it } from 'vitest';

import type { Tile } from './contracts';
import {
    assignFindableKindsToTiles,
    atomicVariantForPairKey,
    countFindablePairs,
    createTiles,
    pickCursedPairKey
} from './board-tile-generation-rules';
import {
    DECOY_PAIR_KEY,
    WILD_PAIR_KEY
} from './tile-identity';

describe('board tile generation rules', () => {
    it('creates deterministic paired tiles with optional decoy and wild singleton', () => {
        const tiles = createTiles(2, 3, 123, 20, ['glass_floor'], true);
        const repeat = createTiles(2, 3, 123, 20, ['glass_floor'], true);

        expect(tiles).toEqual(repeat);
        expect(tiles.filter((tile) => tile.pairKey.startsWith('2-')).length).toBe(6);
        expect(tiles).toEqual(expect.arrayContaining([
            expect.objectContaining({ pairKey: DECOY_PAIR_KEY, symbol: 'X' }),
            expect.objectContaining({ pairKey: WILD_PAIR_KEY, symbol: '?' })
        ]));
        expect(new Set(tiles.filter((tile) => tile.pairKey === '2-0').map((tile) => tile.atomicVariant))).toEqual(
            new Set([atomicVariantForPairKey('2-0')])
        );
    });

    it('uses letter symbols when category_letters mutator is active', () => {
        const tiles = createTiles(1, 2, 1, 20, ['category_letters']);

        expect(new Set(tiles.map((tile) => tile.symbol))).toEqual(new Set(['A', 'B']));
    });

    it('assigns findables to whole eligible real pairs only', () => {
        const tiles = [
            tile('a1', 'a'),
            tile('a2', 'a'),
            tile('b1', 'b'),
            tile('b2', 'b'),
            tile('wild', WILD_PAIR_KEY),
            tile('decoy', DECOY_PAIR_KEY)
        ];
        const assigned = assignFindableKindsToTiles(tiles, ['findables_floor'], 5, 20, 4);
        const tagged = assigned.filter((candidate) => candidate.findableKind != null);

        expect(tagged.length).toBe(4);
        expect(new Set(tagged.map((candidate) => candidate.pairKey))).toEqual(new Set(['a', 'b']));
        expect(countFindablePairs(assigned)).toBe(2);
    });

    it('keeps legacy findables gated behind the mutator before the baseline rules version', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b')];

        expect(assignFindableKindsToTiles(tiles, [], 5, 7, 4)).toEqual(tiles);
        expect(assignFindableKindsToTiles(tiles, ['findables_floor'], 5, 7, 4).some((candidate) => candidate.findableKind != null)).toBe(true);
    });

    it('picks a deterministic cursed real pair only when multiple real pairs exist', () => {
        expect(pickCursedPairKey([tile('a', 'a')], 1, 20, 3)).toBeNull();
        expect(pickCursedPairKey([tile('a', 'a'), tile('b', 'b')], 1, 20, 3)).toBe(
            pickCursedPairKey([tile('a', 'a'), tile('b', 'b')], 1, 20, 3)
        );
    });
});

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: id,
    label: id,
    atomicVariant: 0
});
