import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    type BoardState,
    type RelicId,
    type RouteNodeType,
    type RunState,
    type Tile,
    type TileTraitKind
} from './contracts';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

export const TILE_TRAIT_COPY: Record<TileTraitKind, { label: string; match: string; mismatch: string }> = {
    echo: {
        label: 'Echo',
        match: 'Clean match grants +1 peek charge.',
        mismatch: 'No extra miss penalty.'
    },
    volatile: {
        label: 'Volatile',
        match: 'Clean match safely disarms the volatile pair.',
        mismatch: 'Mismatch shuffles safe hidden tiles.'
    },
    mirror: {
        label: 'Mirror',
        match: 'Clean match grants +1 guard token if there is room.',
        mismatch: 'Mismatch counts as a deeper memory slip.'
    },
    cursed: {
        label: 'Cursed',
        match: 'Clean match grants +1 relic Favor.',
        mismatch: 'Mismatch counts as an extra mistake.'
    },
    sealed: {
        label: 'Sealed',
        match: 'Clean match grants +1 combo shard if there is room.',
        mismatch: 'Mismatch drains 1 peek charge, or deepens the recall slip if empty.'
    },
    heavy: {
        label: 'Heavy',
        match: 'Clean match grants +35 score.',
        mismatch: 'Mismatch has no extra penalty, but the pair still costs a normal miss.'
    }
};

export const TILE_TRAIT_MATCH_SCORE_BONUS: Partial<Record<TileTraitKind, number>> = {
    cursed: 15,
    heavy: 35
};

const tileCanReceiveTrait = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.findableKind == null &&
    tile.routeCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.dungeonCardKind == null &&
    tile.tileHazardKind == null &&
    tile.tileTraitKind == null;

const tileCanShuffleFromVolatileMiss = (tile: Tile, blockedPairKeys: ReadonlySet<string>): boolean =>
    tile.state === 'hidden' &&
    !blockedPairKeys.has(tile.pairKey) &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.routeCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.findableKind == null &&
    tile.tileHazardKind == null;

export const tileTraitColor = (kind: TileTraitKind): string =>
    kind === 'echo'
        ? '#62d6d1'
        : kind === 'volatile'
          ? '#f08f48'
          : kind === 'mirror'
            ? '#b890ff'
            : kind === 'cursed'
              ? '#e85d87'
              : kind === 'sealed'
                ? '#8bc3ff'
                : '#d7b46a';

export const getRouteTraitForecastLine = (routeType: RouteNodeType, relicIds: readonly RelicId[] = []): string => {
    const hasChapterCompass = relicIds.includes('chapter_compass');
    const hasWagerSurety = relicIds.includes('wager_surety');
    const hasParasiteLedger = relicIds.includes('parasite_ledger');
    if (routeType === 'safe') {
        return hasChapterCompass
            ? 'Trait pressure: safer Echo/Mirror clues, with Compass bias toward readable traits.'
            : 'Trait pressure: mostly Echo/Mirror clues and fewer punishing drawbacks.';
    }
    if (routeType === 'greed') {
        return hasWagerSurety
            ? 'Trait pressure: Volatile/Cursed upside, with Surety softening volatile misses while guarded.'
            : 'Trait pressure: more Volatile/Cursed pairs for higher reward-risk.';
    }
    return hasParasiteLedger
        ? 'Trait pressure: Mirror/Sealed/Cursed unknowns; Ledger converts cursed matches into extra gold.'
        : 'Trait pressure: Mirror/Sealed unknowns with fair reveal counterplay.';
};

export const getTileTraitText = (tile: Tile): string => {
    if (!tile.tileTraitKind) {
        return '';
    }
    const copy = TILE_TRAIT_COPY[tile.tileTraitKind];
    return ` Trait: ${copy.label}. ${copy.match} ${copy.mismatch}`;
};

export const tileTraitKindsInTiles = (
    tiles: readonly Tile[],
    ids: readonly string[]
): Set<TileTraitKind> => {
    const idsSet = new Set(ids);
    const kinds = new Set<TileTraitKind>();
    for (const tile of tiles) {
        if (idsSet.has(tile.id) && tile.tileTraitKind) {
            kinds.add(tile.tileTraitKind);
        }
    }
    return kinds;
};

export const assignTileTraitsToGeneratedBoard = (
    tiles: readonly Tile[],
    runSeed: number,
    rulesVersion: number,
    level: number,
    intensity: 'safe' | 'greed' | 'mystery' | null | undefined,
    relicIds: readonly RelicId[] = []
): Tile[] => {
    if (level < 2) {
        return tiles.map((tile) => ({ ...tile }));
    }

    const eligiblePairKeys = [
        ...new Set(tiles.filter(tileCanReceiveTrait).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanReceiveTrait(tile)).length === 2);
    if (eligiblePairKeys.length === 0) {
        return tiles.map((tile) => ({ ...tile }));
    }

    const rng = createMulberry32(hashStringToSeed(`tileTraits:${rulesVersion}:${runSeed}:${level}:${intensity ?? 'none'}`));
    const traitCount = Math.min(level >= 11 ? 3 : level >= 6 ? 2 : 1, eligiblePairKeys.length);
    const hasChapterCompass = relicIds.includes('chapter_compass');
    const hasWagerSurety = relicIds.includes('wager_surety');
    const hasParasiteLedger = relicIds.includes('parasite_ledger');
    const pool: TileTraitKind[] =
        intensity === 'safe'
            ? hasChapterCompass
                ? ['echo', 'echo', 'mirror', 'sealed']
                : ['echo', 'mirror', 'echo', 'heavy']
            : intensity === 'greed'
              ? hasWagerSurety
                  ? ['volatile', 'cursed', 'echo', 'heavy']
                  : ['volatile', 'cursed', 'volatile', 'heavy']
              : intensity === 'mystery'
                ? hasParasiteLedger
                    ? ['mirror', 'sealed', 'cursed', 'echo']
                    : ['mirror', 'sealed', 'volatile', 'echo']
                : ['echo', 'volatile', 'mirror', 'cursed', 'sealed', 'heavy'];
    const pickedPairKeys = shuffleWithRng(() => rng(), eligiblePairKeys).slice(0, traitCount);
    const traitByPairKey = new Map<string, TileTraitKind>();
    pickedPairKeys.forEach((pairKey, index) => {
        const trait = shuffleWithRng(() => rng(), pool)[index % pool.length]!;
        traitByPairKey.set(pairKey, trait);
    });

    return tiles.map((tile) => {
        const trait = traitByPairKey.get(tile.pairKey);
        return trait ? { ...tile, tileTraitKind: trait } : { ...tile };
    });
};

export const applyVolatileMismatchTrait = (
    board: BoardState,
    run: RunState,
    sourceTiles: readonly Tile[]
): { board: BoardState; triggered: boolean } => {
    if (!sourceTiles.some((tile) => tile.tileTraitKind === 'volatile')) {
        return { board, triggered: false };
    }
    const blockedPairKeys = new Set(sourceTiles.map((tile) => tile.pairKey));
    const hiddenIndices: number[] = [];
    board.tiles.forEach((tile, index) => {
        if (tileCanShuffleFromVolatileMiss(tile, blockedPairKeys)) {
            hiddenIndices.push(index);
        }
    });
    if (hiddenIndices.length < 2) {
        return { board, triggered: false };
    }
    const rng = createMulberry32(
        hashStringToSeed(
            `volatileTrait:${run.runRulesVersion}:${run.runSeed}:${board.level}:${run.stats.mismatches}:${run.flipHistory.length}`
        )
    );
    const nextTiles = [...board.tiles];
    const candidates = hiddenIndices.map((index) => board.tiles[index]!);
    const shuffled = shuffleWithRng(
        () => rng(),
        candidates
    );
    if (shuffled.every((tile, index) => tile.id === candidates[index]?.id)) {
        shuffled.push(shuffled.shift()!);
    }
    hiddenIndices.forEach((index, slot) => {
        nextTiles[index] = shuffled[slot]!;
    });
    return { board: { ...board, tiles: nextTiles }, triggered: true };
};

export const calculateTileTraitMatchRewards = (
    run: RunState,
    matchedTiles: readonly Tile[]
): {
    comboShardGain: number;
    guardTokenGain: number;
    peekChargeGain: number;
    relicFavorGain: number;
    scoreBonus: number;
    shopGoldGain: number;
} => {
    const traits = new Set(matchedTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null));
    const hasTrait = (kind: TileTraitKind): boolean => traits.has(kind);
    return {
        comboShardGain: hasTrait('sealed') && run.stats.comboShards < MAX_COMBO_SHARDS ? 1 : 0,
        guardTokenGain:
            (hasTrait('mirror') ? 1 : 0) +
            (hasTrait('volatile') && run.relicIds.includes('wager_surety') && run.stats.guardTokens < MAX_GUARD_TOKENS ? 1 : 0),
        peekChargeGain: hasTrait('echo') ? 1 : 0,
        relicFavorGain: hasTrait('cursed') ? 1 : 0,
        scoreBonus:
            [...traits].reduce((sum, trait) => sum + (TILE_TRAIT_MATCH_SCORE_BONUS[trait] ?? 0), 0) +
            (hasTrait('echo') && run.relicIds.includes('chapter_compass') ? 10 : 0),
        shopGoldGain: hasTrait('cursed') && run.relicIds.includes('parasite_ledger') ? 1 : 0
    };
};

export const calculateTileTraitMismatchPenalty = (
    run: RunState,
    sourceTiles: readonly Tile[]
): {
    blocksVolatileShuffle: boolean;
    peekChargeLoss: number;
    recallMistakesDelta: number;
    triesDelta: number;
} => {
    const traits = tileTraitKindsInTiles(sourceTiles, sourceTiles.map((tile) => tile.id));
    const sealedPeekLoss = traits.has('sealed') && run.peekCharges > 0 ? 1 : 0;
    const blocksVolatileShuffle =
        traits.has('volatile') && run.relicIds.includes('wager_surety') && run.stats.guardTokens > 0;
    return {
        blocksVolatileShuffle,
        peekChargeLoss: sealedPeekLoss,
        recallMistakesDelta: (traits.has('mirror') ? 1 : 0) + (traits.has('sealed') && sealedPeekLoss === 0 ? 1 : 0),
        triesDelta: (traits.has('mirror') ? 1 : 0) + (traits.has('cursed') ? 1 : 0)
    };
};
