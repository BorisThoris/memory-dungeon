import { describe, expect, it } from 'vitest';
import {
    getChainMilestonePreview,
    getChainMomentumCue,
    getChainMomentumLabel,
    getChainMomentumSubline,
    getChainMomentumTier
} from './chainMomentum';

describe('chainMomentum copy helpers', () => {
    it('maps streak depth into named arcade tiers', () => {
        expect(getChainMomentumTier(1)).toBe('building');
        expect(getChainMomentumTier(3)).toBe('chain');
        expect(getChainMomentumTier(6)).toBe('surge');
        expect(getChainMomentumTier(10)).toBe('combo');
        expect(getChainMomentumTier(Number.POSITIVE_INFINITY)).toBe('building');
        expect(getChainMomentumLabel('surge')).toBe('Surge');
    });

    it('announces the next visible payoff threshold', () => {
        expect(getChainMomentumCue(2)).toBe('');
        expect(getChainMomentumCue(Number.POSITIVE_INFINITY)).toBe('');
        expect(getChainMomentumCue(3)).toBe('3 matches to x6');
        expect(getChainMomentumCue(3.9)).toBe('3 matches to x6');
        expect(getChainMomentumCue(5)).toBe('1 match to x6');
        expect(getChainMomentumCue(6)).toBe('4 matches to x10');
        expect(getChainMomentumCue(9)).toBe('1 match to x10');
        expect(getChainMomentumCue(10)).toBe('Combo live');
    });

    it('lets trait route state override generic threshold copy', () => {
        expect(getChainMomentumSubline(6, true)).toBe('Trait route live');
        expect(getChainMomentumSubline(1, false)).toBe('2 matches to x3');
        expect(getChainMomentumSubline(2, false)).toBe('1 match to x3');
    });

    it('previews the next arcade chain milestone target', () => {
        expect(getChainMilestonePreview(0)).toMatchObject({
            actionLabel: 'Start chain',
            distanceLabel: '3 matches',
            label: 'Chain tier',
            target: 'x3',
            tone: 'building'
        });
        expect(getChainMilestonePreview(5)).toMatchObject({
            actionLabel: 'Push surge',
            distanceLabel: '1 match',
            label: 'Surge tier',
            target: 'x6',
            tone: 'chain'
        });
        expect(getChainMilestonePreview(7)).toMatchObject({
            actionLabel: 'Push combo',
            distanceLabel: '3 matches',
            label: 'Combo tier',
            target: 'x10',
            tone: 'surge'
        });
        expect(getChainMilestonePreview(10)).toMatchObject({
            actionLabel: 'Hold combo',
            distance: 0,
            distanceLabel: 'Combo max',
            label: 'Combo max',
            target: 'x10',
            tone: 'combo'
        });
    });
});
