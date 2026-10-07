import { describe, expect, it } from 'vitest';
import { createSceneClock, fixedSceneClock, SCENE_CLOCK_MAX_STEP_MS, sceneBeatEnvelope, sceneBreath, sceneFlicker, sceneHash, sceneOccurrence } from './sceneClock';

describe('createSceneClock', () => {
    it('counts from the first frame and never jumps over a tab that was asleep', () => {
        const clock = createSceneClock();
        expect(clock.frame(5000).t).toBe(0);
        expect(clock.frame(5033).t).toBe(33);
        // Ten seconds hidden is one capped step, not ten seconds of motion in one frame.
        expect(clock.frame(15_033).t).toBe(33 + SCENE_CLOCK_MAX_STEP_MS);
    });

    it('eases a value toward its target the way a transition did, starting from where it is', () => {
        const clock = createSceneClock();
        expect(clock.frame(0).smooth('ring', 0.5, 900)).toBe(0.5);
        const early = clock.frame(100).smooth('ring', 1, 900);
        expect(early).toBeGreaterThan(0.5);
        expect(early).toBeLessThan(0.8);
        let value = early;
        for (let now = 133; now <= 1100; now += 33) {
            const next = clock.frame(now).smooth('ring', 1, 900);
            expect(next).toBeGreaterThanOrEqual(value);
            value = next;
        }
        expect(value).toBeGreaterThan(0.97);
    });

    it('moves an eased value once a frame however often it is read', () => {
        const clock = createSceneClock();
        clock.frame(0).smooth('x', 0, 500);
        const frame = clock.frame(50);
        const first = frame.smooth('x', 1, 500);
        expect(frame.smooth('x', 1, 500)).toBe(first);
    });

    it('times a beat from the moment its key changes, and replays nothing it found already set', () => {
        const clock = createSceneClock();
        // Mounted with a key already there (a restore): no beat.
        expect(clock.frame(0).since('pulse', 'turn-1')).toBe(Number.POSITIVE_INFINITY);
        expect(clock.frame(100).since('pulse', 'turn-1')).toBe(Number.POSITIVE_INFINITY);
        // A new key starts one; the same key again does not restart it.
        expect(clock.frame(200).since('pulse', 'turn-2')).toBe(0);
        expect(clock.frame(300).since('pulse', 'turn-2')).toBe(100);
        // A second break gets its own.
        expect(clock.frame(400).since('pulse', 'turn-3')).toBe(0);
        // No key, no beat.
        expect(clock.frame(500).since('pulse', null)).toBe(Number.POSITIVE_INFINITY);
    });

    it('runs a loop at the rate it is given without jumping when the rate changes', () => {
        const clock = createSceneClock();
        clock.frame(0).phase('flames', 1);
        expect(clock.frame(100).phase('flames', 1)).toBe(100);
        // Twice as fast from here on: the next 100ms add 200, they do not rescale the first 100.
        expect(clock.frame(200).phase('flames', 2)).toBe(300);
        // Stopped: a freeze holds the frame.
        expect(clock.frame(300).phase('flames', 0)).toBe(300);
    });

    it('holds everything still under reduce motion: no time, no easing, no beat', () => {
        const clock = createSceneClock();
        clock.frame(0, true).smooth('x', 0, 900);
        const frame = clock.frame(500, true);
        expect(frame.t).toBe(0);
        expect(frame.dt).toBe(0);
        expect(frame.smooth('x', 1, 900)).toBe(1);
        expect(frame.since('pulse', 'a')).toBe(Number.POSITIVE_INFINITY);
        expect(clock.frame(600, true).since('pulse', 'b')).toBe(Number.POSITIVE_INFINITY);
        expect(clock.frame(700, true).phase('flames', 1)).toBe(0);
    });
});

describe('the shapes a scene moves on', () => {
    it('breathes between nothing and full, smoothly, and closes its loop', () => {
        expect(sceneBreath(0, 4000)).toBeCloseTo(0, 6);
        expect(sceneBreath(2000, 4000)).toBeCloseTo(1, 6);
        expect(sceneBreath(4000, 4000)).toBeCloseTo(0, 6);
    });

    it('flickers without ever stepping: a frame apart is a hair apart', () => {
        let largest = 0;
        for (let t = 0; t < 20_000; t += 33) {
            const now = sceneFlicker(t, 1);
            expect(Math.abs(now)).toBeLessThanOrEqual(1);
            largest = Math.max(largest, Math.abs(sceneFlicker(t + 33, 1) - now));
        }
        // The stepped candlelight this replaced jumped by up to a seventh of the layer at once.
        expect(largest).toBeLessThan(0.12);
    });

    it('throws a beat up fast and lets it settle, and is nothing outside it', () => {
        expect(sceneBeatEnvelope(-1, 700, 0.12)).toBe(0);
        expect(sceneBeatEnvelope(700, 700, 0.12)).toBe(0);
        expect(sceneBeatEnvelope(Number.POSITIVE_INFINITY, 700, 0.12)).toBe(0);
        let peak = 0;
        let peakAt = 0;
        for (let elapsed = 0; elapsed < 700; elapsed += 5) {
            const level = sceneBeatEnvelope(elapsed, 700, 0.12);
            expect(level).toBeGreaterThanOrEqual(0);
            expect(level).toBeLessThanOrEqual(1);
            if (level > peak) {
                peak = level;
                peakAt = elapsed;
            }
        }
        expect(peak).toBeGreaterThan(0.9);
        // The peak comes early: the flash is a strike, not a swell.
        expect(peakAt).toBeLessThan(120);
    });

    it('hashes the same pair to the same number, inside 0..1', () => {
        for (let index = 0; index < 50; index += 1) {
            const value = sceneHash(index, 7);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
            expect(sceneHash(index, 7)).toBe(value);
        }
    });

    it('lets something happen once in each stretch of time, for as long as it lasts, at a moment of its own', () => {
        const every = 30_000;
        const lasts = 4000;
        const starts: number[] = [];
        for (let slot = 0; slot < 6; slot += 1) {
            let active = 0;
            let first = -1;
            for (let t = slot * every; t < (slot + 1) * every; t += 50) {
                const occurrence = sceneOccurrence(t, every, lasts, 3);
                if (occurrence) {
                    active += 1;
                    if (first < 0) {
                        first = t - slot * every;
                    }
                    expect(occurrence.index).toBe(slot);
                    expect(occurrence.progress).toBeGreaterThanOrEqual(0);
                    expect(occurrence.progress).toBeLessThan(1);
                }
            }
            // 4000ms sampled every 50ms: it ran its whole length inside its slot.
            expect(active).toBeGreaterThanOrEqual(79);
            expect(active).toBeLessThanOrEqual(81);
            starts.push(first);
        }
        // Not on a beat: the slots do not all start it at the same moment.
        expect(new Set(starts).size).toBeGreaterThan(3);
        expect(sceneOccurrence(-5, every, lasts, 3)).toBeNull();
        expect(sceneOccurrence(100, 1000, 2000, 3)).toBeNull();
    });

    it('gives a test a clock that stands where it is put', () => {
        const clock = fixedSceneClock(1234, { since: { pulse: 80 } });
        expect(clock.t).toBe(1234);
        expect(clock.smooth('x', 0.7, 900)).toBe(0.7);
        expect(clock.since('pulse', 'k')).toBe(80);
        expect(clock.since('pulse', null)).toBe(Number.POSITIVE_INFINITY);
        expect(clock.since('other', 'k')).toBe(Number.POSITIVE_INFINITY);
        expect(fixedSceneClock(1234, { still: true }).t).toBe(0);
    });
});
