/**
 * Focused UI/menu one-shots. Uses runtime OGG samples with procedural fallback,
 * sharing the same AudioContext and SFX gain semantics as gameplay audio.
 */

import uiSfxManifest from '../assets/audio/ui/manifest.json';
import { preloadAudioBuffers } from './preloadAudioBuffers';
import {
    getSharedAudioContext,
    resetSharedAudioContextForTests,
    resumeSharedAudioContext
} from './webAudioContext';

type UiSfxCategory = 'ui' | 'menu';
type ManifestEntry = { file: string; category: UiSfxCategory };

type UiSfxSampleKey = keyof typeof uiSfxManifest.entries;

const manifest = uiSfxManifest as {
    version: number;
    entries: Record<UiSfxSampleKey, ManifestEntry>;
};

const globUrls = import.meta.glob<string>('../assets/audio/ui/*.ogg', {
    eager: true,
    query: '?url',
    import: 'default'
});
const urlsByFilename = new Map(Object.entries(globUrls).map(([path, url]) => [path.replace(/^.*\//, ''), url]));

const MAX_POLYPHONY: Record<UiSfxCategory, number> = {
    ui: 5,
    menu: 3
};

interface SampleVoice {
    category: UiSfxCategory;
    stop: () => void;
    startTime: number;
}

const buffers = new Map<UiSfxSampleKey, AudioBuffer>();
let preloadStarted = false;
const activeSampleVoices: SampleVoice[] = [];

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const uiSfxGainFromSettings = (masterVolume: number, sfxVolume: number): number =>
    clamp01(masterVolume) * clamp01(sfxVolume);

export type UiSfxCue =
    | 'click'
    | 'confirm'
    | 'back'
    | 'counter'
    | 'menuOpen'
    | 'runStart'
    | 'introSting'
    | 'pauseOpen'
    | 'pauseResume'
    | 'gameOverOpen'
    | 'copy';

export const __resetUiSfxEngineForTests = (): void => {
    silenceAllUiSampleVoices();
    buffers.clear();
    preloadStarted = false;
    resetSharedAudioContextForTests();
};

export const uiSfxSampleKeyForCue = (cue: UiSfxCue): UiSfxSampleKey => {
    switch (cue) {
        case 'click':
            return 'ui-click';
        case 'confirm':
            return 'ui-confirm';
        case 'back':
            return 'ui-back';
        case 'counter':
            return 'ui-counter';
        case 'menuOpen':
            return 'menu-open';
        case 'runStart':
            return 'run-start';
        case 'introSting':
            return 'intro-sting';
        case 'pauseOpen':
            return 'pause-open';
        case 'pauseResume':
            return 'pause-resume';
        case 'gameOverOpen':
            return 'game-over-open';
        case 'copy':
            return 'ui-copy';
    }
};

export const resumeUiSfxContext = (): void => {
    resumeSharedAudioContext();
    maybePreloadUiSfx();
};

function urlForFilename(filename: string): string | undefined {
    return urlsByFilename.get(filename);
}

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

const stealOldestSampleInCategory = (category: UiSfxCategory): void => {
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

function tryPlayUiSampled(key: UiSfxSampleKey, gain: number): boolean {
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
    g.gain.exponentialRampToValueAtTime(gain * 0.32, t0 + 0.01);
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
    src.addEventListener('ended', () => removeSampleVoice(voice));
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    globalThis.setTimeout(() => removeSampleVoice(voice), dur * 1000 + 120);

    return true;
}

export async function preloadUiSfx(): Promise<void> {
    if (import.meta.env.MODE === 'test') {
        return;
    }
    const ctx = getSharedAudioContext();
    if (!ctx) {
        return;
    }
    const loaded = await preloadAudioBuffers({
        decode: (arrayBuffer) => ctx.decodeAudioData(arrayBuffer),
        keys: Object.keys(manifest.entries) as UiSfxSampleKey[],
        urlForKey: (key) => {
            const file = manifest.entries[key]?.file;
            return file ? urlForFilename(file) : undefined;
        }
    });
    buffers.clear();
    loaded.forEach((ab, key) => buffers.set(key, ab));
}

export function maybePreloadUiSfx(): void {
    if (import.meta.env.MODE === 'test') {
        return;
    }
    if (preloadStarted) {
        return;
    }
    preloadStarted = true;
    void preloadUiSfx().catch(() => undefined);
}

export function silenceAllUiSampleVoices(): void {
    while (activeSampleVoices.length > 0) {
        const v = activeSampleVoices[0];
        if (v) {
            stopSampleVoice(v);
        }
    }
}

const playTone = (
    key: UiSfxSampleKey,
    gain: number,
    options: { frequency: number; frequencyEnd?: number; durationSec: number; type: OscillatorType }
): void => {
    if (gain <= 0.001) {
        silenceAllUiSampleVoices();
        return;
    }
    if (tryPlayUiSampled(key, gain)) {
        return;
    }
    const ctx = getSharedAudioContext();
    if (!ctx) {
        return;
    }
    const meta = manifest.entries[key];
    stealOldestSampleInCategory(meta.category);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    osc.type = options.type;
    osc.frequency.setValueAtTime(options.frequency, t0);
    if (options.frequencyEnd != null && options.frequencyEnd !== options.frequency) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.frequencyEnd), t0 + options.durationSec);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * 0.28, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + options.durationSec);
    osc.connect(g);
    g.connect(ctx.destination);

    const voice: SampleVoice = {
        category: meta.category,
        startTime: t0,
        stop: (): void => {
            try {
                osc.stop();
            } catch {
                /* already stopped */
            }
            try {
                osc.disconnect();
                g.disconnect();
            } catch {
                /* noop */
            }
            removeSampleVoice(voice);
        }
    };
    activeSampleVoices.push(voice);
    osc.addEventListener?.('ended', () => removeSampleVoice(voice));
    globalThis.setTimeout(() => removeSampleVoice(voice), options.durationSec * 1000 + 120);

    osc.start(t0);
    osc.stop(t0 + options.durationSec + 0.02);
};

export const playUiCue = (
    cue: UiSfxCue,
    gain: number,
    options: { frequency: number; frequencyEnd?: number; durationSec: number; type: OscillatorType }
): void => playTone(uiSfxSampleKeyForCue(cue), gain, options);

export const playUiClickSfx = (gain: number): void =>
    playUiCue('click', gain, { frequency: 620, durationSec: 0.04, type: 'sine' });

export const playUiConfirmSfx = (gain: number): void =>
    playUiCue('confirm', gain, {
        frequency: 520,
        frequencyEnd: 760,
        durationSec: 0.09,
        type: 'triangle'
    });

export const playUiBackSfx = (gain: number): void =>
    playUiCue('back', gain, {
        frequency: 360,
        frequencyEnd: 240,
        durationSec: 0.08,
        type: 'sine'
    });

export const playUiCounterSfx = (gain: number): void =>
    playUiCue('counter', gain, { frequency: 860, durationSec: 0.035, type: 'sine' });

export const playMenuOpenSfx = (gain: number): void =>
    playUiCue('menuOpen', gain, {
        frequency: 280,
        frequencyEnd: 540,
        durationSec: 0.16,
        type: 'triangle'
    });

export const playRunStartSfx = (gain: number): void =>
    playUiCue('runStart', gain, {
        frequency: 220,
        frequencyEnd: 620,
        durationSec: 0.22,
        type: 'triangle'
    });

export const playIntroStingSfx = (gain: number): void =>
    playUiCue('introSting', gain, {
        frequency: 280,
        frequencyEnd: 880,
        durationSec: 0.24,
        type: 'triangle'
    });

export const playPauseOpenSfx = (gain: number): void =>
    playUiCue('pauseOpen', gain, {
        frequency: 340,
        frequencyEnd: 260,
        durationSec: 0.12,
        type: 'triangle'
    });

export const playPauseResumeSfx = (gain: number): void =>
    playUiCue('pauseResume', gain, {
        frequency: 410,
        frequencyEnd: 690,
        durationSec: 0.12,
        type: 'triangle'
    });

export const playGameOverOpenSfx = (gain: number): void =>
    playUiCue('gameOverOpen', gain, {
        frequency: 210,
        frequencyEnd: 132,
        durationSec: 0.2,
        type: 'sawtooth'
    });

export const playUiCopySfx = (gain: number): void =>
    playUiCue('copy', gain, {
        frequency: 760,
        frequencyEnd: 980,
        durationSec: 0.08,
        type: 'sine'
    });
