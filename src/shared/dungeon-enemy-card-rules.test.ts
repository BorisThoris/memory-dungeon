import { describe, expect, it } from 'vitest';

import type { BoardState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    activeDungeonEnemyPairKeys,
    applyDungeonEnemyAttack,
    clearDungeonCardFields,
    damageFirstActiveDungeonEnemy,
    revealOneHiddenDungeonHazardPair
} from './dungeon-enemy-card-rules';
import { DUNGEON_ENEMY_DEFEAT_SCORE } from './dungeon-match-reward-rules';

describe('dungeon enemy card rules', () => {
    it('clears dungeon card fields without changing base tile identity', () => {
        expect(clearDungeonCardFields(enemyTile('a', 'enemy-a'))).toMatchObject({
            id: 'a',
            pairKey: 'enemy-a',
            dungeonCardKind: undefined,
            dungeonCardState: undefined,
            dungeonCardHp: undefined
        });
    });

    it('tracks and damages active revealed enemy pairs', () => {
        const board = boardWith([enemyTile('a', 'enemy-a'), enemyTile('b', 'enemy-a'), enemyTile('c', 'enemy-b', { dungeonCardState: 'hidden' })]);

        expect(activeDungeonEnemyPairKeys(board)).toEqual(['enemy-a']);
        const damaged = damageFirstActiveDungeonEnemy(board, 1);
        expect(damaged).toMatchObject({ defeated: 0, score: 0 });
        expect(damaged.board.tiles.find((tile) => tile.id === 'a')?.dungeonCardHp).toBe(1);

        const defeated = damageFirstActiveDungeonEnemy(damaged.board, 1);
        expect(defeated).toMatchObject({ defeated: 1, score: DUNGEON_ENEMY_DEFEAT_SCORE });
        expect(defeated.board.matchedPairs).toBe(board.matchedPairs + 1);
        expect(defeated.board.tiles.find((tile) => tile.id === 'a')).toMatchObject({
            state: 'removed',
            dungeonCardKind: undefined
        });
    });

    it('spends guard tokens before lives when enemies attack', () => {
        const board = boardWith([enemyTile('a', 'enemy-a')]);

        expect(applyDungeonEnemyAttack(3, 1, board)).toEqual({ lives: 3, guardTokens: 0, attacked: true });
        expect(applyDungeonEnemyAttack(3, 0, board)).toEqual({ lives: 2, guardTokens: 0, attacked: true });
        expect(applyDungeonEnemyAttack(3, 0, boardWith([]))).toEqual({ lives: 3, guardTokens: 0, attacked: false });
    });

    it('reveals the first hidden enemy or trap pair ids', () => {
        const ids = revealOneHiddenDungeonHazardPair([
            tile('a', 'safe-a'),
            enemyTile('b', 'enemy-a', { dungeonCardState: 'hidden' }),
            enemyTile('c', 'enemy-a', { dungeonCardState: 'hidden' }),
            tile('d', 'trap-a', { dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_alarm', dungeonCardState: 'hidden' })
        ]);

        expect([...ids].sort()).toEqual(['b', 'c']);
    });
});

const boardWith = (tiles: Tile[]): BoardState => ({
    ...createNewRun(0).board!,
    pairCount: Math.max(tiles.length / 2, 1),
    matchedPairs: 0,
    tiles
});

const enemyTile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile =>
    tile(id, pairKey, {
        dungeonCardKind: 'enemy',
        dungeonCardEffectId: 'enemy_sentry',
        dungeonCardState: 'revealed',
        dungeonCardHp: 2,
        dungeonCardMaxHp: 2,
        ...extra
    });

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    ...extra
});
