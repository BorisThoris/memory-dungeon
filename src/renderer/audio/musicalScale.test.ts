import { describe, expect, it } from 'vitest';

import {
    A4_HZ,
    CASCADE_PITCH_CLASSES,
    CHAIN_MILESTONE_SEMITONES,
    CHUNK_BREAK_ROOT_SEMITONES,
    cascadeNoteHz,
    chunkBreakNoteHz,
    isCascadeNote,
    RUN_MUSIC_KEY,
    semitoneHz
} from './musicalScale';

/**
 * The cascade's phrase, against what the run loop was measured to contain.
 *
 * Peggle 2's audio team say a cascade feels musical because each hit is the next step of a scale
 * that harmonises with the music (`docs/RESEARCH_NOTES.md` §2). What this replaces was
 * `720 + index * 46` Hz, and the difference is not a matter of taste: every note of the old phrase
 * missed every note the music plays, and that can be said with a number.
 */
describe('the cascade against the run music', () => {
    it('plays notes the music plays, where the ramp it replaces played none of them', () => {
        const phrase = Array.from({ length: 9 }, (_, index) => chunkBreakNoteHz(index));
        expect(phrase.every((hz) => isCascadeNote(hz))).toBe(true);
        /*
         * The negative control, and it is total: the linear ramp's nine notes land on ZERO of them.
         * Not "mostly off" - none, because a straight line through frequency space cannot stay on a
         * logarithmic grid.
         */
        const linearRamp = Array.from({ length: 9 }, (_, index) => 720 + index * 46);
        expect(linearRamp.filter((hz) => isCascadeNote(hz))).toEqual([]);
    });

    it('climbs the whole way and never repeats a note', () => {
        const phrase = Array.from({ length: 9 }, (_, index) => chunkBreakNoteHz(index));
        for (let index = 1; index < phrase.length; index += 1) {
            expect(phrase[index]!, `step ${index}`).toBeGreaterThan(phrase[index - 1]!);
            const cents = 1200 * Math.log2(phrase[index]! / phrase[index - 1]!);
            /*
             * The three gaps this set has: a tone (A-B, D-E), a minor third (B-D) and the fourth
             * that carries it into the next octave (E-A). Never a microtone, which is the whole
             * complaint against the ramp - its gaps were 107, 101, 96 and 75 cents, none of them an
             * interval anything plays.
             */
            expect([200, 300, 500], `step ${index} was ${cents.toFixed(0)} cents`).toContain(Math.round(cents));
        }
        expect(new Set(phrase.map((hz) => hz.toFixed(2))).size).toBe(phrase.length);
        // Four notes to the octave, so nine pairs climb two: A4 to A6.
        expect(chunkBreakNoteHz(0)).toBeCloseTo(440, 1);
        expect(chunkBreakNoteHz(8)).toBeCloseTo(1760, 1);
    });

    it('uses only what the measurement is confident in, and says what it will not decide', () => {
        /*
         * The loop's third is a tie - C and C# both at 0.0737 of the chroma - so a seven-note scale
         * would mean picking a side and calling it measurement. The set is A, B, D, E: shared by
         * both candidate keys, clear of the contested third and of a seventh the loop barely plays.
         */
        expect(RUN_MUSIC_KEY.tonic).toBe('A');
        expect(RUN_MUSIC_KEY.thirdIsAmbiguous).toBe(true);
        expect([...CASCADE_PITCH_CLASSES]).toEqual([0, 2, 5, 7]);
        // The contested third, either way, is not in the set.
        expect(CASCADE_PITCH_CLASSES).not.toContain(3);
        expect(CASCADE_PITCH_CLASSES).not.toContain(4);
        // Nor is the seventh the loop does not play, either way.
        expect(CASCADE_PITCH_CLASSES).not.toContain(10);
        expect(CASCADE_PITCH_CLASSES).not.toContain(11);
        expect(CHUNK_BREAK_ROOT_SEMITONES).toBe(0);
    });

    it('puts the three chain milestones on notes the loop plays, not on the one it does not', () => {
        /*
         * 1360, 1680 and 1960 Hz were near E6, G#6 and B6. G# is the pitch class this loop has least
         * of at 0.008 - the middle rung was the one note in the piece that is not in the piece.
         */
        const milestones = Object.values(CHAIN_MILESTONE_SEMITONES).map((semitones) => semitoneHz(semitones));
        expect(milestones.every((hz) => isCascadeNote(hz))).toBe(true);
        expect(milestones).toEqual([...milestones].sort((a, b) => a - b));
        expect(isCascadeNote(1680), 'the G#6 it replaces').toBe(false);
        // And they stay in the register they had, rather than moving the sound under cover of a fix.
        expect(milestones[0]).toBeGreaterThan(1200);
        expect(milestones[2]).toBeLessThan(2100);
    });

    it('knows what is not a cascade note, so the check is not just saying yes', () => {
        for (const absent of RUN_MUSIC_KEY.absentPitchClasses) {
            const semitones = { 'D#': 6, G: 10, 'G#': 11 }[absent] ?? 0;
            expect(isCascadeNote(semitoneHz(semitones)), `${absent} is not a cascade note`).toBe(false);
        }
        // A quarter-tone off a note is off it.
        expect(isCascadeNote(A4_HZ * 2 ** (1 / 24))).toBe(false);
        // Nonsense is not a note.
        expect(isCascadeNote(0)).toBe(false);
        expect(isCascadeNote(Number.NaN)).toBe(false);
        // The walker stays on the grid from every note of the set.
        for (const start of CASCADE_PITCH_CLASSES) {
            expect(isCascadeNote(cascadeNoteHz(start, 3)), `from semitone ${start}`).toBe(true);
        }
    });
});
