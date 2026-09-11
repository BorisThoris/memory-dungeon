import type { Group } from 'three';
import { BOARD_SHAKE_AT_REST, type BoardShakeSample } from './boardTrauma';
import type { TileBoardViewportState } from './tileBoardViewport';
import {
    advanceScheduledTileBezelFrames,
    type AdvanceScheduledTileBezelFramesResult
} from './tileFrameActivity';
import {
    applyTileBoardRuneFieldUniformState,
    computeTileBoardRuneFieldUniformState,
    type TileBoardRuneFieldMetrics,
    type TileBoardRuneFieldUniformTarget
} from './tileBoardRuneField';
import {
    applyTileBoardViewportMotionState,
    computeTileBoardViewportMotionState,
    type TileBoardPanState
} from './tileBoardViewportMotionState';
import type { GameplayRenderQualityProfile } from './gameplayRenderProfile';
import type { TileBezelFrameBag } from './tileBoardFrameBag';

interface TileBoardSceneFrameResult {
    tileFrames: AdvanceScheduledTileBezelFramesResult | null;
    tileStepMs: number;
    viewportMs: number;
    viewportUpdated: boolean;
    runeFieldUpdated: boolean;
}

export const runTileBoardSceneFrame = ({
    accumulatePerfPhases,
    advanceTileFrame,
    bags,
    boardGroup,
    boardRuneFieldMetrics,
    boardViewport,
    clockElapsedTime,
    delta,
    idleStreaks,
    interactionSuppressed,
    now,
    pan,
    perfOn,
    reduceMotion,
    runeFieldUniforms,
    sceneRenderQuality,
    shake = BOARD_SHAKE_AT_REST,
    tileStepLegacy
}: {
    accumulatePerfPhases: (phases: { tileStepMs: number; viewportMs: number }) => void;
    advanceTileFrame: (bag: TileBezelFrameBag) => void;
    bags: Map<string, TileBezelFrameBag>;
    boardGroup: Group | null;
    boardRuneFieldMetrics: TileBoardRuneFieldMetrics;
    boardViewport: TileBoardViewportState;
    clockElapsedTime: number;
    delta: number;
    idleStreaks: Map<string, number>;
    interactionSuppressed: boolean;
    now: () => number;
    /** The damped pan, owned by the caller so the shake can sit on top of it without feeding back. */
    pan?: TileBoardPanState;
    perfOn: boolean;
    reduceMotion: boolean;
    runeFieldUniforms: TileBoardRuneFieldUniformTarget | null;
    sceneRenderQuality: GameplayRenderQualityProfile;
    shake?: BoardShakeSample;
    tileStepLegacy: boolean;
}): TileBoardSceneFrameResult => {
    let tileStepMs = 0;
    let viewportMs = 0;
    let tileFrames: AdvanceScheduledTileBezelFramesResult | null = null;

    if (!tileStepLegacy) {
        const tTile0 = perfOn ? now() : 0;
        const nowMs = now();

        tileFrames = advanceScheduledTileBezelFrames({
            advanceFrame: advanceTileFrame,
            bags,
            clockElapsedTime,
            idleStreaks,
            nowMs
        });

        if (perfOn) {
            tileStepMs = now() - tTile0;
        }
    }

    const tViewport0 = perfOn ? now() : 0;
    let viewportUpdated = false;

    if (boardGroup) {
        const viewportMotion = computeTileBoardViewportMotionState({
            boardViewport,
            interactionSuppressed,
            reduceMotion,
            shake
        });
        applyTileBoardViewportMotionState(boardGroup, viewportMotion, delta, pan);
        viewportUpdated = true;
    }

    if (perfOn) {
        viewportMs = now() - tViewport0;
        accumulatePerfPhases({ tileStepMs, viewportMs });
    }

    let runeFieldUpdated = false;
    if (runeFieldUniforms) {
        const runeFieldState = computeTileBoardRuneFieldUniformState({
            elapsedTime: clockElapsedTime,
            metrics: boardRuneFieldMetrics,
            reduceMotion,
            renderQuality: sceneRenderQuality
        });
        applyTileBoardRuneFieldUniformState(runeFieldUniforms, runeFieldState);
        runeFieldUpdated = true;
    }

    return {
        tileFrames,
        tileStepMs,
        viewportMs,
        viewportUpdated,
        runeFieldUpdated
    };
};
