import { describe, expect, it } from 'vitest';
import {
    HAPTICS_POLICY,
    MAX_TILT_DEG,
    TILT_DEADZONE,
    applyDeadzoneNormalized,
    applyDeadzoneTilt,
    dampTilt,
    degreeTiltToProcessed,
    degreesToNormalizedTilt,
    deviceOrientationToDegreeTilt,
    hapticFeedbackIsNonEssential,
    remapTiltForScreenAngle,
    subtractBaselineDegrees,
    zeroTilt
} from './platformTiltMotion';

describe('degreesToNormalizedTilt', () => {
    it('maps within ±22° to proportional [-1, 1]', () => {
        expect(degreesToNormalizedTilt(11, -11)).toEqual({ x: 0.5, y: -0.5 });
    });

    it('clamps beyond ±22°', () => {
        expect(degreesToNormalizedTilt(90, -90)).toEqual({ x: 1, y: -1 });
    });
});

describe('applyDeadzoneNormalized', () => {
    it('zeros values inside deadzone', () => {
        expect(applyDeadzoneNormalized(0.03, TILT_DEADZONE)).toBe(0);
        expect(applyDeadzoneNormalized(-0.04, TILT_DEADZONE)).toBe(0);
    });

    it('remaps outer range toward ±1', () => {
        const y = applyDeadzoneNormalized(1, TILT_DEADZONE);

        expect(y).toBeCloseTo(1, 5);
        expect(applyDeadzoneNormalized(0.5, TILT_DEADZONE)).toBeGreaterThan(0.45);
    });
});

describe('remapTiltForScreenAngle', () => {
    it('rotates 90° by swapping and negating appropriately', () => {
        const t = remapTiltForScreenAngle({ x: 1, y: 0 }, 90);

        expect(t.x).toBeCloseTo(0, 4);
        expect(t.y).toBeCloseTo(1, 4);
    });
});

describe('deviceOrientationToDegreeTilt', () => {
    it('returns null for missing angles', () => {
        expect(deviceOrientationToDegreeTilt(null, 0)).toBeNull();
        expect(deviceOrientationToDegreeTilt(90, null)).toBeNull();
    });

    it('maps upright hold to ~zero y when beta is 90 and gamma 0', () => {
        const d = deviceOrientationToDegreeTilt(90, 0);

        expect(d).toEqual({ x: 0, y: 0 });
    });
});

describe('subtractBaselineDegrees', () => {
    it('subtracts component-wise', () => {
        expect(subtractBaselineDegrees({ x: 5, y: 3 }, { x: 2, y: 2 })).toEqual({ x: 3, y: 1 });
    });
});

describe('degreeTiltToProcessed', () => {
    it('applies deadzone after normalization', () => {
        const tiny = degreeTiltToProcessed({ x: 2, y: 2 }, 0);

        expect(Math.abs(tiny.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(tiny.y)).toBeLessThanOrEqual(1);
    });
});

describe('dampTilt', () => {
    it('moves current toward target', () => {
        const next = dampTilt(zeroTilt(), { x: 1, y: 0 }, 10, 0.016);

        expect(next.x).toBeGreaterThan(0);
        expect(next.x).toBeLessThan(1);
    });
});

describe('reduce-motion style zeroing', () => {
    it('zeroTilt is stable', () => {
        expect(zeroTilt()).toEqual({ x: 0, y: 0 });
    });

    it('MAX_TILT_DEG matches spec', () => {
        expect(MAX_TILT_DEG).toBe(22);
    });
});

describe('applyDeadzoneTilt', () => {
    it('applies per axis', () => {
        const o = applyDeadzoneTilt({ x: 1, y: 0.02 });

        expect(o.y).toBe(0);
        expect(o.x).toBeGreaterThan(0.9);
    });
});

describe('REG-067 haptic policy', () => {
    it('keeps haptics optional and non-essential', () => {
        expect(HAPTICS_POLICY).toMatchObject({
            essentialFeedback: false,
            persistenceRequired: false,
            runtime: 'optional_navigator_vibrate',
            unsupportedBehavior: 'silent_noop'
        });
        expect(hapticFeedbackIsNonEssential({ hapticsAvailable: true, reduceMotion: false })).toBe(true);
        expect(hapticFeedbackIsNonEssential({ hapticsAvailable: false, reduceMotion: false })).toBe(true);
        expect(hapticFeedbackIsNonEssential({ hapticsAvailable: true, reduceMotion: true })).toBe(true);
    });
});
