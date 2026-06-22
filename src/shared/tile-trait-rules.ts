import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    RECALL_FOCUS_MAX,
    type BoardState,
    type RelicId,
    type RouteNodeType,
    type RunState,
    type StartingLoadoutId,
    type Tile,
    type TileTraitKind
} from './contracts';
import { createMulberry32, hashStringToSeed, shuffleWithRng } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

export const TILE_TRAIT_COPY: Record<TileTraitKind, { label: string; match: string; mismatch: string }> = {
    echo: {
        label: 'Echo',
        match: 'Clean match grants +1 peek charge; adjacent Sealed also grants +1 combo shard.',
        mismatch: 'No extra miss penalty.'
    },
    volatile: {
        label: 'Volatile',
        match: 'Clean match safely disarms the volatile pair; adjacent Heavy grants +1 guard token.',
        mismatch: 'Mismatch shuffles safe hidden tiles; adjacent Cursed deepens recall pressure unless buffered by Stasis.'
    },
    mirror: {
        label: 'Mirror',
        match: 'Clean match grants +1 guard token if there is room; adjacent Stasis grants another guard and score.',
        mismatch: 'Mismatch counts as a deeper memory slip.'
    },
    cursed: {
        label: 'Cursed',
        match: 'Clean match grants +1 relic Favor; adjacent Volatile adds gold and score.',
        mismatch: 'Mismatch counts as an extra mistake; adjacent Volatile deepens recall unless Stasis buffers it.'
    },
    sealed: {
        label: 'Sealed',
        match: 'Clean match grants +1 combo shard if there is room; adjacent Heavy adds score.',
        mismatch: 'Mismatch drains 1 peek charge, or deepens the recall slip if empty.'
    },
    heavy: {
        label: 'Heavy',
        match: 'Clean match grants +35 score; adjacency improves Sealed and Volatile rewards.',
        mismatch: 'Mismatch costs +1 extra try but never drains peek charges.'
    },
    drift: {
        label: 'Drift',
        match: 'Clean match grants +1 row/swap charge; adjacent Volatile also grants +1 full shuffle charge.',
        mismatch: 'No extra miss penalty.'
    },
    conduit: {
        label: 'Conduit',
        match: 'Clean match converts nearby traits into score and small resource sparks.',
        mismatch: 'Mismatch near Volatile or Cursed adds a deeper recall slip.'
    },
    stasis: {
        label: 'Stasis',
        match: 'Clean match locks a nearby trait tile from being opened first next turn when completion remains safe.',
        mismatch: 'No extra miss penalty.'
    }
};

export const TILE_TRAIT_MATCH_SCORE_BONUS: Partial<Record<TileTraitKind, number>> = {
    cursed: 15,
    heavy: 35
};

export interface TileTraitEffectResult {
    comboShardGain: number;
    guardTokenGain: number;
    flashPairChargeGain: number;
    interactionTags: TileTraitInteractionTag[];
    peekChargeGain: number;
    recallFocusGain: number;
    relicFavorGain: number;
    regionShuffleChargeGain: number;
    scoreBonus: number;
    shopGoldGain: number;
    shuffleChargeGain: number;
    stickyBlockIndex: number | null;
    blocksVolatileShuffle: boolean;
    peekChargeLoss: number;
    recallMistakesDelta: number;
    triesDelta: number;
}

export interface TileTraitEffectContext {
    run: RunState;
    board?: BoardState | null;
    sourceTiles: readonly Tile[];
    source: 'match' | 'mismatch';
}

export const TILE_TRAIT_INTERACTION_TEXT = {
    'echo:sealed-combo': 'Echo + Sealed: combo shard',
    'mirror:stasis-guard': 'Mirror + Stasis: guard ward',
    'sealed:heavy-score': 'Sealed + Heavy: score surge',
    'cursed:volatile-greed': 'Cursed + Volatile: risky greed',
    'volatile:heavy-guard': 'Volatile + Heavy: guard spark',
    'drift:row-shuffle': 'Drift: row/swap charge',
    'drift:volatile-full-shuffle': 'Drift + Volatile: full shuffle',
    'conduit:adjacent-score': 'Conduit: adjacent trait charge',
    'conduit:mirror-guard': 'Conduit + Mirror: guard spark',
    'conduit:echo-peek': 'Conduit + Echo: peek spark',
    'conduit:stasis-lock': 'Conduit + Stasis: lock pulse',
    'sealed:conduit-spark': 'Sealed + Conduit: shard spark',
    'echo:mirror-focus': 'Echo + Mirror: recall focus',
    'heavy:mirror-guard': 'Heavy + Mirror: braced guard',
    'stasis:nearby-block': 'Stasis: nearby trait blocked',
    'conduit:danger-recall': 'Conduit near danger: recall pressure',
    'stasis:sealed-buffer': 'Stasis buffered Sealed',
    'stasis:cursed-volatile-buffer': 'Stasis buffered Cursed + Volatile',
    'cursed:volatile-danger': 'Cursed + Volatile: recall pressure',
    'chapter-compass:conduit-map': 'Chapter Compass + Conduit: mapped charge',
    'catalyst-thread:sealed-engine': 'Catalyst Thread + Sealed: shard engine',
    'row-compass:drift-routing': 'Row Compass + Drift: extra route charge',
    'warden-sigil:mirror-ward': 'Warden Sigil + Mirror: warded reflection',
    'wager-surety:cursed-buffer': 'Wager Surety buffered cursed risk',
    'reward-perk:echo-conduit-double': 'Echo Conduit Lens: doubled Echo',
    'reward-perk:trait-streak-flash': 'Trait Streak Lens: flash pair',
    'reward-perk:cursed-opener-greed': 'Cursed Opener: first-pair greed'
} as const;

export type TileTraitInteractionTag = keyof typeof TILE_TRAIT_INTERACTION_TEXT;

export const TILE_TRAIT_INTERACTION_TAGS = Object.keys(TILE_TRAIT_INTERACTION_TEXT) as TileTraitInteractionTag[];

export const formatTileTraitInteractionTags = (tags: readonly string[]): string[] => {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const tag of tags) {
        const line =
            tag in TILE_TRAIT_INTERACTION_TEXT
                ? TILE_TRAIT_INTERACTION_TEXT[tag as TileTraitInteractionTag]
                : undefined;
        if (!line || seen.has(line)) {
            continue;
        }
        seen.add(line);
        lines.push(line);
    }
    return lines;
};

const collectTileTraitInteractionTags = ({
    adjacentTraitKinds,
    board,
    source,
    sourceTiles,
    traits
}: {
    adjacentTraitKinds: ReadonlySet<TileTraitKind>;
    board?: BoardState | null;
    source: 'match' | 'mismatch';
    sourceTiles: readonly Tile[];
    traits: ReadonlySet<TileTraitKind>;
}): TileTraitInteractionTag[] => {
    const tags: TileTraitInteractionTag[] = [];
    const hasTrait = (kind: TileTraitKind): boolean => traits.has(kind);

    if (source === 'match') {
        if (hasTrait('echo') && adjacentTraitKinds.has('sealed')) {
            tags.push('echo:sealed-combo');
        }
        if (hasTrait('echo') && adjacentTraitKinds.has('mirror')) {
            tags.push('echo:mirror-focus');
        }
        if (hasTrait('mirror') && adjacentTraitKinds.has('stasis')) {
            tags.push('mirror:stasis-guard');
        }
        if (hasTrait('sealed') && adjacentTraitKinds.has('heavy')) {
            tags.push('sealed:heavy-score');
        }
        if (hasTrait('sealed') && adjacentTraitKinds.has('conduit')) {
            tags.push('sealed:conduit-spark');
        }
        if (hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
            tags.push('cursed:volatile-greed');
        }
        if (hasTrait('volatile') && adjacentTraitKinds.has('heavy')) {
            tags.push('volatile:heavy-guard');
        }
        if (hasTrait('heavy') && adjacentTraitKinds.has('mirror')) {
            tags.push('heavy:mirror-guard');
        }
        if (hasTrait('drift')) {
            tags.push('drift:row-shuffle');
            if (adjacentTraitKinds.has('volatile')) {
                tags.push('drift:volatile-full-shuffle');
            }
        }
        if (hasTrait('conduit') && adjacentTraitKinds.size > 0) {
            tags.push('conduit:adjacent-score');
            if (adjacentTraitKinds.has('mirror')) {
                tags.push('conduit:mirror-guard');
            }
            if (adjacentTraitKinds.has('echo')) {
                tags.push('conduit:echo-peek');
            }
            if (board && adjacentTraitKinds.has('stasis')) {
                tags.push('conduit:stasis-lock');
            }
        }
        if (hasTrait('stasis') && board && selectStasisBlockIndex(board, sourceTiles) !== null) {
            tags.push('stasis:nearby-block');
        }
        return tags;
    }

    if (hasTrait('conduit') && (adjacentTraitKinds.has('volatile') || adjacentTraitKinds.has('cursed'))) {
        tags.push('conduit:danger-recall');
    }
    if (hasTrait('sealed') && adjacentTraitKinds.has('stasis')) {
        tags.push('stasis:sealed-buffer');
    }
    if (hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
        tags.push(adjacentTraitKinds.has('stasis') ? 'stasis:cursed-volatile-buffer' : 'cursed:volatile-danger');
    }
    return tags;
};

export const getTileTraitInteractionPreviewLines = (
    board: BoardState,
    sourceTileIds: readonly string[],
    source: 'match' | 'mismatch' = 'match'
): string[] => {
    const sourceTiles = sourceTileIds
        .map((tileId) => board.tiles.find((tile) => tile.id === tileId))
        .filter((tile): tile is Tile => tile != null);
    if (sourceTiles.length === 0) {
        return [];
    }
    const traits = new Set(sourceTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null));
    if (traits.size === 0) {
        return [];
    }
    const adjacentTraitTiles = collectAdjacentTraitTiles(board, sourceTiles);
    const adjacentTraitKinds = new Set(
        adjacentTraitTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null)
    );
    return formatTileTraitInteractionTags(
        collectTileTraitInteractionTags({
            adjacentTraitKinds,
            board,
            source,
            sourceTiles,
            traits
        })
    );
};

const createBoardWithSwappedTiles = (board: BoardState, firstTileId: string, secondTileId: string): BoardState | null => {
    const firstIndex = board.tiles.findIndex((tile) => tile.id === firstTileId);
    const secondIndex = board.tiles.findIndex((tile) => tile.id === secondTileId);
    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) {
        return null;
    }
    const tiles = [...board.tiles];
    const first = tiles[firstIndex]!;
    tiles[firstIndex] = tiles[secondIndex]!;
    tiles[secondIndex] = first;
    return { ...board, tiles };
};

export const getTileSwapTraitPreviewLines = (
    board: BoardState,
    firstTileId: string | null,
    secondTileId: string
): string[] => {
    if (!firstTileId || firstTileId === secondTileId) {
        return [];
    }
    const swapped = createBoardWithSwappedTiles(board, firstTileId, secondTileId);
    if (!swapped) {
        return [];
    }
    return [
        ...new Set([
            ...getTileTraitInteractionPreviewLines(swapped, [firstTileId], 'match'),
            ...getTileTraitInteractionPreviewLines(swapped, [secondTileId], 'match'),
            ...getTileTraitInteractionPreviewLines(swapped, [firstTileId], 'mismatch'),
            ...getTileTraitInteractionPreviewLines(swapped, [secondTileId], 'mismatch')
        ])
    ];
};

export const getBoardTraitInteractionPreviewLines = (
    board: BoardState,
    source: 'match' | 'mismatch' | 'both' = 'both'
): string[] => {
    const lines = new Set<string>();
    for (const tile of board.tiles) {
        if (tile.tileTraitKind == null || tile.state === 'matched' || tile.state === 'removed') {
            continue;
        }
        const sources: readonly ('match' | 'mismatch')[] = source === 'both' ? ['match', 'mismatch'] : [source];
        for (const previewSource of sources) {
            for (const line of getTileTraitInteractionPreviewLines(board, [tile.id], previewSource)) {
                lines.add(line);
            }
        }
    }
    return [...lines];
};

const createEmptyTraitEffectResult = (): TileTraitEffectResult => ({
    comboShardGain: 0,
    guardTokenGain: 0,
    flashPairChargeGain: 0,
    interactionTags: [],
    peekChargeGain: 0,
    recallFocusGain: 0,
    relicFavorGain: 0,
    regionShuffleChargeGain: 0,
    scoreBonus: 0,
    shopGoldGain: 0,
    shuffleChargeGain: 0,
    stickyBlockIndex: null,
    blocksVolatileShuffle: false,
    peekChargeLoss: 0,
    recallMistakesDelta: 0,
    triesDelta: 0
});

const tileCanReceiveTrait = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.routeCardKind == null &&
    tile.routeSpecialKind == null &&
    !['exit', 'shop', 'room'].includes(tile.dungeonCardKind ?? '') &&
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

const hasRewardPerk = (run: RunState, id: NonNullable<RunState['rewardPerkIds']>[number]): boolean =>
    (run.rewardPerkIds ?? []).includes(id);

const TILE_TRAIT_COLORS: Record<TileTraitKind, string> = {
    echo: '#62d6d1',
    volatile: '#f08f48',
    mirror: '#b890ff',
    cursed: '#e85d87',
    sealed: '#8bc3ff',
    heavy: '#d7b46a',
    drift: '#76d672',
    conduit: '#f5cc48',
    stasis: '#a5b4fc'
};

export const tileTraitColor = (kind: TileTraitKind): string => TILE_TRAIT_COLORS[kind];

const columnsForTileCount = (tileCount: number): number => Math.min(Math.max(Math.ceil(Math.sqrt(tileCount)), 2), 8);

const calculateCoreTraitCount = (eligiblePairCount: number, level: number): number => {
    if (eligiblePairCount <= 0) {
        return 0;
    }
    if (level <= 1) {
        return 1;
    }
    const densityCount = Math.ceil(eligiblePairCount * (level >= 8 ? 0.5 : 0.42));
    const floorBandMinimum = level >= 8 ? 4 : level >= 4 ? 3 : 2;
    return Math.min(Math.max(densityCount, floorBandMinimum), eligiblePairCount);
};

const LOADOUT_TRAIT_PLANS: Record<
    StartingLoadoutId,
    { interactionSeed: readonly [TileTraitKind, TileTraitKind]; pool: readonly TileTraitKind[] }
> = {
    memory_scout: {
        interactionSeed: ['conduit', 'echo'],
        pool: ['echo', 'conduit', 'mirror', 'sealed', 'heavy']
    },
    route_tactician: {
        interactionSeed: ['drift', 'volatile'],
        pool: ['drift', 'volatile', 'conduit', 'echo', 'stasis']
    },
    cursebreaker: {
        interactionSeed: ['mirror', 'stasis'],
        pool: ['mirror', 'stasis', 'cursed', 'sealed', 'volatile']
    },
    vaultbreaker: {
        interactionSeed: ['cursed', 'volatile'],
        pool: ['cursed', 'volatile', 'drift', 'sealed', 'heavy']
    }
};

const routeInteractionSeed = (
    intensity: 'safe' | 'greed' | 'mystery' | null | undefined,
    relicIds: readonly RelicId[],
    startingLoadoutId: StartingLoadoutId | null | undefined
): readonly [TileTraitKind, TileTraitKind] => {
    const loadoutPlan = startingLoadoutId ? LOADOUT_TRAIT_PLANS[startingLoadoutId] : null;
    if (loadoutPlan) {
        return loadoutPlan.interactionSeed;
    }
    if (intensity === 'greed') {
        return ['drift', 'volatile'];
    }
    if (intensity === 'mystery') {
        return relicIds.includes('parasite_ledger') ? ['stasis', 'cursed'] : ['stasis', 'conduit'];
    }
    return relicIds.includes('chapter_compass') ? ['conduit', 'mirror'] : ['conduit', 'echo'];
};

const routeInteractionSeeds = (
    intensity: 'safe' | 'greed' | 'mystery' | null | undefined,
    relicIds: readonly RelicId[],
    startingLoadoutId: StartingLoadoutId | null | undefined
): readonly (readonly [TileTraitKind, TileTraitKind])[] => {
    const primary = routeInteractionSeed(intensity, relicIds, startingLoadoutId);
    const loadoutExtra: Partial<Record<StartingLoadoutId, readonly (readonly [TileTraitKind, TileTraitKind])[]>> = {
        memory_scout: [['echo', 'mirror'], ['sealed', 'conduit']],
        route_tactician: [['drift', 'volatile'], ['volatile', 'heavy']],
        cursebreaker: [['mirror', 'stasis'], ['sealed', 'stasis']],
        vaultbreaker: [['cursed', 'volatile'], ['sealed', 'heavy']]
    };
    const routeExtra: readonly (readonly [TileTraitKind, TileTraitKind])[] =
        intensity === 'safe'
            ? [['echo', 'mirror'], ['sealed', 'conduit'], ['sealed', 'heavy']]
            : intensity === 'greed'
              ? [['cursed', 'volatile'], ['volatile', 'heavy'], ['heavy', 'mirror']]
              : intensity === 'mystery'
                ? [['stasis', 'conduit'], ['mirror', 'stasis'], ['sealed', 'conduit'], ['echo', 'mirror']]
                : [
                      ['echo', 'mirror'],
                      ['sealed', 'conduit'],
                      ['cursed', 'volatile'],
                      ['heavy', 'mirror'],
                      ['drift', 'volatile'],
                      ['stasis', 'conduit']
                  ];
    const seeded = startingLoadoutId ? loadoutExtra[startingLoadoutId] ?? [] : [];
    return [primary, ...seeded, ...routeExtra];
};

const traitPoolForContext = (
    level: number,
    intensity: 'safe' | 'greed' | 'mystery' | null | undefined,
    relicIds: readonly RelicId[],
    startingLoadoutId: StartingLoadoutId | null | undefined
): TileTraitKind[] => {
    const loadoutPool = startingLoadoutId ? LOADOUT_TRAIT_PLANS[startingLoadoutId]?.pool : null;
    const hasChapterCompass = relicIds.includes('chapter_compass');
    const hasWagerSurety = relicIds.includes('wager_surety');
    const hasParasiteLedger = relicIds.includes('parasite_ledger');
    const routePool: TileTraitKind[] =
        level <= 1
            ? ['echo', 'mirror', 'heavy']
            : intensity === 'safe'
            ? hasChapterCompass
                ? ['echo', 'echo', 'mirror', 'sealed', 'conduit']
                : ['echo', 'mirror', 'echo', 'heavy', 'conduit']
            : intensity === 'greed'
              ? hasWagerSurety
                  ? ['volatile', 'cursed', 'echo', 'heavy', 'drift']
                  : ['volatile', 'cursed', 'volatile', 'heavy', 'drift']
              : intensity === 'mystery'
                ? hasParasiteLedger
                    ? ['mirror', 'sealed', 'cursed', 'echo', 'conduit', 'stasis']
                    : ['mirror', 'sealed', 'volatile', 'echo', 'conduit', 'stasis']
                : ['echo', 'volatile', 'mirror', 'cursed', 'sealed', 'heavy', 'drift', 'conduit', 'stasis'];

    return loadoutPool ? [...loadoutPool, ...routePool] : routePool;
};

const collectAdjacentEligiblePairKeys = (
    tiles: readonly Tile[],
    eligiblePairKeys: readonly string[]
): [string, string][] => {
    const eligible = new Set(eligiblePairKeys);
    const columns = columnsForTileCount(tiles.length);
    const pairs: [string, string][] = [];
    const seen = new Set<string>();
    tiles.forEach((tile, index) => {
        if (!eligible.has(tile.pairKey)) {
            return;
        }
        const row = Math.floor(index / columns);
        const neighborIndexes = [index - 1, index + 1, index - columns, index + columns].filter((neighborIndex) => {
            if (neighborIndex < 0 || neighborIndex >= tiles.length) {
                return false;
            }
            if ((neighborIndex === index - 1 || neighborIndex === index + 1) && Math.floor(neighborIndex / columns) !== row) {
                return false;
            }
            return true;
        });
        for (const neighborIndex of neighborIndexes) {
            const neighbor = tiles[neighborIndex]!;
            if (!eligible.has(neighbor.pairKey) || neighbor.pairKey === tile.pairKey) {
                continue;
            }
            const ordered = [tile.pairKey, neighbor.pairKey].sort() as [string, string];
            const key = ordered.join(':');
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push(ordered);
            }
        }
    });
    return pairs;
};

export const getRouteTraitForecastLine = (routeType: RouteNodeType, relicIds: readonly RelicId[] = []): string => {
    const hasChapterCompass = relicIds.includes('chapter_compass');
    const hasWagerSurety = relicIds.includes('wager_surety');
    const hasParasiteLedger = relicIds.includes('parasite_ledger');
    if (routeType === 'safe') {
        return hasChapterCompass
            ? 'Trait pressure: safer Echo/Mirror/Conduit clues, with Compass bias toward readable traits.'
            : 'Trait pressure: mostly Echo/Mirror/Conduit clues and fewer punishing drawbacks.';
    }
    if (routeType === 'greed') {
        return hasWagerSurety
            ? 'Trait pressure: Volatile/Cursed/Drift upside, with Surety softening volatile misses while guarded.'
            : 'Trait pressure: more Volatile/Cursed pairs with Drift reposition rewards.';
    }
    return hasParasiteLedger
        ? 'Trait pressure: Mirror/Sealed/Cursed/Conduit unknowns; Ledger converts cursed matches into extra gold.'
        : 'Trait pressure: Mirror/Sealed unknowns with Conduit/Stasis interactions.';
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
    relicIds: readonly RelicId[] = [],
    startingLoadoutId: StartingLoadoutId | null | undefined = null
): Tile[] => {
    const eligiblePairKeys = [
        ...new Set(tiles.filter(tileCanReceiveTrait).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanReceiveTrait(tile)).length === 2);
    if (eligiblePairKeys.length === 0) {
        return tiles.map((tile) => ({ ...tile }));
    }

    const traitSeedKey = startingLoadoutId
        ? `tileTraits:${rulesVersion}:${runSeed}:${level}:${intensity ?? 'none'}:${startingLoadoutId}`
        : `tileTraits:${rulesVersion}:${runSeed}:${level}:${intensity ?? 'none'}`;
    const rng = createMulberry32(hashStringToSeed(traitSeedKey));
    const traitCount = calculateCoreTraitCount(eligiblePairKeys.length, level);
    const pool = traitPoolForContext(level, intensity, relicIds, startingLoadoutId);
    const shuffledPairKeys = shuffleWithRng(() => rng(), eligiblePairKeys);
    const traitByPairKey = new Map<string, TileTraitKind>();
    if (traitCount >= 2) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys);
        const shuffledAdjacentPairs = shuffleWithRng(() => rng(), adjacentPairs);
        const seeds = routeInteractionSeeds(intensity, relicIds, startingLoadoutId);
        let seedIndex = intensity == null && !startingLoadoutId ? Math.floor(rng() * seeds.length) : 0;
        for (const [firstPairKey, secondPairKey] of shuffledAdjacentPairs) {
            if (traitByPairKey.size + 2 > traitCount) {
                break;
            }
            if (traitByPairKey.has(firstPairKey) || traitByPairKey.has(secondPairKey)) {
                continue;
            }
            const [firstTrait, secondTrait] = seeds[seedIndex % seeds.length]!;
            traitByPairKey.set(firstPairKey, firstTrait);
            traitByPairKey.set(secondPairKey, secondTrait);
            seedIndex += 1;
        }
    }
    shuffledPairKeys.forEach((pairKey, index) => {
        if (traitByPairKey.size >= traitCount || traitByPairKey.has(pairKey)) {
            return;
        }
        const trait = shuffleWithRng(() => rng(), pool)[index % pool.length]!;
        traitByPairKey.set(pairKey, trait);
    });

    const assignedTiles = tiles.map((tile) => {
        const trait = traitByPairKey.get(tile.pairKey);
        return trait ? { ...tile, tileTraitKind: trait } : { ...tile };
    });
    if (traitByPairKey.size >= 2 && getBoardTraitInteractionPreviewLines({ ...({} as BoardState), tiles: assignedTiles, columns: columnsForTileCount(assignedTiles.length) }).length === 0) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys);
        const [firstPairKey, secondPairKey] = adjacentPairs.find(
            ([first, second]) => traitByPairKey.has(first) || traitByPairKey.has(second)
        ) ?? adjacentPairs[0] ?? [];
        if (firstPairKey && secondPairKey) {
            const repairSeeds = routeInteractionSeeds(intensity, relicIds, startingLoadoutId);
            const repairSeedIndex = intensity == null && !startingLoadoutId ? Math.floor(rng() * repairSeeds.length) : 0;
            const [firstTrait, secondTrait] = repairSeeds[repairSeedIndex]!;
            const repairedTraitByPairKey = new Map<string, TileTraitKind>([
                [firstPairKey, firstTrait],
                [secondPairKey, secondTrait]
            ]);
            for (const [pairKey, trait] of traitByPairKey.entries()) {
                if (repairedTraitByPairKey.size >= traitCount) {
                    break;
                }
                if (!repairedTraitByPairKey.has(pairKey)) {
                    repairedTraitByPairKey.set(pairKey, trait);
                }
            }
            return tiles.map((tile) => {
                const trait = repairedTraitByPairKey.get(tile.pairKey);
                return trait ? { ...tile, tileTraitKind: trait } : { ...tile };
            });
        }
    }
    return assignedTiles;
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

const getTileIndex = (board: BoardState, tile: Tile): number => board.tiles.findIndex((candidate) => candidate.id === tile.id);

const getOrthogonalNeighborIndexes = (board: BoardState, index: number): number[] => {
    const columns = Math.max(1, board.columns);
    const row = Math.floor(index / columns);
    const col = index % columns;
    const indexes: number[] = [];
    if (col > 0) {
        indexes.push(index - 1);
    }
    if (col < columns - 1 && index + 1 < board.tiles.length) {
        indexes.push(index + 1);
    }
    if (row > 0) {
        indexes.push(index - columns);
    }
    if (index + columns < board.tiles.length) {
        indexes.push(index + columns);
    }
    return indexes;
};

const collectAdjacentTraitTiles = (board: BoardState, sourceTiles: readonly Tile[]): Tile[] => {
    const sourceIds = new Set(sourceTiles.map((tile) => tile.id));
    const sourcePairKeys = new Set(sourceTiles.map((tile) => tile.pairKey));
    const seenIds = new Set<string>();
    const adjacentTiles: Tile[] = [];
    for (const sourceTile of sourceTiles) {
        const index = getTileIndex(board, sourceTile);
        if (index < 0) {
            continue;
        }
        for (const neighborIndex of getOrthogonalNeighborIndexes(board, index)) {
            const neighbor = board.tiles[neighborIndex];
            if (
                !neighbor ||
                sourceIds.has(neighbor.id) ||
                sourcePairKeys.has(neighbor.pairKey) ||
                seenIds.has(neighbor.id) ||
                neighbor.tileTraitKind == null ||
                neighbor.state === 'matched' ||
                neighbor.state === 'removed'
            ) {
                continue;
            }
            seenIds.add(neighbor.id);
            adjacentTiles.push(neighbor);
        }
    }
    return adjacentTiles;
};

const countRemainingFullyHiddenPairs = (board: BoardState): number => {
    const byPair = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        if (tile.state !== 'hidden' || isSingletonUtilityPairKey(tile.pairKey)) {
            continue;
        }
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
    }
    return [...byPair.values()].filter((tiles) => tiles.length >= 2).length;
};

const selectStasisBlockIndex = (board: BoardState, sourceTiles: readonly Tile[]): number | null => {
    if (countRemainingFullyHiddenPairs(board) <= 1) {
        return null;
    }
    const sourcePairKeys = new Set(sourceTiles.map((tile) => tile.pairKey));
    const candidates = collectAdjacentTraitTiles(board, sourceTiles)
        .map((tile) => ({ index: getTileIndex(board, tile), tile }))
        .filter(({ index, tile }) => index >= 0 && tile.state === 'hidden' && !sourcePairKeys.has(tile.pairKey))
        .sort((a, b) => a.index - b.index);
    return candidates[0]?.index ?? null;
};

export const resolveTileTraitEffects = ({
    run,
    board,
    sourceTiles,
    source
}: TileTraitEffectContext): TileTraitEffectResult => {
    const result = createEmptyTraitEffectResult();
    const traits = new Set(sourceTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null));
    const hasTrait = (kind: TileTraitKind): boolean => traits.has(kind);
    const adjacentTraitTiles = board ? collectAdjacentTraitTiles(board, sourceTiles) : [];
    const adjacentTraitKinds = new Set(
        adjacentTraitTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null)
    );

    if (source === 'match') {
        result.comboShardGain = hasTrait('sealed') && run.stats.comboShards < MAX_COMBO_SHARDS ? 1 : 0;
        result.guardTokenGain =
            (hasTrait('mirror') ? 1 : 0) +
            (hasTrait('volatile') && run.relicIds.includes('wager_surety') && run.stats.guardTokens < MAX_GUARD_TOKENS ? 1 : 0);
        result.peekChargeGain = hasTrait('echo') ? 1 : 0;
        result.relicFavorGain = hasTrait('cursed') ? 1 : 0;
        result.scoreBonus =
            [...traits].reduce((sum, trait) => sum + (TILE_TRAIT_MATCH_SCORE_BONUS[trait] ?? 0), 0) +
            (hasTrait('echo') && run.relicIds.includes('chapter_compass') ? 10 : 0);
        result.shopGoldGain = hasTrait('cursed') && run.relicIds.includes('parasite_ledger') ? 1 : 0;

        if (hasTrait('echo') && adjacentTraitKinds.has('sealed') && run.stats.comboShards < MAX_COMBO_SHARDS) {
            result.comboShardGain += 1;
            result.interactionTags.push('echo:sealed-combo');
        }

        if (hasTrait('echo') && adjacentTraitKinds.has('conduit') && hasRewardPerk(run, 'echo_conduit_double')) {
            result.peekChargeGain += 1;
            if (adjacentTraitKinds.has('sealed') && run.stats.comboShards + result.comboShardGain < MAX_COMBO_SHARDS) {
                result.comboShardGain += 1;
            }
            result.interactionTags.push('reward-perk:echo-conduit-double');
        }

        if (hasTrait('echo') && adjacentTraitKinds.has('mirror') && run.recallFocus < RECALL_FOCUS_MAX) {
            result.recallFocusGain += 1;
            result.interactionTags.push('echo:mirror-focus');
        }

        if (hasTrait('mirror') && adjacentTraitKinds.has('stasis')) {
            result.guardTokenGain += 1;
            result.scoreBonus += 10;
            result.interactionTags.push('mirror:stasis-guard');
        }

        if (hasTrait('sealed') && adjacentTraitKinds.has('heavy')) {
            result.scoreBonus += 20;
            result.interactionTags.push('sealed:heavy-score');
        }

        if (hasTrait('sealed') && adjacentTraitKinds.has('conduit')) {
            if (run.stats.comboShards + result.comboShardGain < MAX_COMBO_SHARDS) {
                result.comboShardGain += 1;
            } else {
                result.scoreBonus += 18;
            }
            result.scoreBonus += 10;
            result.interactionTags.push('sealed:conduit-spark');
        }

        if (hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
            result.shopGoldGain += 1;
            result.scoreBonus += 20;
            result.interactionTags.push('cursed:volatile-greed');
        }

        if (hasTrait('cursed') && run.matchResolutionsThisFloor === 0 && hasRewardPerk(run, 'cursed_opener_greed')) {
            result.shopGoldGain += 1;
            result.scoreBonus += 25;
            result.interactionTags.push('reward-perk:cursed-opener-greed');
        }

        if (hasTrait('volatile') && adjacentTraitKinds.has('heavy')) {
            result.guardTokenGain += 1;
            result.interactionTags.push('volatile:heavy-guard');
        }

        if (hasTrait('heavy') && adjacentTraitKinds.has('mirror')) {
            result.guardTokenGain += 1;
            result.scoreBonus += 15;
            result.interactionTags.push('heavy:mirror-guard');
        }

        if (hasTrait('drift')) {
            result.regionShuffleChargeGain += 1;
            result.interactionTags.push('drift:row-shuffle');
            if (adjacentTraitKinds.has('volatile')) {
                result.shuffleChargeGain += 1;
                result.interactionTags.push('drift:volatile-full-shuffle');
            }
        }

        if (hasTrait('conduit') && adjacentTraitTiles.length > 0) {
            result.scoreBonus += adjacentTraitTiles.length * 12;
            result.interactionTags.push('conduit:adjacent-score');
            if (adjacentTraitKinds.has('mirror')) {
                result.guardTokenGain += 1;
                result.interactionTags.push('conduit:mirror-guard');
            }
            if (adjacentTraitKinds.has('echo')) {
                result.peekChargeGain += 1;
                result.interactionTags.push('conduit:echo-peek');
            }
            if (adjacentTraitKinds.has('stasis') && board) {
                const blockIndex = selectStasisBlockIndex(board, sourceTiles);
                if (blockIndex !== null) {
                    result.stickyBlockIndex = blockIndex;
                    result.scoreBonus += 10;
                }
                result.interactionTags.push('conduit:stasis-lock');
            }
            if (run.relicIds.includes('chapter_compass')) {
                result.peekChargeGain += 1;
                result.scoreBonus += 10;
                result.interactionTags.push('chapter-compass:conduit-map');
            }
        }

        if (hasTrait('stasis') && board) {
            result.stickyBlockIndex = selectStasisBlockIndex(board, sourceTiles);
            if (result.stickyBlockIndex !== null) {
                result.scoreBonus += 10;
                result.interactionTags.push('stasis:nearby-block');
            }
        }

        if (traits.size > 0 && run.stats.currentStreak >= 2 && hasRewardPerk(run, 'trait_streak_toolkit')) {
            result.flashPairChargeGain += 1;
            result.interactionTags.push('reward-perk:trait-streak-flash');
        }

        if (hasTrait('sealed') && run.relicIds.includes('combo_shard_plus_step')) {
            const acceptedShardGain = Math.max(0, MAX_COMBO_SHARDS - (run.stats.comboShards + result.comboShardGain));
            if (acceptedShardGain > 0) {
                result.comboShardGain += 1;
            } else {
                result.scoreBonus += 18;
            }
            result.interactionTags.push('catalyst-thread:sealed-engine');
        }

        if (hasTrait('drift') && run.relicIds.includes('region_shuffle_free_first')) {
            result.regionShuffleChargeGain += 1;
            result.scoreBonus += 10;
            result.interactionTags.push('row-compass:drift-routing');
        }

        if (hasTrait('mirror') && run.relicIds.includes('guard_token_plus_one')) {
            if (run.stats.guardTokens + result.guardTokenGain < MAX_GUARD_TOKENS) {
                result.guardTokenGain += 1;
            } else {
                result.scoreBonus += 20;
            }
            result.interactionTags.push('warden-sigil:mirror-ward');
        }

        return result;
    }

    const stasisBuffersSealed = hasTrait('sealed') && adjacentTraitKinds.has('stasis');
    const sealedPeekLoss = hasTrait('sealed') && !stasisBuffersSealed && run.peekCharges > 0 ? 1 : 0;
    result.blocksVolatileShuffle = hasTrait('volatile') && run.relicIds.includes('wager_surety') && run.stats.guardTokens > 0;
    result.peekChargeLoss = sealedPeekLoss;
    result.recallMistakesDelta =
        (hasTrait('mirror') ? 1 : 0) +
        (hasTrait('sealed') && sealedPeekLoss === 0 && !stasisBuffersSealed ? 1 : 0) +
        (hasTrait('conduit') && (adjacentTraitKinds.has('volatile') || adjacentTraitKinds.has('cursed')) ? 1 : 0) +
        (hasTrait('cursed') && adjacentTraitKinds.has('volatile') && !adjacentTraitKinds.has('stasis') ? 1 : 0);
    result.triesDelta = (hasTrait('mirror') ? 1 : 0) + (hasTrait('cursed') ? 1 : 0) + (hasTrait('heavy') ? 1 : 0);
    if (hasTrait('conduit') && (adjacentTraitKinds.has('volatile') || adjacentTraitKinds.has('cursed'))) {
        result.interactionTags.push('conduit:danger-recall');
    }
    if (stasisBuffersSealed) {
        result.interactionTags.push('stasis:sealed-buffer');
    }
    if (hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
        result.interactionTags.push(
            adjacentTraitKinds.has('stasis') ? 'stasis:cursed-volatile-buffer' : 'cursed:volatile-danger'
        );
    }
    if (run.relicIds.includes('wager_surety') && hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
        result.triesDelta = Math.max(0, result.triesDelta - 1);
        result.interactionTags.push('wager-surety:cursed-buffer');
    }
    return result;
};

export const calculateTileTraitMatchRewards = (
    run: RunState,
    matchedTiles: readonly Tile[],
    board?: BoardState | null
): {
    comboShardGain: number;
    guardTokenGain: number;
    peekChargeGain: number;
    relicFavorGain: number;
    scoreBonus: number;
    shopGoldGain: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles: matchedTiles, source: 'match' });
    return {
        comboShardGain: effect.comboShardGain,
        guardTokenGain: effect.guardTokenGain,
        peekChargeGain: effect.peekChargeGain,
        relicFavorGain: effect.relicFavorGain,
        scoreBonus: effect.scoreBonus,
        shopGoldGain: effect.shopGoldGain
    };
};

export const calculateTileTraitMismatchPenalty = (
    run: RunState,
    sourceTiles: readonly Tile[],
    board?: BoardState | null
): {
    blocksVolatileShuffle: boolean;
    peekChargeLoss: number;
    recallMistakesDelta: number;
    triesDelta: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles, source: 'mismatch' });
    return {
        blocksVolatileShuffle: effect.blocksVolatileShuffle,
        peekChargeLoss: effect.peekChargeLoss,
        recallMistakesDelta: effect.recallMistakesDelta,
        triesDelta: effect.triesDelta
    };
};
