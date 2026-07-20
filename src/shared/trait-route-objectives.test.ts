import { describe, expect, it } from 'vitest';
import { MAX_COMBO_SHARDS, type BoardState, type RunState, type Tile } from './contracts';
import { createNewRun, finishMemorizePhase } from './game-core';
import {
    applyTraitRouteObjectiveProgress,
    getTraitRouteObjectiveSeed,
    getTraitRouteObjectiveStatus,
    TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD
} from './trait-route-objectives';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...overrides
});

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        pairCount: Math.floor(tiles.length / 2),
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        tiles,
        flippedTileIds: [],
        matchedPairs: 0,
        floorArchetypeId: null,
        featuredObjectiveId: null
    }) as unknown as BoardState;

const runWithObjective = (overrides: Partial<RunState> = {}): RunState => {
    const run = finishMemorizePhase(createNewRun(32_701, { echoFeedbackEnabled: false }));
    return {
        ...run,
        traitRouteObjectiveProgressThisFloor: 0,
        traitRouteObjectiveRequiredThisFloor: 1,
        traitRouteObjectiveCompletedThisFloor: false,
        traitRouteObjectiveRewardClaimedThisFloor: false,
        traitRouteObjectiveRewardTextThisFloor: null,
        traitRouteObjectiveTriggeredTagsThisFloor: [],
        ...overrides
    };
};

describe('trait route objectives', () => {
    it('seeds only on boards with actionable trait opportunities', () => {
        expect(getTraitRouteObjectiveSeed(board([
            tile('echo-a', 'echo', { tileTraitKind: 'echo' }),
            tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' })
        ]))).toMatchObject({
            required: 1,
            label: 'Sealed Catalyst'
        });
        expect(getTraitRouteObjectiveSeed(board([tile('a', 'a'), tile('b', 'b')]))).toBeNull();
    });

    it('advances once per unique interaction and pays a combo shard when completed', () => {
        const run = runWithObjective();
        const result = applyTraitRouteObjectiveProgress(run, ['echo:sealed-combo']);

        expect(result).toMatchObject({
            comboShardGain: 1,
            scoreBonus: 0,
            feedback: 'Trait route 1/1: Echo + Sealed: combo shard (+1 combo shard)'
        });
        expect(result.runPatch).toMatchObject({
            traitRouteObjectiveCompletedThisFloor: true,
            traitRouteObjectiveProgressThisFloor: 1,
            traitRouteObjectiveRewardClaimedThisFloor: true,
            traitRouteObjectiveRewardTextThisFloor: '+1 combo shard'
        });

        const duplicate = applyTraitRouteObjectiveProgress({ ...run, ...result.runPatch }, ['echo:sealed-combo']);
        expect(duplicate.comboShardGain).toBe(0);
        expect(duplicate.feedback).toBeNull();

        const malformed = applyTraitRouteObjectiveProgress(
            runWithObjective({
                stats: { ...run.stats, comboShards: Number.POSITIVE_INFINITY },
                traitRouteObjectiveProgressThisFloor: Number.NaN,
                traitRouteObjectiveRequiredThisFloor: 1.9
            }),
            ['echo:sealed-combo']
        );
        expect(malformed).toMatchObject({
            comboShardGain: 1,
            scoreBonus: 0,
            feedback: 'Trait route 1/1: Echo + Sealed: combo shard (+1 combo shard)'
        });
    });

    it('falls back to score when combo shards are capped and exposes HUD status', () => {
        const run = runWithObjective({
            stats: { ...runWithObjective().stats, comboShards: MAX_COMBO_SHARDS }
        });
        const result = applyTraitRouteObjectiveProgress(run, ['sealed:heavy-score']);
        const next = { ...run, ...result.runPatch, stats: { ...run.stats, currentLevelScore: result.scoreBonus } };

        expect(result.comboShardGain).toBe(0);
        expect(result.scoreBonus).toBe(TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD);
        expect(result.runPatch.traitRouteObjectiveRewardTextThisFloor).toBe(`+${TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD} score`);
        expect(getTraitRouteObjectiveStatus(next)).toMatchObject({
            actionLabel: 'Route paid',
            completed: true,
            progress: 1,
            remaining: 0,
            required: 1,
            reward: `+${TRAIT_ROUTE_OBJECTIVE_SCORE_REWARD} score`,
            stateLabel: 'Cashout claimed',
            urgency: 'paid'
        });
    });

    it('exposes arcade action cues for active trait route objective states', () => {
        expect(getTraitRouteObjectiveStatus(runWithObjective())!).toMatchObject({
            actionLabel: 'Cash next route',
            remaining: 1,
            stateLabel: 'One route to cashout',
            urgency: 'next'
        });

        expect(
            getTraitRouteObjectiveStatus(
                runWithObjective({
                    traitRouteObjectiveProgressThisFloor: 1,
                    traitRouteObjectiveRequiredThisFloor: 3
                })
            )!
        ).toMatchObject({
            actionLabel: 'Keep routing',
            remaining: 2,
            stateLabel: '2 routes to cashout',
            urgency: 'building'
        });

        expect(
            getTraitRouteObjectiveStatus(
                runWithObjective({
                    traitRouteObjectiveProgressThisFloor: Number.POSITIVE_INFINITY,
                    traitRouteObjectiveRequiredThisFloor: 2.9
                })
            )!
        ).toMatchObject({
            progress: 0,
            remaining: 2,
            required: 2,
            urgency: 'idle'
        });
    });
});
