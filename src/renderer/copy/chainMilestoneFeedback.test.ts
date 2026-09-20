import { describe, expect, it } from 'vitest';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';

describe('getChainMilestoneFeedback', () => {
    it('returns actionized feedback when crossing milestone tiers', () => {
        expect(getChainMilestoneFeedback(2, 3)).toEqual({
            action: 'Hold the chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Clean reached',
            screenCue: 'reward-loop',
            target: 'x3',
            tone: 'chain',
            value: 'Breaks reach deeper into the clump'
        });
        expect(getChainMilestoneFeedback(5, 6)).toEqual({
            action: 'Carry it into the next clump',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Sharp reached',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Breaks chain into the next clump'
        });
        expect(getChainMilestoneFeedback(9, 10)).toEqual({
            action: 'Keep the fire',
            audioCue: 'combo-hit-ping',
            beatCount: 5,
            label: 'Fever reached',
            screenCue: 'combo-live',
            target: 'x10',
            tone: 'combo',
            value: 'Breaks chain into three clumps'
        });
    });

    it('does not repeat milestone feedback after a tier is already active', () => {
        expect(getChainMilestoneFeedback(3, 4)).toBeUndefined();
        expect(getChainMilestoneFeedback(6, 7)).toBeUndefined();
        expect(getChainMilestoneFeedback(10, 11)).toBeUndefined();
    });
});
