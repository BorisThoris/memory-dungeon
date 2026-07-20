import { describe, expect, it } from 'vitest';
import {
    MAX_LIVES,
    type BoardState,
    type DungeonCardEffectId,
    type RunState,
    type Tile
} from './contracts';
import { createNewRun } from './game';
import {
    DUNGEON_KEY_CACHE_SCORE_REWARD,
    DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD,
    DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD,
    revealDungeonRoom
} from './dungeon-room-rules';
import { ROOM_PAIR_KEY } from './tile-identity';

const roomTile = (id: string, effectId: DungeonCardEffectId, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey: ROOM_PAIR_KEY,
    symbol: id,
    label: id,
    state: 'hidden',
    dungeonCardKind: 'room',
    dungeonCardEffectId: effectId,
    dungeonCardState: 'hidden',
    ...overrides
});

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...overrides
});

const createRun = (tiles: Tile[], overrides: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0, { runSeed: 31 });
    return {
        ...base,
        status: 'playing',
        board: {
            ...base.board!,
            columns: 2,
            rows: Math.ceil(tiles.length / 2),
            pairCount: Math.max(1, new Set(tiles.map((candidate) => candidate.pairKey)).size),
            flippedTileIds: [],
            tiles
        } satisfies BoardState,
        ...overrides
    };
};

describe('revealDungeonRoom', () => {
    it('uses campfire to heal, then marks the room resolved', () => {
        const run = createRun([roomTile('campfire', 'room_campfire')], { lives: MAX_LIVES - 1 });

        const resolved = revealDungeonRoom(run, 'campfire');

        expect(resolved.lives).toBe(MAX_LIVES);
        expect(resolved.board!.tiles[0]).toMatchObject({
            state: 'flipped',
            dungeonCardState: 'resolved',
            dungeonRoomUsed: true
        });
    });

    it('awards score from campfire when already at max life', () => {
        const run = createRun([roomTile('campfire', 'room_campfire')], {
            lives: MAX_LIVES,
            stats: { ...createNewRun(0).stats, totalScore: 20, currentLevelScore: 5 }
        });

        const resolved = revealDungeonRoom(run, 'campfire');

        expect(resolved.stats.totalScore).toBe(35);
        expect(resolved.stats.currentLevelScore).toBe(20);
        expect(resolved.stats.bestScore).toBe(35);
    });

    it('normalizes malformed room score counters before awarding score', () => {
        const run = createRun([roomTile('campfire', 'room_campfire')], {
            lives: MAX_LIVES,
            stats: {
                ...createNewRun(0).stats,
                totalScore: Number.NaN,
                currentLevelScore: -8.5,
                bestScore: Number.POSITIVE_INFINITY
            }
        });

        const resolved = revealDungeonRoom(run, 'campfire');

        expect(resolved.stats.totalScore).toBe(15);
        expect(resolved.stats.currentLevelScore).toBe(15);
        expect(resolved.stats.bestScore).toBe(15);
    });

    it('keeps forge reusable and only pays when gold is available', () => {
        const run = createRun([roomTile('forge', 'room_forge')], {
            shopGold: 2,
            destroyPairCharges: 0
        });

        const paid = revealDungeonRoom(run, 'forge');
        const unpaid = revealDungeonRoom({ ...paid, shopGold: 0 }, 'forge');

        expect(paid.shopGold).toBe(0);
        expect(paid.destroyPairCharges).toBe(1);
        expect(paid.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'revealed',
            dungeonRoomUsed: undefined
        });
        expect(unpaid.destroyPairCharges).toBe(1);
        expect(unpaid.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'revealed',
            dungeonRoomUsed: undefined
        });
    });

    it('opens locked cache with an iron key and marks it used', () => {
        const run = createRun([roomTile('cache', 'room_locked_cache')], {
            dungeonKeys: { iron: 1 },
            shopGold: 3,
            stats: { ...createNewRun(0).stats, totalScore: 10, currentLevelScore: 1 }
        });

        const resolved = revealDungeonRoom(run, 'cache');

        expect(resolved.dungeonKeys.iron).toBe(0);
        expect(resolved.shopGold).toBe(3 + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD);
        expect(resolved.stats.totalScore).toBe(10 + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
        expect(resolved.stats.currentLevelScore).toBe(1 + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
        expect(resolved.stats.bestScore).toBe(10 + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
        expect(resolved.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'resolved',
            dungeonRoomUsed: true
        });
    });

    it('normalizes malformed locked cache reward counters', () => {
        const run = createRun([roomTile('cache', 'room_locked_cache')], {
            dungeonKeys: { iron: 1 },
            shopGold: Number.NEGATIVE_INFINITY,
            stats: {
                ...createNewRun(0).stats,
                totalScore: Number.NaN,
                currentLevelScore: -1,
                bestScore: Number.POSITIVE_INFINITY
            }
        });

        const resolved = revealDungeonRoom(run, 'cache');

        expect(resolved.shopGold).toBe(DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD);
        expect(resolved.stats.totalScore).toBe(DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
        expect(resolved.stats.currentLevelScore).toBe(DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
        expect(resolved.stats.bestScore).toBe(DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD);
    });

    it('advances best score when key cache rooms award score', () => {
        const run = createRun([roomTile('key-cache', 'room_key_cache')], {
            stats: { ...createNewRun(0).stats, totalScore: 20, currentLevelScore: 2, bestScore: 25 }
        });

        const resolved = revealDungeonRoom(run, 'key-cache');

        expect(resolved.stats.totalScore).toBe(20 + DUNGEON_KEY_CACHE_SCORE_REWARD);
        expect(resolved.stats.currentLevelScore).toBe(2 + DUNGEON_KEY_CACHE_SCORE_REWARD);
        expect(resolved.stats.bestScore).toBe(20 + DUNGEON_KEY_CACHE_SCORE_REWARD);
    });

    it('opens typed locked cache rooms with their matching key kind', () => {
        const run = createRun(
            [
                roomTile('cache', 'room_locked_cache', {
                    dungeonKeyKind: 'treasure'
                })
            ],
            {
                dungeonKeys: { iron: 1, treasure: 1 },
                shopGold: 3
            }
        );

        const resolved = revealDungeonRoom(run, 'cache');

        expect(resolved.dungeonKeys.treasure).toBe(0);
        expect(resolved.dungeonKeys.iron).toBe(1);
        expect(resolved.shopGold).toBe(3 + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD);
        expect(resolved.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'resolved',
            dungeonRoomUsed: true
        });
    });

    it('does not spend iron keys on non-iron locked cache rooms', () => {
        const run = createRun(
            [
                roomTile('cache', 'room_locked_cache', {
                    dungeonKeyKind: 'treasure'
                })
            ],
            {
                dungeonKeys: { iron: 1, treasure: 0 },
                dungeonMasterKeys: 0,
                shopGold: 3
            }
        );

        const revealed = revealDungeonRoom(run, 'cache');

        expect(revealed.dungeonKeys.iron).toBe(1);
        expect(revealed.shopGold).toBe(3);
        expect(revealed.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'revealed',
            dungeonRoomUsed: undefined
        });
    });

    it('normalizes malformed master-key counts before opening locked cache rooms', () => {
        const run = createRun([roomTile('cache', 'room_locked_cache')], {
            dungeonKeys: { iron: 0 },
            dungeonMasterKeys: 1.9,
            shopGold: 3
        });

        const resolved = revealDungeonRoom(run, 'cache');

        expect(resolved.dungeonMasterKeys).toBe(0);
        expect(resolved.shopGold).toBe(3 + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD);
        expect(resolved.board!.tiles[0]).toMatchObject({
            dungeonCardState: 'resolved',
            dungeonRoomUsed: true
        });
    });

    it('reveals one hidden dungeon card pair with scrying lens', () => {
        const run = createRun([
            roomTile('lens', 'room_scrying_lens'),
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'hidden' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'hidden' })
        ]);

        const resolved = revealDungeonRoom(run, 'lens');

        expect(resolved.board!.tiles.find((candidate) => candidate.id === 'lens')).toMatchObject({
            dungeonCardState: 'resolved',
            dungeonRoomUsed: true
        });
        expect(resolved.board!.tiles.find((candidate) => candidate.id === 'trap-a')).toMatchObject({
            dungeonCardState: 'revealed'
        });
        expect(resolved.board!.tiles.find((candidate) => candidate.id === 'trap-b')).toMatchObject({
            dungeonCardState: 'revealed'
        });
    });
});
