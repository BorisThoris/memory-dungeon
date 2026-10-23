import type { BoardState } from '../../shared/contracts';

/**
 * The cells whose mask just dropped (`mask-rules.ts`, DGE-016): read off two visible boards in a row, a
 * card now face up whose element differs from the one its back showed. The visible board wears a mask
 * as the card's suit (`player-visible-board.ts`), so the lie and the truth are both on screen to compare.
 */
export const unmaskedCells = (before: Pick<BoardState, 'tiles'> | null | undefined, after: Pick<BoardState, 'tiles'>): number[] => {
    if (!before) return [];
    const was = new Map(before.tiles.map((tile) => [tile.id, tile]));
    return after.tiles.flatMap((tile, cell) => {
        const prior = was.get(tile.id);
        return prior && prior.state === 'hidden' && tile.state !== 'hidden' && tile.suit != null && prior.suit != null && prior.suit !== tile.suit ? [cell] : [];
    });
};
