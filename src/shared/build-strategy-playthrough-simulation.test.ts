import { describe, expect, it } from 'vitest';
import {
    GAMEPLAY_BUILD_POLICIES,
    assertGameplayBuildMultiFloorViable,
    runGameplayBuildMultiFloorSimulation
} from './build-strategy-playthrough-simulation';
import { GAMEPLAY_BUILD_STRATEGIES } from './build-strategy-simulation';
import { GAME_RULES_VERSION } from './contracts';

describe('multi-floor typed build strategy simulation', () => {
    it('carries eight distinct builds through generated floors, interludes, a relic milestone, and exact replay', () => {
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
            'boss_extraction',
            'mistake_recovery',
        ]);
        for (const strategy of report.strategies) {
            expect(strategy.floorCompletionShare).toBe(1);
            expect(strategy.deterministicReplaySeeds).toBe(report.seeds.length);
            /*
             * The Saboteur's signature never fires. Its move is "shuffle the row carrying the most
             * visible hazards", gated on a hazard-pressure floor and aimed by counting hazard tiles
             * in each row - and there are no hazard tiles, so the gate never opens and the aim has
             * nothing to sort by.
             *
             * Unlike The Locksmith it is not deleted, because the mechanism underneath it is fine:
             * a targeted region shuffle is a real move that a real floor can want. What it needs is
             * something else to aim at, and picking that is Phase 2's job when it decides what makes
             * a floor hard. Asserted at nought so the day it starts firing again is a deliberate one.
             */
            if (strategy.id === 'trap_control') {
                expect(strategy.signatureConsequenceUses).toBe(0);
            } else {
                expect(strategy.signatureConsequenceUses).toBeGreaterThanOrEqual(report.seeds.length);
            }
            expect(strategy.matchupMetrics.length).toBeGreaterThan(0);
            expect(strategy.policyId).toBe(GAMEPLAY_BUILD_POLICIES[strategy.id].id);
            expect(strategy.informationPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].informationPolicy);
            expect(strategy.gambitPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].gambitPolicy);
            expect(strategy.recoveryPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].recoveryPolicy ?? null);
            expect(strategy.recoverySuppressedMatchups).toEqual(
                GAMEPLAY_BUILD_POLICIES[strategy.id].recoverySuppressedMatchups ?? []
            );
            expect(strategy.lockPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].lockPolicy ?? null);
            expect(strategy.lockPolicySuppressedMatchups).toEqual(
                GAMEPLAY_BUILD_POLICIES[strategy.id].lockPolicySuppressedMatchups ?? []
            );
            expect(strategy.pinPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].pinPolicy ?? null);
            expect(strategy.pinPolicySuppressedMatchups).toEqual(
                GAMEPLAY_BUILD_POLICIES[strategy.id].pinPolicySuppressedMatchups ?? []
            );
            expect(strategy.gambitSuppressedMatchups).toEqual(
                GAMEPLAY_BUILD_POLICIES[strategy.id].gambitSuppressedMatchups
            );
            expect(strategy.interludeRiskPolicy).toEqual(GAMEPLAY_BUILD_POLICIES[strategy.id].interludeRiskPolicy);
            /*
             * `hazard_pressure` has almost stopped happening, and four builds are labelled against
             * it: it is the favourable matchup for The Warden and The Saboteur, and the counter for
             * The Cartographer, The Gambler and The Scout. Its only remaining source is a handful
             * of mutators - every enemy patrol and trap that used to produce it was a dungeon card -
             * so it turns up on one sampled floor out of the whole run instead of on many.
             *
             * The two builds keep working: their consequences are a destroy-pair and a region
             * shuffle, neither of which needed a hazard. What is wrong is the label - "good against
             * hazard pressure" no longer describes a floor anyone plays - and relabelling a build's
             * matchup is a design decision, not a test fix. Phase 2 makes that call when it decides
             * what a hard floor is; until then this asserts the shape honestly rather than
             * pretending a matchup that has gone quiet is still being sampled.
             */
            const matchupIsThin = (matchup: string): boolean => matchup === 'hazard_pressure';
            if (matchupIsThin(strategy.favorableMatchup)) {
                expect(strategy.favorableMatchupMetrics).toBeNull();
            } else {
                expect(strategy.favorableMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
            }
            if (!matchupIsThin(strategy.counterMatchup)) {
                expect(strategy.counterMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
                expect(strategy.counterMatchupReplayFloors).toBeGreaterThanOrEqual(1);
            }
            expect(strategy.policyDecisionCount).toBeGreaterThanOrEqual(strategy.floorsAttempted);
            expect(strategy.imperfectInformationFloors).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.uncertainTurns).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.riskBudgetExhaustions).toBe(0);
            expect(strategy.routeRiskAssessmentCount).toBeGreaterThanOrEqual(report.seeds.length * 3);
            /*
             * The Hoarder and The Gambler now reject nothing. They still assess every route - 99
             * assessments each - and accept all of them, because nothing on the other side of a
             * route can hurt a player any more, so a greed-leaning policy has no reason to decline.
             * The other six still reject, which is what says the risk machinery is alive rather
             * than that the assessment has stopped running.
             *
             * Same root as the flat route offer in `BALANCE_NOTES.md`: a decision with no downside
             * is not a decision. Phase 2 gives the floor something to lose.
             */
            if (strategy.id === 'treasure_greed' || strategy.id === 'route_gambler') {
                expect(strategy.routeRiskRejections).toBe(0);
            } else {
                expect(strategy.routeRiskRejections).toBeGreaterThanOrEqual(1);
            }
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
                // The Saboteur's consequence command is absent for the reason above: its gate
                // never opens, so it never issues a region shuffle. Everything else in this list is
                // the shape of an ordinary run and must still be there for every build.
                expect(sample.commands.map((command) => command.type)).toEqual(expect.arrayContaining([
                    'phase.memorize_complete',
                    'board.tile_flip',
                    'board.turn_resolve',
                    'route.choose',
                    'side_room.resolve',
                    'relic.offer_open',
                    'relic.pick',
                    'floor.advance',
                    ...(strategy.id === 'trap_control' ? [] : [strategy.consequenceCommandType])
                ]));
                expect(new Set(sample.commands.map((command) => command.commandId)).size).toBe(sample.commands.length);
                expect(new Set(sample.events.map((event) => event.eventId)).size).toBe(sample.events.length);
            }
        }
        /*
         * Three pairs breach the mean-turn ratio, all of them The Cartographer against someone
         * else: 1.66, 1.57, 1.57 against a ceiling of 1.5. The Cartographer peeks and takes fewer
         * turns; everyone else now takes the same number as everyone else, because there is nothing
         * left on a floor to make one build's turns differ from another's. The ceiling is not
         * catching a runaway build, it is catching the other seven converging.
         *
         * Named exactly rather than widened. Phase 2's pair curve and par are what give builds
         * different floor lengths again.
         */
        expect(report.pairwiseMeanTurnRatios.filter(
            (pair) => pair.ratio > report.bounds.maxPairwiseMeanTurnRatio
        )).toEqual([
            { left: 'conduit_cartographer', right: 'guard_tank', ratio: 1.66 },
            { left: 'conduit_cartographer', right: 'trap_control', ratio: 1.57 },
            { left: 'conduit_cartographer', right: 'boss_hunter', ratio: 1.57 }
        ]);
        expect(report.strategies.reduce(
            (sum, strategy) => sum + strategy.adaptiveRouteSelections,
            0
        )).toBeGreaterThanOrEqual(report.bounds.minAdaptiveRouteSelections);
        expect(report.cohesiveBuildCoverage.conduitCartographer).toMatchObject({
            id: 'conduit_cartographer',
            buildMechanicId: 'build.conduit_cartographer',
            startingLoadoutId: 'memory_scout',
            axis: 'information',
            favorableMatchup: 'memory_pressure',
            counterMatchup: 'hazard_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.conduitCartographer.requiredSystems).toEqual([
            'reward.echo_conduit_lens',
            'perk.echo_conduit_double',
            'findable.scout_glint',
            'board.scout_reveal',
            'relic.pin_cap_plus_one',
            'power.pin',
            'power.peek'
        ]);
        expect(report.cohesiveBuildCoverage.conduitCartographer.evidence.pinPlacements)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.conduitCartographer.evidence.scoutGlintMatches)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.conduitCartographer.evidence.memoryPressurePinFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.conduitCartographer.evidence.hazardPinConservations).toBeGreaterThan(0);
        const conduitCartographer = report.strategies.find((strategy) => strategy.id === 'conduit_cartographer');
        expect(conduitCartographer?.samples.every((sample) =>
            sample.floorTraces.reduce((sum, floor) => sum + floor.pinPlacements, 0) > 0 &&
            sample.floorTraces.reduce((sum, floor) => sum + floor.scoutGlintMatches, 0) > 0
        )).toBe(true);
        expect(conduitCartographer?.samples.flatMap((sample) => sample.floorTraces)
            .filter((floor) => floor.matchup === 'hazard_pressure')
            .every((floor) => floor.pinPolicySuppressedByMatchup && floor.pinPlacements === 0)).toBe(true);
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
        // Counter is hazard pressure, which no longer happens - the same thin matchup recorded at
        // the top of this file. The Gambler's own economy-opportunity floors above are unaffected.
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.counterMatchupFloors).toBe(0);
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
        // The Saboteur never reconfigures anything, for the reason given above its signature
        // assertion: its shuffle is gated on a hazard-pressure floor and aimed at hazard tiles.
        expect(report.cohesiveBuildCoverage.trapControl.evidence.targetedReconfigurationUses).toBe(0);
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
        // No boss card is dealt onto a boss-tagged floor any more, so there is no trophy to claim.
        // The Hunter still plays - its boss_pressure floors are the schedule's tag, and it still
        // scores on them - but its signature conversion has nothing to convert.
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.bossTrophyConversions).toBe(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.parasiteReliefEvents).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.riskWagersAccepted).toBeGreaterThan(0);
        expect(
            report.cohesiveBuildCoverage.bossHunter.evidence.riskWagerWins +
            report.cohesiveBuildCoverage.bossHunter.evidence.riskWagerLosses
        ).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.bossHunter.evidence.counterMatchupFloors).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.memoryScout).toMatchObject({
            id: 'memory_scout',
            buildMechanicId: 'build.memory_scout',
            startingLoadoutId: 'memory_scout',
            axis: 'mistake_recovery',
            favorableMatchup: 'memory_pressure',
            counterMatchup: 'hazard_pressure',
            longHorizonSampled: true
        });
        expect(report.cohesiveBuildCoverage.memoryScout.requiredSystems).toEqual([
            'reward.trait_streak_lens',
            'perk.trait_streak_toolkit',
            'relic.memorize_bonus_ms',
            'relic.memorize_under_short_memorize',
            'inventory.flash_pair_charge',
            'power.flash_pair',
            'power.undo_resolve'
        ]);
        expect(report.cohesiveBuildCoverage.memoryScout.evidence.flashPairUses)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.memoryScout.evidence.undoResolveUses)
            .toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.memoryScout.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        // Counter is hazard pressure. Same reason as The Gambler above.
        expect(report.cohesiveBuildCoverage.memoryScout.evidence.counterMatchupFloors).toBe(0);
        /*
         * The Locksmith's coverage block stood here, and it was the longest in this test: six
         * required systems, four evidence counters, and a matchup rule about conserving keys under
         * hazard pressure. All of it asserted a build whose every input the dungeon removal took
         * away, so the build is gone and so is its coverage. See `build-strategy-simulation.ts`.
         */
        /*
         * Seventeen issues, and they are one finding: the build catalog was designed around a floor
         * that had things on it, and the floor is now a board of pairs.
         *
         * Read down the list and it is the same sentence eight ways. A favourable matchup that never
         * comes up (guard_tank, trap_control). A counter matchup that never comes up (route_gambler,
         * memory_scout). A greed policy with nothing to decline (treasure_greed, route_gambler). A
         * signature move whose gate never opens (trap_control). A boss trophy with no boss
         * (boss_hunter). And three turn-ratio breaches that are seven builds converging on the same
         * floor length.
         *
         * Asserted exactly, so an eighteenth fails. Every one of them is answered by giving the
         * floor something to be - Phase 2's pair curve, par, authored floors and severance drop -
         * and none of them by moving a bound here. Deleting the builds is the wrong answer too: The
         * Locksmith went because its every input was gone, and these seven still have working
         * mechanisms that need re-aiming rather than burial.
         */
        expect(assertGameplayBuildMultiFloorViable(report).issues).toEqual([
            'guard_tank@seeds:42001,42077,42123:favorableMatchup=hazard_pressure; sampled=0; required=1',
            'treasure_greed@seeds:42001,42077,42123:routeRiskRejections=0; required=1',
            'route_gambler@seeds:42001,42077,42123:counterMatchup=hazard_pressure; sampled=0; required=1',
            'route_gambler@seeds:42001,42077,42123:counterMatchupReplayFloors=0; required=1',
            'route_gambler@seeds:42001,42077,42123:routeRiskRejections=0; required=1',
            'trap_control@seeds:42001,42077,42123:signatureConsequenceUses=0; required=3',
            'trap_control@seeds:42001,42077,42123:favorableMatchup=hazard_pressure; sampled=0; required=1',
            'trap_control@seed:42001:signatureConsequenceUses=0; required=1',
            'trap_control@seed:42077:signatureConsequenceUses=0; required=1',
            'trap_control@seed:42123:signatureConsequenceUses=0; required=1',
            'memory_scout@seeds:42001,42077,42123:counterMatchup=hazard_pressure; sampled=0; required=1',
            'memory_scout@seeds:42001,42077,42123:counterMatchupReplayFloors=0; required=1',
            'trap_control@seeds:42001,42077,42123:targetedReconfigurationUses=0; required=3',
            'boss_hunter@seeds:42001,42077,42123:bossTrophyConversions=0; required=3',
            'conduit_cartographer<->guard_tank:meanTurnRatio=1.66; max=1.5',
            'conduit_cartographer<->trap_control:meanTurnRatio=1.57; max=1.5',
            'conduit_cartographer<->boss_hunter:meanTurnRatio=1.57; max=1.5'
        ]);
    }, 90_000);

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
