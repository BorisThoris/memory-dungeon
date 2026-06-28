import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import { getDungeonExitStatus } from './dungeon-board-status';
import { repairRunProgressionSoftlocks } from './run-progression-repair';
import { EXIT_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    label: id,
    state: 'hidden',
    symbol: id,
    ...overrides
});

const runWithBoard = (board: BoardState): RunState =>
    ({
        status: 'playing',
        board,
        dungeonKeys: {},
        dungeonMasterKeys: 0,
        dungeonEnemiesDefeated: 0,
        dungeonEnemiesDefeatedThisFloor: 0,
        dungeonGatewaysUsedThisFloor: 0,
        dungeonTrapsResolvedThisFloor: 0,
        dungeonTreasuresOpenedThisFloor: 0,
        enemyHazardsDefeatedThisFloor: 0,
        stats: { guardTokens: 0 }
    }) as RunState;

const keyLockedBoard = (progressPairState: Tile['state']): BoardState =>
    ({
        level: 1,
        pairCount: 1,
        columns: 2,
        rows: 2,
        tiles: [
            tile('a1', 'a', { state: progressPairState }),
            tile('a2', 'a', { state: progressPairState }),
            tile('exit', EXIT_PAIR_KEY, {
                state: 'flipped',
                dungeonCardKind: 'exit',
                dungeonExitLockKind: 'iron'
            })
        ],
        flippedTileIds: ['exit'],
        matchedPairs: progressPairState === 'matched' ? 1 : 0,
        floorArchetypeId: null,
        featuredObjectiveId: null,
        dungeonExitTileId: 'exit',
        dungeonExitLockKind: 'iron',
        dungeonKeysHeld: 0
    }) as BoardState;

describe('repairRunProgressionSoftlocks', () => {
    it('preserves pending key fallback locks while progression pairs remain clearable', () => {
        const repaired = repairRunProgressionSoftlocks(runWithBoard(keyLockedBoard('hidden')));

        expect(repaired.board?.dungeonExitLockKind).toBe('iron');
        expect(repaired.board?.tiles.find((candidate) => candidate.id === 'exit')).toMatchObject({
            dungeonExitLockKind: 'iron'
        });
        expect(getDungeonExitStatus(repaired)).toMatchObject({
            lockKind: 'iron',
            keyFallbackPending: true,
            canActivate: false
        });
    });

    it('opens terminal stale key locks once no progression pairs remain', () => {
        const repaired = repairRunProgressionSoftlocks(runWithBoard(keyLockedBoard('matched')));

        expect(repaired.board?.dungeonExitLockKind).toBe('none');
        expect(repaired.board?.tiles.find((candidate) => candidate.id === 'exit')).toMatchObject({
            dungeonExitLockKind: 'none'
        });
        expect(getDungeonExitStatus(repaired)).toMatchObject({
            lockKind: 'none',
            canActivate: true
        });
    });

    it('defeats stale boss hazards once every real pair is cleared', () => {
        const repaired = repairRunProgressionSoftlocks(
            runWithBoard({
                level: 1,
                pairCount: 1,
                columns: 2,
                rows: 2,
                tiles: [
                    tile('a1', 'a', { state: 'matched' }),
                    tile('a2', 'a', { state: 'matched' }),
                    tile('exit', EXIT_PAIR_KEY, {
                        state: 'flipped',
                        dungeonCardKind: 'exit',
                        dungeonExitLockKind: 'none'
                    })
                ],
                flippedTileIds: ['exit'],
                matchedPairs: 1,
                floorArchetypeId: null,
                featuredObjectiveId: null,
                dungeonExitTileId: 'exit',
                dungeonExitLockKind: 'none',
                dungeonObjectiveId: 'defeat_boss',
                dungeonBossId: 'trap_warden',
                enemyHazards: [
                    {
                        id: 'warden',
                        kind: 'warden',
                        label: 'Latch Warden',
                        currentTileId: 'a1',
                        nextTileId: 'a2',
                        pattern: 'guard',
                        state: 'revealed',
                        damage: 1,
                        hp: 1,
                        maxHp: 3,
                        bossId: 'trap_warden'
                    }
                ]
            } as BoardState)
        );

        expect(repaired.board?.enemyHazards).toMatchObject([{ id: 'warden', hp: 0, state: 'defeated' }]);
        expect(repaired.dungeonEnemiesDefeated).toBe(1);
        expect(repaired.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(repaired.enemyHazardsDefeatedThisFloor).toBe(1);
    });
});
