import { useCallback, useEffect, useMemo, useState, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import type { BoardState } from '../../shared/contracts';
import { getPickableTileIds, moveFocusInGrid } from './tileBoardDomAccessibility';

interface TileBoardFocusRuntimeArgs {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    boardAppRef: RefObject<HTMLDivElement | null>;
    boardGraphicsOk: boolean;
    guidedTargetTileIds?: readonly string[];
    interactive: boolean;
    onTileSelect: (tileId: string) => void;
}

interface TileBoardFocusRuntimeState {
    boardApplicationFocused: boolean;
    focusedTileId: string | null;
    handleBoardApplicationBlur: (event: FocusEvent<HTMLDivElement>) => void;
    handleBoardApplicationFocus: () => void;
    handleBoardApplicationKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export const useTileBoardFocusRuntime = ({
    allowGambitThirdFlip,
    board,
    boardAppRef,
    boardGraphicsOk,
    guidedTargetTileIds,
    interactive,
    onTileSelect
}: TileBoardFocusRuntimeArgs): TileBoardFocusRuntimeState => {
    const [focusedTileId, setFocusedTileId] = useState<string | null>(null);
    const [boardApplicationFocused, setBoardApplicationFocused] = useState(false);
    const guidedTargetTileIdSet = useMemo(() => new Set(guidedTargetTileIds ?? []), [guidedTargetTileIds]);

    useEffect(() => {
        const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
        queueMicrotask(() => {
            setFocusedTileId((current) => {
                if (pickable.length === 0) {
                    return null;
                }
                if (current && pickable.includes(current)) {
                    return current;
                }
                return null;
            });
        });
    }, [allowGambitThirdFlip, board, interactive]);

    const handleBoardApplicationFocus = useCallback((): void => {
        setBoardApplicationFocused(true);
        setFocusedTileId((current) => {
            const pickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            if (pickable.length === 0) {
                return null;
            }
            if (current && pickable.includes(current)) {
                return current;
            }
            return pickable[0];
        });
    }, [allowGambitThirdFlip, board, interactive]);

    const handleBoardApplicationBlur = useCallback(
        (event: FocusEvent<HTMLDivElement>): void => {
            const related = event.relatedTarget;
            if (related instanceof Node && boardAppRef.current?.contains(related)) {
                return;
            }
            setBoardApplicationFocused(false);
            setFocusedTileId(null);
        },
        [boardAppRef]
    );

    const handleBoardApplicationKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>): void => {
            if (!boardGraphicsOk || !interactive) {
                return;
            }

            const rawPickable = getPickableTileIds(board, interactive, allowGambitThirdFlip);
            const guidedPickable =
                guidedTargetTileIdSet.size > 0 ? rawPickable.filter((tileId) => guidedTargetTileIdSet.has(tileId)) : rawPickable;
            const pickable = guidedPickable.length > 0 ? guidedPickable : rawPickable;

            if (pickable.length === 0) {
                return;
            }

            let dir: 'up' | 'down' | 'left' | 'right' | null = null;
            if (event.key === 'ArrowUp') dir = 'up';
            else if (event.key === 'ArrowDown') dir = 'down';
            else if (event.key === 'ArrowLeft') dir = 'left';
            else if (event.key === 'ArrowRight') dir = 'right';
            else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (focusedTileId) {
                    onTileSelect(focusedTileId);
                }
                return;
            }

            if (dir) {
                event.preventDefault();
                const next = moveFocusInGrid(board, focusedTileId, dir, interactive, allowGambitThirdFlip);
                if (next && next !== focusedTileId) {
                    setFocusedTileId(next);
                }
            }
        },
        [
            allowGambitThirdFlip,
            board,
            boardGraphicsOk,
            focusedTileId,
            guidedTargetTileIdSet,
            interactive,
            onTileSelect
        ]
    );

    return {
        boardApplicationFocused,
        focusedTileId,
        handleBoardApplicationBlur,
        handleBoardApplicationFocus,
        handleBoardApplicationKeyDown
    };
};
