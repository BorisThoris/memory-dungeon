import { describe, expect, it } from 'vitest';
import { getChainTargetFeedback } from './chain-targets';

describe('chain target feedback', () => {
    it('maps streak depth to durable next-run chase targets', () => {
        expect(getChainTargetFeedback(0)).toMatchObject({
            band: 'seed',
            value: 'Start x3 loop',
            payoffValue: 'x3 next'
        });
        expect(getChainTargetFeedback(5)).toMatchObject({
            band: 'reward',
            value: 'Push x6 reward',
            payoffValue: 'x6 next'
        });
        expect(getChainTargetFeedback(8)).toMatchObject({
            band: 'combo',
            value: 'Break into x10',
            payoffValue: 'x10 next'
        });
        expect(getChainTargetFeedback(12)).toMatchObject({
            band: 'mastery',
            value: 'Hold x10 pressure',
            payoffValue: 'hold x10'
        });
    });
});
