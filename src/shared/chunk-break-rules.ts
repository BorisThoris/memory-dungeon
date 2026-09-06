import type { BoardState, RunState, Tile } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateMatchScore } from './scoring-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The chunk break: what a chain buys you.
 *
 * A correct match with a chain behind it does not just clear its own pair. It breaks the
 * same-suit tiles around it, and their partners go with them wherever they are — a wave of
 * shatters out from the match and answering pops across the board. One small, skilled input, a
 * large visible consequence, bigger the better you have been playing. That is the whole loop.
 *
 * What it is not: a way to skip the memory game. Cascaded pairs score less than a matched pair,
 * carry no streak, recall or rating credit, and only ever take plain pair tiles — never the exit,
 * a dungeon card, a route special, a findable or a hazard. Memory still pays best; the chunk
 * makes it faster and louder. See `docs/CHAIN_CHUNK_FEVER_DESIGN.md` §2.3.
 */
export interface ChunkBreakResult {
    board: BoardState;
    tier: ChainTier;
    /** Pair keys that broke, in region order. Empty when nothing broke. */
    brokenPairKeys: string[];
    /** Every tile id that left the board, both halves of each pair. */
    brokenTileIds: string[];
    score: number;
    comboShardGain: number;
}

/** Only plain pair tiles break. Everything with a job of its own stays on the board. */
export const tileCanBreakInChunk = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.dungeonBossId == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.findableKind == null &&
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

/**
 * The connected same-suit region around a set of seed tiles, walking through hidden tiles only.
 * Returns tile indices, seeds excluded. `depth` of 1 is the seeds' neighbours; `Infinity` is the
 * whole region.
 */
export const findSuitRegion = (
    board: Pick<BoardState, 'columns' | 'tiles'>,
    seedTileIds: readonly string[],
    depth: number
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
    const seen = new Set<number>(seeds);
    const region: number[] = [];
    let frontier = [...seeds];
    for (let step = 0; step < depth && frontier.length > 0; step += 1) {
        const next: number[] = [];
        for (const from of frontier) {
            for (const cell of orthogonalNeighbours(from, columns, total)) {
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

/** Score for a chunk of `pairs` pairs on `level`: half a base match per pair, rising with size. */
export const chunkBreakScore = (level: number, pairs: number, tier: ChainTier): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 0;
    const perPair = Math.floor(calculateMatchScore(level, 0) * 0.5);
    const sizeBonus = 5 * count * (count - 1);
    const feverLift = tier === 'fever' ? 1.5 : 1;
    return Math.floor((perPair * count + sizeBonus) * feverLift);
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
    run: Pick<RunState, 'gameMode'>;
    matchedTileIds: readonly string[];
    chain: number;
}): ChunkBreakResult => {
    const tier = getChainTier(chain);
    const nothing: ChunkBreakResult = { board, tier, brokenPairKeys: [], brokenTileIds: [], score: 0, comboShardGain: 0 };
    if (tier === 'none' || run.gameMode === 'meditation') {
        return nothing;
    }

    const region = findSuitRegion(board, matchedTileIds, tier === 'clean' ? 1 : Number.POSITIVE_INFINITY);
    const byPairKey = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        byPairKey.set(tile.pairKey, [...(byPairKey.get(tile.pairKey) ?? []), tile]);
    }
    const brokenPairKeys: string[] = [];
    for (const index of region) {
        const tile = board.tiles[index]!;
        if (brokenPairKeys.includes(tile.pairKey)) continue;
        if (!tileCanBreakInChunk(tile)) continue;
        if (board.cursedPairKey && tile.pairKey === board.cursedPairKey) continue;
        // Pairs leave together, always. If the partner cannot go, neither does this tile.
        const pair = byPairKey.get(tile.pairKey) ?? [];
        if (pair.length !== 2 || !pair.every(tileCanBreakInChunk)) continue;
        brokenPairKeys.push(tile.pairKey);
    }
    if (brokenPairKeys.length === 0) {
        return nothing;
    }
    const broken = new Set(brokenPairKeys);
    const brokenTileIds = board.tiles.filter((tile) => broken.has(tile.pairKey)).map((tile) => tile.id);
    return {
        board: {
            ...board,
            matchedPairs: runNonNegativeInteger(board.matchedPairs) + brokenPairKeys.length,
            tiles: board.tiles.map((tile) => (broken.has(tile.pairKey) ? { ...tile, state: 'removed' as const } : tile))
        },
        tier,
        brokenPairKeys,
        brokenTileIds,
        score: chunkBreakScore(board.level, brokenPairKeys.length, tier),
        comboShardGain: chunkBreakComboShards(brokenPairKeys.length, tier)
    };
};
