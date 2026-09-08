import { Color } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { RENDERER_THEME } from '../styles/theme';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import type { ResolvingSelectionState } from './tileResolvingSelection';

/** FX-006 / HOVER_DOM_WEBGL_TOKENS: border emphasis -> warm tint lerp. */
const HOVER_RIM_TINT = new Color('#fff0d4');
const HOVER_RIM_TINT_LERP = 0.2;
/** Matched face tint on `low` only; medium+ relies on the edge shader and neutral card albedo. */
const MATCH_FACE_GLOW = new Color('#b8f0d0');
/** CARD-018: warm pin read blended on top of resolving face tints. */
const PIN_STACK_TINT = new Color('#d4b870');
const PRESENTATION_N_BACK_TINT = new Color(RENDERER_THEME.colors.cyanBright);
const PRESENTATION_WIDE_RECALL_TINT = new Color('#c5c0d8');
const fallbackScratchColor = new Color();

export interface TileBoardCardTintInput {
    faceUp: boolean;
    graphicsQuality: GraphicsQualityPreset;
    hoverDomParity: boolean;
    hoverFaceUpPickable: boolean;
    isPinned: boolean;
    nonPickableBack: boolean;
    presentationNBackAnchor: boolean;
    presentationSilhouette: boolean;
    presentationWideRecall: boolean;
    resolvingSelection: ResolvingSelectionState;
    tile: Tile;
}

export const applyTileBoardCardTint = (
    input: TileBoardCardTintInput,
    target: Color,
    scratch: Color = fallbackScratchColor
): Color => {
    const {
        faceUp,
        graphicsQuality,
        hoverDomParity,
        hoverFaceUpPickable,
        isPinned,
        nonPickableBack,
        presentationNBackAnchor,
        presentationSilhouette,
        presentationWideRecall,
        resolvingSelection,
        tile
    } = input;
    const hiddenPinned = isPinned && tile.state === 'hidden';

    target.set('#ffffff');
    if (hiddenPinned) {
        target.set('#d4b870');
    } else if (nonPickableBack) {
        target.set('#9a94a3');
    } else if (!faceUp && tile.state === 'hidden' && tile.findableKind != null) {
        target.lerp(scratch.set('#5ee0c8'), 0.12);
    } else if (tile.state === 'matched' && faceUp) {
        if (graphicsQuality === 'low') {
            target.lerp(MATCH_FACE_GLOW, 0.32);
        }
    } else if (resolvingSelection === 'mismatch' && faceUp) {
        target.set('#ffb4a6');
    } else if (resolvingSelection === 'gambitNeutral' && faceUp) {
        target.set('#cfe8f2');
    }

    if (isPinned && faceUp && resolvingSelection !== null) {
        const pinLerp = resolvingSelection === 'match' ? 0.36 : resolvingSelection === 'gambitNeutral' ? 0.3 : 0.26;
        target.lerp(PIN_STACK_TINT, pinLerp);
    }
    if (hoverDomParity) {
        target.lerp(HOVER_RIM_TINT, HOVER_RIM_TINT_LERP);
    } else if (hoverFaceUpPickable) {
        target.lerp(HOVER_RIM_TINT, GAMEPLAY_BOARD_VISUALS.hoverFaceUpTintLerp);
    }
    if (presentationNBackAnchor) {
        target.lerp(PRESENTATION_N_BACK_TINT, 0.14);
    }
    if (presentationWideRecall) {
        target.lerp(PRESENTATION_WIDE_RECALL_TINT, 0.18);
    }
    if (presentationSilhouette) {
        target.multiplyScalar(0.84);
    }

    return target;
};
