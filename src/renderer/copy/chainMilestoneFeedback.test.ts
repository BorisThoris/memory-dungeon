import { describe, expect, it } from 'vitest';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';

describe('getChainMilestoneFeedback', () => {
    it('returns actionized feedback when crossing milestone tiers', () => {
        expect(getChainMilestoneFeedback(2, 3)).toEqual({
            action: 'Start chain',
            audioCue: 'chain-start-ping',
            beatCount: 3,
            label: 'Chain started',
            screenCue: 'reward-loop',
            target: 'x3',
            tone: 'chain',
            value: 'Reward loop online'
        });
        expect(getChainMilestoneFeedback(5, 6)).toEqual({
            action: 'Push surge',
            audioCue: 'surge-hit-ping',
            beatCount: 4,
            label: 'Surge hit',
            screenCue: 'surge-live',
            target: 'x6',
            tone: 'surge',
            value: 'Surge tier live'
        });
        expect(getChainMilestoneFeedback(9, 10)).toEqual({
            action: 'Hold combo',
            audioCue: 'combo-hit-ping',
            beatCount: 5,
            label: 'Combo hit',
            screenCue: 'combo-live',
            target: 'x10',
            tone: 'combo',
            value: 'Combo tier live'
        });
    });

    it('does not repeat milestone feedback after a tier is already active', () => {
        expect(getChainMilestoneFeedback(3, 4)).toBeUndefined();
        expect(getChainMilestoneFeedback(6, 7)).toBeUndefined();
        expect(getChainMilestoneFeedback(10, 11)).toBeUndefined();
    });
});
