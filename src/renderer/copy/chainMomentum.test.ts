import { describe, expect, it } from 'vitest';
import {
    getChainMilestonePreview,
    getChainMilestoneBeatCount,
    getChainMomentumCue,
    getChainMomentumLabel,
    getChainRewardProgress,
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy,
    getChainMomentumSubline,
    getChainMomentumTier
} from './chainMomentum';

describe('chainMomentum copy helpers', () => {
    it('maps streak depth into named arcade tiers', () => {
        expect(getChainMomentumTier(1)).toBe('building');
        expect(getChainMomentumTier(3)).toBe('chain');
        expect(getChainMomentumTier(6)).toBe('surge');
        expect(getChainMomentumTier(10)).toBe('combo');
        expect(getChainMomentumLabel('surge')).toBe('Surge');
    });

    it('announces the next visible payoff threshold', () => {
        expect(getChainMomentumCue(2)).toBe('');
        expect(getChainMomentumCue(3)).toBe('3 matches to x6');
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

    it('maps milestone distance into readable beat counts', () => {
        expect(getChainMilestoneBeatCount(0)).toBe(3);
        expect(getChainMilestoneBeatCount(2)).toBe(1);
        expect(getChainMilestoneBeatCount(5)).toBe(1);
        expect(getChainMilestoneBeatCount(7)).toBe(3);
        expect(getChainMilestoneBeatCount(10)).toBe(4);
    });

    it('forecasts the next real chain reward thresholds', () => {
        expect(getChainRewardForecastCues(3, 1, 4)).toEqual([
            {
                actionLabel: 'Next',
                chaseLabel: 'Hit now',
                distance: 1,
                distanceLabel: '1 match',
                id: 'shard-4',
                label: 'x4 +1 shard',
                stackSize: 2,
                targetStreak: 4,
                tone: 'reward',
                urgency: 'next'
            },
            {
                actionLabel: 'Next',
                chaseLabel: 'Hit now',
                distance: 1,
                distanceLabel: '1 match',
                id: 'guard-4',
                label: 'x4 +1 guard',
                stackSize: 2,
                targetStreak: 4,
                tone: 'guard',
                urgency: 'next'
            },
            {
                actionLabel: 'Later',
                chaseLabel: 'Hold streak',
                distance: 5,
                distanceLabel: '5 matches',
                id: 'heal-8',
                label: 'x8 +1 life',
                targetStreak: 8,
                tone: 'heal',
                urgency: 'later'
            }
        ]);
        expect(getChainRewardForecastCues(1, 2, 4)[0]).toEqual({
            actionLabel: 'Next',
            chaseLabel: 'Hit now',
            distance: 1,
            distanceLabel: '1 match',
            id: 'shard-life-2',
            label: 'x2 +1 life',
            targetStreak: 2,
            tone: 'heal',
            urgency: 'next'
        });
    });

    it('builds reward progress pips from the active reward cadence', () => {
        const shardCue = getChainRewardForecastCues(3, 1, 4)[0]!;
        expect(getChainRewardProgress(3, shardCue)).toEqual({
            filled: 1,
            label: '1/2',
            remainingLabel: '1 match left',
            targetLabel: 'x4 +1 shard',
            total: 2
        });
        expect(shardCue.stackSize).toBe(2);

        const singleShardCue = getChainRewardForecastCues(4, 1, 4)[0]!;
        expect(singleShardCue.stackSize).toBeUndefined();
        expect(getChainRewardProgress(4, singleShardCue)).toEqual({
            filled: 0,
            label: '0/2',
            remainingLabel: '2 matches left',
            targetLabel: 'x6 +1 shard',
            total: 2
        });

        const guardCue = getChainRewardForecastCues(5, 2, 4).find((cue) => cue.tone === 'guard')!;
        expect(getChainRewardProgress(5, guardCue)).toMatchObject({
            filled: 1,
            label: '1/4',
            remainingLabel: '3 matches left',
            targetLabel: 'x8 +1 guard',
            total: 4
        });

        const healCue = getChainRewardForecastCues(1, 2, 4)[0]!;
        expect(getChainRewardProgress(1, healCue)).toEqual({
            filled: 1,
            label: '1/2',
            remainingLabel: '1 match left',
            targetLabel: 'x2 +1 life',
            total: 2
        });
    });

    it('names arcade urgency for reward forecast chips', () => {
        expect(getChainRewardUrgencyCopy(getChainRewardForecastCues(3, 1, 4)[0]!)).toBe('Double cashout');
        expect(getChainRewardUrgencyCopy(getChainRewardForecastCues(5, 1, 4).find((cue) => cue.tone === 'guard')!)).toBe('Double prime');
        expect(getChainRewardUrgencyCopy(getChainRewardForecastCues(3, 1, 4).find((cue) => cue.tone === 'heal')!)).toBe('Combo chase');
    });

    it('names stacked reward forecast badge counts', () => {
        expect(getChainRewardStackLabel({ stackSize: 2 })).toBe('2x stack');
        expect(getChainRewardStackLabel({ stackSize: 3 })).toBe('3x stack');
        expect(getChainRewardStackLabel({})).toBeNull();
    });

    it('names the player action for reward forecast lanes', () => {
        expect(getChainRewardLaneAction('next')).toBe('Cash next');
        expect(getChainRewardLaneAction('soon')).toBe('Prime cashout');
        expect(getChainRewardLaneAction('later')).toBe('Hold streak');
    });
});
