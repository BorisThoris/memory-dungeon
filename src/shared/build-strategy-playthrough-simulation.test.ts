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
             * Gen 172 asserted The Saboteur's signature at nought: its region shuffle is gated on a
             * hazard-pressure floor, and no floor read as one. Gen 173 removed the route between
             * floors, and with it the safe route every policy was taking - which had been keeping
             * the hazard-pressure mutators off the schedule. One floor a seed now carries one, the
             * gate opens, and the shuffle fires three times over three seeds.
             *
             * The Engine is the one that dropped: two signature uses over three seeds, none on
             * 42077, because its shard-to-life conversion has nothing to convert on a run that never
             * loses a life. Asserted at the measured two so a change either way is a deliberate one;
             * Phase 2's floor is what gives it something to spend a shard on.
             */
            if (strategy.id === 'combo_shard_engine') {
                expect(strategy.signatureConsequenceUses).toBe(2);
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
             * Every matchup is sampled again. Gen 172 had `hazard_pressure` down to nothing - the
             * enemy patrols and traps that produced it were dungeon cards - and five builds are
             * labelled against it. Its one remaining source is a mutator, and the safe route every
             * policy took between floors had been keeping that mutator off the schedule; with the
             * route gone (Gen 173) it lands on one floor a seed. That is still thin, and "good
             * against hazard pressure" still describes very little; relabelling is Phase 2's call.
             */
            expect(strategy.favorableMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.counterMatchupMetrics?.sampledFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.counterMatchupReplayFloors).toBeGreaterThanOrEqual(1);
            expect(strategy.policyDecisionCount).toBeGreaterThanOrEqual(strategy.floorsAttempted);
            expect(strategy.imperfectInformationFloors).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.uncertainTurns).toBeGreaterThanOrEqual(report.seeds.length);
            expect(strategy.riskBudgetExhaustions).toBe(0);
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
                // No route decision and no side room is ever offered between floors (Gen 173).
                expect(sample.policyDecisions.filter((decision) => decision.phase === 'route')).toEqual([]);
                expect(sample.policyDecisions.filter((decision) => decision.phase === 'side_room' && decision.applied)).toEqual([]);
                // The Engine's consequence command is absent on seed 42077, for the reason above
                // its signature assertion. Everything else in this list is the shape of an ordinary
                // run and must still be there for every build.
                expect(sample.commands.map((command) => command.type)).toEqual(expect.arrayContaining([
                    'phase.memorize_complete',
                    'board.tile_flip',
                    'board.turn_resolve',
                    'relic.offer_open',
                    'relic.pick',
                    'floor.advance',
                    ...(strategy.id === 'combo_shard_engine' && sample.seed === 42_077
                        ? []
                        : [strategy.consequenceCommandType])
                ]));
                expect(new Set(sample.commands.map((command) => command.commandId)).size).toBe(sample.commands.length);
                expect(new Set(sample.events.map((event) => event.eventId)).size).toBe(sample.events.length);
            }
        }
        /*
         * Seven pairs breach the mean-turn ratio, every one of them The Cartographer against
         * someone else, at 1.53 to 1.65 against a ceiling of 1.5. Gen 172 had three; the route cut
         * (Gen 173) took away the last thing that made one build's floors differ in length from
         * another's, so the other seven now take the same number of turns to within a rounding, and
         * The Cartographer's peeks stand out against all of them at once. The ceiling is not
         * catching a runaway build, it is catching the other seven converging.
         *
         * Named exactly rather than widened. Phase 2's pair curve and par are what give builds
         * different floor lengths again.
         */
        expect(report.pairwiseMeanTurnRatios.filter(
            (pair) => pair.ratio > report.bounds.maxPairwiseMeanTurnRatio
        )).toEqual([
            { left: 'conduit_cartographer', right: 'guard_tank', ratio: 1.64 },
            { left: 'conduit_cartographer', right: 'treasure_greed', ratio: 1.65 },
            { left: 'conduit_cartographer', right: 'route_gambler', ratio: 1.65 },
            { left: 'conduit_cartographer', right: 'combo_shard_engine', ratio: 1.65 },
            { left: 'conduit_cartographer', right: 'trap_control', ratio: 1.65 },
            { left: 'conduit_cartographer', right: 'boss_hunter', ratio: 1.65 },
            { left: 'conduit_cartographer', right: 'memory_scout', ratio: 1.53 }
        ]);
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
            sample.floorTraces.reduce((sum, floor) => sum + floor.pinPlacements, 0) > 0
        )).toBe(true);
        // Seed 42123 deals The Cartographer no scout glint it ever matches (Gen 173); it is in the
        // issue list below, and named here so a second silent seed fails.
        expect(conduitCartographer?.samples
            .filter((sample) => sample.floorTraces.reduce((sum, floor) => sum + floor.scoutGlintMatches, 0) === 0)
            .map((sample) => sample.seed)).toEqual([42_123]);
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
            'power.gambit'
        ]);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.gambitCommits).toBeGreaterThanOrEqual(report.seeds.length);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.riskWagersAccepted).toBeGreaterThan(0);
        expect(
            report.cohesiveBuildCoverage.routeGambler.evidence.riskWagerWins +
            report.cohesiveBuildCoverage.routeGambler.evidence.riskWagerLosses
        ).toBeGreaterThan(0);
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.favorableMatchupFloors).toBeGreaterThan(0);
        // Counter is hazard pressure: one floor a seed since Gen 173, see the top of this test.
        expect(report.cohesiveBuildCoverage.routeGambler.evidence.counterMatchupFloors).toBe(report.seeds.length);
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
        // Two, not three: seed 42077 never converts a shard. See the signature assertion above.
        expect(report.cohesiveBuildCoverage.comboShardEngine.evidence.shardLifeConversions).toBe(2);
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
        // The Saboteur reconfigures once a seed again: the hazard-pressure floor its shuffle is
        // gated on is back on the schedule (Gen 173, see the signature assertion above).
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
        // Counter is hazard pressure. Same as The Gambler above.
        expect(report.cohesiveBuildCoverage.memoryScout.evidence.counterMatchupFloors).toBe(report.seeds.length);
        /*
         * The Locksmith's coverage block stood here, and it was the longest in this test: six
         * required systems, four evidence counters, and a matchup rule about conserving keys under
         * hazard pressure. All of it asserted a build whose every input the dungeon removal took
         * away, so the build is gone and so is its coverage. See `build-strategy-simulation.ts`.
         */
        /*
         * Twelve issues, and they are still one finding: the build catalog was designed around a
         * floor that had things on it, and the floor is now a board of pairs.
         *
         * Gen 172 counted seventeen. The route cut (Gen 173) moved the list rather than shortening
         * it. Gone: the two "greed policy with nothing to decline" rows, with the route-risk metric
         * that produced them; the eight hazard-pressure rows, because the hazard mutator is back on
         * the schedule now that no safe route suppresses it, so The Saboteur fires and every
         * matchup is sampled. Arrived: The Engine short of shard conversions, one seed short of a
         * scout glint for The Cartographer, and four more turn-ratio breaches as the last thing
         * that made builds' floors differ in length went with the route.
         *
         * Asserted exactly, so a thirteenth fails. Every one of them is answered by giving the
         * floor something to be - Phase 2's pair curve, par, authored floors and severance drop -
         * and none of them by moving a bound here. Deleting the builds is the wrong answer too: The
         * Locksmith went because its every input was gone, and these seven still have working
         * mechanisms that need re-aiming rather than burial.
         */
        expect(assertGameplayBuildMultiFloorViable(report).issues).toEqual([
            'combo_shard_engine@seeds:42001,42077,42123:signatureConsequenceUses=2; required=3',
            'combo_shard_engine@seed:42077:signatureConsequenceUses=0; required=1',
            'conduit_cartographer@seed:42123:scoutGlintMatches=0; required=1',
            'combo_shard_engine@seeds:42001,42077,42123:shardLifeConversions=2; required=3',
            'boss_hunter@seeds:42001,42077,42123:bossTrophyConversions=0; required=3',
            'conduit_cartographer<->guard_tank:meanTurnRatio=1.64; max=1.5',
            'conduit_cartographer<->treasure_greed:meanTurnRatio=1.65; max=1.5',
            'conduit_cartographer<->route_gambler:meanTurnRatio=1.65; max=1.5',
            'conduit_cartographer<->combo_shard_engine:meanTurnRatio=1.65; max=1.5',
            'conduit_cartographer<->trap_control:meanTurnRatio=1.65; max=1.5',
            'conduit_cartographer<->boss_hunter:meanTurnRatio=1.65; max=1.5',
            'conduit_cartographer<->memory_scout:meanTurnRatio=1.53; max=1.5'
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
