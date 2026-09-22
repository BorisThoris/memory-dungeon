import type { RunState } from '../../shared/contracts';
import { runArray } from '../../shared/run-array-guards';
import { runFiniteNumber, runNonNegativeInteger } from '../../shared/run-number-guards';
import { TILE_TRAIT_COUNT_KINDS } from '../../shared/session-stats-rules';
import { getChainMilestoneFeedback, type ChainMilestoneFeedback } from '../copy/chainMilestoneFeedback';
import { runChainMeter, runChainTier, type ChainMeter, type ChainTier } from '../../shared/chain-tier-rules';
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
    type SampledVoicing
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

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'shuffle';
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
    osc: OscillatorNode;
    startTime: number;
}

/** Max simultaneous one-shots per category (cascade bursts steal the oldest voice). */
const MAX_POLYPHONY: Record<SfxCategory, number> = {
    flip: 5,
    match: 4,
    mismatch: 4,
    power: 5,
    shuffle: 4
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
        const chainMilestone = getChainMilestoneFeedback(before.stats.currentStreak, after.stats.currentStreak);
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
