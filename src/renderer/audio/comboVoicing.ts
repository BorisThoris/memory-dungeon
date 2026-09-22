/**
 * The combo meter, as a mixing desk.
 *
 * Every match cue in this game used to be one of three recordings. `match-tier-low` covers a chain
 * of one through five, so the first five pairs of every floor — the overwhelming majority of
 * matches anybody ever hears — played **the same file, at the same pitch, at the same gain**. A
 * player who cleared four floors cleanly heard that one sound forty times, unchanged. Mismatch and
 * flip were worse: one file each, no tiers at all, every miss and every tile press for a whole run.
 *
 * Three recordings is not the problem. Peggle 2's audio team (Audio Gang, `docs/RESEARCH_NOTES.md`
 * §2) run a cascade off a handful of samples and it never tires, because the sample is the
 * *instrument* and the combo state is the *performance*: successive hits step up a scale, layers
 * arrive as the multiplier climbs, and no two hits are bit-identical. This module is that
 * performance, kept apart from the Web Audio plumbing so the decisions are readable and testable
 * on their own.
 *
 * Three things vary, in order of how much they matter:
 *
 * 1. **Pitch climbs the chain, up the key.** Each successive match transposes the sample one step
 *    up the set `musicalScale.ts` measured out of the run loop (A, B, D, E). The step resets when
 *    the tier sample changes, because at that point a different, bigger recording arrives and
 *    carries the lift itself — the ladder is per-instrument, not endless. Without the reset a
 *    fourteen-match chain would end three octaves up, which is a kettle, not a reward.
 *
 * 2. **Layers arrive on the meter, not on the streak.** The old sparkle fired at `chainDepth >= 6`,
 *    a bare number with nothing to do with the ladder the rest of the game reads. The meter
 *    (`chain-tier-rules.ts`) counts momentum against the floor, which is what the HUD bar, the
 *    board and the music already move to. Clean adds a shimmer, Sharp adds body under it, Fever
 *    adds a ring that holds. The cue thickens as the bar fills, so the mix says what the bar says.
 *
 * 3. **No two hits are the same hit.** A small rotating detune and gain trim per cue — round robin,
 *    the oldest trick in sample playback. Deliberately a fixed rotation and not `Math.random`: a
 *    cue that cannot be predicted also cannot be tested, and the point is variety, not noise.
 *
 * Nothing here touches an AudioContext. It takes numbers and returns numbers.
 */

import { getChainTier, type ChainMeter, type ChainTier } from '../../shared/chain-tier-rules';
import { runFiniteNumber } from '../../shared/run-number-guards';
import { cascadeStepSemitones } from './musicalScale';

/** Layers the meter has unlocked for this cue. Each one is a voice on top of the sample. */
export interface ComboVoicingLayers {
    /** Clean and above: an octave sparkle over the hit. */
    shimmer: boolean;
    /** Sharp and above: a low body so the hit has weight under the sparkle. */
    body: boolean;
    /** Fever only: a held ring that lets the moment hang. */
    tail: boolean;
}

export interface ComboVoicing {
    /** Which rung of the in-key ladder this cue plays; 0 is the tier's own root. */
    step: number;
    /** `step` in semitones above the root — what a sample's playback rate is derived from. */
    semitones: number;
    /** Round-robin detune, in cents. Small enough to be texture, not pitch. */
    detuneCents: number;
    /** `semitones` and `detuneCents` as one frequency multiplier, for procedural voices. */
    pitchRatio: number;
    /** Level trim: the ladder's own taper times the round robin's. */
    gainScale: number;
    /** The tier the meter is at, which is what unlocked the layers. */
    tier: ChainTier;
    layers: ComboVoicingLayers;
}

/**
 * Rungs on the ladder before it resets. Five, because that is the span of a match-tier sample
 * (`manifest.json` ranges the low and mid tiers over five chain depths each), and a ladder that
 * outlived its instrument would be climbing with nothing underneath it.
 */
export const COMBO_MATCH_LADDER_STEPS = 5;

/** The deepest chain the match tiers describe; past this the ladder holds at the top rung. */
export const COMBO_MATCH_MAX_DEPTH = 14;

/**
 * The rotation. Six entries, and the gain trim does not turn over in step with the detune, so the
 * pattern takes a while to come back around audibly. Cents, not semitones: the deepest detune here
 * is an eighth of a semitone, heard as a different *take* of the note rather than a different note.
 */
const ROUND_ROBIN_CENTS: readonly number[] = [0, 9, -6, 14, -11, 4];
const ROUND_ROBIN_GAIN: readonly number[] = [1, 0.96, 1.035, 0.945, 1.02, 0.975];

/**
 * One counter per cue family, so a run of flips cannot eat the match rotation and leave two
 * matches in a row sounding identical — which is the exact failure this whole module exists for.
 */
type RoundRobinSlot = 'match' | 'mismatch' | 'flip';
const roundRobinCounters: Record<RoundRobinSlot, number> = { match: 0, mismatch: 0, flip: 0 };

const advanceRoundRobin = (slot: RoundRobinSlot): { detuneCents: number; gainTrim: number } => {
    const index = roundRobinCounters[slot] % ROUND_ROBIN_CENTS.length;
    roundRobinCounters[slot] = (roundRobinCounters[slot] + 1) % ROUND_ROBIN_CENTS.length;
    return { detuneCents: ROUND_ROBIN_CENTS[index] ?? 0, gainTrim: ROUND_ROBIN_GAIN[index] ?? 1 };
};

/** Vitest shares the module across cases; without this the rotation carries a phase between them. */
export const __resetComboVoicingForTests = (): void => {
    roundRobinCounters.match = 0;
    roundRobinCounters.mismatch = 0;
    roundRobinCounters.flip = 0;
};

const ratioFrom = (semitones: number, detuneCents: number): number =>
    2 ** ((semitones * 100 + detuneCents) / 1200);

const safeDepth = (value: number): number => {
    const depth = Math.floor(runFiniteNumber(value));
    return Math.max(1, Math.min(depth, COMBO_MATCH_MAX_DEPTH));
};

/** How far up the ladder a tier's layers reach: none 0, clean 1, sharp 2, fever 3. */
export const comboTierWeight = (tier: ChainTier): number =>
    tier === 'fever' ? 3 : tier === 'sharp' ? 2 : tier === 'clean' ? 1 : 0;

const layersForTier = (tier: ChainTier): ComboVoicingLayers => ({
    shimmer: tier !== 'none',
    body: tier === 'sharp' || tier === 'fever',
    tail: tier === 'fever'
});

/**
 * The meter's tier, or the fixed rungs read off the streak when no meter was passed.
 *
 * The fallback is not a nicety: `playMatchSfx` is exported and gets called from tests and from the
 * cue-safety sweep with a bare depth, and a cue that needs a whole run state to make a sound is a
 * cue that will eventually be called without one.
 */
const tierFrom = (meter: ChainMeter | null | undefined, chainDepth: number): ChainTier =>
    meter?.tier ?? getChainTier(chainDepth);

export interface ComboMatchVoicingInput {
    /** Consecutive matches including this one. Drives the ladder. */
    chainDepth: number;
    /** The live chain meter. Drives the layers. Absent: the fixed rungs stand in. */
    meter?: ChainMeter | null;
    /** Chain depth at which this cue's tier sample starts, so the ladder resets with the sample. */
    tierRootDepth?: number;
}

/**
 * A match, voiced for where the run is on the meter.
 *
 * The taper is why the top rung does not shriek: a step up the ladder is a step up in pitch, pitch
 * reads as loudness, so the level comes down three percent per rung to hold the perceived size
 * flat and leave headroom for the layers stacking on top.
 */
export const comboMatchVoicing = (input: ComboMatchVoicingInput): ComboVoicing => {
    const chainDepth = safeDepth(input.chainDepth);
    const tierRootDepth = safeDepth(input.tierRootDepth ?? 1);
    const step = Math.max(0, Math.min(chainDepth - tierRootDepth, COMBO_MATCH_LADDER_STEPS - 1));
    const semitones = cascadeStepSemitones(step);
    const tier = tierFrom(input.meter, chainDepth);
    const { detuneCents, gainTrim } = advanceRoundRobin('match');
    return {
        step,
        semitones,
        detuneCents,
        pitchRatio: ratioFrom(semitones, detuneCents),
        gainScale: gainTrim * (1 - step * 0.03),
        tier,
        layers: layersForTier(tier)
    };
};

/**
 * A flip, nudged by the meter.
 *
 * This is the most-repeated sound in the game by a wide margin — it fires on every tile the player
 * touches — so it gets the smallest treatment: one semitone a rung, three at the top, plus the
 * round robin. Three semitones is a minor third; across a run the board audibly tightens as the
 * meter fills and no single flip sounds like an announcement. It carries no layers at all, because
 * a tick that grows voices stops being a tick.
 */
export const comboFlipVoicing = (meter?: ChainMeter | null): ComboVoicing => {
    const tier = meter?.tier ?? 'none';
    const semitones = comboTierWeight(tier);
    const { detuneCents, gainTrim } = advanceRoundRobin('flip');
    return {
        step: semitones,
        semitones,
        detuneCents,
        pitchRatio: ratioFrom(semitones, detuneCents),
        gainScale: gainTrim,
        tier,
        layers: { shimmer: false, body: false, tail: false }
    };
};

export interface ComboMismatchVoicingInput {
    /** The meter as it stood *before* the miss — a miss is measured by what it cost. */
    meter?: ChainMeter | null;
    /** The streak the miss broke, when no meter is to hand. */
    lostDepth?: number;
}

/**
 * A miss, weighted by what it broke.
 *
 * The same buzz for a cold first flip and for a Fever chain ending was the flattest thing in the
 * mix: the game's biggest loss and its smallest one were one event to the ear. The sample
 * transposes DOWN two semitones a rung, so a Fever break lands a tritone under a cold miss and —
 * because transposing a sample down stretches it — lasts half again as long. Bigger loss, lower,
 * longer. Nothing else needed saying.
 */
export const comboMismatchVoicing = (input: ComboMismatchVoicingInput): ComboVoicing => {
    const lostDepth = Math.max(0, Math.floor(runFiniteNumber(input.lostDepth ?? 0)));
    const tier = input.meter?.tier ?? getChainTier(lostDepth);
    const weight = comboTierWeight(tier);
    // Guarded against -0, which a cold miss would otherwise carry into every assertion.
    const semitones = weight === 0 ? 0 : -2 * weight;
    const { detuneCents, gainTrim } = advanceRoundRobin('mismatch');
    return {
        step: weight,
        semitones,
        detuneCents,
        pitchRatio: ratioFrom(semitones, detuneCents),
        // A heavier break is a louder break, but only just: this is still a failure cue.
        gainScale: gainTrim * (1 + weight * 0.06),
        tier,
        layers: { shimmer: false, body: weight >= 2, tail: weight >= 3 }
    };
};
