import { describe, expect, it } from 'vitest';
import { CHAIN_TIER_CLEAN_FROM, getChainTier } from './chain-tier-rules';
import {
    MEMORIZE_SKIP_FULL_SHARE,
    MEMORIZE_SKIP_MIN_SHARE,
    MEMORIZE_SKIP_MOMENTUM_MAX,
    memorizeSkipReward
} from './memorize-skip-reward-rules';

const WINDOW = 10_000;
const share = (value: number): number => Math.round(WINDOW * value);

describe('what a skipped study period pays', () => {
    it('pays nothing for a tap as the clock runs out', () => {
        expect(memorizeSkipReward(0, WINDOW).momentum).toBe(0);
        expect(memorizeSkipReward(share(MEMORIZE_SKIP_MIN_SHARE) - 1, WINDOW).momentum).toBe(0);
    });

    it('pays once the player hands back a fifth of the window', () => {
        expect(memorizeSkipReward(share(MEMORIZE_SKIP_MIN_SHARE), WINDOW).momentum).toBe(1);
    });

    it('pays in full for handing back more than half', () => {
        expect(memorizeSkipReward(share(MEMORIZE_SKIP_FULL_SHARE), WINDOW).momentum).toBe(
            MEMORIZE_SKIP_MOMENTUM_MAX
        );
        expect(memorizeSkipReward(WINDOW, WINDOW).momentum).toBe(MEMORIZE_SKIP_MOMENTUM_MAX);
    });

    it('never pays more than the ceiling, whatever the clock says', () => {
        for (const remaining of [WINDOW, WINDOW * 4, Number.MAX_SAFE_INTEGER]) {
            expect(memorizeSkipReward(remaining, WINDOW).momentum).toBeLessThanOrEqual(
                MEMORIZE_SKIP_MOMENTUM_MAX
            );
        }
    });

    /*
     * The rule the whole design rests on. If a skip could reach the first rung by itself, the
     * gesture would stop being a head start and become a way to buy a tier without playing: every
     * floor would open at Clean, and the ladder would no longer measure what it claims to.
     */
    it('cannot reach a chain tier on its own', () => {
        expect(MEMORIZE_SKIP_MOMENTUM_MAX).toBeLessThan(CHAIN_TIER_CLEAN_FROM);
        expect(getChainTier(MEMORIZE_SKIP_MOMENTUM_MAX, 12)).toBe('none');
    });

    it('shortens the climb to the first rung rather than skipping it', () => {
        const banked = memorizeSkipReward(WINDOW, WINDOW).momentum;
        // One real match on top of a full payout is what the first rung now costs.
        expect(getChainTier(banked + 1, 12)).toBe('clean');
    });

    it('pays nothing rather than dividing by a window that is not there', () => {
        for (const window of [0, -1, null, undefined, Number.NaN]) {
            const reward = memorizeSkipReward(5_000, window);
            expect(reward.momentum).toBe(0);
            expect(reward.returnedShare).toBe(0);
        }
    });

    it('treats a clock with more left than the window as a full window', () => {
        expect(memorizeSkipReward(WINDOW * 3, WINDOW).returnedShare).toBe(1);
    });

    it('reads a missing or nonsense clock as no time returned', () => {
        for (const remaining of [null, undefined, Number.NaN, -500]) {
            expect(memorizeSkipReward(remaining, WINDOW).momentum).toBe(0);
        }
    });
});
