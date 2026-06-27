import { Color, MathUtils, type MeshStandardMaterial } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { RENDERER_THEME } from '../styles/theme';
import type { ResolvingSelectionState } from './tileResolvingSelection';

type CardMaterialEmissiveRole = 'hoverGold' | 'matchVictory' | 'mismatch' | 'none';

interface CardMaterialEmissiveState {
    intensity: number;
    role: CardMaterialEmissiveRole;
}

interface CardMaterialVisualInput {
    faceUp: boolean;
    focusDimBlend: number;
    graphicsQuality: GraphicsQualityPreset;
    hoverEmissiveIntensity: number;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    tileState: Tile['state'];
    time: number;
}

interface CardFocusDimBlendInput {
    current: number;
    delta: number;
    faceUp: boolean;
    focusDimmed: boolean;
    reduceMotion: boolean;
    tileState: Tile['state'];
}

interface CardMaterialVisualState {
    dimBrightness: number;
    dimOpacity: number;
    frontEmissive: CardMaterialEmissiveState;
    backEmissive: CardMaterialEmissiveState;
}

interface ApplyCardMaterialVisualStateInput {
    backMaterial: MeshStandardMaterial | null;
    frontMaterial: MeshStandardMaterial | null;
    state: CardMaterialVisualState;
    tint: Color;
}

const HOVER_GOLD_EMISSIVE = new Color('#f2d39d');
const MATCH_VICTORY_EMISSIVE = new Color('#4fdc78');
const MISMATCH_EMISSIVE = new Color(RENDERER_THEME.colors.emberSoft);

const lerp = (from: number, to: number, amount: number): number =>
    from + (to - from) * amount;

const lowQualityMatchedEmissiveIntensity = (
    side: 'back' | 'front',
    reduceMotion: boolean,
    time: number
): number => {
    const config =
        side === 'front'
            ? GAMEPLAY_BOARD_VISUALS.lowQualityMatchedFrontEmissive
            : GAMEPLAY_BOARD_VISUALS.lowQualityMatchedBackEmissive;

    if (reduceMotion) {
        return config.base;
    }

    return config.base + config.pulse * (0.5 + 0.5 * Math.sin(time * 3.05));
};

const mismatchEmissiveIntensity = (reduceMotion: boolean, time: number): number => {
    const config = GAMEPLAY_BOARD_VISUALS.mismatchEmissive;
    if (reduceMotion) {
        return config.base;
    }

    return config.base + config.pulse * (0.5 + 0.5 * Math.sin(time * 4.2));
};

export const computeCardFocusDimBlend = ({
    current,
    delta,
    faceUp,
    focusDimmed,
    reduceMotion,
    tileState
}: CardFocusDimBlendInput): number => {
    const dimTarget = focusDimmed && !faceUp && tileState === 'hidden' ? 1 : 0;
    return MathUtils.damp(current, dimTarget, reduceMotion ? 400 : 32, delta);
};

export const computeCardMaterialVisualState = ({
    faceUp,
    focusDimBlend,
    graphicsQuality,
    hoverEmissiveIntensity,
    reduceMotion,
    resolvingSelection,
    tileState,
    time
}: CardMaterialVisualInput): CardMaterialVisualState => {
    const dimBrightness = lerp(1, 0.52, focusDimBlend);
    const dimOpacity = lerp(1, 0.88, focusDimBlend);

    if (tileState === 'matched') {
        if (graphicsQuality === 'low') {
            return {
                dimBrightness,
                dimOpacity,
                frontEmissive: {
                    role: 'matchVictory',
                    intensity: lowQualityMatchedEmissiveIntensity('front', reduceMotion, time)
                },
                backEmissive: {
                    role: 'matchVictory',
                    intensity: lowQualityMatchedEmissiveIntensity('back', reduceMotion, time)
                }
            };
        }

        return {
            dimBrightness,
            dimOpacity,
            frontEmissive: { role: 'none', intensity: 0 },
            backEmissive: { role: 'none', intensity: 0 }
        };
    }

    const frontEmissive =
        resolvingSelection === 'mismatch' && faceUp
            ? { role: 'mismatch' as const, intensity: mismatchEmissiveIntensity(reduceMotion, time) }
            : { role: 'hoverGold' as const, intensity: hoverEmissiveIntensity };

    return {
        dimBrightness,
        dimOpacity,
        frontEmissive,
        backEmissive: { role: 'hoverGold', intensity: hoverEmissiveIntensity }
    };
};

export const applyCardMaterialEmissive = (
    mat: MeshStandardMaterial,
    state: CardMaterialEmissiveState
): void => {
    if (state.role === 'matchVictory') {
        mat.emissive.copy(MATCH_VICTORY_EMISSIVE);
    } else if (state.role === 'mismatch') {
        mat.emissive.copy(MISMATCH_EMISSIVE);
    } else if (state.role === 'hoverGold') {
        mat.emissive.copy(HOVER_GOLD_EMISSIVE);
    } else {
        mat.emissive.setRGB(0, 0, 0);
    }
    mat.emissiveIntensity = state.intensity;
};

export const applyCardMaterialVisualState = ({
    backMaterial,
    frontMaterial,
    state,
    tint
}: ApplyCardMaterialVisualStateInput): void => {
    tint.multiplyScalar(state.dimBrightness);
    frontMaterial?.color.copy(tint);
    backMaterial?.color.copy(tint);

    if (frontMaterial) {
        frontMaterial.opacity = state.dimOpacity;
        applyCardMaterialEmissive(frontMaterial, state.frontEmissive);
    }

    if (backMaterial) {
        backMaterial.opacity = state.dimOpacity;
        applyCardMaterialEmissive(backMaterial, state.backEmissive);
    }
};
