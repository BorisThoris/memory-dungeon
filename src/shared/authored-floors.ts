import type { Tile, TileSuit } from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';

/**
 * The authored floors.
 *
 * A generated floor is a board of pairs dealt at random, and the chunk break decides what a match
 * does to the board around it (`chunk-break-rules.ts`). That loop has three rules a new player has
 * to meet - a match pops what it is touching, a pop stops at a colour boundary, and a pair pulled
 * apart is yours to remember - and a procedural deal makes each of them *likely* on the first
 * floors, not certain. Rules 50 keeps those lessons as constraints on a seeded layout, with
 * separated pair halves. The constants below are the historical rules-49 shapes and fallbacks;
 * current runs no longer repeat one colour map on each opening floor. Thesis §51.
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

const distance = (a: number, b: number, columns: number): number =>
    Math.abs(a % columns - b % columns) + Math.abs(Math.floor(a / columns) - Math.floor(b / columns));

const touches = (a: number, b: number, columns: number): boolean =>
    a !== b && Math.abs(a % columns - b % columns) <= 1 &&
    Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) <= 1;

/** From any matched pair, the Clean wave can reach every other cell in two steps. */
const withinOpeningReach = (cells: number[], columns: number): boolean =>
    cells.every((a, index) => cells.slice(index + 1).every((b) => cells.every((target) =>
        [a, b].some((source) => source === target || touches(source, target, columns) ||
            cells.some((via) => touches(source, via, columns) && touches(via, target, columns))))));

/** Keep the opening lessons, but draw their geometry anew for each run. Historical deals stay fixed. */
export const authoredFloorLayout = (
    level: number,
    runSeed?: number,
    rulesVersion = 50
): AuthoredFloorLayout | null => {
    const base = LAYOUTS.find((layout) => layout.level === level) ?? null;
    if (!base || runSeed === undefined || rulesVersion < 50) return base;
    const rng = createMulberry32(hashStringToSeed(`opening-layout:${rulesVersion}:${runSeed}:${level}`));
    // Floor three's isolated half makes valid maps rarer. Bound the work and keep a known-valid
    // separated fallback, so even an unlucky seed receives the lesson without adjacent twins.
    const attempts = level === 3 ? 8192 : level === 2 ? 1024 : 256;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const cells = shuffleWithRng(rng, [...base.cells]);
        let splitCells: [number, number] | null = null;
        let valid = true;
        for (const suit of new Set(cells)) {
            let own = cells.flatMap((s, index) => s === suit ? [index] : []);
            if (base.splitCells && suit === E) {
                const isolated = own.filter((a) => !own.some((b) => touches(a, b, base.columns)));
                if (isolated.length !== 1) { valid = false; break; }
                own = own.filter((cell) => cell !== isolated[0]);
                const near = own.filter((cell) => distance(cell, isolated[0]!, base.columns) >= 3 &&
                    separatedCellPairs(own.filter((other) => other !== cell), base.columns, rng)
                        .every(([a, b]) => !touches(a!, b!, base.columns)));
                if (near.length === 0) { valid = false; break; }
                splitCells = [near[pickRngIndex(rng, near.length)]!, isolated[0]!];
            }
            if (!withinOpeningReach(own, base.columns)) { valid = false; break; }
            const nearCell = splitCells?.[0];
            const free = nearCell !== undefined && suit === E ? own.filter((cell) => cell !== nearCell) : own;
            if (separatedCellPairs(free, base.columns, rng).some(([a, b]) => touches(a!, b!, base.columns))) {
                valid = false; break;
            }
        }
        if (!valid) continue;
        // Reject walls and checkerboards, without prescribing a particular colour pattern.
        let edges = 0;
        let same = 0;
        cells.forEach((suit, a) => {
            for (const b of [a % base.columns < base.columns - 1 ? a + 1 : -1, a + base.columns]) {
                if (b < 0 || b >= cells.length) continue;
                edges += 1;
                if (cells[b] === suit) same += 1;
            }
        });
        if (same / edges < 0.15 || same / edges > 0.55) continue;
        return { ...base, cells, splitCells };
    }
    return level === 3 ? {
        ...base,
        cells: [T, M, E, E, E, M, T, M, T, E, E, M, T, E],
        splitCells: [4, 10]
    } : base;
};

/** Exhaustive matching is tiny here (at most six free cells per suit). Choose randomly among
 * equally good deals, minimizing close pairs across the whole suit instead of trapping the last pair. */
const separatedCellPairs = (cells: readonly number[], columns: number, rng: () => number): number[][] => {
    const arrangements = (free: readonly number[]): number[][][] => {
        if (free.length === 0) return [[]];
        const first = free[0]!;
        return free.slice(1).flatMap((second) => arrangements(free.filter((cell) => cell !== first && cell !== second))
            .map((rest) => [[first, second], ...rest]));
    };
    const candidates = arrangements(cells);
    const cost = (pairs: number[][]): number => pairs.reduce((sum, [a, b]) =>
        sum + (touches(a!, b!, columns) ? 10 : 0) + Math.max(0, 3 - distance(a!, b!, columns)), 0);
    const bestCost = Math.min(...candidates.map(cost));
    const best = candidates.filter((pairs) => cost(pairs) === bestCost);
    return shuffleWithRng(rng, best[pickRngIndex(rng, best.length)]!)
        .map((pair) => shuffleWithRng(rng, pair));
};

export interface LayAuthoredFloorOptions {
    runSeed?: number;
    rulesVersion?: number;
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
 * assigned to suits in the order the seed shuffled them. Rules 50 then chooses separated cell
 * pairings with a dedicated seeded stream; older versions retain their shuffled fill order.
 * Singletons the floor carries (a wild) are not part of the shape: they go
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
    if ([...freeCellsBySuit.values()].some((cells) => cells.length % 2 !== 0)) return null;

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

    if ((options.rulesVersion ?? 49) >= 50) {
        const rng = createMulberry32(hashStringToSeed(`opening-pairs:${options.rulesVersion}:${options.runSeed ?? 0}:${layout.level}`));
        for (const [suit, cells] of freeCellsBySuit) {
            const pairs = separatedCellPairs(cells, layout.columns, rng);
            const keys = shuffleWithRng(rng, [...suitByPairKey.keys()].filter((key) =>
                suitByPairKey.get(key) === suit && !cellsByPairKey.has(key)));
            keys.forEach((key, index) => cellsByPairKey.set(key, pairs[index]!));
        }
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
