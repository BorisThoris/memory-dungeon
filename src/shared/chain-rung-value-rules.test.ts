import { describe, expect, it } from 'vitest';
import { CHAIN_RUNG_PAIRS, CHAIN_RUNG_PAIRS_TOLERANCE, chainRungPips } from './chain-rung-value-rules';
import { POP_REACH_TIERS, simulatePopReach } from './pop-reach-simulation';

describe('what the meter promises a rung is worth', () => {
    it('matches what a break at that rung actually takes', () => {
        // The meter is a promise about the rule. This is the measurement that keeps it one: the
        // same simulation `yarn sim:pop` runs, against the constant the HUD draws.
        const { ladder } = simulatePopReach();

        for (const tier of POP_REACH_TIERS) {
            const measured = ladder.pairsPerMatch[tier];
            expect(
                Math.abs(CHAIN_RUNG_PAIRS[tier] - measured),
                `${tier} promises ${CHAIN_RUNG_PAIRS[tier]} pairs, takes ${measured.toFixed(2)}`
            ).toBeLessThanOrEqual(CHAIN_RUNG_PAIRS_TOLERANCE);
        }
    });

    it('climbs, so the cluster a player watches grows with the chain', () => {
        expect(chainRungPips('none')).toBeLessThan(chainRungPips('clean'));
        expect(chainRungPips('clean')).toBeLessThanOrEqual(chainRungPips('sharp'));
        expect(chainRungPips('sharp')).toBeLessThan(chainRungPips('fever'));
    });
});
