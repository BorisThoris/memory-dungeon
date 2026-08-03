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
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('exit.primary')).toMatchObject({
            kind: 'exit',
            role: 'flat_typed_exit_activation_and_floor_clear',
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/game.test.ts',
                'src/renderer/store/runSurfaceState.test.ts'
            ])
        });
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
                expect.objectContaining({ source: 'lock.iron_key', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'exit.primary' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'safety.dungeon_topology' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'shop.typed_key', target: 'lock.typed_key', kind: 'counterplay' }),
                expect.objectContaining({ source: 'lock.typed_key', target: 'room.locked_cache' }),
                expect.objectContaining({ source: 'room.locked_cache', target: 'safety.softlock_fairness' }),
                expect.objectContaining({ source: 'room.locked_cache', target: 'feedback.gameplay_hud' }),
                expect.objectContaining({ source: 'exit.primary', target: 'objective.floor_clear' }),
                expect.objectContaining({ source: 'exit.primary', target: 'progression.run_flow', kind: 'enables' }),
                expect.objectContaining({ source: 'exit.primary', target: 'safety.dungeon_topology' }),
                expect.objectContaining({ source: 'exit.primary', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'exit.primary', target: 'persistence.run_summary', kind: 'persists' }),
                expect.objectContaining({ source: 'exit.primary', target: 'simulation.gameplay_replay', kind: 'tested_by' }),
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

    it('connects concrete progression safety repairs to commands, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('safety.softlock_fairness')).toMatchObject({
            kind: 'safety',
            role: 'typed_invariant_and_replayable_repair_gate',
            evidence: expect.arrayContaining([
                'src/shared/run-progression-repair.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-adapters.ts',
                'src/shared/gameplay-core-simulation.ts',
                'scripts/sim-gameplay-core.ts',
                'src/renderer/store/runResolutionController.ts',
                'src/renderer/store/levelCompleteSurfaceState.ts'
            ]),
            reads: expect.arrayContaining([
                'enemyHazards',
                'dungeonExitLockKind',
                'dungeonExitRequiredLeverCount',
                'dungeonKeys'
            ]),
            writes: expect.arrayContaining([
                'dungeonExitLockKind',
                'enemyHazards',
                'dungeonEnemiesDefeated',
                'gameplayCommandJournal',
                'gameplayEventJournal',
                'feedbackLines'
            ]),
            softlockGuards: expect.arrayContaining([
                'strict-progression-repair-command',
                'effect-only-acceptance',
                'exact-repair-diff-event',
                'single-repair-command-journal',
                'json-round-trip'
            ]),
            tests: expect.arrayContaining([
                'src/shared/run-progression-repair.test.ts',
                'src/shared/gameplay-core.test.ts',
                'src/shared/gameplay-core-simulation.test.ts',
                'src/renderer/store/runResolutionController.test.ts',
                'src/renderer/store/levelCompleteSurfaceState.test.ts',
                'src/renderer/store/gameplayFeedbackAdapter.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'safety.softlock_fairness', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'safety.softlock_fairness', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'safety.softlock_fairness', kind: 'triggers' }),
            expect.objectContaining({ source: 'safety.softlock_fairness', target: 'exit.primary', kind: 'unblocks' }),
            expect.objectContaining({ source: 'safety.softlock_fairness', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'safety.softlock_fairness', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'safety.softlock_fairness', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
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

    it('connects the source-derived AI model to run-state, protocol, and architecture drift gates', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(byId.get('simulation.ai_repository_model')).toMatchObject({
            kind: 'simulation',
            role: 'compiler_derived_repository_run_state_protocol_renderer_ownership_orchestration_and_gameplay_relationship_gate',
            evidence: expect.arrayContaining([
                'scripts/ai-repo-model.mjs',
                'src/shared/contracts.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/run-settings-rules.ts',
                'src/shared/interlude-transition-rules.ts',
                'src/shared/run-summary-rules.ts',
                'src/renderer/components/GameScreen.tsx',
                'src/renderer/components/gameScreenBoardFeedbackModel.ts',
                'src/shared/gameplay-interaction-graph-data.json',
                'src/shared/gameplay-feedback-facts.ts',
                'src/renderer/store/gameplayFeedbackAdapter.ts'
            ]),
            reads: expect.arrayContaining([
                'RunState',
                'sourceFileMetrics',
                'runStateWriteSites',
                'gameplayCommandSchema',
                'gameplayEventSchema',
                'gameplayInteractionGraph',
                'playerVisibleFieldRegistry'
            ]),
            writes: expect.arrayContaining([
                'repositoryModelReport',
                'runStateFieldUsageReport',
                'rendererRunStateOwnershipReport',
                'orchestrationBudgetReport',
                'gameplayProtocolReport',
                'modelDiagnosticsReport'
            ]),
            softlockGuards: expect.arrayContaining([
                'compiler-derived-run-state-fields',
                'full-run-state-construction-classification',
                'renderer-run-state-write-error',
                'source-derived-orchestration-budget',
                'game-screen-line-and-import-ceiling',
                'schema-derived-gameplay-protocol',
                'command-handler-completeness',
                'event-emitter-completeness',
                'protocol-test-completeness',
                'feedback-display-consumer',
                'exact-source-references',
                'dormant-run-state-field-error',
                'generated-model-drift-check',
                'zero-diagnostics'
            ]),
            tests: expect.arrayContaining([
                'src/shared/ai-repo-model.test.ts',
                'src/shared/run-settings-rules.test.ts',
                'src/shared/run-summary-rules.test.ts',
                'src/renderer/store/sideRoomSurfaceState.test.ts',
                'src/renderer/components/gameScreenBoardFeedbackModel.test.ts',
                'src/shared/gameplay-effect-transition.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'simulation.ai_repository_model', target: 'core.gameplay_commands', kind: 'gates' }),
            expect.objectContaining({ source: 'simulation.ai_repository_model', target: 'feedback.gameplay_hud', kind: 'gates' }),
            expect.objectContaining({ source: 'simulation.ai_repository_model', target: 'persistence.run_summary', kind: 'gates' }),
            expect.objectContaining({ source: 'simulation.ai_repository_model', target: 'safety.softlock_fairness', kind: 'gates' }),
            expect.objectContaining({ source: 'simulation.ai_repository_model', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects the first command-core build from content choice through persistence and consequence', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const prefixBySourceKind = {
            bonus_reward: 'reward',
            relic: 'relic',
            reward_perk: 'perk',
            findable: 'findable'
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
            'bonus_reward.supply_cache',
            'relic.stray_charge_plus_one'
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
            role: 'flat_typed_offer_open_selection_and_shaping'
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

    it('consolidates Seer information sources into Conduit and routes safe correction to the emergency toolkit', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        const sourceNodeByDefinition = new Map([
            ['bonus_reward.secret_favor', 'reward.secret_favor'],
            ['relic.stray_charge_plus_one', 'relic.stray_charge_plus_one'],
            ['relic.pin_cap_plus_one', 'relic.pin_cap_plus_one'],
            ['findable.scout_glint', 'findable.scout_glint']
        ]);

        const consolidatedDefinitions = [
            ...CONDUIT_CARTOGRAPHER_DEFINITIONS.filter((definition) => sourceNodeByDefinition.has(definition.id)),
            ...SUPPLY_CACHE_DEFINITIONS.filter((definition) => sourceNodeByDefinition.has(definition.id))
        ];
        for (const definition of consolidatedDefinitions) {
            const nodeId = sourceNodeByDefinition.get(definition.id);
            expect(nodeId, definition.id).toBeTruthy();
            expect(byId.get(nodeId!), definition.id).toMatchObject({
                tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
            });
        }

        expect(byId.has('build.reveal_scout')).toBe(false);
        expect(byId.get('build.conduit_cartographer')).toMatchObject({
            kind: 'build',
            role: 'scout_reveal_pin_and_peek_information_control_build',
            tests: expect.arrayContaining([
                'src/shared/gameplay-core-playthrough-solver.test.ts',
                'src/shared/build-strategy-playthrough-simulation.test.ts'
            ])
        });
        expect(byId.get('inventory.stray_remove_charge')).toMatchObject({
            kind: 'inventory',
            role: 'bounded_board_control_resource'
        });
        expect(byId.get('power.pin')).toMatchObject({ kind: 'power', role: 'player_authored_memory_marker' });
        expect(byId.get('power.stray_remove')).toMatchObject({
            kind: 'power',
            role: 'completion_safe_typed_control_with_transient_surface_intent'
        });
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
            expect.objectContaining({ source: 'relic.pin_cap_plus_one', target: 'build.conduit_cartographer', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'findable.scout_glint', target: 'build.conduit_cartographer', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'build.conduit_cartographer', target: 'power.pin', kind: 'consequence' }),
            expect.objectContaining({ source: 'build.conduit_cartographer', target: 'progression.relic_draft', kind: 'consequence' }),
            expect.objectContaining({ source: 'relic.stray_charge_plus_one', target: 'build.emergency_toolkit', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'build.emergency_toolkit', target: 'power.stray_remove', kind: 'consequence' })
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
        for (const mechanicId of ['power.region_shuffle', 'power.tile_swap', 'perk.free_first_swap_per_floor']) {
            expect(byId.get(mechanicId), mechanicId).toMatchObject({
                reads: expect.arrayContaining(['rewardPerkIds', 'regionShuffleFreeThisFloor']),
                softlockGuards: expect.arrayContaining([
                    'reward-perk-or-relic-free-use',
                    'free-use-before-paid-charge'
                ]),
                tests: expect.arrayContaining([
                    'src/shared/board-power-availability.test.ts',
                    'src/shared/board-power-actions.test.ts',
                    'src/shared/gameplay-core.test.ts',
                    'src/shared/power-verbs.test.ts'
                ])
            });
        }
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
            role: 'typed_replayable_study_to_play_transition',
            evidence: expect.arrayContaining([
                'src/shared/memorize-phase-rules.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/runTimerController.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'strict-memorize-complete-command',
                'single-phase-transition',
                'json-round-trip'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/gameplay-core-simulation.test.ts',
                'src/renderer/store/runTimerController.test.ts'
            ])
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
            expect.objectContaining({ source: 'phase.memorize', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'phase.memorize', kind: 'modifies' }),
            expect.objectContaining({ source: 'phase.memorize', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'phase.memorize', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'phase.memorize', target: 'simulation.gameplay_replay', kind: 'tested_by' }),
            expect.objectContaining({ source: 'inventory.flash_pair_charge', target: 'power.flash_pair', kind: 'enables' }),
            expect.objectContaining({ source: 'inventory.flash_pair_charge', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'inventory.undo_charge', target: 'power.undo_resolve', kind: 'enables' }),
            expect.objectContaining({ source: 'power.undo_resolve', target: 'objective.floor_clear', kind: 'counterplay' }),
            expect.objectContaining({ source: 'build.memory_scout', target: 'power.flash_pair', kind: 'consequence' })
        ]));
    });

    it('connects the Gauntlet clock from run setup through a replayable terminal consequence', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('mode.gauntlet_clock')).toMatchObject({
            kind: 'hazard',
            role: 'serialized_host_clock_terminal_transition',
            evidence: expect.arrayContaining([
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/runTimerController.ts',
                'src/renderer/store/useAppStore.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'serialized-host-clock-observation',
                'paused-run-immunity',
                'single-terminal-transition',
                'json-round-trip'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/gameplay-core-simulation.test.ts',
                'src/renderer/store/runTimerController.test.ts',
                'src/renderer/store/useAppStore.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'progression.run_setup', target: 'mode.gauntlet_clock', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'mode.gauntlet_clock', kind: 'modifies' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'mode.gauntlet_clock', kind: 'modifies' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'phase.memorize', kind: 'gates' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'core.tile_input', kind: 'gates' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'mode.gauntlet_clock', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects pause and resume across timer snapshots, lifecycle recovery, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('phase.pause_resume')).toMatchObject({
            kind: 'core',
            role: 'serialized_timer_snapshot_and_clock_lifecycle_transition',
            evidence: expect.arrayContaining([
                'src/shared/run-timer-rules.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/runTimerController.ts',
                'src/renderer/store/pauseResumeExecutor.ts',
                'src/renderer/store/metaOverlayExecutor.ts',
                'src/renderer/store/shopCloseExecutor.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'serialized-timer-snapshot',
                'snapshot-before-timer-clear',
                'gauntlet-deadline-extension',
                'invalid-resolving-recovery',
                'dead-run-terminal-resume',
                'json-round-trip'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/gameplay-core-simulation.test.ts',
                'src/renderer/store/runTimerController.test.ts',
                'src/renderer/store/useAppStore.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'phase.memorize', target: 'phase.pause_resume', kind: 'enables' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'phase.pause_resume', kind: 'enables' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'phase.pause_resume', kind: 'enables' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'phase.pause_resume', kind: 'modifies' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'mode.gauntlet_clock', kind: 'modifies' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'phase.memorize', kind: 'gates' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'core.tile_input', kind: 'gates' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('separates typed debug reveal lifecycle from the consumable Peek power', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('debug.reveal_lifecycle')).toMatchObject({
            kind: 'core',
            role: 'replayable_debug_visibility_and_achievement_policy_transition',
            evidence: expect.arrayContaining([
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-adapters.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/runLifecycleController.ts',
                'src/renderer/store/runTimerController.ts',
                'src/renderer/store/runResolutionController.ts',
                'src/renderer/store/gameplayFeedbackAdapter.ts'
            ]),
            reads: expect.arrayContaining([
                'debugPeekActive',
                'debugUsed',
                'debugRevealRemainingMs',
                'disableAchievementsOnDebug',
                'achievementsEnabled'
            ]),
            writes: expect.arrayContaining([
                'debugPeekActive',
                'debugUsed',
                'debugRevealRemainingMs',
                'achievementsEnabled',
                'gameplayCommandJournal',
                'gameplayEventJournal'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/gameplay-core-simulation.test.ts',
                'src/renderer/store/runLifecycleController.test.ts',
                'src/renderer/store/runTimerController.test.ts',
                'src/renderer/store/runResolutionController.test.ts',
                'src/renderer/store/gameplayFeedbackAdapter.test.ts'
            ])
        });
        expect(byId.get('power.peek')).toMatchObject({ kind: 'power', role: 'information_conversion' });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'debug.reveal_lifecycle', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'debug.reveal_lifecycle', kind: 'modifies' }),
            expect.objectContaining({ source: 'phase.pause_resume', target: 'debug.reveal_lifecycle', kind: 'modifies' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'debug.reveal_lifecycle', kind: 'triggers' }),
            expect.objectContaining({ source: 'debug.reveal_lifecycle', target: 'stats.session_tracking', kind: 'gates' }),
            expect.objectContaining({ source: 'debug.reveal_lifecycle', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'debug.reveal_lifecycle', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'debug.reveal_lifecycle', target: 'simulation.gameplay_replay', kind: 'tested_by' })
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
            role: 'typed_key_cache_and_alternate_exit_extraction_build'
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
        expect(gameplayInteractionGraph.version).toBe(70);
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
        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('route.choice')).toMatchObject({
            kind: 'route',
            role: 'flat_replayable_commitment_and_interlude_open',
            evidence: expect.arrayContaining([
                'src/shared/route-side-room-rules.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core-simulation.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'atomic-side-room-open',
                'single-command-route-and-interlude',
                'json-round-trip'
            ]),
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
            expect.objectContaining({ source: 'route.choice', target: 'progression.route_side_room', kind: 'triggers' }),
            expect.objectContaining({ source: 'route.choice', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'route.choice', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'route.choice', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('evaluates route profiles and nine distinct builds through long-horizon policies and shipped counter-matchups', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('simulation.build_evaluation')).toMatchObject({
            kind: 'simulation',
            role: 'route_profile_and_twelve_floor_nine_build_bounded_memory_information_annotation_visible_resource_interlude_risk_sustain_board_reconfiguration_boss_recovery_and_lock_extraction_policy_counter_matchup_viability_balance_feedback_and_replay_gate',
            evidence: expect.arrayContaining([
                'src/shared/balance-simulation.ts',
                'src/shared/build-strategy-simulation.ts',
                'src/shared/build-strategy-playthrough-simulation.ts',
                'src/shared/gameplay-core-playthrough-solver.ts',
                'scripts/sim-build-strategies.ts',
                'scripts/sim-build-strategy-playthroughs.ts'
            ]),
            reads: expect.arrayContaining([
                'startingLoadoutId',
                'contentDefinitionIds',
                'gameplayCommands',
                'gameplayEvents',
                'feedbackCues',
                'traitInteractionTags',
                'activeMutators',
                'floorTag',
                'informationPolicy',
                'memoryTileCapacity',
                'uncertainTurnBudget',
                'observedTileIds',
                'routeChoiceOutcomes',
                'runEventChoiceEffects',
                'scoreParasite',
                'safeHazardWardChargesThisFloor',
                'parasiteWardRemaining',
                'destroyPairCharges',
                'gambitPolicy',
                'gambitSuppressedMatchups',
                'recoveryPolicy',
                'recoverySuppressedMatchups',
                'lockPolicy',
                'lockPolicySuppressedMatchups',
                'pinPolicy',
                'pinPolicySuppressedMatchups',
                'pinnedTileIds',
                'flashPairCharges',
                'undoUsesThisFloor',
                'endlessRiskWager',
                'featuredObjectiveStreak',
                'comboShards',
                'conversionRiskCredit',
                'rewardPerkIds',
                'regionShuffleCharges',
                'regionShuffleFreeThisFloor',
                'tileHazardKind',
                'dungeonBossId',
                'bossTrophyCacheOutcome',
                'featuredObjectiveCompleted',
                'relicIds'
            ]),
            writes: expect.arrayContaining([
                'balanceProfileReport',
                'buildStrategyReport',
                'boundedInformationReport',
                'routeRiskAssessmentReport',
                'sideRoomResourceAssessmentReport',
                'cohesiveBuildCoverageReport',
                'gambitCommitReport',
                'riskWagerOutcomeReport',
                'shardLifeConversionReport',
                'comboShardSourceReport',
                'targetedReconfigurationReport',
                'memoryPressureConservationReport',
                'bossTrophyConversionReport',
                'parasiteReliefReport',
                'flashPairUseReport',
                'undoResolveReport',
                'typedKeyLockUseReport',
                'masterKeyLockUseReport',
                'masterKeyPurchaseReport',
                'lockPressureConservationReport',
                'pinPlacementReport',
                'scoutGlintMatchReport',
                'hazardPinConservationReport',
                'strategyAxisScores',
                'pairwiseAxisDistances',
                'generatedBoardPlaythroughReport',
                'replayReport',
                'invariantViolations'
            ]),
            enables: expect.arrayContaining([
                'build.route_gambler',
                'build.conduit_cartographer',
                'build.guard_tank',
                'build.treasure_greed',
                'build.combo_shard_engine',
                'build.trap_control',
                'build.boss_hunter',
                'build.memory_scout',
                'build.locksmith'
            ]),
            softlockGuards: expect.arrayContaining([
                'nine-strategy-minimum',
                'distinct-risk-conversion-axis',
                'distinct-sustain-conversion-axis',
                'distinct-board-reconfiguration-axis',
                'distinct-boss-extraction-axis',
                'distinct-mistake-recovery-axis',
                'distinct-lock-extraction-axis',
                'route-gambler-wager-outcome',
                'third-shard-life-conversion',
                'parasite-counter-matchup',
                'boss-hunter-wager-outcome',
                'claimed-boss-trophy-conversion',
                'featured-objective-parasite-relief',
                'hazard-pressure-targeted-reconfiguration',
                'memory-pressure-reconfiguration-conservation',
                'renewable-free-reconfiguration-source',
                'hazard-matchup-gambit-suppression',
                'typed-content-definition-activation',
                'authoritative-consequence-command',
                'deterministic-command-replay',
                'typed-feedback-minimum',
                'distinct-axis-fingerprint',
                'multi-floor-command-id-uniqueness',
                'strictly-increasing-floor-identity',
                'per-floor-replay-checkpoint',
                'full-run-json-replay',
                'observed-matchup-distribution',
                'recurring-trait-synergy-minimum',
                'synergy-preserving-destroy-policy',
                'twelve-floor-policy-horizon',
                'legality-aware-policy-selection',
                'bounded-memory-policy',
                'identity-blind-unknown-choice',
                'uncertain-turn-budget',
                'imperfect-information-floor-minimum',
                'zero-risk-budget-exhaustion',
                'mid-turn-resolving-state',
                'shipped-favorable-matchup-exposure',
                'shipped-counter-matchup-exposure',
                'counter-matchup-replay',
                'tile-flip-enemy-defeat-feedback',
                'pairwise-turn-ratio-bound',
                'typed-route-outcome-preview',
                'visible-resource-risk-budget',
                'survival-reserve',
                'bounded-opening-risk-credit',
                'full-shard-greed-credit',
                'adaptive-route-selection',
                'actual-event-effect-ranking',
                'recovery-below-reserve',
                'route-gambler-long-horizon-coverage',
                'combo-shard-long-horizon-coverage',
                'trap-control-long-horizon-coverage',
                'boss-hunter-long-horizon-coverage',
                'memory-scout-long-horizon-coverage',
                'locksmith-long-horizon-coverage',
                'conduit-information-control-long-horizon-coverage',
                'observed-known-pair-pin-only',
                'scout-glint-match-source',
                'hazard-pressure-pin-conservation',
                'typed-key-lock-use',
                'master-key-shop-purchase',
                'master-key-lock-fallback',
                'hazard-pressure-lock-conservation',
                'typed-pause-purchase-resume'
            ]),
            tests: expect.arrayContaining([
                'src/shared/balance-simulation.test.ts',
                'src/shared/build-strategy-simulation.test.ts',
                'src/shared/build-strategy-playthrough-simulation.test.ts',
                'src/shared/gameplay-core-playthrough-solver.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'route.choice', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.route_gambler', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.conduit_cartographer', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.guard_tank', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.treasure_greed', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.combo_shard_engine', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.trap_control', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.boss_hunter', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.memory_scout', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.locksmith', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'economy.score_and_rewards', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'feedback.gameplay_hud', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'simulation.gameplay_replay', kind: 'guarded_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'safety.softlock_fairness', kind: 'guarded_by' }),
            expect.objectContaining({ source: 'simulation.generated_board_playthrough', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'progression.relic_draft', kind: 'tested_by' })
        ]));
    });

    it('executes generated-board fairness through typed commands, feedback audits, and sampled replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('simulation.generated_board_playthrough')).toMatchObject({
            kind: 'simulation',
            role: 'core_command_event_perfect_bounded_information_identity_blind_gambit_recovery_opt_in_pin_annotation_and_lock_extraction_generated_board_fairness_and_replay_gate',
            evidence: expect.arrayContaining([
                'src/shared/playthrough-solver-rules.ts',
                'src/shared/gameplay-core-playthrough-solver.ts',
                'src/shared/softlock-generator-contract.ts',
                'scripts/sim-endless.ts'
            ]),
            reads: expect.arrayContaining([
                'tileStates',
                'stickyBlockIndex',
                'dungeonExitLockKind',
                'informationPolicy',
                'memoryTileCapacity',
                'uncertainTurnBudget',
                'gambitPolicy',
                'recoveryPolicy',
                'lockPolicy',
                'pinPolicy',
                'pinnedTileIds',
                'undoUsesThisFloor',
                'gambitAvailableThisFloor',
                'gambitThirdFlipUsed',
                'gameplayCommands',
                'gameplayEvents',
                'feedbackCompletenessDiagnostic'
            ]),
            writes: expect.arrayContaining([
                'generatedBoardPlaythroughReport',
                'boundedInformationReport',
                'gambitCommitReport',
                'undoResolveReport',
                'typedKeyLockUseReport',
                'masterKeyLockUseReport',
                'masterKeyPurchaseReport',
                'pinPlacementReport',
                'replayReport',
                'invariantViolations'
            ]),
            enables: expect.arrayContaining([
                'objective.floor_clear',
                'exit.primary',
                'exit.locked_alternate',
                'room.locked_cache',
                'shop.master_key',
                'power.pin',
                'progression.run_flow',
                'safety.softlock_fairness',
                'simulation.gameplay_replay'
            ]),
            softlockGuards: expect.arrayContaining([
                'strict-command-schema',
                'sticky-blocked-tile-second',
                'typed-feedback-completeness',
                'default-perfect-information-parity',
                'bounded-observation-ledger',
                'identity-blind-unknown-tile-selection',
                'identity-blind-gambit-target',
                'identity-blind-opposite-edge-recovery-target',
                'gambit-command-before-third-flip',
                'undo-only-after-uncertain-mismatch',
                'single-floor-gambit-token',
                'single-floor-undo-use',
                'observed-known-pair-pin-only',
                'two-pins-per-floor',
                'affordable-lock-only',
                'typed-key-first',
                'typed-pause-purchase-resume',
                'default-primary-exit-parity',
                'uncertain-turn-budget',
                'mid-turn-resolving-state',
                'json-round-trip-replay',
                'sampled-long-run-replay-coverage'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core-playthrough-solver.test.ts',
                'src/shared/softlock-generator-contract.test.ts',
                'src/shared/sim-endless-output.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.generated_board_playthrough', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'simulation.generated_board_playthrough', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'simulation.generated_board_playthrough', kind: 'tested_by' }),
            expect.objectContaining({ source: 'exit.primary', target: 'simulation.generated_board_playthrough', kind: 'tested_by' }),
            expect.objectContaining({ source: 'safety.feedback_completeness', target: 'simulation.generated_board_playthrough', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.generated_board_playthrough', target: 'objective.floor_clear', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.generated_board_playthrough', target: 'safety.softlock_fairness', kind: 'guarded_by' }),
            expect.objectContaining({ source: 'simulation.generated_board_playthrough', target: 'safety.dungeon_topology', kind: 'guarded_by' }),
            expect.objectContaining({ source: 'simulation.generated_board_playthrough', target: 'simulation.gameplay_replay', kind: 'guarded_by' })
        ]));
    });

    it('connects relic drafting and offer shaping to typed build acquisition, economy, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('progression.relic_draft')).toMatchObject({
            kind: 'progression',
            role: 'flat_typed_offer_open_selection_and_shaping',
            evidence: expect.arrayContaining([
                'src/shared/relic-offer-open-rules.ts',
                'src/shared/relic-pick-transition-rules.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/levelCompleteSurfaceState.ts',
                'src/renderer/store/relicOfferSurfaceState.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'strict-relic-offer-open-command',
                'empty-pool-milestone-skip',
                'typed-offer-feedback',
                'json-round-trip'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/renderer/store/relicOfferSurfaceState.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'progression.run_flow', target: 'progression.relic_draft', kind: 'triggers' }),
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
        expect(gameplayInteractionGraph.version).toBe(70);
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
            expect.objectContaining({ source: 'route.choice', target: 'progression.route_side_room', kind: 'triggers' }),
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

    it('connects Locksmith insurance through board-shop fallback into cache and alternate-exit extraction', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('build.locksmith')).toMatchObject({
            kind: 'build',
            role: 'typed_key_cache_and_alternate_exit_extraction_build',
            reads: expect.arrayContaining([
                'dungeonKeys',
                'dungeonMasterKeys',
                'shopOffers',
                'lockPolicy',
                'floorMatchup'
            ]),
            softlockGuards: expect.arrayContaining([
                'typed-key-first',
                'master-key-fallback',
                'typed-pause-purchase-resume',
                'hazard-pressure-lock-conservation',
                'twelve-floor-long-horizon-replay'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core-playthrough-solver.test.ts',
                'src/shared/build-strategy-simulation.test.ts',
                'src/shared/build-strategy-playthrough-simulation.test.ts'
            ])
        });
        expect(byId.get('exit.locked_alternate')).toMatchObject({
            kind: 'exit',
            role: 'optional_keyed_route_extraction',
            softlockGuards: expect.arrayContaining([
                'affordable-lock-only',
                'typed-key-first',
                'master-key-fallback',
                'primary-exit-remains-available'
            ])
        });
        expect(byId.get('room.locked_cache')).toMatchObject({
            writes: expect.arrayContaining(['dungeonKeys', 'dungeonMasterKeys', 'gameplayEvents', 'feedbackLines']),
            softlockGuards: expect.arrayContaining(['typed-spend-reward-event', 'exact-command-replay'])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'reward.key_insurance', target: 'build.locksmith', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'shop.master_key', target: 'inventory.master_key', kind: 'grants' }),
            expect.objectContaining({ source: 'inventory.master_key', target: 'exit.locked_alternate', kind: 'unblocks' }),
            expect.objectContaining({ source: 'build.locksmith', target: 'room.locked_cache', kind: 'consequence' }),
            expect.objectContaining({ source: 'build.locksmith', target: 'exit.locked_alternate', kind: 'consequence' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'build.locksmith', kind: 'tested_by' })
        ]));
    });

    it('connects flat typed floor advancement through pressure, board preparation, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(gameplayInteractionGraph.version).toBe(70);
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
        expect(gameplayInteractionGraph.version).toBe(70);
        expect(byId.get('core.board_turn_resolution')).toMatchObject({
            kind: 'core',
            role: 'renderer_direct_single_command_match_mismatch_gambit_floor_clear_and_feedback_fact_transition',
            evidence: expect.arrayContaining([
                'src/shared/board-turn-transition.ts',
                'src/shared/floor-clear-transition.ts',
                'src/shared/slayer-floor-clear-transition.ts',
                'src/shared/gameplay-effect-transition.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/game.ts',
                'src/renderer/store/matchScorePop.ts',
                'src/renderer/store/runResolutionController.ts'
            ]),
            writes: expect.arrayContaining([
                'floaterTileIds',
                'matchedFindableKind',
                'matchedRouteKind',
                'traitInteractionTags'
            ]),
            softlockGuards: expect.arrayContaining([
                'deterministic-event-sequence',
                'atomic-pair-floor-clear',
                'single-outer-command-journal',
                'adapter-owned-outer-journal',
                'renderer-direct-command-adapter',
                'no-renderer-turn-compatibility-import',
                'authoritative-feedback-facts'
            ])
        });
        expect(byId.get('feedback.board_turn_floater')).toMatchObject({
            kind: 'feedback',
            role: 'event_only_authoritative_replay_stable_complete_board_consequence_and_proc_batch_projection',
            evidence: expect.arrayContaining([
                'src/shared/board-turn-event-facts.ts',
                'src/shared/board-turn-feedback-boundary.test.ts',
                'src/renderer/copy/boardTurnAnnouncement.ts',
                'src/renderer/store/gameplayFeedbackAdapter.ts',
                'src/renderer/store/matchScorePop.ts',
                'src/renderer/store/runResolutionController.ts',
                'src/renderer/components/GameScreen.tsx',
                'src/renderer/hooks/useHudPoliteLiveAnnouncement.ts'
            ]),
            writes: expect.arrayContaining([
                'matchScorePop',
                'mismatchScorePop',
                'pickupToast',
                'politeLiveAnnouncement'
            ]),
            reads: expect.arrayContaining([
                'findablesClaimedBefore',
                'findablesClaimedAfter',
                'findablesTotalBefore',
                'findablesTotalAfter',
                'matchedPairsBefore',
                'matchedPairsAfter',
                'matchedTraitKinds',
                'mismatchedTraitKinds',
                'objectiveBefore',
                'objectiveAfter',
                'recallFocusBefore',
                'recallFocusAfter',
                'dungeonEnemiesDefeatedBefore',
                'dungeonEnemiesDefeatedAfter',
                'currentStreakBefore',
                'currentStreakAfter',
                'hazardTilesBefore',
                'hazardTilesAfter',
                'scoutsBefore',
                'scoutsAfter',
                'mimicCacheBefore',
                'mimicCacheAfter',
                'routeSpecialsBefore',
                'routeSpecialsAfter',
                'safeHazardWardsUsedBefore',
                'safeHazardWardsUsedAfter'
            ]),
            softlockGuards: expect.arrayContaining([
                'schema-validated-event-facts',
                'deterministic-command-key',
                'no-renderer-gameplay-rule-execution',
                'no-state-snapshot-compatibility',
                'no-pickup-board-diff',
                'event-only-pickup-toast-context',
                'no-board-turn-hud-snapshot-inference',
                'single-event-accessible-narration',
                'no-board-effect-counter-props',
                'single-board-turn-consequence-summary',
                'reduced-motion-event-projection',
                'lossless-same-command-proc-feedback',
                'feedback-critical-transition-audit'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/board-turn-event-facts.test.ts',
                'src/shared/board-turn-feedback-boundary.test.ts',
                'src/renderer/copy/boardTurnAnnouncement.test.ts',
                'src/renderer/store/gameplayFeedbackAdapter.test.ts',
                'src/renderer/store/matchScorePop.test.ts',
                'src/renderer/store/runResolutionController.test.ts',
                'src/renderer/components/GameScreen.test.tsx',
                'src/renderer/hooks/useHudPoliteLiveAnnouncement.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'core.board_turn_resolution', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'progression.run_flow', kind: 'enables' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'power.wild_match', kind: 'modifies' }),
            expect.objectContaining({ source: 'trait.echo', target: 'core.board_turn_resolution', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'feedback.board_turn_floater', kind: 'displays' }),
            expect.objectContaining({ source: 'hazard.tile_pressure', target: 'feedback.board_turn_floater', kind: 'displays' }),
            expect.objectContaining({ source: 'hazard.enemy_patrol', target: 'feedback.board_turn_floater', kind: 'displays' }),
            expect.objectContaining({ source: 'safety.safe_hazard_ward', target: 'feedback.board_turn_floater', kind: 'displays' }),
            expect.objectContaining({ source: 'route.choice', target: 'feedback.board_turn_floater', kind: 'displays' }),
            expect.objectContaining({ source: 'feedback.board_turn_floater', target: 'feedback.gameplay_hud', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'feedback.board_turn_floater', target: 'simulation.gameplay_replay', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('gates the strict event-only HUD with a feedback-critical transition audit', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('safety.feedback_completeness')).toMatchObject({
            kind: 'safety',
            role: 'deterministic_feedback_critical_transition_invariant',
            evidence: expect.arrayContaining([
                'src/shared/gameplay-feedback-facts.ts',
                'src/shared/gameplay-feedback-completeness.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/shared/gameplay-feedback-completeness.test.ts',
                'src/shared/typed-gameplay-feedback-boundary.test.ts',
                'src/renderer/hooks/useHudPoliteLiveAnnouncement.ts',
                'src/renderer/components/GameScreen.tsx'
            ]),
            reads: expect.arrayContaining([
                'acceptedCommand',
                'gameplayEvents',
                'lives',
                'guardTokens',
                'comboShards',
                'currentStreak',
                'currentLevelScore',
                'totalScore',
                'shopGold',
                'dungeonKeys',
                'shuffleCharges',
                'regionShuffleCharges',
                'destroyPairCharges',
                'peekCharges',
                'flashPairCharges',
                'strayRemoveCharges',
                'relicFavorProgress',
                'pinnedTileIds',
                'objectiveCompleted',
                'recallFocus',
                'forgottenTileIdsThisFloor',
                'enemyHazardHitsThisFloor'
            ]),
            writes: expect.arrayContaining(['feedbackCompletenessDiagnostic', 'invariantViolations']),
            blocks: expect.arrayContaining(['missing_feedback', 'renderer_state_inference']),
            softlockGuards: expect.arrayContaining([
                'normalized-feedback-critical-snapshot',
                'single-player-visible-state-registry',
                'exact-changed-field-diagnostic',
                'accepted-transition-only',
                'typed-feedback-or-board-envelope',
                'seeded-command-corpus',
                'ai-model-visible-state-drift-check',
                'no-legacy-action-fallback',
                'no-renderer-gameplay-state-props'
            ])
        });
        expect(byId.get('feedback.gameplay_hud')).toMatchObject({
            role: 'strict_event_only_readability_gate',
            softlockGuards: expect.arrayContaining([
                'typed-command-or-board-event',
                'no-renderer-gameplay-delta-reconstruction'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'safety.feedback_completeness', kind: 'tested_by' }),
            expect.objectContaining({ source: 'core.board_turn_resolution', target: 'safety.feedback_completeness', kind: 'tested_by' }),
            expect.objectContaining({ source: 'safety.feedback_completeness', target: 'feedback.typed_command_announcement', kind: 'gates' }),
            expect.objectContaining({ source: 'safety.feedback_completeness', target: 'feedback.board_turn_floater', kind: 'gates' }),
            expect.objectContaining({ source: 'safety.feedback_completeness', target: 'feedback.gameplay_hud', kind: 'enables' }),
            expect.objectContaining({ source: 'feedback.gameplay_hud', target: 'safety.feedback_completeness', kind: 'guarded_by' }),
            expect.objectContaining({ source: 'safety.feedback_completeness', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('projects every ordered typed command result through the strict event-only HUD', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('feedback.typed_command_announcement')).toMatchObject({
            kind: 'feedback',
            role: 'event_only_replay_stable_lossless_command_batch_projection',
            evidence: expect.arrayContaining([
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/typed-gameplay-feedback-boundary.test.ts',
                'src/renderer/store/gameplayFeedbackAdapter.ts',
                'src/renderer/copy/gameplayEventAnnouncement.ts',
                'src/renderer/hooks/useHudPoliteLiveAnnouncement.ts'
            ]),
            reads: expect.arrayContaining([
                'eventId',
                'commandId',
                'orderedFeedbackBatch',
                'message',
                'recallFocusBefore',
                'recallFocusAfter',
                'forgottenTileCountBefore',
                'forgottenTileCountAfter',
                'enemyHazardHitsBefore',
                'enemyHazardHitsAfter',
                'shopGoldBefore',
                'shopGoldAfter',
                'parasitePressureBefore',
                'parasitePressureAfter',
                'parasiteWardBefore',
                'parasiteWardAfter'
            ]),
            writes: expect.arrayContaining(['politeLiveAnnouncement']),
            softlockGuards: expect.arrayContaining([
                'schema-validated-feedback',
                'deterministic-event-key',
                'same-command-feedback-batch',
                'journal-order-preserved',
                'no-dropped-compound-feedback',
                'strongest-priority-wins',
                'stale-first-render-suppression',
                'strict-event-only-hud',
                'feedback-critical-transition-audit',
                'complete-memory-aid-consequences',
                'no-same-transition-delta-reconstruction',
                'no-parasite-snapshot-inference',
                'no-legacy-action-fallback'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/typed-gameplay-feedback-boundary.test.ts',
                'src/renderer/copy/gameplayEventAnnouncement.test.ts',
                'src/renderer/hooks/useHudPoliteLiveAnnouncement.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'power.peek', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'power.shuffle', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'shop.master_key', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'hazard.enemy_patrol', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'hazard.score_parasite', target: 'feedback.typed_command_announcement', kind: 'displays' }),
            expect.objectContaining({ source: 'feedback.typed_command_announcement', target: 'feedback.gameplay_hud', kind: 'belongs_to' }),
            expect.objectContaining({ source: 'feedback.typed_command_announcement', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'feedback.typed_command_announcement', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects typed tile input through transient surface intent, contact, Gambit, feedback, persistence, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('core.tile_input')).toMatchObject({
            kind: 'core',
            role: 'serializable_flip_utility_contact_gambit_and_transient_intent_input',
            evidence: expect.arrayContaining([
                'src/shared/tile-flip-command-transition.ts',
                'src/shared/gameplay-core-contracts.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-adapters.ts',
                'src/shared/gameplay-core-simulation.ts',
                'scripts/sim-gameplay-core.ts',
                'src/renderer/store/appStoreInitialState.ts',
                'src/renderer/store/tilePressController.ts',
                'src/renderer/store/runSurfaceState.ts',
                'src/renderer/store/dungeonPressSurfaceState.ts',
                'src/renderer/store/useAppStore.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'guard-before-life',
                'gambit-intent-before-flip',
                'renderer-command-only-board-input',
                'no-renderer-compatibility-mutation-imports',
                'current-command-event-return',
                'renderer-transient-arming-state',
                'typed-command-independent-of-ui-arm-flag',
                'no-live-run-stray-arm-read',
                'no-serialized-stray-arm-field',
                'dead-region-arm-action-removed',
                'no-serialized-region-row-arm-field',
                'final-pair-enemy-defeat-event-facts',
                'final-pair-enemy-defeat-feedback',
                'json-round-trip'
            ])
        });
        expect(byId.get('power.stray_remove')).toMatchObject({
            role: 'completion_safe_typed_control_with_transient_surface_intent',
            evidence: expect.arrayContaining([
                'src/renderer/store/appStoreInitialState.ts',
                'src/renderer/store/useAppStore.ts',
                'src/renderer/components/GameScreen.tsx',
                'src/renderer/components/GameLeftToolbar.tsx',
                'src/renderer/components/useGameScreenPowerTileHints.ts'
            ]),
            softlockGuards: expect.arrayContaining([
                'renderer-transient-arming-state',
                'typed-command-independent-of-ui-arm-flag',
                'no-live-run-stray-arm-read',
                'no-serialized-stray-arm-field'
            ])
        });
        expect(byId.get('power.region_shuffle')).toMatchObject({
            softlockGuards: expect.arrayContaining([
                'direct-row-command-no-dead-arm-state',
                'no-serialized-region-row-arm-field'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'core.tile_input', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'core.board_turn_resolution', kind: 'enables' }),
            expect.objectContaining({ source: 'hazard.enemy_patrol', target: 'core.tile_input', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'safety.guard_absorption', kind: 'modifies' }),
            expect.objectContaining({ source: 'power.gambit', target: 'core.tile_input', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'exit.primary', kind: 'enables' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'core.tile_input', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects typed stock rerolls through economy, refreshed choices, feedback, and replay', () => {
        const byId = new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));
        expect(byId.get('shop.stock_reroll')).toMatchObject({
            kind: 'shop',
            role: 'deterministic_paid_choice_refresh',
            evidence: expect.arrayContaining([
                'src/shared/shop-rules.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-simulation.ts',
                'src/renderer/store/shopSurfaceState.ts',
                'src/renderer/store/gameplayFeedbackAdapter.ts',
                'src/renderer/components/ShopScreen.tsx'
            ]),
            softlockGuards: expect.arrayContaining([
                'one-reroll-per-visit',
                'required-key-priority',
                'json-round-trip'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'shop.stock_reroll', kind: 'triggers' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'economy.shop_gold', kind: 'consumes' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'shop.typed_key', kind: 'enables' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'lock.typed_key', kind: 'priority_guard' }),
            expect.objectContaining({ source: 'build.treasure_greed', target: 'shop.stock_reroll', kind: 'consequence' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'shop.stock_reroll', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });
});
