import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import { solveRunByExhaustingPlayablePairsWithTrace } from './playthrough-solver';
import { createNewRun, finishMemorizePhase } from './game-core';

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
    ...finishMemorizePhase(createNewRun(0, { gameMode: 'endless' })),
    board: candidate,
    status: 'playing'
});

describe('playthrough solver trace', () => {
    it('exhausts pairs and reports the floor clear', () => {
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(board([tile('a1', 'a'), tile('a2', 'a')]))
        );

        expect(traced.stopReason).toBe('level_complete');
        expect(traced.turns).toBe(1);
        expect(traced.run.status).toBe('levelComplete');
        expect(traced.run.board?.matchedPairs).toBe(1);
    });


    it('reports no_exit when nothing playable is left but the floor did not clear', () => {
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
        const traced = solveRunByExhaustingPlayablePairsWithTrace(
            runWithBoard(
                board(
                    [
                        tile('a1', 'a', 'flipped'),
                        tile('a2', 'a', 'flipped')
                    ],
                    { flippedTileIds: ['a1', 'a2'] }
                )
            )
        );

        expect(traced.stopReason).toBe('level_complete');
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
