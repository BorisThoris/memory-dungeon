import { describe, expect, it } from 'vitest';
import { isTileBoardFlipLocked } from './tileBoardFlipLock';

describe('tileBoardFlipLock', () => {
    it('does not lock while fewer than two tiles are flipped', () => {
        expect(isTileBoardFlipLocked({ allowGambitThirdFlip: false, flippedTileCount: 0 })).toBe(false);
        expect(isTileBoardFlipLocked({ allowGambitThirdFlip: false, flippedTileCount: 1 })).toBe(false);
    });

    it('locks at two flipped tiles unless gambit third flip is available', () => {
        expect(isTileBoardFlipLocked({ allowGambitThirdFlip: false, flippedTileCount: 2 })).toBe(true);
        expect(isTileBoardFlipLocked({ allowGambitThirdFlip: true, flippedTileCount: 2 })).toBe(false);
    });

    it('locks past two flipped tiles even after gambit third flip is available', () => {
        expect(isTileBoardFlipLocked({ allowGambitThirdFlip: true, flippedTileCount: 3 })).toBe(true);
    });
});
