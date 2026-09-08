import type { BoardState, FindableKind, RunState, Tile } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The chunk break: what a match does to the board around it.
 *
 * A correct match does not just clear its own pair. It pops the same-suit tiles touching it, and
 * their partners go with them wherever they are - and every tile that pops is a new seed, so the
 * pops ripple: a partner that left from across the board takes its own neighbours, and theirs.
 * Bubble games are built on contact - a bubble touching its colour goes with it, and what it was
 * holding falls - and Tetris Attack and Puyo on the chain reaction that follows. Here the contact
 * rule runs on every match, live, and the chain decides how far each pop reaches: a lone match
 * takes what it is touching, a Clean chain the partners those tiles had elsewhere, Sharp the whole
 * clump and the reaction after it, Fever the clump and its halo. One small, skilled input, a large visible consequence, bigger the better you have been
 * playing. That is the whole loop.
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
 * and it runs live on every match. What the chain buys is how far that goes. A bounded wave walks
 * two steps into the clump and stops, and below Clean a pair goes only when the wave has both of
 * its halves - so a lone match takes what it is touching. A Clean chain adds the partner reach:
 * the pops now take a pair whose other half is across the board. Sharp and Fever unbind both -
 * the whole clump, and the reaction running from every partner until a wave takes nothing, which
 * is Puyo's chain.
 */
export const POP_WAVES = 1;
/**
 * The ripple is what Sharp buys, and it used to be Clean's.
 *
 * Measured by `yarn sim:pop` at the rung each tier actually sits on, the old ladder paid 1.67
 * pairs at chain one, 1.91 at Clean, 1.92 at Sharp and 3.34 at Fever. Sharp was worth one
 * hundredth of a pair over Clean - a whole rung of the chain, for nothing a player could see -
 * and the entire payoff sat at Fever, whose payoff is the halo: the neighbourhood of the clump
 * whatever its suit, which is width, not depth. That is not a ladder, it is a switch that flips
 * at the top.
 *
 * The reason is that Clean had already been given everything. Two waves plus the partner reach
 * sweeps every breakable pair a suit has - so Sharp's unbounded reaction arrived at a clump that
 * was already gone. One wave at Clean hands the reaction back to Sharp, which is where
 * `docs/CHAIN_CHUNK_FEVER_DESIGN.md` 2.3 always put it: Clean buys that the pops reach a partner
 * across the board at all, and Sharp buys that the reaction runs.
 */
export const CLEAN_WAVES = 1;

/**
 * How far into the clump one wave walks. This is the depth half of the ladder, and it was missing
 * entirely: every wave walked the whole connected same-suit region whatever the chain behind it,
 * so a chain-one match covered the same area as a Sharp one and the tier decided only how many
 * times that happened.
 *
 * A bounded wave stops two steps from its seeds. Reach one was measured and is too small on this
 * board: below Clean a pop has no partner reach, so it needs both halves of another pair inside
 * the region, and a one-step region holds too few tiles for that - a chain-one match fell to 0.26
 * pairs, which is the pop going invisible again and the regression Gen 148 exists to prevent.
 *
 * Bounding the wave does cost the chain-one pop, and that cost is the point rather than a side
 * effect: it took 1.67 pairs and now takes 1.18, and the floors a player meets first pop on 0.63
 * to 1.00 of matches where they used to pop on 0.94 to 1.00. A match with no chain behind it was
 * taking most of what a Fever break takes, which is what left the ladder nothing to sell.
 */
export const BOUNDED_BREAK_REACH = 2;

/** How deep into the same-suit clump a wave walks at this tier; Infinity is the whole region. */
export const breakClumpReach = (tier: ChainTier): number =>
    tier === 'sharp' || tier === 'fever' ? Number.POSITIVE_INFINITY : BOUNDED_BREAK_REACH;

/**
 * Contact, or reach. A pop is contact: a pair goes when both its halves touch the clump. Reaching
 * a partner across the board - the half you would otherwise have had to remember - is what the
 * chain buys from Clean. Pairs still leave together, always: a pair with a half outside the clump
 * stays whole on a pop.
 */
export const breakReachesPartners = (tier: ChainTier): boolean => tier !== 'none';
/**
 * The ripple. Every tile a wave takes seeds the next wave with the same reach, until a wave takes
 * nothing. A second wave lifts the whole break's score by this share, a third by twice it, up to
 * the cap - the chain reaction is the shot worth naming, as it is in Puyo.
 */
export const RIPPLE_WAVE_LIFT = 0.2;
export const RIPPLE_MAX_LIFT = 2;
/** A chain reaction cannot outrun the board, but a bound keeps the rule honest on an authored one. */
export const RIPPLE_MAX_WAVES = 12;
/**
 * The drop. Puzzle Bobble's second ingredient: a cluster falls once nothing holds it. A Sharp or
 * Fever break that leaves the matched suit with this many plain pairs or fewer takes them too,
 * wherever they sit - a suit down to a pair or two can never pop again (a pop needs two same-suit
 * pairs touching), so what is left is a chore, not a target.
 *
 * Measured over 120 generated floors it fired on nothing at all, which also left
 * `ACH_NOTHING_HELD_IT` unearnable. Two causes, and only one of them is the drop's own. The first
 * is that a pair with a job - a findable, the cursed pair - used to veto the whole drop: 483 of
 * 501 Sharp and Fever breaks were refused on that alone. A pair with a job sitting in the suit is
 * not what holds the plain tiles up, so it no longer stops them falling; it simply is not taken.
 *
 * The second is not the drop's to fix: at Sharp the ripple runs until a wave takes nothing, so it
 * has usually swept every plain pair of the suit before the drop looks (0 left on 92-98% of breaks
 * at every tier). Letting the drop run at the bounded tiers instead was tried and rejected - on a
 * four-pair suit it hands a chain-one match the whole suit, which is the tier ladder collapsing.
 * The remnant this rule wants is a bigger suit than generation deals today; that is a task, not a
 * threshold.
 */
export const DROP_MAX_PAIRS = 2;

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
    comboShardGain: number;
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

const diagonalNeighbours = (index: number, columns: number, total: number): number[] => {
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
    /**
     * Fever: the region takes a halo — every hidden tile bordering it, whatever its suit. Peggle's
     * fever lights every peg left; here the whole neighbourhood of the clump goes with it.
     */
    halo?: boolean;
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
    if (options.halo) {
        for (const from of [...seeds, ...region]) {
            for (const cell of neighboursOf(from)) {
                if (seen.has(cell)) continue;
                const tile = board.tiles[cell];
                if (!tile || tile.state !== 'hidden') continue;
                seen.add(cell);
                region.push(cell);
            }
        }
    }
    return region;
};

/** What a ripple of `waves` waves multiplies the break by: nothing for one wave, capped. */
export const rippleLift = (waves: number): number =>
    Math.min(RIPPLE_MAX_LIFT, 1 + RIPPLE_WAVE_LIFT * Math.max(0, runNonNegativeInteger(waves) - 1));

/** Score for a chunk of `pairs` pairs on `level`: under a base match per pair, rising with size and with the ripple. */
export const chunkBreakScore = (level: number, pairs: number, tier: ChainTier, waves = 1): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 0;
    const perPair = Math.floor(calculateMatchScore(level, 0) * 0.6);
    const sizeBonus = 6 * count * (count - 1);
    const feverLift = tier === 'fever' ? 1.5 : 1;
    return Math.floor((perPair * count + sizeBonus) * feverLift * rippleLift(waves));
};

/** Shards a chunk drops: one per two pairs, or one per pair in Fever. */
export const chunkBreakComboShards = (pairs: number, tier: ChainTier): number => {
    const count = runNonNegativeInteger(pairs);
    return tier === 'fever' ? count : Math.floor(count / 2);
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
    const rest = Math.max(0, result.brokenPairKeys.length - pop);
    return Math.ceil(pop / 2) + rest;
};

export const resolveChunkBreak = ({
    board,
    run,
    matchedTileIds,
    chain
}: {
    board: BoardState;
    run: Pick<RunState, 'gameMode' | 'floorCurioId'>;
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
        comboShardGain: 0,
        claimedFindableKind: null,
        droppedPairKeys: [],
        waves: 0,
        wavePairKeys: []
    };
    const wavesAllowed = rippleWaves(tier);
    const reachesPartners = breakReachesPartners(tier);
    const diagonal = run.floorCurioId === 'sticky_toffee';
    const byPairKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        byPairKey.set(tile.pairKey, [...(byPairKey.get(tile.pairKey) ?? []), tile]);
    }
    const brokenPairKeys: string[] = [];
    const wavePairKeys: string[][] = [];
    const regionTileIds = new Set<string>();
    let claimedFindableKind: FindableKind | null = null;

    // The waves. The first is the pop: the whole same-suit clump touching the match and, at
    // Fever, its halo. Every pair a wave takes leaves both halves, and where the chain allows it
    // the partner's half seeds the next wave - its own clump goes, and so on until a wave takes
    // nothing. A halo pair is the edge of the celebration, not a bridge: it does not seed.
    let seeds: string[] = [...matchedTileIds];
    const reach = breakClumpReach(tier);
    for (let wave = 0; wave < wavesAllowed && seeds.length > 0; wave += 1) {
        const core = findSuitRegion(board, seeds, reach, { diagonal, exclude: matchedTileIds });
        const region =
            tier === 'fever' && wave === 0
                ? findSuitRegion(board, seeds, reach, { diagonal, exclude: matchedTileIds, halo: true })
                : core;
        const coreSet = new Set(core);
        const regionSet = new Set(region.map((index) => board.tiles[index]!.id));
        const taken: string[] = [];
        const haloTaken = new Set<string>();
        for (const index of region) {
            const tile = board.tiles[index]!;
            regionTileIds.add(tile.id);
            if (brokenPairKeys.includes(tile.pairKey) || taken.includes(tile.pairKey)) continue;
            if (board.cursedPairKey && tile.pairKey === board.cursedPairKey) continue;
            const pair = byPairKey.get(tile.pairKey) ?? [];
            // Contact: without a chain, a pair goes only when both halves are in the region.
            if (!reachesPartners && !pair.every((half) => regionSet.has(half.id))) continue;
            const take = () => {
                taken.push(tile.pairKey);
                if (!coreSet.has(index)) haloTaken.add(tile.pairKey);
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
        // The partners the wave pulled from elsewhere seed the next one: the half outside every
        // region walked so far. The half inside has had its clump walked already.
        seeds = taken
            .filter((pairKey) => !haloTaken.has(pairKey))
            .flatMap((pairKey) => (byPairKey.get(pairKey) ?? []).filter((half) => !regionTileIds.has(half.id)).map((half) => half.id));
    }
    const matchedSuit = board.tiles.find((tile) => matchedTileIds.includes(tile.id))?.suit ?? null;

    // The drop: at Sharp or better, when the break leaves the matched suit with at most
    // DROP_MAX_PAIRS plain pairs, those fall too. Pairs with a job of their own stay standing,
    // and no longer veto the drop - they are not what holds the plain tiles up.
    const droppedPairKeys: string[] = [];
    if ((tier === 'sharp' || tier === 'fever') && matchedSuit && brokenPairKeys.length > 0) {
        const matched = new Set(matchedTileIds);
        const remaining = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            if (tile.suit !== matchedSuit || tile.state !== 'hidden') continue;
            if (matched.has(tile.id) || brokenPairKeys.includes(tile.pairKey)) continue;
            remaining.set(tile.pairKey, [...(remaining.get(tile.pairKey) ?? []), tile]);
        }
        // A cursed pair is never taken without the player choosing it, so it stays standing too.
        const plainPairKeys = [...remaining.entries()]
            .filter(
                ([pairKey, halves]) =>
                    halves.length === 2 &&
                    halves.every(tileCanBreakInChunk) &&
                    !(board.cursedPairKey != null && pairKey === board.cursedPairKey)
            )
            .map(([pairKey]) => pairKey);
        if (plainPairKeys.length > 0 && plainPairKeys.length <= DROP_MAX_PAIRS) {
            for (const pairKey of plainPairKeys) {
                droppedPairKeys.push(pairKey);
                brokenPairKeys.push(pairKey);
            }
        }
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
        comboShardGain: chunkBreakComboShards(brokenPairKeys.length, tier),
        claimedFindableKind,
        droppedPairKeys,
        waves,
        wavePairKeys
    };
};
