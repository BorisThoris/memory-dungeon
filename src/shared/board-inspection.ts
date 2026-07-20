import type {
    BoardState,
    DungeonExitLockKind,
    DungeonKeyKind,
    RunState,
    RunStatus,
    Tile
} from './contracts';
import { activeEnemyHazardsForBoard } from './enemy-hazard-board-rules';
import { isSprungTrapTile } from './tile-state-rules';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

/** When the board includes a wild joker, returns its tile id; otherwise null. */
export const getWildTileIdFromBoard = (board: BoardState): string | null =>
    board.tiles.find((tile) => tile.pairKey === WILD_PAIR_KEY)?.id ?? null;

export const boardHasGlassDecoy = (board: BoardState): boolean =>
    board.tiles.some((tile) => tile.pairKey === DECOY_PAIR_KEY && tile.tileHazardKind !== 'mirror_decoy');

const nonNegativeBoardInspectionCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Pairs where both tiles are still hidden (eligible for shuffle / destroy targeting). */
export const countFullyHiddenPairs = (board: BoardState): number => {
    const hiddenCountByKey = new Map<string, number>();

    for (const tile of board.tiles) {
        if (tile.state === 'hidden') {
            hiddenCountByKey.set(tile.pairKey, (hiddenCountByKey.get(tile.pairKey) ?? 0) + 1);
        }
    }

    let fullPairs = 0;
    for (const count of hiddenCountByKey.values()) {
        if (count >= 2) {
            fullPairs += 1;
        }
    }

    return fullPairs;
};

const tileIsResolvedDungeonCard = (tile: Tile): boolean => tile.dungeonCardState === 'resolved';

/**
 * Floor completion ignores singleton utility tiles, treats sprung traps as settled, and allows a glass decoy
 * to stay hidden after every real tile has been cleared.
 */
export const isBoardComplete = (board: BoardState): boolean =>
    (board.dungeonExitTileId ? board.dungeonExitActivated === true : true) &&
    board.tiles.every((tile) => {
        if (isSingletonUtilityPairKey(tile.pairKey) && tile.pairKey !== DECOY_PAIR_KEY) {
            return true;
        }
        if (tile.state === 'matched' || tile.state === 'removed' || isSprungTrapTile(tile) || tileIsResolvedDungeonCard(tile)) {
            return true;
        }
        if (
            tile.pairKey === DECOY_PAIR_KEY &&
            (tile.state === 'hidden' || (tile.tileHazardKind === 'mirror_decoy' && tile.state === 'flipped'))
        ) {
            return board.tiles
                .filter((candidate) => !isSingletonUtilityPairKey(candidate.pairKey))
                .every(
                    (candidate) =>
                        candidate.state === 'matched' ||
                        candidate.state === 'removed' ||
                        isSprungTrapTile(candidate) ||
                        tileIsResolvedDungeonCard(candidate)
                );
        }
        return false;
    });

export type BoardFairnessIssueCode =
    | 'real_pair_incomplete'
    | 'real_pair_missing_actionable_tile'
    | 'decoy_flipped_or_cleared_before_completion'
    | 'wild_singleton_unmatched_without_route'
    | 'matched_pairs_counter_mismatch'
    | 'board_tile_count_mismatch'
    | 'flipped_tile_reference_missing'
    | 'exit_card_missing'
    | 'exit_tile_reference_missing'
    | 'exit_card_mismatch'
    | 'exit_activation_mismatch'
    | 'exit_lock_metadata_mismatch'
    | 'exit_lock_unreachable'
    | 'enemy_hazard_tile_reference_missing'
    | 'enemy_hazard_on_cleared_tile'
    | 'dungeon_card_pair_mismatch'
    | 'dungeon_card_hp_mismatch'
    | 'dungeon_objective_unreachable'
    | 'completion_route_missing'
    | 'trait_interaction_missing'
    | 'trait_route_objective_unreachable'
    | 'run_has_no_board'
    | 'run_terminal_incomplete_board'
    | 'run_resolving_without_flipped_tiles';

export interface BoardFairnessIssue {
    code: BoardFairnessIssueCode;
    message: string;
    tileIds?: string[];
    pairKey?: string;
}

export interface BoardFairnessReport {
    complete: boolean;
    issues: BoardFairnessIssue[];
    realPairKeys: string[];
    actionableRealPairKeys: string[];
    hiddenRealPairKeys: string[];
    decoyTileIds: string[];
    wildTileIds: string[];
    hasCompletionRoute: boolean;
}

export interface BoardFairnessInspectionOptions {
    dungeonKeys?: RunState['dungeonKeys'];
    dungeonMasterKeys?: number;
    preservePendingKeyFallback?: boolean;
}

const tileIsActionableForCompletion = (tile: Tile): boolean =>
    tile.state === 'hidden' || (tile.state === 'flipped' && !isSprungTrapTile(tile));

const pairIsCleared = (tiles: readonly Tile[]): boolean =>
    tiles.every((tile) => tile.state === 'matched' || tile.state === 'removed' || tileIsResolvedDungeonCard(tile));

const tileIsClearedForFairness = (tile: Tile): boolean =>
    tile.state === 'matched' || tile.state === 'removed' || tileIsResolvedDungeonCard(tile);

const countUnclearedDungeonPairs = (tiles: readonly Tile[], predicate: (tile: Tile) => boolean): number => {
    const pairKeys = new Set<string>();
    for (const tile of tiles) {
        if (!tileIsClearedForFairness(tile) && predicate(tile)) {
            pairKeys.add(tile.pairKey);
        }
    }
    return pairKeys.size;
};

export const countReachableExitLeverSources = (board: BoardState): number =>
    nonNegativeBoardInspectionCount(board.dungeonLeverCount) +
    countUnclearedDungeonPairs(
        board.tiles,
        (tile) => tile.dungeonCardKind === 'lever' && tile.dungeonCardEffectId === 'lever_floor'
    );

export const countReachableExitKeySources = (board: BoardState, keyKind: DungeonKeyKind): number => {
    const matchingKeyPairCount = countUnclearedDungeonPairs(
        board.tiles,
        (tile) => tile.dungeonCardKind === 'key' && (tile.dungeonKeyKind ?? 'iron') === keyKind
    );
    const floorHeldKeyCount =
        nonNegativeBoardInspectionCount(board.dungeonKeysHeldByKind?.[keyKind]) +
        (board.dungeonKeysHeldByKind == null && keyKind === 'iron'
            ? nonNegativeBoardInspectionCount(board.dungeonKeysHeld)
            : 0);
    const roomKeyCacheCount =
        keyKind === 'iron'
            ? board.tiles.filter((tile) => !tileIsClearedForFairness(tile) && tile.dungeonCardEffectId === 'room_key_cache').length
            : 0;
    return floorHeldKeyCount + matchingKeyPairCount + roomKeyCacheCount;
};

export const boardHasActionableProgressionPair = (board: BoardState): boolean => {
    const actionableTilesByPairKey = new Map<string, number>();
    let hasActionableWildTile = false;
    let hasActionableRealTile = false;
    for (const tile of board.tiles) {
        if (!tileIsActionableForCompletion(tile)) {
            continue;
        }
        if (tile.pairKey === WILD_PAIR_KEY) {
            hasActionableWildTile = true;
            continue;
        }
        if (isSingletonUtilityPairKey(tile.pairKey)) {
            continue;
        }
        hasActionableRealTile = true;
        actionableTilesByPairKey.set(tile.pairKey, (actionableTilesByPairKey.get(tile.pairKey) ?? 0) + 1);
    }
    return [...actionableTilesByPairKey.values()].some((count) => count >= 2) || (hasActionableWildTile && hasActionableRealTile);
};

export interface EffectivePrimaryExitLockInput {
    board: BoardState;
    dungeonKeys?: RunState['dungeonKeys'];
    dungeonMasterKeys?: number;
}

export interface EffectivePrimaryExitLock {
    exitTile: Tile | null;
    lockKind: DungeonExitLockKind;
    requiredLeverCount: number;
    terminalKeySoftlockFallback: boolean;
}

export const getEffectivePrimaryExitLock = ({
    board,
    dungeonKeys = {},
    dungeonMasterKeys = 0
}: EffectivePrimaryExitLockInput): EffectivePrimaryExitLock => {
    const primaryExit = board.dungeonExitTileId
        ? board.tiles.find((tile) => tile.id === board.dungeonExitTileId) ?? null
        : board.tiles.find((tile) => tile.pairKey === EXIT_PAIR_KEY) ?? null;
    const rawLockKind = primaryExit?.dungeonExitLockKind ?? board.dungeonExitLockKind ?? 'none';
    const rawRequiredLeverCount = nonNegativeBoardInspectionCount(
        primaryExit?.dungeonExitRequiredLeverCount ?? board.dungeonExitRequiredLeverCount
    );

    if (!primaryExit || rawLockKind === 'none' || rawLockKind === 'lever') {
        return {
            exitTile: primaryExit,
            lockKind: rawLockKind,
            requiredLeverCount: rawRequiredLeverCount,
            terminalKeySoftlockFallback: false
        };
    }

    const hasRunKey =
        nonNegativeBoardInspectionCount(dungeonKeys[rawLockKind]) > 0 ||
        nonNegativeBoardInspectionCount(dungeonMasterKeys) > 0;
    const hasReachableKeySource = countReachableExitKeySources(board, rawLockKind as DungeonKeyKind) > 0;
    const terminalKeySoftlockFallback =
        !boardHasActionableProgressionPair(board) && !hasRunKey && !hasReachableKeySource;

    return {
        exitTile: primaryExit,
        lockKind: terminalKeySoftlockFallback ? 'none' : rawLockKind,
        requiredLeverCount: terminalKeySoftlockFallback ? 0 : rawRequiredLeverCount,
        terminalKeySoftlockFallback
    };
};

export const repairDungeonExitSoftlocks = (
    board: BoardState,
    options: BoardFairnessInspectionOptions = {}
): BoardState => {
    if (!board.dungeonExitTileId) {
        return board;
    }
    const primaryExit = board.tiles.find((tile) => tile.id === board.dungeonExitTileId);
    if (!primaryExit) {
        return board;
    }
    const exitLockKind = primaryExit.dungeonExitLockKind ?? board.dungeonExitLockKind ?? 'none';
    const requiredLeverCount = nonNegativeBoardInspectionCount(
        primaryExit.dungeonExitRequiredLeverCount ?? board.dungeonExitRequiredLeverCount
    );
    let repairedLockKind = exitLockKind;
    let repairedLeverCount = requiredLeverCount;

    if (exitLockKind === 'lever') {
        const reachableLevers = countReachableExitLeverSources(board);
        if (reachableLevers <= 0) {
            repairedLockKind = 'none';
            repairedLeverCount = 0;
        } else if (reachableLevers < requiredLeverCount) {
            repairedLeverCount = reachableLevers;
        }
    } else if (exitLockKind !== 'none') {
        const requiredKeyKind = exitLockKind as DungeonKeyKind;
        const hasRunKey =
            nonNegativeBoardInspectionCount(options.dungeonKeys?.[requiredKeyKind]) > 0 ||
            nonNegativeBoardInspectionCount(options.dungeonMasterKeys) > 0;
        const pendingFallback =
            options.preservePendingKeyFallback === true && boardHasActionableProgressionPair(board);
        if (!hasRunKey && countReachableExitKeySources(board, requiredKeyKind) < 1 && !pendingFallback) {
            repairedLockKind = 'none';
            repairedLeverCount = 0;
        }
    }

    if (
        repairedLockKind === exitLockKind &&
        repairedLeverCount === requiredLeverCount &&
        (board.dungeonExitLockKind ?? 'none') === repairedLockKind &&
        (board.dungeonExitRequiredLeverCount ?? 0) === repairedLeverCount
    ) {
        return board;
    }

    return {
        ...board,
        dungeonExitLockKind: repairedLockKind,
        dungeonExitRequiredLeverCount: repairedLeverCount,
        tiles: board.tiles.map((tile) =>
            tile.id === primaryExit.id
                ? {
                      ...tile,
                      dungeonExitLockKind: repairedLockKind,
                      dungeonExitRequiredLeverCount: repairedLeverCount
                  }
                : tile
        )
    };
};

/**
 * REG-087 anti-softlock inspection for board structure and completion reachability.
 *
 * This is intentionally rules-only and side-effect free: it does not solve perfect play, but it catches
 * malformed/orphaned pairs, stale completion counters, flipped decoys, and singleton wild boards that no longer have
 * a legal path to finish. Decoys are allowed as hidden singleton traps; wild tiles are allowed only while at least one
 * real actionable tile or stray-removal route remains.
 */
export const inspectBoardFairness = (
    board: BoardState,
    options: BoardFairnessInspectionOptions = {}
): BoardFairnessReport => {
    const issues: BoardFairnessIssue[] = [];
    const groups = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        const group = groups.get(tile.pairKey) ?? [];
        group.push(tile);
        groups.set(tile.pairKey, group);
    }

    const realPairKeys: string[] = [];
    const actionableRealPairKeys: string[] = [];
    const hiddenRealPairKeys: string[] = [];
    const decoyTileIds = groups.get(DECOY_PAIR_KEY)?.map((tile) => tile.id) ?? [];
    const wildTiles = groups.get(WILD_PAIR_KEY) ?? [];
    const wildTileIds = wildTiles.map((tile) => tile.id);
    const exitTiles = groups.get(EXIT_PAIR_KEY) ?? [];

    let structurallyClearable = true;
    let matchedOrRemovedRealPairs = 0;

    for (const [pairKey, tiles] of groups) {
        if (isSingletonUtilityPairKey(pairKey)) {
            continue;
        }
        realPairKeys.push(pairKey);
        const tileIds = tiles.map((tile) => tile.id);
        if (tiles.length !== 2) {
            structurallyClearable = false;
            issues.push({
                code: 'real_pair_incomplete',
                message: `Real pair "${pairKey}" has ${tiles.length} tile(s); exactly 2 are required.`,
                pairKey,
                tileIds
            });
            continue;
        }
        if (pairIsCleared(tiles)) {
            matchedOrRemovedRealPairs += 1;
            continue;
        }
        if (tiles.every(isSprungTrapTile)) {
            matchedOrRemovedRealPairs += 1;
            continue;
        }
        const actionableTiles = tiles.filter(tileIsActionableForCompletion);
        if (actionableTiles.length !== 2) {
            structurallyClearable = false;
            issues.push({
                code: 'real_pair_missing_actionable_tile',
                message: `Real pair "${pairKey}" is partially unavailable before completion.`,
                pairKey,
                tileIds
            });
            continue;
        }
        actionableRealPairKeys.push(pairKey);
        if (actionableTiles.every((tile) => tile.state === 'hidden')) {
            hiddenRealPairKeys.push(pairKey);
        }
    }

    const nonUtilityTileCount = board.tiles.filter((tile) => !isSingletonUtilityPairKey(tile.pairKey)).length;
    const expectedNonUtilityTileCount = board.pairCount * 2;
    if (nonUtilityTileCount !== expectedNonUtilityTileCount) {
        structurallyClearable = false;
        issues.push({
            code: 'board_tile_count_mismatch',
            message: `Board has ${nonUtilityTileCount} non-utility tile(s), expected ${expectedNonUtilityTileCount} from pairCount.`
        });
    }

    if (board.dungeonExitTileId && exitTiles.length === 0) {
        structurallyClearable = false;
        issues.push({ code: 'exit_card_missing', message: 'Board declares an exit tile, but no exit card exists.' });
    }
    if (board.dungeonExitTileId) {
        const declaredExit = board.tiles.find((tile) => tile.id === board.dungeonExitTileId);
        if (!declaredExit) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_tile_reference_missing',
                message: `Board declares exit tile "${board.dungeonExitTileId}", but that tile does not exist.`,
                tileIds: [board.dungeonExitTileId]
            });
        } else if (declaredExit.pairKey !== EXIT_PAIR_KEY || declaredExit.dungeonCardKind !== 'exit') {
            structurallyClearable = false;
            issues.push({
                code: 'exit_card_mismatch',
                message: `Declared exit tile "${declaredExit.id}" is not an exit card.`,
                pairKey: declaredExit.pairKey,
                tileIds: [declaredExit.id]
            });
        } else if (
            board.dungeonExitLockKind != null &&
            declaredExit.dungeonExitLockKind != null &&
            (board.dungeonExitLockKind !== declaredExit.dungeonExitLockKind ||
                (board.dungeonExitRequiredLeverCount ?? 0) !== (declaredExit.dungeonExitRequiredLeverCount ?? 0))
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_lock_metadata_mismatch',
                message: `Declared exit tile "${declaredExit.id}" has lock metadata that disagrees with the board lock metadata.`,
                tileIds: [declaredExit.id]
            });
        }
    }
    const activatedExitTiles = exitTiles.filter((tile) => tile.dungeonExitActivated === true);
    if (activatedExitTiles.length > 1) {
        structurallyClearable = false;
        issues.push({
            code: 'exit_activation_mismatch',
            message: `Board has ${activatedExitTiles.length} activated exit cards; exactly one exit can own floor activation.`,
            tileIds: activatedExitTiles.map((tile) => tile.id)
        });
    }

    const effectivePrimaryExitLock = getEffectivePrimaryExitLock({
        board,
        dungeonKeys: options.dungeonKeys,
        dungeonMasterKeys: options.dungeonMasterKeys
    });
    const exitLockKind = effectivePrimaryExitLock.lockKind;
    const requiredLeverCount = effectivePrimaryExitLock.requiredLeverCount;
    if (exitLockKind === 'lever' && nonNegativeBoardInspectionCount(board.dungeonLeverCount) < requiredLeverCount) {
        const reachableLevers = countReachableExitLeverSources(board);
        if (reachableLevers < requiredLeverCount) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_lock_unreachable',
                message: `Lever-locked exit requires ${requiredLeverCount} lever(s), but only ${
                    reachableLevers
                } can be reached.`
            });
        }
    }
    if (exitLockKind !== 'none' && exitLockKind !== 'lever') {
        const requiredKeyKind = exitLockKind as DungeonKeyKind;
        const hasRunKey =
            nonNegativeBoardInspectionCount(options.dungeonKeys?.[requiredKeyKind]) > 0 ||
            nonNegativeBoardInspectionCount(options.dungeonMasterKeys) > 0;
        if (
            !hasRunKey &&
            countReachableExitKeySources(board, requiredKeyKind) < 1 &&
            !boardHasActionableProgressionPair(board)
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'exit_lock_unreachable',
                message: `${requiredKeyKind}-locked exit requires a matching key, but no reachable key route exists.`
            });
        }
    }
    if (board.matchedPairs !== matchedOrRemovedRealPairs) {
        issues.push({
            code: 'matched_pairs_counter_mismatch',
            message: `matchedPairs is ${board.matchedPairs}, but ${matchedOrRemovedRealPairs} real pair(s) are cleared or self-resolved.`
        });
    }

    const realTilesComplete = realPairKeys.length > 0 && realPairKeys.length === matchedOrRemovedRealPairs;
    for (const decoy of groups.get(DECOY_PAIR_KEY) ?? []) {
        if (
            decoy.state !== 'hidden' &&
            !(decoy.tileHazardKind === 'mirror_decoy' && decoy.state === 'flipped') &&
            !realTilesComplete
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'decoy_flipped_or_cleared_before_completion',
                message: 'Glass decoy must stay hidden until all real pairs are cleared.',
                pairKey: DECOY_PAIR_KEY,
                tileIds: [decoy.id]
            });
        }
    }

    const actionableRealTileExists = actionableRealPairKeys.length > 0;
    const hiddenRealTileExists = board.tiles.some(
        (tile) => !isSingletonUtilityPairKey(tile.pairKey) && tile.state === 'hidden'
    );

    for (const flippedId of board.flippedTileIds) {
        if (!board.tiles.some((tile) => tile.id === flippedId && tile.state === 'flipped')) {
            issues.push({
                code: 'flipped_tile_reference_missing',
                message: `flippedTileIds references "${flippedId}", but no matching flipped tile exists.`,
                tileIds: [flippedId]
            });
        }
    }

    for (const [pairKey, tiles] of groups) {
        if (isSingletonUtilityPairKey(pairKey) || pairIsCleared(tiles)) {
            continue;
        }
        const dungeonTiles = tiles.filter((tile) => !tileIsClearedForFairness(tile) && tile.dungeonCardKind != null);
        if (dungeonTiles.length === 0) {
            continue;
        }
        const tileIds = tiles.map((tile) => tile.id);
        const first = dungeonTiles[0]!;
        if (
            tiles.length !== dungeonTiles.length ||
            dungeonTiles.some(
                (tile) =>
                    tile.dungeonCardKind !== first.dungeonCardKind ||
                    tile.dungeonCardEffectId !== first.dungeonCardEffectId ||
                    tile.dungeonBossId !== first.dungeonBossId
            )
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_card_pair_mismatch',
                message: `Dungeon pair "${pairKey}" has inconsistent card metadata.`,
                pairKey,
                tileIds
            });
        }
        if (
            first.dungeonCardKind === 'enemy' &&
            dungeonTiles.some(
                (tile) =>
                    tile.dungeonCardHp !== first.dungeonCardHp ||
                    tile.dungeonCardMaxHp !== first.dungeonCardMaxHp
            )
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_card_hp_mismatch',
                message: `Enemy pair "${pairKey}" has inconsistent HP metadata.`,
                pairKey,
                tileIds
            });
        }
    }

    const tileById = new Map(board.tiles.map((tile) => [tile.id, tile]));
    const activeEnemyHazards = activeEnemyHazardsForBoard(board);
    for (const hazard of activeEnemyHazards) {
        for (const tileId of [hazard.currentTileId, hazard.nextTileId]) {
            const tile = tileById.get(tileId);
            if (!tile) {
                structurallyClearable = false;
                issues.push({
                    code: 'enemy_hazard_tile_reference_missing',
                    message: `Enemy hazard "${hazard.id}" references missing tile "${tileId}".`,
                    tileIds: [tileId]
                });
            } else if (tileIsClearedForFairness(tile)) {
                structurallyClearable = false;
                issues.push({
                    code: 'enemy_hazard_on_cleared_tile',
                    message: `Enemy hazard "${hazard.id}" references cleared tile "${tileId}".`,
                    tileIds: [tileId]
                });
            }
        }
    }

    if (board.dungeonObjectiveId === 'defeat_boss') {
        const hasBossRoute =
            board.dungeonBossId != null ||
            board.tiles.some((tile) => !tileIsClearedForFairness(tile) && tile.dungeonBossId != null) ||
            activeEnemyHazards.some((hazard) => hazard.bossId != null);
        if (!hasBossRoute) {
            structurallyClearable = false;
            issues.push({
                code: 'dungeon_objective_unreachable',
                message: 'Defeat-boss objective is active, but no boss card or boss hazard exists.'
            });
        }
    }

    const hasExitCompletionRoute = (() => {
        if (!effectivePrimaryExitLock.exitTile) {
            return false;
        }
        if (effectivePrimaryExitLock.lockKind === 'none') {
            return true;
        }
        if (effectivePrimaryExitLock.lockKind === 'lever') {
            return nonNegativeBoardInspectionCount(board.dungeonLeverCount) >= effectivePrimaryExitLock.requiredLeverCount;
        }
        const requiredKeyKind = effectivePrimaryExitLock.lockKind as DungeonKeyKind;
        return (
            nonNegativeBoardInspectionCount(options.dungeonKeys?.[requiredKeyKind]) > 0 ||
            nonNegativeBoardInspectionCount(options.dungeonMasterKeys) > 0 ||
            countReachableExitKeySources(board, requiredKeyKind) > 0
        );
    })();
    for (const wild of wildTiles) {
        if (
            tileIsActionableForCompletion(wild) &&
            !actionableRealTileExists &&
            !hiddenRealTileExists &&
            !isBoardComplete(board) &&
            !hasExitCompletionRoute
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'wild_singleton_unmatched_without_route',
                message: 'Wild singleton is still actionable, but no real hidden tile, removal route, or exit route remains.',
                pairKey: WILD_PAIR_KEY,
                tileIds: [wild.id]
            });
        }
    }
    const hasCompletionRoute =
        structurallyClearable && (isBoardComplete(board) || actionableRealPairKeys.length > 0 || hasExitCompletionRoute);

    return {
        complete: isBoardComplete(board),
        issues,
        realPairKeys,
        actionableRealPairKeys,
        hiddenRealPairKeys,
        decoyTileIds,
        wildTileIds,
        hasCompletionRoute
    };
};

export interface RunFairnessReport extends BoardFairnessReport {
    status: RunStatus | 'missingBoard';
    intentionalBlockers: string[];
}

/** REG-087 run-level wrapper around board fairness: classifies intentional transient blockers separately from issues. */
export const inspectRunFairness = (run: RunState): RunFairnessReport => {
    if (!run.board) {
        return {
            complete: false,
            issues: [
                {
                    code: 'run_has_no_board',
                    message: 'Run has no board to inspect.'
                }
            ],
            realPairKeys: [],
            actionableRealPairKeys: [],
            hiddenRealPairKeys: [],
            decoyTileIds: [],
            wildTileIds: [],
            hasCompletionRoute: false,
            status: 'missingBoard',
            intentionalBlockers: []
        };
    }

    const boardReport = inspectBoardFairness(run.board, {
        dungeonKeys: run.dungeonKeys,
        dungeonMasterKeys: run.dungeonMasterKeys
    });
    const issues = [...boardReport.issues];
    const intentionalBlockers: string[] = [];

    if (run.status === 'memorize') {
        intentionalBlockers.push('memorize_window');
    }
    if (run.status === 'paused') {
        intentionalBlockers.push('paused');
    }
    if (run.status === 'levelComplete') {
        intentionalBlockers.push('level_complete');
    }
    if (run.status === 'resolving') {
        if (run.board.flippedTileIds.length >= 2) {
            intentionalBlockers.push('resolving_flips');
        } else {
            issues.push({
                code: 'run_resolving_without_flipped_tiles',
                message: 'Run is resolving without enough flipped tiles to resolve.'
            });
        }
    }
    if (run.status === 'gameOver' && !boardReport.complete) {
        issues.push({
            code: 'run_terminal_incomplete_board',
            message: 'Run is terminal while the board is incomplete.'
        });
    }

    return {
        ...boardReport,
        issues,
        status: run.status,
        intentionalBlockers
    };
};
