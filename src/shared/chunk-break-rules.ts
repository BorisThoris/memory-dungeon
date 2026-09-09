import type { BoardState, FindableKind, RunState, Tile } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The chunk break: what a match does to the board around it.
 *
 * A correct match does not just clear its own pair. It pops the same-suit cards it is touching -
 * touching, through unbroken cards of that suit, never across the gap a cleared card leaves - and
 * every card that pops seeds the next wave, so the pops ripple outward along the clump.
 * Bubble games are built on contact - a bubble touching its colour goes with it, and what it was
 * holding falls - and Tetris Attack and Puyo on the chain reaction that follows. Here the contact
 * rule runs on every match, live, and the chain decides only how far along the clump each pop
 * walks: a lone match two steps, a Clean chain four, Sharp the whole connected region and the
 * reaction after it, Fever that region walked around corners as well. One small, skilled input, a
 * large visible consequence, bigger the better you have been playing. That is the whole loop.
 *
 * What the chain never buys is a card that is not touching. Until Gen 197 it did, twice: Clean and
 * above took a pair when one half was in the clump and the other was anywhere on the board, and
 * Fever took a halo of neighbours whatever their suit. Measured over 2367 breaks on real floors,
 * that was 10% of a Clean break's cards, 17% of a Sharp one and 55% of a Fever one arriving from
 * somewhere the player could not see the pop coming from. Both are gone; see
 * `docs/BREAK_TOUCHES_ONLY.md`.
 *
 * What it is not: a way to skip the memory game. Cascaded pairs score less than a matched pair,
 * carry no streak, recall or rating credit, and only ever take plain pair tiles - never a
 * singleton such as the wild. Memory still pays best; the pop makes it faster and louder. See
 * `docs/CHAIN_CHUNK_FEVER_DESIGN.md` 2.3 and 8.
 */
/**
 * The pop and the ripple, by tier.
 *
 * Every match pops the same-suit tiles around it, chain or no chain: that is the contact rule,
 * and it runs live on every match. At every tier a pair goes only when the wave holds both of its
 * halves, so a pop never orphans a partner and never takes a card the player cannot trace back to
 * the match by eye. What the chain buys is how far the wave walks: two steps at chain zero, four
 * at Clean, the whole connected region at Sharp, and at Fever that region taken around corners
 * too, with the reaction running from every popped card until a wave takes nothing - Puyo's
 * chain.
 */
export const POP_WAVES = 1;
/**
 * The ripple is what Sharp buys, and it used to be Clean's.
 *
 * Measured by `yarn sim:pop` at the rung each tier actually sits on, the old ladder paid 1.67
 * pairs at chain one, 1.91 at Clean, 1.92 at Sharp and 3.34 at Fever. Sharp was worth one
 * hundredth of a pair over Clean - a whole rung of the chain, for nothing a player could see -
 * because Clean had already been given everything: two waves swept every breakable pair a suit
 * had, so Sharp's unbounded reaction arrived at a clump that was already gone.
 *
 * One wave at Clean hands the reaction back to Sharp, which is where
 * `docs/CHAIN_CHUNK_FEVER_DESIGN.md` 2.3 always put it. Since Gen 197 what Clean buys instead is
 * depth: the wave walks four steps along the clump rather than two, which is a bigger pop of the
 * same shape, in the same place, from the same match - and Sharp still buys that the reaction
 * runs.
 */
export const CLEAN_WAVES = 1;

/**
 * How far into the clump one wave walks. This is the depth half of the ladder, and it was missing
 * entirely: every wave walked the whole connected same-suit region whatever the chain behind it,
 * so a chain-one match covered the same area as a Sharp one and the tier decided only how many
 * times that happened.
 *
 * A bounded wave stops two steps from its seeds. Reach one was measured and is too small on this
 * board: a pop needs both halves of another pair inside the region, and a one-step region holds
 * too few tiles for that - a chain-one match fell to 0.26 pairs, which is the pop going invisible
 * again and the regression Gen 148 exists to prevent.
 *
 * Bounding the wave does cost the chain-one pop, and that cost is the point rather than a side
 * effect: it took 1.67 pairs and now takes 1.18, and the floors a player meets first pop on 0.63
 * to 1.00 of matches where they used to pop on 0.94 to 1.00. A match with no chain behind it was
 * taking most of what a Fever break takes, which is what left the ladder nothing to sell.
 */
export const BOUNDED_BREAK_REACH = 2;

/**
 * What Clean buys, since Gen 197 took away the partner reach: the wave walks twice as far along
 * the clump. It is the same shape of pop in the same place, only bigger - which is the whole point
 * of a rung a player is meant to be able to aim at.
 */
export const CLEAN_BREAK_REACH = BOUNDED_BREAK_REACH * 2;

/**
 * How deep into the same-suit clump a wave walks, per tier. Infinity is the whole region.
 *
 * A record rather than a branch because this is the ladder's depth half and it is tuned: Gen 189
 * measured the rungs against it after the pips (Gen 186) showed Sharp paying 0.32 pairs over Clean,
 * a middle rung as thin as the one Gen 168 existed to repair.
 *
 * No tier walks the whole region in one wave any more (Gen 197). It used to, at Sharp and above,
 * and that is what made the ripple decorative up there: an unbounded first wave leaves the
 * reaction nothing to run into. Bounded at every tier, the reaction is the thing that covers
 * distance - Sharp's twelve waves walk the same clump Sharp used to swallow whole, but outward,
 * a step at a time, which is what a chain reaction looks like and what the shatter animation has
 * always been drawing.
 */
export const BREAK_CLUMP_REACH: Readonly<Record<ChainTier, number>> = {
    none: BOUNDED_BREAK_REACH,
    clean: CLEAN_BREAK_REACH,
    sharp: CLEAN_BREAK_REACH,
    fever: CLEAN_BREAK_REACH
};

export const breakClumpReach = (tier: ChainTier): number => BREAK_CLUMP_REACH[tier];

/**
 * Fever walks corners. Every tier below it steps orthogonally, so a clump that meets another only
 * at a diagonal is two clumps; at Fever it is one. That is the last privilege the ladder sells and
 * it is the only kind left that a player can see coming, because it never leaves the cards that
 * are actually touching (Gen 197). The `sticky_toffee` curio grants the same corner step at every
 * tier, which is what that curio has always been for.
 */
export const BREAK_DIAGONAL_TIERS: ReadonlySet<ChainTier> = new Set<ChainTier>(['fever']);

export const breakWalksDiagonals = (tier: ChainTier): boolean => BREAK_DIAGONAL_TIERS.has(tier);

/**
 * The bridge: what Sharp buys, and what makes the reaction a reaction rather than a longer walk.
 *
 * A wave takes one suit's clump. When the tier bridges, the cards it took hand the next wave every
 * card they were *touching* - the neighbour of another suit at the clump's edge - and that card's
 * own clump is the next wave. The fire spreads from clump to clump across contacts, which is what
 * a Puyo chain is and what the shatter animation has always drawn.
 *
 * It is the answer to the question Gen 197 raised and could not dodge. Taking away the partner
 * reach and the halo capped every break at the size of one suit clump, which on these boards is
 * three or four pairs: measured, the ladder fell from a spread of 6.13 pairs to 1.21, with Sharp
 * paying 0.10 over Clean - the thin middle rung, back again. Depth cannot fix that, because the
 * clump runs out. The bridge can, and it never crosses a gap: every card it reaches is in contact
 * with a card that just broke. That is the line Gen 197 draws - **contact, not distance**. A pop
 * may spread anywhere it is touching; it may not reach a card across empty space, whatever the
 * chain behind it.
 *
 * The clumps it catches are counted, because an uncounted bridge is not a rung, it is the board.
 * Unbounded, a Sharp break took 8.26 pairs against Clean's 2.10 - a clump touches several others
 * at once, so the fire caught all of them and simply ran until the floor was gone. Sharp catches
 * one neighbouring clump and Fever three, which keeps it a reaction a player can picture: your
 * clump, and the one it was leaning on. The bridge fires on one wave only; after it the reaction
 * walks the clumps it caught and stops.
 */
export const BREAK_BRIDGE_CLUMPS: Readonly<Record<ChainTier, number>> = {
    none: 0,
    clean: 0,
    sharp: 1,
    fever: 3
};

export const breakBridgeClumps = (tier: ChainTier): number => BREAK_BRIDGE_CLUMPS[tier];

/**
 * The ripple. Every tile a wave takes seeds the next wave with the same reach, until a wave takes
 * nothing. Each wave past the first multiplies the whole break by this step, up to the cap - the
 * chain reaction is the shot worth naming, as it is in Puyo (thesis §40.2).
 */
export const WAVE_MULT_STEP = 0.75;
export const WAVE_MULT_CAP = 6;
/** What the tier a break lands at multiplies it by: the ladder's rungs, in score. */
export const CHAIN_MULT: Record<ChainTier, number> = { none: 1, clean: 2, sharp: 4, fever: 8 };
/** A chain reaction cannot outrun the board, but a bound keeps the rule honest on an authored one. */
export const RIPPLE_MAX_WAVES = 12;
/**
 * The drop. Puzzle Bobble's second ingredient: a cluster falls once nothing holds it. Here what
 * holds a suit up is the pop itself - **a pair drops when its suit can no longer pop** (thesis
 * §37.3). A suit can pop while two whole pairs of it sit within a chain-zero pop's reach of each
 * other; when a match or a break leaves a suit that fails that test, every plain pair of that suit
 * falls, at any tier.
 *
 * That replaces a threshold (Gen 137's `DROP_MAX_PAIRS`: at Sharp or better, a remnant of two
 * plain pairs or fewer) that fired on 0.6% of floors, because a threshold on a remnant fires when
 * a numeric accident occurs and cannot be aimed at. A structure can: a player can look at a suit
 * of three pairs, see that two are adjacent and one is alone, and know that breaking the two
 * orphans the third. It fires at chain zero, so a new player meets it on their first floors, and
 * it takes the last pairs of a suit a player would otherwise grind out by hand (§41.2). Pairs with
 * a job of their own - a findable, the cursed pair - never drop and never hold the suit up.
 */
export const SEVERANCE_DROP_REACH = 2;
/**
 * The cap the thesis asked for (F.7, T2.4). Measured before it: the severance fired on 28% of
 * chain-one matches and took 1.44 pairs a time, but one drop in eight took three or four - a
 * clump that was cut off, not a remnant that was nearly gone. A severed suit down to this many
 * plain pairs falls; with more left it stands, and those pairs are matched from memory like any
 * other. Two is the remnant the last-pair problem (§41.2) is about: the pairs a player would
 * otherwise grind out by hand once nothing on the floor can reach them.
 */
export const SEVERANCE_DROP_MAX_PAIRS = 2;

/** How many waves the ripple may run at this tier: the pop alone, the pop and its partners' clumps, or the whole reaction. */
export const rippleWaves = (tier: ChainTier): number => {
    if (tier === 'sharp' || tier === 'fever') return RIPPLE_MAX_WAVES;
    return tier === 'clean' ? CLEAN_WAVES : POP_WAVES;
};

export interface ChunkBreakResult {
    board: BoardState;
    tier: ChainTier;
    /** Pair keys that broke, in region order. Empty when nothing broke. */
    brokenPairKeys: string[];
    /** Every tile id that left the board, both halves of each pair. */
    brokenTileIds: string[];
    score: number;
    /** A findable pair that was inside the chunk and went with it; the turn awards it. */
    claimedFindableKind: FindableKind | null;
    /** Pairs that dropped because the break left their suit with too few to hold them; also in `brokenPairKeys`. */
    droppedPairKeys: string[];
    /** Waves the ripple ran: 1 for a break that stopped at the match's own region, 0 when nothing broke. */
    waves: number;
    /** The pairs each wave took, in order; the drop is not a wave and is not here. */
    wavePairKeys: string[][];
}

/**
 * A hidden tile with no job the floor depends on: not a singleton such as the wild, which a break
 * that swallowed would leave the floor short of. A findable riding on such a tile is the one
 * extra a break is allowed to claim.
 */
export const tileIsPlainApartFromFindable = (tile: Tile): boolean =>
    tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey);

/** What a break may take: a pair with no job, and no findable to claim twice. */
export const tileCanBreakInChunk = (tile: Tile): boolean =>
    tileIsPlainApartFromFindable(tile) && tile.findableKind == null;

export const orthogonalNeighbours = (index: number, columns: number, total: number): number[] => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const out: number[] = [];
    if (col > 0) out.push(index - 1);
    if (col < columns - 1 && index + 1 < total) out.push(index + 1);
    if (row > 0) out.push(index - columns);
    if (index + columns < total) out.push(index + columns);
    return out;
};

export const diagonalNeighbours = (index: number, columns: number, total: number): number[] => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const out: number[] = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
        const r = row + dr;
        const c = col + dc;
        const cell = r * columns + c;
        if (r >= 0 && c >= 0 && c < columns && cell < total) out.push(cell);
    }
    return out;
};

export interface SuitRegionOptions {
    /** Spilled toffee: the tiles stick, so the region also propagates diagonally. */
    diagonal?: boolean;
    /** Tiles the walk never enters or crosses: the matched pair, once a later wave starts elsewhere. */
    exclude?: readonly string[];
}

/**
 * The connected same-suit region around a set of seed tiles, walking through hidden tiles only.
 * Returns tile indices, seeds excluded. `depth` of 1 is the seeds' neighbours; `Infinity` is the
 * whole region.
 */
export const findSuitRegion = (
    board: Pick<BoardState, 'columns' | 'tiles'>,
    seedTileIds: readonly string[],
    depth: number,
    options: SuitRegionOptions = {}
): number[] => {
    const columns = getSafeBoardColumns(board);
    const total = board.tiles.length;
    const seeds = seedTileIds
        .map((id) => board.tiles.findIndex((tile) => tile.id === id))
        .filter((index) => index >= 0);
    const suits = new Set(seeds.map((index) => board.tiles[index]?.suit).filter(Boolean));
    if (seeds.length === 0 || suits.size === 0) {
        return [];
    }
    const neighboursOf = (cell: number): number[] =>
        options.diagonal
            ? [...orthogonalNeighbours(cell, columns, total), ...diagonalNeighbours(cell, columns, total)]
            : orthogonalNeighbours(cell, columns, total);
    const seen = new Set<number>(seeds);
    for (const id of options.exclude ?? []) {
        const index = board.tiles.findIndex((tile) => tile.id === id);
        if (index >= 0) seen.add(index);
    }
    const region: number[] = [];
    let frontier = [...seeds];
    for (let step = 0; step < depth && frontier.length > 0; step += 1) {
        const next: number[] = [];
        for (const from of frontier) {
            for (const cell of neighboursOf(from)) {
                if (seen.has(cell)) continue;
                const tile = board.tiles[cell];
                if (!tile || tile.state !== 'hidden' || !tile.suit || !suits.has(tile.suit)) continue;
                seen.add(cell);
                region.push(cell);
                next.push(cell);
            }
        }
        frontier = next;
    }
    return region;
};

/** What a ripple of `waves` waves multiplies the break by: nothing for one wave, capped. */
export const waveMult = (waves: number): number =>
    Math.min(WAVE_MULT_CAP, 1 + WAVE_MULT_STEP * Math.max(0, runNonNegativeInteger(waves) - 1));

/** What one broken pair is worth on `level` before the multipliers: under a base match, and derived from it. */
export const chunkScorePerPair = (level: number): number => Math.floor(calculateMatchScore(level, 0) * 0.6);

/**
 * Score for a break of `pairs` pairs on `level`: a pair's worth, times the pairs, times the tier,
 * times the ripple. Multiplicative in every term (thesis §40.2), so a Fever reaction of twelve
 * pairs over seven waves is worth five hundred chain-one pops and not twenty-seven: the Puyo and
 * Balatro shape, where concentration beats accumulation by enough to be worth talking about.
 * The small breaks are still the ladder to it, which is what keeps the curve from being
 * "wait for Fever" (§40.3, band N5 in the cascade simulation).
 */
export const chunkBreakScore = (level: number, pairs: number, tier: ChainTier, waves = 1): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 0;
    return Math.floor(chunkScorePerPair(level) * count * CHAIN_MULT[tier] * waveMult(waves));
};

/**
 * Pairs a break feeds the ladder.
 *
 * Every match pops, so the pop is free to everyone. Measured three ways: at full credit a player
 * who missed a quarter of their turns reached Fever on 22% of floors against a clean player's
 * 35%, which is not a ladder; at no credit the ladder starved, because the pop clears a floor in
 * six turns and a streak cannot climb that far before the floor ends. Half credit for the pop's
 * own wave and whole credit for every wave the chain bought holds both ends: 20% of floors clean
 * against 6% at the reference miss rate.
 */
export const chunkBreakMomentumPairs = (result: Pick<ChunkBreakResult, 'brokenPairKeys' | 'wavePairKeys'>): number => {
    const pop = result.wavePairKeys[0]?.length ?? 0;
    // Dropped pairs are in `brokenPairKeys` and count in full, like a later wave. The severance
    // is aimable - a player who sees that breaking two adjacent pairs orphans the third has
    // planned the drop - and Puzzle Bobble's whole economy is that what falls pays more than what
    // pops. Measured without the credit, a floor that the drop clears faster leaves too few
    // matches to climb: Fever on the census fell from 0.11 to 0.05 of floors.
    const rest = Math.max(0, result.brokenPairKeys.length - pop);
    return Math.ceil(pop / 2) + rest;
};

/**
 * Whether a suit can still pop on this board: two whole hidden pairs of it within a chain-zero
 * pop's reach of each other, so that matching one takes the other. `ignorePairKeys` are pairs
 * that are leaving with the current break and no longer count.
 */
export const suitCanStillPop = (
    board: Pick<BoardState, 'columns' | 'tiles' | 'cursedPairKey'>,
    suit: Tile['suit'],
    options: { diagonal?: boolean; ignorePairKeys?: ReadonlySet<string> } = {}
): boolean => {
    const ignore = options.ignorePairKeys ?? new Set<string>();
    const byPairKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.suit !== suit || tile.state !== 'hidden' || ignore.has(tile.pairKey)) continue;
        byPairKey.set(tile.pairKey, [...(byPairKey.get(tile.pairKey) ?? []), tile]);
    }
    const whole = [...byPairKey.entries()].filter(([, halves]) => halves.length === 2);
    if (whole.length < 2) return false;
    const canBeTaken = ([pairKey, halves]: [string, Tile[]]): boolean =>
        pairKey !== board.cursedPairKey && halves.every(tileIsPlainApartFromFindable);
    for (const [seedKey, seedHalves] of whole) {
        const seedIds = seedHalves.map((half) => half.id);
        const region = new Set(
            findSuitRegion(board, seedIds, SEVERANCE_DROP_REACH, { diagonal: options.diagonal, exclude: seedIds }).map(
                (index) => board.tiles[index]!.id
            )
        );
        for (const entry of whole) {
            if (entry[0] === seedKey || !canBeTaken(entry)) continue;
            if (entry[1].every((half) => region.has(half.id))) return true;
        }
    }
    return false;
};

export const resolveChunkBreak = ({
    board,
    run,
    matchedTileIds,
    chain
}: {
    board: BoardState;
    run: Pick<RunState, 'floorCurioId'>;
    matchedTileIds: readonly string[];
    chain: number;
}): ChunkBreakResult => {
    const tier = getChainTier(chain, board.pairCount);
    const nothing: ChunkBreakResult = {
        board,
        tier,
        brokenPairKeys: [],
        brokenTileIds: [],
        score: 0,
        claimedFindableKind: null,
        droppedPairKeys: [],
        waves: 0,
        wavePairKeys: []
    };
    const wavesAllowed = rippleWaves(tier);
    const diagonal = run.floorCurioId === 'sticky_toffee' || breakWalksDiagonals(tier);
    const byPairKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        byPairKey.set(tile.pairKey, [...(byPairKey.get(tile.pairKey) ?? []), tile]);
    }
    const brokenPairKeys: string[] = [];
    const wavePairKeys: string[][] = [];
    const regionTileIds = new Set<string>();
    let claimedFindableKind: FindableKind | null = null;

    // The waves. The first is the pop: the same-suit cards the match is touching, as far along the
    // clump as the tier walks. A pair goes only when the wave holds both of its halves, so nothing
    // leaves from off-screen and nothing is orphaned. Every card a wave takes seeds the next one,
    // and the reaction runs on until a wave takes nothing.
    let seeds: string[] = [...matchedTileIds];
    const reach = breakClumpReach(tier);
    const bridgeClumps = breakBridgeClumps(tier);
    let bridgesLeft = bridgeClumps > 0 ? 1 : 0;
    const columns = getSafeBoardColumns(board);
    const indexById = new Map(board.tiles.map((tile, index) => [tile.id, index]));
    const matchedSeedSet = new Set(matchedTileIds);
    const neighboursOfIndex = (index: number): number[] =>
        diagonal
            ? [
                  ...orthogonalNeighbours(index, columns, board.tiles.length),
                  ...diagonalNeighbours(index, columns, board.tiles.length)
              ]
            : orthogonalNeighbours(index, columns, board.tiles.length);
    for (let wave = 0; wave < wavesAllowed && seeds.length > 0; wave += 1) {
        // A bridged seed is a card the last wave was touching: it is the head of the next clump,
        // so it is part of this wave's region, not merely the place it starts from.
        const seedIndexes = seeds
            .filter((id) => !matchedSeedSet.has(id))
            .map((id) => indexById.get(id))
            .filter((index): index is number => index != null && board.tiles[index]!.state === 'hidden');
        const region = [...new Set([...seedIndexes, ...findSuitRegion(board, seeds, reach, { diagonal, exclude: matchedTileIds })])];
        const regionSet = new Set(region.map((index) => board.tiles[index]!.id));
        const taken: string[] = [];
        for (const index of region) {
            const tile = board.tiles[index]!;
            regionTileIds.add(tile.id);
            if (brokenPairKeys.includes(tile.pairKey) || taken.includes(tile.pairKey)) continue;
            if (board.cursedPairKey && tile.pairKey === board.cursedPairKey) continue;
            const pair = byPairKey.get(tile.pairKey) ?? [];
            // Contact, at every tier: a pair goes only when both halves are in the region.
            if (!pair.every((half) => regionSet.has(half.id))) continue;
            const take = () => {
                taken.push(tile.pairKey);
            };
            // One findable pair per break goes with the chunk: drop the treasure. The turn awards it
            // through the same path a matched findable takes, so nothing is paid twice or never.
            if (
                claimedFindableKind === null &&
                tile.findableKind &&
                pair.length === 2 &&
                pair.every((half) => tileIsPlainApartFromFindable(half) && half.findableKind)
            ) {
                claimedFindableKind = tile.findableKind;
                take();
                continue;
            }
            if (!tileCanBreakInChunk(tile)) continue;
            // Pairs leave together, always. If the partner cannot go, neither does this tile.
            if (pair.length !== 2 || !pair.every(tileCanBreakInChunk)) continue;
            take();
        }
        if (taken.length === 0) {
            break;
        }
        wavePairKeys.push(taken);
        brokenPairKeys.push(...taken);
        // Every card the wave took seeds the next one, so the reaction walks on along the clump
        // from where it stopped. Where the tier bridges, the cards each broken card was touching
        // seed it too, whatever their suit - contact, never distance.
        const takenIds = taken.flatMap((pairKey) => (byPairKey.get(pairKey) ?? []).map((half) => half.id));
        const bridged: string[] = [];
        const bridgedSuits = new Set<NonNullable<Tile['suit']>>();
        if (bridgesLeft > 0) {
            bridgesLeft -= 1;
            for (const id of takenIds) {
                const index = indexById.get(id);
                if (index == null) continue;
                for (const cell of neighboursOfIndex(index)) {
                    const neighbour = board.tiles[cell];
                    if (!neighbour || neighbour.state !== 'hidden' || regionTileIds.has(neighbour.id)) continue;
                    if (matchedSeedSet.has(neighbour.id) || brokenPairKeys.includes(neighbour.pairKey)) continue;
                    if (!neighbour.suit || bridged.includes(neighbour.id)) continue;
                    if (bridgedSuits.size >= bridgeClumps && !bridgedSuits.has(neighbour.suit)) continue;
                    bridgedSuits.add(neighbour.suit);
                    bridged.push(neighbour.id);
                }
            }
        }
        seeds = [...takenIds, ...bridged];
    }
    // The drop: the matched pair and the broken pairs leave, and any suit they left that can no
    // longer pop - no two whole pairs of it within a pop's reach of each other - loses its plain
    // pairs too, at any tier. Pairs with a job of their own stay standing, and do not hold the
    // suit up either: a findable is a pair a break can take, so it still counts toward the pop
    // test, and the cursed pair counts only as the match that might start one.
    const droppedPairKeys: string[] = [];
    const matchedSet = new Set(matchedTileIds);
    const leaving = new Set<string>(brokenPairKeys);
    for (const tile of board.tiles) if (matchedSet.has(tile.id)) leaving.add(tile.pairKey);
    const suitsLeft = new Set<Tile['suit']>();
    for (const tile of board.tiles) if (leaving.has(tile.pairKey) && tile.suit) suitsLeft.add(tile.suit);
    for (const suit of suitsLeft) {
        if (suitCanStillPop(board, suit, { diagonal, ignorePairKeys: leaving })) continue;
        const plain: string[] = [];
        for (const [pairKey, halves] of byPairKey) {
            if (leaving.has(pairKey) || halves.length !== 2) continue;
            if (halves[0]!.suit !== suit || !halves.every((half) => half.state === 'hidden' && tileCanBreakInChunk(half))) continue;
            if (board.cursedPairKey != null && pairKey === board.cursedPairKey) continue;
            plain.push(pairKey);
        }
        if (plain.length === 0 || plain.length > SEVERANCE_DROP_MAX_PAIRS) continue;
        droppedPairKeys.push(...plain);
        brokenPairKeys.push(...plain);
    }

    if (brokenPairKeys.length === 0) {
        return nothing;
    }
    const broken = new Set(brokenPairKeys);
    const waveOfPair = new Map<string, number>();
    wavePairKeys.forEach((keys, wave) => keys.forEach((pairKey) => waveOfPair.set(pairKey, wave)));
    // The drop is not a wave; it leaves after the last one.
    const lastWave = Math.max(0, wavePairKeys.length - 1);
    const brokenTileIds = board.tiles.filter((tile) => broken.has(tile.pairKey)).map((tile) => tile.id);
    const waves = wavePairKeys.length;
    return {
        board: {
            ...board,
            matchedPairs: runNonNegativeInteger(board.matchedPairs) + brokenPairKeys.length,
            tiles: board.tiles.map((tile) =>
                broken.has(tile.pairKey)
                    ? {
                          ...tile,
                          state: 'removed' as const,
                          brokenByChunk: true,
                          brokenAtTier: tier,
                          brokenAtWave: waveOfPair.get(tile.pairKey) ?? lastWave,
                          findableKind: undefined
                      }
                    : tile
            )
        },
        tier,
        brokenPairKeys,
        brokenTileIds,
        score: chunkBreakScore(board.level, brokenPairKeys.length, tier, Math.max(1, waves)),
        claimedFindableKind,
        droppedPairKeys,
        waves,
        wavePairKeys
    };
};
