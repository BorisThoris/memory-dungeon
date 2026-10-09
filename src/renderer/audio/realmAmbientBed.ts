import type { RealmId } from '../../shared/contracts';
import { audioNeverThrows } from './audioSafety';
import { getSharedAudioContext } from './webAudioContext';

/**
 * The realm under everything (2026-10-01): a quiet, continuous weather bed while a realm holds the
 * board. Rain hiss in the tide, wind in the frost, a fire's roar and flutter in the ember, distant
 * rumble in the storm, leaves stirring in the grove. The events (`playRealmEventSfx`) are the
 * weather striking; this is the weather being there. Procedural noise through a filter, swelling on
 * a slow LFO, so nothing new is loaded and nothing streams. It crossfades when an omen turns the
 * realm and fades out when the floor ends.
 */

interface BedLayer {
    filter: BiquadFilterType;
    frequency: number;
    q: number;
    /** Share of the bed's level. */
    level: number;
    /** The swell: how fast (Hz) and how deep (0..1). */
    lfoHz: number;
    lfoDepth: number;
}

export const REALM_BED_LAYERS: Readonly<Record<RealmId, readonly BedLayer[]>> = {
    tide: [
        { filter: 'highpass', frequency: 2400, q: 0.5, level: 0.8, lfoHz: 0.13, lfoDepth: 0.35 },
        { filter: 'lowpass', frequency: 260, q: 0.7, level: 0.5, lfoHz: 0.09, lfoDepth: 0.6 }
    ],
    frost: [{ filter: 'bandpass', frequency: 600, q: 0.8, level: 1, lfoHz: 0.08, lfoDepth: 0.6 }],
    ember: [
        { filter: 'lowpass', frequency: 260, q: 0.8, level: 1.6, lfoHz: 0.2, lfoDepth: 0.3 },
        { filter: 'bandpass', frequency: 1900, q: 0.7, level: 0.6, lfoHz: 3.2, lfoDepth: 0.5 }
    ],
    storm: [
        { filter: 'lowpass', frequency: 140, q: 0.7, level: 3, lfoHz: 0.07, lfoDepth: 0.8 },
        { filter: 'highpass', frequency: 5200, q: 0.7, level: 0.2, lfoHz: 0.31, lfoDepth: 0.9 }
    ],
    grove: [{ filter: 'bandpass', frequency: 3200, q: 0.8, level: 0.6, lfoHz: 0.23, lfoDepth: 0.75 }]
};

/**
 * Off until the owner has heard it (2026-10-01: the first bed buzzed, its noise generator cycling).
 * `setRealmAmbientBed` takes it as a parameter so the tests still walk the bed itself.
 */
export const REALM_BED_ENABLED = false;

/** The bed's ceiling against the SFX gain: under the turn cues, never over them. */
export const REALM_BED_LEVEL = 0.028;

/**
 * A realm's recorded loop is not played here (2026-10-09): it is the run music now, on the music
 * element (`gameplayMusic.ts`, `realmMusicUrl`), so the settings' music volume governs it. This bed
 * is only the generated noise, still off (`REALM_BED_ENABLED`).
 */
const FADE_IN_SEC = 1.6;
const FADE_OUT_SEC = 1.2;

interface PlayingBed {
    realm: RealmId;
    master: GainNode;
    stop: () => void;
}

let current: PlayingBed | null = null;
let currentLevel = 0;
let bedNoise: AudioBuffer | null = null;

const noise = (ctx: AudioContext): AudioBuffer => {
    if (bedNoise && bedNoise.sampleRate === ctx.sampleRate) return bedNoise;
    // Two seconds, so the loop seam is not a pulse.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x2545f491 | 0;
    for (let i = 0; i < data.length; i += 1) {
        // xorshift32 on 32-bit integers: a multiply-and-add on a float loses precision and cycles (the
        // bed's old generator repeated every 4,235 samples, an 11 Hz buzz instead of noise).
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    bedNoise = buffer;
    return buffer;
};

const startBed = (ctx: AudioContext, realm: RealmId, level: number): PlayingBed => {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), ctx.currentTime + FADE_IN_SEC);
    master.connect(ctx.destination);
    const sources: AudioScheduledSourceNode[] = [];
    for (const layer of REALM_BED_LAYERS[realm]) {
        const source = ctx.createBufferSource();
        source.buffer = noise(ctx);
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = layer.filter;
        filter.frequency.value = layer.frequency;
        filter.Q.value = layer.q;
        const swell = ctx.createGain();
        swell.gain.value = layer.level * (1 - layer.lfoDepth / 2);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = layer.lfoHz;
        const depth = ctx.createGain();
        depth.gain.value = (layer.level * layer.lfoDepth) / 2;
        lfo.connect(depth);
        depth.connect(swell.gain);
        source.connect(filter);
        filter.connect(swell);
        swell.connect(master);
        // Each layer starts at its own point in the loop so two layers never pulse together.
        source.start(ctx.currentTime, sources.length * 0.7);
        lfo.start(ctx.currentTime);
        sources.push(source, lfo);
    }
    return {
        realm,
        master,
        stop: () => {
            const end = ctx.currentTime + FADE_OUT_SEC;
            master.gain.cancelScheduledValues(ctx.currentTime);
            master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime);
            master.gain.exponentialRampToValueAtTime(0.0001, end);
            for (const source of sources) {
                try {
                    source.stop(end + 0.05);
                } catch {
                    // Already stopped.
                }
            }
            globalThis.setTimeout(() => {
                try {
                    master.disconnect();
                } catch {
                    // Already gone.
                }
            }, (FADE_OUT_SEC + 0.2) * 1000);
        }
    };
};

/**
 * Hold the bed for `realm` at `strength` (0..1) under the SFX `gain`, or stop it with a null realm or
 * a muted gain. Idempotent: the same realm only re-levels; a new one crossfades.
 */
export const setRealmAmbientBed = (realm: RealmId | null, strength: number, gain: number, enabled = REALM_BED_ENABLED): void =>
    audioNeverThrows(() => {
        const level = realm && enabled ? gain * REALM_BED_LEVEL * (0.6 + 0.4 * Math.max(0, Math.min(1, strength))) : 0;
        if (!realm || level <= 0.0005) {
            current?.stop();
            current = null;
            currentLevel = 0;
            return;
        }
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (current && current.realm === realm) {
            if (Math.abs(level - currentLevel) > 0.0005) {
                current.master.gain.cancelScheduledValues(ctx.currentTime);
                current.master.gain.setValueAtTime(Math.max(0.0001, current.master.gain.value), ctx.currentTime);
                current.master.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 0.4);
                currentLevel = level;
            }
            return;
        }
        current?.stop();
        current = startBed(ctx, realm, level);
        currentLevel = level;
    });
