import type { SessionStats, Tile, TileTraitKind } from './contracts';
import { calculateRating } from './scoring-rules';

export const TILE_TRAIT_COUNT_KINDS: readonly TileTraitKind[] = ['echo', 'volatile', 'mirror', 'cursed', 'sealed', 'heavy'];

export const createTileTraitCountStats = (): Record<TileTraitKind, number> => ({
    echo: 0,
    volatile: 0,
    mirror: 0,
    cursed: 0,
    sealed: 0,
    heavy: 0
});

export const addTileTraitCountStats = (
    counts: Partial<Record<TileTraitKind, number>> | undefined,
    tiles: readonly Tile[]
): Record<TileTraitKind, number> => {
    const next = createTileTraitCountStats();
    for (const kind of TILE_TRAIT_COUNT_KINDS) {
        next[kind] = counts?.[kind] ?? 0;
    }
    const countedPairTraits = new Set<string>();
    for (const tile of tiles) {
        if (!tile.tileTraitKind) {
            continue;
        }
        const key = `${tile.pairKey}:${tile.tileTraitKind}`;
        if (countedPairTraits.has(key)) {
            continue;
        }
        countedPairTraits.add(key);
        next[tile.tileTraitKind] += 1;
    }
    return next;
};

export const createSessionStats = (bestScore: number): SessionStats => ({
    totalScore: 0,
    currentLevelScore: 0,
    bestScore,
    tries: 0,
    rating: calculateRating(0),
    levelsCleared: 0,
    matchesFound: 0,
    mismatches: 0,
    highestLevel: 1,
    currentStreak: 0,
    bestStreak: 0,
    perfectClears: 0,
    guardTokens: 0,
    comboShards: 0,
    tileTraitMatches: createTileTraitCountStats(),
    tileTraitMismatches: createTileTraitCountStats(),
    volatileTraitShuffles: 0,
    shufflesUsed: 0,
    pairsDestroyed: 0
});
