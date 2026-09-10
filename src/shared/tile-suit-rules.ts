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
 * Deals every free cell a suit uniformly at random from the quota, then repairs whatever the
 * shuffle happened to stack: any connected same-suit run over `MIX_MAX_RUN` is cut by swapping one
 * of its cells with a differently-suited cell that is not itself in a run. Every suit gets exactly
 * as many cells as it has unpinned tiles, so the multiset of tiles is untouched - only their order
 * changes.
 *
 * Until Gen 204 this grew one solid region per suit, on purpose, because the pop reaches through
 * same-suit contact and a region is contact by construction. It overshot badly: 0.569 same-suit
 * neighbours against the 0.25 a shuffle gives, and a single blob covering 30% of the board. See
 * the long note inside `dealTilesInClumps`.
 *
 * Deterministic from the seed. A replay deals the same map.
 */
/**
 * How far apart the two halves of a pair are laid, in grid steps, within their suit's cells.
 *
 * Until Gen 198 the suit's tiles were shuffled into the suit's cells, which put a pair's halves
 * orthogonally touching on 0.228 of pairs and at a corner on a further 0.144 - so more than a
 * third of every floor's pairs sat beside their own twin. That is roughly what chance gives on a
 * board of twenty cells, and it is exactly why the deal did not feel random: a memory game whose
 * boards hand you one free pair in five reads as arranged, because the player keeps finding pairs
 * they never had to remember.
 *
 * Three steps is the smallest separation that clears both the touch and the corner. It is a floor,
 * not a target: the cell is drawn at random from everything at least this far away, so the halves
 * are as far apart as the board happens to put them and no two floors look alike. A suit squeezed
 * into a corner with nothing far enough takes the farthest cell it has rather than refusing.
 */
export const PAIR_HALF_SEPARATION = 3;

/**
 * The largest connected run of one suit the deal will leave standing.
 *
 * Four, because that is the size at which a run stops reading as coincidence. Three same-suit tiles
 * in a line is something a shuffle does often and nobody notices; six is a wall, and a player who
 * sees a wall stops believing the board was dealt. It is a ceiling on the *worst* case rather than
 * a target for the average - most runs come out at one or two on their own.
 */
export const MIX_MAX_RUN = 4;

/**
 * The cap, adjusted for how many suits the floor carries.
 *
 * A shuffle's runs get longer as the palette shrinks: over two suits, a same-suit tile sits beside
 * you half the time by arithmetic alone, and holding such a board to the four-suit cap makes it
 * *less* random than chance - measured at 0.358 same-suit neighbours against the 0.5 two suits
 * should give, which is a checkerboard, not a shuffle. Over-ordering is the same lie as clumping,
 * told backwards.
 */
export const mixMaxRunForSuits = (suitCount: number): number =>
    suitCount <= 2 ? MIX_MAX_RUN * 2 : MIX_MAX_RUN;

/**
 * How many times the repair pass sweeps the board looking for runs over the cap.
 *
 * Bounded rather than run to a fixed point on purpose: a small board can reach a state where no
 * single swap improves it, and a deal that always finishes is worth more than a deal that is
 * perfectly even. Measured, one sweep clears almost everything and the rest converge by three.
 */
export const MIX_REPAIR_ROUNDS = 4;

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

    /*
     * Gen 204 replaced region-growing with a true mix.
     *
     * What was here grew one suit at a time to completion, on purpose: each suit took a solid
     * region, and the file said so - "growing the suits in round-robin turns interleaves them ...
     * which at small board sizes is indistinguishable from a shuffle". That was the goal then,
     * because the pop reaches through same-suit contact and a region is contact by construction.
     *
     * Measured, it went much further than intended. A uniform shuffle over four suits sits near
     * 0.25 same-suit neighbours; the grown deal measured **0.569**, with the single biggest blob
     * covering 30% of the board (49% on a two-suit floor). The `scattered` profile - the one whose
     * whole job was to not do this - measured 0.496, barely different from `clumped`. A board that
     * reads as four painted zones is not a board anyone believes was shuffled.
     *
     * So the suits are dealt uniformly at random, then a repair pass breaks up whatever the shuffle
     * happened to stack. Two passes, in this order, because the second cannot be done first:
     *
     *   1. **Deal.** Every cell takes a suit from the quota, uniformly, with no regard for its
     *      neighbours. This alone lands near 0.25 but leaves the occasional natural blob - random
     *      really does clump sometimes, and a player reads a natural blob as a rigged one.
     *   2. **Break the blobs.** Any connected same-suit run larger than MIX_MAX_RUN is cut by
     *      swapping one of its cells with a cell of another suit that is not touching its own kind.
     *      A swap that would create a new oversized run is rejected, so the pass converges.
     *
     * The `two_suit` profile keeps its higher floor for the obvious arithmetic reason: with two
     * suits over a board, chance alone puts a same-suit tile beside you half the time. It is dealt
     * by the same code and lands where two suits land.
     */
    const cellSuit = new Array<TileSuit | null>(total).fill(null);
    const openCells: number[] = [];
    for (let cell = 0; cell < total; cell += 1) {
        if (!pinnedAt.has(cell)) openCells.push(cell);
    }
    const bag: TileSuit[] = [];
    for (const suit of suits) {
        for (let n = quota.get(suit) ?? 0; n > 0; n -= 1) bag.push(suit);
    }
    const shuffledBag = shuffleWithRng(() => rng(), bag);
    shuffleWithRng(() => rng(), [...openCells]).forEach((cell, index) => {
        const suit = shuffledBag[index];
        if (suit) cellSuit[cell] = suit;
    });

    /** The connected same-suit run containing `cell`, walked orthogonally. */
    const runAt = (cell: number): number[] => {
        const suit = cellSuit[cell];
        if (!suit) return [];
        const seen = new Set([cell]);
        const stack = [cell];
        const run: number[] = [];
        while (stack.length > 0) {
            const current = stack.pop()!;
            run.push(current);
            for (const neighbour of orthogonalNeighbours(current, columns, total)) {
                if (seen.has(neighbour) || cellSuit[neighbour] !== suit) continue;
                seen.add(neighbour);
                stack.push(neighbour);
            }
        }
        return run;
    };
    const runSizeAt = (cell: number): number => runAt(cell).length;

    /*
     * Break every run over the cap. Bounded by MIX_REPAIR_ROUNDS rather than run to a fixed point:
     * a board can be small enough that no swap improves it, and a deal that finishes is worth more
     * than a deal that is perfectly even.
     */
    const maxRun = mixMaxRunForSuits(suits.length);
    for (let round = 0; round < MIX_REPAIR_ROUNDS; round += 1) {
        let repaired = false;
        for (const cell of openCells) {
            const suit = cellSuit[cell];
            if (!suit) continue;
            const run = runAt(cell);
            if (run.length <= maxRun) continue;
            // Swap the run's cell with a differently-suited cell that is alone among its own kind,
            // so the cut does not just move the blob somewhere else.
            const candidates = shuffleWithRng(
                () => rng(),
                openCells.filter((other) => {
                    const otherSuit = cellSuit[other];
                    return otherSuit != null && otherSuit !== suit && runSizeAt(other) <= maxRun;
                })
            );
            for (const other of candidates) {
                const otherSuit = cellSuit[other]!;
                cellSuit[cell] = otherSuit;
                cellSuit[other] = suit;
                if (runSizeAt(cell) <= maxRun && runSizeAt(other) <= maxRun) {
                    repaired = true;
                    break;
                }
                cellSuit[cell] = suit;
                cellSuit[other] = otherSuit;
            }
        }
        if (!repaired) break;
    }

    // Lay each suit's loose tiles into that suit's cells, shuffled within the suit.
    const out = new Array<Tile | null>(total).fill(null);
    for (const [index, tile] of pinnedAt) {
        out[index] = tile;
    }
    const placed = new Set<Tile>();
    const gridDistance = (a: number, b: number): number =>
        Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) + Math.abs((a % columns) - (b % columns));
    for (const suit of suits) {
        const cells = cellSuit.flatMap((cell, index) => (cell === suit ? [index] : []));
        const own = shuffleWithRng(
            () => rng(),
            loose.filter((tile) => (tile.suit ?? TILE_SUITS[0]) === suit)
        );
        // Halves of the same pair are laid apart, the singletons after them. Shuffling the suit's
        // tiles into its cells - which is what this did until Gen 198 - lands the two halves of a
        // pair beside each other about as often as chance does, and on a board of twenty cells
        // chance is one pair in five. See PAIR_HALF_SEPARATION.
        const byPair = new Map<string, Tile[]>();
        for (const tile of own) byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
        const wholePairs = [...byPair.values()].filter((halves) => halves.length === 2);
        const rest = [...byPair.values()].filter((halves) => halves.length !== 2).flat();
        const free = [...cells];
        const takeAt = (index: number): number => free.splice(index, 1)[0]!;
        const put = (cell: number | undefined, tile: Tile): void => {
            if (cell === undefined) return;
            out[cell] = tile;
            placed.add(tile);
        };
        for (const [first, second] of wholePairs as [Tile, Tile][]) {
            if (free.length === 0) break;
            const a = takeAt(pickRngIndex(rng, free.length));
            put(a, first);
            if (free.length === 0) break;
            const apart = free.flatMap((cell, index) =>
                gridDistance(a, cell) >= PAIR_HALF_SEPARATION ? [index] : []
            );
            // No cell is far enough - a suit squeezed into a corner - so take the farthest there is
            // rather than refuse: every tile still gets a cell, which is the invariant that matters.
            const farthest = free.reduce(
                (best, cell, index) => (gridDistance(a, cell) > gridDistance(a, free[best]!) ? index : best),
                0
            );
            put(takeAt(apart.length > 0 ? apart[pickRngIndex(rng, apart.length)]! : farthest), second);
        }
        for (const tile of rest) {
            if (free.length === 0) break;
            put(takeAt(pickRngIndex(rng, free.length)), tile);
        }

        /*
         * The repair pass. Placing the pairs one at a time is greedy, so a pair dealt late can find
         * every remaining cell of its suit huddled together - the halves end up beside each other
         * even on a board with room elsewhere. One sweep of swaps fixes most of it: for a pair that
         * came out too close, look for a tile to trade cells with that leaves both pairs no worse
         * and this one better. Bounded and deterministic; a board with genuinely nowhere to go keeps
         * what it has.
         */
        const cellOf = new Map<Tile, number>();
        for (const cell of cells) {
            const tile = out[cell];
            if (tile) cellOf.set(tile, cell);
        }
        const separation = (halves: Tile[]): number => {
            const [x, y] = halves;
            const a = x ? cellOf.get(x) : undefined;
            const b = y ? cellOf.get(y) : undefined;
            return a === undefined || b === undefined ? Number.POSITIVE_INFINITY : gridDistance(a, b);
        };
        const swap = (one: Tile, other: Tile): void => {
            const a = cellOf.get(one)!;
            const b = cellOf.get(other)!;
            out[a] = other;
            out[b] = one;
            cellOf.set(one, b);
            cellOf.set(other, a);
        };
        for (const halves of wholePairs) {
            if (separation(halves) >= PAIR_HALF_SEPARATION) continue;
            const [, moving] = halves as [Tile, Tile];
            for (const candidate of shuffleWithRng(() => rng(), [...cellOf.keys()])) {
                if (candidate === halves[0] || candidate === moving) continue;
                const candidatePair = byPair.get(candidate.pairKey) ?? [];
                const before = Math.min(separation(halves), separation(candidatePair));
                swap(moving, candidate);
                const after = Math.min(separation(halves), separation(candidatePair));
                if (after <= before) {
                    swap(moving, candidate);
                    continue;
                }
                // Keep the trade, but keep looking: a swap that only moves a pair from touching to
                // a corner has not finished the job, and a corner is still a pair beside its twin.
                if (separation(halves) >= PAIR_HALF_SEPARATION) break;
            }
        }
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
 * **Gen 193 rounds up rather than to nearest.** The three authored floors carry two, three and
 * three suits, and with rounding-to-nearest the first procedural floor dropped back to two - the
 * palette going backwards the moment the tutorial ended, which is the opposite of what a player is
 * being taught to read. Rounding up makes floor 4 carry three and floor 10 all four.
 *
 * **Gen 191 moved it to one suit per four**, because the boards under it changed. A floor showed
 * two suits until floor twenty and cleared in three turns, which is both halves of the same
 * complaint: too few kinds of card, and the whole screen gone in two goes. The pair curve grew
 * (`pair-curve.ts`) and the palette grew with it, so a floor reaches three suits at floor 5 and
 * four by floor 11 while a suit still holds about as many pairs as it did before. It still reads
 * as a difficulty curve, the way a bubble shooter opens with two colours and adds more. The ladder
 * pays for it in pairs and takes it back in score: measured after Gen 192 took the settle out, the
 * rungs find 1.74 / 3.00 / 3.40 / 7.88 pairs and pay x3.33 / x2.37 / x4.84.
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
    return Math.max(legibilityFloor, Math.min(TILE_SUITS.length, Math.ceil(count / SUIT_TARGET_PAIRS)));
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
    /*
     * Gen 204: one deal for every floor.
     *
     * `scattered` used to take a separate path - `scatterTiles`, a bare shuffle of the loose tiles.
     * Measured, that path was the worst of the three: 0.496 same-suit neighbours and 0.144 of pairs
     * with their halves touching, against 0.025 on the dealt path. Not because the shuffle was
     * wrong, but because it skipped everything the dealt path does *after* the shuffle - the blob
     * repair and the pair-half separation - and because a scattered floor deals two suits, where
     * chance alone puts a same-suit tile beside you half the time.
     *
     * The profile is still a real lever; it just stopped being a clustering lever. What it decides
     * now is how many suits the floor carries (`suitCountForDeal`), which is a different puzzle -
     * two suits is a board where almost everything can chain, four is a board where you have to
     * find the route. Every floor is mixed the same way.
     */
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
