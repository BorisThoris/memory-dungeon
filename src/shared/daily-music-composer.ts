import type { RealmId } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * The day's music, composed for one player (2026-10-18). The owner's ask: "daily salt based unique
 * background music generation", per player and per day, replacing the realm loops. Nothing here
 * is recorded: from a salt - the player's own key and the date - this writes a piece for each realm,
 * note by note, and the renderer plays it through its instruments (`dailyMusicRender.ts`).
 *
 * The same salt always writes the same piece, so a player's day sounds the same every time they
 * come back to it and different from yesterday, and from anyone else's today.
 *
 * **It stays in the game's key.** The cascade's rising phrase climbs A, B, D and E
 * (`musicalScale.ts`), the notes the run music was measured to hold, so every mode here keeps
 * those four: Aeolian, Dorian, Mixolydian, Ionian and harmonic minor all do, on tonic A. A pop is
 * in tune with whatever the day composed.
 *
 * **How a piece is made**, the way a composer would sketch a loop for a level:
 *   - the realm sets the mood: tempo, mode, how busy the melody is, which voices play;
 *   - a progression of four chords, two bars each, played twice (sixteen bars, one loop), the
 *     second time with its last chord turned so the loop breathes rather than repeats;
 *   - the pad holds each chord, voice-led to the nearest inversion so it never jumps, over a pedal
 *     on A that keeps the key whatever the chord;
 *   - the bass walks the roots in the realm's rhythm;
 *   - the melody is a motif - a two-bar rhythm and a contour - stated, answered on the next chord,
 *     contrasted, and stated again with a new ending (A A' B A''), its strong beats on chord tones
 *     and its steps on the scale between;
 *   - an arpeggio or a bell line in the gaps, and on the busy realms a soft kit.
 */

/** Semitones above A for each mode: every one holds A, B, D and E (0, 2, 5, 7). */
export const DAILY_MUSIC_MODES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    ionian: [0, 2, 4, 5, 7, 9, 11],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11]
} as const;
export type DailyMusicMode = keyof typeof DAILY_MUSIC_MODES;

export type DailyMusicVoice = 'pad' | 'bass' | 'lead' | 'arp' | 'bell' | 'kick' | 'hat' | 'shaker' | 'rim';

export interface DailyMusicNote {
    /** Start, in beats from the top of the loop. */
    readonly beat: number;
    /** Length, in beats. */
    readonly length: number;
    /** MIDI note number (A4 = 69); percussion carries a nominal pitch. */
    readonly pitch: number;
    /** 0..1. */
    readonly velocity: number;
    readonly voice: DailyMusicVoice;
}

/** What the renderer needs to dress the notes: the realm's timbre. */
export type DailyMusicTimbre = 'warm' | 'glass' | 'reed' | 'wood' | 'electric';

export interface DailyMusicPiece {
    readonly salt: string;
    readonly realm: RealmId | 'run';
    readonly bpm: number;
    readonly mode: DailyMusicMode;
    readonly timbre: DailyMusicTimbre;
    /** The loop's length in beats (sixteen bars of four). */
    readonly loopBeats: number;
    /** The four chords, as scale degrees (0 = A). */
    readonly progression: readonly number[];
    readonly notes: readonly DailyMusicNote[];
}

interface RealmMood {
    readonly bpm: readonly [number, number];
    readonly modes: readonly DailyMusicMode[];
    readonly timbre: DailyMusicTimbre;
    /** How many melody onsets a two-bar motif carries, low and high. */
    readonly density: readonly [number, number];
    readonly arp: 'eighths' | 'sixteenths' | 'bells' | 'none';
    readonly kit: 'drive' | 'pulse' | 'shaker' | 'none';
}

/** Each realm's mood: the brief a composer would be handed for its level. */
const REALM_MOODS: Readonly<Record<RealmId | 'run', RealmMood>> = {
    ember: { bpm: [96, 108], modes: ['harmonicMinor', 'dorian'], timbre: 'warm', density: [5, 8], arp: 'eighths', kit: 'pulse' },
    tide: { bpm: [72, 84], modes: ['dorian', 'aeolian'], timbre: 'reed', density: [4, 6], arp: 'sixteenths', kit: 'shaker' },
    frost: { bpm: [64, 74], modes: ['aeolian', 'dorian'], timbre: 'glass', density: [3, 5], arp: 'bells', kit: 'none' },
    grove: { bpm: [84, 94], modes: ['mixolydian', 'ionian'], timbre: 'wood', density: [5, 7], arp: 'eighths', kit: 'shaker' },
    storm: { bpm: [104, 116], modes: ['harmonicMinor', 'aeolian'], timbre: 'electric', density: [6, 9], arp: 'sixteenths', kit: 'drive' },
    run: { bpm: [86, 96], modes: ['aeolian', 'dorian'], timbre: 'warm', density: [4, 7], arp: 'eighths', kit: 'pulse' }
};

/** Four-chord progressions as scale degrees, each a loop a player would not tire of. */
const PROGRESSIONS: readonly (readonly number[])[] = [
    [0, 5, 2, 6],
    [0, 3, 5, 4],
    [0, 6, 5, 6],
    [0, 3, 0, 4],
    [0, 2, 3, 4],
    [5, 3, 0, 4],
    [0, 5, 3, 4],
    [0, 4, 5, 3],
    [0, 6, 3, 4],
    [3, 4, 0, 0]
];

/** Two-bar melody rhythms: onsets in beats over eight beats, and the length each holds. */
const MOTIF_RHYTHMS: readonly (readonly (readonly [number, number])[])[] = [
    [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2], [4, 1], [5, 1], [6, 2]],
    [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1], [4, 3], [7, 1]],
    [[0, 0.5], [0.5, 0.5], [1, 1], [2, 2], [4, 0.5], [4.5, 0.5], [5, 1], [6, 2]],
    [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2]],
    [[0.5, 0.5], [1, 1], [2, 1.5], [3.5, 0.5], [4, 1], [5, 1], [6, 1.5], [7.5, 0.5]],
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4]],
    [[0, 3], [3, 1], [4, 1], [5, 1], [6, 2]],
    [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 2], [4, 0.75], [4.75, 0.75], [5.5, 0.5], [6, 2]]
];

const BEATS_PER_BAR = 4;
const BARS_PER_CHORD = 2;
const LOOP_BARS = 16;
/** A2, the bass's home: the tonic two octaves below A4. */
const BASS_TONIC = 45;
/** A3: the pad sits around here. */
const PAD_TONIC = 57;
/** A4: the melody's floor; it climbs about an octave above. */
const LEAD_TONIC = 69;

const pick = <T>(rng: () => number, items: readonly T[]): T => items[pickRngIndex(rng, items.length)]!;
const between = (rng: () => number, low: number, high: number): number => low + Math.floor(rng() * (high - low + 1));

/** The MIDI pitch of a scale degree (which may run past seven, into the next octave). */
export const degreePitch = (mode: readonly number[], degree: number, tonic: number): number => {
    const octave = Math.floor(degree / mode.length);
    const index = ((degree % mode.length) + mode.length) % mode.length;
    return tonic + octave * 12 + mode[index]!;
};

/** A triad on a degree: root, third, fifth, as degrees. */
const triadDegrees = (root: number): number[] => [root, root + 2, root + 4];

/** The pad voicing of a chord nearest the last one, so it moves by steps rather than leaps. */
const voiceLead = (mode: readonly number[], root: number, previous: readonly number[] | null): number[] => {
    const tones = triadDegrees(root).map((degree) => degreePitch(mode, degree, PAD_TONIC));
    const options = [0, 1, 2].map((inversion) => {
        const voiced = tones.map((pitch, index) => (index < inversion ? pitch + 12 : pitch)).sort((a, b) => a - b);
        // Keep the pad in its register: under A4.
        return voiced.map((pitch) => (pitch > 69 ? pitch - 12 : pitch)).sort((a, b) => a - b);
    });
    if (!previous) return options[0]!;
    const distance = (voicing: readonly number[]) => voicing.reduce((sum, pitch, index) => sum + Math.abs(pitch - (previous[index] ?? pitch)), 0);
    return options.reduce((best, voicing) => (distance(voicing) < distance(best) ? voicing : best));
};

/** The nearest scale degree to a target degree that is a chord tone of `root`. */
const nearestChordDegree = (root: number, degree: number): number => {
    const chord = triadDegrees(root);
    let best = degree;
    let bestDistance = Infinity;
    for (let candidate = degree - 4; candidate <= degree + 4; candidate += 1) {
        const pc = ((candidate % 7) + 7) % 7;
        if (!chord.some((tone) => ((tone % 7) + 7) % 7 === pc)) continue;
        const d = Math.abs(candidate - degree);
        if (d < bestDistance) {
            best = candidate;
            bestDistance = d;
        }
    }
    return best;
};

interface Motif {
    readonly rhythm: readonly (readonly [number, number])[];
    /** Scale steps between successive notes. */
    readonly contour: readonly number[];
}

const makeMotif = (rng: () => number, density: readonly [number, number]): Motif => {
    const candidates = MOTIF_RHYTHMS.filter((rhythm) => rhythm.length >= density[0] && rhythm.length <= density[1]);
    const rhythm = pick(rng, candidates.length > 0 ? candidates : MOTIF_RHYTHMS);
    const contour = rhythm.map((_, index) => (index === 0 ? 0 : pick(rng, [-2, -1, -1, 1, 1, 2, 0, 3, -3])));
    return { rhythm, contour };
};

/**
 * One statement of a motif over a chord, from a starting degree: strong beats land on chord
 * tones, the rest walk the scale, and the line stays inside an octave and a half of A4.
 */
const stateMotif = (
    motif: Motif,
    root: number,
    startDegree: number,
    beatOffset: number,
    mode: readonly number[],
    rng: () => number,
    { endingVariant = false }: { endingVariant?: boolean } = {}
): { notes: DailyMusicNote[]; lastDegree: number } => {
    const notes: DailyMusicNote[] = [];
    let degree = startDegree;
    motif.rhythm.forEach(([beat, length], index) => {
        let step = motif.contour[index] ?? 0;
        const last = index === motif.rhythm.length - 1;
        if (last && endingVariant) step = pick(rng, [-2, 2, -1, 1, -4]);
        degree += step;
        // Keep the melody between A4 and roughly E6.
        while (degree < 0) degree += 7;
        while (degree > 11) degree -= 7;
        const strong = beat % 2 === 0;
        if (strong || last) degree = nearestChordDegree(root, degree);
        // The snap can step past either edge; an octave back keeps it the same chord tone.
        while (degree < 0) degree += 7;
        while (degree > 11) degree -= 7;
        notes.push({
            beat: beatOffset + beat,
            length: length * 0.92,
            pitch: degreePitch(mode, degree, LEAD_TONIC),
            velocity: (strong ? 0.78 : 0.62) + rng() * 0.08,
            voice: 'lead'
        });
    });
    return { notes, lastDegree: degree };
};

/** The day's salt for one player: their own key and the day, so each player's day is their own. */
export const dailyMusicSalt = (playerKey: string, dateKey: string): string => `${playerKey}|${dateKey}`;

/** The local calendar date as YYYY-MM-DD: the player's day turns over at their own midnight. */
export const localDateKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Compose one realm's piece for the salt. Pure and deterministic. */
export const composeDailyPiece = (salt: string, realm: RealmId | 'run'): DailyMusicPiece => {
    const rng = createMulberry32(hashStringToSeed(`daily-music:${salt}:${realm}`));
    const mood = REALM_MOODS[realm];
    const bpm = between(rng, mood.bpm[0], mood.bpm[1]);
    const modeName = pick(rng, mood.modes);
    const mode = DAILY_MUSIC_MODES[modeName];
    const progression = pick(rng, PROGRESSIONS);
    const notes: DailyMusicNote[] = [];
    const chordBeats = BARS_PER_CHORD * BEATS_PER_BAR;
    const loopBeats = LOOP_BARS * BEATS_PER_BAR;
    // Sixteen bars: the progression twice; the second pass turns its last chord to the fourth or fifth.
    const turnaround = pick(rng, [3, 4]);
    const chords = [...progression, ...progression.slice(0, 3), progression[3] === turnaround ? 0 : turnaround];

    // Pad and bass.
    let previousVoicing: number[] | null = null;
    const bassPatterns: readonly (readonly [number, number, number])[][] = [
        [[0, 3, 0], [3, 1, 0], [4, 3, 0], [7, 1, 4]],
        [[0, 2, 0], [2, 2, 0], [4, 2, 0], [6, 2, 4]],
        [[0, 1.5, 0], [1.5, 1, 0], [2.5, 1.5, 0], [4, 1.5, 0], [5.5, 1, 4], [6.5, 1.5, 0]],
        [[0, 4, 0], [4, 4, 0]]
    ];
    const bassPattern = mood.kit === 'none' ? bassPatterns[3]! : pick(rng, bassPatterns.slice(0, 3));
    chords.forEach((root, index) => {
        const offset = index * chordBeats;
        const voicing = voiceLead(mode, root, previousVoicing);
        previousVoicing = voicing;
        for (const pitch of voicing) notes.push({ beat: offset, length: chordBeats, pitch, velocity: 0.5, voice: 'pad' });
        // A pedal on the tonic under every chord: the piece is in A whatever chord it is passing
        // through, and the cascade's A, B, D and E sit over it.
        notes.push({ beat: offset, length: chordBeats, pitch: PAD_TONIC - 12, velocity: 0.8, voice: 'pad' });
        for (const [beat, length, fifthUp] of bassPattern) {
            // Folded into the bass's octave: a high root plus its fifth would climb into the pad.
            let pitch = degreePitch(mode, root + fifthUp, BASS_TONIC);
            while (pitch > BASS_TONIC + 12) pitch -= 12;
            notes.push({ beat: offset + beat, length: length * 0.9, pitch, velocity: beat === 0 ? 0.85 : 0.7, voice: 'bass' });
        }
    });

    // The melody: A A' B A'' over the first eight bars, repeated over the second eight with the
    // second B taken an octave lighter (fewer notes) so the loop has an arc.
    const motifA = makeMotif(rng, mood.density);
    const motifB = makeMotif(rng, mood.density);
    let degree = pick(rng, [2, 4, 7]);
    const plan: readonly ['A' | 'B', boolean][] = [['A', false], ['A', true], ['B', false], ['A', true]];
    for (let pass = 0; pass < 2; pass += 1) {
        plan.forEach(([which, varied], index) => {
            const chordIndex = pass * 4 + index;
            const root = chords[chordIndex]!;
            const motif = which === 'A' ? motifA : motifB;
            const start = which === 'A' && !varied ? nearestChordDegree(root, pick(rng, [2, 4, 7])) : degree;
            const stated = stateMotif(motif, root, start, chordIndex * chordBeats, mode, rng, { endingVariant: varied });
            // The second pass's contrast breathes: every other note of B is left out.
            const kept = pass === 1 && which === 'B' ? stated.notes.filter((_, n) => n % 2 === 0) : stated.notes;
            notes.push(...kept);
            degree = stated.lastDegree;
        });
    }

    // Arpeggio or bells in the gaps, an octave over the pad.
    chords.forEach((root, index) => {
        const offset = index * chordBeats;
        const tones = triadDegrees(root).map((d) => degreePitch(mode, d, PAD_TONIC + 12));
        if (mood.arp === 'eighths' || mood.arp === 'sixteenths') {
            const step = mood.arp === 'eighths' ? 0.5 : 0.25;
            const order = pick(rng, [[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 0]]);
            for (let beat = 0, n = 0; beat < chordBeats; beat += step, n += 1) {
                notes.push({ beat: offset + beat, length: step * 1.6, pitch: tones[order[n % order.length]!]!, velocity: 0.3 + (n % 4 === 0 ? 0.12 : 0) + rng() * 0.05, voice: 'arp' });
            }
        } else if (mood.arp === 'bells') {
            for (const beat of [0, 3, 5.5]) {
                notes.push({ beat: offset + beat, length: 3, pitch: tones[pickRngIndex(rng, tones.length)]! + 12, velocity: 0.42 + rng() * 0.1, voice: 'bell' });
            }
        }
    });

    // The kit.
    if (mood.kit !== 'none') {
        for (let bar = 0; bar < LOOP_BARS; bar += 1) {
            const offset = bar * BEATS_PER_BAR;
            if (mood.kit === 'drive' || mood.kit === 'pulse') {
                notes.push({ beat: offset, length: 0.5, pitch: 36, velocity: 0.8, voice: 'kick' });
                notes.push({ beat: offset + 2, length: 0.5, pitch: 36, velocity: mood.kit === 'drive' ? 0.75 : 0.6, voice: 'kick' });
                if (mood.kit === 'drive') notes.push({ beat: offset + 2.5, length: 0.5, pitch: 36, velocity: 0.5, voice: 'kick' });
                notes.push({ beat: offset + 1, length: 0.25, pitch: 37, velocity: 0.4, voice: 'rim' });
                notes.push({ beat: offset + 3, length: 0.25, pitch: 37, velocity: 0.45, voice: 'rim' });
            }
            const hatStep = mood.kit === 'drive' ? 0.25 : 0.5;
            for (let beat = 0; beat < BEATS_PER_BAR; beat += hatStep) {
                notes.push({ beat: offset + beat, length: 0.1, pitch: 42, velocity: (beat % 1 === 0 ? 0.32 : 0.22) + rng() * 0.06, voice: mood.kit === 'shaker' ? 'shaker' : 'hat' });
            }
        }
    }

    notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
    return { salt, realm, bpm, mode: modeName, timbre: mood.timbre, loopBeats, progression, notes };
};
