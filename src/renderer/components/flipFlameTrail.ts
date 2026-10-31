import { COMBO_HEAT_STAGE_FROM, comboDepth, comboSoftCap, comboSurge } from '../../shared/combo-heat-rules';
import { createMulberry32 } from '../../shared/rng';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The flame on the card as it turns (combo reference, "Next on the ladder": the instrument burning,
 * not the room). From Blazing up, the card a player flips trails embers along the turn, so the hand
 * itself is on fire and not only the room around it. Presentation only: no rule reads it.
 *
 * It climbs with every link, like everything the combo drives (`comboDepth`, `comboSoftCap`): three
 * embers at Blazing, more with each link after it towards `FLIP_FLAME_CEILING` more, and they grow
 * and linger longer with the surge. Below Blazing there is none: the trail is the reward for heat.
 */
export const FLIP_FLAME_BASE = 3;
/** The share of embers past the base, approached and never reached as the combo climbs. */
export const FLIP_FLAME_CEILING = 9;
/** Seconds the trail is laid over: the turn of the card. */
export const FLIP_FLAME_SPAN = 0.28;

export interface FlipFlameEmber {
    /** Seconds after the flip this ember is born. */
    delay: number;
    /** Offset from the card's centre, in board units. */
    dx: number;
    dy: number;
    sizeScale: number;
}

/** How many embers a flip trails at this combo: 0 below Blazing. */
export const flipFlameCount = (combo: number): number => {
    const links = runNonNegativeInteger(combo);
    if (links < COMBO_HEAT_STAGE_FROM.blazing) return 0;
    const past = comboDepth(links) - comboDepth(COMBO_HEAT_STAGE_FROM.blazing);
    return FLIP_FLAME_BASE + Math.round(comboSoftCap(past * 4, FLIP_FLAME_CEILING));
};

/**
 * The embers one flip throws, laid along the turn: early ones off the leading edge, later ones off
 * the face as it settles. `seed` is the card's, so a replayed frame draws the same trail.
 */
export const flipFlameTrail = (combo: number, seed: number, halfWidth: number): FlipFlameEmber[] => {
    const count = flipFlameCount(combo);
    if (count === 0) return [];
    const rng = createMulberry32(seed);
    const grow = 1 + comboSurge(combo) * 0.25 + comboDepth(combo) * 0.12;
    return Array.from({ length: count }, (_, index) => {
        const along = count === 1 ? 0 : index / (count - 1);
        // The edge sweeps across the card as it turns: from one side to the other.
        const dx = (along * 2 - 1) * halfWidth * (0.8 + rng() * 0.25);
        const dy = (rng() - 0.5) * halfWidth * 1.2;
        return {
            delay: along * FLIP_FLAME_SPAN + rng() * 0.03,
            dx,
            dy,
            sizeScale: (1 + rng() * 0.6) * grow
        };
    });
};
