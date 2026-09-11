/**
 * What is the run music actually made of? Run: yarn audit:music-key [--check]
 *
 * `src/renderer/audio/musicalScale.ts` builds the cascade's rising phrase out of four pitch classes
 * it says the loop is confident in. A claim about an asset is exactly the kind that rots the day
 * somebody swaps the asset: the music would change and the cascade would go on climbing the old
 * notes, sounding worse than the linear ramp it replaced, with nothing anywhere saying why. So the
 * chroma is re-derived from the file rather than remembered - sixty-four windows, a Goertzel filter
 * per pitch class across five octaves, each window normalised by its own peak so the loudest bar
 * does not decide alone.
 *
 * **What this check holds is what the measurement can bear.** It does NOT hold "A minor", because
 * the loop does not settle that: C and C# tie at 0.0737 and the Krumhansl-Schmuckler correlation
 * flips between A major and A minor with the window size. It holds the three things that are stable
 * under both analyses - the tonic is A, every pitch class the cascade plays is present in the loop,
 * and the ones it calls absent really are. A checker that asserted the key would have gone red on a
 * window-size change and told us nothing about the music.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isCascadeNote, RUN_MUSIC_KEY, semitoneHz } from '../src/renderer/audio/musicalScale';

export const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Krumhansl-Schmuckler key profiles: the tone-duration weights a listener reports per degree. */
export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface DecodedAudio {
    channels: number;
    sampleRate: number;
    samples: Float64Array;
}

/** Minimal 16-bit PCM WAV reader: enough for the two loops this repository ships, and nothing more. */
export const readPcmWav = (bytes: Buffer): DecodedAudio => {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('not a RIFF/WAVE file');
    }
    let offset = 12;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let data: Buffer | null = null;
    while (offset + 8 <= bytes.length) {
        const id = bytes.toString('ascii', offset, offset + 4);
        const size = bytes.readUInt32LE(offset + 4);
        const body = bytes.subarray(offset + 8, offset + 8 + size);
        if (id === 'fmt ') {
            channels = body.readUInt16LE(2);
            sampleRate = body.readUInt32LE(4);
            bitsPerSample = body.readUInt16LE(14);
        } else if (id === 'data') {
            data = body;
        }
        offset += 8 + size + (size % 2);
    }
    if (!data || bitsPerSample !== 16 || channels < 1) {
        throw new Error(`unsupported wav: ${bitsPerSample}-bit, ${channels}ch`);
    }
    const frames = Math.floor(data.length / (2 * channels));
    const samples = new Float64Array(frames);
    for (let frame = 0; frame < frames; frame += 1) {
        let sum = 0;
        for (let channel = 0; channel < channels; channel += 1) {
            sum += data.readInt16LE((frame * channels + channel) * 2);
        }
        samples[frame] = sum / channels;
    }
    return { channels, sampleRate, samples };
};

/** Energy at one frequency, without a full transform: the classic single-bin filter. */
export const goertzelEnergy = (block: Float64Array, sampleRate: number, frequency: number): number => {
    const k = Math.round((block.length * frequency) / sampleRate);
    const coeff = 2 * Math.cos((2 * Math.PI * k) / block.length);
    let s1 = 0;
    let s2 = 0;
    for (const sample of block) {
        const s0 = sample + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
    }
    return s1 * s1 + s2 * s2 - coeff * s1 * s2;
};

export const chromaOf = (audio: DecodedAudio, windows = 64): number[] => {
    const decimate = Math.max(1, Math.floor(audio.sampleRate / 11_025));
    const rate = audio.sampleRate / decimate;
    const signal = new Float64Array(Math.floor(audio.samples.length / decimate));
    for (let i = 0; i < signal.length; i += 1) {
        signal[i] = audio.samples[i * decimate] ?? 0;
    }
    const windowSize = Math.max(256, Math.floor(signal.length / windows));
    const chroma = new Array(12).fill(0);
    for (let start = 0; start + windowSize <= signal.length; start += windowSize) {
        const block = signal.subarray(start, start + windowSize);
        let peak = 0;
        for (const sample of block) {
            peak = Math.max(peak, Math.abs(sample));
        }
        if (peak === 0) {
            continue;
        }
        const scaled = new Float64Array(block.length);
        for (let i = 0; i < block.length; i += 1) {
            scaled[i] = (block[i] ?? 0) / peak;
        }
        for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
            for (let octave = 2; octave <= 6; octave += 1) {
                const frequency = 440 * 2 ** ((pitchClass - 9) / 12 + (octave - 4));
                if (frequency < rate / 2.2) {
                    chroma[pitchClass] += goertzelEnergy(scaled, rate, frequency);
                }
            }
        }
    }
    const total = chroma.reduce((sum, value) => sum + value, 0) || 1;
    return chroma.map((value) => value / total);
};

const correlate = (a: readonly number[], b: readonly number[]): number => {
    const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
    const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
    let num = 0;
    let devA = 0;
    let devB = 0;
    for (let i = 0; i < a.length; i += 1) {
        num += ((a[i] ?? 0) - meanA) * ((b[i] ?? 0) - meanB);
        devA += ((a[i] ?? 0) - meanA) ** 2;
        devB += ((b[i] ?? 0) - meanB) ** 2;
    }
    const den = Math.sqrt(devA * devB);
    return den === 0 ? 0 : num / den;
};

export interface KeyEstimate {
    label: string;
    score: number;
}

export const estimateKey = (chroma: readonly number[]): KeyEstimate[] => {
    const rows: KeyEstimate[] = [];
    for (let root = 0; root < 12; root += 1) {
        const rotated = [...chroma.slice(root), ...chroma.slice(0, root)];
        rows.push({ label: `${PITCH_CLASS_NAMES[root]} major`, score: correlate(rotated, MAJOR_PROFILE) });
        rows.push({ label: `${PITCH_CLASS_NAMES[root]} minor`, score: correlate(rotated, MINOR_PROFILE) });
    }
    return rows.sort((a, b) => b.score - a.score);
};

/** A pitch class the cascade plays has to be one the loop actually plays. */
export const CASCADE_PRESENCE_FLOOR = 0.04;
/** A pitch class this file calls absent has to be quieter than the quietest one the cascade uses. */
export const ABSENT_CEILING = 0.025;

export interface MusicKeyIssue {
    detail: string;
    rule: string;
}

export const judgeMusicKey = (chroma: readonly number[]): MusicKeyIssue[] => {
    const issues: MusicKeyIssue[] = [];
    const share = (name: string): number => chroma[PITCH_CLASS_NAMES.indexOf(name as never)] ?? 0;
    const loudest = [...chroma.keys()].sort((a, b) => (chroma[b] ?? 0) - (chroma[a] ?? 0))[0] ?? 0;
    if (PITCH_CLASS_NAMES[loudest] !== RUN_MUSIC_KEY.tonic) {
        issues.push({
            detail: `loudest pitch class is ${PITCH_CLASS_NAMES[loudest]}, declared tonic is ${RUN_MUSIC_KEY.tonic}`,
            rule: 'tonic'
        });
    }
    /*
     * Which pitch classes count as cascade notes is asked of `isCascadeNote` rather than read off
     * the constant beside it: the audio decides what it plays by calling that predicate, so the
     * check has to agree with the predicate and not with a list that could drift from it.
     */
    for (let semitones = 0; semitones < 12; semitones += 1) {
        if (!isCascadeNote(semitoneHz(semitones))) {
            continue;
        }
        const name = PITCH_CLASS_NAMES[(PITCH_CLASS_NAMES.indexOf('A') + semitones) % 12] ?? '';
        if (share(name) < CASCADE_PRESENCE_FLOOR) {
            issues.push({
                detail: `${name} is ${share(name).toFixed(4)} of the chroma, under ${CASCADE_PRESENCE_FLOOR}`,
                rule: 'cascade note present'
            });
        }
    }
    for (const name of RUN_MUSIC_KEY.absentPitchClasses) {
        if (share(name) > ABSENT_CEILING) {
            issues.push({
                detail: `${name} is ${share(name).toFixed(4)} of the chroma, over ${ABSENT_CEILING}`,
                rule: 'absent stays absent'
            });
        }
    }
    return issues;
};

export const RUN_LOOP_WAV = 'src/renderer/assets/audio/music/run-loop.wav';

const main = (): void => {
    const audio = readPcmWav(readFileSync(resolve(process.cwd(), RUN_LOOP_WAV)));
    const chroma = chromaOf(audio);
    process.stdout.write(
        `${RUN_LOOP_WAV}: ${audio.channels}ch ${audio.sampleRate}Hz ${(audio.samples.length / audio.sampleRate).toFixed(1)}s\n\n`
    );
    const order = [...chroma.keys()].sort((a, b) => (chroma[b] ?? 0) - (chroma[a] ?? 0));
    for (const pitchClass of order) {
        const share = chroma[pitchClass] ?? 0;
        const used = isCascadeNote(semitoneHz((pitchClass - PITCH_CLASS_NAMES.indexOf('A') + 12) % 12));
        process.stdout.write(
            `  ${(PITCH_CLASS_NAMES[pitchClass] ?? '').padEnd(3)} ${share.toFixed(4)}${used ? '  <- cascade plays this' : ''}\n`
        );
    }
    const ranked = estimateKey(chroma);
    process.stdout.write('\nkey correlation (reported, never asserted - the third is a tie):\n');
    for (const row of ranked.slice(0, 3)) {
        process.stdout.write(`  ${row.label.padEnd(9)} r=${row.score.toFixed(3)}\n`);
    }
    const issues = judgeMusicKey(chroma);
    if (issues.length > 0) {
        process.stdout.write(`\nThe music moved:\n${issues.map((issue) => `- ${issue.rule}: ${issue.detail}`).join('\n')}\n`);
    }
    if (process.argv.includes('--check')) {
        if (issues.length > 0) {
            process.stderr.write('Music key check failed: the cascade builds its phrase out of these notes\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('\nMusic key check passed\n');
    }
};

if (process.argv[1]?.includes('music-key')) {
    main();
}
