import { describe, expect, it, vi } from 'vitest';
import type { BufferGeometry } from 'three';
import type { CardBackSvgLayerGeometry, CardFrontSvgLayerGeometry } from './cardSvgPlaneGeometry';
import {
    disposeTileBoardSharedCardBackLayers,
    disposeTileBoardSharedCardLayers,
    disposeTileBoardSharedCardSvgAssets,
    loadTileBoardSharedCardSvgAssets
} from './tileBoardSharedCardAssets';

const fakeGeometry = () => ({
    dispose: vi.fn()
}) as unknown as BufferGeometry;

const fakeBackLayer = (name: CardBackSvgLayerGeometry['name']): CardBackSvgLayerGeometry => ({
    geometry: fakeGeometry(),
    name
});

const fakeFrontLayer = (name: CardFrontSvgLayerGeometry['name']): CardFrontSvgLayerGeometry => ({
    geometry: fakeGeometry(),
    name
});

describe('tileBoardSharedCardAssets', () => {
    it('loads the front layers before the back ones and returns both sets', async () => {
        const frontLayers = [fakeFrontLayer('front-panel'), fakeFrontLayer('front-frame')];
        const backLayers = [fakeBackLayer('back-base'), fakeBackLayer('back-gem')];
        const calls: string[] = [];

        const result = await loadTileBoardSharedCardSvgAssets({
            backUrl: 'back.svg',
            frontUrl: 'front.svg',
            loadBackLayers: async (url) => {
                calls.push(`back:${url}`);
                return backLayers;
            },
            loadFrontLayers: async (url) => {
                calls.push(`front:${url}`);
                return frontLayers;
            }
        });

        // Chained, never raced: two SVGLoader.parse passes at once is a visible hitch at board entry.
        expect(calls).toEqual(['front:front.svg', 'back:back.svg']);
        expect(result).toEqual({ backLayers, frontLayers });
    });

    it('keeps the face a raster and still animates the back when the front art cannot mesh', async () => {
        const backLayers = [fakeBackLayer('back-base')];

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => backLayers,
                loadFrontLayers: async () => null
            })
        ).resolves.toEqual({ backLayers, frontLayers: null });
    });

    it('keeps the back a raster and still animates the face when the back art cannot mesh', async () => {
        const frontLayers = [fakeFrontLayer('front-panel')];

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => null,
                loadFrontLayers: async () => frontLayers
            })
        ).resolves.toEqual({ backLayers: null, frontLayers });
    });

    it('normalizes a rejected load to a missing face rather than a thrown board', async () => {
        const backLayers = [fakeBackLayer('back-base')];

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => backLayers,
                loadFrontLayers: async () => {
                    throw new Error('parse');
                }
            })
        ).resolves.toEqual({ backLayers, frontLayers: null });
    });

    it('returns null only when neither face meshed', async () => {
        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => null,
                loadFrontLayers: async () => null
            })
        ).resolves.toBeNull();
    });

    it('disposes every geometry it hands out, and tolerates a missing set', () => {
        const frontLayers = [fakeFrontLayer('front-panel')];
        const backLayers = [fakeBackLayer('back-base'), fakeBackLayer('back-gem')];

        disposeTileBoardSharedCardSvgAssets({ backLayers, frontLayers });
        for (const layer of [...frontLayers, ...backLayers]) {
            expect(layer.geometry.dispose).toHaveBeenCalledTimes(1);
        }

        expect(() => disposeTileBoardSharedCardSvgAssets(null)).not.toThrow();
        expect(() => disposeTileBoardSharedCardSvgAssets({ backLayers: null, frontLayers: null })).not.toThrow();
        expect(() => disposeTileBoardSharedCardLayers(null)).not.toThrow();
        expect(() => disposeTileBoardSharedCardBackLayers(undefined)).not.toThrow();
    });
});
