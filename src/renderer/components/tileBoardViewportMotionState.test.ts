import { describe, expect, it } from 'vitest';
import {
    BOARD_VIEWPORT_ACTIVE_DAMPING,
    BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING,
    BOARD_VIEWPORT_IDLE_DAMPING,
    BOARD_VIEWPORT_IDLE_SCALE_DAMPING,
    applyInitialTileBoardViewportMotionState,
    applyTileBoardViewportMotionState,
    computeInitialTileBoardViewportMotionState,
    computeTileBoardViewportMotionState,
    type TileBoardViewportMotionTarget
} from './tileBoardViewportMotionState';

const boardViewport = {
    fitZoom: 1.25,
    panX: -0.35,
    panY: 0.42,
    zoom: 1.6
};

const createViewportMotionTarget = (): TileBoardViewportMotionTarget => {
    const target = {
        position: { x: 0, y: 0 },
        scale: {
            x: 1,
            y: 1,
            z: 1,
            setScalar(value: number): void {
                target.scale.x = value;
                target.scale.y = value;
                target.scale.z = value;
            }
        }
    };

    return target;
};

describe('tile board viewport motion state', () => {
    it('computes pan targets and composed scale from the viewport', () => {
        const state = computeTileBoardViewportMotionState({
            boardViewport,
            interactionSuppressed: false,
            reduceMotion: false
        });

        expect(state.targetPanX).toBe(boardViewport.panX);
        expect(state.targetPanY).toBe(boardViewport.panY);
        expect(state.targetScale).toBeCloseTo(2);
    });

    it('computes initial pan targets and composed scale from the viewport', () => {
        expect(computeInitialTileBoardViewportMotionState({ boardViewport })).toEqual({
            targetPanX: boardViewport.panX,
            targetPanY: boardViewport.panY,
            targetScale: 2
        });
    });

    it('applies initial viewport state directly to a plain target', () => {
        const target = createViewportMotionTarget();

        applyInitialTileBoardViewportMotionState(target, {
            targetPanX: -2,
            targetPanY: 3,
            targetScale: 1.75
        });

        expect(target.position).toEqual({ x: -2, y: 3 });
        expect(target.scale.x).toBe(1.75);
        expect(target.scale.y).toBe(1.75);
        expect(target.scale.z).toBe(1.75);
    });

    it('applies initial viewport state through Three-like position setters', () => {
        const target = createViewportMotionTarget();
        const calls: Array<[number, number, number]> = [];
        target.position.set = (x, y, z): void => {
            calls.push([x, y, z]);
            target.position.x = x;
            target.position.y = y;
        };

        applyInitialTileBoardViewportMotionState(target, {
            targetPanX: -2,
            targetPanY: 3,
            targetScale: 1.75
        });

        expect(calls).toEqual([[-2, 3, 0]]);
        expect(target.position.x).toBe(-2);
        expect(target.position.y).toBe(3);
        expect(target.scale.x).toBe(1.75);
    });

    it('uses idle damping while interaction is available', () => {
        const state = computeTileBoardViewportMotionState({
            boardViewport,
            interactionSuppressed: false,
            reduceMotion: false
        });

        expect(state.instant).toBe(false);
        expect(state.panDamping).toBe(BOARD_VIEWPORT_IDLE_DAMPING);
        expect(state.scaleDamping).toBe(BOARD_VIEWPORT_IDLE_SCALE_DAMPING);
    });

    it('uses active damping while interaction is suppressed', () => {
        const state = computeTileBoardViewportMotionState({
            boardViewport,
            interactionSuppressed: true,
            reduceMotion: false
        });

        expect(state.panDamping).toBe(BOARD_VIEWPORT_ACTIVE_DAMPING);
        expect(state.scaleDamping).toBe(BOARD_VIEWPORT_ACTIVE_SCALE_DAMPING);
    });

    it('marks reduced-motion updates as instant', () => {
        const state = computeTileBoardViewportMotionState({
            boardViewport,
            interactionSuppressed: true,
            reduceMotion: true
        });

        expect(state.instant).toBe(true);
    });

    it('applies reduced-motion viewport updates instantly', () => {
        const target = createViewportMotionTarget();

        applyTileBoardViewportMotionState(
            target,
            {
                instant: true,
                panDamping: BOARD_VIEWPORT_IDLE_DAMPING,
                scaleDamping: BOARD_VIEWPORT_IDLE_SCALE_DAMPING,
                targetPanX: -2,
                targetPanY: 3,
                targetScale: 1.75
            },
            0.016
        );

        expect(target.position).toEqual({ x: -2, y: 3 });
        expect(target.scale.x).toBe(1.75);
        expect(target.scale.y).toBe(1.75);
        expect(target.scale.z).toBe(1.75);
    });

    it('damps viewport position and scale toward the target', () => {
        const target = createViewportMotionTarget();

        applyTileBoardViewportMotionState(
            target,
            {
                instant: false,
                panDamping: BOARD_VIEWPORT_IDLE_DAMPING,
                scaleDamping: BOARD_VIEWPORT_IDLE_SCALE_DAMPING,
                targetPanX: 10,
                targetPanY: -10,
                targetScale: 2
            },
            0.016
        );

        expect(target.position.x).toBeGreaterThan(0);
        expect(target.position.x).toBeLessThan(10);
        expect(target.position.y).toBeLessThan(0);
        expect(target.position.y).toBeGreaterThan(-10);
        expect(target.scale.x).toBeGreaterThan(1);
        expect(target.scale.x).toBeLessThan(2);
        expect(target.scale.y).toBe(target.scale.x);
        expect(target.scale.z).toBe(target.scale.x);
    });
});
