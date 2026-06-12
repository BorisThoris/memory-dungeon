import { describe, expect, it } from 'vitest';

import type { BoardState, EnemyHazardState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    clearFinalPairEnemyHazardOccupationForRun,
    collectEnemyHazardsOccupyingFinalPair,
    defeatEnemyHazardOccupationOnFinalPair,
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
            tile('e', 'matched-a', { state: 'matched' })
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
