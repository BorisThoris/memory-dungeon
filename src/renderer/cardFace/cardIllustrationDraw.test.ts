import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCanvas2dMock } from '../../test/installCanvas2dMock';
import { getCardFaceOverlayColors } from './cardFaceOverlayPalette';
import {
    clearProceduralIllustrationBitmapCache,
    forceProceduralIllustrationBitmapCacheVersion,
    getProceduralIllustrationBitmapCacheDebugState,
    prewarmProceduralIllustrationBitmap
} from './cardIllustrationDraw';

vi.mock('./proceduralIllustration/drawProceduralTarotIllustration', () => ({
    drawProceduralTarotIllustration: vi.fn()
}));

const palette = getCardFaceOverlayColors('active');

describe('cardIllustrationDraw bitmap cache', () => {
    let restoreCanvas2dMock: (() => void) | null = null;

    beforeEach(() => {
        restoreCanvas2dMock = installCanvas2dMock();
    });

    afterEach(() => {
        restoreCanvas2dMock?.();
        restoreCanvas2dMock = null;
        clearProceduralIllustrationBitmapCache();
    });

    it('evicts oldest entries with FIFO semantics at the hard cap', () => {
        clearProceduralIllustrationBitmapCache();

        for (let index = 0; index < 260; index += 1) {
            const pairKey = `pair-${index.toString().padStart(3, '0')}`;
            prewarmProceduralIllustrationBitmap(pairKey, 'standard', palette, 48, 68);
        }

        const state = getProceduralIllustrationBitmapCacheDebugState();
        expect(state.entryCount).toBe(256);
        expect(state.evictedCount).toBe(4);
        expect(state.keys.some((key) => key.includes('pair-000|'))).toBe(false);
        expect(state.keys.some((key) => key.includes('pair-003|'))).toBe(false);
        expect(state.keys.some((key) => key.includes('pair-004|'))).toBe(true);
        expect(state.keys.some((key) => key.includes('pair-259|'))).toBe(true);
    });

    it('bounds full-resolution panel pixels and releases evicted backing stores', () => {
        clearProceduralIllustrationBitmapCache();
        const create = vi.spyOn(document, 'createElement');
        for (let index = 0; index < 24; index++) {
            prewarmProceduralIllustrationBitmap(`large-${index}`, 'full', palette, 1024, 1024);
        }
        const state = getProceduralIllustrationBitmapCacheDebugState();
        expect(state.pixelCount).toBeLessThanOrEqual(state.maxPixels);
        expect(state.entryCount).toBe(16);
        const canvases = create.mock.results.map(result => result.value as HTMLCanvasElement);
        expect(canvases.slice(0, 8).every(canvas => canvas.width === 1 && canvas.height === 1)).toBe(true);
        expect(canvases.slice(8).every(canvas => canvas.width === 1024 && canvas.height === 1024)).toBe(true);
        clearProceduralIllustrationBitmapCache();
        expect(canvases.every(canvas => canvas.width === 1 && canvas.height === 1)).toBe(true);
        expect(getProceduralIllustrationBitmapCacheDebugState().pixelCount).toBe(0);
        create.mockRestore();
    });

    it('purges cached bitmaps when the illustration version token changes', () => {
        clearProceduralIllustrationBitmapCache();
        prewarmProceduralIllustrationBitmap('pair-alpha', 'full', palette, 48, 68);

        expect(getProceduralIllustrationBitmapCacheDebugState().entryCount).toBe(1);

        forceProceduralIllustrationBitmapCacheVersion('illustrationSchemaVersion=99|textureVersion=777');

        expect(getProceduralIllustrationBitmapCacheDebugState()).toMatchObject({
            entryCount: 0,
            versionToken: 'illustrationSchemaVersion=99|textureVersion=777'
        });
    });
});
