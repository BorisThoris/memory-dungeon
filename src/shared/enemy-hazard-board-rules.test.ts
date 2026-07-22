import { describe, expect, it } from 'vitest';

import type { BoardState, EnemyHazardState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    activeEnemyHazardsForBoard,
    clearFinalPairEnemyHazardOccupationForRun,
    collectEnemyHazardsOccupyingFinalPair,
    defeatEnemyHazardOccupationOnFinalPair,
    defeatEnemyHazardsOnClearedTiles,
    enemyHazardEligibleTiles
} from './enemy-hazard-board-rules';
import { DECOY_PAIR_KEY, EXIT_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';

describe('enemy hazard board rules', () => {
    it('filters hazard-eligible tiles to unresolved real pairs', () => {
        const tiles = [
            tile('a', 'real-a'),
            tile('b', EXIT_PAIR_KEY),
            tile('c', DECOY_PAIR_KEY),
            tile('d', WILD_PAIR_KEY),
            tile('e', 'matched-a', { state: 'matched' }),
            tile('f', 'resolved-a', { dungeonCardState: 'resolved' })
        ];

        expect(enemyHazardEligibleTiles(tiles).map((candidate) => candidate.id)).toEqual(['a']);
    });

    it('collects and defeats hazards occupying the final remaining real pair', () => {
        const board = boardWith([
            tile('a', 'final-a'),
            tile('b', 'final-a'),
            tile('c', 'done-a', { state: 'matched' })
        ], [
            hazard('hazard-a', 'a', 'b'),
            hazard('hazard-b', 'c', 'c')
        ]);

        expect(collectEnemyHazardsOccupyingFinalPair(board).map((candidate) => candidate.id)).toEqual(['hazard-a']);
        expect(defeatEnemyHazardOccupationOnFinalPair(board).enemyHazards).toMatchObject([
            { id: 'hazard-a', hp: 0, state: 'defeated' },
            { id: 'hazard-b', hp: 1, state: 'revealed' }
        ]);
    });

    it('updates run defeat counters when clearing final-pair boss hazards', () => {
        const run = {
            ...createNewRun(0),
            board: boardWith([tile('a', 'final-a')], [hazard('boss-a', 'a', 'a', { bossId: 'rush_sentinel' })]),
            dungeonEnemiesDefeated: 2,
            dungeonEnemiesDefeatedThisFloor: 1,
            enemyHazardsDefeatedThisFloor: 3
        };

        expect(clearFinalPairEnemyHazardOccupationForRun(run)).toMatchObject({
            dungeonEnemiesDefeated: 3,
            dungeonEnemiesDefeatedThisFloor: 2,
            enemyHazardsDefeatedThisFloor: 4
        });
    });

    it('normalizes malformed defeat counters when clearing final-pair hazards', () => {
        const run = {
            ...createNewRun(0),
            board: boardWith([tile('a', 'final-a')], [hazard('boss-a', 'a', 'a', { bossId: 'rush_sentinel' })]),
            dungeonEnemiesDefeated: Number.NaN,
            dungeonEnemiesDefeatedThisFloor: 1.9,
            enemyHazardsDefeatedThisFloor: Number.POSITIVE_INFINITY
        };

        expect(clearFinalPairEnemyHazardOccupationForRun(run)).toMatchObject({
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 2,
            enemyHazardsDefeatedThisFloor: 1
        });
    });

    it('hides and defeats stale hazards that only reference cleared board tiles', () => {
        const board = boardWith([
            tile('a', 'pair-a', { state: 'matched' }),
            tile('b', 'pair-a', { state: 'matched' }),
            tile('c', 'pair-b', { state: 'removed' }),
            tile('d', 'pair-b', { state: 'matched' })
        ], [
            hazard('warden', 'a', 'b', { bossId: 'trap_warden', kind: 'warden', pattern: 'guard' })
        ]);

        expect(activeEnemyHazardsForBoard(board)).toEqual([]);
        expect(defeatEnemyHazardsOnClearedTiles(board).enemyHazards).toMatchObject([
            { id: 'warden', hp: 0, state: 'defeated' }
        ]);
    });

    it('treats hidden decoys and wilds as non-blocking when clearing stale hazards', () => {
        const board = boardWith([
            tile('a', 'pair-a', { state: 'matched' }),
            tile('b', 'pair-a', { state: 'matched' }),
            tile('decoy', DECOY_PAIR_KEY),
            tile('wild', WILD_PAIR_KEY)
        ], [
            hazard('warden', 'a', 'b', { bossId: 'trap_warden', kind: 'warden', pattern: 'guard' })
        ]);

        expect(activeEnemyHazardsForBoard(board)).toEqual([]);
        expect(defeatEnemyHazardsOnClearedTiles(board).enemyHazards).toMatchObject([
            { id: 'warden', hp: 0, state: 'defeated' }
        ]);
    });

    it('ignores malformed enemy hazard arrays before board cleanup', () => {
        const board = {
            ...boardWith([tile('a', 'pair-a'), tile('b', 'pair-a')]),
            enemyHazards: Number.NaN as unknown as BoardState['enemyHazards']
        };
        const run = { ...createNewRun(0), board };

        expect(activeEnemyHazardsForBoard(board)).toEqual([]);
        expect(collectEnemyHazardsOccupyingFinalPair(board)).toEqual([]);
        expect(defeatEnemyHazardOccupationOnFinalPair(board)).toBe(board);
        expect(defeatEnemyHazardsOnClearedTiles(board)).toBe(board);
        expect(clearFinalPairEnemyHazardOccupationForRun(run)).toBe(run);
    });

    it('hides stale boss hazards once their referenced tiles are cleared even before the floor is complete', () => {
        const board = boardWith([
            tile('boss-a', 'boss', { state: 'matched' }),
            tile('boss-b', 'boss', { state: 'matched' }),
            tile('open-a', 'open'),
            tile('open-b', 'open')
        ], [
            hazard('boss-hazard', 'boss-a', 'boss-b', {
                bossId: 'trap_warden',
                kind: 'warden',
                pattern: 'guard',
                hp: 2,
                maxHp: 3
            })
        ]);

        expect(activeEnemyHazardsForBoard(board)).toEqual([]);
    });

    it('keeps hazards active when at least one referenced tile is still uncleared', () => {
        const board = boardWith([
            tile('boss-a', 'boss', { state: 'matched' }),
            tile('boss-b', 'boss', { state: 'matched' }),
            tile('open-a', 'open'),
            tile('open-b', 'open')
        ], [
            hazard('boss-hazard', 'boss-a', 'open-a', {
                bossId: 'trap_warden',
                kind: 'warden',
                pattern: 'guard',
                hp: 2,
                maxHp: 3
            })
        ]);

        expect(activeEnemyHazardsForBoard(board).map((candidate) => candidate.id)).toEqual(['boss-hazard']);
    });

    it('updates run defeat counters when clearing stale boss hazards after all real pairs are matched', () => {
        const run = {
            ...createNewRun(0),
            board: boardWith([
                tile('a', 'pair-a', { state: 'matched' }),
                tile('b', 'pair-a', { state: 'matched' })
            ], [
                hazard('warden', 'a', 'b', { bossId: 'trap_warden', kind: 'warden', pattern: 'guard' })
            ]),
            dungeonEnemiesDefeated: 1,
            dungeonEnemiesDefeatedThisFloor: 0,
            enemyHazardsDefeatedThisFloor: 2
        };

        const cleaned = clearFinalPairEnemyHazardOccupationForRun(run);

        expect(cleaned.board?.enemyHazards).toMatchObject([{ id: 'warden', hp: 0, state: 'defeated' }]);
        expect(cleaned.dungeonEnemiesDefeated).toBe(2);
        expect(cleaned.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(cleaned.enemyHazardsDefeatedThisFloor).toBe(3);
    });
});

const boardWith = (tiles: Tile[], enemyHazards: EnemyHazardState[] = []): BoardState => ({
    ...createNewRun(0).board!,
    pairCount: Math.max(1, new Set(tiles.map((candidate) => candidate.pairKey)).size),
    matchedPairs: 0,
    tiles,
    enemyHazards
});

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id.slice(0, 1).toUpperCase(),
    label: id,
    state: 'hidden',
    ...extra
});

const hazard = (
    id: string,
    currentTileId: string,
    nextTileId: string,
    extra: Partial<EnemyHazardState> = {}
): EnemyHazardState => ({
    id,
    kind: 'sentinel',
    label: id,
    currentTileId,
    nextTileId,
    pattern: 'patrol',
    state: 'revealed',
    damage: 1,
    hp: 1,
    maxHp: 1,
    ...extra
});
