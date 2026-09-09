/**
 * The pair-count curve: how many pairs a floor deals.
 *
 * Two regimes, because the first three floors are not on a curve at all. They are authored
 * (`authored-floors.ts`): three pairs on one suit to teach the pop, six on two suits split down
 * the middle to teach the boundary, seven with a split pair to teach the reach. Their sizes are
 * part of the proofs those layouts carry, and a board the layout cannot hold is silently dealt the
 * ordinary way instead - so the curve has to agree with them rather than the other way round.
 * `AUTHORED_FLOOR_PAIRS` is that agreement, and `authored-floors.test.ts` fails if it drifts.
 *
 * From floor 4 the curve takes over, anchored on the last authored floor so there is no step at
 * the seam. Square-root-tempered growth, because memory difficulty is superlinear in board size:
 * every extra pair interferes with every pair already there, so a linear curve reaches the
 * gruelling end within thirty floors.
 *
 * **Gen 191 raised it.** With the settle in (Gen 190) a floor was three turns long: the board
 * packed itself back into a solid block after every break, and eight pairs went in two goes. The
 * cascade had nowhere to happen - the ripple stopped firing entirely - because a reaction needs
 * more board than a match can take. Floor 4 goes from eight pairs to nine, floor 12 from twelve to
 * fourteen, floor 30 from seventeen to twenty, and the ceiling is now reached rather than
 * approached. Thesis §32.2 and G.6b; measured in `docs/BALANCE_NOTES.md`.
 */

/** Floors 1 to 3, whose sizes belong to the authored layouts rather than to the curve. */
export const AUTHORED_FLOOR_PAIRS: readonly number[] = [3, 6, 7];

export const PAIRS_BASE = AUTHORED_FLOOR_PAIRS[AUTHORED_FLOOR_PAIRS.length - 1]!;
export const PAIRS_GROWTH = 2.4;
export const PAIRS_MAX = 24;
export const PAIRS_MIN = 2;

export const pairsForFloor = (level: number): number => {
    const floor = Number.isNaN(level) ? 1 : Math.max(1, Math.floor(level));
    const authored = AUTHORED_FLOOR_PAIRS[floor - 1];
    if (authored != null) {
        return authored;
    }
    const raw = Math.round(PAIRS_BASE + PAIRS_GROWTH * Math.sqrt(floor - AUTHORED_FLOOR_PAIRS.length));
    return Math.min(PAIRS_MAX, Math.max(PAIRS_MIN, raw));
};
