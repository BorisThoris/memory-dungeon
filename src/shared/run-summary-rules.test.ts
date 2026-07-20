import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import { createRunSummary } from './run-summary-rules';
import { normalizeSaveData } from './save-data';

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

    it('round-trips every valid generated summary field through save normalization', () => {
        const run = finishMemorizePhase(
            createNewRun(100, {
                activeContract: {
                    noShuffle: true,
                    noDestroy: false,
                    maxMismatches: 3,
                    maxPinsTotalRun: 10,
                    bonusRelicDraftPick: true
                },
                runSeed: 0xcafe,
                startingLoadoutId: 'route_tactician'
            })
        );
        const summary = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                traitRouteObjectiveCompletedThisFloor: true,
                traitRouteObjectiveRewardClaimedThisFloor: true,
                traitRouteObjectiveRewardTextThisFloor: '+1 combo shard'
            },
            ['ACH_FIRST_CLEAR']
        ).lastRunSummary!;
        const serializedSummary = JSON.parse(JSON.stringify(summary));

        expect(normalizeSaveData({ lastRunSummary: serializedSummary }).lastRunSummary).toEqual(serializedSummary);
    });

    it('normalizes malformed runtime counters before persisting a summary', () => {
        const run = finishMemorizePhase(createNewRun(100, { runSeed: 0xbeef }));
        const summarized = createRunSummary(
            {
                ...run,
                status: 'gameOver',
                findablesClaimedThisFloor: 9,
                findablesTotalThisFloor: 2,
                rewardPerkIds: ['trait_streak_toolkit'],
                stats: {
                    ...run.stats,
                    totalScore: Number.NaN,
                    bestScore: -10,
                    levelsCleared: 1,
                    highestLevel: Number.POSITIVE_INFINITY,
                    bestStreak: 3.9,
                    perfectClears: 5,
                    mismatches: Number.NaN,
                    volatileTraitShuffles: 2.8
                }
            } as unknown as RunState,
            []
        );

        expect(summarized.lastRunSummary).toMatchObject({
            totalScore: 0,
            bestScore: 0,
            levelsCleared: 1,
            highestLevel: 0,
            bestStreak: 3,
            perfectClears: 1,
            payoffPickupClaimed: 2,
            payoffPickupTotal: 2,
            payoffPressureExtra: 2
        });
    });
});
