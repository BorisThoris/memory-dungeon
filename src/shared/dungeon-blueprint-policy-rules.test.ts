import { describe, expect, it } from 'vitest';

import {
    budgetForFloor,
    chooseRoomEffectsForFloor,
    dungeonBossForFloor,
    dungeonObjectiveForFloor,
    exitRouteTypeForFloor,
    exitSpecsForFloor,
    pairCapacityForDungeonEncounter,
    primaryExitLockKindForFloor,
    requiredLeverCountForFloor,
    shouldAddDungeonShopTile
} from './dungeon-blueprint-policy-rules';

describe('dungeon blueprint policy rules', () => {
    it('maps floor identity into exit route and lock policy', () => {
        expect(exitRouteTypeForFloor(2, 'normal', null)).toBe('safe');
        expect(exitRouteTypeForFloor(4, 'normal', null)).toBe('mystery');
        expect(exitRouteTypeForFloor(5, 'boss', null)).toBe('greed');
        expect(primaryExitLockKindForFloor(2, null)).toBe('none');
        expect(primaryExitLockKindForFloor(6, null)).toBe('lever');
        expect(requiredLeverCountForFloor(8, 'lever')).toBe(2);
    });

    it('derives objectives, bosses, and budgets', () => {
        expect(dungeonObjectiveForFloor(5, 'boss', null)).toBe('defeat_boss');
        expect(dungeonObjectiveForFloor(4, 'normal', 'trap_hall')).toBe('disarm_traps');
        expect(dungeonObjectiveForFloor(5, 'normal', null)).toBe('claim_route');
        expect(dungeonBossForFloor('boss', 'treasure_gallery')).toBe('treasure_keeper');
        expect(budgetForFloor(5, 'normal', 'treasure_gallery')).toMatchObject({
            rewardBudget: 3,
            gatewayBudget: 1
        });
    });

    it('builds primary and alternate exit specs', () => {
        expect(exitSpecsForFloor(4, 'normal', null)).toEqual([
            expect.objectContaining({ id: '4-exit', routeType: 'mystery', effectId: 'exit_mystery' }),
            expect.objectContaining({ id: '4-exit-alt', routeType: 'greed', effectId: 'exit_greed' })
        ]);
    });

    it('chooses shop and room effects from deterministic floor policy', () => {
        expect(shouldAddDungeonShopTile(1, 1, 1, 'normal', null, 'endless')).toBe(false);
        expect(shouldAddDungeonShopTile(1, 1, 3, 'normal', null, 'endless', 'shop')).toBe(true);
        expect(shouldAddDungeonShopTile(1, 1, 3, 'normal', null, 'endless', 'rest')).toBe(false);
        expect(chooseRoomEffectsForFloor(1, 1, 3, 'normal', null, 'endless', 'trap')).toEqual(['room_trap_workshop']);
        expect(chooseRoomEffectsForFloor(1, 1, 3, 'normal', null, 'puzzle')).toEqual([]);
    });

    it('adjusts pair capacity by encounter pressure', () => {
        expect(pairCapacityForDungeonEncounter(4, 'normal', null, 'elite')).toBe(6);
        expect(pairCapacityForDungeonEncounter(4, 'normal', null, 'rest')).toBe(4);
    });
});
