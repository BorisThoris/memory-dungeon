import { describe, expect, it } from 'vitest';
import { matchScoreFloaterLiveRegionText } from './matchScoreFloater';

describe('matchScoreFloaterLiveRegionText', () => {
    it('formats amount with locale stringing', () => {
        expect(matchScoreFloaterLiveRegionText(99)).toMatch(/^Plus 99 points$/);
    });

    it('normalizes malformed amount before announcing score text', () => {
        expect(matchScoreFloaterLiveRegionText(Number.NaN)).toBe('Plus 0 points');
        expect(matchScoreFloaterLiveRegionText(Number.POSITIVE_INFINITY, [], 'Score pop', Number.NaN)).toBe(
            'Score pop. Plus 0 points'
        );
        expect(matchScoreFloaterLiveRegionText(25, [], 'Combo', Number.POSITIVE_INFINITY)).toBe(
            'Combo. Plus 25 points'
        );
    });

    it('includes trait interaction text when present', () => {
        expect(matchScoreFloaterLiveRegionText(99, ['Echo + Sealed: combo shard'])).toBe(
            'Plus 99 points. Echo + Sealed: combo shard'
        );
    });

    it('announces arcade feedback headline before the score when present', () => {
        expect(matchScoreFloaterLiveRegionText(99, ['Echo + Sealed: combo shard'], 'Surge', 6)).toBe(
            'Surge. Plus 99 points. 6 match streak, 4 matches to x10. Echo + Sealed: combo shard'
        );
    });

    it('announces when a high chain has reached the combo tier', () => {
        expect(matchScoreFloaterLiveRegionText(150, [], 'Combo', 10)).toBe(
            'Combo. Plus 150 points. 10 match streak, Combo live'
        );
    });

    it('announces upcoming chain reward forecast for accessible payoff feedback', () => {
        expect(
            matchScoreFloaterLiveRegionText(99, ['Shard spark +1 combo shard'], 'Chain', 4, [
                'Prime cashout: 2 matches to x6 +1 shard',
                'Hold streak: 4 matches to x8 +1 guard'
            ])
        ).toBe(
            'Chain. Plus 99 points. 4 match streak, 2 matches to x6. Next rewards: Prime cashout: 2 matches to x6 +1 shard, Hold streak: 4 matches to x8 +1 guard. Shard spark +1 combo shard'
        );
    });

    it('announces reward burst text before detailed payoff lines', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                99,
                ['Shard spark +1 combo shard'],
                'Reward',
                6,
                [],
                'Reward burst: Stack cashout: 2-way payoff'
            )
        ).toBe(
            'Reward. Plus 99 points. 6 match streak, 4 matches to x10. Reward burst: Stack cashout: 2-way payoff. Shard spark +1 combo shard'
        );
    });

    it('announces cascade text before reward burst details', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                99,
                ['Shard spark +1 combo shard'],
                'Reward',
                6,
                [],
                'Reward burst: Stack cashout: 2-way payoff',
                'Cascade: reward cascade'
            )
        ).toBe(
            'Reward. Plus 99 points. 6 match streak, 4 matches to x10. Cascade: reward cascade. Reward burst: Stack cashout: 2-way payoff. Shard spark +1 combo shard'
        );
    });

    it('announces payoff summary before detailed payoff lines', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Greed Cache +2 gold +25 score', 'Shard spark +1 combo shard'],
                'Reward',
                4,
                ['Prime cashout: 2 matches to x6 +1 shard'],
                'Combo burst: Cash stack: 4-way payoff',
                'Cascade: combo cascade',
                'Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Next rewards: Prime cashout: 2 matches to x6 +1 shard. Cascade: combo cascade. Combo burst: Cash stack: 4-way payoff. Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain. Greed Cache +2 gold +25 score. Shard spark +1 combo shard'
        );
    });

    it('announces four-lane payoffs as a super stack', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Greed Cache +2 gold +25 score', 'Shard spark +1 combo shard'],
                'Reward',
                4,
                ['Prime cashout: 2 matches to x6 +1 shard'],
                'Super stack: Cash super stack: 4-way payoff',
                'Cascade: combo cascade',
                'Super stack: 4 payoffs: Route + Pickup + Trait + Chain',
                'Super stack'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Next rewards: Prime cashout: 2 matches to x6 +1 shard. Cascade: combo cascade. Super stack: Cash super stack: 4-way payoff. Super stack: 4 payoffs: Route + Pickup + Trait + Chain. Impact cue: Super stack. Greed Cache +2 gold +25 score. Shard spark +1 combo shard'
        );
    });

    it('announces trait surge payoff summaries before individual trait lines', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                80,
                ['Perk pop: Echo Conduit Lens doubles the route', 'Perk pop: Trait Streak Lens flashes a pair'],
                'Combo',
                3,
                [],
                'Combo burst: Cash stack: 3-way payoff',
                'Cascade: combo cascade',
                'Perk surge: 2 perk pops'
            )
        ).toBe(
            'Combo. Plus 80 points. 3 match streak, 3 matches to x6. Cascade: combo cascade. Combo burst: Cash stack: 3-way payoff. Perk surge: 2 perk pops. Perk pop: Echo Conduit Lens doubles the route. Perk pop: Trait Streak Lens flashes a pair'
        );
    });

    it('announces the compact impact cue after payoff summary context', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Shard spark +1 combo shard'],
                'Reward',
                4,
                ['Prime cashout: 2 matches to x6 +1 shard'],
                'Combo burst: Cash stack: 4-way payoff',
                'Cascade: combo cascade',
                'Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain',
                'Stack cashout'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Next rewards: Prime cashout: 2 matches to x6 +1 shard. Cascade: combo cascade. Combo burst: Cash stack: 4-way payoff. Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain. Impact cue: Stack cashout. Shard spark +1 combo shard'
        );
    });

    it('announces crescendo separately from the impact cue', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Shard spark +1 combo shard'],
                'Reward',
                4,
                [],
                'Reward burst: Stack cashout: 2-way payoff',
                undefined,
                'Stack cashout: 2 payoffs: Pickup + Chain',
                'Stack cashout',
                undefined,
                undefined,
                'Stack burst: 2 payoff lanes'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Reward burst: Stack cashout: 2-way payoff. Stack cashout: 2 payoffs: Pickup + Chain. Crescendo: Stack burst: 2 payoff lanes. Impact cue: Stack cashout. Shard spark +1 combo shard'
        );
    });

    it('announces actionized chain milestones before crescendo detail', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Shard spark +1 combo shard'],
                'Surge',
                6,
                [],
                undefined,
                undefined,
                undefined,
                'Prime chain',
                undefined,
                undefined,
                'Surge burst: 4 payoff beats',
                'Push surge: Surge hit: x6: Surge tier live. 4 beats.'
            )
        ).toBe(
            'Surge. Plus 125 points. 6 match streak, 4 matches to x10. Chain milestone: Push surge: Surge hit: x6: Surge tier live. 4 beats. Crescendo: Surge burst: 4 payoff beats. Impact cue: Prime chain. Shard spark +1 combo shard'
        );
    });

    it('announces payoff lane maps before detailed payoff lines', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Shard spark +1 combo shard'],
                'Reward',
                4,
                ['Prime cashout: 2 matches to x6 +1 shard'],
                'Combo burst: Cash stack: 4-way payoff',
                'Cascade: combo cascade',
                'Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain',
                'Stack cashout',
                'Match payoff lane map. Route: 1. Route cashout. Pickup: 1. Pickup cashout. Chain: 1. Chain cashout.'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Next rewards: Prime cashout: 2 matches to x6 +1 shard. Cascade: combo cascade. Combo burst: Cash stack: 4-way payoff. Stack cashout: 4 payoffs: Route + Pickup + Trait + Chain. Impact cue: Stack cashout. Match payoff lane map. Route: 1. Cash route. Route cashout. Pickup: 1. Claim pickup. Pickup cashout. Chain: 1. Cash chain. Chain cashout. Shard spark +1 combo shard'
        );
    });

    it('does not duplicate explicit payoff lane actions in live text', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Shard spark +1 combo shard'],
                'Reward',
                4,
                [],
                undefined,
                undefined,
                undefined,
                'Stack cashout',
                'Match payoff lane map. Route: 1. Cash route. Route cashout. Pickup: 1. Claim pickup. Pickup cashout.'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Impact cue: Stack cashout. Match payoff lane map. Route: 1. Cash route. Route cashout. Pickup: 1. Claim pickup. Pickup cashout. Shard spark +1 combo shard'
        );
    });

    it('announces trait lane maps before detailed trait lines', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Echo + Sealed: combo shard', 'Mirror + Stasis: guard ward'],
                'Reward',
                4,
                [],
                undefined,
                undefined,
                undefined,
                'Trait cashout',
                'Match payoff lane map. Trait: 2. Trait cashout.',
                'Match trait interaction lanes. Shard: 1. Echo + Sealed: combo shard. Guard: 1. Mirror + Stasis: guard ward.'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Impact cue: Trait cashout. Match payoff lane map. Trait: 2. Cash trait. Trait cashout. Match trait interaction lanes. Shard: 1. Cash shard. Echo + Sealed: combo shard. Guard: 1. Protect run. Mirror + Stasis: guard ward. Echo + Sealed: combo shard. Mirror + Stasis: guard ward'
        );
    });

    it('does not duplicate explicit trait lane actions in live text', () => {
        expect(
            matchScoreFloaterLiveRegionText(
                125,
                ['Echo + Sealed: combo shard'],
                'Reward',
                4,
                [],
                undefined,
                undefined,
                undefined,
                'Trait cashout',
                undefined,
                'Match trait interaction lanes. Shard: 1. Cash shard. Echo + Sealed: combo shard.'
            )
        ).toBe(
            'Reward. Plus 125 points. 4 match streak, 2 matches to x6. Impact cue: Trait cashout. Match trait interaction lanes. Shard: 1. Cash shard. Echo + Sealed: combo shard. Echo + Sealed: combo shard'
        );
    });

    it('does not announce low-depth streak noise for ordinary matches', () => {
        expect(matchScoreFloaterLiveRegionText(99, [], 'Score pop', 2)).toBe('Score pop. Plus 99 points');
    });

    it('floors fractional chain depth before announcing streak copy', () => {
        expect(matchScoreFloaterLiveRegionText(99, [], 'Chain', 3.9)).toBe(
            'Chain. Plus 99 points. 3 match streak, 3 matches to x6'
        );
    });
});
