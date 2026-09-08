import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    RECALL_FOCUS_MAX,
    type BoardState,
    type RunState,
    type Tile,
    type TileTraitKind
} from './contracts';
import {
    createGameplayDefinitionCommand,
    getGameplayContentDefinition,
    type GameplayCommand,
    type GameplayEvent,
    type GameplayFacts
} from './gameplay-core-contracts';
import { applyGameplayDefinitionTransition } from './gameplay-effect-transition';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { runArrayCount } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
export {
    formatTileTraitInteractionTags,
    TILE_TRAIT_INTERACTION_TAGS,
    TILE_TRAIT_INTERACTION_TEXT,
    type TileTraitInteractionTag
} from './tile-trait-interaction-copy';
import { formatTileTraitInteractionTags, type TileTraitInteractionTag } from './tile-trait-interaction-copy';
import { describeTraitMark, tileTraitMark } from './tile-trait-marks';

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
        match: 'Clean match adds score; adjacent Volatile adds more score.',
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
    regionShuffleChargeGain: number;
    scoreBonus: number;
    shuffleChargeGain: number;
    stickyBlockIndex: number | null;
    peekChargeLoss: number;
    recallMistakesDelta: number;
    triesDelta: number;
    gameplayEvents?: GameplayEvent[];
    gameplayCommands?: GameplayCommand[];
}

export interface TileTraitEffectContext {
    run: RunState;
    board?: BoardState | null;
    sourceTiles: readonly Tile[];
    source: 'match' | 'mismatch';
    gameplayEffectContext?: {
        commandId: string;
        events: GameplayEvent[];
    };
}

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
    const first = tiles[firstIndex];
    const second = tiles[secondIndex];
    if (!first || !second) {
        return null;
    }
    tiles[firstIndex] = second;
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

export const countTraitComboOpportunityPairs = (board: BoardState): number => {
    const seenPairs = new Set<string>();
    for (const tile of board.tiles) {
        if (!tile.tileTraitKind || seenPairs.has(tile.pairKey)) {
            continue;
        }
        const previewLines = [
            ...getTileTraitInteractionPreviewLines(board, [tile.id], 'match'),
            ...getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch')
        ];
        if (previewLines.length > 0) {
            seenPairs.add(tile.pairKey);
        }
    }
    return seenPairs.size;
};

export const hasTraitSwapSetupOpportunity = (board: BoardState): boolean => {
    const hiddenTiles = board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.state === 'hidden');
    const beforeMatchLines = new Set(getBoardTraitInteractionPreviewLines(board, 'match'));
    for (let i = 0; i < hiddenTiles.length; i += 1) {
        for (let j = i + 1; j < hiddenTiles.length; j += 1) {
            const first = hiddenTiles[i];
            const second = hiddenTiles[j];
            if (!first || !second) {
                continue;
            }
            if (!first.tile.tileTraitKind && !second.tile.tileTraitKind) {
                continue;
            }
            const tiles = [...board.tiles];
            tiles[first.index] = second.tile;
            tiles[second.index] = first.tile;
            const afterMatchLines = getBoardTraitInteractionPreviewLines({ ...board, tiles }, 'match');
            if (afterMatchLines.some((line) => !beforeMatchLines.has(line))) {
                return true;
            }
        }
    }
    return false;
};

export const countTraitInteractionLines = (board: BoardState): number =>
    getBoardTraitInteractionPreviewLines(board).length;

export const hasTraitRewardInteractionFloor = (board: BoardState): boolean =>
    getBoardTraitInteractionPreviewLines(board, 'match').some(
        (line) =>
            line.includes('combo shard') ||
            line.includes('guard') ||
            line.includes('peek') ||
            line.includes('charge') ||
            line.includes('score')
    );

export const hasTraitBoardPowerInteractionOpportunity = (board: BoardState, hasSwapSetup: boolean): boolean =>
    hasSwapSetup || board.tiles.some((tile) => tile.tileTraitKind === 'drift' || tile.tileTraitKind === 'stasis');

const createEmptyTraitEffectResult = (): TileTraitEffectResult => ({
    comboShardGain: 0,
    guardTokenGain: 0,
    flashPairChargeGain: 0,
    interactionTags: [],
    peekChargeGain: 0,
    recallFocusGain: 0,
    regionShuffleChargeGain: 0,
    scoreBonus: 0,
    shuffleChargeGain: 0,
    stickyBlockIndex: null,
    peekChargeLoss: 0,
    recallMistakesDelta: 0,
    triesDelta: 0
});

const tileCanReceiveTrait = (tile: Tile): boolean =>
    tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey) && tile.tileTraitKind == null;

const tileCanShuffleFromVolatileMiss = (tile: Tile, blockedPairKeys: ReadonlySet<string>): boolean =>
    tile.state === 'hidden' &&
    !blockedPairKeys.has(tile.pairKey) &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.findableKind == null;

const DEFAULT_TRAIT_INTERACTION_SEED: readonly [TileTraitKind, TileTraitKind] = ['conduit', 'echo'];

/**
 * Trait markers on the board say which trait a tile carries by colour, so these nine have to stay
 * apart for eyes that cannot separate every hue. They are tuned against the dichromacy simulation
 * in `color-vision.ts` and gated by `tile-trait-palette.test.ts`: the worst pair used to sit at
 * dE 2.1 under deuteranopia — below the just-noticeable step, meaning Sealed and Stasis were the
 * same colour — and now clears 29. Each hue stayed within 16 degrees of the colour it shipped as,
 * so a returning player still reads Echo as cyan and Cursed as pink. Re-run the gate after any
 * edit here; hue is the axis that survives least well, so lightness is doing much of the work.
 */
const TILE_TRAIT_COLORS: Record<TileTraitKind, string> = {
    echo: '#32fdf9',
    volatile: '#fd8c21',
    mirror: '#a168fd',
    cursed: '#f22b8c',
    sealed: '#67b4eb',
    heavy: '#c09766',
    drift: '#bbfcc3',
    conduit: '#f7f986',
    stasis: '#2146fd'
};

/** The palette as data, for the colour-vision gate and any surface that needs the whole set. */
export const tileTraitPalette = (): Record<TileTraitKind, string> => ({ ...TILE_TRAIT_COLORS });

export const tileTraitColor = (kind: TileTraitKind): string => TILE_TRAIT_COLORS[kind];

const columnsForTileCount = (tileCount: number): number => Math.min(Math.max(Math.ceil(Math.sqrt(tileCount)), 2), 8);

const calculateCoreTraitCount = (eligiblePairCount: number, level: number): number => {
    if (eligiblePairCount <= 0) {
        return 0;
    }
    if (level <= 1) {
        return Math.min(2, eligiblePairCount);
    }
    const densityCount = Math.ceil(eligiblePairCount * (level >= 8 ? 0.5 : 0.42));
    const floorBandMinimum = level >= 8 ? 4 : level >= 4 ? 3 : 2;
    return Math.min(Math.max(densityCount, floorBandMinimum), eligiblePairCount);
};

/*
 * The seed pairs a floor is traited around. A route world's intensity and a starting loadout used
 * to pick these; with one kind of floor and no loadout, the opener list and the general list are
 * all there is, and the general one is drawn from at random.
 */
const OPENER_INTERACTION_SEEDS: readonly (readonly [TileTraitKind, TileTraitKind])[] = [
    ['conduit', 'echo'],
    ['echo', 'mirror'],
    ['sealed', 'heavy']
];

const INTERACTION_SEEDS: readonly (readonly [TileTraitKind, TileTraitKind])[] = [
    ['conduit', 'echo'],
    ['echo', 'mirror'],
    ['sealed', 'conduit'],
    ['cursed', 'volatile'],
    ['heavy', 'mirror'],
    ['drift', 'volatile'],
    ['stasis', 'conduit']
];

const OPENER_TRAIT_POOL: readonly TileTraitKind[] = ['echo', 'mirror', 'heavy'];

const TRAIT_POOL: readonly TileTraitKind[] = ['echo', 'volatile', 'mirror', 'cursed', 'sealed', 'heavy', 'drift', 'conduit', 'stasis'];

const collectAdjacentEligiblePairKeys = (
    tiles: readonly Tile[],
    eligiblePairKeys: readonly string[],
    boardColumns: number = columnsForTileCount(tiles.length)
): [string, string][] => {
    const eligible = new Set(eligiblePairKeys);
    const columns = boardColumns;
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
            const neighbor = tiles[neighborIndex];
            if (!neighbor) {
                continue;
            }
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

export const getTileTraitText = (tile: Tile): string => {
    if (!tile.tileTraitKind) {
        return '';
    }
    const copy = TILE_TRAIT_COPY[tile.tileTraitKind];
    // The mark is said out loud too: a screen reader gets the same second channel the board draws.
    const mark = describeTraitMark(tileTraitMark(tile.tileTraitKind));
    return ` Trait: ${copy.label} (${mark}). ${copy.match} ${copy.mismatch}`;
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
    boardColumns: number = columnsForTileCount(tiles.length)
): Tile[] => {
    const eligiblePairKeys = [
        ...new Set(tiles.filter(tileCanReceiveTrait).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanReceiveTrait(tile)).length === 2);
    if (eligiblePairKeys.length === 0) {
        return tiles.map((tile) => ({ ...tile }));
    }

    const rng = createMulberry32(hashStringToSeed(`tileTraits:${rulesVersion}:${runSeed}:${level}:none`));
    const traitCount = calculateCoreTraitCount(eligiblePairKeys.length, level);
    const pool = [...(level <= 1 ? OPENER_TRAIT_POOL : TRAIT_POOL)];
    const shuffledPairKeys = shuffleWithRng(() => rng(), eligiblePairKeys);
    const traitByPairKey = new Map<string, TileTraitKind>();
    if (traitCount >= 2) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys, boardColumns);
        const shuffledAdjacentPairs = shuffleWithRng(() => rng(), adjacentPairs);
        const seeds = level <= 1 ? OPENER_INTERACTION_SEEDS : INTERACTION_SEEDS;
        let seedIndex = pickRngIndex(rng, seeds.length);
        for (const [firstPairKey, secondPairKey] of shuffledAdjacentPairs) {
            if (traitByPairKey.size + 2 > traitCount) {
                break;
            }
            if (traitByPairKey.has(firstPairKey) || traitByPairKey.has(secondPairKey)) {
                continue;
            }
            const [firstTrait, secondTrait] = seeds[seedIndex % seeds.length] ?? seeds[0] ?? DEFAULT_TRAIT_INTERACTION_SEED;
            traitByPairKey.set(firstPairKey, firstTrait);
            traitByPairKey.set(secondPairKey, secondTrait);
            seedIndex += 1;
        }
    }
    shuffledPairKeys.forEach((pairKey, index) => {
        if (traitByPairKey.size >= traitCount || traitByPairKey.has(pairKey)) {
            return;
        }
        const shuffledPool = shuffleWithRng(() => rng(), pool);
        const trait = shuffledPool[index % pool.length] ?? shuffledPool[0] ?? pool[0] ?? DEFAULT_TRAIT_INTERACTION_SEED[0];
        traitByPairKey.set(pairKey, trait);
    });

    const assignedTiles = tiles.map((tile) => {
        const trait = traitByPairKey.get(tile.pairKey);
        return trait ? { ...tile, tileTraitKind: trait } : { ...tile };
    });
    if (
        traitByPairKey.size >= 2 &&
        getBoardTraitInteractionPreviewLines(
            { ...({} as BoardState), tiles: assignedTiles, columns: boardColumns },
            'match'
        ).length === 0
    ) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys, boardColumns);
        const [firstPairKey, secondPairKey] = adjacentPairs.find(
            ([first, second]) => traitByPairKey.has(first) || traitByPairKey.has(second)
        ) ?? adjacentPairs[0] ?? [];
        if (!firstPairKey || !secondPairKey) {
            const fallbackPairKey = [...traitByPairKey.keys()][0] ?? eligiblePairKeys[0];
            if (fallbackPairKey) {
                const repairedTraitByPairKey = new Map(traitByPairKey);
                repairedTraitByPairKey.set(fallbackPairKey, 'drift');
                return tiles.map((tile) => {
                    const trait = repairedTraitByPairKey.get(tile.pairKey);
                    return trait ? { ...tile, tileTraitKind: trait } : { ...tile };
                });
            }
        }
        if (firstPairKey && secondPairKey) {
            const repairSeeds = level <= 1 ? OPENER_INTERACTION_SEEDS : INTERACTION_SEEDS;
            const repairSeedIndex = pickRngIndex(rng, repairSeeds.length);
            const [firstTrait, secondTrait] =
                repairSeeds[repairSeedIndex] ?? repairSeeds[0] ?? DEFAULT_TRAIT_INTERACTION_SEED;
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
    const hiddenEntries: { index: number; tile: Tile }[] = [];
    board.tiles.forEach((tile, index) => {
        if (tileCanShuffleFromVolatileMiss(tile, blockedPairKeys)) {
            hiddenEntries.push({ index, tile });
        }
    });
    if (hiddenEntries.length < 2) {
        return { board, triggered: false };
    }
    const stats = normalizeSessionStats(run.stats);
    const rng = createMulberry32(
        hashStringToSeed(
            `volatileTrait:${run.runRulesVersion}:${run.runSeed}:${board.level}:${stats.mismatches}:${runArrayCount(run.flipHistory)}`
        )
    );
    const nextTiles = [...board.tiles];
    const candidates = hiddenEntries.map((entry) => entry.tile);
    const shuffled = shuffleWithRng(
        () => rng(),
        candidates
    );
    if (shuffled.every((tile, index) => tile.id === candidates[index]?.id)) {
        const [first, ...rest] = shuffled;
        if (!first) {
            return { board, triggered: false };
        }
        shuffled.splice(0, shuffled.length, ...rest, first);
    }
    hiddenEntries.forEach(({ index, tile }, slot) => {
        nextTiles[index] = shuffled[slot] ?? tile;
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

/**
 * Release a Stasis block that has become the only way off the floor.
 *
 * `selectStasisBlockIndex` already refuses to block when one pair is left, but it decides against
 * the board as it stands at the moment of the match - and the pop that follows that match can take
 * pairs off the board after the decision is made. Two pairs remaining when the block is chosen and
 * one remaining once the cascade settles is not an exotic case: it is what a short floor with a
 * clumped suit does routinely. The dungeon layer hid this, because a blocked last pair still had an
 * exit tile to leave through; with the exit gone, the floor simply never ends.
 *
 * So the block is re-checked against the board the turn actually produced, and dropped when there
 * is nothing else to play. This is a release rather than a refusal on purpose - the block was real,
 * it was earned, and it did its job for the turn it existed; what it must not do is outlive the
 * board that justified it.
 */
export const releaseStrandedStasisBlock = (run: RunState): RunState => {
    if (run.stickyBlockIndex === null || run.stickyBlockIndex === undefined || !run.board) {
        return run;
    }
    return countRemainingFullyHiddenPairs(run.board) <= 1 ? { ...run, stickyBlockIndex: null } : run;
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
    source,
    gameplayEffectContext
}: TileTraitEffectContext): TileTraitEffectResult => {
    const result = createEmptyTraitEffectResult();
    const traits = new Set(sourceTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null));
    const hasTrait = (kind: TileTraitKind): boolean => traits.has(kind);
    const adjacentTraitTiles = board ? collectAdjacentTraitTiles(board, sourceTiles) : [];
    const adjacentTraitKinds = new Set(
        adjacentTraitTiles.map((tile) => tile.tileTraitKind).filter((kind): kind is TileTraitKind => kind != null)
    );
    const stats = normalizeSessionStats(run.stats);
    const comboShards = stats.comboShards;
    const guardTokens = stats.guardTokens;
    const matchResolutionsThisFloor = runNonNegativeInteger(run.matchResolutionsThisFloor);
    const peekCharges = runNonNegativeInteger(run.peekCharges);
    const recallFocus = runNonNegativeInteger(run.recallFocus);

    const applyCoreTraitDefinition = (definitionId: string, commandSuffix: string, commandRun: RunState = run) => {
        const facts: GameplayFacts = {
            matchedTraits: [...traits],
            adjacentTraits: [...adjacentTraitKinds],
            matchedFindables: [],
            featuredObjectiveCompleted: false,
            scoreParasiteActive: false
        };
        const sourceHash = hashStringToSeed(sourceTiles.map((tile) => tile.id).sort().join('|'));
        const command = createGameplayDefinitionCommand(
            `trait-match:${run.runSeed}:${board?.level ?? 0}:${matchResolutionsThisFloor}:${sourceHash}:${commandSuffix}`,
            definitionId,
            facts
        );
        if (command.type !== 'effects.apply') {
            throw new Error(`Trait definition command has an unexpected type: ${command.type}`);
        }
        const definition = getGameplayContentDefinition(definitionId);
        if (!definition) {
            throw new Error(`Missing migrated trait definition: ${definitionId}`);
        }
        const coreResult = applyGameplayDefinitionTransition(
            commandRun,
            gameplayEffectContext?.commandId ?? command.commandId,
            definition,
            facts,
            gameplayEffectContext?.events
        );
        if (!coreResult.accepted) {
            throw new Error(`Migrated trait command rejected: ${definitionId}`);
        }
        if (!gameplayEffectContext) {
            result.gameplayCommands = [...(result.gameplayCommands ?? []), command];
            result.gameplayEvents = [...(result.gameplayEvents ?? []), ...coreResult.events];
        }
        return coreResult;
    };

    if (source === 'match') {
        result.comboShardGain = hasTrait('sealed') && comboShards < MAX_COMBO_SHARDS ? 1 : 0;
        result.guardTokenGain = hasTrait('mirror') ? 1 : 0;
        result.peekChargeGain = hasTrait('echo') ? 1 : 0;
        result.scoreBonus = [...traits].reduce((sum, trait) => sum + (TILE_TRAIT_MATCH_SCORE_BONUS[trait] ?? 0), 0);

        if (hasTrait('echo') && adjacentTraitKinds.has('sealed') && comboShards < MAX_COMBO_SHARDS) {
            result.comboShardGain += 1;
            result.interactionTags.push('echo:sealed-combo');
        }

        if (hasTrait('echo') && adjacentTraitKinds.has('mirror') && recallFocus < RECALL_FOCUS_MAX) {
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
            if (comboShards + result.comboShardGain < MAX_COMBO_SHARDS) {
                result.comboShardGain += 1;
            } else {
                result.scoreBonus += 18;
            }
            result.scoreBonus += 10;
            result.interactionTags.push('sealed:conduit-spark');
        }

        if (hasTrait('cursed') && adjacentTraitKinds.has('volatile')) {
            result.scoreBonus += 20;
            result.interactionTags.push('cursed:volatile-greed');
        }

        if (hasTrait('volatile') && adjacentTraitKinds.has('heavy')) {
            const projectedGuardTokens = Math.min(MAX_GUARD_TOKENS, guardTokens + result.guardTokenGain);
            const projectedRun = {
                ...run,
                stats: { ...stats, guardTokens: projectedGuardTokens }
            };
            const coreResult = applyCoreTraitDefinition('trait.volatile_heavy_guard', 'volatile-heavy', projectedRun);
            result.guardTokenGain +=
                normalizeSessionStats(coreResult.run.stats).guardTokens - projectedGuardTokens;
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
        }

        if (hasTrait('stasis') && board) {
            result.stickyBlockIndex = selectStasisBlockIndex(board, sourceTiles);
            if (result.stickyBlockIndex !== null) {
                result.scoreBonus += 10;
                result.interactionTags.push('stasis:nearby-block');
            }
        }

        return result;
    }

    const stasisBuffersSealed = hasTrait('sealed') && adjacentTraitKinds.has('stasis');
    const sealedPeekLoss = hasTrait('sealed') && !stasisBuffersSealed && peekCharges > 0 ? 1 : 0;
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
    scoreBonus: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles: matchedTiles, source: 'match' });
    return {
        comboShardGain: effect.comboShardGain,
        guardTokenGain: effect.guardTokenGain,
        peekChargeGain: effect.peekChargeGain,
        scoreBonus: effect.scoreBonus
    };
};

export const calculateTileTraitMismatchPenalty = (
    run: RunState,
    sourceTiles: readonly Tile[],
    board?: BoardState | null
): {
    peekChargeLoss: number;
    recallMistakesDelta: number;
    triesDelta: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles, source: 'mismatch' });
    return {
        peekChargeLoss: effect.peekChargeLoss,
        recallMistakesDelta: effect.recallMistakesDelta,
        triesDelta: effect.triesDelta
    };
};
