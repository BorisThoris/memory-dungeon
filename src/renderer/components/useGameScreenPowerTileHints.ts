import { useMemo } from 'react';
import type { RunState } from '../../shared/contracts';
import {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    tileIsStrayEligiblePreview
} from '../../shared/board-powers';

const EMPTY_TILE_ID_SET: ReadonlySet<string> = new Set();

interface GameScreenPowerTileHintsOptions {
    boardPinMode: boolean;
    destroyPairArmed: boolean;
    mergedPeekTileIds: readonly string[];
    peekModeArmed: boolean;
    run: RunState;
    strayRemoveArmed: boolean;
    tileSwapPowerVisualActive: boolean;
}

export const useGameScreenPowerTileHints = ({
    boardPinMode,
    destroyPairArmed,
    mergedPeekTileIds,
    peekModeArmed,
    run,
    strayRemoveArmed,
    tileSwapPowerVisualActive
}: GameScreenPowerTileHintsOptions) => {
    const shiftingSpotlightActive = useMemo(
        () => run.activeMutators.includes('shifting_spotlight'),
        [run.activeMutators]
    );

    const destroyPowerVisualActive = useMemo(
        () =>
            Boolean(run.board) &&
            run.status === 'playing' &&
            destroyPairArmed &&
            run.destroyPairCharges > 0 &&
            !run.activeContract?.noDestroy &&
            run.board!.flippedTileIds.length === 0,
        [run.board, run.status, destroyPairArmed, run.destroyPairCharges, run.activeContract?.noDestroy]
    );

    const peekPowerVisualActive = useMemo(
        () =>
            Boolean(run.board) &&
            run.status === 'playing' &&
            peekModeArmed &&
            run.peekCharges > 0 &&
            run.board!.flippedTileIds.length === 0,
        [run.board, run.status, peekModeArmed, run.peekCharges]
    );

    const strayPowerVisualActive = useMemo(
        () =>
            Boolean(run.board) &&
            run.status === 'playing' &&
            strayRemoveArmed &&
            run.strayRemoveCharges > 0 &&
            run.board!.flippedTileIds.length === 0,
        [run.board, run.status, strayRemoveArmed, run.strayRemoveCharges]
    );

    const pinModeBoardHintActive = useMemo(
        () => boardPinMode && run.status === 'playing',
        [boardPinMode, run.status]
    );

    const destroyEligibleTileIds = useMemo(() => {
        if (!run.board || !destroyPowerVisualActive) {
            return EMPTY_TILE_ID_SET;
        }
        return collectDestroyEligibleTileIds(run.board);
    }, [run.board, destroyPowerVisualActive]);

    const peekEligibleTileIds = useMemo(() => {
        if (!run.board || !peekPowerVisualActive) {
            return EMPTY_TILE_ID_SET;
        }
        return collectPeekEligibleTileIds(run.board, mergedPeekTileIds);
    }, [run.board, peekPowerVisualActive, mergedPeekTileIds]);

    const strayEligibleTileIds = useMemo(() => {
        if (!run.board || !strayPowerVisualActive) {
            return EMPTY_TILE_ID_SET;
        }
        const next = new Set<string>();
        for (const tile of run.board.tiles) {
            if (tileIsStrayEligiblePreview(run.board, tile.id)) {
                next.add(tile.id);
            }
        }
        return next;
    }, [run.board, strayPowerVisualActive]);

    const tileSwapEligibleTileIds = useMemo(() => {
        if (!run.board || !tileSwapPowerVisualActive) {
            return EMPTY_TILE_ID_SET;
        }
        const next = new Set<string>();
        for (const tile of run.board.tiles) {
            if (tile.state === 'hidden') {
                next.add(tile.id);
            }
        }
        return next;
    }, [run.board, tileSwapPowerVisualActive]);

    return {
        destroyEligibleTileIds,
        destroyPowerVisualActive,
        peekEligibleTileIds,
        peekPowerVisualActive,
        pinModeBoardHintActive,
        shiftingSpotlightActive,
        strayEligibleTileIds,
        strayPowerVisualActive,
        tileSwapEligibleTileIds
    };
};
