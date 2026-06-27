import type { Mesh, ShaderMaterial } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { RENDERER_THEME } from '../styles/theme';
import {
    clampMatchedCardRimFireDriverUniforms,
    type MatchedCardRimFireUniforms
} from './matchedCardRimFireMaterial';
import type { ResolvingSelectionState } from './tileResolvingSelection';

export type ResolvingRimColorRole = 'cyanBright' | 'danger' | 'emeraldBright';

interface ResolvingRimVisualInput {
    faceUp: boolean;
    graphicsQuality: GraphicsQualityPreset;
    isPinned: boolean;
    matchedVictoryBurst: number;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    time: number;
    tileState: Tile['state'];
}

export interface ResolvingRimVisualState {
    colorRole: ResolvingRimColorRole | null;
    crispOpacity: number;
    matchedVictoryPersistent: boolean;
    opacity: number;
    resolvingActive: boolean;
}

export interface RimMaterialTarget {
    color?: {
        set: (color: string) => void;
    };
    opacity: number;
}

interface FocusRimOpacityInput {
    keyboardFocused: boolean;
    pickable: boolean;
    reduceMotion: boolean;
    tileState: Tile['state'];
    time: number;
}

interface MatchedVictoryFlameVisualInput {
    graphicsQuality: GraphicsQualityPreset;
    matchedVictoryBurst: number;
    matchedVictoryPersistent: boolean;
    reduceMotion: boolean;
}

export interface MatchedVictoryFlameVisualState {
    emberStrength: number;
    innerWidth: number;
    intensity: number;
    motion: number;
    outerWidth: number;
    softness: number;
    visible: boolean;
}

interface ApplyMatchedVictoryFlameVisualStateInput {
    elapsedTime: number;
    mat: ShaderMaterial | null;
    mesh: Mesh | null;
    matchedVictoryBurst: number;
    state: MatchedVictoryFlameVisualState;
}

interface ApplyResolvingRimVisualStateInput {
    material: RimMaterialTarget | null;
    state: ResolvingRimVisualState;
}

interface ApplyFocusRimOpacityInput {
    material: RimMaterialTarget | null;
    opacity: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

export const getResolvingRimColorRole = (selection: ResolvingSelectionState): ResolvingRimColorRole =>
    selection === 'mismatch' ? 'danger' : selection === 'gambitNeutral' ? 'cyanBright' : 'emeraldBright';

export const computeResolvingRimVisualState = ({
    faceUp,
    graphicsQuality,
    isPinned,
    matchedVictoryBurst,
    reduceMotion,
    resolvingSelection,
    time,
    tileState
}: ResolvingRimVisualInput): ResolvingRimVisualState => {
    const resolvingActive = resolvingSelection !== null && faceUp;
    const matchedVictoryPersistent = tileState === 'matched' && faceUp && !resolvingActive;

    if (matchedVictoryPersistent) {
        const lowQualityOpacity = clamp(
            GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.rimOpacity +
                matchedVictoryBurst * GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.burstBoost,
            0,
            1
        );
        return {
            colorRole: 'emeraldBright',
            crispOpacity: 0,
            matchedVictoryPersistent,
            opacity: graphicsQuality === 'low' ? lowQualityOpacity : 0,
            resolvingActive
        };
    }

    if (!resolvingActive) {
        return {
            colorRole: null,
            crispOpacity: 0,
            matchedVictoryPersistent,
            opacity: 0,
            resolvingActive
        };
    }

    const pulse = reduceMotion
        ? 0.62
        : 0.38 + 0.32 * Math.sin(time * (resolvingSelection === 'mismatch' ? 5.1 : 4.05));
    const crispOpacity = isPinned ? Math.min(1, pulse + 0.2) : pulse;

    return {
        colorRole: getResolvingRimColorRole(resolvingSelection),
        crispOpacity,
        matchedVictoryPersistent,
        opacity: graphicsQuality === 'low' ? crispOpacity : crispOpacity * 0.18,
        resolvingActive
    };
};

export const computeFocusRimOpacity = ({
    keyboardFocused,
    pickable,
    reduceMotion,
    tileState,
    time
}: FocusRimOpacityInput): number => {
    if (tileState === 'matched' || !keyboardFocused || !pickable) {
        return 0;
    }
    if (reduceMotion) {
        return 0.68;
    }

    const pulse = 0.11 * (0.5 + 0.5 * Math.sin(time * 2.35));
    return clamp(0.76 + pulse, 0.72, 0.94);
};

export const applyResolvingRimVisualState = ({
    material,
    state
}: ApplyResolvingRimVisualStateInput): void => {
    if (!material) {
        return;
    }

    if (state.colorRole) {
        material.color?.set(RENDERER_THEME.colors[state.colorRole]);
    }

    material.opacity = state.opacity;
};

export const applyFocusRimOpacity = ({ material, opacity }: ApplyFocusRimOpacityInput): void => {
    if (material) {
        material.opacity = opacity;
    }
};

export const computeMatchedVictoryFlameVisualState = ({
    graphicsQuality,
    matchedVictoryBurst,
    matchedVictoryPersistent,
    reduceMotion
}: MatchedVictoryFlameVisualInput): MatchedVictoryFlameVisualState => {
    const matchedEdgeEffect = GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect;
    const empty = {
        emberStrength: 0,
        innerWidth: 0,
        intensity: 0,
        motion: 0,
        outerWidth: 0,
        softness: matchedEdgeEffect.band.softness,
        visible: false
    };

    if (!matchedVictoryPersistent || graphicsQuality === 'low') {
        return empty;
    }

    const tiers = matchedEdgeEffect.tiers;
    const tier = reduceMotion ? tiers.reduceMotion : graphicsQuality === 'high' ? tiers.high : tiers.medium;

    return {
        emberStrength: tier.emberStrength,
        innerWidth: matchedEdgeEffect.band.innerWidth * tier.innerWidthMul,
        intensity: tier.baseIntensity + matchedVictoryBurst * tier.burstIntensity,
        motion: tier.motion,
        outerWidth: matchedEdgeEffect.band.outerWidth * tier.outerWidthMul,
        softness: matchedEdgeEffect.band.softness,
        visible: true
    };
};

export const applyMatchedVictoryFlameVisualState = ({
    elapsedTime,
    mat,
    mesh,
    matchedVictoryBurst,
    state
}: ApplyMatchedVictoryFlameVisualStateInput): void => {
    if (!mat || !mesh || !mat.uniforms) {
        return;
    }

    mesh.visible = state.visible;

    if (!state.visible) {
        return;
    }

    const u = mat.uniforms as unknown as MatchedCardRimFireUniforms;
    u.uTime.value = elapsedTime;
    u.uBurst.value = matchedVictoryBurst;
    u.uMotion.value = state.motion;
    u.uSoftness.value = state.softness;
    u.uInnerWidth.value = state.innerWidth;
    u.uOuterWidth.value = state.outerWidth;
    u.uEmberStrength.value = state.emberStrength;
    u.uIntensity.value = state.intensity;
    clampMatchedCardRimFireDriverUniforms({ uIntensity: u.uIntensity, uBurst: u.uBurst });
};
