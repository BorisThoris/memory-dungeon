import { describe, expect, it } from 'vitest';
import { getStickyBlockedTileId } from './stickyFingersBlockedTileId';

describe('getStickyBlockedTileId', () => {
    const tiles = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('marks a lock set by Stasis as well as by sticky fingers: the rule refuses it either way', () => {
        expect(
            getStickyBlockedTileId({
                flippedTileIds: [],
                stickyBlockIndex: 1,
                tiles
            })
        ).toBe('b');
    });

    it('returns null while a pair flip is in progress', () => {
        expect(
            getStickyBlockedTileId({
                flippedTileIds: ['x'],
                stickyBlockIndex: 1,
                tiles
            })
        ).toBeNull();
    });

    it('returns null when stickyBlockIndex is unset', () => {
        expect(
            getStickyBlockedTileId({
                flippedTileIds: [],
                stickyBlockIndex: null,
                tiles
            })
        ).toBeNull();
    });

    it('returns the tile id at stickyBlockIndex when starting a new pair', () => {
        expect(
            getStickyBlockedTileId({
                flippedTileIds: [],
                stickyBlockIndex: 1,
                tiles
            })
        ).toBe('b');
    });

    it('returns null when index is out of range', () => {
        expect(
            getStickyBlockedTileId({
                flippedTileIds: [],
                stickyBlockIndex: 99,
                tiles
            })
        ).toBeNull();
    });
});
