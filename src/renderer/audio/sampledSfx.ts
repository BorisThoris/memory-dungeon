/**
 * Runtime OGG one-shots under `assets/audio/sfx/` (see manifest.json).
 * When files are absent or decode fails, `gameSfx` procedural tones run unchanged.
 */

import sfxManifest from '../assets/audio/sfx/manifest.json';
import { buildAudioUrlMapByFilename } from './audioGlobUrlMap';
import { sfxManifestSchema } from './audioManifestBoundary';
import { preloadAudioBuffers } from './preloadAudioBuffers';
import { getSharedAudioContext } from './webAudioContext';

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'shuffle';

export type SfxSampleKey = keyof typeof sfxManifest.entries;

const manifest = sfxManifestSchema.parse(sfxManifest);

export const SFX_SAMPLE_KEYS = [
    'flip',
    'gambitCommit',
    'match-tier-low',
    'match-tier-mid',
    'match-tier-high',
    'mismatch',
    'power-arm',
    'peek-power',
    'shuffle-full',
    'shuffle-quick',
    'floor-clear'
] as const satisfies readonly SfxSampleKey[];

export const MATCH_TIER_SAMPLE_KEYS = [
    'match-tier-low',
    'match-tier-mid',
    'match-tier-high'
] as const satisfies readonly SfxSampleKey[];

const globUrls = import.meta.glob<string>('../assets/audio/sfx/*.ogg', {
    eager: true,
    query: '?url',
    import: 'default'
});
const urlsByFilename = buildAudioUrlMapByFilename(globUrls);

const MAX_POLYPHONY: Record<SfxCategory, number> = {
    flip: 5,
    match: 4,
    mismatch: 4,
    power: 5,
    shuffle: 4
};

interface SampleVoice {
    category: SfxCategory;
    stop: () => void;
    startTime: number;
}

const buffers = new Map<SfxSampleKey, AudioBuffer>();
let preloadStarted = false;

const activeSampleVoices: SampleVoice[] = [];

const removeSampleVoice = (voice: SampleVoice): void => {
    const i = activeSampleVoices.indexOf(voice);
    if (i >= 0) {
        activeSampleVoices.splice(i, 1);
    }
};

const stopSampleVoice = (voice: SampleVoice): void => {
    try {
        voice.stop();
    } catch {
        /* noop */
    }
    removeSampleVoice(voice);
};

const stealOldestSampleInCategory = (category: SfxCategory): void => {
    const cap = MAX_POLYPHONY[category];
    let inCat = activeSampleVoices.filter((v) => v.category === category);
    while (inCat.length >= cap) {
        inCat.sort((a, b) => a.startTime - b.startTime);
        const oldest = inCat[0];
        if (!oldest) {
            break;
        }
        stopSampleVoice(oldest);
        inCat = activeSampleVoices.filter((v) => v.category === category);
    }
};

/**
 * Transposes the take, and returns the playback rate the caller needs to rescale the envelope by.
 *
 * Every branch here is a real one. `playbackRate` and `detune` are non-optional in lib.dom, but the
 * Vitest doubles and the hostile-context sweep build buffer sources out of bare object literals, and
 * a cue that throws on a missing param is a cue that takes the tile press with it (`audioSafety.ts`).
 */
function applySampleVoicing(src: AudioBufferSourceNode, voicing: SampledVoicing | undefined): number {
    const semitones = Number.isFinite(voicing?.semitones) ? (voicing?.semitones ?? 0) : 0;
    const cents = Number.isFinite(voicing?.detuneCents) ? (voicing?.detuneCents ?? 0) : 0;
    if (semitones === 0 && cents === 0) {
        return 1;
    }
    const detuneParam = src.detune as AudioParam | undefined;
    const centsOnTheNode = detuneParam != null && typeof detuneParam.value === 'number';
    if (centsOnTheNode && detuneParam != null) {
        detuneParam.value = cents;
    }
    const rateParam = src.playbackRate as AudioParam | undefined;
    if (rateParam == null || typeof rateParam.value !== 'number') {
        // Nothing to transpose with: the take plays as recorded, so do not rescale its envelope.
        return 1;
    }
    const rate = 2 ** ((semitones * 100 + (centsOnTheNode ? 0 : cents)) / 1200);
    rateParam.value = rate;
    // `detune` multiplies the rate rather than replacing it, so the audible rate is both together.
    return rate * 2 ** ((centsOnTheNode ? cents : 0) / 1200);
}

function urlForFilename(filename: string): string | undefined {
    return urlsByFilename.get(filename);
}

/**
 * How a combo-voiced cue asks for a transposed take of a sample.
 *
 * `detuneCents` rides on top of `semitones` through the source node’s own `detune` param when
 * the implementation has one, and is folded into the playback rate when it does not — older Web
 * Audio builds and every test double in this repo are in the second group.
 */
export interface SampledVoicing {
    semitones?: number;
    detuneCents?: number;
}

/** Lowest chain depth this tier sample covers: where the combo ladder restarts (see comboVoicing). */
export function matchTierRootDepth(key: SfxSampleKey): number {
    const ranges = manifest.matchTierDepthRanges as Record<string, readonly [number, number] | undefined>;
    return ranges[key]?.[0] ?? 1;
}

/** Map consecutive-match streak depth to one of three tier samples (see manifest matchTierDepthRanges). */
export function resolveMatchTierSampleKey(chainDepth: number): SfxSampleKey {
    const t = Math.max(1, Math.min(chainDepth, 14));
    const ranges = manifest.matchTierDepthRanges;
    for (const key of MATCH_TIER_SAMPLE_KEYS) {
        const [lo, hi] = ranges[key];
        if (t >= lo && t <= hi) {
            return key;
        }
    }
    return 'match-tier-low';
}

export function tryPlaySampled(key: SfxSampleKey, gain: number, voicing?: SampledVoicing): boolean {
    if (import.meta.env.MODE === 'test') {
        return false;
    }
    if (gain <= 0.001) {
        return false;
    }
    const buf = buffers.get(key);
    if (!buf) {
        return false;
    }

    const ctx = getSharedAudioContext();
    if (!ctx) {
        return false;
    }

    const meta = manifest.entries[key];
    if (!meta) {
        return false;
    }

    stealOldestSampleInCategory(meta.category);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const rate = applySampleVoicing(src, voicing);
    // Transposing a sample moves its length with its pitch: an octave up is half as long. The
    // envelope and the stop time follow, or a lifted cue gets its tail cut and a dropped one is
    // silenced before it finishes.
    const dur = buf.duration / rate;
    const t0 = ctx.currentTime;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * 0.35, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(g);
    g.connect(ctx.destination);

    const voice: SampleVoice = {
        category: meta.category,
        startTime: t0,
        stop: (): void => {
            try {
                src.stop();
            } catch {
                /* already stopped */
            }
            try {
                src.disconnect();
                g.disconnect();
            } catch {
                /* noop */
            }
            removeSampleVoice(voice);
        }
    };

    activeSampleVoices.push(voice);
    src.addEventListener('ended', () => {
        removeSampleVoice(voice);
    });

    src.start(t0);
    src.stop(t0 + dur + 0.02);

    globalThis.setTimeout(() => {
        removeSampleVoice(voice);
    }, dur * 1000 + 120);

    return true;
}

let preloadPromise: Promise<void> | null = null;

/**
 * Loads and decodes every game sound once. The run's loading screen waits on this
 * (`preloadRunAssets`), and the first sound played still calls it: both get the same promise, so
 * nothing is fetched twice and nothing is fetched mid-play.
 */
export function preloadSampledSfx(): Promise<void> {
    if (import.meta.env.MODE === 'test') {
        return Promise.resolve();
    }
    if (!preloadPromise) {
        preloadStarted = true;
        preloadPromise = loadSampledSfx().catch(() => {
            preloadPromise = null;
        });
    }
    return preloadPromise;
}

async function loadSampledSfx(): Promise<void> {

    const ctx = getSharedAudioContext();
    if (!ctx) {
        return;
    }

    const loaded = await preloadAudioBuffers({
        decode: (arrayBuffer) => ctx.decodeAudioData(arrayBuffer),
        keys: [...SFX_SAMPLE_KEYS],
        urlForKey: (key) => {
            const file = manifest.entries[key]?.file;
            return file ? urlForFilename(file) : undefined;
        }
    });

    buffers.clear();
    loaded.forEach((ab, k) => {
        buffers.set(k, ab);
    });
}

/** Fire-and-forget preload once (e.g. after user gesture resumes audio). */
export function maybePreloadSampledSfx(): void {
    if (import.meta.env.MODE === 'test') {
        return;
    }
    if (preloadStarted) {
        return;
    }
    void preloadSampledSfx();
}

export function silenceAllSampleVoices(): void {
    while (activeSampleVoices.length > 0) {
        const v = activeSampleVoices[0];
        if (v) {
            stopSampleVoice(v);
        }
    }
}

export function resetSampledSfxForTests(): void {
    silenceAllSampleVoices();
    buffers.clear();
    preloadStarted = false;
    preloadPromise = null;
}
