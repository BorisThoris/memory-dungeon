/**
 * How the room answers the run, as continuous functions of the chain meter's fill (0..1 of the way
 * to Fever) rather than four steps: the ring warms as the chain grows, not when a rung is crossed,
 * and the motes it throws up rise from nothing at rest to a full drift at Fever.
 *
 * The ring and the fire answer on different curves on purpose. The ring *is* the meter made
 * architecture, so it eases in the way the meter does: the last pairs before Fever move it most.
 * The fire is the room noticing, so it answers early and steeply, the way the cards' rune glow
 * does — the first pair of a chain should already have the torches up, or nothing in the room tells
 * a player a chain has started until it is nearly over.
 */
import type { ChainTier } from '../../shared/chain-tier-rules';

export interface SceneRingLevels {
    /** Opacity of the ring's floor light pass. */
    light: number;
    /** Opacity of the ring's own glow. */
    glow: number;
    /** Hue rotation of the glow in degrees: violet at rest, rose at Fever. */
    hueDeg: number;
    /** Saturation multiplier of the glow. */
    saturate: number;
    /** Peak opacity of the floor flash on a break. */
    pulsePeak: number;
    /** Strength of the motes the ring throws up, 0 at rest to 1 at Fever. */
    motes: number;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export const sceneRingLevels = (fill: number): SceneRingLevels => {
    const f = clamp01(fill);
    // Ease in: the first pairs barely move the room, the last ones before Fever move it most.
    const eased = f * f * (3 - 2 * f);
    return {
        light: round(0.5 + 0.8 * eased),
        glow: round(0.68 + 0.72 * eased),
        hueDeg: Math.round(-40 * eased) + 0, // + 0 folds -0 into 0 so the CSS variable never reads "-0deg"
        saturate: round(1 + 0.4 * eased),
        pulsePeak: round(0.35 + 0.9 * eased),
        motes: round(eased)
    };
};

const round = (value: number): number => Math.round(value * 1000) / 1000;

export interface SceneFlameLevels {
    /** Multiplier on every flame flipbook's rate: a hot room burns faster. */
    rate: number;
    /** Vertical scale of each flame about its own foot, so it grows up the wall rather than outward. */
    lift: number;
    /** Opacity of the sparks coming off the flames. */
    embers: number;
    /** Multiplier on how fast those sparks rise. */
    emberRate: number;
}

/**
 * How hard the room's fire burns for a given chain.
 *
 * All four of these are things CSS can already do to a box that exists: a rate on a running
 * animation, a scale about the flame's foot, an opacity. No new layer, no new element, and nothing
 * per frame. That is the reason the fire can answer the run at all — six flames and their sparks
 * are in the scene on every device that gets it, including the phones held to the `lean` tier,
 * which is exactly where a fifth painted light pass would not have been affordable.
 *
 * At rest the fire sits a shade under its painted self, which is what leaves it somewhere to climb.
 */
export const sceneFlameLevels = (fill: number): SceneFlameLevels => {
    const f = clamp01(fill);
    // Steep off zero: one pair is visible in the fire, and Fever is the top of a climb the player
    // has been watching rather than the only moment anything happened.
    const early = 1 - (1 - f) * (1 - f);
    return {
        rate: round(0.92 + 0.62 * early),
        lift: round(1 + 0.16 * early),
        embers: round(0.5 + 0.5 * early),
        emberRate: round(0.85 + 0.5 * early)
    };
};

/**
 * How hard the torches flare on a break: the pop (a match with no chain behind it) barely stirs
 * them, Fever throws them up the wall. Peak opacity of the transient torch-glow layer.
 */
export const sceneTorchFlarePeak = (pulse: ChainTier | 'pop' | 'none'): number => {
    switch (pulse) {
        case 'pop':
            return 0.22;
        case 'clean':
            return 0.38;
        case 'sharp':
            return 0.55;
        case 'fever':
            return 0.85;
        default:
            return 0;
    }
};
