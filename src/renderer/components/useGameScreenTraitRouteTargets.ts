import { useMemo } from 'react';
import type { RunState } from '../../shared/contracts';
import { getTraitSwapRouteHints, type TraitSwapRouteHint } from '../../shared/trait-opportunities';

interface GameScreenTraitRouteTargets {
    hint: TraitSwapRouteHint | null;
    tileIds: readonly string[];
}

export const useGameScreenTraitRouteTargets = (run: RunState): GameScreenTraitRouteTargets =>
    useMemo<GameScreenTraitRouteTargets>(() => {
        if (
            !run.board ||
            run.status !== 'playing' ||
            run.activeContract?.noShuffle ||
            run.board.flippedTileIds.length > 0 ||
            run.board.tiles.filter((tile) => tile.state === 'hidden').length < 2 ||
            (run.regionShuffleCharges <= 0 && !run.regionShuffleFreeThisFloor)
        ) {
            return { hint: null, tileIds: [] };
        }
        const hint = getTraitSwapRouteHints(run.board, 1)[0] ?? null;
        return {
            hint,
            tileIds: hint ? [hint.firstTileId, hint.secondTileId] : []
        };
    }, [run.activeContract?.noShuffle, run.board, run.regionShuffleCharges, run.regionShuffleFreeThisFloor, run.status]);
