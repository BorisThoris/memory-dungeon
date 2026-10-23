import type { BoardState } from '../../shared/contracts';

/**
 * Which cards just rose from the deck beneath (`board-layers-rules.ts`, DGE-017): a card whose id was
 * under a cell on the last board and is on top of one now - and a Sleeper that woke (DGE-020). The scene notes them as the board changes
 * (`TileBoardScene`) and each card's frame takes its own once (`tileBoardFrameAdvance.ts`), to rise.
 */
const risen = new Set<string>();

/** How far below and right of its cell a card beneath shows its edge (`LayerEdges.tsx`'s offset). */
export const RISE_FROM_OFFSET = 0.06;

export const noteRisenCards = (before: Pick<BoardState, 'beneath' | 'tiles'> | null | undefined, after: Pick<BoardState, 'tiles'>): void => {
    const under = new Set((before?.beneath ?? []).flatMap((card) => (card ? [card.id] : [])));
    // A Sleeper waking (`sleeper-rules.ts`, DGE-020) is a card that was gone and is face down again, in
    // another cell: it climbs into its cell the same way. No other card keeps its id through a return.
    const gone = new Set((before?.tiles ?? []).flatMap((tile) => (tile.state === 'matched' || tile.state === 'removed' ? [tile.id] : [])));
    if (under.size === 0 && gone.size === 0) return;
    for (const tile of after.tiles) if (under.has(tile.id) || (gone.has(tile.id) && tile.state === 'hidden')) risen.add(tile.id);
};

/** Whether this card has just risen; asking takes it, so it rises once. */
export const takeRisen = (tileId: string): boolean => risen.delete(tileId);
