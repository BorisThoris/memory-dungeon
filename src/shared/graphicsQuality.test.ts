import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from '../renderer/components/gameplayVisualConfig';
import {
    ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD,
    getBoardAnisotropyCap,
    getBoardDprCap,
    getGraphicsQualityTierSnapshot,
    getMenuAtmosphereParticleCount,
    getMenuPixiResolutionCap,
    resolveAdaptiveBoardRenderQuality
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

    it('getMenuPixiResolutionCap is positive', () => {
        expect(getMenuPixiResolutionCap('medium')).toBeGreaterThan(0);
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

    it('resolveAdaptiveBoardRenderQuality caps DPR and avoids SMAA during heavy motion on large boards', () => {
        const idle = resolveAdaptiveBoardRenderQuality({
            activeTileCount: ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD,
            boardHeavyMotion: false,
            boardScreenSpaceAA: 'auto',
            compact: false,
            reduceMotion: false,
            savedGraphicsQuality: 'high'
        });
        expect(idle.dprCap).toBe(getBoardDprCap('high', false));
        expect(idle.resolvedAa).toBe('smaa');

        const heavy = resolveAdaptiveBoardRenderQuality({
            activeTileCount: ADAPTIVE_BOARD_QUALITY_LARGE_TILE_THRESHOLD,
            boardHeavyMotion: true,
            boardScreenSpaceAA: 'auto',
            compact: false,
            reduceMotion: false,
            savedGraphicsQuality: 'high'
        });
        expect(heavy.dprCap).toBeLessThan(idle.dprCap);
        expect(heavy.resolvedAa).toBe('msaa');
    });

    it('resolveAdaptiveBoardRenderQuality leaves low tier unchanged during motion', () => {
        const r = resolveAdaptiveBoardRenderQuality({
            activeTileCount: 99,
            boardHeavyMotion: true,
            boardScreenSpaceAA: 'smaa',
            compact: true,
            reduceMotion: false,
            savedGraphicsQuality: 'low'
        });
        expect(r.dprCap).toBe(getBoardDprCap('low', true));
        expect(r.resolvedAa).toBe('smaa');
    });
});
