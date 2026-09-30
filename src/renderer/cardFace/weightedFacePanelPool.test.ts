import { describe, expect, it } from 'vitest';
import { ALL_FACE_PANEL_URLS_ORDERED } from './facePanelRasterUrls';
import { SPOILED_FACE_PANEL_NUMBERS, buildWeightedFacePanelFallbackStrip } from './weightedFacePanelPool';

describe('weighted face panel pool', () => {
    it('deals no spoiled panel to a card', () => {
        const strip = new Set(buildWeightedFacePanelFallbackStrip());
        for (const n of SPOILED_FACE_PANEL_NUMBERS) {
            expect(strip.has(ALL_FACE_PANEL_URLS_ORDERED[n - 1]!)).toBe(false);
        }
    });

    it('still deals every sound panel', () => {
        const strip = new Set(buildWeightedFacePanelFallbackStrip());
        ALL_FACE_PANEL_URLS_ORDERED.forEach((url, i) => {
            expect(strip.has(url)).toBe(!SPOILED_FACE_PANEL_NUMBERS.has(i + 1));
        });
    });
});
