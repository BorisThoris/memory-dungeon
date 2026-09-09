import type { Tile, TileSuit } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The three authored floors.
 *
 * A generated floor is a board of pairs dealt in clumps, and the chunk break decides what a match
 * does to the board around it (`chunk-break-rules.ts`). That loop has three rules a new player has
 * to meet - a match pops what it is touching, a pop stops at a colour boundary, and a chain
 * reaches a partner across the board - and a procedural deal makes each of them *likely* on the
 * first floors, not certain. Measured, a two-pair floor could not pop at all, so the first thing
 * the game showed a player was a match that did nothing.
 *
 * So floors 1 to 3 are authored: the grid, the suit of every cell, and on floor 3 which two cells
 * hold the split pair, are written here once and are the same for everyone. What the symbols are
 * and which pair lands in which cell still come from the run seed, so two runs differ in what is
 * where; the *shape* is fixed, because the shape is what guarantees the lesson. Thesis §51.
 *
 * Floor 1 teaches the pop and the boundary together. Four pairs, two suits, a 4×2 grid: a solid
 * 2×2 of Ember beside a solid 2×2 of Tide, two pairs each. Every cell of a suit is within
 * `BOUNDED_BREAK_REACH` steps of every other, so whatever the player matches first, the wave holds
 * both halves of the suit's other pair and it pops - and it visibly stops at the colour it started
 * in. Two suits from the first board, because a board of one colour is not a board with a map on
 * it, only a field (Gen 193).
 *
 * Floor 2 widens the palette. Six pairs, three suits, a 4×3 grid dealt in bands: Ember across the
 * top, Tide across the middle, Moss across the bottom, two pairs to a band. A row of four holds any
 * two pairs within reach of each other however the seed lays them, so a match anywhere pops, and
 * three bands make the boundary a rule rather than a coincidence of one line.
 *
 * Floor 3 teaches the reach. Seven pairs, three suits on a 5×3 grid, and one Ember pair split: one
 * half inside the Ember clump, the other alone at the far end with nothing but Moss and Tide around
 * it. Below Clean a pair goes only when the wave holds both halves, so the split pair stays whole -
 * and at Clean the wave reaches partners, so the far half flies out of a corner nobody was looking
 * at. The in-clump half sits at the one cell every other clump pair is within two steps of, so the
 * reach is guaranteed from any pair, not most.
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

/* Two solid 2x2 blocks. Every cell of a suit is within two steps of every other, so a match
 * anywhere pops the suit's other pair, and the wave stops dead at the colour boundary. */
const FLOOR_ONE: AuthoredFloorLayout = {
    level: 1,
    pairs: 4,
    columns: 4,
    rows: 2,
    cells: [
        E, E, T, T,
        E, E, T, T
    ],
    splitCells: null
};

/* Three bands. A row of four holds any two pairs within reach of each other however the seed
 * lays them out, so every band pops from any of its pairs. */
const FLOOR_TWO: AuthoredFloorLayout = {
    level: 2,
    pairs: 6,
    columns: 4,
    rows: 3,
    cells: [
        E, E, E, E,
        T, T, T, T,
        M, M, M, M
    ],
    splitCells: null
};

/*
 * Ember is the right-hand column and a step in, plus one cell below; Moss holds the top-left 2x2
 * and Tide the rest. Cell 8 is the Ember centre: every other Ember cell is within two steps of it,
 * so one matched pair cannot stand between a Clean break and the split. Cell 10 is the far half,
 * and its only neighbours are Moss and Tide - three grid steps from the nearest Ember, so no
 * bounded wave reaches it.
 */
const FLOOR_THREE: AuthoredFloorLayout = {
    level: 3,
    pairs: 7,
    columns: 5,
    rows: 3,
    cells: [
        M, M, T, E, E,
        M, M, T, E, E,
        E, T, T, E
    ],
    splitCells: [8, 10]
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
