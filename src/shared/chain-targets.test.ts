import { describe, expect, it } from 'vitest';
import { getChainTargetFeedback } from './chain-targets';
import { chainRungScoreMultiplier } from './chain-rung-value-rules';
import { getChainTier } from './chain-tier-rules';

describe('chain target feedback', () => {
    it('names the next rung of the ladder the HUD shows, not a chain economy of its own', () => {
        expect(getChainTargetFeedback(0)).toMatchObject({
            band: 'seed',
            value: 'Reach Clean',
            payoffValue: 'Clean next'
        });
        expect(getChainTargetFeedback(0).detail).toMatch(/^No chain yet\./u);
        expect(getChainTargetFeedback(2).detail).toMatch(/^Best chain: 2 matches in a row\./u);
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
        expect(getChainTargetFeedback(5).detail).toContain(`Popped pairs score ×${chainRungScoreMultiplier('sharp')}`);
        expect(getChainTargetFeedback(8).detail).toContain(`Popped pairs score ×${chainRungScoreMultiplier('fever')}`);
        expect(getChainTargetFeedback(5).detail).toContain('up to 2 extra pairs and ripple through the same suit');
        expect(getChainTargetFeedback(8).detail).toContain('up to 4 extra pairs and bridge into a neighbouring suit');
    });

    it('reads the rung the run reached, not the streak alone', () => {
        // Two matches whose breaks took two more pairs: the HUD said Sharp, the clear paid Sharp.
        expect(getChainTargetFeedback(2, 'sharp')).toMatchObject({ band: 'combo', value: 'Reach Fever' });
        expect(getChainTargetFeedback(3, 'fever')).toMatchObject({ band: 'mastery', value: 'Hold Fever' });
        // A bigger board needs more momentum: do not promote an earned Clean to inferred Fever.
        expect(getChainTargetFeedback(12, 'clean')).toMatchObject({ band: 'reward', value: 'Reach Sharp' });
        expect(getChainTargetFeedback(2, null)).toMatchObject({ band: 'seed' });
    });

    it('follows the actual ladder on large boards rather than skipping the next tier', () => {
        const reached = getChainTier(8, 24);
        expect(reached).toBe('clean');
        expect(getChainTargetFeedback(8, reached).value).toBe('Reach Sharp');
        expect(getChainTargetFeedback(14, getChainTier(14, 24)).value).toBe('Reach Fever');
        expect(getChainTargetFeedback(18, getChainTier(18, 24)).value).toBe('Hold Fever');
    });

    it('keeps inference available for legacy summaries without an earned tier', () => {
        expect(getChainTargetFeedback(8).value).toBe('Reach Fever');
        expect(getChainTargetFeedback(8, null).value).toBe('Reach Fever');
        expect(getChainTargetFeedback(0, 'none').value).toBe('Reach Clean');
    });
});
