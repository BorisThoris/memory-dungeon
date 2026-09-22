import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSharedCardFrontSvgLayerGeometries = vi.hoisted(() => vi.fn());
const loadSharedCardBackSvgLayerGeometries = vi.hoisted(() => vi.fn());

vi.mock('./cardSvgPlaneGeometry', () => ({
    loadSharedCardFrontSvgLayerGeometries,
    loadSharedCardBackSvgLayerGeometries
}));

import { useTileBoardSharedCardSvgAssets } from './useTileBoardSharedCardSvgAssets';

const layer = (name: string) => ({ geometry: { dispose: vi.fn() }, name });

afterEach(() => {
    loadSharedCardFrontSvgLayerGeometries.mockReset();
    loadSharedCardBackSvgLayerGeometries.mockReset();
});

describe('useTileBoardSharedCardSvgAssets', () => {
    it('meshes both faces when the device can afford them', async () => {
        const front = [layer('front-panel')];
        const back = [layer('back-base')];
        loadSharedCardFrontSvgLayerGeometries.mockResolvedValue(front);
        loadSharedCardBackSvgLayerGeometries.mockResolvedValue(back);

        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(true));

        await waitFor(() => expect(result.current.sharedCardFrontLayers).toBe(front));
        expect(result.current.sharedCardBackLayers).toBe(back);
    });

    it('never parses the art on a device that cannot afford the meshes', async () => {
        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(false));

        await waitFor(() => expect(result.current.sharedCardFrontLayers).toBeNull());
        expect(result.current.sharedCardBackLayers).toBeNull();
        expect(loadSharedCardFrontSvgLayerGeometries).not.toHaveBeenCalled();
        expect(loadSharedCardBackSvgLayerGeometries).not.toHaveBeenCalled();
    });

    it('keeps the board on rasters when the art cannot mesh at all', async () => {
        loadSharedCardFrontSvgLayerGeometries.mockResolvedValue(null);
        loadSharedCardBackSvgLayerGeometries.mockResolvedValue(null);

        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(true));

        await waitFor(() => expect(loadSharedCardBackSvgLayerGeometries).toHaveBeenCalled());
        expect(result.current.sharedCardFrontLayers).toBeNull();
        expect(result.current.sharedCardBackLayers).toBeNull();
    });
});
