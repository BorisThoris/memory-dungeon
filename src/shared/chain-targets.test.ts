import { describe, expect, it } from 'vitest';
import { getChainTargetFeedback } from './chain-targets';
import { chainRungScoreMultiplier } from './chain-rung-value-rules';

describe('chain target feedback', () => {
    it('names the next rung of the ladder the HUD shows, not a chain economy of its own', () => {
        expect(getChainTargetFeedback(0)).toMatchObject({
            band: 'seed',
            value: 'Reach Clean',
            payoffValue: 'Clean next'
        });
        expect(getChainTargetFeedback(0).detail).toMatch(/^No chain yet\./u);
        expect(getChainTargetFeedback(2).detail).toMatch(/^Best chain ×2\./u);
        expect(getChainTargetFeedback(5)).toMatchObject({
            band: 'reward',
            value: 'Reach Sharp',
            payoffValue: 'Sharp next'
        });
        expect(getChainTargetFeedback(8)).toMatchObject({
            band: 'combo',
            value: 'Reach Fever',
            payoffValue: 'Fever next'
        });
        expect(getChainTargetFeedback(12)).toMatchObject({
            band: 'mastery',
            value: 'Hold Fever',
            payoffValue: 'hold Fever'
        });
    });

    it('quotes the pay a rung actually carries', () => {
        expect(getChainTargetFeedback(5).detail).toContain(`pays ×${chainRungScoreMultiplier('sharp')} a pair`);
        expect(getChainTargetFeedback(8).detail).toContain(`pays ×${chainRungScoreMultiplier('fever')} a pair`);
    });

    it('reads the rung the run reached, not the streak alone', () => {
        // Two matches whose breaks took two more pairs: the HUD said Sharp, the clear paid Sharp.
        expect(getChainTargetFeedback(2, 'sharp')).toMatchObject({ band: 'combo', value: 'Reach Fever' });
        expect(getChainTargetFeedback(3, 'fever')).toMatchObject({ band: 'mastery', value: 'Hold Fever' });
        // A reached rung never lowers what the streak alone already shows.
        expect(getChainTargetFeedback(12, 'clean')).toMatchObject({ band: 'mastery' });
        expect(getChainTargetFeedback(2, null)).toMatchObject({ band: 'seed' });
    });
});
