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
    SABOTEUR_DEFINITIONS,
    SEER_DEFINITIONS,
    SLAYER_DEFINITIONS,
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
                expect.objectContaining({ source: 'build.combo_shard_engine', target: 'progression.shard_to_life', kind: 'consequence' })
            ])
        );
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
        expect(byId.get('progression.relic_draft')).toMatchObject({ kind: 'progression', role: 'future_build_selection_consequence' });
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
});
