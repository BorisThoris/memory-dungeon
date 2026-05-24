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

        expect(inspectDungeonRunMapProgression(blocked).issues).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'route_exit_unreachable', nodeId: 'stranded-exit', seed: 25_006 }),
                expect.objectContaining({ code: 'route_boss_transition_unreachable', nodeId: 'boss-route', seed: 25_006 })
            ])
        );
    });
});
