import type { RunState } from './contracts';
import { countFullyHiddenPairs } from './board-inspection';
import { runNonNegativeInteger } from './run-number-guards';

export const hasClearFlipState = (run: RunState): boolean => Array.isArray(run.board?.flippedTileIds) && run.board.flippedTileIds.length === 0;

/** The button and keyboard shortcut must refuse the same states as the targeted peek action. */
export const canPeekAtBoard = (run: RunState): boolean => {
    const revealed = Array.isArray(run.peekRevealedTileIds) ? run.peekRevealedTileIds : [];
    return run.status === 'playing' && hasClearFlipState(run) && runNonNegativeInteger(run.peekCharges) > 0 &&
        Boolean(run.board?.tiles.some((tile) => tile.state === 'hidden' && !revealed.includes(tile.id)));
};

const hasUsefulShuffleRow = (run: RunState): boolean => {
    const board = run.board;
    return Boolean(board && Array.from({ length: Math.ceil(board.tiles.length / board.columns) }, (_, row) => row)
        .some((row) => new Set(board.tiles.filter((tile, index) =>
            tile.state === 'hidden' && Math.floor(index / board.columns) === row
        ).map((tile) => tile.pairKey)).size > 1));
};

export const canShuffleBoard = (run: RunState): boolean => {
    const board = run.board;
    return (
        run.status === 'playing' &&
        board != null &&
        hasClearFlipState(run) &&
        !run.activeContract?.noShuffle &&
        runNonNegativeInteger(run.shuffleCharges) > 0 &&
        countFullyHiddenPairs(board) >= 2 &&
        (!(run.runRulesVersion >= 50 && run.weakerShuffleMode === 'rows_only') ||
            hasUsefulShuffleRow(run))
    );
};

export const canRegionShuffle = (run: RunState): boolean => {
    const board = run.board;
    return (
        run.status === 'playing' &&
        board != null &&
        hasClearFlipState(run) &&
        !run.activeContract?.noShuffle &&
        runNonNegativeInteger(run.regionShuffleCharges) > 0 &&
        countFullyHiddenPairs(board) >= 1 &&
        (!(run.runRulesVersion >= 50) || hasUsefulShuffleRow(run))
    );
};

/** Row shuffle needs hidden cards from two different pairs to change what the player remembers. */
export const canRegionShuffleRow = (run: RunState, rowIndex: number): boolean => {
    if (!canRegionShuffle(run) || !run.board) {
        return false;
    }
    const cols = run.board.columns;
    let hidden = 0;
    const keys = new Set<string>();
    run.board.tiles.forEach((tile, index) => {
        if (tile.state === 'hidden' && Math.floor(index / cols) === rowIndex) {
            hidden += 1;
            keys.add(tile.pairKey);
        }
    });
    return hidden >= 2 && (!(run.runRulesVersion >= 50) || keys.size > 1);
};

export const canSwapHiddenTiles = (run: RunState, firstTileId: string, secondTileId: string): boolean => {
    if (
        run.status !== 'playing' ||
        !run.board ||
        !hasClearFlipState(run) ||
        run.activeContract?.noShuffle ||
        firstTileId === secondTileId ||
        runNonNegativeInteger(run.regionShuffleCharges) <= 0
    ) {
        return false;
    }
    const firstTile = run.board.tiles.find((tile) => tile.id === firstTileId);
    const secondTile = run.board.tiles.find((tile) => tile.id === secondTileId);
    return Boolean(firstTile && secondTile && firstTile.state === 'hidden' && secondTile.state === 'hidden');
};
