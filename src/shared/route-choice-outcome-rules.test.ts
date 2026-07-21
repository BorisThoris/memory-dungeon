import { describe, expect, it } from 'vitest';

import { createPlayablePathFixture } from './playable-path-fixtures';
import { applyRouteChoiceOutcome } from './route-choice-outcome-rules';
import {
    ROUTE_GREED_SCORE_REWARD,
    ROUTE_GREED_SHOP_GOLD_REWARD,
    ROUTE_MYSTERY_SHOP_GOLD_REWARD
} from './route-choice-rules';
import { createNewRun } from './game-core';
import { MAX_LIVES, type RunState } from './contracts';

describe('route choice outcome rules', () => {
    it('rejects invalid status and missing choices without mutating the run', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;

        expect(applyRouteChoiceOutcome({ ...run, status: 'playing' as const }, run.lastLevelResult!.routeChoices![0]!.id))
            .toMatchObject({ applied: false, reason: 'invalid_status' });
        expect(applyRouteChoiceOutcome(run, 'missing-choice')).toMatchObject({
            run,
            applied: false,
            reason: 'missing_choice'
        });
    });

    it('applies safe, greed, and mystery outcomes from playable fixtures', () => {
        const safeRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = safeRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;
        expect(applyRouteChoiceOutcome(safeRun, safeChoice.id)).toMatchObject({
            applied: true,
            routeType: 'safe'
        });

        const greedRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const greedChoice = greedRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!;
        expect(applyRouteChoiceOutcome(greedRun, greedChoice.id)).toMatchObject({
            applied: true,
            routeType: 'greed'
        });

        const mysteryRun = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const mysteryChoice = mysteryRun.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!;
        expect(applyRouteChoiceOutcome(mysteryRun, mysteryChoice.id)).toMatchObject({
            applied: true,
            routeType: 'mystery'
        });
    });

    it('normalizes malformed greedy route score and gold counters', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const greedChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!;
        const result = applyRouteChoiceOutcome(
            {
                ...run,
                lives: 3.8,
                shopGold: Number.NaN,
                stats: {
                    ...run.stats,
                    totalScore: Number.NaN,
                    currentLevelScore: -5,
                    bestScore: Number.POSITIVE_INFINITY
                },
                lastLevelResult: {
                    ...run.lastLevelResult!,
                    scoreGained: Number.NaN
                }
            },
            greedChoice.id
        );

        expect(result.applied).toBe(true);
        expect(result.run.lives).toBe(2);
        expect(result.run.shopGold).toBe(ROUTE_GREED_SHOP_GOLD_REWARD);
        expect(result.run.stats.totalScore).toBe(ROUTE_GREED_SCORE_REWARD);
        expect(result.run.stats.currentLevelScore).toBe(ROUTE_GREED_SCORE_REWARD);
        expect(result.run.stats.bestScore).toBe(ROUTE_GREED_SCORE_REWARD);
        expect(result.run.lastLevelResult?.scoreGained).toBe(ROUTE_GREED_SCORE_REWARD);
    });

    it('normalizes malformed stat records before greedy route scoring', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const greedChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'greed')!;
        const result = applyRouteChoiceOutcome(
            {
                ...run,
                stats: Number.NaN as unknown as RunState['stats']
            },
            greedChoice.id
        );

        expect(result.applied).toBe(true);
        expect(result.run.stats.totalScore).toBe(ROUTE_GREED_SCORE_REWARD);
        expect(result.run.stats.currentLevelScore).toBe(ROUTE_GREED_SCORE_REWARD);
        expect(result.run.stats.bestScore).toBe(ROUTE_GREED_SCORE_REWARD);
    });

    it('normalizes safe route recovery toll and life counters', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;
        const result = applyRouteChoiceOutcome({ ...run, lives: 3.8, shopGold: 2.9 }, safeChoice.id);

        expect(result.applied).toBe(true);
        expect(result.run.lives).toBe(4);
        expect(result.run.shopGold).toBe(1);
        expect(result.run.lastLevelResult?.livesRemaining).toBe(4);
    });

    it('normalizes malformed mystery route gold and shard counters', () => {
        let goldResult: ReturnType<typeof applyRouteChoiceOutcome> | null = null;
        let shardResult: ReturnType<typeof applyRouteChoiceOutcome> | null = null;

        for (let seed = 17_300; seed < 17_420 && (!goldResult || !shardResult); seed += 1) {
            const candidate = createPlayablePathFixture('floorClearWithRouteChoices').run!;
            const run = {
                ...candidate,
                runSeed: seed,
                lastLevelResult: {
                    ...candidate.lastLevelResult!,
                    level: 1
                },
                stats: {
                    ...candidate.stats,
                    highestLevel: 1,
                    comboShards: Number.NaN
                },
                shopGold: Number.NaN
            };
            const mysteryChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'mystery')!;
            const result = applyRouteChoiceOutcome(run, mysteryChoice.id);
            if (result.summaryText?.includes('shop gold')) {
                goldResult = result;
            } else if (result.summaryText?.includes('combo shard')) {
                shardResult = result;
            }
        }

        expect(goldResult).not.toBeNull();
        expect(goldResult!.run.shopGold).toBe(ROUTE_MYSTERY_SHOP_GOLD_REWARD);
        expect(shardResult).not.toBeNull();
        expect(shardResult!.run.stats.comboShards).toBe(1);
    });

    it('normalizes malformed full-life guard counters before safe route recovery', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;
        const result = applyRouteChoiceOutcome(
            {
                ...run,
                lives: MAX_LIVES,
                shopGold: 2,
                stats: {
                    ...createNewRun(0).stats,
                    guardTokens: Number.POSITIVE_INFINITY
                }
            },
            safeChoice.id
        );

        expect(result.applied).toBe(true);
        expect(result.run.stats.guardTokens).toBe(1);
        expect(result.run.shopGold).toBe(1);
    });

    it('normalizes malformed stat records before full-life safe route recovery', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;
        const result = applyRouteChoiceOutcome(
            {
                ...run,
                lives: MAX_LIVES,
                shopGold: 2,
                stats: Number.NaN as unknown as RunState['stats']
            },
            safeChoice.id
        );

        expect(result.applied).toBe(true);
        expect(result.run.stats.guardTokens).toBe(1);
        expect(result.run.shopGold).toBe(1);
    });

    it('normalizes malformed lives and recall counters before applying route choices', () => {
        const run = createPlayablePathFixture('floorClearWithRouteChoices').run!;
        const safeChoice = run.lastLevelResult!.routeChoices!.find((choice) => choice.routeType === 'safe')!;

        expect(applyRouteChoiceOutcome({ ...run, lives: Number.NaN }, safeChoice.id)).toMatchObject({
            applied: false,
            reason: 'invalid_status'
        });

        const result = applyRouteChoiceOutcome(
            {
                ...run,
                lives: 3,
                pendingMemorizeBonusMs: Number.NaN,
                lastLevelResult: {
                    ...run.lastLevelResult!,
                    recallMistakes: 1.9
                }
            },
            safeChoice.id
        );

        expect(result.applied).toBe(true);
        expect(result.summaryText).toContain('Recall stabilized');
        expect(result.run.pendingMemorizeBonusMs).toEqual(expect.any(Number));
        expect(Number.isFinite(result.run.pendingMemorizeBonusMs)).toBe(true);
    });
});
