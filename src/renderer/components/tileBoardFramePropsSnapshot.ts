import type { MutableRefObject } from 'react';
import type { GraphicsQualityPreset, HazardTileKind, Tile } from '../../shared/contracts';
import type { TiltVector } from '../platformTilt/platformTiltTypes';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import type { TileTransform } from './tileBoardTransform';

export interface TileBoardFrameHoverTiltState {
    tileId: string | null;
    x: number;
    y: number;
}

export interface TileBezelFramePropsSnapshot {
    faceUp: boolean;
    fieldAmp: number;
    flipLocked: boolean;
    focusDimmed: boolean;
    interactionSuppressed: boolean;
    interactive: boolean;
    isPinned: boolean;
    pickable: boolean;
    reduceMotion: boolean;
    resolvingSelection: ResolvingSelectionState;
    shuffleMotionDeadlineMs: number;
    shuffleMotionBudgetMs: number;
    shuffleStaggerTileCount: number;
    shuffleBoardOrderIndex: number;
    boardEntranceMotionDeadlineMs: number;
    boardEntranceMotionBudgetMs: number;
    boardEntranceStaggerTileCount: number;
    boardRows: number;
    boardColumns: number;
    textureRevision: number;
    tile: Tile;
    transform: TileTransform;
    useSvgMeshBack: boolean;
    useSvgMeshFront: boolean;
    graphicsQuality: GraphicsQualityPreset;
    tileFieldParallaxEnabled: boolean;
    fieldTiltRef: MutableRefObject<TiltVector>;
    hoverTiltRef: MutableRefObject<TileBoardFrameHoverTiltState>;
    keyboardFocused: boolean;
    presentationWideRecall: boolean;
    presentationSilhouette: boolean;
    presentationNBackAnchor: boolean;
    nonPickableBack: boolean;
    hazardBackAccent: HazardTileKind | null;
    routeBackAccent: boolean;
    objectiveBackAccent: boolean;
    enemyOccupiedBack: boolean;
    /** Cancels match pulse / flip pop when a new resolving pair replaces the previous without a full idle frame. */
    resolvingMatchWaveKey: string | null;
}

export const createTileBezelFramePropsSnapshot = (
    input: TileBezelFramePropsSnapshot
): TileBezelFramePropsSnapshot => ({
    ...input
});
