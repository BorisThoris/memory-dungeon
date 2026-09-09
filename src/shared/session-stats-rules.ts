import type { Rating, SessionStats, Tile, TileTraitKind } from './contracts';
import { runRecord } from './run-record-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateRating } from './scoring-rules';

export const TILE_TRAIT_COUNT_KINDS: readonly TileTraitKind[] = ['echo', 'heavy', 'conduit', 'stasis'];

export const createTileTraitCountStats = (): Record<TileTraitKind, number> => ({
    echo: 0,
    heavy: 0,
    conduit: 0,
    stasis: 0
});

const isRating = (value: unknown): value is Rating =>
    value === 'S++' || value === 'S' || value === 'A' || value === 'B' || value === 'C' || value === 'D';

export const normalizeTileTraitCountStats = (counts: unknown): Record<TileTraitKind, number> => {
    const source = runRecord(counts);
    const next = createTileTraitCountStats();
    for (const kind of TILE_TRAIT_COUNT_KINDS) {
        next[kind] = runNonNegativeInteger(source[kind]);
    }
    return next;
};

export const addTileTraitCountStats = (
    counts: Partial<Record<TileTraitKind, number>> | undefined,
    tiles: readonly Tile[]
): Record<TileTraitKind, number> => {
    const next = normalizeTileTraitCountStats(counts);
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
    tileTraitMatches: createTileTraitCountStats(),
    tileTraitMismatches: createTileTraitCountStats(),
    shufflesUsed: 0,
    pairsDestroyed: 0
});

export const normalizeSessionStats = (stats: unknown, bestScoreFallback = 0): SessionStats => {
    const source = runRecord(stats);
    const tries = runNonNegativeInteger(source.tries);
    return {
        totalScore: runNonNegativeInteger(source.totalScore),
        currentLevelScore: runNonNegativeInteger(source.currentLevelScore),
        bestScore: runNonNegativeInteger(source.bestScore ?? bestScoreFallback),
        tries,
        rating: isRating(source.rating) ? source.rating : calculateRating(tries),
        levelsCleared: runNonNegativeInteger(source.levelsCleared),
        matchesFound: runNonNegativeInteger(source.matchesFound),
        mismatches: runNonNegativeInteger(source.mismatches),
        highestLevel: Math.max(1, runNonNegativeInteger(source.highestLevel)),
        currentStreak: runNonNegativeInteger(source.currentStreak),
        bestStreak: runNonNegativeInteger(source.bestStreak),
        perfectClears: runNonNegativeInteger(source.perfectClears),
        tileTraitMatches: normalizeTileTraitCountStats(source.tileTraitMatches),
        tileTraitMismatches: normalizeTileTraitCountStats(source.tileTraitMismatches),
        shufflesUsed: runNonNegativeInteger(source.shufflesUsed),
        pairsDestroyed: runNonNegativeInteger(source.pairsDestroyed)
    };
};
