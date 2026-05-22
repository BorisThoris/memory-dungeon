import type { RunState } from '../../shared/contracts';
import {
    maybePreloadSampledSfx,
    resolveMatchTierSampleKey,
    resetSampledSfxForTests,
    silenceAllSampleVoices,
    tryPlaySampled
} from './sampledSfx';
import {
    getSharedAudioContext,
    resetSharedAudioContextForTests,
    resumeSharedAudioContext
} from './webAudioContext';

/**
 * Gameplay SFX: optional sampled OGG/WAV (`assets/audio/sfx/`) with procedural Web Audio fallback.
 * Call `resumeAudioContext()` once after a user gesture if the browser suspended the context.
 *
 * Resolve tones (`playResolveSfx`) fire when **`applyResolveBoardTurn` runs** (after `resolveRemainingMs`, or
 * immediately if resolve delay is zero)—not on the second tile flip. Flip tones (`playFlipSfx`) fire on flip.
 */

/** Clears scheduling state between Vitest cases (Web Audio singleton otherwise sticks to the first mock). */
export const __resetGameSfxEngineForTests = (): void => {
    silenceAllVoices();
    silenceAllSampleVoices();
    resetSampledSfxForTests();
    resetSharedAudioContextForTests();
};

const getAudioContext = getSharedAudioContext;

export const resumeAudioContext = (): void => {
    resumeSharedAudioContext();
    maybePreloadSampledSfx();
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Effective linear gain from settings (0–1 each). */
export const sfxGainFromSettings = (masterVolume: number, sfxVolume: number): number =>
    clamp01(masterVolume) * clamp01(sfxVolume);

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'pressure' | 'shuffle';

interface ScheduledVoice {
    category: SfxCategory;
    gain: GainNode;
    osc: OscillatorNode;
    startTime: number;
}

/** Max simultaneous one-shots per category (cascade bursts steal the oldest voice). */
const MAX_POLYPHONY: Record<SfxCategory, number> = {
    flip: 5,
    match: 4,
    mismatch: 4,
    power: 5,
    pressure: 1,
    shuffle: 4
};

const activeVoices: ScheduledVoice[] = [];

const removeVoice = (voice: ScheduledVoice): void => {
    const i = activeVoices.indexOf(voice);
    if (i >= 0) {
        activeVoices.splice(i, 1);
    }
};

const stopVoice = (voice: ScheduledVoice): void => {
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
    while (activeVoices.length > 0) {
        const v = activeVoices[0];
        if (v) {
            stopVoice(v);
        }
    }
};

const playTone = (
    options: {
        frequency: number;
        durationSec: number;
        gain: number;
        type: OscillatorType;
        frequencyEnd?: number;
        category: SfxCategory;
    }
): void => {
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

export const playFlipSfx = (gain: number): void => {
    if (tryPlaySampled('flip', gain)) {
        return;
    }
    playTone({ frequency: 520, durationSec: 0.05, gain, type: 'sine', category: 'flip' });
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

/** `chainDepth` — consecutive-match count after this match (caps so very long chains stay pleasant). */
export const playMatchSfx = (gain: number, chainDepth = 1): void => {
    const tierKey = resolveMatchTierSampleKey(Math.max(1, chainDepth));
    if (tryPlaySampled(tierKey, gain)) {
        return;
    }
    const tier = Math.max(1, Math.min(chainDepth, 14));
    const lift = tier - 1;
    playTone({
        frequency: 612 + lift * 34,
        frequencyEnd: 820 + lift * 42,
        durationSec: 0.12 + Math.min(lift, 9) * 0.007,
        gain,
        type: 'triangle',
        category: 'match'
    });
};

const playMismatchSfx = (gain: number): void => {
    if (tryPlaySampled('mismatch', gain)) {
        return;
    }
    playTone({
        frequency: 180,
        frequencyEnd: 120,
        durationSec: 0.18,
        gain,
        type: 'sawtooth',
        category: 'mismatch'
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
        playMatchSfx(gain, Math.max(1, after.stats.currentStreak));
    } else if (after.stats.tries > before.stats.tries) {
        playMismatchSfx(gain);
    }
};

/** Immediate dungeon trap spring feedback: uses the danger/mismatch timbre without mutating run stats. */
export const playTrapSfx = (gain: number): void => {
    if (gain <= 0.001) {
        silenceAllVoices();
        silenceAllSampleVoices();
        return;
    }
    playMismatchSfx(gain);
};

/** Arming destroy / peek / stray / pin — short affirming chirp (not played on disarm). */
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

/** Destroy pair resolved — heavy break (distinct from match). */
export const playDestroyPairSfx = (gain: number): void => {
    if (tryPlaySampled('destroy-pair', gain)) {
        return;
    }
    playTone({
        frequency: 132,
        frequencyEnd: 88,
        durationSec: 0.22,
        gain: gain * 1.05,
        type: 'sawtooth',
        category: 'power'
    });
};

/** Peek consumed — airy lift. */
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

/** Stray remove — quick scrape. */
export const playStrayPowerSfx = (gain: number): void => {
    if (tryPlaySampled('stray-power', gain)) {
        return;
    }
    playTone({
        frequency: 380,
        frequencyEnd: 240,
        durationSec: 0.14,
        gain: gain * 0.92,
        type: 'triangle',
        category: 'power'
    });
};

/**
 * Full-board / row shuffle motion — layered sweep (distinct from flip/match).
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
 * Floor cleared — deferred one macrotask so last-pair match resolve SFX can finish first.
 */
export const playFloorClearSfx = (gain: number): void => {
    if (gain <= 0.001) {
        return;
    }
    globalThis.setTimeout(() => {
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

export const playRelicOfferOpenSfx = (gain: number): void => {
    if (tryPlaySampled('relic-offer-open', gain)) {
        return;
    }
    playTone({
        frequency: 620,
        frequencyEnd: 960,
        durationSec: 0.18,
        gain: gain * 0.78,
        type: 'triangle',
        category: 'power'
    });
};

export const playCountdownPressureSfx = (gain: number): void => {
    if (tryPlaySampled('countdown-pressure', gain)) {
        return;
    }
    playTone({
        frequency: 220,
        frequencyEnd: 310,
        durationSec: 0.09,
        gain: gain * 0.48,
        type: 'triangle',
        category: 'pressure'
    });
};

export const playRelicPickSfx = (gain: number): void => {
    if (tryPlaySampled('relic-pick', gain)) {
        return;
    }
    playTone({
        frequency: 520,
        frequencyEnd: 920,
        durationSec: 0.16,
        gain: gain * 0.86,
        type: 'triangle',
        category: 'power'
    });
};

export const playWagerArmSfx = (gain: number): void => {
    if (tryPlaySampled('wager-arm', gain)) {
        return;
    }
    playTone({
        frequency: 460,
        frequencyEnd: 1180,
        durationSec: 0.14,
        gain: gain * 0.82,
        type: 'sawtooth',
        category: 'power'
    });
};
