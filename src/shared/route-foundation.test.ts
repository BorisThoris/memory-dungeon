import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    generateRunMapChoices,
    getDungeonRouteSemanticContract,
    inspectRouteProfileBudgets,
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
});
