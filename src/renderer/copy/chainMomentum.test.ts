import { describe, expect, it } from 'vitest';
import {
    getChainMilestonePreview,
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

    it('forecasts the next shard, the one thing a chain still pays out', () => {
        // Guard tokens and the chain heal were the other two lanes until Gen 183; with no lives
        // there is nothing for them to protect or restore, so the forecast is one cue or none.
        expect(getChainRewardForecastCues(3, 1)).toEqual([
            {
                actionLabel: 'Next',
                chaseLabel: 'Hit now',
                distance: 1,
                distanceLabel: '1 match',
                id: 'shard-4',
                label: 'x4 +1 shard',
                targetStreak: 4,
                tone: 'reward',
                urgency: 'next'
            }
        ]);
        expect(getChainRewardForecastCues(1, 1)[0]).toMatchObject({
            actionLabel: 'Next',
            distance: 1,
            id: 'shard-2',
            label: 'x2 +1 shard',
            urgency: 'next'
        });
        expect(getChainRewardForecastCues(4, 1)[0]).toMatchObject({ actionLabel: 'Soon', distance: 2, urgency: 'soon' });
        expect(getChainRewardForecastCues(3, 1).map((cue) => cue.label).join(' ')).not.toMatch(/life|guard|heal/i);
    });

    it('forecasts nothing once the shard bank is full', () => {
        expect(getChainRewardForecastCues(3, 2)).toEqual([]);
        expect(getChainRewardForecastCues(9, 3)).toEqual([]);
    });

    it('builds reward progress pips from the shard cadence', () => {
        const shardCue = getChainRewardForecastCues(3, 1)[0]!;
        expect(getChainRewardProgress(3, shardCue)).toEqual({
            filled: 1,
            label: '1/2',
            remainingLabel: '1 match left',
            targetLabel: 'x4 +1 shard',
            total: 2
        });
        expect(shardCue.stackSize).toBeUndefined();

        const nextShardCue = getChainRewardForecastCues(4, 1)[0]!;
        expect(getChainRewardProgress(4, nextShardCue)).toEqual({
            filled: 0,
            label: '0/2',
            remainingLabel: '2 matches left',
            targetLabel: 'x6 +1 shard',
            total: 2
        });
    });

    it('names arcade urgency for reward forecast chips', () => {
        expect(getChainRewardUrgencyCopy(getChainRewardForecastCues(3, 1)[0]!)).toBe('One-away cashout');
        expect(getChainRewardUrgencyCopy(getChainRewardForecastCues(4, 1)[0]!)).toBe('Combo prime');
        expect(getChainRewardUrgencyCopy({ distance: 5, tone: 'reward', urgency: 'later' })).toBe('Combo chase');
        expect(getChainRewardUrgencyCopy({ distance: 6, tone: 'reward', urgency: 'later' })).toBe('Future payoff');
        expect(getChainRewardUrgencyCopy({ distance: 1, stackSize: 2, tone: 'reward', urgency: 'next' })).toBe('Double cashout');
        expect(
            getChainRewardUrgencyCopy({
                distance: 1,
                stackSize: Number.POSITIVE_INFINITY,
                tone: 'reward',
                urgency: 'next'
            })
        ).toBe('One-away cashout');
    });

    it('names stacked reward forecast badge counts', () => {
        expect(getChainRewardStackLabel({ stackSize: 2 })).toBe('2x stack');
        expect(getChainRewardStackLabel({ stackSize: 3 })).toBe('3x stack');
        expect(getChainRewardStackLabel({ stackSize: 3.9 })).toBe('3x stack');
        expect(getChainRewardStackLabel({ stackSize: Number.POSITIVE_INFINITY })).toBeNull();
        expect(getChainRewardStackLabel({})).toBeNull();
    });

    it('names the player action for reward forecast lanes', () => {
        expect(getChainRewardLaneAction('next')).toBe('Cash next');
        expect(getChainRewardLaneAction('soon')).toBe('Prime cashout');
        expect(getChainRewardLaneAction('later')).toBe('Hold streak');
    });

    it('normalizes malformed reward forecast inputs before building visible copy', () => {
        const cues = getChainRewardForecastCues(Number.NaN, Number.NEGATIVE_INFINITY);

        expect(cues).toEqual([
            {
                actionLabel: 'Soon',
                chaseLabel: 'Prime',
                distance: 2,
                distanceLabel: '2 matches',
                id: 'shard-2',
                label: 'x2 +1 shard',
                targetStreak: 2,
                tone: 'reward',
                urgency: 'soon'
            }
        ]);
        expect(cues.map((cue) => `${cue.id} ${cue.label} ${cue.distanceLabel}`).join(' ')).not.toMatch(
            /NaN|Infinity/
        );
    });

    it('normalizes fractional and malformed progress values for reward pips', () => {
        const cue = getChainRewardForecastCues(3.9, 1.9)[0]!;

        expect(cue).toMatchObject({
            distance: 1,
            distanceLabel: '1 match',
            id: 'shard-4',
            label: 'x4 +1 shard'
        });
        expect(getChainRewardProgress(Number.POSITIVE_INFINITY, cue)).toEqual({
            filled: 0,
            label: '0/2',
            remainingLabel: '4 matches left',
            targetLabel: 'x4 +1 shard',
            total: 2
        });
    });
});
