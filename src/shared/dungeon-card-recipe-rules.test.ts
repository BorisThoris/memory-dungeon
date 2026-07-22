import { describe, expect, it } from 'vitest';

import {
    capDungeonCardRecipeForBudget,
    dungeonCardRecipeForFloor,
    minorSupplyCard,
    type DungeonCardAssignment
} from './dungeon-card-recipe-rules';

describe('dungeon card recipe rules', () => {
    it('keeps boss, levers, and route cards when capacity is tight', () => {
        const cards: DungeonCardAssignment[] = [
            { kind: 'treasure', effectId: 'treasure_gold', symbol: '$', label: 'Gold' },
            { kind: 'lever', effectId: 'lever_floor', symbol: 'V', label: 'Lever' },
            { kind: 'gateway', effectId: 'gateway_depth', symbol: '>', label: 'Gateway' },
            { kind: 'enemy', effectId: 'enemy_elite', symbol: 'B', label: 'Boss', bossId: 'rush_sentinel' }
        ];

        expect(capDungeonCardRecipeForBudget(cards, 3, 'claim_route')).toEqual([
            cards[1],
            cards[3],
            cards[2]
        ]);
    });

    it('returns no card assignments for zero capacity', () => {
        const cards: DungeonCardAssignment[] = [
            { kind: 'lever', effectId: 'lever_floor', symbol: 'V', label: 'Lever' },
            { kind: 'enemy', effectId: 'enemy_elite', symbol: 'B', label: 'Boss', bossId: 'rush_sentinel' }
        ];

        expect(capDungeonCardRecipeForBudget(cards, 0, 'find_exit')).toEqual([]);
    });

    it('builds boss recipes with boss and shrine cards', () => {
        const cards = dungeonCardRecipeForFloor(5, 'boss', null, 'endless');

        expect(cards).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'enemy', effectId: 'enemy_elite', bossId: 'rush_sentinel' }),
                expect.objectContaining({ kind: 'shrine', effectId: 'shrine_guard' })
            ])
        );
    });

    it('adds exit levers from lock policy', () => {
        expect(dungeonCardRecipeForFloor(8, 'normal', 'script_room', 'endless')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'lever', effectId: 'lever_floor', label: 'Exit Lever' }),
                expect.objectContaining({ kind: 'lever', effectId: 'lever_floor', label: 'Exit Lever 2' })
            ])
        );
    });

    it('biases generated key cards toward non-iron exit locks', () => {
        const cards = dungeonCardRecipeForFloor(4, 'normal', 'treasure_gallery', 'endless', {
            threatBudget: 0,
            rewardBudget: 0,
            utilityBudget: 1,
            lockBudget: 2,
            gatewayBudget: 0,
            bossId: null,
            exitLockKinds: ['treasure']
        });

        expect(cards).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'key', keyKind: 'treasure', label: 'Treasure Memory Key' }),
                expect.objectContaining({ kind: 'lock', keyKind: 'treasure', label: 'Treasure Cache Lock' })
            ])
        );
    });

    it('uses archetype pressure for threats and gateway route cards', () => {
        const cards = dungeonCardRecipeForFloor(4, 'normal', 'trap_hall', 'endless', {
            threatBudget: 3,
            rewardBudget: 0,
            utilityBudget: 1,
            lockBudget: 0,
            gatewayBudget: 1,
            bossId: null
        });

        expect(cards).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: 'enemy', effectId: 'enemy_stalker' }),
                expect.objectContaining({ kind: 'trap', effectId: 'trap_mimic' }),
                expect.objectContaining({ kind: 'trap', effectId: 'trap_snare' }),
                expect.objectContaining({ kind: 'lever', effectId: 'rune_seal' }),
                expect.objectContaining({ kind: 'gateway', effectId: 'gateway_depth', routeType: 'greed' })
            ])
        );
    });

    it('exposes the minor supply filler assignment', () => {
        expect(minorSupplyCard()).toMatchObject({
            kind: 'treasure',
            effectId: 'treasure_shard',
            symbol: '.',
            label: 'Supply Niche'
        });
    });
});
