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
    COMBO_SHARD_ENGINE_DEFINITIONS,
    CONDUIT_CARTOGRAPHER_DEFINITIONS,
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
});
