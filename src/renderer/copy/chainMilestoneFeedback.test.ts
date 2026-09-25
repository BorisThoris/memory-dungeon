import { describe, expect, it } from 'vitest';
import { chainRungScoreMultiplier } from '../../shared/chain-rung-value-rules';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';

describe('getChainMilestoneFeedback', () => {
    it('calls out the rung the rail climbed to, with the rail\'s own multiplier', () => {
        expect(getChainMilestoneFeedback('none', 'clean')).toEqual({
            action: 'Hold the chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Clean reached',
            screenCue: 'reward-loop',
            target: `×${chainRungScoreMultiplier('clean')}`,
            tone: 'chain',
            value: `Every pair a break takes pays ×${chainRungScoreMultiplier('clean')}`
        });
        expect(getChainMilestoneFeedback('clean', 'sharp')?.label).toBe('Sharp reached');
        expect(getChainMilestoneFeedback('clean', 'sharp')?.target).toBe(`×${chainRungScoreMultiplier('sharp')}`);
        expect(getChainMilestoneFeedback('sharp', 'fever')?.label).toBe('Fever reached');
    });

    it('names the highest rung when one turn climbs two', () => {
        // A pop can carry a chain from Clean straight past Sharp; the caption said "Sharp" by the
        // streak while the rail already read Fever.
        expect(getChainMilestoneFeedback('clean', 'fever')?.label).toBe('Fever reached');
    });

    it('never quotes the streak mark as a multiplier', () => {
        // Deep playtest, floor 10: "Clean reached: x3" under a rail reading "Clean ×2".
        for (const tier of ['clean', 'sharp', 'fever'] as const) {
            expect(getChainMilestoneFeedback('none', tier)?.target).toBe(`×${chainRungScoreMultiplier(tier)}`);
        }
    });

    it('does not repeat milestone feedback after a tier is already active, or on the way down', () => {
        expect(getChainMilestoneFeedback('clean', 'clean')).toBeUndefined();
        expect(getChainMilestoneFeedback('fever', 'fever')).toBeUndefined();
        expect(getChainMilestoneFeedback('fever', 'none')).toBeUndefined();
        expect(getChainMilestoneFeedback(null, 'none')).toBeUndefined();
    });
});
