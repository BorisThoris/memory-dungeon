import { describe, expect, it } from 'vitest';

import type { BoardState, DungeonCardEffectId, RunState, Tile } from './contracts';
import { DUNGEON_CARD_EFFECT_DEFINITIONS } from './dungeon-cards';
import {
    DUNGEON_ROOM_EFFECT_DEFINITIONS,
    getDungeonCardCopy,
    getDungeonRoomEffectDefinition,
    getDungeonRoomReadModel,
    getDungeonTreasureRewardDefinition,
    getDungeonTreasureReadModel
} from './dungeon-card-read-model';

const roomTile = (effectId: Tile['dungeonCardEffectId'], overrides: Partial<Tile> = {}): Tile =>
    ({
        id: `tile-${effectId}`,
        pairKey: `pair-${effectId}`,
        label: DUNGEON_CARD_EFFECT_DEFINITIONS[effectId!]?.label ?? 'Room',
        state: 'hidden',
        symbol: 'R',
        dungeonCardKind: 'room',
        dungeonCardEffectId: effectId,
        dungeonCardState: 'hidden',
        ...overrides
    }) as Tile;

describe('dungeon card read models', () => {
    it('covers every room effect id from the dungeon card catalog', () => {
        const roomEffectIds = Object.values(DUNGEON_CARD_EFFECT_DEFINITIONS)
            .filter((definition) => definition.kind === 'room')
            .map((definition) => definition.effectId);

        expect(Object.keys(DUNGEON_ROOM_EFFECT_DEFINITIONS).sort()).toEqual([...roomEffectIds].sort());
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects prototype room effect id %s', (effectId) => {
        expect(getDungeonRoomEffectDefinition(effectId as DungeonCardEffectId)).toBeNull();
    });

    it('reports reusable forge availability from run gold', () => {
        const tile = roomTile('room_forge');

        expect(getDungeonRoomReadModel(tile, { shopGold: 1 } as RunState)).toMatchObject({
            effectId: 'room_forge',
            canUse: false,
            blockedText: 'Needs 2 shop gold.',
            used: false
        });
        expect(getDungeonRoomReadModel(tile, { shopGold: 2 } as RunState)).toMatchObject({
            effectId: 'room_forge',
            canUse: true,
            blockedText: null,
            used: false
        });
        expect(getDungeonRoomReadModel(tile, { shopGold: Number.POSITIVE_INFINITY } as RunState)).toMatchObject({
            effectId: 'room_forge',
            canUse: false,
            blockedText: 'Needs 2 shop gold.'
        });
    });

    it('keeps locked cache rooms available only while a key can pay the gate', () => {
        const tile = roomTile('room_locked_cache');

        expect(
            getDungeonRoomReadModel(tile, {
                dungeonKeys: { iron: 0 },
                dungeonMasterKeys: 0
            } as RunState)
        ).toMatchObject({
            canUse: false,
            blockedText: 'Needs an iron key or master key.'
        });
        expect(
            getDungeonRoomReadModel(tile, {
                dungeonKeys: { iron: 1 },
                dungeonMasterKeys: 0
            } as RunState)
        ).toMatchObject({
            canUse: true,
            blockedText: null
        });
        expect(
            getDungeonRoomReadModel(tile, {
                dungeonKeys: { iron: Number.POSITIVE_INFINITY },
                dungeonMasterKeys: Number.NaN
            } as RunState)
        ).toMatchObject({
            canUse: false,
            blockedText: 'Needs an iron key or master key.'
        });
    });

    it('uses the room tile key kind when reading locked cache availability and copy', () => {
        const tile = roomTile('room_locked_cache', {
            label: 'Treasure Cache Cell',
            dungeonKeyKind: 'treasure'
        });

        expect(
            getDungeonRoomReadModel(tile, {
                dungeonKeys: { iron: 1, treasure: 0 },
                dungeonMasterKeys: 0
            } as RunState)
        ).toMatchObject({
            canUse: false,
            blockedText: 'Needs a treasure key or master key.',
            costText: 'Costs a treasure key or master key to claim.'
        });

        const treasureKeyModel = getDungeonRoomReadModel(tile, {
            dungeonKeys: { iron: 0, treasure: 1 },
            dungeonMasterKeys: 0
        } as RunState);

        expect(treasureKeyModel).toMatchObject({
            canUse: true,
            blockedText: null,
            costText: 'Costs a treasure key or master key to claim.'
        });
        expect(treasureKeyModel?.copy).toContain('Costs a treasure key or master key');
    });

    it('builds treasure read models for dungeon cards, rooms, and route specials', () => {
        expect(getDungeonTreasureRewardDefinition('lock_cache').gateText).toBe(
            'Can spend a matching key or master key for full value.'
        );
        expect(getDungeonTreasureRewardDefinition('room_locked_cache').gateText).toBe(
            'Requires a matching key or master key.'
        );

        expect(
            getDungeonTreasureReadModel({
                id: 'treasure',
                pairKey: 'treasure',
                label: 'Gallery Cache',
                state: 'hidden',
                symbol: '$',
                dungeonCardKind: 'treasure',
                dungeonCardEffectId: 'treasure_cache'
            } as Tile)
        ).toMatchObject({
            rewardId: 'treasure_cache',
            source: 'dungeon_card',
            available: true
        });

        expect(getDungeonTreasureReadModel(roomTile('room_locked_cache'))).toMatchObject({
            rewardId: 'room_locked_cache',
            source: 'room',
            available: true
        });

        expect(
            getDungeonTreasureReadModel(
                roomTile('room_locked_cache', {
                    dungeonKeyKind: 'treasure'
                })
            )
        ).toMatchObject({
            rewardId: 'room_locked_cache',
            gateText: 'Can spend a treasure key or master key for full value.'
        });

        expect(
            getDungeonTreasureReadModel({
                id: 'lock',
                pairKey: 'lock',
                label: 'Treasure Lock',
                state: 'hidden',
                symbol: 'L',
                dungeonCardKind: 'lock',
                dungeonCardEffectId: 'lock_cache',
                dungeonKeyKind: 'treasure'
            } as Tile)
        ).toMatchObject({
            rewardId: 'lock_cache',
            gateText: 'Can spend a treasure key or master key for full value.'
        });

        expect(
            getDungeonTreasureReadModel({
                id: 'secret',
                pairKey: 'secret',
                label: 'Secret Door',
                state: 'matched',
                symbol: '?',
                routeSpecialKind: 'secret_door'
            } as Tile)
        ).toMatchObject({
            rewardId: 'secret_door',
            source: 'route_special',
            available: false
        });
    });

    it('builds dungeon card copy for traps, bosses, and gateway route cards', () => {
        expect(
            getDungeonCardCopy({
                id: 'trap',
                pairKey: 'trap',
                label: 'Latch',
                state: 'hidden',
                symbol: '!',
                dungeonCardKind: 'trap',
                dungeonCardEffectId: 'trap_snare',
                dungeonCardState: 'revealed'
            } as Tile)
        ).toContain('disable free shuffles');

        expect(
            getDungeonCardCopy({
                id: 'boss',
                pairKey: 'boss',
                label: 'Bell-Rush Sentinel',
                state: 'hidden',
                symbol: 'S',
                dungeonCardKind: 'enemy',
                dungeonBossId: 'rush_sentinel',
                dungeonCardHp: 2
            } as Tile)
        ).toContain('combo shard');

        expect(
            getDungeonCardCopy({
                id: 'gateway',
                pairKey: 'gateway',
                label: 'Risk Gate',
                state: 'hidden',
                symbol: 'G',
                dungeonCardKind: 'gateway',
                dungeonRouteType: 'greed'
            } as Tile)
        ).toContain('Selects greed route');
    });

    it('uses tile key kind in key and lock card copy', () => {
        expect(
            getDungeonCardCopy({
                id: 'key',
                pairKey: 'key',
                label: 'Treasure Memory Key',
                state: 'hidden',
                symbol: 'T',
                dungeonCardKind: 'key',
                dungeonKeyKind: 'treasure'
            } as Tile)
        ).toContain('banks a treasure key');

        const lockCopy = getDungeonCardCopy({
            id: 'lock',
            pairKey: 'lock',
            label: 'Treasure Lock',
            state: 'hidden',
            symbol: 'L',
            dungeonCardKind: 'lock',
            dungeonCardEffectId: 'lock_cache',
            dungeonKeyKind: 'treasure'
        } as Tile);

        expect(lockCopy).toContain('treasure key or master key');
        expect(lockCopy).not.toContain('iron/master');
    });

    it('uses run inventory in locked room card copy', () => {
        const tile = roomTile('room_locked_cache', {
            label: 'Treasure Cache Cell',
            dungeonKeyKind: 'treasure'
        });

        expect(
            getDungeonCardCopy(tile, {
                run: {
                    dungeonKeys: { iron: 1, treasure: 0 },
                    dungeonMasterKeys: 0,
                    shopGold: 0
                }
            })
        ).toContain('Needs a treasure key or master key.');

        const copy = getDungeonCardCopy(tile, {
            run: {
                dungeonKeys: { iron: 0, treasure: 1 },
                dungeonMasterKeys: 0,
                shopGold: 0
            }
        });

        expect(copy).toContain('Costs a treasure key or master key');
        expect(copy).not.toContain('Needs a treasure key');
    });

    it('uses effective primary exit locks for terminal fallback copy when board context is available', () => {
        const exit = {
            id: 'exit',
            pairKey: '__exit__',
            label: 'Iron Gate',
            state: 'flipped',
            symbol: 'E',
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        } as Tile;
        const board: BoardState = {
            level: 1,
            pairCount: 1,
            columns: 2,
            rows: 2,
            tiles: [
                { id: 'a1', pairKey: 'a', label: 'A', symbol: 'A', state: 'matched' },
                { id: 'a2', pairKey: 'a', label: 'A', symbol: 'A', state: 'matched' },
                exit
            ],
            flippedTileIds: ['exit'],
            matchedPairs: 1,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0
        };

        expect(getDungeonCardCopy(exit)).toContain('Requires an iron key');
        expect(getDungeonCardCopy(exit, { board })).toContain('Can be opened once revealed');
        expect(getDungeonCardCopy(exit, { board })).not.toContain('Requires an iron key');
    });

    it('explains pending key-lock fallback when no key source remains but pairs are still clearable', () => {
        const exit = {
            id: 'exit',
            pairKey: '__exit__',
            label: 'Iron Gate',
            state: 'flipped',
            symbol: 'E',
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'iron'
        } as Tile;
        const board: BoardState = {
            level: 1,
            pairCount: 2,
            columns: 2,
            rows: 2,
            tiles: [
                { id: 'a1', pairKey: 'a', label: 'A', symbol: 'A', state: 'hidden' },
                { id: 'a2', pairKey: 'a', label: 'A', symbol: 'A', state: 'hidden' },
                exit
            ],
            flippedTileIds: ['exit'],
            matchedPairs: 0,
            floorArchetypeId: null,
            featuredObjectiveId: null,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonKeysHeld: 0
        };

        const copy = getDungeonCardCopy(exit, { board, run: { dungeonKeys: {}, dungeonMasterKeys: 0 } });

        expect(copy).toContain('No key source remains');
        expect(copy).toContain('clear remaining pairs');
        expect(copy).not.toContain('Requires an iron key');
    });

    it('uses typed key labels in exit lock copy', () => {
        const exit = {
            id: 'exit',
            pairKey: '__exit__',
            label: 'Treasure Gate',
            state: 'flipped',
            symbol: 'E',
            dungeonCardKind: 'exit',
            dungeonExitLockKind: 'treasure'
        } as Tile;

        expect(getDungeonCardCopy(exit)).toContain('Requires a treasure key');
    });
});
