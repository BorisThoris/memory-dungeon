import { type BoardState, type RunState, type Tile, type TileTraitKind } from './contracts';
import {
    createGameplayDefinitionCommand,
    getGameplayContentDefinition,
    type GameplayCommand,
    type GameplayEvent,
    type GameplayFacts
} from './gameplay-core-contracts';
import { applyGameplayDefinitionTransition } from './gameplay-effect-transition';
import { createMulberry32, hashStringToSeed, pickRngIndex, shuffleWithRng } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';
export {
    formatTileTraitInteractionTags,
    TILE_TRAIT_INTERACTION_TAGS,
    TILE_TRAIT_INTERACTION_TEXT,
    type TileTraitInteractionTag
} from './tile-trait-interaction-copy';
import { formatTileTraitInteractionTags, type TileTraitInteractionTag } from './tile-trait-interaction-copy';
import { describeTraitMark, tileTraitMark } from './tile-trait-marks';

/*
 * Gen 201 cut a clause from Heavy's mismatch line. It read "costs +1 extra try but never drains
 * peek charges", and nothing in the game drains a peek charge on a mismatch - no rule, on any
 * trait, in any mutator. The clause promised the absence of a penalty that cannot happen, which
 * teaches a player to fear something the game does not do. The half that is true stayed.
 *
 * Four traits. Nine shipped; Mirror, Cursed, Sealed, Volatile and Drift were cut in the trait
 * triage (thesis §32.4) because each of them was a rule the player had to hold in memory that paid
 * in a resource the game no longer builds around - guard tokens, combo shards (both gone since), shuffle charges -
 * or punished a miss in a way the miss itself already did. What is left is one trait per idea:
 * Echo pays in information, Heavy pays in score and costs a try, Conduit pays for neighbours,
 * Stasis takes a tile off the table for a turn.
 */
export const TILE_TRAIT_COPY: Record<TileTraitKind, { label: string; match: string; mismatch: string }> = {
    echo: {
        label: 'Echo',
        match: 'Clean match grants +1 peek charge.',
        mismatch: 'No extra miss penalty.'
    },
    heavy: {
        label: 'Heavy',
        match: 'Clean match grants +35 score.',
        mismatch: 'Mismatch costs +1 extra try.'
    },
    conduit: {
        label: 'Conduit',
        match: 'Clean match converts nearby traits into score; adjacent Echo adds a peek charge, adjacent Stasis a lock pulse.',
        mismatch: 'No extra miss penalty.'
    },
    stasis: {
        label: 'Stasis',
        match: 'Clean match locks a nearby trait tile from being opened first next turn when completion remains safe.',
        mismatch: 'No extra miss penalty.'
    }
};

export const TILE_TRAIT_MATCH_SCORE_BONUS: Partial<Record<TileTraitKind, number>> = {
    heavy: 35
};

export interface TileTraitEffectResult {
    interactionTags: TileTraitInteractionTag[];
    peekChargeGain: number;
    scoreBonus: number;
    stickyBlockIndex: number | null;
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

/*
 * Every surviving interaction fires on a clean match, so a preview is a match preview. The miss
 * side of a trait is only Heavy's extra try, and that is stated in the trait's own copy rather
 * than previewed as an interaction.
 */
const collectTileTraitInteractionTags = ({
    adjacentTraitKinds,
    board,
    sourceTiles,
    traits
}: {
    adjacentTraitKinds: ReadonlySet<TileTraitKind>;
    board?: BoardState | null;
    sourceTiles: readonly Tile[];
    traits: ReadonlySet<TileTraitKind>;
}): TileTraitInteractionTag[] => {
    const tags: TileTraitInteractionTag[] = [];
    const hasTrait = (kind: TileTraitKind): boolean => traits.has(kind);

    if (hasTrait('conduit') && adjacentTraitKinds.size > 0) {
        tags.push('conduit:adjacent-score');
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
};

export const getTileTraitInteractionPreviewLines = (board: BoardState, sourceTileIds: readonly string[]): string[] => {
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
            ...getTileTraitInteractionPreviewLines(swapped, [firstTileId]),
            ...getTileTraitInteractionPreviewLines(swapped, [secondTileId])
        ])
    ];
};

export const getBoardTraitInteractionPreviewLines = (board: BoardState): string[] => {
    const lines = new Set<string>();
    for (const tile of board.tiles) {
        if (tile.tileTraitKind == null || tile.state === 'matched' || tile.state === 'removed') {
            continue;
        }
        for (const line of getTileTraitInteractionPreviewLines(board, [tile.id])) {
            lines.add(line);
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
        if (getTileTraitInteractionPreviewLines(board, [tile.id]).length > 0) {
            seenPairs.add(tile.pairKey);
        }
    }
    return seenPairs.size;
};

/**
 * Every preview line on the board, keyed by the tile it belongs to.
 *
 * A "new route" used to mean a line string the board had not shown before. With nineteen
 * interaction lines that was a fair proxy; with four, a floor usually shows every string it can,
 * and no swap could ever count as creating anything. The route a swap creates is a tile that
 * gains a line it did not have, so that is what is compared.
 */
export const getBoardTraitInteractionPreviewKeys = (board: BoardState): Set<string> => {
    const keys = new Set<string>();
    for (const tile of board.tiles) {
        if (tile.tileTraitKind == null || tile.state === 'matched' || tile.state === 'removed') {
            continue;
        }
        for (const line of getTileTraitInteractionPreviewLines(board, [tile.id])) {
            keys.add(`${tile.id}|${line}`);
        }
    }
    return keys;
};

/** The player-facing lines behind a set of preview keys, in first-seen order. */
export const traitInteractionPreviewKeyLines = (keys: Iterable<string>): string[] => {
    const lines = new Set<string>();
    for (const key of keys) {
        lines.add(key.slice(key.indexOf('|') + 1));
    }
    return [...lines];
};

export const hasTraitSwapSetupOpportunity = (board: BoardState): boolean => {
    const hiddenTiles = board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.state === 'hidden');
    const beforeKeys = getBoardTraitInteractionPreviewKeys(board);
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
            const afterKeys = getBoardTraitInteractionPreviewKeys({ ...board, tiles });
            if ([...afterKeys].some((key) => !beforeKeys.has(key))) {
                return true;
            }
        }
    }
    return false;
};

export const countTraitInteractionLines = (board: BoardState): number =>
    getBoardTraitInteractionPreviewLines(board).length;

export const hasTraitRewardInteractionFloor = (board: BoardState): boolean =>
    getBoardTraitInteractionPreviewLines(board).some(
        (line) => line.includes('peek') || line.includes('charge') || line.includes('score')
    );

/*
 * A "board power" interaction is one that changes what the board lets you do next turn rather
 * than what it pays: a swap that sets up a combo, or a Stasis block. Drift used to count here
 * too, through the row/swap charge it granted; with Drift gone the block is the only trait that
 * acts on the board itself.
 */
export const hasTraitBoardPowerInteractionOpportunity = (board: BoardState, hasSwapSetup: boolean): boolean =>
    hasSwapSetup || board.tiles.some((tile) => tile.tileTraitKind === 'stasis');

const createEmptyTraitEffectResult = (): TileTraitEffectResult => ({
    interactionTags: [],
    peekChargeGain: 0,
    scoreBonus: 0,
    stickyBlockIndex: null,
    triesDelta: 0
});

const tileCanReceiveTrait = (tile: Tile): boolean =>
    tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey) && tile.tileTraitKind == null;

const DEFAULT_TRAIT_INTERACTION_SEED: readonly [TileTraitKind, TileTraitKind] = ['conduit', 'echo'];

/**
 * Trait markers on the board say which trait a tile carries by colour, so these four have to stay
 * apart for eyes that cannot separate every hue. They are tuned against the dichromacy simulation
 * in `color-vision.ts` and gated by `tile-trait-palette.test.ts`. The four hues are the ones the
 * traits shipped with when there were nine - the triage removed colours, it did not move any - so
 * a returning player still reads Echo as cyan and Stasis as blue. Re-run the gate after any edit
 * here; hue is the axis that survives least well, so lightness is doing much of the work.
 */
const TILE_TRAIT_COLORS: Record<TileTraitKind, string> = {
    echo: '#32fdf9',
    heavy: '#c09766',
    conduit: '#f7f986',
    stasis: '#2146fd'
};

/** The palette as data, for the colour-vision gate and any surface that needs the whole set. */
export const tileTraitPalette = (): Record<TileTraitKind, string> => ({ ...TILE_TRAIT_COLORS });

export const tileTraitColor = (kind: TileTraitKind): string => TILE_TRAIT_COLORS[kind];

const columnsForTileCount = (tileCount: number): number => Math.min(Math.max(Math.ceil(Math.sqrt(tileCount)), 2), 8);

/** Traits begin here. Floors 1 to 3 are authored (thesis §51) and carry none. */
export const FIRST_TRAIT_FLOOR = 4;

/*
 * How many pairs on a floor carry a trait. The density is a share of the eligible pairs with a
 * floor-band minimum under it, so a floor never shows a single trait with nothing to interact
 * with: the seeds below always place traits in adjacent couples, and a count below two would
 * leave the second half of every couple unplaced.
 */
const calculateCoreTraitCount = (eligiblePairCount: number, level: number): number => {
    if (eligiblePairCount <= 0) {
        return 0;
    }
    const densityCount = Math.ceil(eligiblePairCount * (level >= 8 ? 0.5 : 0.42));
    const floorBandMinimum = level >= 8 ? 4 : 3;
    return Math.min(Math.max(densityCount, floorBandMinimum), eligiblePairCount);
};

/*
 * The adjacent couples a floor is traited around, drawn from at random. Each is one of the
 * surviving interactions read from the other side: the pair that matches first is the one whose
 * neighbour pays. An opener list used to sit beside this one for floor 1; floor 1 is authored
 * and traitless now, so the first traited floor draws from the same list as every other.
 */
const INTERACTION_SEEDS: readonly (readonly [TileTraitKind, TileTraitKind])[] = [
    ['conduit', 'echo'],
    ['stasis', 'conduit'],
    ['stasis', 'heavy']
];

const TRAIT_POOL: readonly TileTraitKind[] = ['echo', 'heavy', 'conduit', 'stasis'];

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
    if (level < FIRST_TRAIT_FLOOR) {
        return tiles.map((tile) => ({ ...tile }));
    }
    const eligiblePairKeys = [
        ...new Set(tiles.filter(tileCanReceiveTrait).map((tile) => tile.pairKey))
    ].filter((pairKey) => tiles.filter((tile) => tile.pairKey === pairKey && tileCanReceiveTrait(tile)).length === 2);
    if (eligiblePairKeys.length === 0) {
        return tiles.map((tile) => ({ ...tile }));
    }

    const rng = createMulberry32(hashStringToSeed(`tileTraits:${rulesVersion}:${runSeed}:${level}:none`));
    const traitCount = calculateCoreTraitCount(eligiblePairKeys.length, level);
    const pool = [...TRAIT_POOL];
    const shuffledPairKeys = shuffleWithRng(() => rng(), eligiblePairKeys);
    const traitByPairKey = new Map<string, TileTraitKind>();
    if (traitCount >= 2) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys, boardColumns);
        const shuffledAdjacentPairs = shuffleWithRng(() => rng(), adjacentPairs);
        let seedIndex = pickRngIndex(rng, INTERACTION_SEEDS.length);
        for (const [firstPairKey, secondPairKey] of shuffledAdjacentPairs) {
            if (traitByPairKey.size + 2 > traitCount) {
                break;
            }
            if (traitByPairKey.has(firstPairKey) || traitByPairKey.has(secondPairKey)) {
                continue;
            }
            const [firstTrait, secondTrait] =
                INTERACTION_SEEDS[seedIndex % INTERACTION_SEEDS.length] ?? DEFAULT_TRAIT_INTERACTION_SEED;
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
    /*
     * A floor whose traits stand nowhere near each other is a floor whose traits do nothing
     * visible, so the assignment is checked for at least one previewable interaction and repaired
     * by re-seeding an adjacent couple when there is none. There is no single-trait fallback: a
     * board with no two eligible pairs side by side has no interaction to offer and keeps what it
     * was dealt.
     */
    if (
        traitByPairKey.size >= 2 &&
        getBoardTraitInteractionPreviewLines({ ...({} as BoardState), tiles: assignedTiles, columns: boardColumns }).length === 0
    ) {
        const adjacentPairs = collectAdjacentEligiblePairKeys(tiles, eligiblePairKeys, boardColumns);
        const [firstPairKey, secondPairKey] = adjacentPairs.find(
            ([first, second]) => traitByPairKey.has(first) || traitByPairKey.has(second)
        ) ?? adjacentPairs[0] ?? [];
        if (firstPairKey && secondPairKey) {
            const repairSeedIndex = pickRngIndex(rng, INTERACTION_SEEDS.length);
            const [firstTrait, secondTrait] = INTERACTION_SEEDS[repairSeedIndex] ?? DEFAULT_TRAIT_INTERACTION_SEED;
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
    const matchResolutionsThisFloor = runNonNegativeInteger(run.matchResolutionsThisFloor);
    const peekCharges = runNonNegativeInteger(run.peekCharges);

    const applyCoreTraitDefinition = (definitionId: string, commandSuffix: string, commandRun: RunState = run) => {
        const facts: GameplayFacts = {
            matchedTraits: [...traits],
            adjacentTraits: [...adjacentTraitKinds],
            matchedFindables: [],
            featuredObjectiveCompleted: false
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
        result.peekChargeGain = hasTrait('echo') ? 1 : 0;
        result.scoreBonus = [...traits].reduce((sum, trait) => sum + (TILE_TRAIT_MATCH_SCORE_BONUS[trait] ?? 0), 0);

        if (hasTrait('conduit') && adjacentTraitTiles.length > 0) {
            result.scoreBonus += adjacentTraitTiles.length * 12;
            result.interactionTags.push('conduit:adjacent-score');
            if (adjacentTraitKinds.has('echo')) {
                /*
                 * The one trait interaction that pays through the effects engine, so the engine's
                 * trait trigger keeps a live definition behind it. The run it is applied to already
                 * carries Echo's own peek charge, so the gain read back is the Conduit half alone.
                 */
                const projectedPeekCharges = peekCharges + result.peekChargeGain;
                const coreResult = applyCoreTraitDefinition('trait.conduit_echo_peek', 'conduit-echo', {
                    ...run,
                    peekCharges: projectedPeekCharges
                });
                result.peekChargeGain += runNonNegativeInteger(coreResult.run.peekCharges) - projectedPeekCharges;
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

    result.triesDelta = hasTrait('heavy') ? 1 : 0;
    return result;
};

export const calculateTileTraitMatchRewards = (
    run: RunState,
    matchedTiles: readonly Tile[],
    board?: BoardState | null
): {
    peekChargeGain: number;
    scoreBonus: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles: matchedTiles, source: 'match' });
    return {
        peekChargeGain: effect.peekChargeGain,
        scoreBonus: effect.scoreBonus
    };
};

export const calculateTileTraitMismatchPenalty = (
    run: RunState,
    sourceTiles: readonly Tile[],
    board?: BoardState | null
): {
    triesDelta: number;
} => {
    const effect = resolveTileTraitEffects({ run, board, sourceTiles, source: 'mismatch' });
    return {
        triesDelta: effect.triesDelta
    };
};
