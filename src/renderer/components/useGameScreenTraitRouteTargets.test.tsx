import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from '../../shared/contracts';
import { useGameScreenTraitRouteTargets } from './useGameScreenTraitRouteTargets';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    label: id,
    state: 'hidden',
    symbol: id,
    ...overrides
});

const routeSetupBoard: BoardState = {
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: [],
    floorArchetypeId: null,
    level: 1,
    matchedPairs: 0,
    pairCount: 2,
    rows: 2,
    tiles: [
        tile('sealed-a', 'sealed', { tileTraitKind: 'sealed' }),
        tile('plain-a', 'plain'),
        tile('origin-a', 'origin'),
        tile('heavy-a', 'heavy', { tileTraitKind: 'heavy' })
    ]
} as BoardState;

const run = (overrides: Partial<RunState> = {}): RunState =>
    ({
        activeContract: null,
        board: routeSetupBoard,
        regionShuffleCharges: 1,
        regionShuffleFreeThisFloor: false,
        status: 'playing',
        ...overrides
    }) as RunState;

describe('useGameScreenTraitRouteTargets', () => {
    it('exposes actionable swap-created trait routes when row/swap is available', () => {
        const { result } = renderHook(() => useGameScreenTraitRouteTargets(run()));

        expect(result.current.hint?.text).toBe('Swap sealed-a with plain-a: Sealed + Heavy: score surge');
        expect(result.current.tileIds).toEqual(['sealed-a', 'plain-a']);
    });

    it('hides setup targets when a no-shuffle contract disables swap tools', () => {
        const { result } = renderHook(() =>
            useGameScreenTraitRouteTargets(
                run({ activeContract: { maxMismatches: null, noDestroy: false, noShuffle: true } })
            )
        );

        expect(result.current.hint).toBeNull();
        expect(result.current.tileIds).toEqual([]);
    });

    it('hides setup targets while a flip is in progress', () => {
        const { result } = renderHook(() =>
            useGameScreenTraitRouteTargets(
                run({ board: { ...routeSetupBoard, flippedTileIds: ['sealed-a'] } })
            )
        );

        expect(result.current.hint).toBeNull();
        expect(result.current.tileIds).toEqual([]);
    });

    it('hides setup targets when fewer than two hidden cards can be swapped', () => {
        const { result } = renderHook(() =>
            useGameScreenTraitRouteTargets(
                run({
                    board: {
                        ...routeSetupBoard,
                        tiles: routeSetupBoard.tiles.map((card, index) =>
                            index === 0 ? card : { ...card, state: 'matched' }
                        )
                    }
                })
            )
        );

        expect(result.current.hint).toBeNull();
        expect(result.current.tileIds).toEqual([]);
    });
});
