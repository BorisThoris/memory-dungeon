import type { Mesh, ShaderMaterial } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import { RENDERER_THEME } from '../styles/theme';
import {
    clampMatchedCardRimFireDriverUniforms,
    type MatchedCardRimFireUniforms
} from './matchedCardRimFireMaterial';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import type { TileTraitRouteReadabilityIntensity } from './tileBoardReadability';

export type ResolvingRimColorRole = 'cyanBright' | 'danger' | 'emeraldBright';

interface ResolvingRimVisualInput {
    faceUp: boolean;
    graphicsQuality: GraphicsQualityPreset;
    isPinned: boolean;
    matchedVictoryBurst: number;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    routeReadabilityIntensity?: TileTraitRouteReadabilityIntensity;
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
    /** three skips a material that is not visible: a rim at nothing costs no draw call. */
    visible?: boolean;
}

/** Set a rim's opacity, and stop drawing it while it shows nothing. */
const setRimOpacity = (material: RimMaterialTarget, opacity: number): void => {
    material.opacity = opacity;
    const visible = opacity > 0.001;
    if (material.visible !== undefined && material.visible !== visible) material.visible = visible;
};

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
    auraMood?: 'focus' | 'charge' | 'match';
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
    routeReadabilityIntensity = 'none',
    time,
    tileState
}: ResolvingRimVisualInput): ResolvingRimVisualState => {
    const resolvingActive = resolvingSelection !== null && faceUp;
    const matchedVictoryPersistent = tileState === 'matched' && faceUp && !resolvingActive;

    if (matchedVictoryPersistent) {
        const matchedRouteBoost =
            routeReadabilityIntensity === 'stack'
                ? 0.24
                : routeReadabilityIntensity === 'cashout'
                  ? 0.18
                  : routeReadabilityIntensity === 'surge'
                    ? 0.12
                    : routeReadabilityIntensity === 'ready'
                      ? 0.08
                      : routeReadabilityIntensity === 'setup'
                        ? 0.05
                        : 0;
        const lowQualityOpacity = clamp(
            GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.rimOpacity +
                matchedVictoryBurst * GAMEPLAY_BOARD_VISUALS.matchedEdgeEffect.low.burstBoost +
                matchedRouteBoost,
            0,
            1
        );
        return {
            colorRole: 'emeraldBright',
            crispOpacity: 0,
            matchedVictoryPersistent,
            opacity: graphicsQuality === 'low' ? lowQualityOpacity : matchedRouteBoost,
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

    setRimOpacity(material, state.opacity);
};

export const applyFocusRimOpacity = ({ material, opacity }: ApplyFocusRimOpacityInput): void => {
    if (material) {
        setRimOpacity(material, opacity);
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
    u.uTime.value = state.motion > 0 ? elapsedTime : 0;
    u.uBurst.value = matchedVictoryBurst;
    u.uMotion.value = state.motion;
    u.uSoftness.value = state.softness;
    u.uInnerWidth.value = state.innerWidth;
    u.uOuterWidth.value = state.outerWidth;
    u.uEmberStrength.value = state.emberStrength;
    u.uIntensity.value = state.intensity;
    if (state.auraMood === 'match') {
        u.uCoreColor.value.set(1, 0.98, 0.78);
        u.uGlowColor.value.set(0.55, 1, 0.8);
        u.uEmberColor.value.set(0.12, 0.65, 0.48);
    } else {
        u.uCoreColor.value.set(1, 0.94, 0.68);
        u.uGlowColor.value.set(1, 0.56, 0.16);
        u.uEmberColor.value.set(0.95, state.auraMood === 'charge' ? 0.19 : 0.32, 0.035);
    }
    clampMatchedCardRimFireDriverUniforms({ uIntensity: u.uIntensity, uBurst: u.uBurst });
};
