import { describe, expect, it } from 'vitest';
import { STATIC_CARD_TEXTURE_HEIGHT } from '../cardFace/staticCardTextureSize';
import { CARD_FACE_HEIGHTS, cardFaceHeightFor } from './cardFaceDetail';
import { getTileFaceOverlayTextureCacheKey } from './tileTextures';

const desktop = { width: 1440, height: 900, devicePixelRatio: 1 };
const board = (columns: number, rows: number) => ({ columns, rows, colossus: undefined });

describe('cardFaceHeightFor', () => {
    it('gives a board zoomed out over many cards less detail than a small one', () => {
        const small = cardFaceHeightFor(board(4, 2), desktop);
        const crowded = cardFaceHeightFor(board(12, 8), desktop);
        expect(crowded).toBeLessThan(small);
        expect(crowded).toBe(CARD_FACE_HEIGHTS[0]);
    });

    it('never gives more cards more detail, nor a sharper screen less', () => {
        const sizes: [number, number][] = [[4, 2], [4, 3], [6, 3], [6, 4], [8, 6], [12, 8]];
        const heights = sizes.map(([columns, rows]) => cardFaceHeightFor(board(columns, rows), desktop));
        for (let i = 1; i < heights.length; i += 1) expect(heights[i]!).toBeLessThanOrEqual(heights[i - 1]!);
        for (const [columns, rows] of sizes) {
            expect(cardFaceHeightFor(board(columns, rows), { ...desktop, devicePixelRatio: 2 })).toBeGreaterThanOrEqual(
                cardFaceHeightFor(board(columns, rows), desktop)
            );
        }
    });

    it('falls back to the full face when it cannot measure', () => {
        expect(cardFaceHeightFor(board(4, 2), { width: 0, height: 0, devicePixelRatio: 1 })).toBe(STATIC_CARD_TEXTURE_HEIGHT);
    });

    it('keeps the full-size cache key unchanged, and tells the smaller bakes apart', () => {
        const tile = { id: 'a-A', pairKey: 'a', symbol: 'A', label: 'A', state: 'hidden' as const };
        const full = getTileFaceOverlayTextureCacheKey(tile, 'active', 'medium');
        expect(getTileFaceOverlayTextureCacheKey(tile, 'active', 'medium', STATIC_CARD_TEXTURE_HEIGHT)).toBe(full);
        expect(getTileFaceOverlayTextureCacheKey(tile, 'active', 'medium', 512)).toBe(`${full}:h512`);
    });
});
