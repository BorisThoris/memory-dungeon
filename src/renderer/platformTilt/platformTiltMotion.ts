import type { TiltVector } from './platformTiltTypes';

export const MAX_TILT_DEG = 22;
export const TILT_DEADZONE = 0.05;
export const HAPTICS_POLICY = {
    essentialFeedback: false,
    persistenceRequired: false,
    runtime: 'optional_navigator_vibrate',
    unsupportedBehavior: 'silent_noop'
} as const;

/**
 * Every cue this game can deliver by touch or rumble, and what a player who receives neither gets
 * instead. Registered here, beside the policy, because REG-067's promise — haptics stay
 * non-essential polish — is a claim about this list and nothing else.
 *
 * A player misses the haptic whenever the hardware is absent, the browser declines, or reduce
 * motion is on. So every entry needs at least one other channel, or that player is simply not told.
 * Adding a haptic cue means adding it here; a cue with an empty list fails the policy test, which
 * is the point of the list existing.
 */
export const HAPTIC_CUES = {
    /** `rumbleForBreak` — the chain breaking. */
    chainBreak: ['ring floor flash', 'card glow gutter', 'ladder drain', 'break sfx'],
    /** `rumbleForFeverArrival` — the run reaching the top. */
    feverArrival: ['card flourish', 'room ring flash', 'ladder arrival', 'arrival sfx'],
    /** `tapStudyClosing` — the study window about to shut. */
    studyClosing: ['memorize bar reddens', 'closing tick sfx']
} as const satisfies Record<string, readonly string[]>;

export type HapticCueId = keyof typeof HAPTIC_CUES;

/**
 * Whether a haptic cue is polish rather than the only way a player is told something.
 *
 * This used to take `hapticsAvailable` and `reduceMotion` and ignore both: its condition ended
 * `(!reduceMotion || hapticsAvailable || !hapticsAvailable)`, whose last two terms are a
 * tautology, so it returned true for every input and the REG-067 test would have passed against
 * `() => true`. The runtime flags were never the question. Whether a cue is essential is a fact
 * about the cue — does anything else carry it — and no device state changes the answer.
 */
export const hapticFeedbackIsNonEssential = (cue: HapticCueId): boolean =>
    HAPTICS_POLICY.essentialFeedback === false && HAPTIC_CUES[cue].length > 0;

/** Every registered cue is polish. The whole of REG-067, as one statement. */
export const allHapticFeedbackIsNonEssential = (): boolean =>
    (Object.keys(HAPTIC_CUES) as HapticCueId[]).every(hapticFeedbackIsNonEssential);

export const zeroTilt = (): TiltVector => ({ x: 0, y: 0 });

/** Clamp degrees to ±MAX_TILT_DEG and map to [-1, 1]. */
export function degreesToNormalizedTilt(degX: number, degY: number): TiltVector {
    const clampDeg = (d: number): number => Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, d));

    return {
        x: clampDeg(degX) / MAX_TILT_DEG,
        y: clampDeg(degY) / MAX_TILT_DEG
    };
}

/**
 * Per-axis deadzone in normalized [-1, 1] space: values inside ±zone go to 0;
 * outer range is linearly expanded back to ±1.
 */
export function applyDeadzoneNormalized(value: number, zone: number = TILT_DEADZONE): number {
    const a = Math.abs(value);

    if (a < zone) {
        return 0;
    }

    return Math.sign(value) * ((a - zone) / (1 - zone));
}

export function applyDeadzoneTilt(tilt: TiltVector, zone: number = TILT_DEADZONE): TiltVector {
    return {
        x: applyDeadzoneNormalized(tilt.x, zone),
        y: applyDeadzoneNormalized(tilt.y, zone)
    };
}

/** Rotate tilt in screen space when device screen orientation angle changes (degrees). */
export function remapTiltForScreenAngle(tilt: TiltVector, angleDeg: number): TiltVector {
    const r = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const { x, y } = tilt;

    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}

/**
 * Convert DeviceOrientation angles (degrees) to raw tilt degrees in a portrait-style frame.
 * beta: front-back; gamma: left-right. Neutral upright hold ≈ beta 90, gamma 0.
 */
export function deviceOrientationToDegreeTilt(
    beta: number | null,
    gamma: number | null
): TiltVector | null {
    if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) {
        return null;
    }

    const yDeg = beta - 90;
    const xDeg = gamma;

    return { x: xDeg, y: yDeg };
}

export function subtractBaselineDegrees(current: TiltVector, baseline: TiltVector): TiltVector {
    return {
        x: current.x - baseline.x,
        y: current.y - baseline.y
    };
}

/** Relative degree tilt (after baseline subtract) → screen-angle remap → ±22° clamp → normalize → deadzone. */
export function degreeTiltToProcessed(relativeDeg: TiltVector, screenAngleDeg: number): TiltVector {
    const remapped = remapTiltForScreenAngle(relativeDeg, screenAngleDeg);
    const normalized = degreesToNormalizedTilt(remapped.x, remapped.y);

    return applyDeadzoneTilt(normalized);
}

export function dampTilt(current: TiltVector, target: TiltVector, smooth: number, dtSeconds: number): TiltVector {
    const t = 1 - Math.exp(-smooth * Math.min(dtSeconds, 0.1));

    return {
        x: current.x + (target.x - current.x) * t,
        y: current.y + (target.y - current.y) * t
    };
}
