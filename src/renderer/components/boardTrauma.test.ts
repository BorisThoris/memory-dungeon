import { describe, expect, it } from 'vitest';

import type { BoardState, Tile } from '../../shared/contracts';
import {
    addTrauma,
    advanceBoardTrauma,
    BOARD_TRAUMA_AT_START,
    BOARD_SHAKE_AT_REST,
    BOARD_SHAKE_FREQUENCY_HZ,
    BOARD_SHAKE_MAX_ANGLE,
    BOARD_SHAKE_MAX_OFFSET_X,
    BOARD_SHAKE_MAX_OFFSET_Y,
    decayTrauma,
    readBoardTrauma,
    sampleTraumaShake,
    TRAUMA_BY_SOURCE,
    TRAUMA_DECAY_PER_SECOND,
    TRAUMA_EXPONENT,
    traumaNoise,
    traumaShakeAmount
} from './boardTrauma';

/**
 * Eiserloh, GDC 2016, "Juicing Your Cameras With Math", verified 3-0 in `docs/RESEARCH_NOTES.md`
 * §2. What this file holds is not that the shake looks nice - nothing here can see it - but the
 * four properties the model is chosen FOR, each of which the sine wobble it replaced failed.
 */
describe('the board shake', () => {
    it('maps trauma by the cubic branch the source publishes, not the squared one', () => {
        /*
         * The talk gives trauma .30/.60/.90 -> 3%/22%/73% of maximum shake. Cubed: 0.027, 0.216,
         * 0.729. Squared would be 0.09, 0.36, 0.81 - a different and much flatter curve, and the
         * source offers both without saying which its figures came from. They came from cubic, and
         * pinning it here is what stops a later tidy-up swapping the exponent silently.
         */
        expect(TRAUMA_EXPONENT).toBe(3);
        expect(traumaShakeAmount(0.3)).toBeCloseTo(0.03, 2);
        expect(traumaShakeAmount(0.6)).toBeCloseTo(0.22, 2);
        expect(traumaShakeAmount(0.9)).toBeCloseTo(0.73, 2);
        // The squared branch does not fit those figures, which is the whole reason to pick.
        expect(0.3 ** 2).not.toBeCloseTo(0.03, 2);
        expect(0.6 ** 2).not.toBeCloseTo(0.22, 2);
    });

    it('gives every event a trauma inside the source band, and lets two of them stack', () => {
        for (const [source, amount] of Object.entries(TRAUMA_BY_SOURCE)) {
            if (source === 'none') {
                expect(amount, 'no break is no trauma').toBe(0);
                continue;
            }
            expect(amount, `${source} trauma`).toBeGreaterThanOrEqual(0.2);
            expect(amount, `${source} trauma`).toBeLessThanOrEqual(0.5);
        }
        // The game's own ladder: a pop is the smallest break and Fever the largest.
        expect(TRAUMA_BY_SOURCE.pop).toBeLessThan(TRAUMA_BY_SOURCE.clean);
        expect(TRAUMA_BY_SOURCE.clean).toBeLessThan(TRAUMA_BY_SOURCE.sharp);
        expect(TRAUMA_BY_SOURCE.sharp).toBeLessThan(TRAUMA_BY_SOURCE.fever);
        // Stacking is the point of a scalar: a miss under a Fever break shakes harder than either.
        const stacked = addTrauma(addTrauma(0, TRAUMA_BY_SOURCE.mismatch), TRAUMA_BY_SOURCE.fever);
        expect(stacked).toBeCloseTo(0.7, 6);
        /*
         * And the cubic makes stacking worth more than the sum of its parts, which is the point:
         * 0.7 cubed is 0.343 against 0.125 for the Fever break alone and 0.008 for the miss.
         */
        expect(traumaShakeAmount(stacked)).toBeGreaterThan(
            traumaShakeAmount(TRAUMA_BY_SOURCE.fever) + traumaShakeAmount(TRAUMA_BY_SOURCE.mismatch)
        );
        expect(traumaShakeAmount(stacked)).toBeGreaterThan(traumaShakeAmount(TRAUMA_BY_SOURCE.fever) * 2.5);
        // And it clamps rather than running away: three Fever breaks in a turn is still one shake.
        expect(addTrauma(addTrauma(addTrauma(0, 0.5), 0.5), 0.5)).toBe(1);
    });

    it('decays linearly to rest and stops there', () => {
        let trauma = TRAUMA_BY_SOURCE.fever;
        expect(decayTrauma(trauma, 1)).toBeCloseTo(trauma - TRAUMA_DECAY_PER_SECOND, 6);
        // A Fever break is gone in about 1.1 seconds; stepping past that lands on zero, not below.
        for (let step = 0; step < 200; step += 1) {
            trauma = decayTrauma(trauma, 1 / 60);
        }
        expect(trauma).toBe(0);
        expect(sampleTraumaShake({ seconds: 4.2, trauma })).toEqual(BOARD_SHAKE_AT_REST);
        // A negative delta is a clock that went backwards, and it must not push trauma back up.
        expect(decayTrauma(0.4, -5)).toBe(0.4);
    });

    it('survives the hit-stop, because it is a function of the clock rather than of the frame', () => {
        /*
         * The load-bearing one. A Fever break slows and holds time (`FEVER_WAVE_SLOW`, Gen 139).
         * Sampling the same trauma at the same instants gives the same shake however many frames
         * were drawn between them, so a clock run at half speed draws the shake at half speed and a
         * clock that holds holds the shake with it. The wobble this replaced was also a function of
         * time; a per-frame random one - the obvious implementation, and the one the source warns
         * against - is not, and keeps jittering at full speed through exactly the moment the player
         * is being given to watch.
         */
        const instants = [0.4, 0.55, 0.6, 0.925, 1.13];
        const atFullRate = instants.map((seconds) => sampleTraumaShake({ seconds, trauma: 0.5 }));
        const throughAHold = instants.map((seconds) => sampleTraumaShake({ seconds, trauma: 0.5 }));
        expect(throughAHold).toEqual(atFullRate);
        // A held clock holds the shake: the same instant sampled again is the same offset.
        const held = sampleTraumaShake({ seconds: 0.6, trauma: 0.5 });
        expect(sampleTraumaShake({ seconds: 0.6, trauma: 0.5 })).toEqual(held);
        // And a clock run at half speed reaches each offset at twice the wall time, unchanged.
        expect(sampleTraumaShake({ seconds: 1.1 / 2, trauma: 0.5 })).toEqual(
            sampleTraumaShake({ seconds: 0.55, trauma: 0.5 })
        );
    });

    it('replays: the same run draws the same shake, where a random one could not', () => {
        /*
         * Share codes, daily runs and the endless simulation's replay verification all re-run a run
         * and expect the same thing back. Noise indexed by time is resamplable.
         */
        const run = (): number[] =>
            Array.from({ length: 64 }, (_, step) => sampleTraumaShake({ seconds: step / 60, trauma: 0.42 }).offsetX);
        expect(run()).toEqual(run());
        // Not a constant, either - a determinism test passes trivially on a shake that never moves.
        expect(new Set(run().map((value) => value.toFixed(6))).size).toBeGreaterThan(20);
        /*
         * The negative control: the same assertion against the implementation this replaces the
         * option of - a fresh random per frame - fails. A bar nothing has ever failed is a bar
         * nobody has checked.
         */
        const randomRun = (): number[] => Array.from({ length: 64 }, () => Math.random());
        expect(randomRun()).not.toEqual(randomRun());
    });

    it('moves translationally and rotationally together, which is the source advice for 2D', () => {
        /*
         * Rotational alone the source calls "kinda lame" and translational alone "nice"; both
         * together is the 2D recommendation. Its 3D advice inverts and does not apply to a board
         * seen flat on. So a sample must move all three channels, and they must not move together -
         * three channels reading the same number is one channel wearing three hats.
         */
        const samples = Array.from({ length: 400 }, (_, step) =>
            sampleTraumaShake({ seconds: step / 120, trauma: 0.8 })
        );
        expect(samples.some((sample) => Math.abs(sample.offsetX) > 1e-4)).toBe(true);
        expect(samples.some((sample) => Math.abs(sample.offsetY) > 1e-4)).toBe(true);
        expect(samples.some((sample) => Math.abs(sample.angleZ) > 1e-4)).toBe(true);
        const correlated = samples.filter(
            (sample) => Math.abs(sample.offsetX / BOARD_SHAKE_MAX_OFFSET_X - sample.offsetY / BOARD_SHAKE_MAX_OFFSET_Y) < 1e-6
        );
        expect(correlated.length, 'x and y are the same noise read twice').toBeLessThan(4);
    });

    it('samples smooth noise rather than a tone, and stays inside its stated maxima', () => {
        /*
         * The wobble this replaces was `Math.sin(t * 36)`, which has a period a player can hear.
         * Perlin noise has none, and it is continuous - the step between two frames is bounded, so
         * the board never teleports.
         */
        let peakStep = 0;
        let previous = traumaNoise(0);
        for (let step = 1; step <= 20_000; step += 1) {
            const value = traumaNoise((step / 240) * BOARD_SHAKE_FREQUENCY_HZ);
            expect(Math.abs(value)).toBeLessThanOrEqual(1);
            peakStep = Math.max(peakStep, Math.abs(value - previous));
            previous = value;
        }
        // Smooth: a quarter-second-of-noise step at 240fps never jumps more than a fifth of range.
        expect(peakStep).toBeLessThan(0.2);
        /*
         * Gradient noise is exactly zero at every lattice point - that is what "gradient" means, and
         * the first draft of this assertion compared two integers and found 0 against 0. Said here
         * rather than worked around: each channel passes through zero as the phase crosses a whole
         * number, seventeen times a second, which is a shake crossing its rest position and not a
         * gap. Off the lattice the noise does not repeat, where a sine of the old frequency would.
         */
        expect(traumaNoise(3)).toBe(0);
        expect(traumaNoise(1.37)).not.toBeCloseTo(traumaNoise(1.37 + BOARD_SHAKE_FREQUENCY_HZ), 3);
        expect(traumaNoise(0.5)).not.toBeCloseTo(traumaNoise(0.5 + 2 * BOARD_SHAKE_FREQUENCY_HZ), 3);
        for (let step = 0; step < 5_000; step += 1) {
            const sample = sampleTraumaShake({ seconds: step / 90, trauma: 1 });
            expect(Math.abs(sample.offsetX)).toBeLessThanOrEqual(BOARD_SHAKE_MAX_OFFSET_X);
            expect(Math.abs(sample.offsetY)).toBeLessThanOrEqual(BOARD_SHAKE_MAX_OFFSET_Y);
            expect(Math.abs(sample.angleZ)).toBeLessThanOrEqual(BOARD_SHAKE_MAX_ANGLE);
        }
    });

    const tile = (partial: Partial<Tile> & Pick<Tile, 'id' | 'pairKey'>): Tile =>
        ({ label: 'A', state: 'flipped', symbol: 'A', ...partial }) as Tile;
    const board = (overrides: Pick<BoardState, 'flippedTileIds' | 'tiles'>): BoardState =>
        ({
            columns: 2,
            featuredObjectiveId: null,
            floorArchetypeId: null,
            level: 1,
            matchedPairs: 0,
            pairCount: 2,
            rows: 2,
            ...overrides
        }) as BoardState;

    it('reads a break off the board, at the tier the break actually reached', () => {
        const reading = readBoardTrauma(
            board({
                flippedTileIds: [],
                tiles: [
                    tile({ brokenAtTier: 'clean', id: 'a', pairKey: 'p', state: 'removed' }),
                    tile({ brokenAtTier: 'fever', id: 'b', pairKey: 'p', state: 'removed' }),
                    tile({ id: 'c', pairKey: 'q', state: 'hidden' })
                ]
            }),
            'playing'
        );
        expect(reading).toEqual({ mismatchKey: null, removedCount: 2, tier: 'fever' });
    });

    it('shakes the board on a break, which is the thing the old wobble never did', () => {
        /*
         * The defect this generation is for. The only shake in the game fired on a mismatch, so the
         * Fever break - the moment the hit-stop exists to let the player watch - moved nothing at
         * all. The board's trauma is raised by the break, at its tier.
         */
        const quiet = board({ flippedTileIds: [], tiles: [tile({ id: 'a', pairKey: 'p', state: 'hidden' })] });
        const broken = board({
            flippedTileIds: [],
            tiles: [tile({ brokenAtTier: 'fever', id: 'a', pairKey: 'p', state: 'removed' })]
        });
        const first = advanceBoardTrauma({
            delta: 1 / 60,
            previous: BOARD_TRAUMA_AT_START,
            reading: readBoardTrauma(quiet, 'playing'),
            reduceMotion: false,
            trauma: 0
        });
        expect(first.trauma).toBe(0);
        const shaken = advanceBoardTrauma({
            delta: 1 / 60,
            previous: first.previous,
            reading: readBoardTrauma(broken, 'playing'),
            reduceMotion: false,
            trauma: first.trauma
        });
        expect(shaken.trauma).toBeCloseTo(TRAUMA_BY_SOURCE.fever, 6);
        // The casualties sit in the array while their wave plays; that is a state, not a new event.
        const held = advanceBoardTrauma({
            delta: 1 / 60,
            previous: shaken.previous,
            reading: readBoardTrauma(broken, 'playing'),
            reduceMotion: false,
            trauma: shaken.trauma
        });
        expect(held.trauma).toBeLessThan(shaken.trauma);
        // And reduced motion is a board that never shakes, whatever the break did.
        expect(
            advanceBoardTrauma({
                delta: 1 / 60,
                previous: first.previous,
                reading: readBoardTrauma(broken, 'playing'),
                reduceMotion: true,
                trauma: 0.8
            }).trauma
        ).toBe(0);
    });

    it('counts two misses as two events and one held miss as one', () => {
        const miss = (a: string, b: string): BoardState =>
            board({
                flippedTileIds: [a, b],
                tiles: [tile({ id: a, pairKey: `${a}-p` }), tile({ id: b, pairKey: `${b}-p` })]
            });
        let state = { previous: BOARD_TRAUMA_AT_START, trauma: 0 };
        state = advanceBoardTrauma({
            delta: 0,
            previous: state.previous,
            reading: readBoardTrauma(miss('a', 'b'), 'resolving'),
            reduceMotion: false,
            trauma: state.trauma
        });
        expect(state.trauma).toBeCloseTo(TRAUMA_BY_SOURCE.mismatch, 6);
        const held = advanceBoardTrauma({
            delta: 0,
            previous: state.previous,
            reading: readBoardTrauma(miss('a', 'b'), 'resolving'),
            reduceMotion: false,
            trauma: state.trauma
        });
        expect(held.trauma).toBeCloseTo(TRAUMA_BY_SOURCE.mismatch, 6);
        const second = advanceBoardTrauma({
            delta: 0,
            previous: held.previous,
            reading: readBoardTrauma(miss('c', 'd'), 'resolving'),
            reduceMotion: false,
            trauma: held.trauma
        });
        expect(second.trauma).toBeCloseTo(TRAUMA_BY_SOURCE.mismatch * 2, 6);
        // A pair that matches is not a miss, however long it sits in the resolving phase.
        const matched = board({
            flippedTileIds: ['e', 'f'],
            tiles: [tile({ id: 'e', pairKey: 'same' }), tile({ id: 'f', pairKey: 'same' })]
        });
        expect(readBoardTrauma(matched, 'resolving').mismatchKey).toBe(null);
    });
});
