import type { BoardState, Tile } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * The restless floor: the one mutator that keeps changing the board *while* it is being played.
 *
 * Every other mutator is decided before the first flip - a shorter look, a cooler face, a bird
 * that waits for a miss. This one iterates on a clock the player is winding themselves: every
 * third resolved turn, match or miss, hidden cards trade places. And it escalates: the first
 * drift moves one pair of cards, the second two, the third and every one after it three. A floor
 * that is cleared briskly barely moves; a floor the player dawdles on turns under them, so the
 * pressure is on pace rather than on luck, and the counter-play is real - clear what you know
 * before the floor takes it back.
 *
 * It only moves cards that are still face down. Matched pairs stay matched, a flipped card stays
 * where it was flipped, and a pinned card is left alone: the pin is what the player paid for.
 * The backs carry the suits, so a drift the player watches is visible - two backs of different
 * suits change colour - and a drift they blinked through is announced.
 */

/** Resolved turns between drifts. The third turn, not the first: the first two are a warning. */
export const RESTLESS_TURN_INTERVAL = 3;
/** Cards-swapped-per-drift climbs one per drift up to this many. */
export const RESTLESS_MAX_SWAPS_PER_DRIFT = 3;

export interface RestlessSwap {
    /** Board indices of the two hidden cards that trade places. */
    readonly a: number;
    readonly b: number;
}

export interface RestlessDrift {
    readonly kind: 'drift' | 'nothing_to_move' | 'not_yet';
    /** The swaps to apply, in order; empty unless `kind` is `drift`. */
    readonly swaps: readonly RestlessSwap[];
}

/** True on the turns the floor shifts. */
export const isRestlessDriftTurn = (turnsThisFloor: number): boolean =>
    Number.isFinite(turnsThisFloor) && turnsThisFloor > 0 && turnsThisFloor % RESTLESS_TURN_INTERVAL === 0;

/** How many pairs of cards the n-th drift of a floor moves (`driftsBefore` is how many already happened). */
export const restlessSwapCountForDrift = (driftsBefore: number): number =>
    Math.min(RESTLESS_MAX_SWAPS_PER_DRIFT, Math.max(0, Math.floor(driftsBefore)) + 1);

const movableIndices = (board: BoardState, pinnedTileIds: readonly string[]): number[] => {
    const pinned = new Set(pinnedTileIds);
    return board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.state === 'hidden' && !pinned.has(tile.id))
        .map(({ index }) => index);
};

/**
 * What the floor does on this turn, decided from the run's own seed so a replay drifts the same way.
 *
 * `turnsThisFloor` is the count *after* the turn that just resolved.
 */
export const resolveRestlessDrift = ({
    board,
    turnsThisFloor,
    driftsBefore,
    pinnedTileIds,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    turnsThisFloor: number;
    driftsBefore: number;
    pinnedTileIds: readonly string[];
    runSeed: number;
    rulesVersion: number;
}): RestlessDrift => {
    if (!isRestlessDriftTurn(turnsThisFloor)) {
        return { kind: 'not_yet', swaps: [] };
    }
    const pool = movableIndices(board, pinnedTileIds);
    if (pool.length < 2) {
        return { kind: 'nothing_to_move', swaps: [] };
    }

    const rng = createMulberry32(
        hashStringToSeed(`restless:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`)
    );
    const wanted = restlessSwapCountForDrift(driftsBefore);
    const swaps: RestlessSwap[] = [];
    // Each card moves at most once per drift, so a swap is never undone by the next one.
    while (swaps.length < wanted && pool.length >= 2) {
        const a = pool.splice(pickRngIndex(rng, pool.length), 1)[0];
        if (a == null) {
            break;
        }
        const aTile = board.tiles[a];
        // A card trading places with its own partner has not moved, as far as the player can tell.
        const partners = pool.filter((index) => board.tiles[index]?.pairKey !== aTile?.pairKey);
        const candidates = partners.length > 0 ? partners : pool;
        const b = candidates[pickRngIndex(rng, candidates.length)];
        if (b == null) {
            break;
        }
        pool.splice(pool.indexOf(b), 1);
        swaps.push({ a, b });
    }

    return swaps.length > 0 ? { kind: 'drift', swaps } : { kind: 'nothing_to_move', swaps: [] };
};

/** Applies the drift: the named cards trade cells and nothing else about the board changes. */
export const applyRestlessDrift = (board: BoardState, swaps: readonly RestlessSwap[]): BoardState => {
    if (swaps.length === 0) {
        return board;
    }
    const tiles: Tile[] = [...board.tiles];
    for (const { a, b } of swaps) {
        const tileA = tiles[a];
        const tileB = tiles[b];
        if (!tileA || !tileB || a === b) {
            continue;
        }
        tiles[a] = tileB;
        tiles[b] = tileA;
    }
    return { ...board, tiles };
};
