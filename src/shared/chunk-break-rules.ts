import type { BoardState, RelicId, RunState, Tile } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
import { activeDungeonEnemyPairKeys, damageDungeonEnemyPair } from './dungeon-enemy-card-rules';
import { damageEnemyHazardById } from './dungeon-enemy-hazard-rules';
import { treasureDungeonMatchReward } from './dungeon-match-reward-rules';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import type { FindableKind } from './contracts';

/**
 * The chunk break: what a match does to the board around it.
 *
 * A correct match does not just clear its own pair. It pops the same-suit tiles touching it, and
 * their partners go with them wherever they are - and every tile that pops is a new seed, so the
 * pops ripple: a partner that left from across the board takes its own neighbours, and theirs.
 * Bubble games are built on contact - a bubble touching its colour goes with it, and what it was
 * holding falls - and Tetris Attack and Puyo on the chain reaction that follows. Here the contact
 * rule runs on every match, live, and the chain decides how far each pop reaches: a lone match
 * takes what touches it, a Clean chain two steps, Sharp the whole clump, Fever the clump and its
 * halo. One small, skilled input, a large visible consequence, bigger the better you have been
 * playing. That is the whole loop.
 *
 * What it is not: a way to skip the memory game. Cascaded pairs score less than a matched pair,
 * carry no streak, recall or rating credit, and only ever take plain pair tiles and treasure -
 * never the exit, a key, a lever, a lock, a shrine, a route special or a hazard. Memory still
 * pays best; the pop makes it faster and louder. See `docs/CHAIN_CHUNK_FEVER_DESIGN.md` 2.3 and 8.
 *
 * Treasure is in because of what the floors are made of. Measured on generated endless floors
 * (`cascade-balance-simulation.ts`), an early floor is one to three plain tiles and a wall of
 * dungeon cards, most of them treasure; a chunk that took only plain pairs broke on almost no
 * floor before the twelfth. A chunk that reaches a treasure pair spills it - the loot pays out as
 * if matched - which is the Peggle reading anyway: the ball through the purple peg is the point.
 */
/**
 * The pop and the ripple, by tier.
 *
 * Every match pops the whole same-suit clump touching it, chain or no chain: that is the contact
 * rule, and it runs live on every match. What the chain buys is the ripple - how far the pops
 * travel through the partners. A lone match's partners leave and stop (one wave). A Clean chain
 * lets each partner that left take its own clump (two waves). Sharp and Fever let the reaction
 * run until a wave takes nothing - Puyo's chain. Tuning Fork adds a wave where the count is
 * finite.
 */
export const POP_WAVES = 1;
export const CLEAN_WAVES = 2;
export const TUNING_FORK_EXTRA_WAVES = 1;

/**
 * Contact, or reach. A pop is contact: a pair goes when both its halves touch the clump. Reaching
 * a partner across the board - the half you would otherwise have had to remember - is what the
 * chain buys from Clean, and what the Tuning Fork lends a lone match. Pairs still leave together,
 * always: a pair with a half outside the clump stays whole on a pop.
 */
export const breakReachesPartners = (tier: ChainTier, relics: readonly RelicId[] = []): boolean =>
    tier !== 'none' || relics.includes('tuning_fork');
/** Magpie's Ledger: what spilled treasure gold is multiplied by. */
export const MAGPIE_LEDGER_GOLD_MULTIPLIER = 2;
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
 * The drop. Puzzle Bobble's second ingredient: a cluster falls once nothing holds it. Here a
 * Sharp or Fever break that leaves the matched suit with this many pairs or fewer, all of them
 * plain, takes those pairs too - wherever they sit. The last pairs of a suit become a target
 * instead of a chore, and a break that empties a suit reads as the clean sweep it is.
 */
export const DROP_MAX_PAIRS = 2;

/** How many waves the ripple may run at this tier: the pop alone, the pop and its partners' clumps, or the whole reaction. */
export const rippleWaves = (tier: ChainTier, relics: readonly RelicId[] = []): number => {
    if (tier === 'sharp' || tier === 'fever') return RIPPLE_MAX_WAVES;
    const base = tier === 'clean' ? CLEAN_WAVES : POP_WAVES;
    return base + (relics.includes('tuning_fork') ? TUNING_FORK_EXTRA_WAVES : 0);
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
    /** Enemies the chunk broke over: hits landed, and how many it finished. */
    enemyHits: number;
    enemiesDefeated: number;
    /** A findable pair that was inside the chunk and went with it; the turn awards it. */
    claimedFindableKind: FindableKind | null;
    /** Treasure pairs the chunk spilled: their gold and how many count as opened. Score is in `score`. */
    treasureGold: number;
    treasuresSpilled: number;
    /** Pairs that dropped because the break left their suit with too few to hold them; also in `brokenPairKeys`. */
    droppedPairKeys: string[];
    /** Waves the ripple ran: 1 for a break that stopped at the match's own region, 0 when nothing broke. */
    waves: number;
    /** The pairs each wave took, in order; the drop is not a wave and is not here. */
    wavePairKeys: string[][];
}

/**
 * A hidden tile with no dungeon, route or hazard job. A findable riding on such a tile is the one
 * extra the chunk is allowed to take; a findable riding on a lever or a key is not — that card's
 * job is what the exit is waiting for, and a chunk that swallowed it would softlock the floor.
 */
export const tileIsPlainApartFromFindable = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.dungeonBossId == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.tileHazardKind == null;

/** Only plain pair tiles break. Everything with a job of its own stays on the board. */
export const tileCanBreakInChunk = (tile: Tile): boolean =>
    tileIsPlainApartFromFindable(tile) && tile.findableKind == null;

/** A hidden, unopened treasure card with no other job: a chunk that reaches it spills it. */
export const tileIsChunkTreasure = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    tile.dungeonCardKind === 'treasure' &&
    tile.dungeonCardState !== 'resolved' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonBossId == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.tileHazardKind == null;

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

/** A trap that has not sprung stops a chunk: the region does not propagate through it. */
export const tileBlocksChunk = (tile: Tile): boolean =>
    tile.dungeonCardKind === 'trap' && tile.dungeonCardState !== 'resolved';

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
 * The connected same-suit region around a set of seed tiles, walking through hidden tiles only
 * and never through an unsprung trap. Returns tile indices, seeds excluded. `depth` of 1 is the
 * seeds' neighbours; `Infinity` is the whole region.
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
                if (tileBlocksChunk(tile)) continue;
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
                if (!tile || tile.state !== 'hidden' || tileBlocksChunk(tile)) continue;
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

export const resolveChunkBreak = ({
    board,
    run,
    matchedTileIds,
    chain
}: {
    board: BoardState;
    run: Pick<RunState, 'gameMode' | 'floorCurioId'> & { relicIds?: readonly RelicId[] };
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
        enemyHits: 0,
        enemiesDefeated: 0,
        claimedFindableKind: null,
        treasureGold: 0,
        treasuresSpilled: 0,
        droppedPairKeys: [],
        waves: 0,
        wavePairKeys: []
    };
    if (run.gameMode === 'meditation') {
        return nothing;
    }

    const relics = run.relicIds ?? [];
    const wavesAllowed = rippleWaves(tier, relics);
    const reachesPartners = breakReachesPartners(tier, relics);
    const diagonal = run.floorCurioId === 'sticky_toffee';
    const byPairKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        byPairKey.set(tile.pairKey, [...(byPairKey.get(tile.pairKey) ?? []), tile]);
    }
    const brokenPairKeys: string[] = [];
    const wavePairKeys: string[][] = [];
    const regionTileIds = new Set<string>();
    let claimedFindableKind: FindableKind | null = null;
    let treasureScore = 0;
    let treasureGold = 0;
    let treasuresSpilled = 0;

    // The waves. The first is the pop: the whole same-suit clump touching the match and, at
    // Fever, its halo. Every pair a wave takes leaves both halves, and where the chain allows it
    // the partner's half seeds the next wave - its own clump goes, and so on until a wave takes
    // nothing. A halo pair is the edge of the celebration, not a bridge: it does not seed.
    let seeds: string[] = [...matchedTileIds];
    for (let wave = 0; wave < wavesAllowed && seeds.length > 0; wave += 1) {
        const core = findSuitRegion(board, seeds, Number.POSITIVE_INFINITY, { diagonal, exclude: matchedTileIds });
        const region =
            tier === 'fever' && wave === 0
                ? findSuitRegion(board, seeds, Number.POSITIVE_INFINITY, { diagonal, exclude: matchedTileIds, halo: true })
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
            // Treasure spills: both halves go, and the loot pays as if the pair had been matched.
            if (tile.dungeonCardKind === 'treasure') {
                if (pair.length !== 2 || !pair.every(tileIsChunkTreasure)) continue;
                const reward = treasureDungeonMatchReward(tile.dungeonCardEffectId ?? pair[1]?.dungeonCardEffectId ?? null);
                treasureScore += reward.score;
                // Magpie's Ledger: spilled treasure pays double gold. Matched treasure is untouched, so
                // the relic rewards the cascade and never the plain match.
                treasureGold += reward.shopGold * (relics.includes('magpie_ledger') ? MAGPIE_LEDGER_GOLD_MULTIPLIER : 1);
                treasuresSpilled += reward.treasuresOpened;
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
    // DROP_MAX_PAIRS plain pairs, they fall too. Anything with a job of its own holds the suit up.
    const droppedPairKeys: string[] = [];
    if ((tier === 'sharp' || tier === 'fever') && matchedSuit && brokenPairKeys.length > 0) {
        const matched = new Set(matchedTileIds);
        const remaining = new Map<string, Tile[]>();
        for (const tile of board.tiles) {
            if (tile.suit !== matchedSuit || tile.state !== 'hidden') continue;
            if (matched.has(tile.id) || brokenPairKeys.includes(tile.pairKey)) continue;
            remaining.set(tile.pairKey, [...(remaining.get(tile.pairKey) ?? []), tile]);
        }
        const holds = [...remaining.entries()].some(
            ([pairKey, halves]) =>
                halves.length !== 2 ||
                !halves.every(tileCanBreakInChunk) ||
                (board.cursedPairKey != null && pairKey === board.cursedPairKey)
        );
        if (!holds && remaining.size > 0 && remaining.size <= DROP_MAX_PAIRS) {
            for (const pairKey of remaining.keys()) {
                droppedPairKeys.push(pairKey);
                brokenPairKeys.push(pairKey);
            }
        }
    }

    // Chunks are attacks: every enemy any wave reached takes the chunk's size in damage.
    const chunkDamage = Math.max(1, brokenPairKeys.length);
    let hitBoard: BoardState = board;
    let enemyHits = 0;
    let enemiesDefeated = 0;
    let enemyScore = 0;
    for (const pairKey of activeDungeonEnemyPairKeys(board)) {
        const inRegion = (byPairKey.get(pairKey) ?? []).some((half) => regionTileIds.has(half.id));
        if (!inRegion) continue;
        const hit = damageDungeonEnemyPair(hitBoard, pairKey, chunkDamage);
        hitBoard = hit.board;
        enemyHits += 1;
        enemiesDefeated += hit.defeated;
        enemyScore += hit.score;
    }
    for (const hazard of activeEnemyHazardsForBoard(board)) {
        if (hazard.state !== 'revealed' || !regionTileIds.has(hazard.currentTileId)) continue;
        const hit = damageEnemyHazardById(hitBoard, hazard.id, chunkDamage);
        hitBoard = hit.board;
        enemyHits += 1;
        enemiesDefeated += hit.defeated;
        enemyScore += hit.score;
    }

    if (brokenPairKeys.length === 0 && enemyHits === 0) {
        return nothing;
    }
    const broken = new Set(brokenPairKeys);
    const waveOfPair = new Map<string, number>();
    wavePairKeys.forEach((keys, wave) => keys.forEach((pairKey) => waveOfPair.set(pairKey, wave)));
    // The drop is not a wave; it leaves after the last one.
    const lastWave = Math.max(0, wavePairKeys.length - 1);
    const brokenTileIds = hitBoard.tiles.filter((tile) => broken.has(tile.pairKey)).map((tile) => tile.id);
    const waves = wavePairKeys.length;
    return {
        board: {
            ...hitBoard,
            matchedPairs: runNonNegativeInteger(hitBoard.matchedPairs) + brokenPairKeys.length,
            tiles: hitBoard.tiles.map((tile) =>
                broken.has(tile.pairKey)
                    ? {
                          ...tile,
                          state: 'removed' as const,
                          brokenByChunk: true,
                          brokenAtTier: tier,
                          brokenAtWave: waveOfPair.get(tile.pairKey) ?? lastWave,
                          findableKind: undefined,
                          dungeonCardState: tile.dungeonCardKind ? ('resolved' as const) : tile.dungeonCardState
                      }
                    : tile
            )
        },
        tier,
        brokenPairKeys,
        brokenTileIds,
        score: chunkBreakScore(board.level, brokenPairKeys.length, tier, Math.max(1, waves)) + enemyScore + treasureScore,
        comboShardGain: chunkBreakComboShards(brokenPairKeys.length, tier),
        enemyHits,
        enemiesDefeated,
        claimedFindableKind,
        treasureGold,
        droppedPairKeys,
        treasuresSpilled,
        waves,
        wavePairKeys
    };
};
