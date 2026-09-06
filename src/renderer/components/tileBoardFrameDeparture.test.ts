import { describe, expect, it } from 'vitest';
import { BREAK_DEPARTURE_SECONDS, computeTileBoardMatchedBurstState } from './tileBoardFramePulseState';

/**
 * A removed tile has to actually leave. Before this, `removed` was a state the scene had no
 * opinion about: the card sat there face-up, unpickable, and a chunk break looked like a bug.
 */
describe('a removed tile departs', () => {
    const step = (time: number, startedAt: number | null, wasMatched: boolean, delay = 0) =>
        computeTileBoardMatchedBurstState({
            breakWaveDelaySec: delay,
            reduceMotion: false,
            startedAt,
            tileState: 'removed',
            time,
            wasMatched
        });

    it('waits for the wave, bursts, then scales away to nothing', () => {
        const armed = step(10, null, false, 0.2);
        expect(armed.burst).toBe(0);
        expect(armed.departure).toBe(0);
        expect(armed.startedAt).toBeCloseTo(10.2);

        const bursting = step(10.25, armed.startedAt, true);
        expect(bursting.burst).toBeGreaterThan(0);
        expect(bursting.departure).toBe(0);

        const gone = step(10.2 + 0.2 + BREAK_DEPARTURE_SECONDS + 0.05, armed.startedAt, true);
        expect(gone.departure).toBe(1);
        expect(gone.startedAt).toBeNull();
    });

    it('stays gone once it has left, across later frames', () => {
        expect(step(99, null, true).departure).toBe(1);
    });

    it('never departs a matched tile', () => {
        const matched = computeTileBoardMatchedBurstState({
            reduceMotion: false,
            startedAt: 5,
            tileState: 'matched',
            time: 9,
            wasMatched: true
        });
        expect(matched.departure).toBe(0);
    });
});
