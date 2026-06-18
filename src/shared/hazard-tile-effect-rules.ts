import type { BoardState, HazardTileKind, RunState, Tile } from './contracts';
import {
    createMulberry32,
    hashStringToSeed,
    shuffleWithRng
} from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

const tileIsSafeHazardEffectTarget = (tile: Tile): boolean =>
    tile.state === 'hidden' &&
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.dungeonCardKind == null &&
    tile.routeSpecialKind == null &&
    tile.routeCardKind == null &&
    tile.findableKind == null &&
    tile.tileHazardKind == null;

const sourceTilesHaveStasisWard = (sourceTiles: readonly Tile[]): boolean =>
    sourceTiles.some((tile) => tile.tileTraitKind === 'stasis');

export const applyShuffleSnareHazard = (board: BoardState, run: RunState): { board: BoardState; triggered: boolean } => {
    const hiddenIndices: number[] = [];
    board.tiles.forEach((tile, index) => {
        if (tileIsSafeHazardEffectTarget(tile) && tile.pairKey !== board.cursedPairKey) {
            hiddenIndices.push(index);
        }
    });
    if (hiddenIndices.length < 2) {
        return { board, triggered: false };
    }
    const rng = createMulberry32(
        hashStringToSeed(
            `hazardSnare:${run.runRulesVersion}:${run.runSeed}:${board.level}:${run.hazardShuffleSnaresThisFloor}:${run.hazardTileTriggersThisFloor}`
        )
    );
    const nextTiles = [...board.tiles];
    const shuffled = shuffleWithRng(
        () => rng(),
        hiddenIndices.map((index) => board.tiles[index]!)
    );
    hiddenIndices.forEach((index, slot) => {
        nextTiles[index] = shuffled[slot]!;
    });
    return { board: { ...board, tiles: nextTiles }, triggered: true };
};

export const applyCascadeCacheHazard = (
    board: BoardState,
    run: RunState,
    matchedPairKey: string
): { board: BoardState; triggered: boolean } => {
    const blockedPairKeys = new Set<string>([matchedPairKey]);
    if (board.cursedPairKey) {
        blockedPairKeys.add(board.cursedPairKey);
    }
    const pairKeys = [
        ...new Set(
            board.tiles
                .filter((tile) => tileIsSafeHazardEffectTarget(tile) && !blockedPairKeys.has(tile.pairKey))
                .map((tile) => tile.pairKey)
        )
    ].filter((pairKey) => board.tiles.filter((tile) => tile.pairKey === pairKey && tileIsSafeHazardEffectTarget(tile)).length === 2);
    if (pairKeys.length === 0) {
        return { board, triggered: false };
    }
    const rng = createMulberry32(
        hashStringToSeed(
            `hazardCascade:${run.runRulesVersion}:${run.runSeed}:${board.level}:${run.hazardCascadeCachesThisFloor}:${matchedPairKey}`
        )
    );
    const targetPairKey = shuffleWithRng(() => rng(), pairKeys)[0]!;
    return {
        board: {
            ...board,
            matchedPairs: board.matchedPairs + 1,
            tiles: board.tiles.map((tile) =>
                tile.pairKey === targetPairKey ? { ...tile, state: 'removed' as const } : tile
            )
        },
        triggered: true
    };
};

export const breakFragileCacheHazards = (
    board: BoardState,
    sourceTiles: readonly Tile[]
): { board: BoardState; brokenCount: number } => {
    const brokenPairKeys = new Set(
        sourceTiles
            .filter((tile) => tile.tileHazardKind === 'fragile_cache')
            .map((tile) => tile.pairKey)
    );
    if (brokenPairKeys.size === 0) {
        return { board, brokenCount: 0 };
    }
    return {
        board: {
            ...board,
            tiles: board.tiles.map((tile) =>
                brokenPairKeys.has(tile.pairKey) && tile.tileHazardKind === 'fragile_cache'
                    ? { ...tile, tileHazardKind: undefined }
                    : tile
            )
        },
        brokenCount: brokenPairKeys.size
    };
};

export const applySafeHazardWardMismatch = (
    run: RunState,
    board: BoardState,
    sourceTiles: readonly Tile[],
    mismatchHazards: ReadonlySet<HazardTileKind>
): {
    board: BoardState;
    fragileBreak: { board: BoardState; brokenCount: number };
    snareHazard: { board: BoardState; triggered: boolean };
    wardUsed: boolean;
    wardChargeSpent: boolean;
    traitWardUsed: boolean;
} => {
    const hasWardCharge = (run.safeHazardWardChargesThisFloor ?? 0) > 0;
    const hasStasisWard = !hasWardCharge && sourceTilesHaveStasisWard(sourceTiles);
    const canWardHazard = hasWardCharge || hasStasisWard;
    const blocksSnare = canWardHazard && mismatchHazards.has('shuffle_snare');
    const blocksFragile =
        canWardHazard &&
        !blocksSnare &&
        sourceTiles.some((tile) => tile.tileHazardKind === 'fragile_cache');
    const wardUsed = blocksSnare || blocksFragile;
    const fragileBreak = blocksFragile
        ? { board, brokenCount: 0 }
        : breakFragileCacheHazards(board, sourceTiles);
    const snareHazard =
        mismatchHazards.has('shuffle_snare') && !blocksSnare
            ? applyShuffleSnareHazard(fragileBreak.board, run)
            : { board: fragileBreak.board, triggered: false };

    return {
        board: snareHazard.board,
        fragileBreak,
        snareHazard,
        wardUsed,
        wardChargeSpent: hasWardCharge && wardUsed,
        traitWardUsed: hasStasisWard && wardUsed
    };
};

export const hazardKindsInTiles = (tiles: readonly Tile[], ids: readonly string[]): Set<HazardTileKind> => {
    const idsSet = new Set(ids);
    const kinds = new Set<HazardTileKind>();
    for (const tile of tiles) {
        if (idsSet.has(tile.id) && tile.tileHazardKind) {
            kinds.add(tile.tileHazardKind);
        }
    }
    return kinds;
};
