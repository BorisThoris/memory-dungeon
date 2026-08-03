import { describe, expect, it } from 'vitest';
import {
    assertGameplayBuildMultiFloorViable,
    runGameplayBuildMultiFloorSimulation
} from './build-strategy-playthrough-simulation';
import { GAMEPLAY_BUILD_STRATEGIES } from './build-strategy-simulation';
import { GAME_RULES_VERSION } from './contracts';

describe('multi-floor typed build strategy simulation', () => {
    it('carries three distinct builds through generated floors, interludes, a relic milestone, and exact replay', () => {
        const report = runGameplayBuildMultiFloorSimulation({
            seeds: [42_001],
            floors: 4,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(report.strategies.map((strategy) => strategy.id)).toEqual(
            GAMEPLAY_BUILD_STRATEGIES.map((strategy) => strategy.id)
        );
        expect(report.strategies.map((strategy) => strategy.dominantAxis)).toEqual([
            'information',
            'control',
            'economy'
        ]);
        for (const strategy of report.strategies) {
            expect(strategy.floorCompletionShare).toBe(1);
            expect(strategy.deterministicReplaySeeds).toBe(1);
            expect(strategy.signatureConsequenceUses).toBeGreaterThanOrEqual(1);
            expect(strategy.matchupMetrics.length).toBeGreaterThan(0);
            expect(strategy.matchupMetrics.reduce(
                (sum, matchup) => sum + matchup.recurringSynergyFloors,
                0
            )).toBeGreaterThanOrEqual(1);
            expect(strategy.signatureAxisScores[strategy.expectedDominantAxis]).toBeGreaterThan(0);
            const sample = strategy.samples[0];
            expect(sample.completedFloors).toBe(4);
            expect(sample.rejectedCommandIds).toEqual([]);
            expect(sample.fullReplayDeterministic).toBe(true);
            expect(sample.invariantViolations).toEqual([]);
            expect(sample.floorTraces).toHaveLength(4);
            expect(sample.floorTraces.every((floor) => floor.completed)).toBe(true);
            expect(sample.floorTraces.every((floor) => floor.replayCheckpointDeterministic)).toBe(true);
            expect(sample.commands.map((command) => command.type)).toEqual(expect.arrayContaining([
                'phase.memorize_complete',
                'board.tile_flip',
                'board.turn_resolve',
                'route.choose',
                'side_room.resolve',
                'relic.offer_open',
                'relic.pick',
                'floor.advance',
                strategy.consequenceCommandType
            ]));
            expect(new Set(sample.commands.map((command) => command.commandId)).size).toBe(sample.commands.length);
            expect(new Set(sample.events.map((event) => event.eventId)).size).toBe(sample.events.length);
        }
        expect(report.pairwiseMeanTurnRatios.every(
            (pair) => pair.ratio <= report.bounds.maxPairwiseMeanTurnRatio
        )).toBe(true);
        expect(assertGameplayBuildMultiFloorViable(report)).toEqual({ ok: true, issues: [] });
    });

    it('is deterministic for a selected build and preserves observed matchup distributions', () => {
        const input = { seeds: [7_241], floors: 3, strategies: ['conduit_cartographer'] as const };
        const first = runGameplayBuildMultiFloorSimulation(input);
        const second = runGameplayBuildMultiFloorSimulation(input);

        expect(first).toEqual(second);
        expect(first.strategies[0].samples[0].floorTraces.map((floor) => ({
            floor: floor.floor,
            matchup: floor.matchup,
            mutators: floor.activeMutators,
            synergies: floor.recurringSynergyTags,
            completed: floor.completed,
            replay: floor.replayCheckpointDeterministic
        }))).toHaveLength(3);
    });

    it('returns exact strategy and seed diagnostics when a long-loop contract drifts', () => {
        const report = runGameplayBuildMultiFloorSimulation({ seeds: [42_001], floors: 3 });
        const broken = structuredClone(report);
        broken.strategies[1].samples[0].completedFloors = 2;
        broken.strategies[1].samples[0].fullReplayDeterministic = false;

        expect(assertGameplayBuildMultiFloorViable(broken).issues).toEqual(expect.arrayContaining([
            'guard_tank@seed:42001:completedFloors=2; requested=3',
            'guard_tank@seed:42001:full replay diverged'
        ]));
    });
});
