import type { Rating, SessionStats, Tile, TileTraitKind } from './contracts';
import { calculateRating } from './scoring-rules';

export const TILE_TRAIT_COUNT_KINDS: readonly TileTraitKind[] = [
    'echo',
    'volatile',
    'mirror',
    'cursed',
    'sealed',
    'heavy',
    'drift',
    'conduit',
    'stasis'
];

export const createTileTraitCountStats = (): Record<TileTraitKind, number> => ({
    echo: 0,
    volatile: 0,
    mirror: 0,
    cursed: 0,
    sealed: 0,
    heavy: 0,
    drift: 0,
    conduit: 0,
    stasis: 0
});

const nonNegativeSessionCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value != null && typeof value === 'object' && !Array.isArray(value);

const isRating = (value: unknown): value is Rating =>
    value === 'S++' || value === 'S' || value === 'A' || value === 'B' || value === 'C' || value === 'D';

export const normalizeTileTraitCountStats = (counts: unknown): Record<TileTraitKind, number> => {
    const source = isRecord(counts) ? counts : {};
    const next = createTileTraitCountStats();
    for (const kind of TILE_TRAIT_COUNT_KINDS) {
        next[kind] = nonNegativeSessionCount(source[kind]);
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
    guardTokens: 0,
    comboShards: 0,
    tileTraitMatches: createTileTraitCountStats(),
    tileTraitMismatches: createTileTraitCountStats(),
    volatileTraitShuffles: 0,
    shufflesUsed: 0,
    pairsDestroyed: 0
});

export const normalizeSessionStats = (stats: unknown, bestScoreFallback = 0): SessionStats => {
    const source = isRecord(stats) ? stats : {};
    const tries = nonNegativeSessionCount(source.tries);
    return {
        totalScore: nonNegativeSessionCount(source.totalScore),
        currentLevelScore: nonNegativeSessionCount(source.currentLevelScore),
        bestScore: nonNegativeSessionCount(source.bestScore ?? bestScoreFallback),
        tries,
        rating: isRating(source.rating) ? source.rating : calculateRating(tries),
        levelsCleared: nonNegativeSessionCount(source.levelsCleared),
        matchesFound: nonNegativeSessionCount(source.matchesFound),
        mismatches: nonNegativeSessionCount(source.mismatches),
        highestLevel: Math.max(1, nonNegativeSessionCount(source.highestLevel)),
        currentStreak: nonNegativeSessionCount(source.currentStreak),
        bestStreak: nonNegativeSessionCount(source.bestStreak),
        perfectClears: nonNegativeSessionCount(source.perfectClears),
        guardTokens: nonNegativeSessionCount(source.guardTokens),
        comboShards: nonNegativeSessionCount(source.comboShards),
        tileTraitMatches: normalizeTileTraitCountStats(source.tileTraitMatches),
        tileTraitMismatches: normalizeTileTraitCountStats(source.tileTraitMismatches),
        volatileTraitShuffles: nonNegativeSessionCount(source.volatileTraitShuffles),
        shufflesUsed: nonNegativeSessionCount(source.shufflesUsed),
        pairsDestroyed: nonNegativeSessionCount(source.pairsDestroyed)
    };
};
