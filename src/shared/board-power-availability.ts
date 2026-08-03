import type { RunState } from './contracts';
import { countFullyHiddenPairs } from './board-inspection';
import { tileIsDestroyEligiblePreview } from './board-power-targeting';
import { hasRunRelic } from './relics';
import { runFilteredStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';

export const hasClearFlipState = (run: RunState): boolean => Array.isArray(run.board?.flippedTileIds) && run.board.flippedTileIds.length === 0;

export const hasFreeTargetedReconfiguration = (run: RunState): boolean =>
    run.regionShuffleFreeThisFloor === true &&
    (hasRunRelic(run, 'region_shuffle_free_first') ||
        runFilteredStringArray(run.rewardPerkIds).includes('free_first_swap_per_floor'));

export const canShuffleBoard = (run: RunState): boolean => {
    const board = run.board;
    return (
        run.status === 'playing' &&
        board != null &&
        hasClearFlipState(run) &&
        !run.activeContract?.noShuffle &&
        (runNonNegativeInteger(run.shuffleCharges) > 0 ||
            (run.freeShuffleThisFloor && hasRunRelic(run, 'first_shuffle_free_per_floor'))) &&
        countFullyHiddenPairs(board) >= 2
    );
};

export const canDestroyPair = (run: RunState, tileId: string): boolean => {
    if (run.status !== 'playing' || !run.board || !hasClearFlipState(run) || runNonNegativeInteger(run.destroyPairCharges) <= 0) {
        return false;
    }

    return tileIsDestroyEligiblePreview(run.board, tileId);
};

export const canRegionShuffle = (run: RunState): boolean => {
    const board = run.board;
    return (
        run.status === 'playing' &&
        board != null &&
        hasClearFlipState(run) &&
        !run.activeContract?.noShuffle &&
        (runNonNegativeInteger(run.regionShuffleCharges) > 0 ||
            hasFreeTargetedReconfiguration(run)) &&
        countFullyHiddenPairs(board) >= 1
    );
};

/** Row shuffle needs at least two hidden tiles in that row. */
export const canRegionShuffleRow = (run: RunState, rowIndex: number): boolean => {
    if (!canRegionShuffle(run) || !run.board) {
        return false;
    }
    const cols = run.board.columns;
    let hidden = 0;
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hidden += 1;
        }
    });
    return hidden >= 2;
};

export const canSwapHiddenTiles = (run: RunState, firstTileId: string, secondTileId: string): boolean => {
    if (
        run.status !== 'playing' ||
        !run.board ||
        !hasClearFlipState(run) ||
        run.activeContract?.noShuffle ||
        firstTileId === secondTileId ||
        (runNonNegativeInteger(run.regionShuffleCharges) <= 0 &&
            !hasFreeTargetedReconfiguration(run))
    ) {
        return false;
    }
    const firstTile = run.board.tiles.find((tile) => tile.id === firstTileId);
    const secondTile = run.board.tiles.find((tile) => tile.id === secondTileId);
    return Boolean(firstTile && secondTile && firstTile.state === 'hidden' && secondTile.state === 'hidden');
};
