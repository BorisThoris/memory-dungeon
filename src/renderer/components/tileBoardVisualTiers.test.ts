import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import {
    getFaceUpHoverRimOpacityMul,
    getHoverGoldQualityScales,
    getMatchedEdgeEffectTier
} from './tileBoardVisualTiers';

describe('tileBoardVisualTiers', () => {
    it('reads hover gold scales from the gameplay visual config', () => {
        expect(getHoverGoldQualityScales('high')).toBe(GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.high);
        expect(getFaceUpHoverRimOpacityMul('low')).toBe(GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul.low);
    });

    it('uses reduced-motion matched edge tier before quality tiers', () => {
        expect(getMatchedEdgeEffectTier('high', true)).toBe(GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.reduceMotion);
    });

    it('uses high tier only for high quality when motion is enabled', () => {
        expect(getMatchedEdgeEffectTier('high', false)).toBe(GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.high);
        expect(getMatchedEdgeEffectTier('medium', false)).toBe(GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.medium);
        expect(getMatchedEdgeEffectTier('low', false)).toBe(GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers.medium);
    });
});
