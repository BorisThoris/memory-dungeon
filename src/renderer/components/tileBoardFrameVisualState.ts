import type { Mesh, ShaderMaterial } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { gameplayRenderQualityProfile, type GameplayRenderQualityProfile } from './gameplayRenderProfile';
import {
    applyCardGlowVisualState,
    computeCardGlowVisualStates,
    type CardGlowVisualStates
} from './tileBoardGlowVisualState';
import {
    applyFocusRimOpacity,
    applyMatchedVictoryFlameVisualState,
    applyResolvingRimVisualState,
    computeFocusRimOpacity,
    computeMatchedVictoryFlameVisualState,
    computeResolvingRimVisualState,
    type MatchedVictoryFlameVisualState,
    type RimMaterialTarget,
    type ResolvingRimVisualState
} from './tileBoardRimVisualState';
import {
    applyHoverGoldVisualState,
    computeHoverGoldVisualState,
    type HoverGoldRimMaterialTarget,
    type HoverGoldVisualState
} from './tileBoardHoverGoldVisualState';
import type { ResolvingSelectionState } from './tileResolvingSelection';

interface TileBoardFrameVisualStateInput {
    faceUp: boolean;
    graphicsQuality: GraphicsQualityPreset;
    hoverDomParity: boolean;
    hoverFaceUpPickable: boolean;
    isPinned: boolean;
    keyboardFocused: boolean;
    matchedVictoryBurst: number;
    pickable: boolean;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    tileState: Tile['state'];
    time: number;
}

interface TileBoardFrameVisualState {
    cardGlowStates: CardGlowVisualStates;
    flameState: MatchedVictoryFlameVisualState;
    focusRimOpacity: number;
    hoverGoldState: HoverGoldVisualState;
    renderQuality: GameplayRenderQualityProfile;
    resolvingRimState: ResolvingRimVisualState;
}

interface TileBoardFrameVisualGlowTarget {
    mat: ShaderMaterial | null;
    mesh: Mesh | null;
}

interface ApplyTileBoardFrameVisualStateInput {
    elapsedTime: number;
    matchedVictoryBurst: number;
    reduceMotion: boolean;
    state: TileBoardFrameVisualState;
    targets: {
        focusRimMaterial: RimMaterialTarget | null;
        hoverBackRimMaterials: readonly (HoverGoldRimMaterialTarget | null | undefined)[];
        hoverFrontRimMaterials: readonly (HoverGoldRimMaterialTarget | null | undefined)[];
        matchedVictoryFlame: TileBoardFrameVisualGlowTarget;
        resolvingGlow: TileBoardFrameVisualGlowTarget;
        resolvingRimMaterial: RimMaterialTarget | null;
        focusGlow: TileBoardFrameVisualGlowTarget;
        hoverBackGlow: TileBoardFrameVisualGlowTarget;
        hoverFrontGlow: TileBoardFrameVisualGlowTarget;
    };
}

export const computeTileBoardFrameVisualState = ({
    faceUp,
    graphicsQuality,
    hoverDomParity,
    hoverFaceUpPickable,
    isPinned,
    keyboardFocused,
    matchedVictoryBurst,
    pickable,
    reduceMotion,
    resolvingSelection,
    tileState,
    time
}: TileBoardFrameVisualStateInput): TileBoardFrameVisualState => {
    const hoverGoldState = computeHoverGoldVisualState({
        graphicsQuality,
        hoverDomParity,
        hoverFaceUpPickable
    });
    const renderQuality = gameplayRenderQualityProfile(graphicsQuality);
    const resolvingRimState = computeResolvingRimVisualState({
        faceUp,
        graphicsQuality,
        isPinned,
        matchedVictoryBurst,
        reduceMotion,
        resolvingSelection,
        time,
        tileState
    });
    const focusActive = keyboardFocused && pickable && tileState !== 'matched';
    const cardGlowStates = computeCardGlowVisualStates({
        cardGlowIntensity: renderQuality.cardGlowIntensity,
        focusActive,
        hoverDomParity,
        hoverFaceUpPickable,
        hoverFrontRimOpacityTarget: hoverGoldState.frontRimOpacity,
        hoverRimOpacity: hoverGoldState.rimOpacity,
        reduceMotion,
        resolveGlowIntensity: renderQuality.resolveGlowIntensity,
        resolvingCrispOpacity: resolvingRimState.crispOpacity,
        resolvingSelection: resolvingRimState.resolvingActive ? resolvingSelection : null,
        time
    });
    const flameState = computeMatchedVictoryFlameVisualState({
        graphicsQuality,
        matchedVictoryBurst,
        matchedVictoryPersistent: resolvingRimState.matchedVictoryPersistent,
        reduceMotion
    });

    return {
        cardGlowStates,
        flameState,
        focusRimOpacity: computeFocusRimOpacity({
            keyboardFocused,
            pickable,
            reduceMotion,
            tileState,
            time
        }),
        hoverGoldState,
        renderQuality,
        resolvingRimState
    };
};

export const applyTileBoardFrameVisualState = ({
    elapsedTime,
    matchedVictoryBurst,
    reduceMotion,
    state,
    targets
}: ApplyTileBoardFrameVisualStateInput): void => {
    applyHoverGoldVisualState({
        backRimMaterials: targets.hoverBackRimMaterials,
        frontRimMaterials: targets.hoverFrontRimMaterials,
        state: state.hoverGoldState
    });

    applyResolvingRimVisualState({ material: targets.resolvingRimMaterial, state: state.resolvingRimState });

    applyCardGlowVisualState({
        elapsedTime,
        glow: state.cardGlowStates.hoverBack,
        mat: targets.hoverBackGlow.mat,
        mesh: targets.hoverBackGlow.mesh,
        reduceMotion,
        renderQuality: state.renderQuality,
        shaderGlowEnabled: state.hoverGoldState.shaderGlowEnabled
    });
    applyCardGlowVisualState({
        elapsedTime,
        glow: state.cardGlowStates.hoverFront,
        mat: targets.hoverFrontGlow.mat,
        mesh: targets.hoverFrontGlow.mesh,
        reduceMotion,
        renderQuality: state.renderQuality,
        shaderGlowEnabled: state.hoverGoldState.shaderGlowEnabled
    });
    applyCardGlowVisualState({
        elapsedTime,
        glow: state.cardGlowStates.resolving,
        mat: targets.resolvingGlow.mat,
        mesh: targets.resolvingGlow.mesh,
        reduceMotion,
        renderQuality: state.renderQuality,
        shaderGlowEnabled: state.hoverGoldState.shaderGlowEnabled
    });
    applyCardGlowVisualState({
        elapsedTime,
        glow: state.cardGlowStates.focus,
        mat: targets.focusGlow.mat,
        mesh: targets.focusGlow.mesh,
        reduceMotion,
        renderQuality: state.renderQuality,
        shaderGlowEnabled: state.hoverGoldState.shaderGlowEnabled
    });

    applyMatchedVictoryFlameVisualState({
        elapsedTime,
        mat: targets.matchedVictoryFlame.mat,
        mesh: targets.matchedVictoryFlame.mesh,
        matchedVictoryBurst,
        state: state.flameState
    });

    applyFocusRimOpacity({
        material: targets.focusRimMaterial,
        opacity: state.focusRimOpacity
    });
};
