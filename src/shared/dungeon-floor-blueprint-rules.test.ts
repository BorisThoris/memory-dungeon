import { describe, expect, it } from 'vitest';

import {
    createDungeonFloorBlueprint,
    inspectDungeonEncounterBudget
} from './dungeon-floor-blueprint-rules';

describe('dungeon floor blueprint rules', () => {
    it('assembles floor policy, recipe, exits, room effects, and shop ids into a blueprint', () => {
        const blueprint = createDungeonFloorBlueprint({
            runSeed: 9,
            rulesVersion: 20,
            level: 5,
            floorTag: 'normal',
            floorArchetypeId: 'treasure_gallery',
            gameMode: 'endless',
            dungeonNodeKind: 'treasure'
        });

        expect(blueprint).toMatchObject({
            level: 5,
            floorTag: 'normal',
            floorArchetypeId: 'treasure_gallery',
            objectiveId: 'loot_cache',
            rewardBudget: 3,
            gatewayBudget: 1,
            shopTileId: '5-shop'
        });
        expect(blueprint.exitSpecs.length).toBeGreaterThan(0);
        expect(blueprint.pairedCardSpecs.some((card) => card.kind === 'treasure')).toBe(true);
        expect(blueprint.roomEffectIds.length).toBeGreaterThan(0);
    });

    it('applies elite encounter floors before capping card recipes', () => {
        const blueprint = createDungeonFloorBlueprint({
            runSeed: 3,
            rulesVersion: 20,
            level: 7,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'elite'
        });

        expect(blueprint.objectiveId).toBe('pacify_floor');
        expect(blueprint.threatBudget).toBeGreaterThanOrEqual(2);
        expect(blueprint.rewardBudget).toBeGreaterThanOrEqual(1);
        expect(blueprint.pairedCardSpecs.length).toBeLessThanOrEqual(8);
    });

    it('summarizes encounter budget counts and normalized encounter context', () => {
        const summary = inspectDungeonEncounterBudget({
            runSeed: 1,
            rulesVersion: 20,
            level: 6,
            floorTag: 'normal',
            floorArchetypeId: null,
            gameMode: 'endless',
            dungeonNodeKind: 'boss'
        });

        expect(summary).toMatchObject({
            level: 6,
            floorTag: 'boss',
            dungeonNodeKind: 'boss',
            objectiveId: 'defeat_boss',
            bossId: 'rush_sentinel'
        });
        expect(summary.cardKindCounts.exit).toBeGreaterThan(0);
        expect(summary.pairedCardCount).toBe(summary.threatPairCount + summary.rewardPairCount + summary.utilityPairCount + summary.lockPairCount + summary.routePairCount);
        expect(summary.warnings).toEqual([]);
    });
});
