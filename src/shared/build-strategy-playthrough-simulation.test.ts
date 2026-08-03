import { describe, expect, it } from 'vitest';
import {
    GAMEPLAY_BUILD_POLICIES,
    assertGameplayBuildMultiFloorViable,
    runGameplayBuildMultiFloorSimulation
} from './build-strategy-playthrough-simulation';
import { GAMEPLAY_BUILD_STRATEGIES } from './build-strategy-simulation';
import { GAME_RULES_VERSION } from './contracts';

describe('multi-floor typed build strategy simulation', () => {
    it('carries seven distinct builds through generated floors, interludes, a relic milestone, and exact replay', () => {
        const report = runGameplayBuildMultiFloorSimulation({ rulesVersion: GAME_RULES_VERSION });

        expect(report.strategies.map((strategy) => strategy.id)).toEqual(
            GAMEPLAY_BUILD_STRATEGIES.map((strategy) => strategy.id)
        );
        expect(report.strategies.map((strategy) => strategy.dominantAxis)).toEqual([
            'information',
            'control',
            'economy',
            'risk_conversion',
            'sustain_conversion',
            'board_reconfiguration',
            'boss_extraction'
        ]);
        for (const strategy of report.strategies) {
            expect(strategy.floorCompletionShare).toBe(1);
            expect(strategy.deterministicReplaySeeds).toBe(report.seeds.length);
            expect(strategy.signatureConsequenceUses).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.matchupMetrics.length).toBeGreaterThan(0);
            expect(strategy.policyId).toBe(GAMEPLAY_BUILD_POLICIES[strategy.id].id);
            expect(strategy.informationPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].informationPolicy);
            expect(strategy.gambitPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].gambitPolicy);
            expect(strategy.gambitSuppressedMatchups).toEqual(
                GAMEPLAY_BUILD_POLICIES[strategy.id].gambitSuppressedMatchups
            );
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
        expect(report.cohesiveBuildCoverage.routeGambler).toMatchObject({
            id: 'route_gambler',
            buildMechanicId: 'build.route_gambler',
            startingLoadoutId: 'route_tactician',
            axis: 'risk_conversion',
            favorableMatchup: 'economy_opportunity',
            counterMatchup: 'hazard_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.routeGambler.requiredSystems).toEqual([
            'relic.wager_surety',
            'objective.risk_wager',
            'inventory.gambit_token',
            'power.gambit',
            'route.mystery'
        ]);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.gambitCommits).toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.riskWagersAccepted).toBeGreaterThan(0);
        expect(
            report.cohesiveBuildCoverage.routeGambler.evidence.riskWagerWins +
            report.cohesiveBuildCoverage.routeGambler.evidence.riskWagerLosses
        ).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.counterMatchupFloors).toBeGreaterThan(0);
        const routeGambler = report.strategies.find((strategy) => strategy.id === 'route_gambler');
        expect(routeGambler?.samples.every((sample) =>
            sample.floorTraces.some((floor) => floor.gambitCommits > 0)
        )).toBe(true);
        expect(routeGambler?.samples.flatMap((sample) => sample.floorTraces)
            .filter((floor) => floor.matchup === 'hazard_pressure')
            .every((floor) => floor.gambitSuppressedByMatchup && floor.gambitCommits === 0)).toBe(true);
        expect(report.cohesiveBuildCoverage.comboShardEngine).toMatchObject({
            id: 'combo_shard_engine',
            buildMechanicId: 'build.combo_shard_engine',
            startingLoadoutId: 'vaultbreaker',
            axis: 'sustain_conversion',
            favorableMatchup: 'economy_opportunity',
            counterMatchup: 'parasite_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.comboShardEngine.requiredSystems).toEqual([
            'reward.bonus_shards',
            'relic.combo_shard_plus_step',
            'findable.shard_spark',
            'inventory.combo_shard',
            'progression.shard_to_life'
        ]);
        expect(report.cohesiveBuildCoverage.comboShardEngine.evidence.comboShardSourceEvents)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.comboShardEngine.evidence.shardLifeConversions)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.comboShardEngine.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.comboShardEngine.evidence.counterMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.trapControl).toMatchObject({
            id: 'trap_control',
            buildMechanicId: 'build.trap_control',
            startingLoadoutId: 'route_tactician',
            axis: 'board_reconfiguration',
            favorableMatchup: 'hazard_pressure',
            counterMatchup: 'memory_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.trapControl.requiredSystems).toEqual([
            'reward.free_swap_floor',
            'perk.free_first_swap_per_floor',
            'inventory.region_shuffle_charge',
            'power.region_shuffle',
            'power.tile_swap'
        ]);
        expect(report.cohesiveBuildCoverage.trapControl.evidence.targetedReconfigurationUses)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.trapControl.evidence.memoryPressureConservations)
            .toBeGreaterThan(0);
        const trapControl = report.strategies.find((strategy) => strategy.id === 'trap_control');
        expect(trapControl?.samples.flatMap((sample) => sample.floorTraces)
            .filter((floor) => floor.matchup === 'memory_pressure')
            .every((floor) => floor.signatureConsequenceUses === 0)).toBe(true);
        expect(report.cohesiveBuildCoverage.bossHunter).toMatchObject({
            id: 'boss_hunter',
            buildMechanicId: 'build.boss_hunter',
            startingLoadoutId: 'memory_scout',
            axis: 'boss_extraction',
            favorableMatchup: 'boss_pressure',
            counterMatchup: 'parasite_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.bossHunter.requiredSystems).toEqual([
            'relic.chapter_compass',
            'reward.boss_trophy_cache',
            'objective.featured_streak',
            'relic.wager_surety',
            'relic.parasite_ledger'
        ]);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.bossTrophyConversions)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.parasiteReliefEvents).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.riskWagersAccepted).toBeGreaterThan(0);
        expect(
            report.cohesiveBuildCoverage.bossHunter.evidence.riskWagerWins +
            report.cohesiveBuildCoverage.bossHunter.evidence.riskWagerLosses
        ).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.counterMatchupFloors).toBeGreaterThan(0);
        expect(assertGameplayBuildMultiFloorViable(report)).toEqual({ ok: true, issues: [] });
    }, 50_000);

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
        broken.strategies[3].gambitCommits = 0;
        broken.strategies[3].riskWagersAccepted = 0;
        broken.strategies[3].riskWagerWins = 0;
        broken.strategies[3].riskWagerLosses = 0;
        broken.strategies[4].shardLifeConversions = 0;
        broken.strategies[4].comboShardSourceEvents = 0;
        broken.strategies[5].targetedReconfigurationUses = 0;
        broken.strategies[5].memoryPressureConservations = 0;
        broken.strategies[6].bossTrophyConversions = 0;
        broken.strategies[6].parasiteReliefEvents = 0;
        broken.strategies[6].riskWagersAccepted = 0;
        broken.strategies[6].riskWagerWins = 0;
        broken.strategies[6].riskWagerLosses = 0;

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
            'guard_tank@seed:42001:full replay diverged',
            'route_gambler@seeds:42001:gambitCommits=0; required=1',
            'route_gambler@seeds:42001:riskWagersAccepted=0; required=1',
            'route_gambler@seeds:42001:riskWagerOutcomes=0; required=1',
            'combo_shard_engine@seeds:42001:shardLifeConversions=0; required=1',
            'combo_shard_engine@seeds:42001:comboShardSourceEvents=0; required=1',
            'trap_control@seeds:42001:targetedReconfigurationUses=0; required=1',
            'trap_control@seeds:42001:memoryPressureConservations=0; required=1',
            'boss_hunter@seeds:42001:bossTrophyConversions=0; required=1',
            'boss_hunter@seeds:42001:parasiteReliefEvents=0; required=1',
            'boss_hunter@seeds:42001:riskWagersAccepted=0; required=1',
            'boss_hunter@seeds:42001:riskWagerOutcomes=0; required=1'
        ]));
    });
});
