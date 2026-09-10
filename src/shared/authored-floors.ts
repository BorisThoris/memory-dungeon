import type { Tile, TileSuit } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The authored floors.
 *
 * A generated floor is a board of pairs dealt at random, and the chunk break decides what a match
 * does to the board around it (`chunk-break-rules.ts`). That loop has three rules a new player has
 * to meet - a match pops what it is touching, a pop stops at a colour boundary, and a pair pulled
 * apart is yours to remember - and a procedural deal makes each of them *likely* on the first
 * floors, not certain. So the grid and the suit of every cell are written here once and are the
 * same for everyone; what the symbols are and which pair lands where still come from the run seed.
 * Thesis §51.
 *
 * **Gen 205 redrew all three, because they were the most arranged boards in the game.**
 *
 * These are the first boards anyone sees, and every one of them was solid colour blocks. Measured
 * as the share of a cell's orthogonal neighbours sharing its suit: floor 1 read 0.800 - two 2x2
 * blocks - floor 2 0.529 as three bands of four, floor 3 0.600. A shuffle of the same tiles reads
 * 0.430, 0.273 and 0.296. Gen 204 had just finished making the procedural deal read like a shuffle;
 * these three boards still announced themselves as drawn by hand.
 *
 * Each was re-derived by exhaustive search over every arrangement that satisfies its lesson, and
 * the one taken is the one whose same-suit neighbour rate sits closest to what a shuffle of the
 * same tiles gives: 0.400, 0.294, 0.300. **Closest to chance, not lowest.** The lowest is a
 * checkerboard - floor 1 has two valid arrangements reading 0.000 - and a checkerboard is the same
 * lie as a block, told backwards; `mixMaxRunForSuits` exists because Gen 204 made exactly that
 * mistake on two-suit boards. No suit forms a run longer than two here, which is what a shuffle of
 * this size usually does.
 *
 * What the layouts buy is unchanged, and it is worth stating in numbers, because the honest answer
 * to "does the deal already do this?" is no:
 *
 * - Floor 1 is four pairs, and `suitCountForPairs(4)` is **one suit**: dealt ordinarily it is a
 *   board of one colour, which is a board with no map on it (Gen 193). Given two suits, only
 *   **0.371** of the arrangements of eight cells pop from every pair.
 * - At floor 2's and floor 3's sizes an ordinary deal pops every match on 0.757 and 0.707 of seeds.
 *
 * The lesson each carries is a property of the shape rather than of the blocks:
 *
 * Floor 1 teaches the pop and the boundary. Four pairs, two suits, 4x2. Whichever pair the seed
 * puts where, matching one leaves the suit's other pair whole inside one bounded wave, so the first
 * match anyone makes pops something - and it stops at the other colour.
 *
 * Floor 2 says it again wider. Six pairs, three suits, 4x3, interleaved: every cell of a suit is
 * within `BOUNDED_BREAK_REACH` steps of every other *through that suit*, corners included, so
 * whatever the player matches first, the wave holds both halves of the suit's other pair. The
 * boundary is now a thing to read rather than a line drawn across the board.
 *
 * Floor 3 teaches the split pair. Seven pairs, three suits on a 5x3, and one Ember pair pulled
 * apart: five Ember cells that all reach each other, and one - cell 4, the far corner - with no
 * Ember touching it at all, so no wave of any tier can take it. Its partner sits in the clump and
 * is washed over by every break that happens there. The pair leaves when the player remembers it,
 * or when the severance drop takes the suit's last pair; nothing else takes it.
 */
export const AUTHORED_FLOOR_LAST_LEVEL = 3;

export const isAuthoredFloor = (level: number): boolean =>
    Number.isInteger(level) && level >= 1 && level <= AUTHORED_FLOOR_LAST_LEVEL;

export interface AuthoredFloorLayout {
    readonly level: number;
    readonly pairs: number;
    readonly columns: number;
    readonly rows: number;
    /** The suit of every cell, row-major; `pairs * 2` entries. */
    readonly cells: readonly TileSuit[];
    /** The two cells the split pair occupies, or null on a floor with no split pair. */
    readonly splitCells: readonly [number, number] | null;
}

const E: TileSuit = 'ember';
const T: TileSuit = 'tide';
const M: TileSuit = 'moss';

/*
 * Two suits of four, each a pair of dominoes across the diagonal. Every cell of a suit reaches
 * every other within BOUNDED_BREAK_REACH walking corners through that suit, so whichever two cells
 * the seed makes a pair, matching it leaves the other pair whole inside the wave. Same-suit
 * orthogonal neighbours 0.400 against the 0.430 a shuffle gives, down from 0.800 as two blocks.
 */
const FLOOR_ONE: AuthoredFloorLayout = {
    level: 1,
    pairs: 4,
    columns: 4,
    rows: 2,
    cells: [
        E, E, T, T,
        T, T, E, E
    ],
    splitCells: null
};

/*
 * Three suits of four, interleaved, no suit touching itself more than twice. Each suit's four cells
 * reach each other the same way, so a match anywhere pops that suit's other pair and nothing else.
 * Same-suit orthogonal neighbours 0.294 against a shuffle's 0.273, down from 0.529 as bands.
 */
const FLOOR_TWO: AuthoredFloorLayout = {
    level: 2,
    pairs: 6,
    columns: 4,
    rows: 3,
    cells: [
        E, T, T, M,
        E, M, M, T,
        M, E, E, T
    ],
    splitCells: null
};

/*
 * Ember takes six cells. Five of them - 0, 1, 5, 11, 12 - reach each other through Ember; the
 * sixth, cell 4 in the far corner, has no Ember cell touching it at all, orthogonally or at a
 * corner, so no wave reaches it at any tier. Cell 0 is its partner, sitting in the clump where
 * every break there washes over it. Tide and Moss take four each, each set within reach of itself.
 * Same-suit orthogonal neighbours 0.300 against a shuffle's 0.296, down from 0.600.
 */
const FLOOR_THREE: AuthoredFloorLayout = {
    level: 3,
    pairs: 7,
    columns: 5,
    rows: 3,
    cells: [
        E, E, T, M, E,
        E, M, M, T, T,
        M, E, E, T
    ],
    splitCells: [0, 4]
};

const LAYOUTS: readonly AuthoredFloorLayout[] = [FLOOR_ONE, FLOOR_TWO, FLOOR_THREE];

export const authoredFloorLayout = (level: number): AuthoredFloorLayout | null =>
    LAYOUTS.find((layout) => layout.level === level) ?? null;

export interface LayAuthoredFloorOptions {
    /**
     * Pairs that must not be the split pair: the cursed pair, which a break never takes, and a
     * findable pair, which a break claims at most one of. Either in the split slot would make the
     * floor-3 reach a matter of luck again.
     */
    reservedPairKeys?: readonly string[];
}

/**
 * Lays the tiles of a generated floor into an authored layout.
 *
 * Every real pair takes the suit of the cells it is laid into, so both halves share it. Pairs are
 * assigned to suits in the order the seed shuffled them, and tiles fill their suit's cells in
 * that same shuffled order, so the seed decides which pair sits where and no new randomness is
 * introduced. Singletons the floor carries (a wild) are not part of the shape: they go
 * after the authored cells, in a trailing row.
 *
 * Returns null when the tiles do not fit the layout - a different pair count, or a pair with
 * only one half - so the caller can deal the floor procedurally instead of laying it wrong.
 */
export const layAuthoredFloorTiles = (
    tiles: readonly Tile[],
    layout: AuthoredFloorLayout,
    options: LayAuthoredFloorOptions = {}
): Tile[] | null => {
    const halvesByKey = new Map<string, Tile[]>();
    const singletons: Tile[] = [];
    const pairOrder: string[] = [];
    for (const tile of tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) {
            singletons.push(tile);
            continue;
        }
        if (!halvesByKey.has(tile.pairKey)) pairOrder.push(tile.pairKey);
        halvesByKey.set(tile.pairKey, [...(halvesByKey.get(tile.pairKey) ?? []), tile]);
    }
    if (pairOrder.length !== layout.pairs || [...halvesByKey.values()].some((halves) => halves.length !== 2)) {
        return null;
    }
    if (layout.cells.length !== layout.pairs * 2) {
        return null;
    }

    // Which cells each suit still has to fill, in row order; the split cells are set aside.
    const splitCells = layout.splitCells ? [...layout.splitCells] : [];
    const freeCellsBySuit = new Map<TileSuit, number[]>();
    layout.cells.forEach((suit, cell) => {
        if (splitCells.includes(cell)) return;
        freeCellsBySuit.set(suit, [...(freeCellsBySuit.get(suit) ?? []), cell]);
    });

    const suitByPairKey = new Map<string, TileSuit>();
    const cellsByPairKey = new Map<string, number[]>();
    let remaining = [...pairOrder];
    if (layout.splitCells) {
        const reserved = new Set(options.reservedPairKeys ?? []);
        const splitKey = remaining.find((key) => !reserved.has(key)) ?? remaining[0]!;
        remaining = remaining.filter((key) => key !== splitKey);
        cellsByPairKey.set(splitKey, [...layout.splitCells]);
        suitByPairKey.set(splitKey, layout.cells[layout.splitCells[0]]!);
    }
    // Each suit takes the next pairs in seed order until its cells are spoken for.
    for (const [suit, cells] of freeCellsBySuit) {
        const pairsForSuit = cells.length / 2;
        for (const key of remaining.splice(0, pairsForSuit)) {
            suitByPairKey.set(key, suit);
        }
    }
    if (remaining.length > 0) {
        return null;
    }

    const placed = new Array<Tile | null>(layout.cells.length).fill(null);
    for (const tile of tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        const suit = suitByPairKey.get(tile.pairKey)!;
        const own = cellsByPairKey.get(tile.pairKey);
        const cell = own ? own.shift() : freeCellsBySuit.get(suit)?.shift();
        if (cell === undefined) {
            return null;
        }
        placed[cell] = { ...tile, suit };
    }
    if (placed.some((tile) => tile === null)) {
        return null;
    }
    return [...(placed as Tile[]), ...singletons.map((tile) => ({ ...tile, suit: tile.suit ?? layout.cells[0]! }))];
};

/** The split pair on an authored board: the pair sitting in the layout's split cells, if the floor has one. */
export const authoredSplitPairKey = (
    tiles: readonly Tile[],
    layout: AuthoredFloorLayout
): string | null => (layout.splitCells ? (tiles[layout.splitCells[0]]?.pairKey ?? null) : null);
