import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from '../renderer/components/gameplayVisualConfig';
import {
    ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD,
    getBoardAnisotropyCap,
    getBoardDprCap,
    getGraphicsQualityTierSnapshot,
    getMenuAtmosphereParticleCount,
    getMenuPixiResolutionCap,
    getSceneEffectTier,
    getRenderPixelRatio,
    resolveAdaptiveBoardRenderQuality,
    SCENE_LEAN_MAX_WIDTH
} from './graphicsQuality';

describe('graphicsQuality caps', () => {
    it('getBoardAnisotropyCap tiers', () => {
        expect(getBoardAnisotropyCap('low')).toBe(2);
        expect(getBoardAnisotropyCap('medium')).toBe(4);
        expect(getBoardAnisotropyCap('high')).toBe(8);
    });

    it('getBoardDprCap is positive', () => {
        expect(getBoardDprCap('low', false)).toBeGreaterThan(0);
        expect(getBoardDprCap('high', true)).toBeGreaterThan(0);
    });

    it('caps menu Pixi resolution by graphics tier', () => {
        expect([
            getMenuPixiResolutionCap('low'),
            getMenuPixiResolutionCap('medium'),
            getMenuPixiResolutionCap('high')
        ]).toEqual([1.25, 2, 2.5]);
    });

    it('getMenuAtmosphereParticleCount scales animated menu work by preset', () => {
        const low = getMenuAtmosphereParticleCount(1280, 800, 'low');
        const medium = getMenuAtmosphereParticleCount(1280, 800, 'medium');
        const high = getMenuAtmosphereParticleCount(1440, 900, 'high');

        expect(low).toBeLessThan(medium);
        expect(medium).toBe(32);
        expect(high).toBeGreaterThan(getMenuAtmosphereParticleCount(1440, 900, 'medium'));
    });

    it('tier snapshot matches individual getters; gameplay rim table covers same presets', () => {
        const presets = ['low', 'medium', 'high'] as const;
        for (const q of presets) {
            const snap = getGraphicsQualityTierSnapshot(q);
            expect(snap.boardDprCapStandard).toBe(getBoardDprCap(q, false));
            expect(snap.boardDprCapCompact).toBe(getBoardDprCap(q, true));
            expect(snap.menuPixiResolutionCap).toBe(getMenuPixiResolutionCap(q));
            expect(snap.menuAtmosphereParticleCountDesktop).toBe(getMenuAtmosphereParticleCount(1280, 720, q));
            expect(snap.boardAnisotropyCap).toBe(getBoardAnisotropyCap(q));
            expect(snap.tileBoardCssBloomEligible).toBe(q !== 'low');
            expect(typeof GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul[q]).toBe('number');
        }
        expect(Object.keys(GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul).sort()).toEqual(['high', 'low', 'medium']);
    });

    it('keeps the large-floor render budget stable instead of changing it during animations', () => {
        const idle = resolveAdaptiveBoardRenderQuality({
            activeTileCount: ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD,
            boardScreenSpaceAA: 'auto',
            compact: false,
            reduceMotion: false,
            savedGraphicsQuality: 'high'
        });
        expect(idle.dprCap).toBeLessThan(getBoardDprCap('high', false));
        expect(idle.resolvedAa).toBe('msaa');

    });

    it('resolveAdaptiveBoardRenderQuality leaves low tier unchanged on large floors', () => {
        const r = resolveAdaptiveBoardRenderQuality({
            activeTileCount: 99,
            boardScreenSpaceAA: 'smaa',
            compact: true,
            reduceMotion: false,
            savedGraphicsQuality: 'low'
        });
        expect(r.dprCap).toBe(getBoardDprCap('low', true));
        expect(r.resolvedAa).toBe('smaa');
    });
});

describe('render allocation budget', () => {
    it.each([[3840, 2160, 1], [3840, 2160, 2], [1920, 1080, 2], [7680, 2160, 2]])(
        'bounds %sx%s at DPR %s without allocating an oversized target', (width, height, deviceDpr) => {
            const budget = 2560 * 1440;
            const dpr = getRenderPixelRatio(width, height, deviceDpr, 2.1, budget);
            expect(width * height * dpr * dpr).toBeLessThanOrEqual(budget + 1);
            expect(Math.max(width, height) * dpr).toBeLessThanOrEqual(4096);
            expect(dpr).toBeGreaterThan(0);
        }
    );
    it('retains native sharpness when the display fits the budget', () => {
        expect(getRenderPixelRatio(1920, 1080, 1, 1.7, 2560 * 1440)).toBe(1);
    });
});

describe('getSceneEffectTier', () => {
    const desktop = { quality: 'high' as const, reduceMotion: false, coarsePointer: false, viewportWidth: 1440 };

    it('gives a desktop on medium or high the full scene', () => {
        expect(getSceneEffectTier(desktop)).toBe('full');
        expect(getSceneEffectTier({ ...desktop, quality: 'medium' })).toBe('full');
    });

    it('keeps a phone lean whatever the preset says: a coarse pointer or a narrow viewport', () => {
        expect(getSceneEffectTier({ ...desktop, coarsePointer: true })).toBe('lean');
        expect(getSceneEffectTier({ ...desktop, viewportWidth: SCENE_LEAN_MAX_WIDTH - 1 })).toBe('lean');
        expect(getSceneEffectTier({ ...desktop, viewportWidth: SCENE_LEAN_MAX_WIDTH })).toBe('full');
        expect(getSceneEffectTier({ ...desktop, quality: 'low' })).toBe('lean');
    });

    it('holds still under reduce motion before anything else', () => {
        expect(getSceneEffectTier({ ...desktop, reduceMotion: true })).toBe('still');
        expect(getSceneEffectTier({ ...desktop, reduceMotion: true, coarsePointer: true, quality: 'low' })).toBe('still');
    });

    it('gives a 4K or scaled-4K desktop the full scene: one canvas costs the same on any display', () => {
        expect(getSceneEffectTier({ ...desktop, viewportWidth: 3840, viewportHeight: 2160 })).toBe('full');
        expect(getSceneEffectTier({ ...desktop, viewportWidth: 1920, viewportHeight: 1080, devicePixelRatio: 2 })).toBe('full');
        expect(getSceneEffectTier({ ...desktop, viewportWidth: 1920, viewportHeight: 1080, devicePixelRatio: 1 })).toBe('full');
    });
});
