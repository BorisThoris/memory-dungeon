/**
 * What ending the study period early is worth.
 *
 * The double tap used to be a pure subtraction: the player gave up clock and got back only the
 * time they had already decided they did not need. A control whose whole payoff is "less of
 * something you did not want" is a control nobody presses twice, and the study window is the one
 * place in a run where a confident player is made to sit still.
 *
 * So the returned time buys momentum — the chain ladder's currency (`chain-tier-rules.ts`), the
 * same quantity a chunk break pays in. It is the honest reward for the claim the gesture makes:
 * *I have already read this board*. A player who reads the board faster starts the floor further
 * up the ladder, which is exactly what the ladder is for.
 *
 * Two rules keep it from being a free tier:
 *
 * 1. The ceiling sits strictly below the Clean rung (`CHAIN_TIER_CLEAN_FROM`). A skip can never
 *    hand a player a tier on its own; it only shortens the climb to the first one. The first real
 *    match still has to land before anything on the board changes behaviour.
 * 2. It is momentum, not score, so it dies with the chain. A mismatch clears it exactly as it
 *    clears the pairs a break took, and the next floor starts it at zero.
 *
 * The share is measured against the floor's full configured window, never against whatever was
 * left on a resumed timer — otherwise pausing would inflate the payout for free.
 */
import { CHAIN_TIER_CLEAN_FROM } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The most momentum a skip can bank. Strictly below the Clean rung, and asserted to be so in
 * `memorize-skip-reward-rules.test.ts` so that moving the rung down cannot quietly make the
 * gesture self-rewarding.
 */
export const MEMORIZE_SKIP_MOMENTUM_MAX = CHAIN_TIER_CLEAN_FROM - 1;

/**
 * The two thresholds, as shares of the study window handed back.
 *
 * Below the first, nothing: a tap on the last half-second is the clock running out with extra
 * steps, and paying for it would make the gesture a ritual rather than a claim. The second is set
 * past the midpoint so the full payout means the player read the board in well under half the
 * time the floor budgeted for it.
 */
export const MEMORIZE_SKIP_MIN_SHARE = 0.2;
export const MEMORIZE_SKIP_FULL_SHARE = 0.6;

export interface MemorizeSkipReward {
    /** Momentum to bank on the chain, 0..MEMORIZE_SKIP_MOMENTUM_MAX. */
    readonly momentum: number;
    /** The share of the window that was handed back, 0..1. Clamped; useful for presentation. */
    readonly returnedShare: number;
}

const NOTHING: MemorizeSkipReward = { momentum: 0, returnedShare: 0 };

/**
 * `remainingMs` is what was actually left on the clock when the gesture landed; `windowMs` is the
 * floor's full configured study window (`getMemorizeDurationForRun`). A window of zero or less
 * pays nothing rather than dividing by it.
 */
export const memorizeSkipReward = (
    remainingMs: number | null | undefined,
    windowMs: number | null | undefined
): MemorizeSkipReward => {
    const window = runNonNegativeInteger(windowMs);
    if (window <= 0) {
        return NOTHING;
    }

    const remaining = Math.min(runNonNegativeInteger(remainingMs), window);
    const returnedShare = remaining / window;

    if (returnedShare < MEMORIZE_SKIP_MIN_SHARE) {
        return { momentum: 0, returnedShare };
    }

    return {
        momentum: returnedShare >= MEMORIZE_SKIP_FULL_SHARE ? MEMORIZE_SKIP_MOMENTUM_MAX : 1,
        returnedShare
    };
};

/**
 * What the phase change says when it lands.
 *
 * The elapsed line is the one the game has always said and is left word for word, because a
 * clock running out is not an event the player did anything to cause. The skip gets its own
 * because a reward nobody is told about is a reward nobody learns to play for: the chain meter
 * starting above zero is visible, but only to a player who already knew to look.
 */
export const MEMORIZE_SKIP_FEEDBACK_COPY = {
    elapsed: 'Memorize phase over. Find the pairs.',
    started: 'Started early.',
    banked: (momentum: number): string =>
        `Banked ${momentum} momentum on the chain.`
} as const;
