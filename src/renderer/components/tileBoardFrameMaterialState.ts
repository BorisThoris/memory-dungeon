import type { Color, MeshStandardMaterial } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import {
    applyTileBoardCardTint,
    type TileBoardCardTintInput
} from './tileBoardCardTint';
import {
    applyCardMaterialVisualState,
    computeCardFocusDimBlend,
    computeCardMaterialVisualState
} from './tileBoardMaterialVisualState';
import type { ResolvingSelectionState } from './tileResolvingSelection';

interface TileBoardFrameMaterialStateInput {
    cardTint: TileBoardCardTintInput;
    currentFocusDimBlend: number;
    delta: number;
    faceUp: boolean;
    focusDimmed: boolean;
    graphicsQuality: GraphicsQualityPreset;
    hoverEmissiveIntensity: number;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    tileState: Tile['state'];
    time: number;
}

interface ApplyTileBoardFrameMaterialStateInput {
    backMaterial: MeshStandardMaterial | null;
    frontMaterial: MeshStandardMaterial | null;
    scratchColor: Color;
    state: TileBoardFrameMaterialStateInput;
    tint: Color;
}

interface ApplyTileBoardFrameMaterialStateResult {
    focusDimBlend: number;
}

export const applyTileBoardFrameMaterialState = ({
    backMaterial,
    frontMaterial,
    scratchColor,
    state,
    tint
}: ApplyTileBoardFrameMaterialStateInput): ApplyTileBoardFrameMaterialStateResult => {
    applyTileBoardCardTint(state.cardTint, tint, scratchColor);

    const focusDimBlend = computeCardFocusDimBlend({
        current: state.currentFocusDimBlend,
        delta: state.delta,
        faceUp: state.faceUp,
        focusDimmed: state.focusDimmed,
        reduceMotion: state.reduceMotion,
        tileState: state.tileState
    });
    const materialVisualState = computeCardMaterialVisualState({
        faceUp: state.faceUp,
        focusDimBlend,
        graphicsQuality: state.graphicsQuality,
        hoverEmissiveIntensity: state.hoverEmissiveIntensity,
        reduceMotion: state.reduceMotion,
        resolvingSelection: state.resolvingSelection,
        tileState: state.tileState,
        time: state.time
    });

    applyCardMaterialVisualState({
        backMaterial,
        frontMaterial,
        state: materialVisualState,
        tint
    });

    return { focusDimBlend };
};
