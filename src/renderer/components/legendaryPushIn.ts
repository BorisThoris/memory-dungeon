import { COMBO_HEAT_STAGE_FROM, comboDepth, comboSoftCap } from '../../shared/combo-heat-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

/**
 * The big shot (combo reference, "Next on the ladder"): a break at Legendary pushes the camera in on
 * the board and lets it settle back, the beat the arcade tables give their best shot. A target, not
 * a curve: the board's own scale damping (`tileBoardViewportMotionState.ts`) is the slow move in and
 * out, so the push only says how far and for how long. Presentation only: no rule reads it.
 *
 * It grows with every link past Legendary (`comboDepth`, `comboSoftCap`) and never past
 * `PUSH_IN_BASE + PUSH_IN_CEILING`, so a board pushed in still shows its edges.
 */
export const PUSH_IN_BASE = 0.045;
export const PUSH_IN_CEILING = 0.05;
/** Seconds the board is held pushed in before it settles back. */
export const PUSH_IN_HOLD_SECONDS = 0.9;

/** A break is a match that takes more than its own pair: the pop's pairs went with it. */
export const isLegendaryBreak = (removedBefore: number, removedAfter: number, combo: number): boolean =>
    removedAfter - removedBefore > 2 && runNonNegativeInteger(combo) >= COMBO_HEAT_STAGE_FROM.legendary;

/** How far in this combo pushes: 1 + the push. */
export const pushInDepth = (combo: number): number => {
    const past = Math.max(0, comboDepth(combo) - comboDepth(COMBO_HEAT_STAGE_FROM.legendary));
    // In hundredths, so the soft cap climbs over hundreds of links rather than the first few.
    return 1 + PUSH_IN_BASE + comboSoftCap(past * 2, PUSH_IN_CEILING * 100) / 100;
};

/** The scale target this frame, `seconds` after the break: pushed in while it holds, 1 after. */
export const pushInTarget = (seconds: number | null, combo: number, reduceMotion: boolean): number => {
    if (reduceMotion || seconds === null || seconds < 0 || seconds >= PUSH_IN_HOLD_SECONDS) return 1;
    return pushInDepth(combo);
};

/** The scale damping while the push moves in and settles back: slower than the board's own, so it reads as a camera move. */
export const PUSH_IN_DAMPING = 1.8;
/** Seconds after the hold the settle back keeps the slow damping. */
export const PUSH_IN_SETTLE_SECONDS = 1.4;

/** The damping for this frame, or null when the board's own applies. */
export const pushInDamping = (seconds: number | null, reduceMotion: boolean): number | null =>
    reduceMotion || seconds === null || seconds < 0 || seconds >= PUSH_IN_HOLD_SECONDS + PUSH_IN_SETTLE_SECONDS ? null : PUSH_IN_DAMPING;
