import type { BoardState } from './contracts';
import type { RestlessSwap } from './restless-floor-rules';

/**
 * The looking glass: every third match, the board turns over in a mirror.
 *
 * The other movers make knowledge go stale. The restless floor moves cards the player may never
 * have looked at, the skittish hall nudges the two they just missed, the magpie puts a cleared pair
 * back. This one keeps every fact true and transforms all of them at once: the card that was in the
 * top-left corner is in the top-right corner now, and so is everything else, reflected. It is a
 * memory problem with an exact answer - the player who can hold the board and turn it in their head
 * loses nothing - and that is what makes it the boss floor's room rather than a dice roll.
 *
 * The clock is the player's own matches, so a slow floor mirrors as often as a fast one, and the
 * player always knows when it is coming: the third, the sixth, the ninth match.
 *
 * The board mirrors across its long side, so a phone's tall board turns top to bottom rather than
 * swapping two columns. Pinned cards stay where they are, on both sides of a swap - pinning is the
 * counter-play, paid for, as on the restless floor and in the skittish hall. The pair just matched
 * stays too: it is still on the board, burning away where it was taken. Cells cleared earlier turn
 * with the rest, so the reflection is exact. A row or column with a cell missing at the end (a board
 * whose last row is short) mirrors within the cells it has.
 *
 * It only reorders `board.tiles`; the Colossus is not on the grid and never meets it.
 */

/** The board mirrors on every this-many-th match of the floor. */
export const LOOKING_GLASS_EVERY_MATCHES = 3;

export type LookingGlassAxis = 'left_right' | 'top_bottom';

/** Which way the board turns: across its long side, so a tall board turns top to bottom. */
export const lookingGlassAxis = (board: Pick<BoardState, 'columns' | 'rows'>): LookingGlassAxis =>
    board.columns >= board.rows ? 'left_right' : 'top_bottom';

/** Whether the match that brings the floor to `matchesAfter` matches turns the board. */
export const lookingGlassTurnsOnMatch = (matchesAfter: number): boolean =>
    matchesAfter > 0 && Math.floor(matchesAfter) % LOOKING_GLASS_EVERY_MATCHES === 0;

/** Matches until the board next turns, counting the one that turns it (3, 2, 1, then 3 again): the HUD's clock. */
export const lookingGlassMatchesUntilTurn = (matchesSoFar: number): number =>
    LOOKING_GLASS_EVERY_MATCHES - (Math.max(0, Math.floor(matchesSoFar)) % LOOKING_GLASS_EVERY_MATCHES);

/**
 * The swaps that mirror the board: each cell trades with its reflection, unless either holds a
 * card that stays (pinned, or in `stayTileIds`). Applied with `applyRestlessDrift`.
 */
export const lookingGlassSwaps = (
    board: Pick<BoardState, 'columns' | 'rows' | 'tiles'>,
    pinnedTileIds: readonly string[],
    stayTileIds: readonly string[] = []
): RestlessSwap[] => {
    const stays = new Set([...pinnedTileIds, ...stayTileIds]);
    const count = board.tiles.length;
    const columns = Math.max(1, Math.floor(board.columns));
    const lines: number[][] = [];
    if (lookingGlassAxis(board) === 'left_right') {
        for (let start = 0; start < count; start += columns) {
            const line: number[] = [];
            for (let index = start; index < Math.min(count, start + columns); index += 1) line.push(index);
            lines.push(line);
        }
    } else {
        for (let column = 0; column < columns; column += 1) {
            const line: number[] = [];
            for (let index = column; index < count; index += columns) line.push(index);
            lines.push(line);
        }
    }
    const swaps: RestlessSwap[] = [];
    for (const line of lines) {
        for (let i = 0, j = line.length - 1; i < j; i += 1, j -= 1) {
            const a = line[i]!;
            const b = line[j]!;
            if (stays.has(board.tiles[a]!.id) || stays.has(board.tiles[b]!.id)) continue;
            swaps.push({ a, b });
        }
    }
    return swaps;
};
