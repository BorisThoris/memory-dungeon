import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSharedCardFrontSvgLayerGeometries = vi.hoisted(() => vi.fn());

vi.mock('./cardSvgPlaneGeometry', () => ({
    loadSharedCardFrontSvgLayerGeometries
}));

import { useTileBoardSharedCardSvgAssets } from './useTileBoardSharedCardSvgAssets';

const layer = (name: string) => ({ geometry: { dispose: vi.fn() }, name });

afterEach(() => {
    loadSharedCardFrontSvgLayerGeometries.mockReset();
});

describe('useTileBoardSharedCardSvgAssets', () => {
    it('meshes the face and leaves the back on its painted plate', async () => {
        const front = [layer('front-panel')];
        loadSharedCardFrontSvgLayerGeometries.mockResolvedValue(front);

        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(true));

        await waitFor(() => expect(result.current.sharedCardFrontLayers).toBe(front));
        // The back's authored SVG is a placeholder; meshing it would cover the painted labyrinth.
        expect(result.current.sharedCardBackLayers).toBeNull();
    });

    it('never parses the art on a device that cannot afford the meshes', async () => {
        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(false));

        await waitFor(() => expect(result.current.sharedCardFrontLayers).toBeNull());
        expect(result.current.sharedCardBackLayers).toBeNull();
        expect(loadSharedCardFrontSvgLayerGeometries).not.toHaveBeenCalled();
    });

    it('keeps the board on rasters when the face art cannot mesh', async () => {
        loadSharedCardFrontSvgLayerGeometries.mockResolvedValue(null);

        const { result } = renderHook(() => useTileBoardSharedCardSvgAssets(true));

        await waitFor(() => expect(loadSharedCardFrontSvgLayerGeometries).toHaveBeenCalled());
        expect(result.current.sharedCardFrontLayers).toBeNull();
        expect(result.current.sharedCardBackLayers).toBeNull();
    });
});
