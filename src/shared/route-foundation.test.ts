import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    createDungeonRunMapState,
    generateRunMapChoices,
    getDungeonRouteSemanticContract,
    inspectDungeonRunMapProgression,
    inspectRouteProfileBudgets,
    repairDungeonRunMapProgression,
    revealDungeonChoices,
    routeChoiceToMapNode
} from './run-map';

describe('GLD-P2 route foundation contracts', () => {
    it('keeps generated route profile budgets inside the expansion policy bands', () => {
        const nodes = Array.from({ length: 24 }, (_, floor) =>
            generateRunMapChoices({ runSeed: 42_001, rulesVersion: GAME_RULES_VERSION, currentFloor: floor + 1 })
        ).flat();
        const report = inspectRouteProfileBudgets(nodes);

        expect(report.total).toBe(72);
        expect(report.rows.map((row) => row.status)).toEqual(['within_range', 'within_range', 'within_range']);
        expect(report.counts.safe).toBeGreaterThan(0);
        expect(report.counts.greed).toBeGreaterThan(0);
        expect(report.counts.mystery).toBeGreaterThan(0);
    });

    it('normalizes route choice, map node, and encounter semantics through the same contract', () => {
        const choice = {
            id: 'choice:mystery:treasure',
            routeType: 'mystery' as const,
            label: 'Treasure route',
            detail: 'Treasure gallery with cache pressure.'
        };
        const node = routeChoiceToMapNode(choice, 4);
        const contract = getDungeonRouteSemanticContract({
            routeType: choice.routeType,
            floor: node.floor,
            nodeKind: node.kind
        });

        expect(node.kind).toBe('treasure');
        expect(contract).toMatchObject({
            routeType: 'mystery',
            normalizedRouteType: 'mystery',
            nodeKind: 'treasure',
            floorArchetypeId: 'treasure_gallery',
            objectiveId: 'loot_cache'
        });
    });

    it('reports blocked entrance fixtures with seed and route element detail', () => {
        const state = createDungeonRunMapState(25_003, GAME_RULES_VERSION, 1);
        const blocked = {
            ...state,
            nodes: state.nodes.map((node) => ({ ...node, status: 'cleared' as const }))
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'route_current_node_blocked',
                    nodeId: state.currentNodeId,
                    seed: 25_003
                }),
                expect.objectContaining({
                    code: 'route_entrance_blocked',
                    nodeId: state.currentNodeId,
                    seed: 25_003
                })
            ])
        );
    });

    it('repairs occupied path targets before a route transition is committed', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_004, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const occupiedTargetId = state.nodes.find((node) => node.status === 'revealed')!.id;
        const occupied = {
            ...state,
            selectedNodeId: occupiedTargetId,
            nodes: state.nodes.map((node) =>
                node.id === occupiedTargetId ? { ...node, status: 'skipped' as const } : node
            )
        };

        expect(inspectDungeonRunMapProgression(occupied).issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_edge_target_blocked', nodeId: occupiedTargetId, seed: 25_004 }),
                expect.objectContaining({ code: 'route_selected_node_unreachable', nodeId: occupiedTargetId, seed: 25_004 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(occupied);

        expect(inspectDungeonRunMapProgression(repaired).issues).toEqual([]);
        expect(repaired.nodes.find((node) => node.id === occupiedTargetId)?.status).toBe('revealed');
    });

    it('restores a blocked current room without dropping its legal exits', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_013, GAME_RULES_VERSION, 3), 3, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const blocked = {
            ...state,
            nodes: state.nodes.map((node) =>
                node.id === state.currentNodeId ? { ...node, status: 'locked' as const } : node
            )
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_current_node_blocked', nodeId: state.currentNodeId, seed: 25_013 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repairedReport.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(repaired.nodes.find((node) => node.id === repaired.currentNodeId)).toMatchObject({
            status: 'current',
            edgeIds: ['safe-path', 'greed-path', 'mystery-path']
        });
    });

    it('flags and repairs stale currentFloor values before pacing previews use them', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_014, GAME_RULES_VERSION, 4), 4, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const drifted = {
            ...state,
            currentFloor: 2
        };

        const report = inspectDungeonRunMapProgression(drifted);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'route_current_floor_mismatch',
                    nodeId: state.currentNodeId,
                    seed: 25_014
                })
            ])
        );

        const repaired = repairDungeonRunMapProgression(drifted);

        expect(repaired.currentFloor).toBe(4);
        expect(inspectDungeonRunMapProgression(repaired).issues).toEqual([]);
    });

    it('recomputes act labels when repair restores a drifted current room', () => {
        const state = createDungeonRunMapState(25_017, GAME_RULES_VERSION, 7);
        const drifted = {
            ...state,
            act: 1,
            currentFloor: 2
        };

        const repaired = repairDungeonRunMapProgression(drifted);

        expect(repaired.currentFloor).toBe(7);
        expect(repaired.act).toBe(2);
        expect(inspectDungeonRunMapProgression(repaired).issues).toEqual([]);
    });

    it('regenerates missing route edge targets deterministically', () => {
        const state = createDungeonRunMapState(25_005, GAME_RULES_VERSION, 3);
        const blocked = {
            ...state,
            nodes: state.nodes.map((node) =>
                node.id === state.currentNodeId ? { ...node, edgeIds: ['missing-route-node'] } : node
            )
        };

        const report = inspectDungeonRunMapProgression(blocked);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_edge_target_missing', nodeId: 'missing-route-node', seed: 25_005 }),
                expect.objectContaining({ code: 'route_no_legal_progression', nodeId: state.currentNodeId, seed: 25_005 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repairedReport.legalTargetIds).toHaveLength(3);
        expect(repaired.nodes.filter((node) => node.floor === 4 && node.status === 'revealed')).toHaveLength(3);
    });

    it('preserves cleared floor exits when a stale current node id is missing', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_016, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const blocked = {
            ...state,
            currentNodeId: 'missing-current-room'
        };

        expect(inspectDungeonRunMapProgression(blocked).issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_current_node_missing', nodeId: 'missing-current-room', seed: 25_016 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const report = inspectDungeonRunMapProgression(repaired);

        expect(report.issues).toEqual([]);
        expect(repaired.currentNodeId).toBe(state.currentNodeId);
        expect(report.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(repaired.nodes.find((node) => node.id === repaired.currentNodeId)).toMatchObject({
            status: 'cleared',
            edgeIds: ['safe-path', 'greed-path', 'mystery-path']
        });
    });

    it('dedupes repeated current-room edges so route previews stay single-entry', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_012, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const blocked = {
            ...state,
            nodes: state.nodes.map((node) =>
                node.id === state.currentNodeId ? { ...node, edgeIds: [...node.edgeIds, 'safe-path', 'safe-path'] } : node
            )
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(true);
        expect(report.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_duplicate_edge_target', nodeId: 'safe-path', seed: 25_012 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repaired.nodes.find((node) => node.id === repaired.currentNodeId)?.edgeIds).toEqual([
            'safe-path',
            'greed-path',
            'mystery-path'
        ]);
    });

    it('prunes stale missing route edges without regenerating valid room choices', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_018, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const blocked = {
            ...state,
            nodes: state.nodes.map((node) =>
                node.id === state.currentNodeId
                    ? { ...node, edgeIds: ['safe-path', 'missing-stale-room', 'greed-path', 'safe-path', 'mystery-path'] }
                    : node
            )
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_edge_target_missing', nodeId: 'missing-stale-room' }),
                expect.objectContaining({ code: 'route_duplicate_edge_target', nodeId: 'safe-path' })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repairedReport.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(repaired.nodes.find((node) => node.id === repaired.currentNodeId)?.edgeIds).toEqual([
            'safe-path',
            'greed-path',
            'mystery-path'
        ]);
        expect(repaired.nodes.some((node) => node.id.startsWith(`${GAME_RULES_VERSION}:25018`))).toBe(false);
    });

    it('flags and repairs duplicate node ids before route rows become ambiguous', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_015, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const duplicate = {
            ...routeChoiceToMapNode(
                {
                    id: 'greed-path',
                    routeType: 'mystery',
                    label: 'Duplicate omen',
                    detail: 'Corrupt duplicate route id.'
                },
                3
            ),
            status: 'revealed' as const
        };
        const blocked = {
            ...state,
            nodes: [...state.nodes, duplicate]
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_duplicate_node_id', nodeId: 'greed-path', seed: 25_015 })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repairedReport.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(repaired.nodes.filter((node) => node.id === 'greed-path')).toHaveLength(1);
        expect(repaired.nodes.find((node) => node.id === 'greed-path')).toMatchObject({
            routeType: 'greed',
            label: 'Greed path'
        });
    });

    it('flags and repairs duplicate current rooms and stale backtrack reveals', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_008, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const blocked = {
            ...state,
            nodes: [
                ...state.nodes.map((node) =>
                    node.id === state.currentNodeId || node.id === 'safe-path'
                        ? { ...node, status: 'current' as const }
                        : node
                ),
                {
                    ...routeChoiceToMapNode(
                        {
                            id: 'old-backtrack',
                            routeType: 'mystery',
                            label: 'Old omen',
                            detail: 'Stale old route.'
                        },
                        2
                    ),
                    status: 'revealed' as const
                }
            ]
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_multiple_current_nodes', nodeId: state.currentNodeId }),
                expect.objectContaining({ code: 'route_stale_revealed_backtrack', nodeId: 'old-backtrack' })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);
        const repairedReport = inspectDungeonRunMapProgression(repaired);

        expect(repairedReport.issues).toEqual([]);
        expect(repaired.nodes.filter((node) => node.status === 'current')).toHaveLength(1);
        expect(repaired.nodes.find((node) => node.id === 'old-backtrack')?.status).toBe('skipped');
    });

    it('replaces stale next-floor branch reveals when route previews refresh', () => {
        const state = createDungeonRunMapState(25_009, GAME_RULES_VERSION, 2);
        const firstReveal = revealDungeonChoices(state, 2, [
            { id: 'first-safe', routeType: 'safe', label: 'First safe', detail: 'Old stable route.' },
            { id: 'first-greed', routeType: 'greed', label: 'First greed', detail: 'Old greed route.' },
            { id: 'first-mystery', routeType: 'mystery', label: 'First mystery', detail: 'Old mystery route.' }
        ]);
        const refreshed = revealDungeonChoices(firstReveal, 2, [
            { id: 'fresh-safe', routeType: 'safe', label: 'Fresh safe', detail: 'Refreshed stable route.' },
            { id: 'fresh-greed', routeType: 'greed', label: 'Fresh greed', detail: 'Refreshed greed route.' },
            { id: 'fresh-mystery', routeType: 'mystery', label: 'Fresh mystery', detail: 'Refreshed mystery route.' }
        ]);
        const report = inspectDungeonRunMapProgression(refreshed);

        expect(report.issues).toEqual([]);
        expect(report.legalTargetIds).toEqual(['fresh-safe', 'fresh-greed', 'fresh-mystery']);
        expect(refreshed.nodes.some((node) => node.id.startsWith('first-'))).toBe(false);
        expect(refreshed.nodes.find((node) => node.id === refreshed.currentNodeId)?.edgeIds).toEqual([
            'fresh-safe',
            'fresh-greed',
            'fresh-mystery'
        ]);
    });

    it('falls back to deterministic exits when a route reveal receives no choices', () => {
        const state = createDungeonRunMapState(25_011, GAME_RULES_VERSION, 3);
        const revealed = revealDungeonChoices(state, 3, []);
        const report = inspectDungeonRunMapProgression(revealed);

        expect(report.issues).toEqual([]);
        expect(report.legalTargetIds).toHaveLength(3);
        expect(revealed.nodes.find((node) => node.id === revealed.currentNodeId)?.edgeIds).toEqual(report.legalTargetIds);
        expect(revealed.nodes.filter((node) => node.floor === 4 && node.status === 'revealed')).toHaveLength(3);
        expect(report.legalTargetIds.every((id) => id.startsWith(`${GAME_RULES_VERSION}:25`))).toBe(true);
    });

    it('flags and hides orphan future rooms that are revealed outside the legal branch edges', () => {
        const state = revealDungeonChoices(createDungeonRunMapState(25_010, GAME_RULES_VERSION, 2), 2, [
            { id: 'safe-path', routeType: 'safe', label: 'Safe path', detail: 'Stable combat route.' },
            { id: 'greed-path', routeType: 'greed', label: 'Greed path', detail: 'Elite pressure route.' },
            { id: 'mystery-path', routeType: 'mystery', label: 'Mystery path', detail: 'Hidden treasure route.' }
        ]);
        const orphan = routeChoiceToMapNode(
            {
                id: 'orphan-future-room',
                routeType: 'mystery',
                label: 'Unlinked omen',
                detail: 'A future room without a current route edge.'
            },
            4
        );
        const blocked = {
            ...state,
            nodes: [...state.nodes, orphan]
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.legalTargetIds).toEqual(['safe-path', 'greed-path', 'mystery-path']);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    code: 'route_orphan_revealed_future',
                    nodeId: 'orphan-future-room',
                    seed: 25_010
                })
            ])
        );

        const repaired = repairDungeonRunMapProgression(blocked);

        expect(inspectDungeonRunMapProgression(repaired).issues).toEqual([]);
        expect(repaired.nodes.find((node) => node.id === 'orphan-future-room')?.status).toBe('hidden');
    });

    it('uses repaired current map depth when stale route choices try to reopen an earlier floor', () => {
        const state = createDungeonRunMapState(25_007, GAME_RULES_VERSION, 4);
        const revealed = revealDungeonChoices(state, 2, [
            { id: 'stale-safe', routeType: 'safe', label: 'Safe path', detail: 'Stale safe route.' },
            { id: 'stale-greed', routeType: 'greed', label: 'Greed path', detail: 'Stale greed route.' },
            { id: 'stale-mystery', routeType: 'mystery', label: 'Mystery path', detail: 'Stale mystery route.' }
        ]);
        const report = inspectDungeonRunMapProgression(revealed);

        expect(revealed.currentFloor).toBe(4);
        expect(report.issues).toEqual([]);
        expect(report.legalTargetIds).toHaveLength(3);
        expect(
            report.legalTargetIds.map((id) => revealed.nodes.find((node) => node.id === id)?.floor)
        ).toEqual([5, 5, 5]);
    });

    it('normalizes act-end route choices into boss map contracts', () => {
        const safeBoss = routeChoiceToMapNode(
            { id: 'boss-safe', routeType: 'safe', label: 'Safe boss', detail: 'Boss gate through a safe route.' },
            6
        );
        const mysteryBoss = routeChoiceToMapNode(
            { id: 'boss-mystery', routeType: 'mystery', label: 'Mystery boss', detail: 'Boss gate through an omen route.' },
            6
        );

        expect(safeBoss).toMatchObject({
            kind: 'boss',
            routeType: 'greed',
            label: 'Keeper Chamber'
        });
        expect(mysteryBoss).toMatchObject({
            kind: 'boss',
            routeType: 'greed',
            label: 'Keeper Chamber'
        });
    });

    it('covers unreachable exit and locked boss transition route fixtures', () => {
        const state = createDungeonRunMapState(25_006, GAME_RULES_VERSION, 5);
        const exit = routeChoiceToMapNode(
            { id: 'stranded-exit', routeType: 'safe', label: 'Exit', detail: 'Descent stair.' },
            6
        );
        const boss = {
            ...routeChoiceToMapNode(
                { id: 'boss-route', routeType: 'greed', label: 'Boss', detail: 'Boss chamber.' },
                6
            ),
            kind: 'boss' as const
        };
        const blocked = {
            ...state,
            nodes: [
                ...state.nodes,
                { ...exit, kind: 'exit' as const, status: 'revealed' as const },
                { ...boss, status: 'revealed' as const }
            ]
        };

        const report = inspectDungeonRunMapProgression(blocked);

        expect(report.hasLegalProgressionPath).toBe(false);
        expect(report.issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_exit_unreachable', nodeId: 'stranded-exit', seed: 25_006 }),
                expect.objectContaining({ code: 'route_boss_transition_unreachable', nodeId: 'boss-route', seed: 25_006 })
            ])
        );
    });
});
