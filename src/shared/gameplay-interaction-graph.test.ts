import { describe, expect, it } from 'vitest';
import {
    auditGameplayInteractionGraph,
    gameplayInteractionGraph,
    gameplayInteractionGraphSchema,
    getGameplayInteractionEdgesForMechanic,
    validateGameplayInteractionGraph
} from './gameplay-interaction-graph';
import type { TileTraitKind } from './contracts';
import {
    BOARD_TACTICIAN_DEFINITIONS,
    COMBO_SHARD_ENGINE_DEFINITIONS,
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
    MEMORY_SCOUT_DEFINITIONS,
    LOCKSMITH_DEFINITIONS,
    SABOTEUR_DEFINITIONS,
    SEER_DEFINITIONS,
    SLAYER_DEFINITIONS,
    SUPPLY_CACHE_DEFINITIONS,
    VAULTBREAKER_DEFINITIONS,
    WARDEN_DEFINITIONS
} from './gameplay-core-contracts';

const TILE_TRAIT_KINDS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

describe('gameplay interaction graph', () => {
    it('validates the imported JSON structure before graph logic trusts it', () => {
        expect(gameplayInteractionGraphSchema.safeParse(gameplayInteractionGraph).success).toBe(true);
        expect(
            gameplayInteractionGraphSchema.safeParse({
                ...gameplayInteractionGraph,
                mechanics: [{ ...gameplayInteractionGraph.mechanics[0], reads: undefined }]
            }).success
        ).toBe(false);
        expect(
            gameplayInteractionGraphSchema.safeParse({
                ...gameplayInteractionGraph,
                edges: [{ ...gameplayInteractionGraph.edges[0], kind: 'advises' }]
            }).success
        ).toBe(false);
        expect(
            gameplayInteractionGraphSchema.safeParse({
                ...gameplayInteractionGraph,
                coverage: { ...gameplayInteractionGraph.coverage, undocumentedLane: [] }
            }).success
        ).toBe(false);
    });

    it('keeps the executable graph connected and guarded', () => {
        expect(validateGameplayInteractionGraph()).toEqual([]);
    });

    it('registers every tile trait as an interacting third-layer mechanic', () => {
        expect(gameplayInteractionGraph.coverage.tileTraits).toEqual(TILE_TRAIT_KINDS);

        for (const trait of TILE_TRAIT_KINDS) {
            const mechanicId = `trait.${trait}`;
            const mechanic = gameplayInteractionGraph.mechanics.find((candidate) => candidate.id === mechanicId);
            expect(mechanic, mechanicId).toBeTruthy();
            expect(mechanic?.kind).toBe('trait');
            expect(getGameplayInteractionEdgesForMechanic(mechanicId).length, mechanicId).toBeGreaterThan(0);
            expect(mechanic?.tests.length, mechanicId).toBeGreaterThan(0);
        }
    });

    it('requires blockers to declare counterplay or softlock guards', () => {
        const blockers = gameplayInteractionGraph.mechanics.filter((mechanic) => mechanic.blocks.length > 0);

        expect(blockers.map((mechanic) => mechanic.id)).toEqual(
            expect.arrayContaining([
                'trait.stasis',
                'hazard.enemy_patrol',
                'boss.moving_patrol',
                'exit.primary',
                'lock.iron_key',
                'lock.typed_key',
                'room.locked_cache',
                'objective.defeat_boss'
            ])
        );
        expect(blockers.every((mechanic) => mechanic.softlockGuards.length > 0)).toBe(true);
    });

    it('connects every blocking mechanic to an explicit graph counterplay or guard edge', () => {
        const blockers = gameplayInteractionGraph.mechanics.filter((mechanic) => mechanic.blocks.length > 0);
        const protectiveEdgeKinds = new Set(['counterplay', 'guarded_by', 'unblocks', 'priority_guard']);
        const blockersWithoutProtectiveEdges = blockers
            .filter(
                (mechanic) =>
                    !gameplayInteractionGraph.edges.some(
                        (edge) =>
                            (edge.source === mechanic.id || edge.target === mechanic.id) &&
                            protectiveEdgeKinds.has(edge.kind)
                    )
            )
            .map((mechanic) => mechanic.id);

        expect(blockersWithoutProtectiveEdges).toEqual([]);
    });

    it('connects boss, exit, lock, and floor-clear mechanics through safety edges', () => {
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    source: 'boss.moving_patrol',
                    target: 'safety.softlock_fairness',
                    label: 'stale overlay clear'
                }),
                expect.objectContaining({
                    source: 'boss.moving_patrol',
                    target: 'safety.dungeon_topology',
                    label: 'boss route audit'
                }),
                expect.objectContaining({ source: 'objective.defeat_boss', target: 'exit.primary' }),
                expect.objectContaining({ source: 'lock.iron_key', target: 'exit.primary' }),
                expect.objectContaining({ source: 'lock.iron_key', target: 'safety.dungeon_topology' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'exit.primary' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'safety.dungeon_topology' }),
                expect.objectContaining({ source: 'shop.typed_key', target: 'lock.typed_key', kind: 'counterplay' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'room.locked_cache' }),
                expect.objectContaining({ source: 'room.locked_cache', target: 'safety.softlock_fairness' }),
                expect.objectContaining({ source: 'room.locked_cache', target: 'feedback.gameplay_hud' }),
                expect.objectContaining({ source: 'exit.primary', target: 'objective.floor_clear' }),
                expect.objectContaining({ source: 'exit.primary', target: 'safety.dungeon_topology' }),
                expect.objectContaining({ source: 'safety.softlock_fairness', target: 'objective.floor_clear' }),
                expect.objectContaining({ source: 'safety.dungeon_topology', target: 'progression.run_flow' })
            ])
        );
    });

    it('names topology, terminal key fallback, and stale boss overlay guards in the executable graph', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(byId.get('lock.iron_key')?.softlockGuards).toEqual(
            expect.arrayContaining(['reachable-key-source', 'terminal-key-lock-fallback', 'dungeon-topology-key-route'])
        );
        expect(byId.get('lock.typed_key')?.softlockGuards).toEqual(
            expect.arrayContaining(['matching-key-kind', 'typed-shop-key-insurance', 'dungeon-topology-key-route'])
        );
        expect(byId.get('shop.typed_key')?.softlockGuards).toEqual(
            expect.arrayContaining(['shop-priority-key', 'matching-key-kind', 'balance-key-slot-is-alternative'])
        );
        expect(byId.get('room.locked_cache')?.softlockGuards).toEqual(
            expect.arrayContaining(['matching-key-kind', 'optional-cache-never-required', 'room-copy-matches-key-kind'])
        );
        expect(byId.get('exit.primary')?.softlockGuards).toEqual(
            expect.arrayContaining(['terminal-key-lock-fallback', 'dungeon-topology-exit-route'])
        );
        expect(byId.get('boss.moving_patrol')?.softlockGuards).toEqual(
            expect.arrayContaining(['stale-boss-overlay-clear', 'all-real-pairs-cleared-clear', 'dungeon-topology-boss-route'])
        );
        expect(byId.get('safety.softlock_fairness')?.softlockGuards).toEqual(
            expect.arrayContaining(['terminal-key-lock-fallback', 'stale-boss-overlay-clear', 'dungeon-topology-audit'])
        );
        expect(byId.get('safety.dungeon_topology')).toMatchObject({
            kind: 'safety',
            role: 'graph_invariant_gate',
            evidence: expect.arrayContaining(['src/shared/run-map.ts']),
            tests: expect.arrayContaining(['src/shared/dungeon-topology.test.ts'])
        });
        expect(gameplayInteractionGraph.coverage.requiredSafetyNodes).toEqual(
            expect.arrayContaining(['safety.softlock_fairness', 'safety.dungeon_topology'])
        );
    });

    it('surfaces graph-driven gameplay priorities for audit passes', () => {
        const audit = auditGameplayInteractionGraph();

        expect(audit).toMatchObject({
            mechanicCount: gameplayInteractionGraph.mechanics.length,
            edgeCount: gameplayInteractionGraph.edges.length,
            traitCount: TILE_TRAIT_KINDS.length
        });
        expect(audit.blockerCount).toBeGreaterThanOrEqual(6);
        expect(audit.counterplayEdgeCount).toBeGreaterThanOrEqual(12);
        expect(audit.blockerWithoutProtectiveEdgeIds).toEqual([]);
        expect(audit.shopCounterplayWithoutPriorityGuardIds).toEqual([]);
        expect(audit.generatedFloorCoverageGapIds).toEqual(expect.arrayContaining(['trait.echo']));
        expect(audit.playerVisibleWriteWithoutHudIds).toEqual([]);
        expect(audit.highLeverageMechanicIds).toEqual(
            expect.arrayContaining([
                'trait.stasis',
                'boss.moving_patrol',
                'lock.iron_key',
                'lock.typed_key',
                'room.locked_cache',
                'objective.defeat_boss',
                'safety.dungeon_topology'
            ])
        );
        expect(audit.recommendations).toEqual(
            expect.arrayContaining([
                'Keep trait routing tools available when the graph shows swap-created trait routes.',
                'Keep boss and lock counterplay ahead of optional rewards in shop priority.',
                'Add a topology, softlock-fairness, or generator-contract case for every new blocking edge.'
            ])
        );
    });

    it('connects the first command-core build from content choice through persistence and consequence', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const prefixBySourceKind = {
            bonus_reward: 'reward',
            relic: 'relic',
            reward_perk: 'perk'
        } as const;

        for (const definition of CONDUIT_CARTOGRAPHER_DEFINITIONS) {
            const prefix = prefixBySourceKind[definition.source.kind as keyof typeof prefixBySourceKind];
            expect(prefix, definition.id).toBeTruthy();
            expect(byId.get(`${prefix}.${definition.source.id}`), definition.id).toMatchObject({
                evidence: expect.arrayContaining(['src/shared/gameplay-core-contracts.ts']),
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('core.gameplay_commands')).toMatchObject({ kind: 'core', role: 'authoritative_command_reducer' });
        expect(byId.get('inventory.peek_charge')).toMatchObject({ kind: 'inventory', role: 'build_resource' });
        expect(byId.get('power.peek')).toMatchObject({ kind: 'power', role: 'information_conversion' });
        expect(byId.get('persistence.run_summary')).toMatchObject({
            kind: 'persistence',
            role: 'bounded_journal_persistence'
        });
        expect(byId.get('simulation.gameplay_replay')).toMatchObject({ kind: 'simulation' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'reward.echo_conduit_lens', target: 'perk.echo_conduit_double', kind: 'grants' }),
                expect.objectContaining({ source: 'relic.peek_charge_plus_one', target: 'inventory.peek_charge', kind: 'grants' }),
                expect.objectContaining({ source: 'trait.echo', target: 'perk.echo_conduit_double', kind: 'triggers' }),
                expect.objectContaining({ source: 'trait.conduit', target: 'perk.echo_conduit_double', kind: 'gates' }),
                expect.objectContaining({ source: 'power.peek', target: 'inventory.peek_charge', kind: 'consumes' }),
                expect.objectContaining({ source: 'power.peek', target: 'route.mystery', kind: 'consequence' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'persistence.run_summary', kind: 'persists' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.gameplay_replay', kind: 'tested_by' })
            ])
        );
    });

    it('connects the Warden build from defensive choices through capped guard and damage absorption', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.hazard_ward', 'reward.hazard_ward'],
            ['relic.guard_token_plus_one', 'relic.guard_token_plus_one'],
            ['trait.volatile_heavy_guard', 'trait.volatile_heavy_guard'],
            ['relic.guard_token_plus_one.mirror_match', 'relic.guard_token_plus_one']
        ]);

        for (const definition of WARDEN_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                evidence: expect.arrayContaining(['src/shared/gameplay-core-contracts.ts']),
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.guard_tank')).toMatchObject({ kind: 'build', role: 'guard_absorption_build' });
        expect(byId.get('inventory.guard_token')).toMatchObject({ kind: 'inventory', role: 'bounded_damage_buffer' });
        expect(byId.get('safety.guard_absorption')).toMatchObject({ kind: 'safety', role: 'resource_consequence' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'reward.hazard_ward', target: 'inventory.guard_token', kind: 'grants' }),
                expect.objectContaining({ source: 'relic.guard_token_plus_one', target: 'inventory.guard_token', kind: 'grants' }),
                expect.objectContaining({ source: 'trait.volatile', target: 'trait.volatile_heavy_guard', kind: 'triggers' }),
                expect.objectContaining({ source: 'trait.heavy', target: 'trait.volatile_heavy_guard', kind: 'gates' }),
                expect.objectContaining({ source: 'inventory.guard_token', target: 'safety.guard_absorption', kind: 'enables' }),
                expect.objectContaining({ source: 'safety.guard_absorption', target: 'inventory.guard_token', kind: 'consumes' }),
                expect.objectContaining({ source: 'build.guard_tank', target: 'safety.guard_absorption', kind: 'consequence' })
            ])
        );
    });

    it('connects Combo Shard Engine sources through typed match requests into life conversion', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.bonus_shards', 'reward.bonus_shards'],
            ['relic.combo_shard_plus_step', 'relic.combo_shard_plus_step'],
            ['relic.parasite_ward_once', 'relic.parasite_ward_once'],
            ['findable.shard_spark', 'findable.shard_spark'],
            ['relic.combo_shard_plus_step.sealed_match', 'relic.combo_shard_plus_step']
        ]);

        for (const definition of COMBO_SHARD_ENGINE_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.combo_shard_engine')).toMatchObject({ kind: 'build', role: 'momentum_to_life_build' });
        expect(byId.get('inventory.combo_shard')).toMatchObject({
            kind: 'inventory',
            role: 'bounded_life_conversion_resource'
        });
        expect(byId.get('progression.shard_to_life')).toMatchObject({ kind: 'progression', role: 'resource_consequence' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'reward.bonus_shards', target: 'inventory.combo_shard', kind: 'grants' }),
                expect.objectContaining({ source: 'findable.shard_spark', target: 'core.gameplay_commands', kind: 'triggers' }),
                expect.objectContaining({ source: 'trait.sealed', target: 'relic.combo_shard_plus_step', kind: 'triggers' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.shard_to_life', kind: 'triggers' }),
                expect.objectContaining({ source: 'inventory.combo_shard', target: 'progression.shard_to_life', kind: 'enables' }),
                expect.objectContaining({ source: 'progression.shard_to_life', target: 'inventory.combo_shard', kind: 'consumes' }),
                expect.objectContaining({ source: 'build.combo_shard_engine', target: 'progression.shard_to_life', kind: 'consequence' }),
                expect.objectContaining({ source: 'relic.parasite_ward_once', target: 'safety.parasite_ward', kind: 'grants' }),
                expect.objectContaining({ source: 'safety.parasite_ward', target: 'hazard.score_parasite', kind: 'counterplay' }),
                expect.objectContaining({ source: 'hazard.score_parasite', target: 'core.gameplay_commands', kind: 'triggers' })
            ])
        );
    });

    it('connects Supply Cache through reveal-then-remove emergency recovery', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(SUPPLY_CACHE_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.supply_cache'
        ]);
        expect(byId.get('reward.supply_cache')).toMatchObject({
            kind: 'reward',
            role: 'emergency_information_and_removal_source',
            tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
        });
        expect(byId.get('build.emergency_toolkit')).toMatchObject({
            kind: 'build',
            role: 'reveal_then_remove_recovery_build'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.supply_cache', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'reward.supply_cache', target: 'inventory.peek_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'reward.supply_cache', target: 'inventory.destroy_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'power.peek', target: 'power.destroy_pair', kind: 'synergy' }),
            expect.objectContaining({ source: 'build.emergency_toolkit', target: 'objective.floor_clear', kind: 'consequence' })
        ]));
    });

    it('connects Saboteur sources through destroy control and safe-hazard ward consequences', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.hazard_banisher', 'reward.hazard_banisher'],
            ['relic.destroy_bank_plus_one', 'relic.destroy_bank_plus_one'],
            ['findable.ward_spark', 'findable.ward_spark']
        ]);

        for (const definition of SABOTEUR_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.trap_control')).toMatchObject({ kind: 'build', role: 'trap_pressure_control_build' });
        expect(byId.get('inventory.destroy_charge')).toMatchObject({ kind: 'inventory', role: 'pair_removal_resource' });
        expect(byId.get('safety.safe_hazard_ward')).toMatchObject({ kind: 'safety', role: 'trap_pressure_consequence' });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.hazard_banisher', target: 'inventory.destroy_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.destroy_bank_plus_one', target: 'inventory.destroy_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'findable.ward_spark', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'findable.ward_spark', target: 'safety.safe_hazard_ward', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.destroy_charge', target: 'power.destroy_pair', kind: 'enables' }),
            expect.objectContaining({ source: 'safety.safe_hazard_ward', target: 'hazard.tile_pressure', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.trap_control', target: 'power.destroy_pair', kind: 'consequence' })
        ]));
    });

    it('connects Vaultbreaker treasure sources to keys, gold, and future relic selection', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.chest_gold', 'reward.chest_gold'],
            ['bonus_reward.cursed_opener_contract', 'reward.cursed_opener_contract'],
            ['reward_perk.cursed_opener_greed', 'perk.cursed_opener_greed'],
            ['relic.shrine_echo', 'relic.shrine_echo'],
            ['relic.shrine_echo.treasure_claim', 'relic.shrine_echo'],
            ['findable.score_glint', 'findable.score_glint']
        ]);

        for (const definition of VAULTBREAKER_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.treasure_greed')).toMatchObject({ kind: 'build', role: 'treasure_extraction_build' });
        expect(byId.get('inventory.iron_key')).toMatchObject({ kind: 'inventory', role: 'treasure_extraction_resource' });
        expect(byId.get('economy.shop_gold')).toMatchObject({ kind: 'economy', role: 'extracted_value_resource' });
        expect(byId.get('progression.relic_draft')).toMatchObject({
            kind: 'progression',
            role: 'typed_replayable_build_selection_and_offer_shaping'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.chest_gold', target: 'inventory.iron_key', kind: 'grants' }),
            expect.objectContaining({ source: 'reward.cursed_opener_contract', target: 'perk.cursed_opener_greed', kind: 'grants' }),
            expect.objectContaining({ source: 'perk.cursed_opener_greed', target: 'economy.shop_gold', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.shrine_echo', target: 'progression.relic_draft', kind: 'grants' }),
            expect.objectContaining({ source: 'findable.score_glint', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'inventory.iron_key', target: 'lock.iron_key', kind: 'unblocks' }),
            expect.objectContaining({ source: 'economy.shop_gold', target: 'shop.typed_key', kind: 'enables' }),
            expect.objectContaining({ source: 'build.treasure_greed', target: 'progression.relic_draft', kind: 'consequence' })
        ]));
    });

    it('connects Slayer preparation through boss, wager, Favor, and parasite consequences', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map(SLAYER_DEFINITIONS.map((definition) => [
            definition.id,
            `relic.${definition.source.id}`
        ]));

        for (const definition of SLAYER_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.boss_hunter')).toMatchObject({ kind: 'build', role: 'boss_objective_extraction_build' });
        expect(byId.get('reward.boss_trophy_cache')).toMatchObject({ kind: 'reward', role: 'boss_objective_score_consequence' });
        expect(byId.get('economy.relic_favor')).toMatchObject({ kind: 'economy', role: 'objective_to_relic_selection_resource' });
        expect(byId.get('hazard.score_parasite')).toMatchObject({ kind: 'hazard', role: 'chapter_pressure_and_objective_counterplay' });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'relic.chapter_compass', target: 'reward.boss_trophy_cache', kind: 'modifies' }),
            expect.objectContaining({ source: 'relic.wager_surety', target: 'economy.relic_favor', kind: 'modifies' }),
            expect.objectContaining({ source: 'relic.wager_surety', target: 'objective.featured_streak', kind: 'modifies' }),
            expect.objectContaining({ source: 'relic.parasite_ledger', target: 'hazard.score_parasite', kind: 'counterplay' }),
            expect.objectContaining({ source: 'objective.defeat_boss', target: 'reward.boss_trophy_cache', kind: 'triggers' }),
            expect.objectContaining({ source: 'economy.relic_favor', target: 'progression.relic_draft', kind: 'grants' }),
            expect.objectContaining({ source: 'safety.parasite_ward', target: 'hazard.score_parasite', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.boss_hunter', target: 'reward.boss_trophy_cache', kind: 'consequence' })
        ]));
    });

    it('connects the Seer from secrets and Scout Glints through Pin, Peek, and safe correction decisions', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.secret_favor', 'reward.secret_favor'],
            ['relic.stray_charge_plus_one', 'relic.stray_charge_plus_one'],
            ['relic.pin_cap_plus_one', 'relic.pin_cap_plus_one'],
            ['findable.scout_glint', 'findable.scout_glint']
        ]);

        for (const definition of SEER_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.reveal_scout')).toMatchObject({ kind: 'build', role: 'information_control_build' });
        expect(byId.get('inventory.stray_remove_charge')).toMatchObject({
            kind: 'inventory',
            role: 'bounded_board_control_resource'
        });
        expect(byId.get('power.pin')).toMatchObject({ kind: 'power', role: 'player_authored_memory_marker' });
        expect(byId.get('power.stray_remove')).toMatchObject({ kind: 'power', role: 'completion_safe_board_control' });
        expect(byId.get('board.scout_reveal')).toMatchObject({ kind: 'board', role: 'information_consequence' });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.secret_favor', target: 'inventory.peek_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'reward.secret_favor', target: 'economy.relic_favor', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.stray_charge_plus_one', target: 'inventory.stray_remove_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.pin_cap_plus_one', target: 'power.pin', kind: 'modifies' }),
            expect.objectContaining({ source: 'findable.scout_glint', target: 'board.scout_reveal', kind: 'triggers' }),
            expect.objectContaining({ source: 'inventory.stray_remove_charge', target: 'power.stray_remove', kind: 'enables' }),
            expect.objectContaining({ source: 'power.stray_remove', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'board.scout_reveal', target: 'route.mystery', kind: 'consequence' }),
            expect.objectContaining({ source: 'build.reveal_scout', target: 'progression.relic_draft', kind: 'consequence' })
        ]));
    });

    it('connects the Route Gambler from per-floor commitment through wager Favor cash-out', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(byId.get('build.route_gambler')).toMatchObject({
            kind: 'build',
            role: 'risk_commitment_and_rescue_build'
        });
        expect(byId.get('inventory.gambit_token')).toMatchObject({
            kind: 'inventory',
            role: 'per_floor_third_flip_resource'
        });
        expect(byId.get('power.gambit')).toMatchObject({
            kind: 'power',
            role: 'mismatch_rescue_with_failure_cost'
        });
        expect(byId.get('objective.risk_wager')).toMatchObject({
            kind: 'objective',
            role: 'optional_streak_for_favor_commitment'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'progression.run_flow', target: 'inventory.gambit_token', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.gambit_token', target: 'power.gambit', kind: 'enables' }),
            expect.objectContaining({ source: 'power.gambit', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'objective.featured_streak', target: 'objective.risk_wager', kind: 'gates' }),
            expect.objectContaining({ source: 'objective.risk_wager', target: 'economy.relic_favor', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.wager_surety', target: 'objective.risk_wager', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.route_gambler', target: 'power.gambit', kind: 'consequence' })
        ]));
    });

    it('connects Saboteur board-control sources through charges into deterministic board choices', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.trait_toolkit', 'reward.trait_toolkit'],
            ['bonus_reward.stasis_lockbox', 'reward.stasis_lockbox'],
            ['bonus_reward.free_swap_floor', 'reward.free_swap_floor'],
            ['relic.extra_shuffle_charge', 'relic.extra_shuffle_charge'],
            ['relic.first_shuffle_free_per_floor', 'relic.first_shuffle_free_per_floor'],
            ['relic.region_shuffle_free_first', 'relic.region_shuffle_free_first']
        ]);

        for (const definition of BOARD_TACTICIAN_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('inventory.shuffle_charge')).toMatchObject({ kind: 'inventory', role: 'full_board_control_resource' });
        expect(byId.get('inventory.region_shuffle_charge')).toMatchObject({ kind: 'inventory', role: 'targeted_board_control_resource' });
        expect(byId.get('power.shuffle')).toMatchObject({ kind: 'power', role: 'global_hidden_board_reordering' });
        expect(byId.get('power.region_shuffle')).toMatchObject({ kind: 'power', role: 'targeted_hidden_row_reordering' });
        expect(byId.get('power.tile_swap')).toMatchObject({ kind: 'power', role: 'player_selected_board_reordering' });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.trait_toolkit', target: 'inventory.region_shuffle_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'reward.free_swap_floor', target: 'perk.free_first_swap_per_floor', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.extra_shuffle_charge', target: 'inventory.shuffle_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.shuffle_charge', target: 'power.shuffle', kind: 'enables' }),
            expect.objectContaining({ source: 'inventory.region_shuffle_charge', target: 'power.tile_swap', kind: 'enables' }),
            expect.objectContaining({ source: 'power.region_shuffle', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.trap_control', target: 'power.tile_swap', kind: 'consequence' })
        ]));
    });

    it('connects Memory Scout from study and clean streaks through Flash and Undo recovery', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.trait_streak_lens', 'reward.trait_streak_lens'],
            ['reward_perk.trait_streak_toolkit', 'perk.trait_streak_toolkit'],
            ['relic.memorize_bonus_ms', 'relic.memorize_bonus_ms'],
            ['relic.memorize_under_short_memorize', 'relic.memorize_under_short_memorize']
        ]);

        for (const definition of MEMORY_SCOUT_DEFINITIONS) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.get('build.memory_scout')).toMatchObject({
            kind: 'build',
            role: 'study_recall_and_mistake_recovery_build'
        });
        expect(byId.get('phase.memorize')).toMatchObject({
            kind: 'progression',
            role: 'bounded_pre_flip_information_window'
        });
        expect(byId.get('inventory.flash_pair_charge')).toMatchObject({
            kind: 'inventory',
            role: 'earned_pair_reveal_resource'
        });
        expect(byId.get('inventory.undo_charge')).toMatchObject({
            kind: 'inventory',
            role: 'per_floor_pending_mistake_recovery'
        });
        expect(byId.get('power.flash_pair')).toMatchObject({
            kind: 'power',
            role: 'deterministic_hidden_pair_reveal'
        });
        expect(byId.get('power.undo_resolve')).toMatchObject({
            kind: 'power',
            role: 'pending_mistake_recovery_with_focus_cost'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.trait_streak_lens', target: 'perk.trait_streak_toolkit', kind: 'grants' }),
            expect.objectContaining({ source: 'perk.trait_streak_toolkit', target: 'inventory.flash_pair_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'relic.memorize_bonus_ms', target: 'phase.memorize', kind: 'modifies' }),
            expect.objectContaining({ source: 'relic.memorize_under_short_memorize', target: 'phase.memorize', kind: 'counterplay' }),
            expect.objectContaining({ source: 'inventory.flash_pair_charge', target: 'power.flash_pair', kind: 'enables' }),
            expect.objectContaining({ source: 'inventory.undo_charge', target: 'power.undo_resolve', kind: 'enables' }),
            expect.objectContaining({ source: 'power.undo_resolve', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.memory_scout', target: 'power.flash_pair', kind: 'consequence' })
        ]));
    });

    it('connects Locksmith from insurance and shop purchase through explicit lock spend', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(LOCKSMITH_DEFINITIONS.map((definition) => definition.id)).toEqual([
            'bonus_reward.key_insurance'
        ]);
        expect(byId.get('reward.key_insurance')).toMatchObject({
            kind: 'reward',
            role: 'pre_lock_typed_key_insurance',
            tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
        });
        expect(byId.get('shop.master_key')).toMatchObject({
            kind: 'shop',
            role: 'universal_lock_fallback_purchase'
        });
        expect(byId.get('inventory.master_key')).toMatchObject({
            kind: 'inventory',
            role: 'universal_single_lock_resource'
        });
        expect(byId.get('build.locksmith')).toMatchObject({
            kind: 'build',
            role: 'lock_insurance_and_extraction_build'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.key_insurance', target: 'inventory.iron_key', kind: 'grants' }),
            expect.objectContaining({ source: 'shop.master_key', target: 'inventory.master_key', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.master_key', target: 'exit.primary', kind: 'unblocks' }),
            expect.objectContaining({ source: 'inventory.master_key', target: 'room.locked_cache', kind: 'unblocks' }),
            expect.objectContaining({ source: 'exit.primary', target: 'inventory.master_key', kind: 'consumes' }),
            expect.objectContaining({ source: 'exit.primary', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'build.locksmith', target: 'lock.typed_key', kind: 'counterplay' })
        ]));
    });

    it('connects Wild Run setup through one-token wildcard matches and floor continuity', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('mode.wild_run')).toMatchObject({
            kind: 'progression',
            role: 'persistent_joker_mode_setup'
        });
        expect(byId.get('inventory.wild_match_token')).toMatchObject({
            kind: 'inventory',
            role: 'persistent_single_wild_match_resource',
            tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts', 'src/shared/game.test.ts'])
        });
        expect(byId.get('board.wild_joker_tile')).toMatchObject({
            kind: 'board',
            role: 'single_tile_pair_bridge'
        });
        expect(byId.get('power.wild_match')).toMatchObject({
            kind: 'power',
            role: 'chosen_pair_bridge_with_exact_token_spend'
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'mode.wild_run', target: 'inventory.wild_match_token', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.wild_match_token', target: 'board.wild_joker_tile', kind: 'enables' }),
            expect.objectContaining({ source: 'inventory.wild_match_token', target: 'power.wild_match', kind: 'enables' }),
            expect.objectContaining({ source: 'inventory.wild_match_token', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'power.wild_match', target: 'inventory.wild_match_token', kind: 'consumes' }),
            expect.objectContaining({ source: 'power.wild_match', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'power.gambit', target: 'power.wild_match', kind: 'synergy' }),
            expect.objectContaining({ source: 'power.stray_remove', target: 'board.wild_joker_tile', kind: 'counterplay' }),
            expect.objectContaining({ source: 'power.wild_match', target: 'feedback.gameplay_hud', kind: 'displays' })
        ]));
    });

    it('models run loadouts as read-only projections over authoritative setup state', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('progression.run_setup')).toMatchObject({
            kind: 'progression',
            role: 'authoritative_pre_run_loadout_selection'
        });
        expect(byId.get('inventory.relic_loadout')).toMatchObject({
            kind: 'inventory',
            role: 'owned_relic_build_projection',
            writes: []
        });
        expect(byId.get('inventory.mutator_loadout')).toMatchObject({
            kind: 'inventory',
            role: 'floor_pressure_projection',
            writes: []
        });
        expect(byId.get('inventory.contract_loadout')).toMatchObject({
            kind: 'inventory',
            role: 'immutable_run_restriction_projection',
            writes: []
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'progression.run_setup', target: 'inventory.relic_loadout', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.run_setup', target: 'inventory.mutator_loadout', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.run_setup', target: 'inventory.contract_loadout', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'inventory.relic_loadout', kind: 'modifies' }),
            expect.objectContaining({ source: 'inventory.relic_loadout', target: 'progression.relic_draft', kind: 'gates' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'inventory.mutator_loadout', kind: 'modifies' }),
            expect.objectContaining({ source: 'inventory.mutator_loadout', target: 'hazard.score_parasite', kind: 'triggers' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.shuffle', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.destroy_pair', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.pin', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.relic_loadout', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'inventory.mutator_loadout', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'feedback.gameplay_hud', kind: 'displays' })
        ]));
    });

    it('connects typed Destroy Pair from charge and target choice through replayable floor consequence', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('power.destroy_pair')).toMatchObject({
            kind: 'power',
            role: 'flat_typed_completion_safe_pair_removal_and_floor_clear',
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/renderer/store/runSurfaceState.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'inventory.destroy_charge', target: 'power.destroy_pair', kind: 'enables' }),
            expect.objectContaining({ source: 'power.destroy_pair', target: 'inventory.destroy_charge', kind: 'consumes' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'power.destroy_pair', kind: 'modifies' }),
            expect.objectContaining({ source: 'power.destroy_pair', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'power.destroy_pair', target: 'progression.run_flow', kind: 'enables' }),
            expect.objectContaining({ source: 'power.destroy_pair', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'power.destroy_pair', target: 'simulation.gameplay_replay', kind: 'tested_by' }),
            expect.objectContaining({ source: 'build.emergency_toolkit', target: 'power.destroy_pair', kind: 'consequence' }),
            expect.objectContaining({ source: 'build.trap_control', target: 'power.destroy_pair', kind: 'consequence' })
        ]));
    });

    it('connects Hazard Banish acquisition to its typed floor-start removal or Destroy fallback', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(24);
        expect(byId.get('perk.hazard_banish_per_floor')).toMatchObject({
            kind: 'perk',
            role: 'durable_floor_start_hazard_or_destroy_conversion',
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/next-floor-run-state-rules.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.hazard_banisher', target: 'perk.hazard_banish_per_floor', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'perk.hazard_banish_per_floor', kind: 'triggers' }),
            expect.objectContaining({ source: 'perk.hazard_banish_per_floor', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'perk.hazard_banish_per_floor', target: 'hazard.tile_pressure', kind: 'counterplay' }),
            expect.objectContaining({ source: 'perk.hazard_banish_per_floor', target: 'inventory.destroy_charge', kind: 'grants' }),
            expect.objectContaining({ source: 'perk.hazard_banish_per_floor', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'perk.hazard_banish_per_floor', kind: 'gates' }),
            expect.objectContaining({ source: 'build.trap_control', target: 'perk.hazard_banish_per_floor', kind: 'consequence' })
        ]));
    });

    it('connects typed route selection from floor clear through exact replayable consequences', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(24);
        expect(byId.get('route.choice')).toMatchObject({
            kind: 'route',
            role: 'replayable_between_floor_commitment',
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/renderer/store/levelCompleteContinuationExecutor.test.ts',
                'src/shared/gameplay-core-simulation.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'objective.floor_clear', target: 'route.choice', kind: 'enables' }),
            expect.objectContaining({ source: 'route.choice', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'route.choice', kind: 'modifies' }),
            expect.objectContaining({ source: 'route.choice', target: 'progression.run_flow', kind: 'modifies' }),
            expect.objectContaining({ source: 'route.choice', target: 'economy.score_and_rewards', kind: 'modifies' }),
            expect.objectContaining({ source: 'route.choice', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'route.choice', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'route.choice', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('evaluates route strategy through typed outcomes instead of parallel reward arithmetic', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('simulation.build_evaluation')).toMatchObject({
            kind: 'simulation',
            role: 'route_outcome_and_strategy_balance_gate',
            evidence: expect.arrayContaining(['src/shared/balance-simulation.ts']),
            tests: ['src/shared/balance-simulation.test.ts']
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'route.choice', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.route_gambler', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'economy.score_and_rewards', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'safety.softlock_fairness', kind: 'guarded_by' })
        ]));
    });

    it('connects relic drafting and offer shaping to typed build acquisition, economy, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(24);
        expect(byId.get('progression.relic_draft')).toMatchObject({
            kind: 'progression',
            role: 'typed_replayable_build_selection_and_offer_shaping',
            evidence: expect.arrayContaining([
                'src/shared/relic-pick-transition-rules.ts',
                'src/shared/gameplay-core.ts',
                'src/renderer/store/relicOfferSurfaceState.ts'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/renderer/store/relicOfferSurfaceState.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'progression.relic_draft', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.relic_draft', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'inventory.relic_loadout', kind: 'modifies' }),
            expect.objectContaining({ source: 'inventory.relic_loadout', target: 'progression.relic_draft', kind: 'gates' }),
            expect.objectContaining({ source: 'economy.shop_gold', target: 'progression.relic_draft', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'economy.shop_gold', kind: 'consumes' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'progression.relic_draft', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects flat typed side-room choices from routes through rewards, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(24);
        expect(byId.get('progression.route_side_room')).toMatchObject({
            kind: 'progression',
            role: 'flat_replayable_between_floor_reward_choice',
            evidence: expect.arrayContaining([
                'src/shared/gameplay-core.ts',
                'src/renderer/store/sideRoomSurfaceState.ts',
                'src/renderer/store/sideRoomActionController.ts'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/renderer/store/useAppStore.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'route.choice', target: 'progression.route_side_room', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.route_side_room', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'progression.run_flow', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'economy.score_and_rewards', kind: 'modifies' }),
            expect.objectContaining({ source: 'relic.shrine_echo', target: 'progression.route_side_room', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'progression.route_side_room', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects flat typed floor advancement through pressure, board preparation, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(24);
        expect(byId.get('progression.run_flow')).toMatchObject({
            kind: 'progression',
            role: 'typed_flat_replayable_floor_transition',
            evidence: expect.arrayContaining([
                'src/shared/next-floor-transition-rules.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-adapters.ts',
                'src/renderer/store/levelCompleteSurfaceState.ts',
                'src/renderer/store/relicOfferSurfaceState.ts'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/game.test.ts',
                'src/renderer/store/levelCompleteSurfaceState.test.ts',
                'src/renderer/store/relicOfferSurfaceState.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'objective.floor_clear', target: 'progression.run_flow', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.run_flow', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'hazard.score_parasite', kind: 'triggers' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'perk.hazard_banish_per_floor', kind: 'triggers' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'phase.memorize', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects one typed non-final board turn through effects, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('core.board_turn_resolution')).toMatchObject({
            kind: 'core',
            role: 'single_command_match_mismatch_gambit_and_pair_floor_clear_transition',
            evidence: expect.arrayContaining([
                'src/shared/board-turn-transition.ts',
                'src/shared/floor-clear-transition.ts',
                'src/shared/slayer-floor-clear-transition.ts',
                'src/shared/gameplay-effect-transition.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/game.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'deterministic-event-sequence',
                'atomic-pair-floor-clear',
                'single-outer-command-journal'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'core.board_turn_resolution', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'progression.run_flow', kind: 'enables' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'power.wild_match', kind: 'modifies' }),
            expect.objectContaining({ source: 'trait.echo', target: 'core.board_turn_resolution', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });
});
