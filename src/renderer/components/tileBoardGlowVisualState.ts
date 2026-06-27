import { Color, type Mesh, type ShaderMaterial } from 'three';
import { RENDERER_THEME } from '../styles/theme';
import { clampCardArcaneGlowDriverUniforms, type CardArcaneGlowUniforms } from './cardArcaneGlowMaterial';
import type { ResolvingSelectionState } from './tileResolvingSelection';

export type CardGlowColorRole = 'cyanBright' | 'danger' | 'emeraldBright' | 'goldBright' | 'emberSoft' | 'text';

export interface CardGlowVisualState {
    accent: CardGlowColorRole;
    intensity: number;
    mode: number;
    primary: CardGlowColorRole;
    pulse: number;
    secondary: CardGlowColorRole;
}

interface CardGlowVisualInput {
    cardGlowIntensity: number;
    focusActive: boolean;
    hoverDomParity: boolean;
    hoverFaceUpPickable: boolean;
    hoverFrontRimOpacityTarget: number;
    hoverRimOpacity: number;
    reduceMotion: boolean;
    resolveGlowIntensity: number;
    resolvingCrispOpacity: number;
    resolvingSelection: ResolvingSelectionState;
    time: number;
}

export interface CardGlowVisualStates {
    focus: CardGlowVisualState;
    hoverBack: CardGlowVisualState;
    hoverFront: CardGlowVisualState;
    resolving: CardGlowVisualState;
}

interface ApplyCardGlowVisualStateInput {
    elapsedTime: number;
    glow: CardGlowVisualState;
    mat: ShaderMaterial | null;
    mesh: Mesh | null;
    reduceMotion: boolean;
    renderQuality: {
        cardGlowMotion: number;
    };
    shaderGlowEnabled: boolean;
}

const emptyGlow = (
    mode: number,
    primary: CardGlowColorRole = 'goldBright',
    secondary: CardGlowColorRole = 'cyanBright',
    accent: CardGlowColorRole = 'emberSoft'
): CardGlowVisualState => ({
    accent,
    intensity: 0,
    mode,
    primary,
    pulse: 0,
    secondary
});

const resolvingPrimary = (selection: ResolvingSelectionState): CardGlowColorRole =>
    selection === 'mismatch' ? 'danger' : selection === 'gambitNeutral' ? 'cyanBright' : 'emeraldBright';

export const computeCardGlowVisualStates = ({
    cardGlowIntensity,
    focusActive,
    hoverDomParity,
    hoverFaceUpPickable,
    hoverFrontRimOpacityTarget,
    hoverRimOpacity,
    reduceMotion,
    resolveGlowIntensity,
    resolvingCrispOpacity,
    resolvingSelection,
    time
}: CardGlowVisualInput): CardGlowVisualStates => {
    const focusPulse = reduceMotion ? 0.18 : 0.38 + 0.22 * Math.sin(time * 2.35);
    const resolvingActive = resolvingSelection !== null;
    const resolvingMismatch = resolvingSelection === 'mismatch';
    const resolvingGambitNeutral = resolvingSelection === 'gambitNeutral';

    return {
        hoverBack: hoverDomParity
            ? {
                  accent: 'emberSoft',
                  intensity: cardGlowIntensity * hoverRimOpacity,
                  mode: 0,
                  primary: 'goldBright',
                  pulse: 0.28 + hoverRimOpacity * 0.28,
                  secondary: 'cyanBright'
              }
            : emptyGlow(0),
        hoverFront: hoverFaceUpPickable
            ? {
                  accent: 'emberSoft',
                  intensity: cardGlowIntensity * hoverFrontRimOpacityTarget,
                  mode: 0.35,
                  primary: 'goldBright',
                  pulse: 0.2 + hoverFrontRimOpacityTarget * 0.24,
                  secondary: 'cyanBright'
              }
            : emptyGlow(0.35),
        resolving: resolvingActive
            ? {
                  accent: resolvingMismatch ? 'emberSoft' : 'cyanBright',
                  intensity: resolveGlowIntensity * Math.max(0.42, resolvingCrispOpacity),
                  mode: resolvingMismatch ? 1.3 : resolvingGambitNeutral ? 0.8 : 1,
                  primary: resolvingPrimary(resolvingSelection),
                  pulse: resolvingMismatch ? 0.84 : 0.62,
                  secondary: 'goldBright'
              }
            : emptyGlow(1, 'emeraldBright', 'goldBright', 'cyanBright'),
        focus: focusActive
            ? {
                  accent: 'text',
                  intensity: cardGlowIntensity * 0.68,
                  mode: 0.55,
                  primary: 'goldBright',
                  pulse: focusPulse,
                  secondary: 'cyanBright'
              }
            : emptyGlow(0.55, 'goldBright', 'cyanBright', 'text')
    };
};

const scratchGlowColor = new Color();

const cardGlowColor = (colors: typeof RENDERER_THEME.colors, role: CardGlowColorRole): string => colors[role];

const setUniformColor = (
    target: { value: { set: (r: number, g: number, b: number) => void } },
    role: CardGlowColorRole
): void => {
    scratchGlowColor.set(cardGlowColor(RENDERER_THEME.colors, role));
    target.value.set(scratchGlowColor.r, scratchGlowColor.g, scratchGlowColor.b);
};

export const applyCardGlowVisualState = ({
    elapsedTime,
    glow,
    mat,
    mesh,
    reduceMotion,
    renderQuality,
    shaderGlowEnabled
}: ApplyCardGlowVisualStateInput): void => {
    if (!mat || !mesh || !mat.uniforms) {
        return;
    }

    mesh.visible = shaderGlowEnabled && glow.intensity > 0.002;
    const u = mat.uniforms as unknown as CardArcaneGlowUniforms;
    u.uTime.value = elapsedTime;
    u.uIntensity.value = shaderGlowEnabled ? glow.intensity : 0;
    u.uPulse.value = glow.pulse;
    u.uMotion.value = reduceMotion ? Math.min(renderQuality.cardGlowMotion, 0.08) : renderQuality.cardGlowMotion;
    u.uMode.value = glow.mode;
    setUniformColor(u.uPrimaryColor, glow.primary);
    setUniformColor(u.uSecondaryColor, glow.secondary);
    setUniformColor(u.uAccentColor, glow.accent);
    clampCardArcaneGlowDriverUniforms({ uIntensity: u.uIntensity, uPulse: u.uPulse, uMotion: u.uMotion });
};
