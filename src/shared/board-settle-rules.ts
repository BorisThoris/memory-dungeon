import type { BoardState, Tile } from './contracts';
import { getSafeBoardColumns, getSafeBoardRows } from './board-grid-dimensions';

/**
 * The settle: what is left falls toward the middle.
 *
 * Every cascade game this one borrows from has a gravity. Tetris and Bejeweled fall to the bottom,
 * Puzzle Bobble hangs from the ceiling; here the attractor is the **centre of the board**, so a
 * floor plays like sand collecting in a globe rather than a grid slowly going hollow. Cards a match
 * or a break took are gone, and the survivors close the gap.
 *
 * Why it matters to the loop and not only to the look: every adjacency rule in the game - the pop's
 * reach, the ripple, the severance drop, the aim guide - reads the grid as it stands. A board that
 * never moves is a board whose clumps only ever shrink, so the cascade decays toward nothing as the
 * floor empties. A board that closes its gaps keeps making new neighbours, which is what lets a
 * late-floor match still find something worth taking.
 *
 * The rule is one move repeated: **take the closest gap-and-card pair on the board and put the card
 * in the gap**, where a card may only ever move to a cell nearer the middle than the one it is in.
 * Repeat until no card is further out than an empty cell. Because it always picks the closest pair
 * on the whole board, a card moves as short a distance as the settle allows rather than being flung
 * across the grid - a player who remembers roughly where a card was is not lied to, and the hole
 * bubbles outward the way a gap under sand does.
 *
 * Three properties the tests pin:
 *
 * - **Nothing ever moves outward.** Each move ends strictly nearer the middle than it began, which
 *   is also why this terminates: the board's total distance-to-centre falls with every move.
 * - **It finishes the job in one call.** Settling an already settled board changes nothing, so the
 *   board a turn hands on is the board the next turn's adjacency rules read.
 * - **It is a pure, deterministic function of the board.** Same board in, same board out, so a
 *   replayed journal lands on the same grid and the simulations measure a real game.
 */

/** A card still in play. Matched and broken cards are the gaps the settle closes. */
export const tileIsSettleLive = (tile: Tile): boolean => tile.state === 'hidden' || tile.state === 'flipped';

/** Squared distance from a cell to the board's centre point; squared because only the order matters. */
const distanceToCentre = (index: number, columns: number, rows: number): number => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const centreColumn = (columns - 1) / 2;
    const centreRow = (rows - 1) / 2;
    return (column - centreColumn) ** 2 + (row - centreRow) ** 2;
};

/** How far a card has to travel across the grid to reach a cell, counted in steps, not diagonals. */
const gridSteps = (from: number, to: number, columns: number): number =>
    Math.abs((from % columns) - (to % columns)) + Math.abs(Math.floor(from / columns) - Math.floor(to / columns));

interface SettleMove {
    gap: number;
    card: number;
    steps: number;
}

/**
 * The closest gap-and-card pair left on the board, or null once every card is packed.
 *
 * Ties are broken so the result never depends on array order: the gap nearest the middle first
 * (that is the one the board most wants filled), then the card furthest out (that is the one with
 * the least reason to stay), then the lower cell index so two identical candidates never race.
 */
const findClosestSettleMove = (gaps: number[], cards: number[], distances: number[], columns: number): SettleMove | null => {
    let best: SettleMove | null = null;
    for (const gap of gaps) {
        const gapDistance = distances[gap]!;
        for (const card of cards) {
            if (distances[card]! <= gapDistance) continue;
            const steps = gridSteps(card, gap, columns);
            if (best === null) {
                best = { gap, card, steps };
                continue;
            }
            if (steps !== best.steps) {
                if (steps < best.steps) best = { gap, card, steps };
                continue;
            }
            const bestGapDistance = distances[best.gap]!;
            if (gapDistance !== bestGapDistance) {
                if (gapDistance < bestGapDistance) best = { gap, card, steps };
                continue;
            }
            const bestCardDistance = distances[best.card]!;
            if (distances[card]! !== bestCardDistance) {
                if (distances[card]! > bestCardDistance) best = { gap, card, steps };
                continue;
            }
            if (gap !== best.gap) {
                if (gap < best.gap) best = { gap, card, steps };
                continue;
            }
            if (card < best.card) best = { gap, card, steps };
        }
    }
    return best;
};

/** Settle the board: the survivors pack around the middle and the gaps rise to the outside. */
export const settleBoardTowardCentre = (board: BoardState): BoardState => {
    const total = board.tiles.length;
    const columns = getSafeBoardColumns(board);
    if (total === 0 || columns <= 0) {
        return board;
    }
    const rows = getSafeBoardRows(board, columns);
    const tiles = [...board.tiles];
    const distances = tiles.map((_, index) => distanceToCentre(index, columns, rows));

    const gaps: number[] = [];
    const cards: number[] = [];
    tiles.forEach((tile, index) => {
        if (tileIsSettleLive(tile)) cards.push(index);
        else gaps.push(index);
    });
    if (gaps.length === 0 || cards.length === 0) {
        return board;
    }

    // Every move strictly lowers the board's total distance-to-centre, and a card that hops twice
    // is nearer the middle each time, so this always runs out of moves. The bound is only a guard
    // against a metric that ever stops being strictly decreasing.
    const moveCeiling = total * total;
    for (let step = 0; step < moveCeiling; step += 1) {
        const move = findClosestSettleMove(gaps, cards, distances, columns);
        if (move === null) break;
        const card = tiles[move.card]!;
        tiles[move.card] = tiles[move.gap]!;
        tiles[move.gap] = card;
        gaps[gaps.indexOf(move.gap)] = move.card;
        cards[cards.indexOf(move.card)] = move.gap;
    }

    return { ...board, tiles };
};
