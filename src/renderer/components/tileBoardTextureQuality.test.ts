import { describe, expect, it, vi } from 'vitest';

import {
    computeTileBoardAppliedAnisotropy,
    syncTileBoardTextureQuality
} from './tileBoardTextureQuality';

describe('tileBoardTextureQuality', () => {
    it('caps anisotropy by the lower of quality and device limits', () => {
        expect(computeTileBoardAppliedAnisotropy({ deviceAnisotropyCap: 16, qualityAnisotropyCap: 8 })).toBe(8);
        expect(computeTileBoardAppliedAnisotropy({ deviceAnisotropyCap: 4, qualityAnisotropyCap: 8 })).toBe(4);
    });

    it('syncs sampling, rank font preload, and capped anisotropy', () => {
        const events: string[] = [];
        const setSamplingQuality = vi.fn((quality) => events.push(`sampling:${quality}`));
        const preloadRankFont = vi.fn((quality) => events.push(`font:${quality}`));
        const applyAnisotropy = vi.fn((anisotropy) => events.push(`anisotropy:${anisotropy}`));

        const result = syncTileBoardTextureQuality({
            applyAnisotropy,
            getAnisotropyCap: () => 8,
            getMaxAnisotropy: () => 4,
            graphicsQuality: 'high',
            preloadRankFont,
            setSamplingQuality
        });

        expect(result).toEqual({
            appliedAnisotropy: 4,
            deviceAnisotropyCap: 4,
            qualityAnisotropyCap: 8
        });
        expect(setSamplingQuality).toHaveBeenCalledWith('high');
        expect(preloadRankFont).toHaveBeenCalledWith('high');
        expect(applyAnisotropy).toHaveBeenCalledWith(4);
        expect(events).toEqual(['sampling:high', 'font:high', 'anisotropy:4']);
    });

    it('uses the quality cap when the device supports more anisotropy', () => {
        const applyAnisotropy = vi.fn();

        expect(
            syncTileBoardTextureQuality({
                applyAnisotropy,
                getAnisotropyCap: () => 2,
                getMaxAnisotropy: () => 16,
                graphicsQuality: 'low',
                preloadRankFont: vi.fn(),
                setSamplingQuality: vi.fn()
            }).appliedAnisotropy
        ).toBe(2);
        expect(applyAnisotropy).toHaveBeenCalledWith(2);
    });
});
