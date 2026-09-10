import { describe, expect, it } from 'vitest';
import {
    CHAIN_RUNG_PAIRS,
    CHAIN_RUNG_PAIRS_TOLERANCE,
    chainRungPairs,
    chainRungScoreMultiplier
} from './chain-rung-value-rules';
import { POP_REACH_BANDS, POP_REACH_TIERS, simulatePopReach } from './pop-reach-simulation';

describe('what the meter promises a rung is worth', () => {
    it('pays more than double what the rung below pays, which is the ladder the player feels', () => {
        // The band that matters (Gen 189). Pairs are the input and read as a dead middle rung;
        // the tier multiplies them, so the payoff ladder is healthy where the pair ladder is not.
        const { ladder } = simulatePopReach();

        for (const tier of POP_REACH_TIERS) {
            if (tier === 'none') continue;
            expect(
                ladder.scoreStep[tier],
                `${tier} pays ${ladder.scoreStep[tier].toFixed(2)}x the rung below`
            ).toBeGreaterThanOrEqual(POP_REACH_BANDS.ladderScoreMinStep.min);
        }
    });

    it('pays at least what its multiplier promises, because a rung never finds fewer pairs', () => {
        const { ladder } = simulatePopReach();

        // The measured step is the multiplier the meter shows times the pairs the rung finds, and
        // the pairs never fall going up - so the multiplier is a floor under the real payoff and
        // the number on screen never overstates the rung.
        POP_REACH_TIERS.forEach((tier, index) => {
            if (index === 0) return;
            const below = POP_REACH_TIERS[index - 1]!;
            const promised = chainRungScoreMultiplier(tier) / chainRungScoreMultiplier(below);
            expect(ladder.pairsPerMatch[tier]).toBeGreaterThanOrEqual(ladder.pairsPerMatch[below]);
            expect(
                ladder.scoreStep[tier],
                `${tier} shows x${chainRungScoreMultiplier(tier)} and pays ${ladder.scoreStep[tier].toFixed(2)}x the rung below`
            ).toBeGreaterThanOrEqual(promised);
        });
    });

    it('matches what a break at that rung actually takes, in pairs', () => {
        const { ladder } = simulatePopReach();

        for (const tier of POP_REACH_TIERS) {
            const measured = ladder.pairsPerMatch[tier];
            expect(
                Math.abs(CHAIN_RUNG_PAIRS[tier] - measured),
                `${tier} promises ${CHAIN_RUNG_PAIRS[tier]} pairs, takes ${measured.toFixed(2)}`
            ).toBeLessThanOrEqual(CHAIN_RUNG_PAIRS_TOLERANCE);
        }
    });

    it('climbs on both counts, so the rung a player reaches is always worth more', () => {
        // In pairs the ladder never goes backwards, and it is allowed to sit level for one rung:
        // Gen 198 raised the chain-one pop to 1.68 pairs against Clean's 2.17 by laying pair halves
        // apart, and both round to two. That is the case Gen 189 already ruled on - the meter shows
        // the multiplier precisely because pairs alone can read flat while the payoff doubles - so
        // the strict climb is asserted on the multiplier, and on the pairs across the whole ladder.
        expect(chainRungPairs('none')).toBeLessThanOrEqual(chainRungPairs('clean'));
        expect(chainRungPairs('clean')).toBeLessThan(chainRungPairs('sharp'));
        expect(chainRungPairs('sharp')).toBeLessThan(chainRungPairs('fever'));
        expect(chainRungScoreMultiplier('none')).toBeLessThan(chainRungScoreMultiplier('clean'));
        expect(chainRungScoreMultiplier('clean')).toBeLessThan(chainRungScoreMultiplier('sharp'));
        expect(chainRungScoreMultiplier('sharp')).toBeLessThan(chainRungScoreMultiplier('fever'));
    });
});
