import type { GraphicsQualityPreset } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';

export type HoverGoldQualityScales = {
    emissiveIntensity: number;
    rimOpacity: number;
};

export type MatchedEdgeEffectTier =
    (typeof GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers)[keyof typeof GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers];

export const getHoverGoldQualityScales = (quality: GraphicsQualityPreset): HoverGoldQualityScales =>
    GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales[quality];

/** TBF-008: face-up pickable hover strips vs hidden-back parity. */
export const getFaceUpHoverRimOpacityMul = (quality: GraphicsQualityPreset): number =>
    GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul[quality];

export const getMatchedEdgeEffectTier = (
    quality: GraphicsQualityPreset,
    reduceMotion: boolean
): MatchedEdgeEffectTier => {
    const tiers = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.tiers;
    if (reduceMotion) {
        return tiers.reduceMotion;
    }
    return quality === 'high' ? tiers.high : tiers.medium;
};
