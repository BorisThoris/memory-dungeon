import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase } from './game-core';
import { createRunSummary } from './run-summary-rules';

describe('createRunSummary', () => {
    it('persists final payoff counters for archive recap surfaces', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0xbeef }));
        const summarized = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                findablesClaimedThisFloor: 2,
                findablesTotalThisFloor: 2,
                rewardPerkIds: ['trait_streak_toolkit'],
                traitRouteObjectiveCompletedThisFloor: true,
                traitRouteObjectiveRewardClaimedThisFloor: true,
                traitRouteObjectiveRewardTextThisFloor: '+1 combo shard',
                stats: {
                    ...run.stats,
                    mismatches: 1,
                    volatileTraitShuffles: 2
                }
            },
            []
        );

        expect(summarized.lastRunSummary).toMatchObject({
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffPressureExtra: 3,
            payoffRewardPerkCount: 1,
            payoffRoutePaid: true,
            payoffRouteRewardText: '+1 combo shard'
        });
    });
});
