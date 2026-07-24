import type { RunState } from '../../shared/contracts';
import { runArrayCount, runFilteredStringArray } from '../../shared/run-array-guards';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { TILE_TRAIT_COUNT_KINDS } from '../../shared/session-stats-rules';
import { getChainMilestoneFeedback, type ChainMilestoneFeedback } from '../copy/chainMilestoneFeedback';
import { getChainRewardForecastCues } from '../copy/chainMomentum';
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
};

const getAudioContext = getSharedAudioContext;

export const resumeAudioContext = (): void => {
    resumeSharedAudioContext();
    maybePreloadSampledSfx();
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Effective linear gain from settings (0-1 each). */
export const sfxGainFromSettings = (masterVolume: number, sfxVolume: number): number =>
    clamp01(masterVolume) * clamp01(sfxVolume);

type SfxCategory = 'flip' | 'match' | 'mismatch' | 'power' | 'pressure' | 'shuffle';
type ChainOpportunityBeatSfxTier = 'cashout' | 'follow-up' | 'route' | 'setup' | 'surge';
type MismatchRecoveryCrescendoSfxTier = 'break' | 'lost-reward' | 'recover' | 'risk' | 'trait-surge';
export type RelicChoiceCrescendoSfxTier = 'cashout' | 'prime' | 'rare' | 'stack';
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

/** `chainDepth` is consecutive-match count after this match (caps so very long chains stay pleasant). */
export const playMatchSfx = (gain: number, chainDepth = 1): void => {
    if (gain <= 0.001) {
        return;
    }
    const tierKey = resolveMatchTierSampleKey(Math.max(1, chainDepth));
    const tier = Math.max(1, Math.min(chainDepth, 14));
    const lift = tier - 1;
    const sampled = tryPlaySampled(tierKey, gain);
    if (!sampled) {
        playTone({
            frequency: 612 + lift * 34,
            frequencyEnd: 820 + lift * 42,
            durationSec: 0.12 + Math.min(lift, 9) * 0.007,
            gain,
            type: 'triangle',
            category: 'match'
        });
    }
    if (tier >= 6) {
        playTone({
            frequency: 1240 + Math.min(lift, 8) * 55,
            frequencyEnd: 1780 + Math.min(lift, 8) * 72,
            durationSec: 0.07,
            gain: gain * (tier >= 10 ? 0.34 : 0.24),
            type: 'sine',
            category: 'match'
        });
    }
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

const finiteNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const hasResolvedResourceReward = (before: RunState, after: RunState): boolean => {
    const beforeStats = before.stats;
    const afterStats = after.stats;
    return (
        finiteNumber(afterStats.comboShards) > finiteNumber(beforeStats.comboShards) ||
        finiteNumber(afterStats.guardTokens) > finiteNumber(beforeStats.guardTokens) ||
        finiteNumber(after.shopGold) > finiteNumber(before.shopGold) ||
        finiteNumber(after.relicFavorProgress) > finiteNumber(before.relicFavorProgress) ||
        finiteNumber(after.favorBonusRelicPicksNextOffer) > finiteNumber(before.favorBonusRelicPicksNextOffer) ||
        finiteNumber(after.safeHazardWardChargesThisFloor) > finiteNumber(before.safeHazardWardChargesThisFloor) ||
        finiteNumber(after.flashPairCharges) > finiteNumber(before.flashPairCharges)
    );
};

const tileTraitCountTotal = (value: unknown): number => {
    if (value == null || typeof value !== 'object') {
        return 0;
    }
    const counts = value as Record<string, unknown>;
    return TILE_TRAIT_COUNT_KINDS.reduce((sum, kind) => sum + runNonNegativeInteger(counts[kind]), 0);
};

const resolvedTraitRouteProgressCount = (before: RunState, after: RunState): number =>
    Math.max(
        0,
        finiteNumber(after.traitRouteObjectiveProgressThisFloor) - finiteNumber(before.traitRouteObjectiveProgressThisFloor),
        runArrayCount(after.traitRouteObjectiveTriggeredTagsThisFloor) - runArrayCount(before.traitRouteObjectiveTriggeredTagsThisFloor)
    );

const resolvedRewardPerkProcCount = (before: RunState, after: RunState): number => {
    const beforeTags = new Set(runFilteredStringArray(before.traitRouteObjectiveTriggeredTagsThisFloor));
    return runFilteredStringArray(after.traitRouteObjectiveTriggeredTagsThisFloor).filter(
        (tag) => tag.startsWith('reward-perk:') && !beforeTags.has(tag)
    ).length;
};

const hasResolvedChainRewardCashout = (before: RunState, after: RunState): boolean => {
    if (finiteNumber(after.stats.currentStreak) < 3) {
        return false;
    }
    return (
        finiteNumber(after.stats.comboShards) > finiteNumber(before.stats.comboShards) ||
        finiteNumber(after.stats.guardTokens) > finiteNumber(before.stats.guardTokens) ||
        finiteNumber(after.lives) > finiteNumber(before.lives)
    );
};

const resolvedRewardChannelCount = (
    before: RunState,
    after: RunState,
    chainMilestone?: ChainMilestoneFeedback
): number => {
    const chainRewardCashout = hasResolvedChainRewardCashout(before, after);
    const traitRouteChannels = Math.min(2, resolvedTraitRouteProgressCount(before, after));
    const rewardPerkChannels = Math.min(2, resolvedRewardPerkProcCount(before, after));
    return traitRouteChannels + [
        (after.findablesClaimedThisFloor ?? 0) > (before.findablesClaimedThisFloor ?? 0),
        hasResolvedResourceReward(before, after) && !chainRewardCashout,
        chainRewardCashout,
        Boolean(chainMilestone),
        ...Array.from({ length: rewardPerkChannels }, () => true)
    ].filter(Boolean).length;
};

const brokenChainDepth = (before: RunState, after: RunState): number => {
    const beforeStreak = Math.floor(finiteNumber(before.stats.currentStreak));
    const afterStreak = Math.floor(finiteNumber(after.stats.currentStreak));
    return beforeStreak >= 3 && afterStreak < beforeStreak ? beforeStreak : 0;
};

const resolvedTraitMismatchCount = (before: RunState, after: RunState): number =>
    Math.max(
        0,
        tileTraitCountTotal(after.stats.tileTraitMismatches) - tileTraitCountTotal(before.stats.tileTraitMismatches)
    );

const hasNearBrokenChainReward = (before: RunState, chainDepthLost: number): boolean =>
    chainDepthLost > 0 &&
    (getChainRewardForecastCues(
        chainDepthLost,
        finiteNumber(before.stats.comboShards),
        finiteNumber(before.lives)
    )[0]?.distance ?? Number.POSITIVE_INFINITY) <= 2;

const hasArmedNearChainReward = (before: RunState, after: RunState): boolean => {
    if (hasResolvedChainRewardCashout(before, after)) {
        return false;
    }
    const chainDepth = Math.floor(finiteNumber(after.stats.currentStreak));
    if (chainDepth < 4) {
        return false;
    }
    return (
        getChainRewardForecastCues(
            chainDepth,
            finiteNumber(after.stats.comboShards),
            finiteNumber(after.lives)
        )[0]?.distance === 1
    );
};

const chainMilestoneAccentFrequency = (milestone: ChainMilestoneFeedback): number => {
    if (milestone.tone === 'combo') {
        return 1960;
    }
    if (milestone.tone === 'surge') {
        return 1680;
    }
    return 1360;
};

const playChainMilestoneAccentSfx = (gain: number, milestone: ChainMilestoneFeedback): void => {
    const base = chainMilestoneAccentFrequency(milestone);
    const beatLift = milestone.beatCount * 28;
    playTone({
        frequency: base + beatLift,
        frequencyEnd: base + (milestone.tone === 'combo' ? 760 : 520) + beatLift * 2,
        durationSec: 0.066 + milestone.beatCount * 0.012,
        gain: gain * (milestone.tone === 'combo' ? 0.38 : 0.2 + milestone.beatCount * 0.035),
        type: 'sine',
        category: 'match'
    });
};

const playBrokenChainRewardLossSfx = (gain: number, chainDepthLost: number): void => {
    playTone({
        frequency: 760 + Math.min(chainDepthLost, 10) * 22,
        frequencyEnd: 360,
        durationSec: 0.16,
        gain: gain * (chainDepthLost >= 6 ? 0.2 : 0.16),
        type: 'sine',
        category: 'mismatch'
    });
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

const playSuperStackedRewardBurstSfx = (gain: number, channelCount: number): void => {
    playTone({
        frequency: 2440 + Math.min(channelCount, 6) * 90,
        frequencyEnd: 3860 + Math.min(channelCount, 6) * 140,
        durationSec: channelCount >= 5 ? 0.18 : 0.15,
        gain: gain * (channelCount >= 5 ? 0.3 : 0.25),
        type: 'triangle',
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
    const safeBeatCount = Math.max(2, Math.min(5, Math.floor(finiteNumber(beatCount))));
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
    const safeBeatCount = Math.max(2, Math.min(5, Math.floor(finiteNumber(beatCount))));
    const profile: Record<MismatchRecoveryCrescendoSfxTier, { frequency: number; frequencyEnd: number; gainScale: number; type: OscillatorType }> = {
        break: { frequency: 420, frequencyEnd: 220, gainScale: 0.18, type: 'sawtooth' },
        'lost-reward': { frequency: 720, frequencyEnd: 320, gainScale: 0.2, type: 'triangle' },
        recover: { frequency: 560, frequencyEnd: 840, gainScale: 0.14, type: 'sine' },
        risk: { frequency: 640, frequencyEnd: 260, gainScale: 0.17, type: 'square' },
        'trait-surge': { frequency: 880, frequencyEnd: 240, gainScale: 0.22, type: 'square' }
    };
    const cue = profile[tier];
    playTone({
        frequency: cue.frequency + safeBeatCount * 14,
        frequencyEnd: Math.max(40, cue.frequencyEnd + (tier === 'recover' ? safeBeatCount * 24 : -safeBeatCount * 10)),
        durationSec: tier === 'trait-surge' ? 0.15 : tier === 'lost-reward' ? 0.14 : 0.09 + safeBeatCount * 0.012,
        gain: gain * cue.gainScale,
        type: cue.type,
        category: 'mismatch'
    });
};

export const playRelicChoiceCrescendoSfx = (
    gain: number,
    tier: RelicChoiceCrescendoSfxTier,
    beatCount: number
): void => {
    if (gain <= 0.001) {
        return;
    }
    const safeBeatCount = Math.max(2, Math.min(5, Math.floor(finiteNumber(beatCount))));
    const profile: Record<RelicChoiceCrescendoSfxTier, { frequency: number; frequencyEnd: number; gainScale: number; type: OscillatorType }> = {
        cashout: { frequency: 1180, frequencyEnd: 1780, gainScale: 0.18, type: 'sine' },
        prime: { frequency: 720, frequencyEnd: 1080, gainScale: 0.13, type: 'triangle' },
        rare: { frequency: 1320, frequencyEnd: 2360, gainScale: 0.22, type: 'triangle' },
        stack: { frequency: 980, frequencyEnd: 1860, gainScale: 0.2, type: 'sine' }
    };
    const cue = profile[tier];
    playTone({
        frequency: cue.frequency + safeBeatCount * 20,
        frequencyEnd: cue.frequencyEnd + safeBeatCount * 44,
        durationSec: tier === 'rare' ? 0.16 : tier === 'stack' ? 0.13 : 0.085 + safeBeatCount * 0.01,
        gain: gain * cue.gainScale,
        type: cue.type,
        category: 'match'
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

const playChainRewardCashoutSfx = (gain: number, after: RunState): void => {
    const chainDepth = Math.max(3, Math.min(12, Math.floor(finiteNumber(after.stats.currentStreak))));
    playTone({
        frequency: 1420 + chainDepth * 36,
        frequencyEnd: 2320 + chainDepth * 54,
        durationSec: chainDepth >= 8 ? 0.14 : 0.105,
        gain: gain * (chainDepth >= 8 ? 0.32 : 0.26),
        type: 'triangle',
        category: 'match'
    });
};

const playNearChainRewardArmedSfx = (gain: number, after: RunState): void => {
    const chainDepth = Math.max(4, Math.min(12, Math.floor(finiteNumber(after.stats.currentStreak))));
    playTone({
        frequency: 1040 + chainDepth * 28,
        frequencyEnd: 1680 + chainDepth * 42,
        durationSec: 0.082,
        gain: gain * 0.18,
        type: 'sine',
        category: 'match'
    });
};

const playTraitRouteAccentSfx = (gain: number, after: RunState, routeProgressCount: number): void => {
    const traitSurge = routeProgressCount >= 2;
    playTone({
        frequency: traitSurge ? 1880 : 1560,
        frequencyEnd: traitSurge
            ? 2920
            : after.traitRouteObjectiveCompletedThisFloor
              ? 2440
              : 2040,
        durationSec: traitSurge ? 0.14 : after.traitRouteObjectiveCompletedThisFloor ? 0.12 : 0.08,
        gain: gain * (traitSurge ? 0.34 : after.traitRouteObjectiveCompletedThisFloor ? 0.3 : 0.22),
        type: traitSurge ? 'triangle' : 'sine',
        category: 'match'
    });
};

const playRewardPerkPopSfx = (gain: number, perkProcCount: number): void => {
    playTone({
        frequency: 2140 + Math.min(perkProcCount, 3) * 120,
        frequencyEnd: 3380 + Math.min(perkProcCount, 3) * 180,
        durationSec: perkProcCount >= 2 ? 0.13 : 0.095,
        gain: gain * (perkProcCount >= 2 ? 0.3 : 0.23),
        type: 'triangle',
        category: 'match'
    });
};

const countPayoffLanesFromPayload = (payload: MatchPayoffSfxPayload): number => {
    const explicitLaneCount = Array.isArray(payload.payoffLaneMap)
        ? payload.payoffLaneMap.reduce((sum, lane) => sum + runNonNegativeInteger(lane.count), 0)
        : 0;
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
        playMatchSfx(gain, Math.max(1, after.stats.currentStreak));
        const chainMilestone = getChainMilestoneFeedback(before.stats.currentStreak, after.stats.currentStreak);
        if (chainMilestone) {
            playChainMilestoneAccentSfx(gain, chainMilestone);
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
        if (hasResolvedChainRewardCashout(before, after)) {
            playChainRewardCashoutSfx(gain, after);
        }
        if (hasArmedNearChainReward(before, after)) {
            playNearChainRewardArmedSfx(gain, after);
        }
        const traitRouteProgressCount = resolvedTraitRouteProgressCount(before, after);
        if (traitRouteProgressCount > 0) {
            playTraitRouteAccentSfx(gain, after, traitRouteProgressCount);
        }
        const rewardPerkProcCount = resolvedRewardPerkProcCount(before, after);
        if (rewardPerkProcCount > 0) {
            playRewardPerkPopSfx(gain, rewardPerkProcCount);
        }
        const rewardChannelCount = resolvedRewardChannelCount(before, after, chainMilestone);
        playResolvedCascadeAccentSfx(gain, Math.max(1, Math.floor(finiteNumber(after.stats.currentStreak))), rewardChannelCount);
        if (rewardChannelCount === 2) {
            playStackedRewardSetupSfx(gain, rewardChannelCount);
        }
        if (rewardChannelCount >= 3) {
            playStackedRewardBurstSfx(gain, rewardChannelCount);
        }
        if (rewardChannelCount >= 4) {
            playSuperStackedRewardBurstSfx(gain, rewardChannelCount);
        }
    } else if (after.stats.tries > before.stats.tries) {
        playMismatchSfx(gain);
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
            if (hasNearBrokenChainReward(before, chainDepthLost)) {
                playBrokenChainRewardLossSfx(gain, chainDepthLost);
            }
        }
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

/** Arming destroy / peek / stray / pin: short affirming chirp (not played on disarm). */
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

/** Destroy pair resolved: heavy break (distinct from match). */
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

/** Stray remove: quick scrape. */
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
