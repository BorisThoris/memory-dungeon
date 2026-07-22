import { describe, expect, it } from 'vitest';
import type { RunSummary } from '../../shared/contracts';
import {
    formatRunPayoffLaneMapAttr,
    formatRunPayoffLaneActionMapAttr,
    formatRunPayoffLaneMapLabel,
    formatRunPayoffBurstSignalLabel,
    formatRunPayoffCrescendoSignalLabel,
    formatRunPayoffSequenceSignalLabel,
    formatRunPayoffSignalsLabel,
    getRunPayoffLaneBeatCount,
    getRunPayoffLaneMap,
    getRunPayoffBurstSignal,
    getRunPayoffCrescendoSignal,
    getRunPayoffSequenceSignal,
    getRunPayoffSignalBeatCount,
    getRunPayoffSignals
} from './runPayoffSignals';

const summaryFixture = (overrides: Partial<RunSummary> = {}): RunSummary => ({
    totalScore: 1000,
    bestScore: 1000,
    levelsCleared: 2,
    highestLevel: 3,
    achievementsEnabled: true,
    unlockedAchievements: [],
    bestStreak: 0,
    perfectClears: 0,
    ...overrides
});

describe('runPayoffSignals', () => {
    it('prioritizes route cashout, combo chain, pickups, and build signals', () => {
        const rows = getRunPayoffSignals(
            summaryFixture({
                bestStreak: 11,
                perfectClears: 1,
                relicIds: ['extra_shuffle_charge']
            }),
            {
                pickupClaimed: 2,
                pickupTotal: 3,
                rewardPerkCount: 1,
                routePaid: true,
                routeRewardText: '+1 combo shard'
            }
        );

        expect(rows.map((row) => row.id)).toEqual([
            'combo-tier',
            'route-cashout',
            'pickup-claim',
            'perfect-clears',
            'build-engines'
        ]);
        expect(rows[0]).toMatchObject({ label: 'Combo tier', value: 'x11', tone: 'chain' });
        expect(rows[0]).toMatchObject({
            action: 'Protect chain',
            audioCue: 'run-payoff-chain',
            screenCue: 'burst'
        });
        expect(rows[0]).toMatchObject({ arcadeCue: 'Combo live' });
        expect(rows[1]).toMatchObject({ label: 'Route paid', value: '+1 combo shard', tone: 'reward' });
        expect(rows[1]).toMatchObject({
            action: 'Cash reward',
            audioCue: 'run-payoff-cashout',
            screenCue: 'burst'
        });
        expect(rows[1]).toMatchObject({ arcadeCue: 'Route cashout' });
        expect(rows[1]).toMatchObject({ nextCue: 'Keep feeding the route that paid out' });
        expect(rows[2]).toMatchObject({ arcadeCue: 'Left value' });
        expect(rows[4]).toMatchObject({ label: 'Prime online', value: '2', tone: 'build' });
        expect(rows[4]).toMatchObject({ arcadeCue: 'Perk online' });
        expect(getRunPayoffBurstSignal(rows)).toEqual({
            action: 'Rebuild super stack',
            label: 'Super stack',
            tone: 'super',
            value: '5 payoffs'
        });
        expect(formatRunPayoffBurstSignalLabel('Collection payoff burst', getRunPayoffBurstSignal(rows))).toBe(
            'Collection payoff burst. Super stack: Rebuild super stack. 5 payoffs.'
        );
        expect(getRunPayoffCrescendoSignal(rows)).toEqual({
            audioCue: 'super-burst',
            beatCount: 5,
            detail: 'Archive this route as a full payoff stack to rebuild next run',
            label: 'Super burst',
            screenCue: 'super',
            tier: 'super'
        });
        expect(formatRunPayoffCrescendoSignalLabel('Collection payoff crescendo', getRunPayoffCrescendoSignal(rows))).toBe(
            'Collection payoff crescendo. Super burst: Archive this route as a full payoff stack to rebuild next run. 5 beats.'
        );
        expect(getRunPayoffSequenceSignal(rows)).toEqual({
            first: 'Route cashout: +1 combo shard',
            keep: 'Draft and shop around these payoff routes',
            then: 'Claim visible rewards before leaving',
            tone: 'super'
        });
        expect(formatRunPayoffSequenceSignalLabel('Collection payoff sequence', getRunPayoffSequenceSignal(rows))).toBe(
            'Collection payoff sequence. First: Route cashout: +1 combo shard. Then: Claim visible rewards before leaving. Keep: Draft and shop around these payoff routes.'
        );
        const laneMap = getRunPayoffLaneMap(rows);
        expect(laneMap).toEqual([
            { action: 'Protect chain', count: 1, cue: 'Combo live', id: 'chain', label: 'Chain' },
            { action: 'Cash reward', count: 2, cue: 'Route cashout', id: 'cash', label: 'Cash' },
            { action: 'Build route', count: 1, cue: 'Perk online', id: 'build', label: 'Build' },
            { action: 'Reduce risk', count: 1, cue: 'Left value', id: 'risk', label: 'Risk' }
        ]);
        expect(formatRunPayoffLaneMapAttr(laneMap)).toBe('chain:1>cash:2>build:1>risk:1');
        expect(formatRunPayoffLaneActionMapAttr(laneMap)).toBe(
            'chain:Protect chain:1>cash:Cash reward:2>build:Build route:1>risk:Reduce risk:1'
        );
        expect(formatRunPayoffLaneMapLabel('Collection payoff lanes', laneMap)).toBe(
            'Collection payoff lanes. Chain: 1. Protect chain. Combo live. Cash: 2. Cash reward. Route cashout. Build: 1. Build route. Perk online. Risk: 1. Reduce risk. Left value.'
        );
        expect(getRunPayoffSignalBeatCount(rows[0])).toBe(4);
        expect(getRunPayoffSignalBeatCount(rows.find((row) => row.id === 'pickup-claim')!)).toBe(3);
        expect(getRunPayoffLaneBeatCount(laneMap.find((lane) => lane.id === 'cash')!)).toBe(4);
        expect(getRunPayoffLaneBeatCount(laneMap.find((lane) => lane.id === 'risk')!)).toBe(2);
    });

    it('keeps low-information runs actionable with chain seed and score bank signals', () => {
        const rows = getRunPayoffSignals(summaryFixture({ bestStreak: 1, totalScore: 250 }));

        expect(rows).toMatchObject([
            {
                action: 'Protect chain',
                audioCue: 'run-payoff-chain',
                id: 'chain-seed',
                arcadeCue: 'Prime chain',
                label: 'Chain primer',
                nextCue: 'Open with safe matches before chasing bonuses',
                screenCue: 'pulse',
                value: 'x1',
                tone: 'chain'
            },
            {
                action: 'Bank score',
                audioCue: 'run-payoff-score',
                id: 'score-bank',
                arcadeCue: 'Score banked',
                label: 'Score pop bank',
                nextCue: 'Push streaks for bigger score pops',
                screenCue: 'burst',
                value: '250',
                tone: 'reward'
            }
        ]);
        expect(formatRunPayoffSignalsLabel('Recent run payoff signals', rows)).toBe(
            'Recent run payoff signals. Prime chain: Chain primer: x1. Next: Open with safe matches before chasing bonuses. Score banked: Score pop bank: 250. Next: Push streaks for bigger score pops.'
        );
        expect(getRunPayoffBurstSignal(rows)).toBeNull();
        expect(getRunPayoffCrescendoSignal(rows)).toEqual({
            audioCue: 'prime-pop',
            beatCount: 2,
            detail: 'A payoff lane is seeded for the next run',
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        });
        expect(getRunPayoffSequenceSignal(rows)).toEqual({
            first: 'Score banked: 250',
            keep: 'Open with safe matches before chasing bonuses',
            then: 'Open with safe matches before chasing bonuses',
            tone: 'reward'
        });
    });

    it('rebuilds archive payoff lanes from summary counters', () => {
        const rows = getRunPayoffSignals(
            summaryFixture({
                bestStreak: 12,
                perfectClears: 2,
                relicIds: ['extra_shuffle_charge'],
                payoffPickupClaimed: 2,
                payoffPickupTotal: 2,
                payoffRewardPerkCount: 1,
                payoffRoutePaid: true,
                payoffRouteRewardText: '+1 combo shard'
            })
        );

        expect(rows.map((row) => row.id)).toEqual([
            'combo-tier',
            'route-cashout',
            'pickup-claim',
            'perfect-clears',
            'build-engines'
        ]);
        expect(rows[1]).toMatchObject({ value: '+1 combo shard', tone: 'reward' });
        expect(rows[2]).toMatchObject({ arcadeCue: 'Claimed all', value: '2/2', tone: 'reward' });
        expect(getRunPayoffBurstSignal(rows)).toEqual({
            action: 'Rebuild super stack',
            label: 'Super stack',
            tone: 'super',
            value: '5 payoffs'
        });
        expect(getRunPayoffCrescendoSignal(rows)).toMatchObject({
            beatCount: 5,
            label: 'Super burst',
            tier: 'super'
        });
        expect(getRunPayoffSequenceSignal(rows)).toMatchObject({
            first: 'Route cashout: +1 combo shard',
            keep: 'Draft and shop around these payoff routes',
            then: 'Keep claiming before exit',
            tone: 'super'
        });
    });

    it('ignores malformed summary arrays before deriving payoff signal counts', () => {
        const rows = getRunPayoffSignals(
            summaryFixture({
                activeMutators: Number.NaN as unknown as RunSummary['activeMutators'],
                relicIds: Number.NaN as unknown as RunSummary['relicIds']
            })
        );

        expect(rows.map((row) => row.id)).toEqual(['chain-seed', 'score-bank']);
        expect(rows.map((row) => row.id)).not.toContain('build-engines');
        expect(rows.map((row) => row.id)).not.toContain('pressure-burst');
        expect(rows.map((row) => row.value).join(' ')).not.toMatch(/NaN|Infinity/);
    });

    it('can add a next chain target for recent-run archive surfaces', () => {
        const rows = getRunPayoffSignals(summaryFixture({ bestStreak: 7 }), { includeChainTarget: true });

        expect(rows.map((row) => row.id)).toContain('chain-next-target');
        expect(rows.find((row) => row.id === 'chain-threshold')).toMatchObject({
            arcadeCue: 'Chain cashout',
            label: 'Chain cashout',
            nextCue: 'Repeat the cashout, then push the next reward threshold',
            value: 'x7',
            tone: 'chain'
        });
        expect(rows.find((row) => row.id === 'chain-next-target')).toMatchObject({
            arcadeCue: 'Next chase',
            label: 'Chain chase',
            value: 'x10 next',
            tone: 'chain'
        });
        expect(getRunPayoffCrescendoSignal(rows)).toMatchObject({
            beatCount: 3,
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        });
    });

    it('uses cashout language for early reward-band streaks', () => {
        const rows = getRunPayoffSignals(summaryFixture({ bestStreak: 4 }));

        expect(rows[0]).toMatchObject({
            arcadeCue: 'Chain cashout',
            label: 'Chain burst',
            nextCue: 'Push the next chain reward threshold',
            value: 'x4',
            tone: 'chain'
        });
        expect(getRunPayoffCrescendoSignal(rows)).toMatchObject({
            audioCue: 'cashout-pop',
            beatCount: 3,
            label: 'Cashout beat',
            tier: 'cashout'
        });
    });

    it('uses prime language for payoff stacks without an active chain lane', () => {
        const rows = [
            { id: 'route-cashout', tone: 'reward' },
            { id: 'perfect-clears', tone: 'reward' },
            { id: 'build-engines', tone: 'build' }
        ] as const;

        expect(getRunPayoffBurstSignal(rows)).toEqual({
            action: 'Prime next',
            label: 'Payoff stack',
            tone: 'reward',
            value: '3 payoffs'
        });
        expect(getRunPayoffCrescendoSignal(rows)).toEqual({
            audioCue: 'stack-burst',
            beatCount: 4,
            detail: 'Multiple payoff lanes are primed together',
            label: 'Stack burst',
            screenCue: 'burst',
            tier: 'stack'
        });
    });
});
