import type { RealmEvent, RunState } from '../../shared/contracts';
import { runArray } from '../../shared/run-array-guards';
import { runFiniteNumber, runNonNegativeInteger } from '../../shared/run-number-guards';
import { TILE_TRAIT_COUNT_KINDS } from '../../shared/session-stats-rules';
import { getChainMilestoneFeedback, type ChainMilestoneFeedback } from '../copy/chainMilestoneFeedback';
import { runChainMeter, runChainTier, type ChainMeter, type ChainTier } from '../../shared/chain-tier-rules';
import { comboHeatLevels } from '../../shared/combo-heat-rules';
import { CHAIN_MILESTONE_SEMITONES, cascadeNoteHz, chunkBreakNoteHz } from './musicalScale';
import {
    comboFlipVoicing,
    comboMatchVoicing,
    comboMismatchVoicing,
    __resetComboVoicingForTests,
    type ComboVoicing
} from './comboVoicing';
import { audioNeverThrows, audioNeverThrowsBoolean } from './audioSafety';
import {
    matchTierRootDepth,
    maybePreloadSampledSfx,
    resolveMatchTierSampleKey,
    resetSampledSfxForTests,
    silenceAllSampleVoices,
    tryPlaySampled as tryPlaySampledUnguarded,
    type SampledVoicing,
    type SfxSampleKey
} from './sampledSfx';
import {
    getSharedAudioContext,
    resetSharedAudioContextForTests,
    resumeSharedAudioContext
} from './webAudioContext';

/**
 * Gameplay SFX: sampled OGG (`assets/audio/sfx/`) with procedural Web Audio fallback.
 * Call `resumeAudioContext()` once after a user gesture if the browser suspended the context.
 *
 * Resolve tones (`playResolveSfx`) fire when **`applyResolveBoardTurn` runs** (after `resolveRemainingMs`, or
 * immediately if resolve delay is zero), not on the second tile flip. Flip tones (`playFlipSfx`) fire on flip.
 */

/** Clears scheduling state between Vitest cases (Web Audio singleton otherwise sticks to the first mock). */
export const __resetGameSfxEngineForTests = (): void => {
    silenceAllVoices();
    silenceAllSampleVoices();
    resetSampledSfxForTests();
    resetSharedAudioContextForTests();
    __resetComboVoicingForTests();
    noiseBuffer = null;
};

const getAudioContext = getSharedAudioContext;

export const resumeAudioContext = (): void => {
    audioNeverThrows(() => {
        resumeSharedAudioContext();
        maybePreloadSampledSfx();
    });
};

/** Every cue in this module goes through these two, so no cue can throw into a click handler. */
const tryPlaySampled = (
    key: Parameters<typeof tryPlaySampledUnguarded>[0],
    gain: number,
    voicing?: SampledVoicing
): boolean => audioNeverThrowsBoolean(() => tryPlaySampledUnguarded(key, gain, voicing));

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Effective linear gain from settings (0-1 each). */
export const sfxGainFromSettings = (masterVolume: number, sfxVolume: number): number =>
    clamp01(masterVolume) * clamp01(sfxVolume);

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'shuffle' | 'realm';
type ChainOpportunityBeatSfxTier = 'cashout' | 'follow-up' | 'route' | 'setup' | 'surge';
type MismatchRecoveryCrescendoSfxTier = 'break' | 'recover' | 'risk' | 'trait-surge';
type MatchPayoffSfxPayload = {
    cascadeCue?: { tier: 'chain' | 'combo' | 'reward' } | null;
    impactCue?: { label: string } | null;
    payoffLaneMap?: readonly { count: number }[] | null;
    payoffSummary?: { label: string; tier: 'chain' | 'combo' | 'reward' | 'score'; value: string } | null;
    rewardBurst?: { label: string; tier: 'mega' | 'single' | 'stack' } | null;
};

interface ScheduledVoice {
    category: SfxCategory;
    gain: GainNode;
    /** An oscillator, or a noise buffer for the realm's weather (`playNoise`). */
    osc: AudioScheduledSourceNode;
    startTime: number;
}

/** Max simultaneous one-shots per category (cascade bursts steal the oldest voice). */
const MAX_POLYPHONY: Record<SfxCategory, number> = {
    flip: 5,
    match: 4,
    mismatch: 4,
    power: 5,
    shuffle: 4,
    realm: 16
};

const activeVoices: ScheduledVoice[] = [];
const pendingCues = new Set<ReturnType<typeof globalThis.setTimeout>>();

/** Queued notes belong to the current audio session, just like voices already playing. */
const scheduleCue = (cue: () => void, delayMs: number): void => {
    const timer = globalThis.setTimeout(() => {
        pendingCues.delete(timer);
        cue();
    }, delayMs);
    pendingCues.add(timer);
};

const removeVoice = (voice: ScheduledVoice): void => {
    const i = activeVoices.indexOf(voice);
    if (i >= 0) {
        activeVoices.splice(i, 1);
    }
};

const stopVoice = (voice: ScheduledVoice): void => {
    // A realm voice (noise mostly) is faded out, not cut: cutting a noise source mid-swell clicks.
    if (voice.category === 'realm') {
        try {
            const now = voice.gain.context.currentTime;
            voice.gain.gain.cancelScheduledValues(now);
            voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
            voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
            voice.osc.stop(now + 0.02);
        } catch {
            /* already stopped */
        }
        removeVoice(voice);
        return;
    }
    try {
        voice.osc.stop();
    } catch {
        /* already stopped */
    }
    try {
        voice.osc.disconnect();
        voice.gain.disconnect();
    } catch {
        /* ignore */
    }
    removeVoice(voice);
};

const stealOldestInCategory = (category: SfxCategory): void => {
    const cap = MAX_POLYPHONY[category];
    let inCat = activeVoices.filter((v) => v.category === category);
    while (inCat.length >= cap) {
        inCat.sort((a, b) => a.startTime - b.startTime);
        const oldest = inCat[0];
        if (!oldest) {
            break;
        }
        stopVoice(oldest);
        inCat = activeVoices.filter((v) => v.category === category);
    }
};

const silenceAllVoices = (): void => {
    for (const timer of pendingCues) {
        globalThis.clearTimeout(timer);
    }
    pendingCues.clear();
    while (activeVoices.length > 0) {
        const v = activeVoices[0];
        if (v) {
            stopVoice(v);
        }
    }
};

interface ToneOptions {
    frequency: number;
    durationSec: number;
    gain: number;
    type: OscillatorType;
    frequencyEnd?: number;
    category: SfxCategory;
}

const playTone = (options: ToneOptions): void => audioNeverThrows(() => playToneUnguarded(options));

const playToneUnguarded = (options: ToneOptions): void => {
    if (options.gain <= 0.001) {
        silenceAllVoices();
        silenceAllSampleVoices();
        return;
    }
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }
    stealOldestInCategory(options.category);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = options.type;
    osc.frequency.setValueAtTime(options.frequency, ctx.currentTime);
    if (options.frequencyEnd != null && options.frequencyEnd !== options.frequency) {
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.frequencyEnd),
            ctx.currentTime + options.durationSec
        );
    }
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(options.gain * 0.35, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + options.durationSec);
    osc.connect(g);
    g.connect(ctx.destination);
    const voice: ScheduledVoice = {
        category: options.category,
        osc,
        gain: g,
        startTime: ctx.currentTime
    };
    activeVoices.push(voice);
    const cleanupMs = (options.durationSec + 0.05) * 1000;
    osc.addEventListener('ended', () => {
        removeVoice(voice);
    });
    globalThis.setTimeout(() => {
        removeVoice(voice);
    }, cleanupMs + 50);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + options.durationSec + 0.02);
};

/** One second of white noise, made once: the weather's wind, fire, rain and thunder are filtered from it. */
let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b9 | 0;
    for (let i = 0; i < data.length; i += 1) {
        // xorshift32 on 32-bit integers: a multiply-and-add on a float loses precision and cycles (the
        // bed's old generator repeated every 4,235 samples, an 11 Hz buzz instead of noise).
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    noiseBuffer = buffer;
    return buffer;
};

interface NoiseOptions {
    durationSec: number;
    gain: number;
    filter: BiquadFilterType;
    /** The filter's sweep: from, optionally through a peak at the middle, to. */
    from: number;
    peak?: number;
    to: number;
    q?: number;
    /** Seconds the noise takes to swell in; a crack is near zero, a wind is slow. */
    attackSec?: number;
    delaySec?: number;
}

/** Filtered noise: the voice of the realm's weather, which a pure tone cannot carry. */
const playNoise = (options: NoiseOptions): void =>
    audioNeverThrows(() => {
        const ctx = getAudioContext();
        if (!ctx || options.gain <= 0.001) return;
        stealOldestInCategory('realm');
        const start = ctx.currentTime + (options.delaySec ?? 0);
        const end = start + options.durationSec;
        const source = ctx.createBufferSource();
        source.buffer = getNoiseBuffer(ctx);
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = options.filter;
        filter.Q.value = options.q ?? 1;
        filter.frequency.setValueAtTime(options.from, start);
        if (options.peak != null) {
            filter.frequency.exponentialRampToValueAtTime(options.peak, start + options.durationSec * 0.4);
        }
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), end);
        const g = ctx.createGain();
        const attack = Math.max(0.004, options.attackSec ?? 0.01);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(options.gain * 0.5, start + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        source.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        const voice: ScheduledVoice = { category: 'realm', osc: source, gain: g, startTime: start };
        activeVoices.push(voice);
        source.addEventListener('ended', () => removeVoice(voice));
        globalThis.setTimeout(() => removeVoice(voice), (options.delaySec ?? 0) * 1000 + (options.durationSec + 0.1) * 1000);
        source.start(start);
        source.stop(end + 0.02);
    });

type RealmSound = 'thunder' | 'crackle' | 'fire' | 'wind' | 'ice' | 'wave' | 'creak' | 'chime' | 'hiss';

/** Each sound's level, measured against a match cue in a browser so none hides under the bed or shouts over the turn. */
const REALM_SOUND_LEVEL: Readonly<Record<RealmSound, number>> = {
    thunder: 0.6,
    crackle: 1.2,
    fire: 1.8,
    wind: 1.3,
    ice: 0.6,
    wave: 0.8,
    creak: 0.95,
    chime: 1,
    hiss: 0.55
};

/**
 * The recordings each sound plays (CC0, `assets/ASSET_SOURCES.md`), taken in turn so a run of the
 * same event does not repeat one take. The procedural voice below is the fallback when a sample has
 * not decoded. The chime stays procedural: a small, clean confirmation reads better than an impact.
 */
const REALM_SOUND_SAMPLES: Readonly<Record<RealmSound, readonly SfxSampleKey[]>> = {
    thunder: ['realm-lightning-1', 'realm-lightning-2'],
    crackle: ['realm-static'],
    fire: ['realm-fire-1', 'realm-fire-2', 'realm-fire-3'],
    wind: ['realm-wind'],
    ice: ['realm-ice-1', 'realm-ice-2', 'realm-ice-3'],
    wave: ['realm-water-1', 'realm-water-2'],
    creak: ['realm-earth'],
    chime: [],
    hiss: ['realm-douse']
};
/** Events with a recording of their own over their sound's. */
const REALM_EVENT_SAMPLES: Partial<Record<RealmEvent['kind'], readonly SfxSampleKey[]>> = {
    burnout: ['realm-burnout']
};
let realmSampleTurn = 0;

/** What each realm event sounds like (`realm-weather-rules.ts`). */
export const REALM_EVENT_SOUND: Readonly<Record<RealmEvent['kind'], RealmSound>> = {
    lightning: 'thunder',
    thunderclap: 'thunder',
    reaction: 'thunder',
    static: 'crackle',
    wildfire: 'fire',
    firestorm: 'fire',
    burnout: 'fire',
    scald: 'fire',
    blizzard: 'wind',
    whiteout: 'wind',
    frostbite: 'ice',
    current: 'wave',
    springtide: 'wave',
    undertow: 'wave',
    overgrowth: 'creak',
    bloom: 'creak',
    snare: 'creak',
    harvest: 'chime',
    thaw: 'chime',
    doused: 'hiss',
    scorch: 'fire',
    wash: 'wave',
    freeze: 'ice',
    entangle: 'creak',
    empowered: 'chime',
    neutralized: 'hiss',
    released: 'chime'
};

/**
 * The realm's weather, heard (2026-10-01). Every realm event moved or marked cards in silence; now
 * lightning cracks and rolls, fire whooshes, the blizzard howls, ice snaps, the tide surges, vines
 * creak, a cut vine or a thaw chimes, a doused fire hisses. Procedural, so nothing new to preload.
 */
export const playRealmEventSfx = (gain: number, kind: RealmEvent['kind'], peak = false): void => {
    if (gain <= 0.001) return;
    const sound = REALM_EVENT_SOUND[kind];
    const takes = REALM_EVENT_SAMPLES[kind] ?? (sound ? REALM_SOUND_SAMPLES[sound] : undefined) ?? [];
    if (takes.length > 0) {
        realmSampleTurn += 1;
        if (tryPlaySampled(takes[realmSampleTurn % takes.length]!, gain * (peak ? 1.25 : 1))) return;
    }
    // Levelled in a browser against a match cue (2026-10-01): the thunder and the creak read under the bed at 1x.
    const g = gain * (peak ? 1.25 : 1) * REALM_SOUND_LEVEL[sound];
    switch (sound) {
        case 'thunder':
            playNoise({ durationSec: 0.09, gain: g * 0.9, filter: 'highpass', from: 2400, to: 1600, attackSec: 0.002 });
            playNoise({ durationSec: 1.4, gain: g * 0.85, filter: 'lowpass', from: 420, to: 45, attackSec: 0.03, delaySec: 0.04 });
            playTone({ frequency: 70, frequencyEnd: 34, durationSec: 0.9, gain: g * 0.55, type: 'sine', category: 'realm' });
            return;
        case 'crackle':
            for (let n = 0; n < 6; n += 1) {
                playNoise({ durationSec: 0.035, gain: g * 0.6, filter: 'bandpass', from: 3200 + n * 400, to: 2600, q: 4, attackSec: 0.002, delaySec: n * 0.055 });
            }
            playTone({ frequency: 1200, frequencyEnd: 300, durationSec: 0.3, gain: g * 0.12, type: 'triangle', category: 'realm' });
            return;
        case 'fire':
            playNoise({ durationSec: 0.75, gain: g * 0.8, filter: 'bandpass', from: 300, peak: 2600, to: 700, q: 0.8, attackSec: 0.12 });
            for (let n = 0; n < 4; n += 1) {
                playNoise({ durationSec: 0.03, gain: g * 0.18, filter: 'bandpass', from: 2600, to: 2200, q: 0.8, attackSec: 0.004, delaySec: 0.15 + n * 0.12 });
            }
            return;
        case 'wind':
            playNoise({ durationSec: 1.3, gain: g * 0.75, filter: 'bandpass', from: 350, peak: 1100, to: 300, q: 1, attackSec: 0.35 });
            playTone({ frequency: 520, frequencyEnd: 780, durationSec: 0.9, gain: g * 0.08, type: 'sine', category: 'realm' });
            return;
        case 'ice':
            playNoise({ durationSec: 0.05, gain: g * 0.7, filter: 'highpass', from: 4000, to: 3000, attackSec: 0.002 });
            playTone({ frequency: 2600, frequencyEnd: 3300, durationSec: 0.25, gain: g * 0.2, type: 'sine', category: 'realm' });
            playTone({ frequency: 3900, frequencyEnd: 3500, durationSec: 0.35, gain: g * 0.12, type: 'sine', category: 'realm' });
            return;
        case 'wave':
            playNoise({ durationSec: 1.2, gain: g * 0.8, filter: 'lowpass', from: 250, peak: 1600, to: 200, q: 0.7, attackSec: 0.3 });
            playTone({ frequency: 110, frequencyEnd: 68, durationSec: 0.8, gain: g * 0.25, type: 'sine', category: 'realm' });
            return;
        case 'creak':
            playTone({ frequency: 96, frequencyEnd: 70, durationSec: 0.45, gain: g * 0.3, type: 'triangle', category: 'realm' });
            playNoise({ durationSec: 0.5, gain: g * 0.4, filter: 'bandpass', from: 900, peak: 1800, to: 700, q: 0.9, attackSec: 0.05, delaySec: 0.08 });
            return;
        case 'chime':
            playTone({ frequency: 880, frequencyEnd: 1320, durationSec: 0.18, gain: g * 0.3, type: 'triangle', category: 'realm' });
            return;
        case 'hiss':
            playNoise({ durationSec: 0.6, gain: g * 0.6, filter: 'highpass', from: 1800, to: 5000, attackSec: 0.02 });
            return;
    }
};

/** The void spits (`void-spew-rules.ts`): the room is sucked in, then thrown back out. */
export const playVoidSpewSfx = (rawGain: number): void => {
    if (rawGain <= 0.001) return;
    const gain = rawGain * 0.7;
    playTone({ frequency: 260, frequencyEnd: 32, durationSec: 0.55, gain: gain * 0.5, type: 'sine', category: 'realm' });
    playNoise({ durationSec: 0.55, gain: gain * 0.5, filter: 'lowpass', from: 3000, to: 120, attackSec: 0.05 });
    playNoise({ durationSec: 0.9, gain: gain * 0.9, filter: 'lowpass', from: 120, peak: 2400, to: 300, attackSec: 0.01, delaySec: 0.55 });
    scheduleCue(() => playTone({ frequency: 55, frequencyEnd: 220, durationSec: 0.4, gain: gain * 0.45, type: 'triangle', category: 'realm' }), 550);
};

/** The realm's sounds for a resolved turn: its newest event, and the void if it spat. */
const playRealmTurnSfx = (before: RunState, after: RunState, gain: number): void => {
    const event = after.lastRealmEvent;
    if (event && event.key !== before.lastRealmEvent?.key) {
        const peaks = (after.realmPeaksThisFloor ?? 0) > (before.realmPeaksThisFloor ?? 0);
        playRealmEventSfx(gain, event.kind, peaks);
    }
    if ((after.voidSpewsThisFloor ?? 0) > (before.voidSpewsThisFloor ?? 0) && after.board?.level === before.board?.level) {
        playVoidSpewSfx(gain);
    }
};

/**
 * A tile turning over, at the pitch the meter is currently holding.
 *
 * `meter` is optional and the cue is identical without it. That is on purpose: this fires from
 * the tile press path, the gambit third pick, tests and the hostile-context sweep, and the flip
 * has to make a sound in every one of them whether or not a run state was to hand.
 */
export const playFlipSfx = (gain: number, meter?: ChainMeter | null): void => {
    const voicing = comboFlipVoicing(meter);
    if (tryPlaySampled('flip', gain * voicing.gainScale, voicing)) {
        return;
    }
    playTone({
        frequency: 520 * voicing.pitchRatio,
        durationSec: 0.05,
        gain: gain * voicing.gainScale,
        type: 'sine',
        category: 'flip'
    });
};

/**
 * The last seconds of the study window, as a tick.
 *
 * The HUD says this too — the bar reddens and thickens as the window shuts — but the HUD is the
 * one place a player who is doing this *right* is not looking. Memorizing means watching the
 * board; a warning that requires glancing away is a warning that reaches the distracted player and
 * misses the concentrating one. Sound does not ask for the eye at all, which is the same reason
 * the stage was left alone: the board has to stay visible.
 *
 * Bounded hard, for the reason the visual rise starts late. This is pressure applied to the one
 * activity it exists to time, so it gets the last few seconds and no more, it is quiet, and it
 * climbs in pitch rather than in volume — a clock speeding up, not a klaxon.
 */
export const playStudyClosingTickSfx = (gain: number, secondsLeft: number): void => {
    if (gain <= 0.001) {
        return;
    }
    // 3, 2, 1 → rising. A tick that does not move says "time passes"; one that rises says "now".
    const step = Math.max(0, 3 - Math.max(0, Math.min(3, Math.round(secondsLeft))));
    playTone({
        frequency: 660 + step * 120,
        durationSec: 0.045,
        gain: gain * (0.14 + step * 0.03),
        type: 'triangle',
        category: 'flip'
    });
};

/** Layered on the third flip of a Gambit (after `playFlipSfx`). */
export const playGambitCommitSfx = (gain: number): void => {
    if (gain <= 0.001) {
        return;
    }
    if (tryPlaySampled('gambitCommit', gain)) {
        return;
    }
    playTone({
        frequency: 880,
        frequencyEnd: 1120,
        durationSec: 0.068,
        gain: gain * 0.52,
        type: 'sine',
        category: 'flip'
    });
};

/**
 * The voices the meter stacks on top of the match itself.
 *
 * Each one is tied to a rung of the chain ladder rather than to a raw streak number, so the cue
 * thickens in step with the bar the player is watching: a shimmer once the chain is Clean, body
 * under it at Sharp, a ring that holds at Fever. All three ride the same `pitchRatio` as the hit,
 * which is what keeps four voices sounding like one instrument getting bigger rather than like
 * four cues arriving at once.
 *
 * The tail is immediate, not scheduled. A ring that starts 70ms after its own hit is a second
 * event; started together with a long decay it is the hit having somewhere to go.
 */
const playComboMatchLayers = (gain: number, voicing: ComboVoicing): void => {
    if (voicing.layers.shimmer) {
        playTone({
            frequency: 1240 * voicing.pitchRatio,
            frequencyEnd: 1780 * voicing.pitchRatio,
            durationSec: 0.07,
            gain: gain * (voicing.layers.body ? 0.28 : 0.2),
            type: 'sine',
            category: 'match'
        });
    }
    if (voicing.layers.body) {
        playTone({
            frequency: 214 * voicing.pitchRatio,
            frequencyEnd: 160 * voicing.pitchRatio,
            durationSec: 0.11,
            gain: gain * 0.26,
            type: 'triangle',
            category: 'match'
        });
    }
    if (voicing.layers.tail) {
        // Up the same in-key set the break phrase uses, from the surge note, so the ring lands
        // on a pitch the rest of the mix already plays.
        const note = cascadeNoteHz(CHAIN_MILESTONE_SEMITONES.surge, voicing.step);
        playTone({
            frequency: note,
            frequencyEnd: note,
            durationSec: 0.34,
            gain: gain * 0.15,
            type: 'sine',
            category: 'match'
        });
    }
};

/**
 * A matched pair.
 *
 * `chainDepth` is the consecutive-match count including this match; it picks the tier recording
 * and the rung of the in-key ladder the recording is transposed to. `meter` is the live chain
 * meter and it decides the layers — pass it wherever a run state exists, because the streak alone
 * does not know what the bar in the HUD is doing. Without one the fixed rungs stand in.
 *
 * See `comboVoicing.ts` for why any of this moves at all.
 */
export const playMatchSfx = (gain: number, chainDepth = 1, meter?: ChainMeter | null): void => {
    if (gain <= 0.001) {
        return;
    }
    const depth = Math.max(1, chainDepth);
    const tierKey = resolveMatchTierSampleKey(depth);
    const voicing = comboMatchVoicing({ chainDepth: depth, meter, tierRootDepth: matchTierRootDepth(tierKey) });
    const sampled = tryPlaySampled(tierKey, gain * voicing.gainScale, voicing);
    if (!sampled) {
        playTone({
            frequency: 612 * voicing.pitchRatio,
            frequencyEnd: 820 * voicing.pitchRatio,
            durationSec: 0.12 + voicing.step * 0.008,
            gain: gain * voicing.gainScale,
            type: 'triangle',
            category: 'match'
        });
    }
    playComboMatchLayers(gain, voicing);
    playComboHeatSparkleSfx(gain, depth);
};

/**
 * The heat on every match: from Hot, a bright short partial a step up the key for each stage,
 * under the match rather than over it. The pool tables' cue gets a brighter *tink* the longer the
 * run, and the ear reads "still climbing" from it before the eye has found the counter.
 */
const playComboHeatSparkleSfx = (gain: number, combo: number): void => {
    const heat = comboHeatLevels(combo);
    if (heat.stageIndex < 2) {
        return;
    }
    const note = cascadeNoteHz(CHAIN_MILESTONE_SEMITONES.chain, heat.stageIndex + 2);
    playTone({
        frequency: note,
        frequencyEnd: note * 1.01,
        durationSec: 0.05 + heat.heat * 0.05,
        gain: gain * (0.06 + heat.heat * 0.12),
        type: 'sine',
        category: 'match'
    });
};

/**
 * The rank-up sting (`ComboStageCallout`): three notes up the key, each higher than the stage
 * before, with a held top note that grows with the stage. Played once per stage reached, by the
 * screen that stamps it, keyed to the turn - never on a mount or a restore.
 */
export const playComboStageSfx = (gain: number, stageIndex: number): void => {
    if (gain <= 0.001) {
        return;
    }
    const root = CHAIN_MILESTONE_SEMITONES.surge + Math.max(0, Math.min(5, Math.floor(stageIndex))) * 2;
    for (let step = 0; step < 3; step += 1) {
        const note = cascadeNoteHz(root, step * 2);
        scheduleCue(() => {
            playTone({
                frequency: note,
                frequencyEnd: note,
                durationSec: step === 2 ? 0.3 + stageIndex * 0.06 : 0.09,
                gain: gain * (step === 2 ? 0.42 : 0.26),
                type: step === 2 ? 'triangle' : 'sine',
                category: 'match'
            });
        }, step * 70);
    }
};

/**
 * A missed pair, weighted by the chain it broke.
 *
 * `meter` is the meter as it stood *before* the miss, because a miss is worth what it cost. The
 * one sample transposes down a rung at a time, and Sharp and Fever add a low drop under it so a
 * chain ending is audibly a chain ending and not a cold first flip.
 */
const playMismatchSfx = (gain: number, meter?: ChainMeter | null): void => {
    const voicing = comboMismatchVoicing({ meter });
    if (!tryPlaySampled('mismatch', gain * voicing.gainScale, voicing)) {
        playTone({
            frequency: 180 * voicing.pitchRatio,
            frequencyEnd: 120 * voicing.pitchRatio,
            durationSec: 0.18 / voicing.pitchRatio,
            gain: gain * voicing.gainScale,
            type: 'sawtooth',
            category: 'mismatch'
        });
    }
    if (voicing.layers.body) {
        playTone({
            frequency: 148 * voicing.pitchRatio,
            frequencyEnd: 62,
            durationSec: voicing.layers.tail ? 0.36 : 0.24,
            gain: gain * (voicing.layers.tail ? 0.3 : 0.2),
            type: 'triangle',
            category: 'mismatch'
        });
    }
};

const hasResolvedResourceReward = (before: RunState, after: RunState): boolean =>
    runFiniteNumber(after.flashPairCharges) > runFiniteNumber(before.flashPairCharges);

const tileTraitCountTotal = (value: unknown): number => {
    if (value == null || typeof value !== 'object') {
        return 0;
    }
    const counts = value as Record<string, unknown>;
    return TILE_TRAIT_COUNT_KINDS.reduce((sum, kind) => sum + runNonNegativeInteger(counts[kind]), 0);
};

const resolvedRewardChannelCount = (
    before: RunState,
    after: RunState,
    chainMilestone?: ChainMilestoneFeedback
): number => {
    return [
        (after.findablesClaimedThisFloor ?? 0) > (before.findablesClaimedThisFloor ?? 0),
        hasResolvedResourceReward(before, after),
        Boolean(chainMilestone)
    ].filter(Boolean).length;
};

const brokenChainDepth = (before: RunState, after: RunState): number => {
    const beforeStreak = Math.floor(runFiniteNumber(before.stats.currentStreak));
    const afterStreak = Math.floor(runFiniteNumber(after.stats.currentStreak));
    return beforeStreak >= 3 && afterStreak < beforeStreak ? beforeStreak : 0;
};

const resolvedTraitMismatchCount = (before: RunState, after: RunState): number =>
    Math.max(
        0,
        tileTraitCountTotal(after.stats.tileTraitMismatches) - tileTraitCountTotal(before.stats.tileTraitMismatches)
    );

const playChainMilestoneAccentSfx = (gain: number, milestone: ChainMilestoneFeedback): void => {
    /*
     * The beats decide how far up the set the accent sweeps, not how many Hz it is lifted by. It
     * used to be `base + beatCount * 28` sweeping to `base + 520 + beatCount * 56` - both ends a
     * number rather than a note, so however well the base was chosen the sound never arrived on it.
     * Now both ends are notes the loop plays and a longer milestone reaches further up.
     */
    const semitones = CHAIN_MILESTONE_SEMITONES[milestone.tone === 'combo' ? 'combo' : milestone.tone === 'surge' ? 'surge' : 'chain'];
    playTone({
        frequency: cascadeNoteHz(semitones, 0),
        frequencyEnd: cascadeNoteHz(semitones, Math.max(1, milestone.beatCount)),
        durationSec: 0.066 + milestone.beatCount * 0.012,
        gain: gain * (milestone.tone === 'combo' ? 0.38 : 0.2 + milestone.beatCount * 0.035),
        type: 'sine',
        category: 'match'
    });
};

/**
 * The chunk, as a sound: one rising note per pair that left, spaced like the shatter wave, so a
 * big break is audibly bigger than a small one. Fever adds a held sting on top — the finish is
 * supposed to be louder than anything before it.
 */
/** Notes in the shatter phrase: a nine-pair break is one rising phrase, not nine collisions. */
export const CHUNK_BREAK_MAX_NOTES = 9;

const playChunkBreakSfx = (gain: number, pairs: number, tier: ChainTier): void => {
    const count = Math.max(1, Math.min(pairs, CHUNK_BREAK_MAX_NOTES));
    for (let index = 0; index < count; index += 1) {
        /*
         * The next step UP THE KEY, not the next 46Hz. The phrase used to be `720 + index * 46`
         * sweeping to `1080 + lift * 1.4` - a straight line through frequency space whose steps ran
         * 107 cents, then 101, then 96, down to 75, landing on no note at any point and gliding
         * through the gaps besides. Nine of those is not a scale; it is a siren with rhythm. The
         * notes come from the measured key of the run loop now (`musicalScale.ts`), and each one
         * holds its pitch instead of sweeping, because a note that slides has no place in a melody.
         */
        const note = chunkBreakNoteHz(index);
        // Each later note sits a little under the one before it, so the phrase climbs in pitch
        // without climbing in level and the sting on top still has room.
        const taper = 1 / (1 + index * 0.08);
        scheduleCue(() => {
            playTone({
                frequency: note,
                frequencyEnd: note,
                durationSec: 0.09,
                gain: gain * (tier === 'fever' ? 0.3 : 0.22) * taper,
                type: 'triangle',
                category: 'match'
            });
        }, index * 55);
    }
    if (tier === 'fever') {
        scheduleCue(() => {
            playTone({
                frequency: 660,
                frequencyEnd: 1320,
                durationSec: 0.42,
                gain: gain * 0.34,
                type: 'sine',
                category: 'match'
            });
        }, count * 55 + 40);
    }
};

/**
 * Reaching Fever, as opposed to breaking at it.
 *
 * The chunk phrase already puts a sting on a Fever break, so once a run was at the top every break
 * sounded the same and the moment of arriving sounded like none of them in particular. The board,
 * the room and the ladder all light once when the meter fills; this is that beat in the mix — a
 * fifth under the sting's own octave, so it reads as the phrase resolving rather than as a
 * different instrument arriving.
 */
const playChainFeverArrivalSfx = (gain: number): void => {
    scheduleCue(() => {
        playTone({
            frequency: 440,
            frequencyEnd: 880,
            durationSec: 0.58,
            gain: gain * 0.4,
            type: 'sine',
            category: 'match'
        });
    }, 30);
    scheduleCue(() => {
        playTone({
            frequency: 1320,
            frequencyEnd: 1980,
            durationSec: 0.3,
            gain: gain * 0.22,
            type: 'triangle',
            category: 'match'
        });
    }, 150);
};

const playTraitMismatchSurgeSfx = (gain: number, traitMismatchCount: number): void => {
    playTone({
        frequency: 640 + Math.min(traitMismatchCount, 4) * 70,
        frequencyEnd: 180,
        durationSec: 0.13,
        gain: gain * 0.2,
        type: 'square',
        category: 'mismatch'
    });
};

const playStackedRewardBurstSfx = (gain: number, channelCount: number): void => {
    playTone({
        frequency: 1840 + Math.min(channelCount, 4) * 120,
        frequencyEnd: 2860 + Math.min(channelCount, 4) * 160,
        durationSec: 0.12,
        gain: gain * 0.24,
        type: 'sine',
        category: 'match'
    });
};

const playStackedRewardSetupSfx = (gain: number, channelCount: number): void => {
    playTone({
        frequency: 1660 + Math.min(channelCount, 3) * 90,
        frequencyEnd: 2360 + Math.min(channelCount, 3) * 110,
        durationSec: 0.095,
        gain: gain * 0.18,
        type: 'sine',
        category: 'match'
    });
};

export const playChainOpportunityBeatSfx = (
    gain: number,
    tier: ChainOpportunityBeatSfxTier,
    beatCount: number
): void => {
    if (gain <= 0.001) {
        return;
    }
    const safeBeatCount = Math.max(2, Math.min(5, Math.floor(runFiniteNumber(beatCount))));
    const profile: Record<ChainOpportunityBeatSfxTier, { frequency: number; frequencyEnd: number; gainScale: number; type: OscillatorType }> = {
        cashout: { frequency: 1520, frequencyEnd: 2480, gainScale: 0.24, type: 'triangle' },
        'follow-up': { frequency: 980, frequencyEnd: 1460, gainScale: 0.18, type: 'sine' },
        route: { frequency: 1120, frequencyEnd: 1620, gainScale: 0.18, type: 'sine' },
        setup: { frequency: 760, frequencyEnd: 1120, gainScale: 0.15, type: 'triangle' },
        surge: { frequency: 1320, frequencyEnd: 2120, gainScale: 0.22, type: 'sine' }
    };
    const cue = profile[tier];
    playTone({
        frequency: cue.frequency + safeBeatCount * 18,
        frequencyEnd: cue.frequencyEnd + safeBeatCount * 36,
        durationSec: tier === 'cashout' ? 0.13 : tier === 'surge' ? 0.115 : 0.085 + safeBeatCount * 0.006,
        gain: gain * cue.gainScale,
        type: cue.type,
        category: 'match'
    });
};

export const playMismatchRecoveryCrescendoSfx = (
    gain: number,
    tier: MismatchRecoveryCrescendoSfxTier,
    beatCount: number
): void => {
    if (gain <= 0.001) {
        return;
    }
    const safeBeatCount = Math.max(2, Math.min(5, Math.floor(runFiniteNumber(beatCount))));
    const profile: Record<MismatchRecoveryCrescendoSfxTier, { frequency: number; frequencyEnd: number; gainScale: number; type: OscillatorType }> = {
        break: { frequency: 420, frequencyEnd: 220, gainScale: 0.18, type: 'sawtooth' },
        recover: { frequency: 560, frequencyEnd: 840, gainScale: 0.14, type: 'sine' },
        risk: { frequency: 640, frequencyEnd: 260, gainScale: 0.17, type: 'square' },
        'trait-surge': { frequency: 880, frequencyEnd: 240, gainScale: 0.22, type: 'square' }
    };
    const cue = profile[tier];
    playTone({
        frequency: cue.frequency + safeBeatCount * 14,
        frequencyEnd: Math.max(40, cue.frequencyEnd + (tier === 'recover' ? safeBeatCount * 24 : -safeBeatCount * 10)),
        durationSec: tier === 'trait-surge' ? 0.15 : 0.09 + safeBeatCount * 0.012,
        gain: gain * cue.gainScale,
        type: cue.type,
        category: 'mismatch'
    });
};

const playResolvedCascadeAccentSfx = (gain: number, chainDepth: number, rewardChannelCount: number): void => {
    if (chainDepth < 3 && rewardChannelCount < 2) {
        return;
    }
    const comboCascade = chainDepth >= 10 || rewardChannelCount >= 3;
    const rewardCascade =
        comboCascade ||
        chainDepth >= 6 ||
        rewardChannelCount >= 2 ||
        (rewardChannelCount >= 1 && chainDepth >= 3);
    const startFrequency = comboCascade ? 2060 : rewardCascade ? 1740 : 1460;
    const endFrequency = comboCascade ? 3340 : rewardCascade ? 2780 : 2220;
    playTone({
        frequency: startFrequency + Math.min(chainDepth, 10) * 18,
        frequencyEnd: endFrequency + Math.min(rewardChannelCount, 4) * 120,
        durationSec: comboCascade ? 0.15 : rewardCascade ? 0.12 : 0.09,
        gain: gain * (comboCascade ? 0.28 : rewardCascade ? 0.22 : 0.16),
        type: comboCascade ? 'triangle' : 'sine',
        category: 'match'
    });
};

const countPayoffLanesFromPayload = (payload: MatchPayoffSfxPayload): number => {
    const explicitLaneCount = runArray<{ count: number }>(payload.payoffLaneMap).reduce(
        (sum, lane) => sum + runNonNegativeInteger(lane.count),
        0
    );
    if (explicitLaneCount > 0) {
        return explicitLaneCount;
    }

    const summaryValue = payload.payoffSummary?.value ?? '';
    const parsedLaneCount = /^(\d+)\s+(?:payoffs|lanes)\b/i.exec(summaryValue)?.[1];
    if (parsedLaneCount) {
        return Math.max(0, Number.parseInt(parsedLaneCount, 10));
    }

    return payload.rewardBurst ? (payload.rewardBurst.tier === 'mega' ? 4 : payload.rewardBurst.tier === 'stack' ? 3 : 1) : 0;
};

const getMatchPayoffPayloadTier = (
    payload: MatchPayoffSfxPayload
): 'cashout' | 'combo' | 'reward' | 'score' | 'stack' | 'super' => {
    const label = `${payload.payoffSummary?.label ?? ''} ${payload.rewardBurst?.label ?? ''} ${
        payload.impactCue?.label ?? ''
    }`.toLowerCase();
    const laneCount = countPayoffLanesFromPayload(payload);
    if (label.includes('super stack') || laneCount >= 4) {
        return 'super';
    }
    if (label.includes('stack cashout') || payload.rewardBurst?.tier === 'mega' || laneCount >= 3) {
        return 'stack';
    }
    if (label.includes('cashout') || payload.rewardBurst || laneCount >= 2) {
        return 'cashout';
    }
    if (payload.cascadeCue?.tier === 'combo' || payload.payoffSummary?.tier === 'combo') {
        return 'combo';
    }
    if (payload.cascadeCue?.tier === 'reward' || payload.payoffSummary?.tier === 'reward') {
        return 'reward';
    }
    return 'score';
};

export const playMatchPayoffSfx = (gain: number, payload: MatchPayoffSfxPayload): void => {
    if (gain <= 0.001) {
        return;
    }

    const tier = getMatchPayoffPayloadTier(payload);
    if (tier === 'score') {
        return;
    }

    const laneCount = Math.max(1, Math.min(6, countPayoffLanesFromPayload(payload)));
    const profile: Record<
        Exclude<ReturnType<typeof getMatchPayoffPayloadTier>, 'score'>,
        { durationSec: number; frequency: number; frequencyEnd: number; gainScale: number; type: OscillatorType }
    > = {
        cashout: { durationSec: 0.11, frequency: 1760, frequencyEnd: 2680, gainScale: 0.21, type: 'triangle' },
        combo: { durationSec: 0.1, frequency: 1580, frequencyEnd: 2380, gainScale: 0.18, type: 'sine' },
        reward: { durationSec: 0.095, frequency: 1460, frequencyEnd: 2180, gainScale: 0.17, type: 'sine' },
        stack: { durationSec: 0.14, frequency: 2140, frequencyEnd: 3560, gainScale: 0.26, type: 'triangle' },
        super: { durationSec: 0.18, frequency: 2620, frequencyEnd: 4680, gainScale: 0.31, type: 'triangle' }
    };
    const cue = profile[tier];
    playTone({
        frequency: cue.frequency + laneCount * 44,
        frequencyEnd: cue.frequencyEnd + laneCount * 110,
        durationSec: cue.durationSec,
        gain: gain * cue.gainScale,
        type: cue.type,
        category: 'match'
    });
};

/**
 * After `resolveBoardTurn` / `applyResolveBoardTurn`: match vs mismatch feedback from stat deltas.
 * Scheduling is tied to the resolve timer (or immediate resolve), not the flip instant.
 */
export const playResolveSfx = (before: RunState, after: RunState, gain: number): void => {
    if (gain <= 0.001) {
        silenceAllVoices();
        silenceAllSampleVoices();
        return;
    }
    if (after.stats.matchesFound > before.stats.matchesFound) {
        // The meter after the turn for a match, before it for a miss: one says what was reached,
        // the other says what was lost, and those are the two things a cue here has to carry.
        playMatchSfx(gain, Math.max(1, after.stats.currentStreak), runChainMeter(after));
        const chainMilestone = getChainMilestoneFeedback(runChainTier(before), runChainTier(after));
        if (chainMilestone) {
            playChainMilestoneAccentSfx(gain, chainMilestone);
        }
        const chunkPairs = (after.chunkPairsBrokenThisFloor ?? 0) - (before.chunkPairsBrokenThisFloor ?? 0);
        if (chunkPairs > 0) {
            playChunkBreakSfx(gain, chunkPairs, runChainTier(after));
        }
        // The turn that carried the run to the top of the meter, and only that turn.
        if (runChainTier(after) === 'fever' && runChainTier(before) !== 'fever') {
            playChainFeverArrivalSfx(gain);
        }
        if ((after.findablesClaimedThisFloor ?? 0) > (before.findablesClaimedThisFloor ?? 0)) {
            playTone({
                frequency: 1480,
                frequencyEnd: 2180,
                durationSec: 0.09,
                gain: gain * 0.28,
                type: 'sine',
                category: 'match'
            });
        }
        if (hasResolvedResourceReward(before, after)) {
            playTone({
                frequency: 1180,
                frequencyEnd: 1880,
                durationSec: 0.085,
                gain: gain * 0.22,
                type: 'triangle',
                category: 'match'
            });
        }
        const rewardChannelCount = resolvedRewardChannelCount(before, after, chainMilestone);
        playResolvedCascadeAccentSfx(gain, Math.max(1, Math.floor(runFiniteNumber(after.stats.currentStreak))), rewardChannelCount);
        if (rewardChannelCount === 2) {
            playStackedRewardSetupSfx(gain, rewardChannelCount);
        }
        if (rewardChannelCount >= 3) {
            playStackedRewardBurstSfx(gain, rewardChannelCount);
        }
    } else if (after.stats.tries > before.stats.tries) {
        playMismatchSfx(gain, runChainMeter(before));
        const traitMismatchCount = resolvedTraitMismatchCount(before, after);
        if (traitMismatchCount >= 2) {
            playTraitMismatchSurgeSfx(gain, traitMismatchCount);
        }
        const chainDepthLost = brokenChainDepth(before, after);
        if (chainDepthLost > 0) {
            playTone({
                frequency: 320 + Math.min(chainDepthLost, 10) * 18,
                frequencyEnd: 92,
                durationSec: 0.22,
                gain: gain * (chainDepthLost >= 6 ? 0.3 : 0.22),
                type: 'triangle',
                category: 'mismatch'
            });
        }
    }
    playRealmTurnSfx(before, after, gain);
};

/** Arming peek / swap / pin: short affirming chirp (not played on disarm). */
export const playPowerArmSfx = (gain: number): void => {
    if (tryPlaySampled('power-arm', gain)) {
        return;
    }
    playTone({
        frequency: 392,
        frequencyEnd: 556,
        durationSec: 0.07,
        gain: gain * 0.82,
        type: 'sine',
        category: 'power'
    });
};

/** Peek consumed: airy lift. */
export const playPeekPowerSfx = (gain: number): void => {
    if (tryPlaySampled('peek-power', gain)) {
        return;
    }
    playTone({
        frequency: 1040,
        frequencyEnd: 1380,
        durationSec: 0.1,
        gain: gain * 0.72,
        type: 'sine',
        category: 'power'
    });
};

/**
 * Full-board / row shuffle motion: layered sweep (distinct from flip/match).
 * When `quick`, prefer reduce-motion path: brief tick so shuffles still feel tactile when animated FX are skipped.
 */
export const playShuffleSfx = (gain: number, quick = false): void => {
    if (gain <= 0.001) {
        silenceAllVoices();
        silenceAllSampleVoices();
        return;
    }
    if (quick) {
        if (tryPlaySampled('shuffle-quick', gain)) {
            return;
        }
        playTone({
            frequency: 440,
            durationSec: 0.042,
            gain: gain * 0.72,
            type: 'sine',
            category: 'shuffle'
        });
        return;
    }
    if (tryPlaySampled('shuffle-full', gain)) {
        return;
    }
    playTone({
        frequency: 190,
        frequencyEnd: 510,
        durationSec: 0.15,
        gain,
        type: 'sawtooth',
        category: 'shuffle'
    });
    playTone({
        frequency: 980,
        frequencyEnd: 340,
        durationSec: 0.11,
        gain: gain * 0.34,
        type: 'triangle',
        category: 'shuffle'
    });
};

/**
 * Floor cleared: deferred one macrotask so last-pair match resolve SFX can finish first.
 */
export const playFloorClearSfx = (gain: number): void => {
    if (gain <= 0.001) {
        return;
    }
    scheduleCue(() => {
        if (tryPlaySampled('floor-clear', gain)) {
            return;
        }
        playTone({
            frequency: 300,
            frequencyEnd: 1080,
            durationSec: 0.2,
            gain: gain * 0.52,
            type: 'sine',
            category: 'power'
        });
    }, 0);
};
