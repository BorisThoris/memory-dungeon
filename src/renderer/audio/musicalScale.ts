/**
 * The notes the cascade is allowed to play, and how the run music was asked what they are.
 *
 * Peggle 2's audio team (Audio Gang, verified 3-0 in `docs/RESEARCH_NOTES.md` §2) describe what
 * makes a cascade feel musical rather than merely loud: successive hits play the next step of an
 * ASCENDING SCALE, and the scale harmonises with the music. This game raised pitch per pair from
 * Gen 124 and it was not a scale - the break's notes were `720 + index * 46` Hz, a straight line
 * through frequency space. In musical terms those steps run 107 cents, then 101, then 96, down to
 * 75 by the ninth: every interval a different size, and - measured against the key below - **none
 * of the nine landing on a note of it**. Each note also glided from 720 to 1080 while the next one
 * started, so the phrase was nine overlapping sirens rather than nine notes.
 *
 * **What the music turned out to be, and what it did not.** `run-loop.wav` was analysed over its
 * full 24 seconds - `yarn audit:music-key`, which re-derives this rather than remembering it. The
 * chroma, normalised per window so the loudest bar does not decide the key alone:
 *
 *   A 0.300   D 0.170   F 0.096   E 0.095   C# 0.074   C 0.074
 *   F# 0.073  B 0.046   A# 0.041  G 0.019   G# 0.008   D# 0.006
 *
 * The tonic is **A**, decisively, with D close behind it. What the measurement will NOT settle is
 * whether the piece is A major or A minor: **C and C# tie exactly, at 0.0737 each**, and the
 * Krumhansl-Schmuckler correlation flips between the two depending on the window size - A minor
 * 0.792 against A major 0.775 under one analysis, A major 0.782 against A minor 0.716 under
 * another. The third is genuinely ambiguous in this loop. The seventh is not ambiguous, it is
 * missing: G 0.019 and G# 0.008 are the two quietest pitch classes but for D#.
 *
 * **So the phrase is built from the notes the measurement is confident about: A, B, D and E.** They
 * are shared by both candidate keys, they avoid the contested third and the absent seventh
 * entirely, and A-B-D-E is a consonant frame over A major, A minor, and over D if the loop is
 * really in D. Choosing a full seven-note scale would have meant picking a side in a tie and
 * calling it measurement.
 *
 * **The cost, said plainly:** four notes to the octave means a nine-pair break climbs two octaves,
 * so the phrase now opens at A4 (440Hz) where the ramp opened at 720Hz. Most breaks are two to
 * four pairs and those now sound LOWER than before, with only the long ones climbing past where
 * the ramp ended. That follows from using only notes the measurement stands behind, and it is a
 * better trade than a phrase that is in tune with a key the file might not be in.
 *
 * **What this does NOT do**, and why the task behind it stays open: the source's second half is
 * that the scale re-keys when the music's phrase turns, mid-cascade, while still climbing. The run
 * music is one 24-second loop played through an audio element (`gameplayMusic.ts`) - no phrases, no
 * stems, no matrix. Keying to a phrase means re-authoring the score as phrase chunks crossed with
 * instrument stems, which is an asset job. A fixed set is the whole of what can be true while the
 * music is a loop, and saying so beats a `currentPhrase` parameter that would always answer the same.
 */

/** A4, the anchor every frequency here is derived from. */
export const A4_HZ = 440;

/**
 * The pitch classes the measurement is confident in, as semitones above A: A, B, D, E. Not a scale
 * - deliberately. A scale would have to commit to a third the file does not commit to.
 */
export const CASCADE_PITCH_CLASSES: readonly number[] = [0, 2, 5, 7];

/** What the analysis settles and what it does not, so the checker can hold the right claim. */
export const RUN_MUSIC_KEY = {
    /** Decisive: A is 0.300 of the chroma against D's 0.170 and nothing else over 0.10. */
    tonic: 'A',
    /** C and C# tie at 0.0737: the loop does not say whether it is major or minor. */
    thirdIsAmbiguous: true,
    /** G 0.019 and G# 0.008 - whichever the third is, the seventh is not being played. */
    absentPitchClasses: ['G', 'G#', 'D#'],
    pitchClasses: CASCADE_PITCH_CLASSES
} as const;

/** Equal temperament, from A4. */
export const semitoneHz = (semitonesFromA4: number): number => A4_HZ * 2 ** (semitonesFromA4 / 12);

/**
 * The `step`-th note up the confident set from `startSemitonesFromA4`, which must itself be one of
 * them. Steps past the set wrap into the next octave, so a nine-note phrase keeps climbing rather
 * than running out at the fourth note.
 */
export const cascadeNoteHz = (startSemitonesFromA4: number, step: number): number => {
    const set = CASCADE_PITCH_CLASSES;
    const startIndex = set.indexOf(((startSemitonesFromA4 % 12) + 12) % 12);
    const startOctave = Math.floor(startSemitonesFromA4 / 12);
    const index = (startIndex < 0 ? 0 : startIndex) + Math.max(0, Math.floor(step));
    const octave = startOctave + Math.floor(index / set.length);
    return semitoneHz(octave * 12 + (set[((index % set.length) + set.length) % set.length] ?? 0));
};

/** Whether a frequency is one of the notes the cascade may play, within a cent or two. */
export const isCascadeNote = (hz: number, centsTolerance = 5): boolean => {
    if (!(hz > 0)) {
        return false;
    }
    const semitones = 12 * Math.log2(hz / A4_HZ);
    const nearest = Math.round(semitones);
    if (Math.abs(semitones - nearest) * 100 > centsTolerance) {
        return false;
    }
    return CASCADE_PITCH_CLASSES.includes(((nearest % 12) + 12) % 12);
};

/** Where the break's phrase starts: A4, the tonic, low enough that nine pairs climb without shrieking. */
export const CHUNK_BREAK_ROOT_SEMITONES = 0;

/** The note the `index`-th pair of a break plays: the next note up the set, every time. */
export const chunkBreakNoteHz = (index: number): number => cascadeNoteHz(CHUNK_BREAK_ROOT_SEMITONES, index);

/**
 * The three chain milestones, ascending through the same set near the register they already used:
 * E6 1319, A6 1760, B6 1976, against the 1360, 1680 and 1960 they replace. The middle one is the
 * reason to bother - 1680Hz is G#6, and G# is the pitch class this loop has least of (0.008).
 */
export const CHAIN_MILESTONE_SEMITONES = { chain: 19, surge: 24, combo: 26 } as const;
