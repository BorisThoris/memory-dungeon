import { describe, expect, it } from 'vitest';

import type { DungeonFloorBlueprint, Tile } from './contracts';
import {
    addDungeonExitTile,
    addDungeonRoomTile,
    addDungeonShopTile,
    assignDungeonCardsToTiles,
    assignDungeonFillerCardsToTiles
} from './dungeon-tile-augmentation-rules';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    state: 'hidden',
    symbol: id,
    label: id,
    atomicVariant: 0
});

const blueprint: DungeonFloorBlueprint = {
    level: 4,
    floorTag: 'normal',
    floorArchetypeId: null,
    bossId: null,
    objectiveId: 'find_exit',
    threatBudget: 0,
    rewardBudget: 0,
    utilityBudget: 0,
    lockBudget: 0,
    gatewayBudget: 0,
    exitSpecs: [
        {
            id: '4-exit',
            routeType: 'mystery',
            effectId: 'exit_mystery',
            lockKind: 'lever',
            requiredLeverCount: 1,
            labelPrefix: 'Primary'
        }
    ],
    pairedCardSpecs: [],
    roomEffectIds: ['room_scrying_lens'],
    shopTileId: '4-shop'
};

describe('dungeon tile augmentation rules', () => {
    it('adds singleton exit, shop, and room tiles from blueprint metadata', () => {
        const withExit = addDungeonExitTile([], blueprint);
        const withShop = addDungeonShopTile(withExit.tiles, blueprint);
        const withRoom = addDungeonRoomTile(withShop.tiles, blueprint);

        expect(withExit).toMatchObject({
            exitTileId: '4-exit',
            routeType: 'mystery',
            lockKind: 'lever',
            requiredLevers: 1
        });
        expect(withShop.shopTileId).toBe('4-shop');
        expect(withRoom.roomTileId).toBe('4-room');
        expect(withRoom.tiles).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ pairKey: '__exit__', dungeonCardKind: 'exit', symbol: '?' }),
                expect.objectContaining({ pairKey: '__shop__', dungeonCardKind: 'shop', symbol: 'S' }),
                expect.objectContaining({ pairKey: '__room__', dungeonCardKind: 'room', symbol: '?' })
            ])
        );
    });

    it('uses the floor typed exit lock for locked cache room key gates', () => {
        const { tiles } = addDungeonRoomTile([], {
            ...blueprint,
            roomEffectIds: ['room_locked_cache'],
            exitSpecs: [
                {
                    ...blueprint.exitSpecs[0]!,
                    lockKind: 'treasure',
                    requiredLeverCount: 0
                }
            ]
        });

        expect(tiles[0]).toMatchObject({
            dungeonCardKind: 'room',
            dungeonCardEffectId: 'room_locked_cache',
            dungeonKeyKind: 'treasure'
        });
    });

    it('falls locked cache room key gates back to iron on lever-only floors', () => {
        const { tiles } = addDungeonRoomTile([], {
            ...blueprint,
            roomEffectIds: ['room_locked_cache']
        });

        expect(tiles[0]).toMatchObject({
            dungeonCardKind: 'room',
            dungeonCardEffectId: 'room_locked_cache',
            dungeonKeyKind: 'iron'
        });
    });

    it('assigns paired dungeon card specs to eligible non-special pairs', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a'), tile('b1', '__wild__'), tile('b2', '__wild__')];
        const assigned = assignDungeonCardsToTiles(
            tiles,
            1,
            1,
            4,
            'normal',
            null,
            'endless',
            {
                ...blueprint,
                pairedCardSpecs: [
                    { kind: 'key', effectId: 'key_iron', symbol: 'K', label: 'Iron Memory Key' }
                ]
            }
        );

        expect(assigned.filter((candidate) => candidate.pairKey === 'a')).toEqual([
            expect.objectContaining({ dungeonCardKind: 'key', dungeonKeyKind: 'iron' }),
            expect.objectContaining({ dungeonCardKind: 'key', dungeonKeyKind: 'iron' })
        ]);
        expect(assigned.filter((candidate) => candidate.pairKey === '__wild__').every((candidate) => candidate.dungeonCardKind == null)).toBe(true);
    });

    it('preserves typed key assignments from blueprint card specs', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a')];
        const assigned = assignDungeonCardsToTiles(
            tiles,
            1,
            1,
            4,
            'normal',
            'treasure_gallery',
            'endless',
            {
                ...blueprint,
                pairedCardSpecs: [
                    { kind: 'key', effectId: 'key_iron', symbol: 'T', label: 'Treasure Memory Key', keyKind: 'treasure' }
                ]
            }
        );

        expect(assigned).toEqual([
            expect.objectContaining({ dungeonCardKind: 'key', dungeonKeyKind: 'treasure' }),
            expect.objectContaining({ dungeonCardKind: 'key', dungeonKeyKind: 'treasure' })
        ]);
    });

    it('preserves typed lock assignments from blueprint card specs', () => {
        const tiles = [tile('a1', 'a'), tile('a2', 'a')];
        const assigned = assignDungeonCardsToTiles(
            tiles,
            1,
            1,
            4,
            'normal',
            'treasure_gallery',
            'endless',
            {
                ...blueprint,
                pairedCardSpecs: [
                    { kind: 'lock', effectId: 'lock_cache', symbol: 'L', label: 'Treasure Cache Lock', keyKind: 'treasure' }
                ]
            }
        );

        expect(assigned).toEqual([
            expect.objectContaining({ dungeonCardKind: 'lock', dungeonKeyKind: 'treasure' }),
            expect.objectContaining({ dungeonCardKind: 'lock', dungeonKeyKind: 'treasure' })
        ]);
    });

    it('adds deterministic filler supplies for treasure nodes only to empty eligible pairs', () => {
        const tiles = [
            tile('a1', 'a'),
            tile('a2', 'a'),
            { ...tile('b1', 'b'), dungeonCardKind: 'enemy' as const },
            { ...tile('b2', 'b'), dungeonCardKind: 'enemy' as const },
            tile('c1', 'c'),
            tile('c2', 'c')
        ];
        const assigned = assignDungeonFillerCardsToTiles(tiles, 1, 1, 5, 'normal', null, 'endless', 'treasure');
        const fillerTiles = assigned.filter((candidate) => candidate.dungeonCardEffectId === 'treasure_shard');

        expect(fillerTiles.length).toBe(4);
        expect(fillerTiles.every((candidate) => candidate.dungeonCardKind === 'treasure')).toBe(true);
        expect(assigned.filter((candidate) => candidate.pairKey === 'b')).toEqual([
            expect.objectContaining({ dungeonCardKind: 'enemy' }),
            expect.objectContaining({ dungeonCardKind: 'enemy' })
        ]);
    });
});
