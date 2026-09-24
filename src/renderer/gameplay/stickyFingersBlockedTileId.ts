/**
 * The tile that cannot open the next turn: exactly the one `flipTile` refuses as a first card
 * (`stickyBlockIndex`, with nothing face up yet).
 *
 * Two things set that lock - the sticky-fingers mutator after a match, and a clean Stasis match on
 * any floor that deals traits. This used to answer only when sticky fingers was active, so a Stasis
 * lock refused the tap with nothing on the board to say why: the card simply did not turn (Gen 263,
 * found when the playtest's player stalled on it). The marker now follows the rule, not the mutator.
 */
export const getStickyBlockedTileId = (params: {
    flippedTileIds: readonly string[];
    stickyBlockIndex: number | null;
    tiles: readonly { id: string }[];
}): string | null => {
    if (params.flippedTileIds.length !== 0) {
        return null;
    }
    if (params.stickyBlockIndex == null) {
        return null;
    }
    const tile = params.tiles[params.stickyBlockIndex];
    return tile?.id ?? null;
};
