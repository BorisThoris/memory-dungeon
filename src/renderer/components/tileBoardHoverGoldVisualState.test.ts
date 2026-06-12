import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import {
    applyHoverGoldRimOpacity,
    applyHoverGoldVisualState,
    computeHoverGoldVisualState
} from './tileBoardHoverGoldVisualState';

describe('tile board hover gold visual state', () => {
    it('uses DOM-parity hover values for hidden pickable cards', () => {
        const tier = GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.high;

        expect(
            computeHoverGoldVisualState({
                graphicsQuality: 'high',
                hoverDomParity: true,
                hoverFaceUpPickable: false
            })
        ).toEqual({
            frontRimOpacity: 0,
            hoverEmissiveIntensity: tier.emissiveIntensity,
            hoverRimOpacity: tier.rimOpacity,
            rimOpacity: tier.rimOpacity,
            shaderGlowEnabled: true
        });
    });

    it('uses a weaker emissive and face-up rim multiplier for face-up pickable cards', () => {
        const tier = GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.medium;
        const faceUpMul = GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul.medium;

        expect(
            computeHoverGoldVisualState({
                graphicsQuality: 'medium',
                hoverDomParity: false,
                hoverFaceUpPickable: true
            })
        ).toEqual({
            frontRimOpacity: tier.rimOpacity * faceUpMul,
            hoverEmissiveIntensity: tier.emissiveIntensity * 0.42,
            hoverRimOpacity: 0,
            rimOpacity: tier.rimOpacity,
            shaderGlowEnabled: true
        });
    });

    it('disables shader glow for low quality', () => {
        const tier = GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.low;

        expect(
            computeHoverGoldVisualState({
                graphicsQuality: 'low',
                hoverDomParity: true,
                hoverFaceUpPickable: true
            })
        ).toEqual({
            frontRimOpacity: tier.rimOpacity * GAMEPLAY_BOARD_VISUALS.faceUpHoverRimOpacityMul.low,
            hoverEmissiveIntensity: tier.emissiveIntensity,
            hoverRimOpacity: tier.rimOpacity,
            rimOpacity: tier.rimOpacity,
            shaderGlowEnabled: false
        });
    });

    it('returns inactive hover values when no hover condition applies', () => {
        const tier = GAMEPLAY_BOARD_VISUALS.hoverGoldQualityScales.high;

        expect(
            computeHoverGoldVisualState({
                graphicsQuality: 'high',
                hoverDomParity: false,
                hoverFaceUpPickable: false
            })
        ).toEqual({
            frontRimOpacity: 0,
            hoverEmissiveIntensity: 0,
            hoverRimOpacity: 0,
            rimOpacity: tier.rimOpacity,
            shaderGlowEnabled: true
        });
    });

    it('applies opacity to all available rim materials', () => {
        const first = { opacity: 0 };
        const second = { opacity: 0 };

        applyHoverGoldRimOpacity([first, null, second, undefined], 0.42);

        expect(first.opacity).toBe(0.42);
        expect(second.opacity).toBe(0.42);
    });

    it('scales hover rim opacity down when shader glow is enabled', () => {
        const back = [{ opacity: 0 }, { opacity: 0 }];
        const front = [{ opacity: 0 }, { opacity: 0 }];

        applyHoverGoldVisualState({
            backRimMaterials: back,
            frontRimMaterials: front,
            state: {
                frontRimOpacity: 0.5,
                hoverEmissiveIntensity: 0,
                hoverRimOpacity: 0.6,
                rimOpacity: 0.7,
                shaderGlowEnabled: true
            }
        });

        expect(back[0].opacity).toBeCloseTo(0.108);
        expect(back[1].opacity).toBeCloseTo(0.108);
        expect(front[0].opacity).toBeCloseTo(0.11);
        expect(front[1].opacity).toBeCloseTo(0.11);
    });

    it('uses full hover rim opacity for low-quality non-shader fallback', () => {
        const back = [{ opacity: 0 }];
        const front = [{ opacity: 0 }];

        applyHoverGoldVisualState({
            backRimMaterials: back,
            frontRimMaterials: front,
            state: {
                frontRimOpacity: 0.5,
                hoverEmissiveIntensity: 0,
                hoverRimOpacity: 0.6,
                rimOpacity: 0.7,
                shaderGlowEnabled: false
            }
        });

        expect(back[0].opacity).toBe(0.6);
        expect(front[0].opacity).toBe(0.5);
    });
});
