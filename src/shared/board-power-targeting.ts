import type { BoardState } from './contracts';

/** Peek can target any still-hidden tile that has not already been peek-revealed this floor. */
export const tileIsPeekEligiblePreview = (
    board: BoardState,
    peekRevealedTileIds: readonly string[],
    tileId: string
): boolean => {
    const tile = board.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== 'hidden') {
        return false;
    }
    return !peekRevealedTileIds.includes(tileId);
};

export const collectPeekEligibleTileIds = (
    board: BoardState,
    peekRevealedTileIds: readonly string[]
): Set<string> => {
    const eligible = new Set<string>();
    for (const tile of board.tiles) {
        if (tileIsPeekEligiblePreview(board, peekRevealedTileIds, tile.id)) {
            eligible.add(tile.id);
        }
    }
    return eligible;
};

