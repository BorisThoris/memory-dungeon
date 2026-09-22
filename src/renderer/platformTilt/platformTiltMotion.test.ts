import { describe, expect, it } from 'vitest';
import {
    HAPTIC_CUES,
    HAPTICS_POLICY,
    MAX_TILT_DEG,
    allHapticFeedbackIsNonEssential,
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
    it('keeps haptics optional and silent where they cannot fire', () => {
        expect(HAPTICS_POLICY).toMatchObject({
            essentialFeedback: false,
            persistenceRequired: false,
            runtime: 'optional_navigator_vibrate',
            unsupportedBehavior: 'silent_noop'
        });
    });

    it('leaves nothing that only the hands are told', () => {
        // A player misses the haptic whenever the hardware is absent, the browser declines, or
        // reduce motion is on. Every cue must therefore reach them some other way.
        expect(allHapticFeedbackIsNonEssential()).toBe(true);
        for (const [cue, channels] of Object.entries(HAPTIC_CUES)) {
            expect(hapticFeedbackIsNonEssential(cue as keyof typeof HAPTIC_CUES)).toBe(true);
            expect(channels.length).toBeGreaterThan(0);
        }
    });

    it('can actually fail, which the version before it could not', () => {
        // The old check ended `(!reduceMotion || hapticsAvailable || !hapticsAvailable)` — a
        // tautology — so it returned true for every input and this suite would have passed against
        // `() => true`. A compliance test that cannot fail is not a compliance test.
        const essential = { ...HAPTIC_CUES, handsOnly: [] as readonly string[] };
        const check = (cue: keyof typeof essential): boolean => essential[cue].length > 0;
        expect(check('studyClosing')).toBe(true);
        expect(check('handsOnly')).toBe(false);
    });

    it('registers every cue that actually fires a haptic', () => {
        // The list is the policy. A haptic added without an entry here is a cue nobody checked.
        expect(Object.keys(HAPTIC_CUES).sort()).toEqual(['chainBreak', 'feverArrival', 'studyClosing']);
    });
});
