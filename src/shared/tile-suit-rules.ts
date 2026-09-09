import type { BoardState, FloorArchetypeId, Tile, TileSuit } from './contracts';
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
 * those regions (`chunk-break-rules.ts`). Up to four suits - how many a floor deals is
 * `suitCountForPairs`, and each has a rune as well as a colour, because colour alone is not a
 * channel this game trusts (Gen 6, Gen 11).
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
 * Suits are dealt round-robin over a shuffled order of pair keys, so the floor's suits are always
 * within one pair of each other in count. A board where one suit is half the tiles is one where
 * the chunk break stops being a decision — every match is inside the big clump.
 */
export const assignSuitsToTiles = (
    tiles: readonly Tile[],
    runSeed: number,
    level: number,
    rulesVersion: number,
    suitCount: number = TILE_SUITS.length
): Tile[] => {
    const rng = suitRng(runSeed, level, rulesVersion, 'assign');
    const pairKeys = [...new Set(tiles.map((tile) => tile.pairKey))];
    const dealt = shuffleWithRng(() => rng(), pairKeys);
    const palette = TILE_SUITS.slice(0, Math.max(1, Math.min(TILE_SUITS.length, Math.floor(suitCount))));
    const suitByPairKey = new Map<string, TileSuit>();
    dealt.forEach((pairKey, index) => {
        suitByPairKey.set(pairKey, palette[index % palette.length]!);
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
 * Islands. A suit with `ISLAND_MIN_TILES` loose tiles or more is dealt as two clumps, seeded
 * apart from each other, so about half its pairs straddle them. That is what the ripple is for
 * (`chunk-break-rules.ts`): a lone match pops the island it is in, and the chain is what reaches
 * the partner on the other island and pops that one too. One clump per suit, measured, gave the
 * ripple nothing to bridge — partners sat inside the clump that had just gone.
 *
 * Deterministic from the seed. A replay deals the same map.
 */
/** A suit with this many loose tiles (three pairs) is dealt as two islands rather than one clump. */
export const ISLAND_MIN_TILES = 6;
export const ISLANDS_PER_SUIT = 2;

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
    const touchesSuit = (cell: number, suit: TileSuit): boolean =>
        orthogonalNeighbours(cell, columns, total).some((n) => cellSuit[n] === suit);
    const seedCellFor = (suit: TileSuit, apartFromOwn: boolean): number | null => {
        const free = freeCells();
        if (free.length === 0) return null;
        const bordering = free.filter((cell) =>
            orthogonalNeighbours(cell, columns, total).some((n) => cellSuit[n] !== null)
        );
        // A second island seeds away from the first, or it is the first island grown larger.
        const apart = apartFromOwn ? bordering.filter((cell) => !touchesSuit(cell, suit)) : bordering;
        const pool = apart.length > 0 ? apart : bordering.length > 0 ? bordering : free;
        return pool[pickRngIndex(rng, pool.length)]!;
    };
    const growIsland = (suit: TileSuit, cells: number, apartFromOwn: boolean): void => {
        const seed = seedCellFor(suit, apartFromOwn);
        if (seed === null) return;
        const island: number[] = [];
        const claimHere = (cell: number): void => {
            claim(suit, cell);
            island.push(cell);
        };
        claimHere(seed);
        let remaining = cells - 1;
        while (remaining > 0 && (quota.get(suit) ?? 0) > 0 && unassigned > 0) {
            let picked: number | null = null;
            for (let attempt = 0; attempt < island.length * 2 && picked === null; attempt += 1) {
                const from = island[pickRngIndex(rng, island.length)]!;
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
            claimHere(picked);
            remaining -= 1;
        }
    };
    for (const suit of shuffleWithRng(() => rng(), [...suits])) {
        const own = quota.get(suit) ?? 0;
        const islands = own >= ISLAND_MIN_TILES ? ISLANDS_PER_SUIT : 1;
        const first = islands === 1 ? own : Math.ceil(own / 2);
        growIsland(suit, first, false);
        if (islands > 1 && (quota.get(suit) ?? 0) > 0) {
            growIsland(suit, quota.get(suit) ?? 0, true);
        }
        // Whatever the islands could not place (a board with no free cell left beside them) goes
        // wherever is free, so every suit still gets exactly its count.
        while ((quota.get(suit) ?? 0) > 0 && unassigned > 0) {
            const free = freeCells();
            if (free.length === 0) break;
            claim(suit, free[pickRngIndex(rng, free.length)]!);
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
 * Tiles that keep their cell through the suit deal: the singletons the layout plan places by
 * rule. Everything else is dealt with the pairs.
 */
export const isLayoutPinnedTile = (tile: Tile): boolean => isSingletonUtilityPairKey(tile.pairKey);

/** Every tile gets a suit, then the loose ones are dealt in clumps around the pinned ones. */
/**
 * How a floor deals its suits. The archetype chooses: a breather or a treasure hall opens as a
 * map of big clumps (a bubble board you can read at a glance); a rush, a speed trial or a trap
 * hall deals its suits scattered, so a chain has to be earned across the board; a spotlight
 * floor deals only two suits, so the clumps are huge where the light lets you see them at all.
 * This is the cycle's clustering lever (design §2.6), keyed to the archetype because the
 * archetype is what a floor already announces about itself.
 */
export type SuitDealProfile = 'clumped' | 'scattered' | 'two_suit';

export const SUIT_DEAL_PROFILE_BY_ARCHETYPE: Readonly<Record<FloorArchetypeId, SuitDealProfile>> = {
    survey_hall: 'clumped',
    speed_trial: 'scattered',
    treasure_gallery: 'clumped',
    shadow_read: 'clumped',
    anchor_chain: 'clumped',
    trap_hall: 'scattered',
    script_room: 'clumped',
    rush_recall: 'scattered',
    parasite_tithe: 'clumped',
    spotlight_hunt: 'two_suit',
    breather: 'clumped'
};

export const getSuitDealProfile = (floorArchetypeId: FloorArchetypeId | null | undefined): SuitDealProfile =>
    floorArchetypeId ? SUIT_DEAL_PROFILE_BY_ARCHETYPE[floorArchetypeId] : 'clumped';

/** A uniform shuffle of the loose tiles around the pinned ones: the scattered deal. */
export const scatterTiles = (
    tiles: readonly Tile[],
    runSeed: number,
    level: number,
    rulesVersion: number,
    isPinned: (tile: Tile) => boolean = () => false
): Tile[] => {
    const rng = suitRng(runSeed, level, rulesVersion, 'scatter');
    const loose = shuffleWithRng(
        () => rng(),
        tiles.filter((tile) => !isPinned(tile))
    );
    let next = 0;
    return tiles.map((tile) => (isPinned(tile) ? tile : loose[next++]!));
};

/**
 * Pairs a break could take, which is what the palette has to be measured against. Mirrors
 * `tileCanBreakInChunk` in shape without importing the break rule; a singleton is not a pair.
 */
const breakablePairCount = (tiles: readonly Tile[]): number => {
    const halves = new Map<string, number>();
    for (const tile of tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        halves.set(tile.pairKey, (halves.get(tile.pairKey) ?? 0) + 1);
    }
    return [...halves.values()].filter((count) => count === 2).length;
};

/**
 * How many suits a board of this many pairs can carry: how big a suit wants to be, and the
 * smallest floor that still gets a map.
 *
 * Two findings, one from each direction. A suit that owns one pair cannot be broken into at all -
 * the pop needs two pairs of a suit touching - and four suits over the two pairs of floor 1, the
 * three of floor 2 and the four of floor 3 meant no match on the first three floors of a run
 * could ever pop, the loop invisible exactly where a new player meets it (Gen 148). So the
 * palette has to grow with the board.
 *
 * The other direction is that it was growing far too fast. One suit per two pairs put four suits
 * on any floor of eight pairs or more and left a mean suit of four and a half pairs, of which
 * only about half can break - the rest are dungeon cards. A clump that small is swallowed whole
 * by one bounded wave, so the chain ladder had nothing left to pay out with: Sharp was worth
 * three hundredths of a pair over Clean (`chunk-break-rules.ts`). Depth needs somewhere to go.
 *
 * One suit per six pairs gave the reaction room to run on the boards of the time. Measured by
 * `yarn sim:pop`, the ladder widened from 1.67 / 1.91 / 1.92 / 3.34 pairs per match to
 * 1.18 / 2.32 / 2.71 / 3.71: the spread from a lone match to Fever went 1.66 to 2.53, and the
 * thinnest rung went from a hundredth of a pair to four tenths.
 *
 * **Gen 191 moved it to one suit per four**, because the boards under it changed. A floor showed
 * two suits until floor twenty and cleared in three turns, which is both halves of the same
 * complaint: too few kinds of card, and the whole screen gone in two goes. The pair curve grew
 * (`pair-curve.ts`) and the palette grew with it, so a floor reaches three suits at floor 5 and
 * four by floor 11 while a suit still holds about as many pairs as it did before. It still reads
 * as a difficulty curve, the way a bubble shooter opens with two colours and adds more. The ladder
 * pays for it in pairs - Sharp's step over Clean goes 0.61 to 0.50 - and takes it back in score,
 * where the rungs come out x3.35 / x2.52 / x4.73, more even than they were.
 *
 * `MIN_PAIRS_FOR_TWO_SUITS` is the legibility floor. The suit is the map (Gen 117): a board dealt
 * one suit has no map at all, only a uniform field, and six breakable pairs is enough that a
 * player is entitled to regions to plan against. It costs the ladder about a tenth of a pair at
 * the Sharp rung against leaving the palette to the ratio alone, and that is the trade this file
 * makes on purpose: a readable board first.
 */
export const SUIT_TARGET_PAIRS = 4;
export const MIN_PAIRS_FOR_TWO_SUITS = 6;

export const suitCountForPairs = (pairs: number): number => {
    const count = Math.max(0, pairs);
    const legibilityFloor = count >= MIN_PAIRS_FOR_TWO_SUITS ? 2 : 1;
    return Math.max(legibilityFloor, Math.min(TILE_SUITS.length, Math.round(count / SUIT_TARGET_PAIRS)));
};

/**
 * How wide a palette a floor of this shape can carry.
 *
 * The palette and the pop trade against each other, and how a floor deals its suits decides the
 * rate. A clumped floor gives each suit one region, so a third and a fourth suit cost the break
 * almost nothing: the region is smaller but it is still a region. A scattered floor has no regions
 * at all, and every suit added to one thins what is left until a match touches nothing of its own
 * kind - measured at Gen 191, a third suit halves a scattered floor's pop rate, from about 0.7 of
 * matches to about 0.36, which is the failure Gen 148 existed to fix.
 *
 * So a scattered floor keeps two suits however big it is, and a spotlight floor keeps its two by
 * definition. Everything else grows with the board.
 */
export const SCATTERED_SUIT_CEILING = 2;

export const suitCountForDeal = (profile: SuitDealProfile, pairs = Number.POSITIVE_INFINITY): number => {
    const ceiling =
        profile === 'two_suit' || profile === 'scattered' ? SCATTERED_SUIT_CEILING : TILE_SUITS.length;
    return Math.min(ceiling, suitCountForPairs(pairs));
};

export const dealBoardSuits = (
    tiles: readonly Tile[],
    columns: number,
    runSeed: number,
    level: number,
    rulesVersion: number,
    profile: SuitDealProfile = 'clumped'
): Tile[] => {
    const suitCount = suitCountForDeal(profile, breakablePairCount(tiles));
    if (profile === 'scattered') {
        return scatterTiles(assignSuitsToTiles(tiles, runSeed, level, rulesVersion, suitCount), runSeed, level, rulesVersion, isLayoutPinnedTile);
    }
    return dealTilesInClumps(
        assignSuitsToTiles(tiles, runSeed, level, rulesVersion, suitCount),
        columns,
        runSeed,
        level,
        rulesVersion,
        isLayoutPinnedTile
    );
};

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
