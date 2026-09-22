import { beforeEach, describe, expect, it } from 'vitest';
import { chainMeter } from '../../shared/chain-tier-rules';
import {
    COMBO_MATCH_LADDER_STEPS,
    __resetComboVoicingForTests,
    comboFlipVoicing,
    comboMatchVoicing,
    comboMismatchVoicing,
    comboTierWeight
} from './comboVoicing';
import { isCascadeNote, semitoneHz } from './musicalScale';

describe('comboVoicing', () => {
    beforeEach(() => {
        __resetComboVoicingForTests();
    });

    it('climbs the in-key ladder one rung per consecutive match', () => {
        const steps = [1, 2, 3, 4, 5].map((chainDepth) => comboMatchVoicing({ chainDepth }).semitones);

        // A, B, D, E, A' - the set musicalScale measured out of the run loop, and the octave above.
        expect(steps).toEqual([0, 2, 5, 7, 12]);
        // Every rung is a note the cascade is allowed to play, not merely a rising number.
        for (const semitones of steps) {
            expect(isCascadeNote(semitoneHz(semitones))).toBe(true);
        }
    });

    it('restarts the ladder where the tier sample restarts', () => {
        /*
         * Depth 6 brings `match-tier-mid` with it: a different, bigger recording, which carries the
         * lift itself. Transposing the new sample as if it were the fifth rung of the old one would
         * stack two lifts and end the chain three octaves up.
         */
        const topOfLowTier = comboMatchVoicing({ chainDepth: 5, tierRootDepth: 1 });
        const bottomOfMidTier = comboMatchVoicing({ chainDepth: 6, tierRootDepth: 6 });

        expect(topOfLowTier.semitones).toBe(12);
        expect(bottomOfMidTier.semitones).toBe(0);
    });

    it('holds at the top rung rather than climbing out of the tier', () => {
        const beyond = comboMatchVoicing({ chainDepth: 14, tierRootDepth: 1 });

        expect(beyond.step).toBe(COMBO_MATCH_LADDER_STEPS - 1);
    });

    it('tapers the level as the ladder climbs, so a higher rung is not also a louder one', () => {
        // Reset between rungs so the round robin contributes the same trim to each and the taper
        // is the only thing left moving.
        const atRung = (chainDepth: number): number => {
            __resetComboVoicingForTests();
            return comboMatchVoicing({ chainDepth, tierRootDepth: 1 }).gainScale;
        };

        expect(atRung(5)).toBeLessThan(atRung(1));
        expect(atRung(5)).toBeCloseTo(atRung(1) * (1 - 4 * 0.03), 5);
    });

    it('unlocks layers on the meter, not on the streak number', () => {
        // Streak of two on a twelve-pair floor whose chunks have taken nine pairs: Fever.
        const hotMeter = comboMatchVoicing({ chainDepth: 2, meter: chainMeter(11, 12) });
        const coldMeter = comboMatchVoicing({ chainDepth: 2, meter: chainMeter(0, 12) });

        expect(hotMeter.layers).toEqual({ shimmer: true, body: true, tail: true });
        expect(coldMeter.layers).toEqual({ shimmer: false, body: false, tail: false });
    });

    it('falls back to the fixed rungs when no meter is passed', () => {
        // Exported cues get called with a bare depth from tests and from the cue-safety sweep.
        expect(comboMatchVoicing({ chainDepth: 1 }).tier).toBe('none');
        expect(comboMatchVoicing({ chainDepth: 3 }).tier).toBe('clean');
        expect(comboMatchVoicing({ chainDepth: 6 }).tier).toBe('sharp');
        expect(comboMatchVoicing({ chainDepth: 10 }).tier).toBe('fever');
    });

    it('never repeats a take back to back, and keeps the variation inside a fifth of a semitone', () => {
        const takes = [0, 1, 2, 3, 4, 5].map(() => comboMatchVoicing({ chainDepth: 1 }));
        const signatures = takes.map((take) => `${take.detuneCents}:${take.gainScale}`);

        expect(new Set(signatures).size).toBe(takes.length);
        for (const take of takes) {
            expect(Math.abs(take.detuneCents)).toBeLessThanOrEqual(20);
            expect(take.pitchRatio).toBeCloseTo(1, 1);
        }
        // Deterministic, so a cue can be asserted on: the rotation comes back around, it is not noise.
        __resetComboVoicingForTests();
        expect(comboMatchVoicing({ chainDepth: 1 }).detuneCents).toBe(takes[0]?.detuneCents);
    });

    it('keeps one rotation per cue family, so flips cannot mask two identical matches', () => {
        const first = comboMatchVoicing({ chainDepth: 1 }).detuneCents;
        comboFlipVoicing();
        comboFlipVoicing();
        comboFlipVoicing();
        const second = comboMatchVoicing({ chainDepth: 1 }).detuneCents;

        expect(second).not.toBe(first);
    });

    it('nudges the flip by one semitone a rung and gives it no layers', () => {
        const cold = comboFlipVoicing(chainMeter(0, 12));
        const fever = comboFlipVoicing(chainMeter(11, 12));

        expect(cold.semitones).toBe(0);
        expect(fever.semitones).toBe(comboTierWeight('fever'));
        expect(fever.semitones).toBe(3);
        expect(fever.layers).toEqual({ shimmer: false, body: false, tail: false });
    });

    it('drops the miss further the more chain it broke', () => {
        const cold = comboMismatchVoicing({ meter: chainMeter(0, 12) });
        const fever = comboMismatchVoicing({ meter: chainMeter(11, 12) });

        expect(cold.semitones).toBe(0);
        expect(fever.semitones).toBe(-6);
        // Transposing down stretches the take: a Fever break lasts half again as long as a cold miss.
        expect(1 / fever.pitchRatio).toBeGreaterThan(1.35);
        expect(fever.layers.body).toBe(true);
        expect(cold.layers.body).toBe(false);
    });

    it('survives depths that are not depths', () => {
        for (const chainDepth of [Number.NaN, Number.POSITIVE_INFINITY, -4, 0.5]) {
            const voicing = comboMatchVoicing({ chainDepth });
            expect(Number.isFinite(voicing.pitchRatio)).toBe(true);
            expect(voicing.pitchRatio).toBeGreaterThan(0);
        }
    });
});
