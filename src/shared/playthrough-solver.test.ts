import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import { solveRunByExhaustingPlayablePairsWithTrace } from './playthrough-solver';
import { createNewRun, finishMemorizePhase } from './game-core';
import { EXIT_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    state,
    symbol: id,
    label: id
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    level: 1,
    pairCount: 1,
    columns: 2,
    rows: 2,
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null,
    ...overrides
});

const runWithBoard = (candidate: BoardState): RunState => ({
    ...finishMemorizePhase(createNewRun(0, { gameMode: 'puzzle' })),
    board: candidate,
    status: 'playing'
});

describe('playthrough solver trace', () => {
    it('exhausts pairs, reveals the primary exit, and reports the exit attempt', () => {
        const exit = {
            ...tile('exit', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit' as const
        };
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board([tile('a1', 'a'), tile('a2', 'a'), exit], {
                    dungeonExitTileId: exit.id,
                    dungeonExitActivated: false
                })
            )
        );

        expect(traced.stopReason).toBe('exit_attempted');
        expect(traced.lastPairKey).toBe(EXIT_PAIR_KEY);
        expect(traced.lastTileIds).toEqual(['exit']);
        expect(traced.run.status).toBe('levelComplete');
        expect(traced.run.board?.dungeonExitActivated).toBe(true);
    });

    it('repairs stale boss hazards after solved exit activation', () => {
        const exit = {
            ...tile('exit', EXIT_PAIR_KEY, 'flipped'),
            dungeonCardKind: 'exit' as const
        };
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board(
                    [
                        tile('a1', 'a', 'matched'),
                        tile('a2', 'a', 'matched'),
                        exit
                    ],
                    {
                        dungeonBossId: 'trap_warden',
                        dungeonExitTileId: exit.id,
                        dungeonObjectiveId: 'defeat_boss',
                        enemyHazards: [
                            {
                                bossId: 'trap_warden',
                                currentTileId: 'a1',
                                damage: 1,
                                hp: 1,
                                id: 'stale-warden',
                                kind: 'warden',
                                label: 'Stale Warden',
                                maxHp: 1,
                                nextTileId: 'a2',
                                pattern: 'guard',
                                state: 'revealed'
                            }
                        ],
                        matchedPairs: 1
                    }
                )
            )
        );

        expect(traced.stopReason).toBe('exit_attempted');
        expect(traced.run.status).toBe('levelComplete');
        expect(traced.run.board?.enemyHazards?.[0]).toMatchObject({ hp: 0, state: 'defeated' });
        expect(traced.run.dungeonEnemiesDefeatedThisFloor).toBe(1);
        expect(traced.run.enemyHazardsDefeatedThisFloor).toBe(1);
    });

    it('reports no_exit when all playable pairs are exhausted but no exit exists', () => {
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board(
                    [
                        tile('a1', 'a', 'matched'),
                        tile('a2', 'a', 'matched')
                    ],
                    { matchedPairs: 1 }
                )
            )
        );

        expect(traced.stopReason).toBe('no_exit');
        expect(traced.run.status).toBe('playing');
    });

    it('resolves already-flipped matching pairs before continuing', () => {
        const exit = {
            ...tile('exit', EXIT_PAIR_KEY),
            dungeonCardKind: 'exit' as const
        };
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board(
                    [
                        tile('a1', 'a', 'flipped'),
                        tile('a2', 'a', 'flipped'),
                        exit
                    ],
                    {
                        dungeonExitTileId: exit.id,
                        dungeonExitActivated: false,
                        flippedTileIds: ['a1', 'a2']
                    }
                )
            )
        );

        expect(traced.stopReason).toBe('exit_attempted');
        expect(traced.run.status).toBe('levelComplete');
        expect(traced.run.board?.tiles.filter((candidate) => candidate.pairKey === 'a')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ state: 'matched' }),
                expect.objectContaining({ state: 'matched' })
            ])
        );
    });

    it('keeps no_progress for exposed pairs that cannot resolve', () => {
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board(
                    [
                        tile('a1', 'a', 'flipped'),
                        tile('a2', 'a', 'flipped')
                    ],
                    { flippedTileIds: [] }
                )
            )
        );

        expect(traced.stopReason).toBe('no_progress');
        expect(traced.lastPairKey).toBe('a');
        expect(traced.lastTileIds).toEqual(['a1', 'a2']);
    });
});
