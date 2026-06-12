import { describe, expect, it } from 'vitest';

import { createTileBezelFramePropsSnapshot, type TileBezelFramePropsSnapshot } from './tileBoardFramePropsSnapshot';

const tile = {
    id: 'tile-a',
    label: 'A',
    pairKey: 'pair-a',
    state: 'hidden',
    symbol: 'A'
} as const;

const transform = {
    baseScale: 1,
    baseX: 1,
    baseY: 2,
    bezelScale: 1,
    flipRotationY: Math.PI,
    imperfectionRotationX: 0.1,
    imperfectionRotationZ: 0.2,
    imperfectionX: 0.3,
    imperfectionY: 0.4,
    layoutJitterX: 0.5,
    layoutJitterY: 0.6,
    layoutJitterZ: 0.7,
    layoutYaw: 0.8,
    panelScale: 1,
    seed: 42
};

describe('tileBoardFramePropsSnapshot', () => {
    it('copies the frame props snapshot without changing references', () => {
        const fieldTiltRef = { current: { x: 0.1, y: 0.2 } };
        const hoverTiltRef = { current: { tileId: 'tile-a', x: 0.3, y: -0.4 } };
        const input: TileBezelFramePropsSnapshot = {
            boardColumns: 4,
            boardEntranceMotionBudgetMs: 300,
            boardEntranceMotionDeadlineMs: 1_000,
            boardEntranceStaggerTileCount: 12,
            boardRows: 3,
            enemyOccupiedBack: true,
            faceUp: false,
            fieldAmp: 0.75,
            fieldTiltRef,
            flipLocked: false,
            focusDimmed: true,
            graphicsQuality: 'high',
            hazardBackAccent: 'fragile_cache',
            hoverTiltRef,
            interactionSuppressed: false,
            interactive: true,
            isPinned: true,
            keyboardFocused: true,
            nonPickableBack: false,
            objectiveBackAccent: true,
            pickable: true,
            presentationNBackAnchor: true,
            presentationSilhouette: false,
            presentationWideRecall: true,
            reduceMotion: false,
            resolvingMatchWaveKey: 'wave-a',
            resolvingSelection: 'match',
            routeBackAccent: false,
            shuffleBoardOrderIndex: 2,
            shuffleMotionBudgetMs: 200,
            shuffleMotionDeadlineMs: 800,
            shuffleStaggerTileCount: 10,
            textureRevision: 7,
            tile,
            tileFieldParallaxEnabled: true,
            transform,
            useSvgMeshBack: true,
            useSvgMeshFront: false
        };

        const snapshot = createTileBezelFramePropsSnapshot(input);

        expect(snapshot).toEqual(input);
        expect(snapshot).not.toBe(input);
        expect(snapshot.tile).toBe(tile);
        expect(snapshot.transform).toBe(transform);
        expect(snapshot.fieldTiltRef).toBe(fieldTiltRef);
        expect(snapshot.hoverTiltRef).toBe(hoverTiltRef);
    });
});
