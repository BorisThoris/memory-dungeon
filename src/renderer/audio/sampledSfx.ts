/**
 * Optional OGG/WAV one-shots under `assets/audio/sfx/` (see manifest.json).
 * When files are absent or decode fails, `gameSfx` procedural tones run unchanged.
 */

import sfxManifest from '../assets/audio/sfx/manifest.json';
import { preloadAudioBuffers } from './preloadAudioBuffers';
import { getSharedAudioContext } from './webAudioContext';

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'pressure' | 'shuffle';

type ManifestEntry = { file: string; category: SfxCategory };

export type SfxSampleKey = keyof typeof sfxManifest.entries;

const manifest = sfxManifest as {
    version: number;
    entries: Record<SfxSampleKey, ManifestEntry>;
    matchTierDepthRanges: Record<'match-tier-low' | 'match-tier-mid' | 'match-tier-high', [number, number]>;
};

const globUrls = import.meta.glob<string>('../assets/audio/sfx/*.{ogg,wav}', {
    eager: true,
    query: '?url',
    import: 'default'
});
const urlsByFilename = new Map(Object.entries(globUrls).map(([path, url]) => [path.replace(/^.*\//, ''), url]));

const MAX_POLYPHONY: Record<SfxCategory, number> = {
    flip: 5,
    match: 4,
    mismatch: 4,
    power: 5,
    pressure: 1,
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

function urlForFilename(filename: string): string | undefined {
    return urlsByFilename.get(filename);
}

/** Map consecutive-match streak depth to one of three tier samples (see manifest matchTierDepthRanges). */
export function resolveMatchTierSampleKey(chainDepth: number): SfxSampleKey {
    const t = Math.max(1, Math.min(chainDepth, 14));
    const ranges = manifest.matchTierDepthRanges;
    const entries = Object.entries(ranges) as [SfxSampleKey, [number, number]][];
    for (const [key, [lo, hi]] of entries) {
        if (t >= lo && t <= hi) {
            return key;
        }
    }
    return 'match-tier-low';
}

export function tryPlaySampled(key: SfxSampleKey, gain: number): boolean {
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
    const dur = buf.duration;
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

export async function preloadSampledSfx(): Promise<void> {
    if (import.meta.env.MODE === 'test') {
        return;
    }

    const ctx = getSharedAudioContext();
    if (!ctx) {
        return;
    }

    const loaded = await preloadAudioBuffers({
        decode: (arrayBuffer) => ctx.decodeAudioData(arrayBuffer),
        keys: Object.keys(manifest.entries) as SfxSampleKey[],
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
    preloadStarted = true;
    void preloadSampledSfx().catch(() => undefined);
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
}
