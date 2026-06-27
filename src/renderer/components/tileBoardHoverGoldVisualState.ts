import type { GraphicsQualityPreset } from '../../shared/contracts';
import {
    getFaceUpHoverRimOpacityMul,
    getHoverGoldQualityScales
} from './tileBoardVisualTiers';

export interface HoverGoldRimMaterialTarget {
    opacity: number;
}

export interface HoverGoldVisualState {
    frontRimOpacity: number;
    hoverEmissiveIntensity: number;
    hoverRimOpacity: number;
    rimOpacity: number;
    shaderGlowEnabled: boolean;
}

interface HoverGoldVisualStateInput {
    graphicsQuality: GraphicsQualityPreset;
    hoverDomParity: boolean;
    hoverFaceUpPickable: boolean;
}

export const computeHoverGoldVisualState = ({
    graphicsQuality,
    hoverDomParity,
    hoverFaceUpPickable
}: HoverGoldVisualStateInput): HoverGoldVisualState => {
    const { emissiveIntensity: hoverEmissiveMul, rimOpacity } = getHoverGoldQualityScales(graphicsQuality);
    const faceUpHoverMul = getFaceUpHoverRimOpacityMul(graphicsQuality);

    return {
        frontRimOpacity: hoverFaceUpPickable ? rimOpacity * faceUpHoverMul : 0,
        hoverEmissiveIntensity: hoverDomParity ? hoverEmissiveMul : hoverFaceUpPickable ? hoverEmissiveMul * 0.42 : 0,
        hoverRimOpacity: hoverDomParity ? rimOpacity : 0,
        rimOpacity,
        shaderGlowEnabled: graphicsQuality !== 'low'
    };
};

export const applyHoverGoldRimOpacity = (
    materials: readonly (HoverGoldRimMaterialTarget | null | undefined)[],
    opacity: number
): void => {
    for (const material of materials) {
        if (material) {
            material.opacity = opacity;
        }
    }
};

export const applyHoverGoldVisualState = ({
    backRimMaterials,
    frontRimMaterials,
    state
}: {
    backRimMaterials: readonly (HoverGoldRimMaterialTarget | null | undefined)[];
    frontRimMaterials: readonly (HoverGoldRimMaterialTarget | null | undefined)[];
    state: HoverGoldVisualState;
}): void => {
    applyHoverGoldRimOpacity(
        backRimMaterials,
        state.shaderGlowEnabled ? state.hoverRimOpacity * 0.18 : state.hoverRimOpacity
    );
    applyHoverGoldRimOpacity(
        frontRimMaterials,
        state.shaderGlowEnabled ? state.frontRimOpacity * 0.22 : state.frontRimOpacity
    );
};
