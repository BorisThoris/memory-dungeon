import { describe, expect, it } from 'vitest';
import {
    TILE_BOARD_ZERO_LAYOUT_MOTION,
    applyTileBoardCardGroupMotionState,
    computeTileBoardCardGroupMotionState,
    computeTileBoardLayoutMotionState
} from './tileBoardLayoutMotionState';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';

const createGroupMotionTarget = () => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
});

const transform = {
    baseScale: 1.2,
    baseX: 10,
    baseY: -6,
    bezelScale: 1,
    flipRotationY: Math.PI,
    imperfectionRotationX: 0.01,
    imperfectionRotationZ: -0.02,
    imperfectionX: 0.3,
    imperfectionY: -0.2,
    layoutJitterX: 0.05,
    layoutJitterY: 0.07,
    layoutJitterZ: 0.09,
    layoutYaw: 0.15,
    panelScale: 1,
    seed: 12
};

const layoutMotion = (overrides: Partial<Parameters<typeof computeTileBoardLayoutMotionState>[0]> = {}) =>
    computeTileBoardLayoutMotionState({
        boardColumns: 4,
        boardEntranceMotionBudgetMs: 800,
        boardEntranceMotionDeadlineMs: 0,
        boardEntranceStaggerTileCount: 8,
        boardRows: 2,
        now: 1000,
        reduceMotion: false,
        shuffleBoardOrderIndex: 3,
        shuffleMotionBudgetMs: 600,
        shuffleMotionDeadlineMs: 0,
        shuffleStaggerTileCount: 8,
        ...overrides
    });

describe('tileBoardLayoutMotionState', () => {
    it('returns inactive zero motion when no layout deadline is active', () => {
        expect(layoutMotion()).toEqual({
            entranceLayoutActive: false,
            entranceMotion: TILE_BOARD_ZERO_LAYOUT_MOTION,
            layoutMotionActive: false,
            posLambda: 200,
            shuffleLayoutActive: false,
            shuffleMotion: TILE_BOARD_ZERO_LAYOUT_MOTION
        });
    });

    it('activates shuffle motion while inside the shuffle deadline', () => {
        const state = layoutMotion({ shuffleMotionDeadlineMs: 1400 });

        expect(state.shuffleLayoutActive).toBe(true);
        expect(state.entranceLayoutActive).toBe(false);
        expect(state.layoutMotionActive).toBe(true);
        expect(state.posLambda).toBe(9);
        expect(state.shuffleMotion).not.toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
        expect(state.entranceMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
    });

    it('gives shuffle precedence over entrance when both deadlines are active', () => {
        const state = layoutMotion({
            boardEntranceMotionDeadlineMs: 1500,
            shuffleMotionDeadlineMs: 1400
        });

        expect(state.shuffleLayoutActive).toBe(true);
        expect(state.entranceLayoutActive).toBe(false);
        expect(state.shuffleMotion).not.toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
        expect(state.entranceMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
    });

    it('activates entrance motion only when shuffle is inactive', () => {
        const state = layoutMotion({ boardEntranceMotionDeadlineMs: 1500 });

        expect(state.shuffleLayoutActive).toBe(false);
        expect(state.entranceLayoutActive).toBe(true);
        expect(state.layoutMotionActive).toBe(true);
        expect(state.posLambda).toBe(9);
        expect(state.shuffleMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
        expect(state.entranceMotion).not.toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
    });

    it('keeps active lane flags but returns zero transforms when budget or stagger data is missing', () => {
        const state = layoutMotion({
            shuffleMotionBudgetMs: 0,
            shuffleMotionDeadlineMs: 1400,
            shuffleStaggerTileCount: 0
        });

        expect(state.shuffleLayoutActive).toBe(true);
        expect(state.layoutMotionActive).toBe(true);
        expect(state.shuffleMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
    });

    it('disables layout motion under reduced motion', () => {
        const state = layoutMotion({
            boardEntranceMotionDeadlineMs: 1500,
            reduceMotion: true,
            shuffleMotionDeadlineMs: 1400
        });

        expect(state.shuffleLayoutActive).toBe(false);
        expect(state.entranceLayoutActive).toBe(false);
        expect(state.layoutMotionActive).toBe(false);
        expect(state.shuffleMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
        expect(state.entranceMotion).toBe(TILE_BOARD_ZERO_LAYOUT_MOTION);
    });

    it('snaps positions and scale while damping rotations when layout motion is inactive', () => {
        const target = createGroupMotionTarget();

        applyTileBoardCardGroupMotionState(
            target,
            {
                layoutMotionActive: false,
                positionXTarget: 12,
                positionYTarget: -4,
                positionZTarget: 2.5,
                posLambda: 200,
                reduceMotion: false,
                rotationDamp: 18,
                rotationXTarget: 0.4,
                rotationYTarget: -0.7,
                rotationZTarget: 0.2,
                scaleTarget: 1.25
            },
            1 / 60
        );

        expect(target.position).toEqual({ x: 12, y: -4, z: 2.5 });
        expect(target.scale).toEqual({ x: 1.25, y: 1.25, z: 1.25 });
        expect(target.rotation.x).toBeGreaterThan(0);
        expect(target.rotation.x).toBeLessThan(0.4);
        expect(target.rotation.y).toBeLessThan(0);
        expect(target.rotation.y).toBeGreaterThan(-0.7);
        expect(target.rotation.z).toBeGreaterThan(0);
        expect(target.rotation.z).toBeLessThan(0.2);
    });

    it('damps positions instead of snapping while layout motion is active', () => {
        const target = createGroupMotionTarget();

        applyTileBoardCardGroupMotionState(
            target,
            {
                layoutMotionActive: true,
                positionXTarget: 9,
                positionYTarget: 6,
                positionZTarget: -3,
                posLambda: 9,
                reduceMotion: false,
                rotationDamp: 18,
                rotationXTarget: 0,
                rotationYTarget: 0,
                rotationZTarget: 0,
                scaleTarget: 0.9
            },
            1 / 60
        );

        expect(target.position.x).toBeGreaterThan(0);
        expect(target.position.x).toBeLessThan(9);
        expect(target.position.y).toBeGreaterThan(0);
        expect(target.position.y).toBeLessThan(6);
        expect(target.position.z).toBeLessThan(0);
        expect(target.position.z).toBeGreaterThan(-3);
        expect(target.scale).toEqual({ x: 0.9, y: 0.9, z: 0.9 });
    });

    it('snaps y rotation under reduced motion while still damping x and z', () => {
        const target = createGroupMotionTarget();

        applyTileBoardCardGroupMotionState(
            target,
            {
                layoutMotionActive: false,
                positionXTarget: 0,
                positionYTarget: 0,
                positionZTarget: 0,
                posLambda: 200,
                reduceMotion: true,
                rotationDamp: 18,
                rotationXTarget: 0.6,
                rotationYTarget: 1.1,
                rotationZTarget: -0.5,
                scaleTarget: 1
            },
            1 / 60
        );

        expect(target.rotation.y).toBe(1.1);
        expect(target.rotation.x).toBeGreaterThan(0);
        expect(target.rotation.x).toBeLessThan(0.6);
        expect(target.rotation.z).toBeLessThan(0);
        expect(target.rotation.z).toBeGreaterThan(-0.5);
    });

    it('computes card group targets from transform, interaction, and layout motion inputs', () => {
        const state = computeTileBoardCardGroupMotionState({
            entranceMotion: { rotX: 0.2, rotY: 0.3, rotZ: 0.4, rx: 1, ry: 2, rz: 3 },
            fieldDepth: 0.01,
            fieldLift: 0.02,
            fieldRotX: 0.03,
            fieldRotZ: 0.04,
            flipPopScaleMultiplier: 1.05,
            flipPopZ: 0.06,
            hoverDepth: 0.07,
            hoverTiltX: 0.08,
            hoverTiltZ: 0.09,
            idleDrift: 0.1,
            layoutMotionActive: true,
            liftSmooth: 0.11,
            matchPulse: 0.5,
            posLambda: 9,
            reduceMotion: false,
            resolvingSelection: 'match',
            rotationDamp: 18,
            settle: 0.12,
            shuffleMotion: { rotX: -0.01, rotY: -0.02, rotZ: -0.03, rx: -0.4, ry: 0.5, rz: -0.6 },
            structDepth: 0.13,
            transform,
            wobbleTime: 1.5
        });

        expect(state.positionXTarget).toBeCloseTo(10.95);
        expect(state.positionYTarget).toBeCloseTo(-3.28);
        expect(state.positionZTarget).toBeCloseTo(2.76);
        expect(state.rotationXTarget).toBeCloseTo(0.31);
        expect(state.rotationYTarget).toBeCloseTo(Math.PI + 0.43);
        expect(state.rotationZTarget).toBeCloseTo(0.48);
        expect(state.scaleTarget).toBeCloseTo(1.2 * 1.05 * (1 + 0.5 * 0.13));
        expect(state.layoutMotionActive).toBe(true);
        expect(state.posLambda).toBe(9);
    });

    it('applies mismatch shake only when motion is allowed', () => {
        const animated = computeTileBoardCardGroupMotionState({
            entranceMotion: TILE_BOARD_ZERO_LAYOUT_MOTION,
            fieldDepth: 0,
            fieldLift: 0,
            fieldRotX: 0,
            fieldRotZ: 0,
            flipPopScaleMultiplier: 1,
            flipPopZ: 0,
            hoverDepth: 0,
            hoverTiltX: 0,
            hoverTiltZ: 0,
            idleDrift: 0,
            layoutMotionActive: false,
            liftSmooth: 0,
            matchPulse: 0,
            posLambda: 200,
            reduceMotion: false,
            resolvingSelection: 'mismatch',
            rotationDamp: 16,
            settle: 0,
            shuffleMotion: TILE_BOARD_ZERO_LAYOUT_MOTION,
            structDepth: 0,
            transform,
            wobbleTime: 0
        });
        const reduced = computeTileBoardCardGroupMotionState({
            entranceMotion: TILE_BOARD_ZERO_LAYOUT_MOTION,
            fieldDepth: 0,
            fieldLift: 0,
            fieldRotX: 0,
            fieldRotZ: 0,
            flipPopScaleMultiplier: 1,
            flipPopZ: 0,
            hoverDepth: 0,
            hoverTiltX: 0,
            hoverTiltZ: 0,
            idleDrift: 0,
            layoutMotionActive: false,
            liftSmooth: 0,
            matchPulse: 0,
            posLambda: 200,
            reduceMotion: true,
            resolvingSelection: 'mismatch',
            rotationDamp: 16,
            settle: 0,
            shuffleMotion: TILE_BOARD_ZERO_LAYOUT_MOTION,
            structDepth: 0,
            transform,
            wobbleTime: 0
        });

        expect(animated.positionXTarget).toBeCloseTo(reduced.positionXTarget);
        expect(animated.positionYTarget).toBeCloseTo(
            reduced.positionYTarget + GAMEPLAY_BOARD_VISUALS.mismatchShakeY
        );
    });
});
