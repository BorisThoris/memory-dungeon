import { act, renderHook, waitFor } from '@testing-library/react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { useTileBoardFocusRuntime } from './useTileBoardFocusRuntime';

const baseBoard: BoardState = {
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: [],
    floorArchetypeId: null,
    level: 1,
    matchedPairs: 0,
    pairCount: 2,
    rows: 2,
    tiles: [
        { id: 'a1', label: 'A', pairKey: 'A', state: 'hidden', symbol: 'A' },
        { id: 'a2', label: 'A', pairKey: 'A', state: 'hidden', symbol: 'A' },
        { id: 'b1', label: 'B', pairKey: 'B', state: 'hidden', symbol: 'B' },
        { id: 'b2', label: 'B', pairKey: 'B', state: 'hidden', symbol: 'B' }
    ]
};

describe('useTileBoardFocusRuntime', () => {
    it('focuses the first pickable tile and supports keyboard move/select', () => {
        const onTileSelect = vi.fn();
        const boardAppRef = { current: document.createElement('div') as HTMLDivElement | null };
        const { result } = renderHook(() =>
            useTileBoardFocusRuntime({
                allowGambitThirdFlip: false,
                board: baseBoard,
                boardAppRef,
                boardGraphicsOk: true,
                guidedTargetTileIds: [],
                interactive: true,
                onTileSelect
            })
        );

        act(() => {
            result.current.handleBoardApplicationFocus();
        });

        expect(result.current.boardApplicationFocused).toBe(true);
        expect(result.current.focusedTileId).toBe('a1');

        const movePreventDefault = vi.fn();
        act(() => {
            result.current.handleBoardApplicationKeyDown({
                key: 'ArrowRight',
                preventDefault: movePreventDefault
            } as unknown as KeyboardEvent<HTMLDivElement>);
        });

        expect(movePreventDefault).toHaveBeenCalledOnce();
        expect(result.current.focusedTileId).toBe('a2');

        const selectPreventDefault = vi.fn();
        act(() => {
            result.current.handleBoardApplicationKeyDown({
                key: 'Enter',
                preventDefault: selectPreventDefault
            } as unknown as KeyboardEvent<HTMLDivElement>);
        });

        expect(selectPreventDefault).toHaveBeenCalledOnce();
        expect(onTileSelect).toHaveBeenCalledWith('a2');
    });

    it('keeps focus active when blur stays inside the board app and clears it when focus leaves', () => {
        const onTileSelect = vi.fn();
        const boardNode = document.createElement('div');
        const internalTarget = document.createElement('button');
        boardNode.appendChild(internalTarget);
        const boardAppRef = { current: boardNode as HTMLDivElement | null };
        const { result } = renderHook(() =>
            useTileBoardFocusRuntime({
                allowGambitThirdFlip: false,
                board: baseBoard,
                boardAppRef,
                boardGraphicsOk: true,
                guidedTargetTileIds: [],
                interactive: true,
                onTileSelect
            })
        );

        act(() => {
            result.current.handleBoardApplicationFocus();
        });

        act(() => {
            result.current.handleBoardApplicationBlur({
                relatedTarget: internalTarget
            } as unknown as FocusEvent<HTMLDivElement>);
        });

        expect(result.current.boardApplicationFocused).toBe(true);
        expect(result.current.focusedTileId).toBe('a1');

        act(() => {
            result.current.handleBoardApplicationBlur({
                relatedTarget: document.createElement('button')
            } as unknown as FocusEvent<HTMLDivElement>);
        });

        expect(result.current.boardApplicationFocused).toBe(false);
        expect(result.current.focusedTileId).toBeNull();
    });

    it('clears stale focus when board changes remove the focused tile from the pickable set', async () => {
        const onTileSelect = vi.fn();
        const boardAppRef = { current: document.createElement('div') as HTMLDivElement | null };
        const { result, rerender } = renderHook(
            ({ board }: { board: BoardState }) =>
                useTileBoardFocusRuntime({
                    allowGambitThirdFlip: false,
                    board,
                    boardAppRef,
                    boardGraphicsOk: true,
                    guidedTargetTileIds: [],
                    interactive: true,
                    onTileSelect
                }),
            { initialProps: { board: baseBoard } }
        );

        act(() => {
            result.current.handleBoardApplicationFocus();
        });

        expect(result.current.focusedTileId).toBe('a1');

        rerender({
            board: {
                ...baseBoard,
                matchedPairs: 1,
                tiles: baseBoard.tiles.map((tile) => (tile.id === 'a1' ? { ...tile, state: 'matched' } : tile))
            }
        });

        await waitFor(() => {
            expect(result.current.focusedTileId).toBeNull();
        });
    });
});
