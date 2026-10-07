/**
 * Time, for a painted scene.
 *
 * A scene's frame is a pure function of its props and this clock. The clock is the only thing that
 * remembers: where an eased value has got to (`smooth`, what a CSS transition used to do), when
 * a keyed beat began (`since`, what remounting an element to restart its animation used to do),
 * and how far a loop whose rate changes has run (`phase`, so a flame that burns faster does not
 * jump to a different frame the moment it speeds up).
 *
 * `still` is reduce motion: time does not pass, eased values arrive at once, and no beat plays.
 */
export interface SceneClock {
    /** Milliseconds since the scene mounted. */
    readonly t: number;
    /** Milliseconds since the last frame. */
    readonly dt: number;
    readonly still: boolean;
    /** `target`, approached over about `ms` milliseconds. The first reading of a key is the target itself. */
    smooth(key: string, target: number, ms: number): number;
    /**
     * Milliseconds since `value` last changed to what it is now; `Infinity` when it has not changed
     * since the scene first saw it (a mount or a restore replays nothing), when it is null, and
     * under `still`.
     */
    since(key: string, value: string | number | boolean | null): number;
    /** Milliseconds a loop has run, advancing `rate` milliseconds per millisecond. */
    phase(key: string, rate: number): number;
}

interface SceneClockDriver {
    /** Move to `now` (any monotonic milliseconds) and return the clock for this frame. */
    frame(now: number, still?: boolean): SceneClock;
}

/** A frame longer than this is a tab that was asleep, not a slow frame: time does not jump over it. */
export const SCENE_CLOCK_MAX_STEP_MS = 250;

export const createSceneClock = (): SceneClockDriver => {
    let origin: number | null = null;
    let last = 0;
    let elapsed = 0;
    const smoothed = new Map<string, number>();
    const beats = new Map<string, { value: string | number | boolean | null; at: number }>();
    const phases = new Map<string, number>();
    return {
        frame(now, still = false) {
            if (origin === null) {
                origin = now;
                last = now;
            }
            const dt = still ? 0 : Math.min(SCENE_CLOCK_MAX_STEP_MS, Math.max(0, now - last));
            last = now;
            elapsed += dt;
            const t = still ? 0 : elapsed;
            // Each key moves once a frame however often it is read.
            const moved = new Set<string>();
            return {
                t,
                dt,
                still,
                smooth(key, target, ms) {
                    const safe = Number.isFinite(target) ? target : 0;
                    const current = smoothed.get(key);
                    if (current === undefined || still || ms <= 0) {
                        smoothed.set(key, safe);
                        return safe;
                    }
                    if (moved.has(key)) {
                        return current;
                    }
                    moved.add(key);
                    // An exponential approach that is within two percent of the target after `ms`.
                    const next = current + (safe - current) * (1 - Math.exp((-4 * dt) / ms));
                    const settled = Math.abs(safe - next) < 0.0005 ? safe : next;
                    smoothed.set(key, settled);
                    return settled;
                },
                since(key, value) {
                    const beat = beats.get(key);
                    if (!beat) {
                        beats.set(key, { value, at: Number.NEGATIVE_INFINITY });
                        return Number.POSITIVE_INFINITY;
                    }
                    if (beat.value !== value) {
                        beat.value = value;
                        beat.at = elapsed;
                    }
                    if (still || value === null || value === false) {
                        return Number.POSITIVE_INFINITY;
                    }
                    return elapsed - beat.at;
                },
                phase(key, rate) {
                    const current = phases.get(key) ?? 0;
                    if (moved.has(`phase:${key}`)) {
                        return current;
                    }
                    moved.add(`phase:${key}`);
                    const next = current + dt * (Number.isFinite(rate) ? rate : 1);
                    phases.set(key, next);
                    return next;
                }
            };
        }
    };
};

/** A clock held at one moment with nothing remembered: what a test or a still frame composes against. */
export const fixedSceneClock = (t = 0, options: { still?: boolean; since?: Record<string, number> } = {}): SceneClock => ({
    t: options.still ? 0 : t,
    dt: 0,
    still: options.still ?? false,
    smooth: (_key, target) => (Number.isFinite(target) ? target : 0),
    since: (key, value) =>
        options.still || value === null || value === false ? Number.POSITIVE_INFINITY : (options.since?.[key] ?? Number.POSITIVE_INFINITY),
    phase: (_key, rate) => (options.still ? 0 : t * rate)
});

const fract = (value: number): number => value - Math.floor(value);

/** A repeatable number in 0..1 from two integers: the same event is the same every time it is drawn. */
export const sceneHash = (a: number, b = 0): number => fract(Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453123);

/** 0..1..0 over a loop of `periodMs`, starting `offset` of the way in. */
export const sceneBreath = (t: number, periodMs: number, offset = 0): number =>
    0.5 - 0.5 * Math.cos(2 * Math.PI * (t / periodMs + offset));

/** 0 to 1 across `edge0..edge1`, eased at both ends. */
export const sceneSmoothstep = (edge0: number, edge1: number, value: number): number => {
    const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0 || 1)));
    return x * x * (3 - 2 * x);
};

/**
 * A flame's light: never the same twice and never a step. Three slow sines at periods with no
 * common beat, -1..1. The cathedral's candlelight used to move in steps, one jump of the whole
 * layer every half second, which on a large bright screen read as the room flashing.
 */
export const sceneFlicker = (t: number, seed = 0): number => {
    const s = t / 1000;
    return (
        0.5 * Math.sin(s * 2.31 + seed * 1.7) + 0.3 * Math.sin(s * 3.73 + seed * 4.1 + 1.3) + 0.2 * Math.sin(s * 6.11 + seed * 2.9 + 0.4)
    );
};

/** Rise to 1 by `peakAt` (0..1 of the beat) and fall back to 0 by its end; 0 outside the beat. */
export const sceneBeatEnvelope = (elapsed: number, durationMs: number, peakAt: number): number => {
    if (!(elapsed >= 0) || elapsed >= durationMs) {
        return 0;
    }
    // The beats ease out hard: most of the motion is in the first third.
    const linear = elapsed / durationMs;
    const p = 1 - (1 - linear) * (1 - linear);
    return p < peakAt ? p / peakAt : 1 - (p - peakAt) / (1 - peakAt);
};

interface SceneOccurrence {
    /** Which time round this is, counting from the scene's start. */
    index: number;
    /** 0..1 through the event. */
    progress: number;
}

/**
 * Something that happens now and then: a bat, a falling star, a candle guttering. Time is cut into
 * slots of `everyMs`; in each slot the event starts at a point the slot's number decides and runs
 * `lastsMs`. Null between occurrences. A function of `t` alone, so nothing has to remember that an
 * event is under way and a frame can be composed for any moment.
 */
export const sceneOccurrence = (t: number, everyMs: number, lastsMs: number, seed: number): SceneOccurrence | null => {
    if (!(everyMs > lastsMs) || t < 0) {
        return null;
    }
    const index = Math.floor(t / everyMs);
    const start = index * everyMs + sceneHash(index, seed) * (everyMs - lastsMs);
    const elapsed = t - start;
    if (elapsed < 0 || elapsed >= lastsMs) {
        return null;
    }
    return { index, progress: elapsed / lastsMs };
};
