import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    auditGameplayInteractionGraph,
    gameplayInteractionGraph,
    gameplayInteractionGraphSchema,
    getGameplayInteractionEdgesForMechanic,
    validateGameplayInteractionGraph
} from './gameplay-interaction-graph';
import type { TileTraitKind } from './contracts';
import { FINDABLE_REWARD_ROWS } from './findables';
import { RUN_INVENTORY_ITEM_IDS } from './run-inventory-contracts';

const TILE_TRAIT_KINDS: readonly TileTraitKind[] = ['echo', 'heavy', 'conduit', 'stasis'];

const REMOVED_MECHANIC_ID_PATTERN = /^(boss|exit|lock|room|shop|build|reward|relic|perk)\.|^trait\.(volatile|mirror|cursed|sealed|drift)$/;
const REMOVED_MECHANIC_IDS = new Set([
    'hazard.tile_pressure',
    'hazard.enemy_patrol',
    'objective.defeat_boss',
    'safety.dungeon_topology',
    'safety.safe_hazard_ward',
    'board.scout_reveal',
    'trait.volatile_heavy_guard',
    'findable.ward_spark',
    'findable.scout_glint',
    'inventory.iron_key',
    'inventory.master_key',
    'safety.parasite_ward'
]);
const REMOVED_MODULE_PATTERN =
    /(^|\/)(dungeon-[^/]*|hazard-[^/]*|enemy-hazard-board-rules|run-map|relics|relic-immediate-rules|trait-build-rewards|bonus-rewards|route-card-reward-shape|floor-completion-transitions|dungeonPressSurfaceState|TileBoardEnemyHazardMarker|useGameScreenTraitRouteTargets)(\.test)?\.tsx?$/;

const mechanicById = () => new Map(gameplayInteractionGraph.mechanics.map((mechanic) => [mechanic.id, mechanic]));

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
        expect(gameplayInteractionGraph.version).toBe(32);
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

    it('drops the deleted dungeon, hazard, relic, reward, and build layer from the graph', () => {
        const removedIds = gameplayInteractionGraph.mechanics
            .map((mechanic) => mechanic.id)
            .filter((id) => REMOVED_MECHANIC_ID_PATTERN.test(id));
        expect(removedIds).toEqual([]);
        expect(gameplayInteractionGraph.mechanics.filter((mechanic) => REMOVED_MECHANIC_IDS.has(mechanic.id))).toEqual([]);

        for (const mechanic of gameplayInteractionGraph.mechanics) {
            for (const enabled of mechanic.enables) {
                expect(REMOVED_MECHANIC_ID_PATTERN.test(enabled), `${mechanic.id} enables ${enabled}`).toBe(false);
                expect(REMOVED_MECHANIC_IDS.has(enabled), `${mechanic.id} enables ${enabled}`).toBe(false);
            }
            for (const reference of [...mechanic.evidence, ...mechanic.tests]) {
                expect(REMOVED_MODULE_PATTERN.test(reference), `${mechanic.id} cites ${reference}`).toBe(false);
                expect(existsSync(reference), `${mechanic.id} cites ${reference}`).toBe(true);
            }
        }
        expect(gameplayInteractionGraph.coverage).toMatchObject({
            blockingKinds: expect.not.arrayContaining(['objective']),
            requiredObjectives: ['objective.floor_clear'],
            requiredSafetyNodes: ['safety.softlock_fairness']
        });
        expect(gameplayInteractionGraph.edges.filter((edge) => edge.kind === 'unblocks' || edge.kind === 'priority_guard')).toEqual([]);
    });

    it('keeps a mechanic node for every findable and run inventory item the source rosters declare', () => {
        const byId = mechanicById();
        for (const row of FINDABLE_REWARD_ROWS) {
            expect(byId.get(`findable.${row.kind}`), row.kind).toMatchObject({ kind: 'findable' });
        }
        for (const itemId of RUN_INVENTORY_ITEM_IDS) {
            expect(byId.get(`inventory.${itemId}`), itemId).toMatchObject({ kind: 'inventory' });
        }
    });

    it('requires blockers to declare counterplay or softlock guards', () => {
        const blockers = gameplayInteractionGraph.mechanics.filter((mechanic) => mechanic.blocks.length > 0);

        expect(blockers.map((mechanic) => mechanic.id)).toEqual(
            expect.arrayContaining([
                'trait.stasis',
                'power.destroy_pair',
                'safety.softlock_fairness',
                'hazard.score_parasite'
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

    it('connects floor-clear and parasite pressure through safety edges', () => {
        const byId = mechanicById();
        expect(byId.get('safety.softlock_fairness')).toMatchObject({
            kind: 'safety',
            role: 'invariant_gate',
            softlockGuards: ['inspectBoardFairness']
        });
        expect(byId.get('hazard.score_parasite')).toMatchObject({
            kind: 'hazard',
            role: 'chapter_pressure_and_objective_counterplay',
            evidence: expect.arrayContaining(['src/shared/score-parasite-rules.ts', 'src/shared/board-power-actions.ts']),
            tests: expect.arrayContaining(['src/shared/score-parasite-rules.test.ts', 'src/shared/game.test.ts']),
            softlockGuards: expect.arrayContaining(['four-floor-cycle', 'destroy-pair-resets-pressure'])
        });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'safety.softlock_fairness', target: 'objective.floor_clear' }),
                expect.objectContaining({ source: 'board.cleanup', target: 'safety.softlock_fairness' }),
                expect.objectContaining({ source: 'power.destroy_pair', target: 'hazard.score_parasite', kind: 'counterplay' }),
                expect.objectContaining({ source: 'hazard.score_parasite', target: 'power.destroy_pair', kind: 'guarded_by' }),
                expect.objectContaining({ source: 'hazard.score_parasite', target: 'core.gameplay_commands', kind: 'triggers' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'hazard.score_parasite', kind: 'triggers' }),
                expect.objectContaining({ source: 'inventory.mutator_loadout', target: 'hazard.score_parasite', kind: 'triggers' }),
                expect.objectContaining({ source: 'hazard.score_parasite', target: 'feedback.gameplay_hud', kind: 'displays' })
            ])
        );
    });

    it('surfaces graph-driven gameplay priorities for audit passes', () => {
        const audit = auditGameplayInteractionGraph();

        expect(audit).toMatchObject({
            mechanicCount: gameplayInteractionGraph.mechanics.length,
            edgeCount: gameplayInteractionGraph.edges.length,
            traitCount: TILE_TRAIT_KINDS.length
        });
        expect(audit.blockerCount).toBe(4);
        expect(audit.counterplayEdgeCount).toBeGreaterThanOrEqual(16);
        expect(audit.blockerWithoutProtectiveEdgeIds).toEqual([]);
        expect(audit.generatedFloorCoverageGapIds).toEqual(expect.arrayContaining(['trait.echo']));
        expect(audit.playerVisibleWriteWithoutHudIds).toEqual([]);
        expect(audit.highLeverageMechanicIds).toEqual(
            expect.arrayContaining([
                'trait.stasis',
                'power.destroy_pair',
                'hazard.score_parasite',
                'safety.softlock_fairness',
                'core.gameplay_commands',
                'progression.run_flow'
            ])
        );
        expect(audit.recommendations).toEqual(
            expect.arrayContaining([
                'Keep trait routing tools available when the graph shows swap-created trait routes.',
                'Add a topology, softlock-fairness, or generator-contract case for every new blocking edge.'
            ])
        );
    });

    it('connects the command core through Peek, persistence, and replay', () => {
        const byId = mechanicById();
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
                expect.objectContaining({ source: 'inventory.peek_charge', target: 'power.peek', kind: 'enables' }),
                expect.objectContaining({ source: 'power.peek', target: 'inventory.peek_charge', kind: 'consumes' }),
                expect.objectContaining({ source: 'power.peek', target: 'power.destroy_pair', kind: 'synergy' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'persistence.run_summary', kind: 'persists' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.gameplay_replay', kind: 'tested_by' })
            ])
        );
    });

    it('connects Guard Token inventory through capped guard and damage absorption', () => {
        const byId = mechanicById();
        expect(byId.get('inventory.guard_token')).toMatchObject({
            kind: 'inventory',
            role: 'bounded_damage_buffer',
            evidence: expect.arrayContaining(['src/shared/run-inventory.ts', 'src/shared/turn-mismatch-rules.ts']),
            tests: expect.arrayContaining(['src/shared/run-inventory.test.ts', 'src/shared/turn-mismatch-rules.test.ts'])
        });
        expect(byId.get('safety.guard_absorption')).toMatchObject({
            kind: 'safety',
            role: 'resource_consequence',
            evidence: ['src/shared/turn-mismatch-rules.ts'],
            tests: ['src/shared/turn-mismatch-rules.test.ts']
        });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'inventory.guard_token', kind: 'modifies' }),
                expect.objectContaining({ source: 'inventory.guard_token', target: 'safety.guard_absorption', kind: 'enables' }),
                expect.objectContaining({ source: 'safety.guard_absorption', target: 'inventory.guard_token', kind: 'consumes' }),
                expect.objectContaining({ source: 'inventory.guard_token', target: 'feedback.gameplay_hud', kind: 'displays' }),
                expect.objectContaining({ source: 'safety.guard_absorption', target: 'feedback.gameplay_hud', kind: 'displays' })
            ])
        );
    });

    it('connects Shard Spark through typed match requests into life conversion', () => {
        const byId = mechanicById();
        expect(byId.get('findable.shard_spark')).toMatchObject({
            kind: 'findable',
            tests: expect.arrayContaining(['src/shared/gameplay-core.test.ts'])
        });
        expect(byId.get('inventory.combo_shard')).toMatchObject({
            kind: 'inventory',
            role: 'bounded_life_conversion_resource'
        });
        expect(byId.get('progression.shard_to_life')).toMatchObject({ kind: 'progression', role: 'resource_consequence' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'findable.shard_spark', target: 'core.gameplay_commands', kind: 'triggers' }),
                expect.objectContaining({ source: 'findable.shard_spark', target: 'inventory.combo_shard', kind: 'grants' }),
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.shard_to_life', kind: 'triggers' }),
                expect.objectContaining({ source: 'inventory.combo_shard', target: 'progression.shard_to_life', kind: 'enables' }),
                expect.objectContaining({ source: 'progression.shard_to_life', target: 'inventory.combo_shard', kind: 'consumes' }),
                expect.objectContaining({ source: 'board.chain_chunk_fever', target: 'inventory.combo_shard', kind: 'grants' })
            ])
        );
    });

    it('connects Destroy charges into deterministic pair removal', () => {
        const byId = mechanicById();
        expect(byId.get('inventory.destroy_charge')).toMatchObject({ kind: 'inventory', role: 'pair_removal_resource' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'core.gameplay_commands', target: 'inventory.destroy_charge', kind: 'modifies' }),
                expect.objectContaining({ source: 'inventory.destroy_charge', target: 'power.destroy_pair', kind: 'enables' }),
                expect.objectContaining({ source: 'power.destroy_pair', target: 'inventory.destroy_charge', kind: 'consumes' })
            ])
        );
    });

    it('connects the Gambit token from per-floor grant through mismatch rescue', () => {
        const byId = mechanicById();
        expect(byId.get('inventory.gambit_token')).toMatchObject({
            kind: 'inventory',
            role: 'per_floor_third_flip_resource'
        });
        expect(byId.get('power.gambit')).toMatchObject({
            kind: 'power',
            role: 'mismatch_rescue_with_failure_cost'
        });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'progression.run_flow', target: 'inventory.gambit_token', kind: 'grants' }),
                expect.objectContaining({ source: 'inventory.gambit_token', target: 'power.gambit', kind: 'enables' }),
                expect.objectContaining({ source: 'power.gambit', target: 'inventory.gambit_token', kind: 'consumes' }),
                expect.objectContaining({ source: 'power.gambit', target: 'objective.floor_clear', kind: 'counterplay' })
            ])
        );
    });

    it('connects board-control charges into deterministic board choices', () => {
        const byId = mechanicById();
        expect(byId.get('inventory.shuffle_charge')).toMatchObject({ kind: 'inventory', role: 'full_board_control_resource' });
        expect(byId.get('inventory.region_shuffle_charge')).toMatchObject({ kind: 'inventory', role: 'targeted_board_control_resource' });
        expect(byId.get('power.shuffle')).toMatchObject({ kind: 'power', role: 'global_hidden_board_reordering' });
        expect(byId.get('power.region_shuffle')).toMatchObject({ kind: 'power', role: 'targeted_hidden_row_reordering' });
        expect(byId.get('power.tile_swap')).toMatchObject({ kind: 'power', role: 'player_selected_board_reordering' });
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'inventory.shuffle_charge', target: 'power.shuffle', kind: 'enables' }),
                expect.objectContaining({ source: 'inventory.region_shuffle_charge', target: 'power.tile_swap', kind: 'enables' }),
                expect.objectContaining({ source: 'power.region_shuffle', target: 'objective.floor_clear', kind: 'counterplay' })
            ])
        );
    });

    it('connects the memorize window through Flash and Undo recovery', () => {
        const byId = mechanicById();
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
        expect(gameplayInteractionGraph.edges).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ source: 'inventory.flash_pair_charge', target: 'power.flash_pair', kind: 'enables' }),
                expect.objectContaining({ source: 'inventory.undo_charge', target: 'power.undo_resolve', kind: 'enables' }),
                expect.objectContaining({ source: 'power.undo_resolve', target: 'objective.floor_clear', kind: 'counterplay' })
            ])
        );
    });

    it('connects Wild Run setup through one-token wildcard matches and floor continuity', () => {
        const byId = mechanicById();
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
        const byId = mechanicById();
        expect(byId.get('progression.run_setup')).toMatchObject({
            kind: 'progression',
            role: 'authoritative_pre_run_loadout_selection'
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
            expect.objectContaining({ source: 'progression.run_setup', target: 'inventory.mutator_loadout', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.run_setup', target: 'inventory.contract_loadout', kind: 'grants' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'inventory.mutator_loadout', kind: 'modifies' }),
            expect.objectContaining({ source: 'inventory.mutator_loadout', target: 'hazard.score_parasite', kind: 'triggers' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.shuffle', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.destroy_pair', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'power.pin', kind: 'gates' }),
            expect.objectContaining({ source: 'inventory.mutator_loadout', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'inventory.contract_loadout', target: 'feedback.gameplay_hud', kind: 'displays' })
        ]));
    });

    it('connects typed Destroy Pair from charge and target choice through replayable floor consequence', () => {
        const byId = mechanicById();
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
            expect.objectContaining({ source: 'power.destroy_pair', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('evaluates route strategy through typed outcomes instead of parallel reward arithmetic', () => {
        const byId = mechanicById();
        expect(byId.get('simulation.build_evaluation')).toMatchObject({
            kind: 'simulation',
            role: 'route_outcome_and_strategy_balance_gate',
            evidence: expect.arrayContaining(['src/shared/balance-simulation.ts']),
            tests: ['src/shared/balance-simulation.test.ts']
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'simulation.build_evaluation', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'economy.score_and_rewards', kind: 'tested_by' }),
            expect.objectContaining({ source: 'simulation.build_evaluation', target: 'safety.softlock_fairness', kind: 'guarded_by' })
        ]));
    });

    it('connects flat typed floor advancement through pressure, board preparation, feedback, persistence, and replay', () => {
        const byId = mechanicById();
        expect(byId.get('progression.run_flow')).toMatchObject({
            kind: 'progression',
            role: 'typed_flat_replayable_floor_transition',
            evidence: expect.arrayContaining([
                'src/shared/next-floor-transition-rules.ts',
                'src/shared/gameplay-core.ts',
                'src/shared/gameplay-core-adapters.ts',
                'src/renderer/store/levelCompleteSurfaceState.ts'
            ]),
            tests: expect.arrayContaining([
                'src/shared/gameplay-core.test.ts',
                'src/shared/game.test.ts',
                'src/renderer/store/levelCompleteSurfaceState.test.ts'
            ])
        });
        expect(gameplayInteractionGraph.edges).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'objective.floor_clear', target: 'progression.run_flow', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'core.gameplay_commands', kind: 'triggers' }),
            expect.objectContaining({ source: 'core.gameplay_commands', target: 'progression.run_flow', kind: 'modifies' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'hazard.score_parasite', kind: 'triggers' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'phase.memorize', kind: 'enables' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'feedback.gameplay_hud', kind: 'displays' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'persistence.run_summary', kind: 'persists' }),
            expect.objectContaining({ source: 'progression.run_flow', target: 'simulation.gameplay_replay', kind: 'tested_by' })
        ]));
    });

    it('connects one typed non-final board turn through effects, feedback, persistence, and replay', () => {
        const byId = mechanicById();
        expect(byId.get('core.board_turn_resolution')).toMatchObject({
            kind: 'core',
            role: 'single_command_match_mismatch_gambit_and_pair_floor_clear_transition',
            evidence: expect.arrayContaining([
                'src/shared/board-turn-transition.ts',
                'src/shared/floor-clear-transition.ts',
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
