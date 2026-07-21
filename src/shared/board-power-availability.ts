import type { RelicId, RunState } from './contracts';
import { countFullyHiddenPairs } from './board-inspection';
import { tileIsDestroyEligiblePreview } from './board-power-targeting';

const nonNegativePowerCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const hasClearFlipState = (run: RunState): boolean => Array.isArray(run.board?.flippedTileIds) && run.board.flippedTileIds.length === 0;

const hasRelic = (run: RunState, relicId: RelicId): boolean => Array.isArray(run.relicIds) && run.relicIds.includes(relicId);

export const canShuffleBoard = (run: RunState): boolean =>
    run.status === 'playing' &&
    Boolean(run.board) &&
    hasClearFlipState(run) &&
    !run.activeContract?.noShuffle &&
    (nonNegativePowerCount(run.shuffleCharges) > 0 ||
        (run.freeShuffleThisFloor && hasRelic(run, 'first_shuffle_free_per_floor'))) &&
    countFullyHiddenPairs(run.board!) >= 2;

export const canDestroyPair = (run: RunState, tileId: string): boolean => {
    if (run.status !== 'playing' || !run.board || !hasClearFlipState(run) || nonNegativePowerCount(run.destroyPairCharges) <= 0) {
        return false;
    }

    return tileIsDestroyEligiblePreview(run.board, tileId);
};

export const canRegionShuffle = (run: RunState): boolean =>
    run.status === 'playing' &&
    Boolean(run.board) &&
    hasClearFlipState(run) &&
    !run.activeContract?.noShuffle &&
    (nonNegativePowerCount(run.regionShuffleCharges) > 0 ||
        (run.regionShuffleFreeThisFloor && hasRelic(run, 'region_shuffle_free_first'))) &&
    countFullyHiddenPairs(run.board!) >= 1;

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
        (nonNegativePowerCount(run.regionShuffleCharges) <= 0 && !(run.regionShuffleFreeThisFloor && hasRelic(run, 'region_shuffle_free_first')))
    ) {
        return false;
    }
    const firstTile = run.board.tiles.find((tile) => tile.id === firstTileId);
    const secondTile = run.board.tiles.find((tile) => tile.id === secondTileId);
    return Boolean(firstTile && secondTile && firstTile.state === 'hidden' && secondTile.state === 'hidden');
};
