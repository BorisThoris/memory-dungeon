import type { BoardState } from '../../shared/contracts';

/**
 * Which cards just rose from the deck beneath (`board-layers-rules.ts`, DGE-017): a card whose id was
 * under a cell on the last board and is on top of one now. The scene notes them as the board changes
 * (`TileBoardScene`) and each card's frame takes its own once (`tileBoardFrameAdvance.ts`), to rise.
 */
const risen = new Set<string>();

/** How far below and right of its cell a card beneath shows its edge (`LayerEdges.tsx`'s offset). */
export const RISE_FROM_OFFSET = 0.06;

export const noteRisenCards = (before: Pick<BoardState, 'beneath'> | null | undefined, after: Pick<BoardState, 'tiles'>): void => {
    const under = new Set((before?.beneath ?? []).flatMap((card) => (card ? [card.id] : [])));
    if (under.size === 0) return;
    for (const tile of after.tiles) if (under.has(tile.id)) risen.add(tile.id);
};

/** Whether this card has just risen; asking takes it, so it rises once. */
export const takeRisen = (tileId: string): boolean => risen.delete(tileId);
