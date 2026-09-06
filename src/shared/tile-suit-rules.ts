import type { BoardState, Tile, TileSuit } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Suits: the layer of the board you can see before you flip anything.
 *
 * A memory board opens as a field of identical backs, and there is nothing on it to plan against
 * — the first few flips are pure exploration. Bubble shooters are legible before the shot:
 * colours are visible, clusters are visible, the plan is visible, and the only uncertainty is in
 * execution. That legibility is what makes a big clear feel *earned* rather than lucky.
 *
 * So every pair gets a suit, both halves share it, and it is painted on the back. The symbol on
 * the front is still the memory challenge; the suit is the map. Suits are dealt in clumps so the
 * board opens with visible regions, and later a chain of correct matches gets to break one of
 * those regions (`chunk-break-rules.ts`). Four suits, each with a rune as well as a colour,
 * because colour alone is not a channel this game trusts (Gen 6, Gen 11).
 *
 * See `docs/CHAIN_CHUNK_FEVER_DESIGN.md` §2.1.
 */
export const TILE_SUITS: readonly TileSuit[] = ['ember', 'tide', 'moss', 'bone'];

export interface TileSuitDefinition {
    readonly id: TileSuit;
    readonly name: string;
    /** One glyph, readable at badge size, distinct from every other suit's without colour. */
    readonly rune: string;
    /** Base colour for the back field; the renderer derives tints from it. */
    readonly hue: string;
    readonly description: string;
}

export const TILE_SUIT_CATALOG: Readonly<Record<TileSuit, TileSuitDefinition>> = {
    ember: {
        id: 'ember',
        name: 'Ember',
        rune: '▲',
        hue: '#e0713c',
        description: 'Warm, restless, and usually in the largest clump on the floor.'
    },
    tide: {
        id: 'tide',
        name: 'Tide',
        rune: '≈',
        hue: '#3f9fd8',
        description: 'Cool and long: Tide clumps tend to run in lines.'
    },
    moss: {
        id: 'moss',
        name: 'Moss',
        rune: '✿',
        hue: '#6fb64a',
        description: 'Patient. Moss sits in corners and waits to be noticed.'
    },
    bone: {
        id: 'bone',
        name: 'Bone',
        rune: '◆',
        hue: '#d8cfb4',
        description: 'Pale and scattered. Bone is the suit that breaks the others up.'
    }
};

export const getTileSuit = (id: TileSuit): TileSuitDefinition => TILE_SUIT_CATALOG[id];

const suitRng = (runSeed: number, level: number, rulesVersion: number, stage: string) =>
    createMulberry32(hashStringToSeed(`suit:${stage}:${runSeed}:${rulesVersion}:${level}`));

/**
 * Gives every pair key one suit, shared by both of its tiles.
 *
 * Suits are dealt round-robin over a shuffled order of pair keys, so the four suits are always
 * within one pair of each other in count. A board where one suit is half the tiles is one where
 * the chunk break stops being a decision — every match is inside the big clump.
 */
export const assignSuitsToTiles = (
    tiles: readonly Tile[],
    runSeed: number,
    level: number,
    rulesVersion: number
): Tile[] => {
    const rng = suitRng(runSeed, level, rulesVersion, 'assign');
    const pairKeys = [...new Set(tiles.map((tile) => tile.pairKey))];
    const dealt = shuffleWithRng(() => rng(), pairKeys);
    const suitByPairKey = new Map<string, TileSuit>();
    dealt.forEach((pairKey, index) => {
        suitByPairKey.set(pairKey, TILE_SUITS[index % TILE_SUITS.length]!);
    });
    return tiles.map((tile) => ({ ...tile, suit: suitByPairKey.get(tile.pairKey) ?? TILE_SUITS[0]! }));
};

const orthogonalNeighbours = (index: number, columns: number, total: number): number[] => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const out: number[] = [];
    if (col > 0) out.push(index - 1);
    if (col < columns - 1 && index + 1 < total) out.push(index + 1);
    if (row > 0) out.push(index - columns);
    if (index + columns < total) out.push(index + columns);
    return out;
};

/**
 * Reorders tiles so that same-suit tiles arrive in clumps.
 *
 * Pinned tiles keep their cell: the dungeon layout plan has already put exits, branches, hazards
 * and rewards where it wants them, and a deal that undid that would be a second layout fighting
 * the first. Only the free cells are dealt.
 *
 * Grows one region per suit from a random free seed cell, each suit claiming a random free
 * neighbour of its own frontier on its turn, jumping to a fresh free cell only when its frontier
 * is exhausted. Every suit gets exactly as many cells as it has unpinned tiles, so the multiset
 * of tiles is untouched — only their order changes. Which tile of a suit lands in which of that
 * suit's cells is shuffled, so the two halves of a pair are not predictably adjacent.
 *
 * Deterministic from the seed. A replay deals the same map.
 */
export const dealTilesInClumps = (
    tiles: readonly Tile[],
    columns: number,
    runSeed: number,
    level: number,
    rulesVersion: number,
    isPinned: (tile: Tile) => boolean = () => false
): Tile[] => {
    const total = tiles.length;
    if (total === 0 || columns <= 0) {
        return [...tiles];
    }
    const rng = suitRng(runSeed, level, rulesVersion, 'deal');
    const pinnedAt = new Map<number, Tile>();
    const loose: Tile[] = [];
    tiles.forEach((tile, index) => {
        if (isPinned(tile)) pinnedAt.set(index, tile);
        else loose.push(tile);
    });
    if (loose.length === 0) {
        return [...tiles];
    }

    const quota = new Map<TileSuit, number>();
    for (const tile of loose) {
        const suit = tile.suit ?? TILE_SUITS[0]!;
        quota.set(suit, (quota.get(suit) ?? 0) + 1);
    }
    const suits = TILE_SUITS.filter((suit) => (quota.get(suit) ?? 0) > 0);

    const cellSuit = new Array<TileSuit | null>(total).fill(null);
    const frontier = new Map<TileSuit, number[]>(suits.map((suit) => [suit, []]));
    let unassigned = loose.length;
    const isFree = (cell: number): boolean => cellSuit[cell] === null && !pinnedAt.has(cell);
    const freeCells = (): number[] => cellSuit.flatMap((_, index) => (isFree(index) ? [index] : []));

    const claim = (suit: TileSuit, cell: number): void => {
        cellSuit[cell] = suit;
        frontier.get(suit)!.push(cell);
        quota.set(suit, (quota.get(suit) ?? 0) - 1);
        unassigned -= 1;
    };

    /*
     * Grow one suit at a time, to completion. Growing the suits in round-robin turns interleaves
     * them — every region ends up bordering every other, which at small board sizes is
     * indistinguishable from a shuffle. Letting each suit finish its clump before the next starts
     * produces solid regions; the last suit takes whatever is left, which is why Bone is "the suit
     * that breaks the others up".
     */
    /*
     * A new suit starts next to what has already been claimed rather than anywhere free: seeding
     * at random leaves the last suits picking through the gaps between earlier regions, which on
     * a small board is most of the board.
     */
    const seedCellFor = (): number | null => {
        const free = freeCells();
        if (free.length === 0) return null;
        const bordering = free.filter((cell) =>
            orthogonalNeighbours(cell, columns, total).some((n) => cellSuit[n] !== null)
        );
        const pool = bordering.length > 0 ? bordering : free;
        return pool[pickRngIndex(rng, pool.length)]!;
    };
    for (const suit of shuffleWithRng(() => rng(), [...suits])) {
        const seed = seedCellFor();
        if (seed === null) break;
        claim(suit, seed);
        while ((quota.get(suit) ?? 0) > 0 && unassigned > 0) {
            const edge = frontier.get(suit)!;
            let picked: number | null = null;
            for (let attempt = 0; attempt < edge.length * 2 && picked === null; attempt += 1) {
                const from = edge[pickRngIndex(rng, edge.length)]!;
                const open = orthogonalNeighbours(from, columns, total).filter(isFree);
                if (open.length > 0) {
                    picked = open[pickRngIndex(rng, open.length)]!;
                }
            }
            if (picked === null) {
                const free = freeCells();
                if (free.length === 0) break;
                picked = free[pickRngIndex(rng, free.length)]!;
            }
            claim(suit, picked);
        }
    }

    // Lay each suit's loose tiles into that suit's cells, shuffled within the suit.
    const out = new Array<Tile | null>(total).fill(null);
    for (const [index, tile] of pinnedAt) {
        out[index] = tile;
    }
    const placed = new Set<Tile>();
    for (const suit of suits) {
        const cells = cellSuit.flatMap((cell, index) => (cell === suit ? [index] : []));
        const own = shuffleWithRng(
            () => rng(),
            loose.filter((tile) => (tile.suit ?? TILE_SUITS[0]) === suit)
        );
        own.forEach((tile, i) => {
            const cell = cells[i];
            if (cell !== undefined) {
                out[cell] = tile;
                placed.add(tile);
            }
        });
    }
    // Any cell the growth left unassigned takes a leftover tile; nothing is ever dropped.
    const leftovers = loose.filter((tile) => !placed.has(tile));
    for (let index = 0; index < total && leftovers.length > 0; index += 1) {
        if (out[index] === null) out[index] = leftovers.shift()!;
    }
    return out.map((tile, index) => tile ?? tiles[index]!);
};

/**
 * Tiles that keep their cell through the suit deal.
 *
 * Only the ones with a positional *rule* behind them: the exit and the shop and room branches,
 * which the layout plan puts on the main path and the softlock repair reasons about, and the
 * boss pair. Enemies, traps, keys and treasure are dealt with the pairs. On an endless floor
 * nearly every tile is a dungeon card, so pinning all of them would pin the whole board and the
 * floor would open as a field again — and a hazard sitting *inside* a clump is not a loss, it is
 * the point: chunks are how you hit it (`docs/CHAIN_CHUNK_FEVER_DESIGN.md` §2.6).
 */
export const isLayoutPinnedTile = (tile: Tile): boolean =>
    isSingletonUtilityPairKey(tile.pairKey) || tile.dungeonBossId != null;

/** Every tile gets a suit, then the loose ones are dealt in clumps around the pinned ones. */
export const dealBoardSuits = (
    tiles: readonly Tile[],
    columns: number,
    runSeed: number,
    level: number,
    rulesVersion: number
): Tile[] =>
    dealTilesInClumps(
        assignSuitsToTiles(tiles, runSeed, level, rulesVersion),
        columns,
        runSeed,
        level,
        rulesVersion,
        isLayoutPinnedTile
    );

/**
 * How clumped the board is: mean fraction of each tile's orthogonal neighbours that share its suit.
 * A uniform shuffle over four equal suits sits near 0.25; a fully clumped deal approaches 1.
 */
export const sameSuitNeighbourRate = (board: Pick<BoardState, 'columns' | 'tiles'>): number => {
    const columns = getSafeBoardColumns(board);
    const total = board.tiles.length;
    if (total === 0) return 0;
    let sum = 0;
    let counted = 0;
    board.tiles.forEach((tile, index) => {
        const neighbours = orthogonalNeighbours(index, columns, total);
        if (neighbours.length === 0 || !tile.suit) return;
        const same = neighbours.filter((cell) => board.tiles[cell]?.suit === tile.suit).length;
        sum += same / neighbours.length;
        counted += 1;
    });
    return counted === 0 ? 0 : sum / counted;
};

/**
 * The suit of the biggest connected hidden clump on the board, or null on an empty one. What the
 * gossiping skull tells you when greeted: not where the tiles are, just which suit is worth a chain.
 */
export const largestHiddenSuitClump = (
    board: Pick<BoardState, 'columns' | 'tiles'>
): { suit: TileSuit; size: number } | null => {
    const columns = getSafeBoardColumns(board);
    const total = board.tiles.length;
    const seen = new Set<number>();
    let best: { suit: TileSuit; size: number } | null = null;
    board.tiles.forEach((tile, start) => {
        if (seen.has(start) || tile.state !== 'hidden' || !tile.suit) return;
        const suit = tile.suit;
        let size = 0;
        const stack = [start];
        seen.add(start);
        while (stack.length > 0) {
            const cell = stack.pop()!;
            size += 1;
            for (const next of orthogonalNeighbours(cell, columns, total)) {
                const candidate = board.tiles[next];
                if (seen.has(next) || !candidate || candidate.state !== 'hidden' || candidate.suit !== suit) continue;
                seen.add(next);
                stack.push(next);
            }
        }
        if (!best || size > best.size) best = { suit, size };
    });
    return best;
};
