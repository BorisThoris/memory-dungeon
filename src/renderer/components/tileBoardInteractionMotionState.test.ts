import { describe, expect, it } from 'vitest';
import { GAMEPLAY_BOARD_VISUALS } from './gameplayVisualConfig';
import {
    computeTileBoardInteractionMotionState,
    computeTileBoardLiftSmooth
} from './tileBoardInteractionMotionState';

const baseInput = {
    faceUp: false,
    fieldAmp: 0.7,
    fieldTilt: { x: 0.4, y: -0.6 },
    hoverTilt: { tileId: null, x: 0, y: 0 },
    isMatched: false,
    pickable: true,
    reduceMotion: false,
    seed: 37,
    tileFieldParallaxEnabled: true,
    tileId: 'tile-a',
    tileState: 'hidden' as const,
    time: 12.5
};

describe('tile board interaction motion state', () => {
    it('smooths lift toward the requested target with the supplied lambda', () => {
        const slow = computeTileBoardLiftSmooth({
            current: 0,
            delta: 1 / 60,
            liftLambda: 16,
            target: 0.02
        });
        const fast = computeTileBoardLiftSmooth({
            current: 0,
            delta: 1 / 60,
            liftLambda: 200,
            target: 0.02
        });

        expect(slow).toBeGreaterThan(0);
        expect(slow).toBeLessThan(0.02);
        expect(fast).toBeGreaterThan(slow);
        expect(fast).toBeLessThanOrEqual(0.02);
    });

    it('applies hidden-card hover parity lift, depth, and tilt', () => {
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            hoverTilt: { tileId: 'tile-a', x: 0.5, y: -0.25 }
        });

        expect(state.hoverDomParity).toBe(true);
        expect(state.hoverFaceUpPickable).toBe(false);
        expect(state.hoverTiltX).toBeCloseTo(0.25 * GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltX);
        expect(state.hoverTiltZ).toBeCloseTo(0.5 * GAMEPLAY_BOARD_VISUALS.hoverHiddenTiltZ);
        expect(state.hoverLift).toBe(GAMEPLAY_BOARD_VISUALS.hoverHiddenLift);
        expect(state.hoverDepth).toBe(GAMEPLAY_BOARD_VISUALS.hoverHiddenDepth);
    });

    it('marks face-up pickable hover without applying hidden hover lift', () => {
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            faceUp: true,
            hoverTilt: { tileId: 'tile-a', x: 0.5, y: -0.25 },
            tileState: 'flipped'
        });

        expect(state.hoverDomParity).toBe(false);
        expect(state.hoverFaceUpPickable).toBe(true);
        expect(state.hoverTiltX).toBe(0);
        expect(state.hoverTiltZ).toBe(0);
        expect(state.hoverLift).toBe(0);
        expect(state.hoverDepth).toBe(0);
    });

    it('computes field parallax rotation, lift, and depth', () => {
        const state = computeTileBoardInteractionMotionState(baseInput);
        const magnitude = Math.hypot(baseInput.fieldTilt.x, baseInput.fieldTilt.y);

        expect(state.fieldRotX).toBeCloseTo(0.6 * baseInput.fieldAmp * 0.074);
        expect(state.fieldRotZ).toBeCloseTo(0.4 * baseInput.fieldAmp * 0.068);
        expect(state.fieldLift).toBeCloseTo(magnitude * baseInput.fieldAmp * 0.00062);
        expect(state.fieldDepth).toBeCloseTo(magnitude * baseInput.fieldAmp * 0.00095);
    });

    it('uses matched-card motion tuning', () => {
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            hoverTilt: { tileId: 'tile-a', x: 0.5, y: -0.25 },
            isMatched: true,
            tileState: 'matched'
        });
        const magnitude = Math.hypot(baseInput.fieldTilt.x, baseInput.fieldTilt.y);

        expect(state.baseLiftFull).toBe(0.0024);
        expect(state.baseDepthFull).toBe(0.0036);
        expect(state.fieldRotX).toBeCloseTo(0.6 * baseInput.fieldAmp * 0.042);
        expect(state.fieldRotZ).toBeCloseTo(0.4 * baseInput.fieldAmp * 0.038);
        expect(state.fieldLift).toBeCloseTo(magnitude * baseInput.fieldAmp * 0.00035);
        expect(state.fieldDepth).toBeCloseTo(magnitude * baseInput.fieldAmp * 0.0005);
        expect(state.hoverDomParity).toBe(false);
    });

    it('boosts lift and damping for cashout-ready route cards', () => {
        const baseline = computeTileBoardInteractionMotionState({
            ...baseInput,
            routeReadabilityIntensity: 'none'
        });
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            routeReadabilityIntensity: 'stack'
        });

        expect(state.baseLiftFull).toBeGreaterThan(baseline.baseLiftFull);
        expect(state.baseDepthFull).toBeGreaterThan(baseline.baseDepthFull);
        expect(state.fieldLift).toBeGreaterThan(baseline.fieldLift);
        expect(state.liftLambda).toBeGreaterThan(baseline.liftLambda);
    });

    it('disables hover and ambient drift for reduced motion while preserving enabled field parallax', () => {
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            hoverTilt: { tileId: 'tile-a', x: 1, y: -1 },
            reduceMotion: true
        });

        expect(state.hoverDomParity).toBe(false);
        expect(state.hoverFaceUpPickable).toBe(false);
        expect(state.hoverTiltX).toBe(0);
        expect(state.hoverTiltZ).toBe(0);
        expect(state.fieldRotX).not.toBe(0);
        expect(state.fieldRotZ).not.toBe(0);
        expect(state.fieldLift).not.toBe(0);
        expect(state.fieldDepth).not.toBe(0);
        expect(state.idleDrift).toBe(0);
        expect(state.settle).toBe(0);
        expect(state.liftLambda).toBe(400);
        expect(state.rotationDamp).toBe(42);
    });

    it('turns off field parallax when the field flag is disabled', () => {
        const state = computeTileBoardInteractionMotionState({
            ...baseInput,
            tileFieldParallaxEnabled: false
        });

        expect(state.fieldRotX).toBe(0);
        expect(state.fieldRotZ).toBe(0);
        expect(state.fieldLift).toBe(0);
        expect(state.fieldDepth).toBe(0);
    });
});
