import type { Tile } from '../../shared/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCanvas2dMock } from '../../test/installCanvas2dMock';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import {
    clearTileTextureCachesForDebug,
    forceIllustrationOverlayCacheVersionForTest,
    getIllustrationPipelineDebugState,
    getTileFaceRoughnessTexture,
    getTileFaceTexture,
    getTileFaceOverlayTextureCacheKey,
    getStaticCardTexturePixelSize,
    getTileFaceOverlayTexture,
    preloadTileTextureImages,
    prewarmTileFaceOverlayTextures,
    resetDemandDrivenOverlayPrewarmForTest,
    runDemandDrivenTileFaceOverlayPrewarmSession
} from './tileTextures';

vi.mock('../cardFace/proceduralIllustration/drawProceduralTarotIllustration', () => ({
    drawProceduralTarotIllustration: vi.fn()
}));

const baseTile = (id: string, pairKey: string): Tile => ({
    id,
    label: id.toUpperCase(),
    pairKey,
    state: 'hidden',
    symbol: id.slice(0, 1).toUpperCase()
});

describe('tileTextures layout', () => {
    let restoreCanvas2dMock: (() => void) | null = null;

    beforeEach(() => {
        restoreCanvas2dMock = installCanvas2dMock();
    });

    afterEach(() => {
        restoreCanvas2dMock?.();
        restoreCanvas2dMock = null;
        resetDemandDrivenOverlayPrewarmForTest();
        clearTileTextureCachesForDebug();
    });

    it('keeps static card canvas aspect aligned with card plane geometry', () => {
        const { width, height } = getStaticCardTexturePixelSize();
        const aspect = width / height;
        expect(aspect).toBeCloseTo(CARD_PLANE_WIDTH / CARD_PLANE_HEIGHT, 2);
        expect(width).toBeGreaterThan(2);
        expect(height).toBeGreaterThan(2);
    });

    it('reuses the same overlay texture after warm-up requests', () => {
        clearTileTextureCachesForDebug();
        const tile = baseTile('alpha', 'pair-alpha');

        const cold = getTileFaceOverlayTexture(tile, 'active', 'high');
        const warm = getTileFaceOverlayTexture(tile, 'active', 'high');

        const state = getIllustrationPipelineDebugState();
        expect(cold).toBeTruthy();
        expect(warm).toBe(cold);
        expect(state.overlayTexture.createdCount).toBe(1);
        expect(state.overlayTexture.hitCount).toBe(1);
        expect(state.illustrationBitmap.createdCount).toBe(1);
    });

    it('reuses one front overlay texture across gameplay card classes with the same card identity', () => {
        clearTileTextureCachesForDebug();
        const normal = baseTile('alpha', 'pair-alpha');
        const greed: Tile = { ...normal, routeCardKind: 'greed_cache' };
        const safe: Tile = { ...normal, routeCardKind: 'safe_ward' };
        const mystery: Tile = { ...normal, routeCardKind: 'mystery_veil' };
        const dungeon: Tile = { ...normal, dungeonCardKind: 'treasure', dungeonCardState: 'hidden', dungeonCardHp: 4 };
        const special: Tile = { ...normal, routeSpecialKind: 'elite_cache', routeSpecialRevealed: true };
        const cards = [normal, greed, safe, mystery, dungeon, special];
        const keys = cards.map((tile) => getTileFaceOverlayTextureCacheKey(tile, 'active', 'high'));
        const textures = cards.map((tile) => getTileFaceOverlayTexture(tile, 'active', 'high'));

        expect(new Set(keys)).toHaveLength(1);
        for (const texture of textures) {
            expect(texture).toBe(textures[0]);
        }
    });

    it('reuses one hidden back texture for normal, route, dungeon, and special cards', () => {
        clearTileTextureCachesForDebug();
        const normal = baseTile('alpha', 'pair-alpha');
        const cards: Tile[] = [
            normal,
            { ...baseTile('greed', 'pair-greed'), routeCardKind: 'greed_cache' },
            { ...baseTile('safe', 'pair-safe'), routeCardKind: 'safe_ward' },
            { ...baseTile('mystery', 'pair-mystery'), routeCardKind: 'mystery_veil' },
            { ...baseTile('dungeon', 'pair-dungeon'), dungeonCardKind: 'treasure', dungeonCardState: 'hidden', dungeonCardHp: 4 },
            { ...baseTile('special', 'pair-special'), routeSpecialKind: 'elite_cache', routeSpecialRevealed: true }
        ];

        const hiddenBacks = cards.map((tile) => getTileFaceTexture(tile, 'back', 'hidden'));
        const roughnessMaps = cards.map((tile) => getTileFaceRoughnessTexture(tile, 'back', 'hidden'));

        for (const texture of hiddenBacks) {
            expect(texture).toBe(hiddenBacks[0]);
        }
        for (const texture of roughnessMaps) {
            expect(texture).toBe(roughnessMaps[0]);
        }
    });

    it('prewarms only one center-art bitmap per unique pairKey and tier', async () => {
        clearTileTextureCachesForDebug();
        const previousRequestIdleCallback = window.requestIdleCallback;
        const previousCancelIdleCallback = window.cancelIdleCallback;
        window.requestIdleCallback = ((callback: IdleRequestCallback) => {
            callback({
                didTimeout: false,
                timeRemaining: () => 50
            } as IdleDeadline);
            return 1;
        }) as typeof window.requestIdleCallback;
        window.cancelIdleCallback = (() => undefined) as typeof window.cancelIdleCallback;

        try {
            const stop = prewarmTileFaceOverlayTextures(
                [baseTile('a1', 'pair-a'), baseTile('a2', 'pair-a'), baseTile('b1', 'pair-b')],
                'medium',
                'active'
            );
            await Promise.resolve();
            stop();

            const state = getIllustrationPipelineDebugState();
            expect(state.overlayPrewarm.targetKeys).toEqual(['pair-a|tier=standard', 'pair-b|tier=standard']);
            expect(state.overlayPrewarm.completedCount).toBe(2);
            expect(state.illustrationBitmap.entryCount).toBe(2);
            expect(state.overlayTexture.overlayKeyCount).toBe(0);
        } finally {
            window.requestIdleCallback = previousRequestIdleCallback;
            window.cancelIdleCallback = previousCancelIdleCallback;
        }
    });

    it('demand-driven overlay session warms illustration cache for queued pairKeys', async () => {
        clearTileTextureCachesForDebug();
        const previousRequestIdleCallback = window.requestIdleCallback;
        const previousCancelIdleCallback = window.cancelIdleCallback;
        window.requestIdleCallback = ((callback: IdleRequestCallback) => {
            callback({
                didTimeout: false,
                timeRemaining: () => 50
            } as IdleDeadline);
            return 1;
        }) as typeof window.requestIdleCallback;
        window.cancelIdleCallback = (() => undefined) as typeof window.cancelIdleCallback;

        try {
            const stop = runDemandDrivenTileFaceOverlayPrewarmSession(['pair-z'], 'medium');
            await Promise.resolve();
            stop();

            const tile = baseTile('z1', 'pair-z');
            const cold = getTileFaceOverlayTexture(tile, 'active', 'medium');
            const warm = getTileFaceOverlayTexture(tile, 'active', 'medium');
            expect(cold).toBe(warm);
            const state = getIllustrationPipelineDebugState();
            expect(state.illustrationBitmap.entryCount).toBeGreaterThanOrEqual(1);
        } finally {
            window.requestIdleCallback = previousRequestIdleCallback;
            window.cancelIdleCallback = previousCancelIdleCallback;
        }
    });

    it('shares in-flight tile texture image loads across concurrent preloads', async () => {
        clearTileTextureCachesForDebug();
        const originalImage = globalThis.Image;
        const requestedUrls: string[] = [];
        const releaseQueue: Array<() => void> = [];

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            complete = true;
            naturalHeight = 64;
            naturalWidth = 64;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            set src(value: string) {
                requestedUrls.push(value);
                releaseQueue.push(() => this.onload?.());
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        try {
            const first = preloadTileTextureImages();
            const second = preloadTileTextureImages();

            await vi.waitFor(() => expect(releaseQueue).toHaveLength(7));
            expect(requestedUrls).toHaveLength(7);
            releaseQueue.splice(0).forEach((release) => release());
            await Promise.all([first, second]);

            await preloadTileTextureImages();
            expect(requestedUrls).toHaveLength(7);
        } finally {
            Object.defineProperty(globalThis, 'Image', {
                configurable: true,
                value: originalImage
            });
        }
    });

    it('resolves tile texture preloads when image requests stall', async () => {
        clearTileTextureCachesForDebug();
        vi.useFakeTimers();
        const originalImage = globalThis.Image;
        let requestedCount = 0;

        class MockImage {
            decoding: 'async' | 'auto' | 'sync' = 'auto';
            complete = false;
            naturalHeight = 0;
            naturalWidth = 0;
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;

            set src(_value: string) {
                requestedCount += 1;
            }
        }

        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: MockImage
        });

        try {
            const preload = preloadTileTextureImages();

            await vi.advanceTimersByTimeAsync(1500);
            await expect(preload).resolves.toBeUndefined();
            expect(requestedCount).toBe(7);

            await preloadTileTextureImages();
            expect(requestedCount).toBe(7);
        } finally {
            vi.useRealTimers();
            Object.defineProperty(globalThis, 'Image', {
                configurable: true,
                value: originalImage
            });
        }
    });

    it('purges overlay and illustration caches when the combined version token changes', () => {
        clearTileTextureCachesForDebug();
        const tile = baseTile('alpha', 'pair-alpha');
        getTileFaceOverlayTexture(tile, 'active', 'high');

        expect(getIllustrationPipelineDebugState().overlayTexture.overlayKeyCount).toBe(1);

        forceIllustrationOverlayCacheVersionForTest('illustrationSchemaVersion=99|textureVersion=777');

        const state = getIllustrationPipelineDebugState();
        expect(state.overlayTexture.overlayKeyCount).toBe(0);
        expect(state.illustrationBitmap.entryCount).toBe(0);
        expect(state.overlayTexture.versionToken).toBe('illustrationSchemaVersion=99|textureVersion=777');
    });
});
