import { describe, expect, it } from 'vitest';
import {
    GAMEPLAY_BUILD_POLICIES,
    assertGameplayBuildMultiFloorViable,
    runGameplayBuildMultiFloorSimulation
} from './build-strategy-playthrough-simulation';
import { GAMEPLAY_BUILD_STRATEGIES } from './build-strategy-simulation';
import { GAME_RULES_VERSION } from './contracts';

describe('multi-floor typed build strategy simulation', () => {
    it('carries three distinct builds through generated floors, interludes, a relic milestone, and exact replay', () => {
        const report = runGameplayBuildMultiFloorSimulation({ rulesVersion: GAME_RULES_VERSION });

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
            expect(strategy.deterministicReplaySeeds).toBe(report.seeds.length);
            expect(strategy.signatureConsequenceUses).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.matchupMetrics.length).toBeGreaterThan(0);
            expect(strategy.policyId).toBe(GAMEPLAY_BUILD_POLICIES[strategy.id].id);
            expect(strategy.informationPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].informationPolicy);
            expect(strategy.interludeRiskPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].interludeRiskPolicy);
            expect(strategy.favorableMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.counterMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.counterMatchupReplayFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.policyDecisionCount).toBeGreaterThanOrEqual(strategy.floorsAttempted);
            expect(strategy.imperfectInformationFloors).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.uncertainTurns).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.riskBudgetExhaustions).toBe(0);
            expect(strategy.routeRiskAssessmentCount).toBeGreaterThanOrEqual(report.seeds.length * 3);
            expect(strategy.routeRiskRejections).toBeGreaterThanOrEqual(1);
            expect(strategy.sideRoomResourceAssessmentCount).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.matchupMetrics.reduce(
                (sum, matchup) => sum + matchup.recurringSynergyFloors,
                0
            )).toBeGreaterThanOrEqual(1);
            expect(strategy.signatureAxisScores[strategy.expectedDominantAxis]).toBeGreaterThan(0);
            for (const sample of strategy.samples) {
                expect(sample.completedFloors).toBe(report.floorsPerSeed);
                expect(sample.rejectedCommandIds).toEqual([]);
                expect(sample.fullReplayDeterministic).toBe(true);
                expect(sample.invariantViolations).toEqual([]);
                expect(sample.floorTraces).toHaveLength(report.floorsPerSeed);
                expect(sample.floorTraces.every((floor) => floor.completed)).toBe(true);
                expect(sample.floorTraces.every((floor) => floor.replayCheckpointDeterministic)).toBe(true);
                expect(sample.floorTraces.every((floor) =>
                    floor.information.kind === 'bounded_memory' &&
                    floor.information.maximumRememberedTiles <= GAMEPLAY_BUILD_POLICIES[strategy.id].informationPolicy.memoryTileCapacity &&
                    floor.information.uncertainTurns <= GAMEPLAY_BUILD_POLICIES[strategy.id].informationPolicy.uncertainTurnBudget &&
                    !floor.information.riskBudgetExhausted
                )).toBe(true);
                const observedFloors = sample.floorTraces.map((floor) => floor.floor);
                expect(new Set(observedFloors).size).toBe(observedFloors.length);
                expect(observedFloors.every(
                    (floor, index) => index === 0 || floor > observedFloors[index - 1]
                )).toBe(true);
                expect(sample.policyDecisions.length).toBeGreaterThanOrEqual(sample.floorTraces.length);
                const routeDecisions = sample.policyDecisions.filter((decision) => decision.phase === 'route');
                expect(routeDecisions.every((decision) =>
                    decision.routeRiskAssessments?.length === 3 &&
                    decision.routeRiskAssessments.some((assessment) =>
                        assessment.routeId === decision.selectedId && assessment.accepted
                    )
                )).toBe(true);
                expect(sample.policyDecisions
                    .filter((decision) => decision.phase === 'side_room' && decision.applied)
                    .some((decision) => decision.sideRoomResourceAssessment != null)).toBe(true);
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
        }
        expect(report.pairwiseMeanTurnRatios.every(
            (pair) => pair.ratio <= report.bounds.maxPairwiseMeanTurnRatio
        )).toBe(true);
        expect(report.strategies.reduce(
            (sum, strategy) => sum + strategy.adaptiveRouteSelections,
            0
        )).toBeGreaterThanOrEqual(report.bounds.minAdaptiveRouteSelections);
        expect(report.nextCohesiveBuildCandidate).toMatchObject({
            id: 'route_gambler',
            buildMechanicId: 'build.route_gambler',
            startingLoadoutId: 'route_tactician',
            expectedNewAxis: 'risk_conversion',
            favorableMatchupHypothesis: 'economy_opportunity',
            counterMatchupHypothesis: 'hazard_pressure',
            longHorizonSampled: false,
            evidence: {
                retainedStrategyIds: GAMEPLAY_BUILD_STRATEGIES.map((strategy) => strategy.id)
            }
        });
        expect(report.nextCohesiveBuildCandidate.requiredSystems).toEqual([
            'relic.wager_surety',
            'objective.risk_wager',
            'inventory.gambit_token',
            'power.gambit',
            'route.mystery'
        ]);
        expect(report.nextCohesiveBuildCandidate.evidence.routeRiskAssessments).toBeGreaterThan(0);
        expect(report.nextCohesiveBuildCandidate.evidence.routeRiskRejections).toBeGreaterThan(0);
        expect(report.nextCohesiveBuildCandidate.evidence.adaptiveRouteSelections).toBeGreaterThan(0);
        expect(assertGameplayBuildMultiFloorViable(report)).toEqual({ ok: true, issues: [] });
    }, 30_000);

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
        broken.strategies[1].counterMatchupReplayFloors = 0;
        broken.strategies[1].favorableMatchupMetrics = null;
        broken.strategies[1].imperfectInformationFloors = 0;
        broken.strategies[1].uncertainTurns = 0;
        broken.strategies[1].riskBudgetExhaustions = 1;
        broken.strategies[1].routeRiskAssessmentCount = 0;
        broken.strategies[1].routeRiskRejections = 0;
        broken.strategies[1].sideRoomResourceAssessmentCount = 0;

        expect(assertGameplayBuildMultiFloorViable(broken).issues).toEqual(expect.arrayContaining([
            'floorsPerSeed=3; required=12',
            'guard_tank@seeds:42001:favorableMatchup=hazard_pressure; sampled=0; required=1',
            'guard_tank@seeds:42001:counterMatchupReplayFloors=0; required=1',
            'guard_tank@seeds:42001:imperfectInformationFloors=0; required=1',
            'guard_tank@seeds:42001:uncertainTurns=0; required=1',
            'guard_tank@seeds:42001:riskBudgetExhaustions=1; max=0',
            'guard_tank@seeds:42001:routeRiskAssessments=0; required=3',
            'guard_tank@seeds:42001:routeRiskRejections=0; required=1',
            'guard_tank@seeds:42001:sideRoomResourceAssessments=0; required=1',
            'guard_tank@seed:42001:completedFloors=2; requested=3',
            'guard_tank@seed:42001:full replay diverged'
        ]));
    });
});
