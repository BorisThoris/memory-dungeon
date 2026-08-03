import { describe, expect, it } from 'vitest';
import {
    GAMEPLAY_BUILD_STRATEGIES,
    assertGameplayBuildStrategiesViable,
    runGameplayBuildStrategySimulation
} from './build-strategy-simulation';
import { GAME_RULES_VERSION } from './contracts';

describe('typed gameplay build strategy simulation', () => {
    it('proves eight shipped builds through distinct replayable command/event loops', () => {
        const report = runGameplayBuildStrategySimulation({
            seeds: [42_001, 42_077, 42_123],
            rulesVersion: GAME_RULES_VERSION
        });

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
            'mistake_recovery'
        ]);
        for (const strategy of report.strategies) {
            expect(strategy.viableSeedShare).toBe(1);
            expect(strategy.rejectedCommands).toBe(0);
            expect(strategy.consequenceAcceptedSeeds).toBe(report.seeds.length);
            expect(strategy.deterministicReplaySeeds).toBe(report.seeds.length);
            expect(strategy.axisScores[strategy.expectedDominantAxis]).toBeGreaterThan(0);
            for (const sample of strategy.samples) {
                expect(sample.consequenceAccepted).toBe(true);
                expect(sample.replayDeterministic).toBe(true);
                expect(sample.invariantViolations).toEqual([]);
                expect(sample.feedbackCues.length).toBeGreaterThanOrEqual(3);
                expect(sample.eventTypeCounts[strategy.consequenceEventType]).toBe(1);
                expect(sample.commands.at(-1)?.type).toBe(strategy.consequenceCommandType);
            }
        }
        expect(report.pairwiseAxisDistances).toHaveLength(28);
        expect(report.pairwiseAxisDistances.every((pair) => pair.distance === 2)).toBe(true);
        expect(assertGameplayBuildStrategiesViable(report)).toEqual({ ok: true, issues: [] });
    });

    it('is deterministic and keeps exact source, choice, effect, feedback, and consequence evidence', () => {
        const first = runGameplayBuildStrategySimulation({ seeds: [7_241] });
        const second = runGameplayBuildStrategySimulation({ seeds: [7_241] });

        expect(first).toEqual(second);
        expect(first.strategies.map((strategy) => ({
            id: strategy.id,
            loadout: strategy.startingLoadoutId,
            definitions: strategy.activationDefinitionIds,
            command: strategy.consequenceCommandType,
            event: strategy.consequenceEventType
        }))).toEqual([
            {
                id: 'conduit_cartographer',
                loadout: 'memory_scout',
                definitions: ['bonus_reward.echo_conduit_lens', 'reward_perk.echo_conduit_double'],
                command: 'board.peek',
                event: 'board.peeked'
            },
            {
                id: 'guard_tank',
                loadout: 'cursebreaker',
                definitions: ['bonus_reward.hazard_ward', 'trait.volatile_heavy_guard'],
                command: 'board.destroy_pair',
                event: 'board.pair_destroyed'
            },
            {
                id: 'treasure_greed',
                loadout: 'vaultbreaker',
                definitions: [
                    'bonus_reward.chest_gold',
                    'bonus_reward.cursed_opener_contract',
                    'reward_perk.cursed_opener_greed'
                ],
                command: 'shop.purchase',
                event: 'shop.offer_purchased'
            },
            {
                id: 'route_gambler',
                loadout: 'route_tactician',
                definitions: ['relic.wager_surety'],
                command: 'board.gambit_commit',
                event: 'board.gambit_commit.requested'
            },
            {
                id: 'combo_shard_engine',
                loadout: 'vaultbreaker',
                definitions: ['bonus_reward.bonus_shards', 'relic.combo_shard_plus_step'],
                command: 'board.turn_resolve',
                event: 'board.turn_resolved'
            },
            {
                id: 'trap_control',
                loadout: 'route_tactician',
                definitions: ['bonus_reward.trait_toolkit', 'bonus_reward.free_swap_floor'],
                command: 'board.region_shuffle',
                event: 'board.region_shuffled'
            },
            {
                id: 'boss_hunter',
                loadout: 'memory_scout',
                definitions: ['relic.chapter_compass', 'relic.wager_surety', 'relic.parasite_ledger'],
                command: 'effects.apply',
                event: 'score.requested'
            },
            {
                id: 'memory_scout',
                loadout: 'memory_scout',
                definitions: [
                    'bonus_reward.trait_streak_lens',
                    'reward_perk.trait_streak_toolkit',
                    'relic.memorize_bonus_ms',
                    'relic.memorize_under_short_memorize'
                ],
                command: 'board.flash_pair',
                event: 'board.flash_pair_revealed'
            }
        ]);
    });

    it('returns exact build and seed diagnostics when a viability contract drifts', () => {
        const report = runGameplayBuildStrategySimulation({ seeds: [42_001] });
        const broken = structuredClone(report);
        broken.strategies[1].samples[0].consequenceAccepted = false;
        broken.strategies[1].samples[0].feedbackCues = [];

        expect(assertGameplayBuildStrategiesViable(broken)).toEqual({
            ok: false,
            issues: [
                'guard_tank@seed:42001:missing board.pair_destroyed',
                'guard_tank@seed:42001:feedbackEvents=0; required=3'
            ]
        });
    });
});
