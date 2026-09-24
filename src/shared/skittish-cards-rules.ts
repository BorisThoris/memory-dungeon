import type { BoardState } from './contracts';
import { applyRestlessDrift, type RestlessSwap } from './restless-floor-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * Skittish cards: the cards you miss on flinch.
 *
 * When a turn misses, each of the two cards the player just saw - now face down again - trades
 * places with one face-down card beside it (up, down, left or right). So a miss costs more than a
 * miss: the two faces it showed are exactly the two facts it moved. But it moves them one step and
 * no further, so the fact is damaged rather than destroyed - the player knows the card is next to
 * where they saw it, and has to work out which way it went. That is a memory problem, not a dice
 * roll, and it is the difference between this and the restless floor, which moves cards the
 * player may never have looked at.
 *
 * The clock is the player's own misses: a floor played cleanly never flinches. Pinned cards are
 * left alone on both sides of a swap - pinning is the counter-play, and it is paid for. A card
 * never trades with its own partner (that would look like nothing happened), and each card moves
 * at most once per miss. A missed card with no face-down neighbour stays put.
 */

export interface SkittishFlinch {
    readonly kind: 'flinch' | 'nothing_to_move';
    /** Board indices that trade places, in order; empty unless `kind` is `flinch`. */
    readonly swaps: readonly RestlessSwap[];
}

/** Orthogonal neighbours of a board index on a `columns`-wide grid. */
export const orthogonalNeighbourIndices = (index: number, columns: number, tileCount: number): number[] => {
    const cols = Math.max(1, Math.floor(columns));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const out: number[] = [];
    if (row > 0) out.push(index - cols);
    if (index + cols < tileCount) out.push(index + cols);
    if (col > 0) out.push(index - 1);
    if (col < cols - 1 && index + 1 < tileCount) out.push(index + 1);
    return out;
};

/**
 * Where the two missed cards flinch to, decided from the run's seed and the floor's turn count so
 * a replay flinches the same way. `missedTileIds` are the cards of the miss, already face down.
 */
export const resolveSkittishFlinch = ({
    board,
    missedTileIds,
    pinnedTileIds,
    turnsThisFloor,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    missedTileIds: readonly string[];
    pinnedTileIds: readonly string[];
    turnsThisFloor: number;
    runSeed: number;
    rulesVersion: number;
}): SkittishFlinch => {
    const pinned = new Set(pinnedTileIds);
    const movable = (index: number): boolean => {
        const tile = board.tiles[index];
        return tile != null && tile.state === 'hidden' && !pinned.has(tile.id);
    };
    const rng = createMulberry32(hashStringToSeed(`skittish:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`));
    const moved = new Set<number>();
    const swaps: RestlessSwap[] = [];
    for (const tileId of missedTileIds) {
        const a = board.tiles.findIndex((tile) => tile.id === tileId);
        if (a < 0 || moved.has(a) || !movable(a)) continue;
        const pairKey = board.tiles[a]!.pairKey;
        const neighbours = orthogonalNeighbourIndices(a, board.columns, board.tiles.length).filter(
            (index) => movable(index) && !moved.has(index) && board.tiles[index]!.pairKey !== pairKey
        );
        if (neighbours.length === 0) continue;
        const b = neighbours[pickRngIndex(rng, neighbours.length)]!;
        moved.add(a);
        moved.add(b);
        swaps.push({ a, b });
    }
    return swaps.length > 0 ? { kind: 'flinch', swaps } : { kind: 'nothing_to_move', swaps: [] };
};

/** The flinch applied: the named cards trade cells and nothing else about the board changes. */
export const applySkittishFlinch = (board: BoardState, swaps: readonly RestlessSwap[]): BoardState =>
    applyRestlessDrift(board, swaps);
