import { describe, expect, it, vi } from 'vitest';
import type { BufferGeometry } from 'three';
import type { CardBackSvgLayerGeometry } from './cardSvgPlaneGeometry';
import {
    disposeTileBoardSharedCardBackLayers,
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

describe('tileBoardSharedCardAssets', () => {
    it('loads front geometry before back layers and returns both asset sets', async () => {
        const frontGeometry = fakeGeometry();
        const backLayers = [fakeBackLayer('back-base'), fakeBackLayer('back-gem')];
        const calls: string[] = [];

        const result = await loadTileBoardSharedCardSvgAssets({
            backUrl: 'back.svg',
            frontUrl: 'front.svg',
            loadBackLayers: async (url) => {
                calls.push(`back:${url}`);
                return backLayers;
            },
            loadFrontGeometry: async (url) => {
                calls.push(`front:${url}`);
                return frontGeometry;
            }
        });

        expect(calls).toEqual(['front:front.svg', 'back:back.svg']);
        expect(result).toEqual({ backLayers, frontGeometry });
    });

    it('returns null without loading back layers when front geometry fails', async () => {
        const loadBackLayers = vi.fn(async () => [fakeBackLayer('back-base')]);

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers,
                loadFrontGeometry: async () => null
            })
        ).resolves.toBeNull();
        expect(loadBackLayers).not.toHaveBeenCalled();
    });

    it('normalizes a rejected front geometry load without starting the back load', async () => {
        const loadBackLayers = vi.fn(async () => [fakeBackLayer('back-base')]);

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers,
                loadFrontGeometry: async () => {
                    throw new Error('front parse failed');
                }
            })
        ).resolves.toBeNull();
        expect(loadBackLayers).not.toHaveBeenCalled();
    });

    it('disposes front geometry when back layer loading fails', async () => {
        const frontGeometry = fakeGeometry();

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => null,
                loadFrontGeometry: async () => frontGeometry
            })
        ).resolves.toBeNull();
        expect(frontGeometry.dispose).toHaveBeenCalledTimes(1);
    });

    it('disposes front geometry and normalizes a rejected back layer load', async () => {
        const frontGeometry = fakeGeometry();

        await expect(
            loadTileBoardSharedCardSvgAssets({
                backUrl: 'back.svg',
                frontUrl: 'front.svg',
                loadBackLayers: async () => {
                    throw new Error('back parse failed');
                },
                loadFrontGeometry: async () => frontGeometry
            })
        ).resolves.toBeNull();
        expect(frontGeometry.dispose).toHaveBeenCalledTimes(1);
    });

    it('disposes loaded shared SVG assets', () => {
        const frontGeometry = fakeGeometry();
        const backLayers = [fakeBackLayer('back-base'), fakeBackLayer('back-gem')];

        disposeTileBoardSharedCardSvgAssets({ backLayers, frontGeometry });

        expect(frontGeometry.dispose).toHaveBeenCalledTimes(1);
        expect(backLayers[0]!.geometry.dispose).toHaveBeenCalledTimes(1);
        expect(backLayers[1]!.geometry.dispose).toHaveBeenCalledTimes(1);
    });

    it('disposes back layers on their own', () => {
        const backLayers = [fakeBackLayer('back-base'), fakeBackLayer('back-gem')];

        disposeTileBoardSharedCardBackLayers(backLayers);

        expect(backLayers[0]!.geometry.dispose).toHaveBeenCalledTimes(1);
        expect(backLayers[1]!.geometry.dispose).toHaveBeenCalledTimes(1);
    });
});
