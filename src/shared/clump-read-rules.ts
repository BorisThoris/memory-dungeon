import type { BoardState, RunState, Tile, TileSuit } from './contracts';
import { findSuitRegion, resolveChunkBreak } from './chunk-break-rules';
import { getChainTier, nextChainTierAt, type ChainTier } from './chain-tier-rules';

/**
 * The clump read: what a match on this tile would take, before the player commits to it.
 *
 * A bubble shooter draws the aim line; here the plan is the suits on the backs, and nothing said
 * how far a break there would reach. Until Gen 185 this walked the whole connected region and
 * reported the Sharp answer at every tier - so the one affordance meant to teach the ladder was
 * the single place the ladder was invisible (thesis §30.2). It now previews by running the real
 * rule at the real chain, so what the guide promises is what the turn does by construction rather
 * than by a second implementation of the reach.
 *
 * Read on focus, under the pointer, on the first flipped tile, and by the screen reader.
 */
export interface ClumpReadContext {
    /**
     * The chain the match would complete: the run's momentum plus this match, the same expression
     * `turn-match-board-resolution-rules.ts` resolves the live break with.
     */
    chain: number;
    /** Sticky toffee makes the clump stick diagonally, so the preview has to know the resident. */
    run: Pick<RunState, 'floorCurioId'>;
}

export interface ClumpReadTierPreview {
    tier: ChainTier;
    /** Tile ids the break takes, the matched pair itself excluded. */
    tileIds: string[];
    /** Pairs it takes with it, the matched pair itself excluded. */
    pairs: number;
}

export interface ClumpReadNextTierPreview extends ClumpReadTierPreview {
    /** What the next rung takes that this one does not: the ghost the board draws. */
    addedTileIds: string[];
    /** Pairs the next rung adds. Zero happens - a rung that reaches no further here is worth saying. */
    addedPairs: number;
}

export interface ClumpRead {
    suit: TileSuit;
    /** Hidden tiles in the connected same-suit region, the read tile included. */
    size: number;
    /** Every tile id in the region, for the board to shade behind the break. */
    tileIds: string[];
    /** What a match here takes now, at the tier this match would land at. */
    now: ClumpReadTierPreview;
    /** The next rung and what it adds; null at Fever, where there is no next rung. */
    next: ClumpReadNextTierPreview | null;
}

/** What a match on this pair takes at `chain`, read off the real break rule. */
const previewBreakAt = (
    board: BoardState,
    matchedTileIds: readonly string[],
    chain: number,
    context: ClumpReadContext
): ClumpReadTierPreview => {
    const tier = getChainTier(chain, board.pairCount);
    if (matchedTileIds.length !== 2) {
        // A singleton has no match to preview: the wild joker and the decoy never pair off.
        return { tier, tileIds: [], pairs: 0 };
    }
    const broke = resolveChunkBreak({ board, run: context.run, matchedTileIds, chain });
    return { tier, tileIds: broke.brokenTileIds, pairs: broke.brokenPairKeys.length };
};

export const getClumpRead = (board: BoardState, tileId: string, context: ClumpReadContext): ClumpRead | null => {
    const seed = board.tiles.find((tile) => tile.id === tileId);
    // A flipped tile still stands in its clump: the break fires when its partner turns up, so
    // the read is worth more after the first flip, not less. Matched and removed tiles are gone.
    if (!seed || (seed.state !== 'hidden' && seed.state !== 'flipped') || !seed.suit) {
        return null;
    }
    const diagonal = context.run.floorCurioId === 'sticky_toffee';
    const region = findSuitRegion(board, [tileId], Number.POSITIVE_INFINITY, { diagonal }).map(
        (index) => board.tiles[index]!
    );
    const clump: Tile[] = [seed, ...region];
    const matchedTileIds = board.tiles.filter((tile) => tile.pairKey === seed.pairKey).map((tile) => tile.id);

    const now = previewBreakAt(board, matchedTileIds, context.chain, context);
    const nextRung = nextChainTierAt(context.chain, board.pairCount);
    const nextPreview = nextRung == null ? null : previewBreakAt(board, matchedTileIds, nextRung, context);
    const takenNow = new Set(now.tileIds);
    const next =
        nextPreview == null
            ? null
            : {
                  ...nextPreview,
                  addedTileIds: nextPreview.tileIds.filter((id) => !takenNow.has(id)),
                  addedPairs: Math.max(0, nextPreview.pairs - now.pairs)
              };

    return {
        suit: seed.suit,
        size: clump.length,
        tileIds: clump.map((tile) => tile.id),
        now,
        next
    };
};
