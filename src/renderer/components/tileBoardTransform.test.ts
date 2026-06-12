import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import {
    BOARD_LAYOUT_ROW_STAGGER_X,
    TILE_SPACING
} from './tileShatter';
import { getTileTransform, hashTileLayoutSeed, layoutNormFromSeed } from './tileBoardTransform';

const tile = (id: string): Tile => ({
    id,
    symbol: id,
    label: id,
    pairKey: id,
    state: 'hidden'
});

describe('tile board transform', () => {
    it('hashes tile ids deterministically for layout imperfections', () => {
        expect(hashTileLayoutSeed('a1')).toBe(hashTileLayoutSeed('a1'));
        expect(hashTileLayoutSeed('a1')).not.toBe(hashTileLayoutSeed('b1'));
    });

    it('maps seed bits into the expected jitter range', () => {
        expect(layoutNormFromSeed(0, 0)).toBeCloseTo(-1);
        expect(layoutNormFromSeed(1000, 0)).toBeCloseTo(1);
    });

    it('places tiles by grid position and flips hidden cards', () => {
        const transform = getTileTransform(tile('a1'), 0, 2, 2, false, false, true);
        expect(transform.baseX).toBeCloseTo(-TILE_SPACING / 2);
        expect(transform.baseY).toBeCloseTo(TILE_SPACING / 2);
        expect(transform.flipRotationY).toBe(Math.PI);
        expect(transform.layoutJitterX).toBe(0);
        expect(transform.layoutYaw).toBe(0);
    });

    it('staggers odd rows when motion is enabled', () => {
        const withoutMotion = getTileTransform(tile('a1'), 2, 2, 2, false, true, true);
        const withMotion = getTileTransform(tile('a1'), 2, 2, 2, false, true, false);
        expect(withMotion.baseX - withoutMotion.baseX).toBeCloseTo(BOARD_LAYOUT_ROW_STAGGER_X);
        expect(withMotion.flipRotationY).toBe(0);
    });
});
