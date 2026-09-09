import type { BoardState, RunState, RunStatus, Tile } from './contracts';
import { WILD_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';

/** When the board includes a wild joker, returns its tile id; otherwise null. */
export const getWildTileIdFromBoard = (board: BoardState): string | null =>
    board.tiles.find((tile) => tile.pairKey === WILD_PAIR_KEY)?.id ?? null;


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

const tileIsCleared = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

/** Floor completion ignores singleton utility tiles: only real pairs must be cleared. */
export const isBoardComplete = (board: BoardState): boolean =>
    board.tiles.every((tile) => {
        if (isSingletonUtilityPairKey(tile.pairKey)) {
            return true;
        }
        return tileIsCleared(tile);
    });

export type BoardFairnessIssueCode =
    | 'real_pair_incomplete'
    | 'real_pair_missing_actionable_tile'
    | 'wild_singleton_unmatched_without_route'
    | 'matched_pairs_counter_mismatch'
    | 'board_tile_count_mismatch'
    | 'flipped_tile_reference_missing'
    | 'completion_route_missing'
    | 'trait_interaction_missing'
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
    wildTileIds: string[];
    hasCompletionRoute: boolean;
}

const tileIsActionableForCompletion = (tile: Tile): boolean =>
    tile.state === 'hidden' || tile.state === 'flipped';

const pairIsCleared = (tiles: readonly Tile[]): boolean => tiles.every(tileIsCleared);

/**
 * REG-087 anti-softlock inspection for board structure and completion reachability.
 *
 * This is intentionally rules-only and side-effect free: it does not solve perfect play, but it catches
 * malformed/orphaned pairs, stale completion counters, and singleton wild boards that no longer have a legal path
 * to finish. Wild tiles are allowed only while at least one real actionable tile or stray-removal route remains.
 */
export const inspectBoardFairness = (board: BoardState): BoardFairnessReport => {
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
    const wildTiles = groups.get(WILD_PAIR_KEY) ?? [];
    const wildTileIds = wildTiles.map((tile) => tile.id);

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

    if (board.matchedPairs !== matchedOrRemovedRealPairs) {
        issues.push({
            code: 'matched_pairs_counter_mismatch',
            message: `matchedPairs is ${board.matchedPairs}, but ${matchedOrRemovedRealPairs} real pair(s) are cleared or self-resolved.`
        });
    }

    const actionableRealTileExists = actionableRealPairKeys.length > 0;
    const hiddenRealTileExists = board.tiles.some(
        (tile) => !isSingletonUtilityPairKey(tile.pairKey) && tile.state === 'hidden'
    );

    if (!Array.isArray(board.flippedTileIds)) {
        issues.push({
            code: 'flipped_tile_reference_missing',
            message: 'flippedTileIds is malformed and cannot be inspected.'
        });
    } else {
        for (const flippedId of board.flippedTileIds) {
            if (!board.tiles.some((tile) => tile.id === flippedId && tile.state === 'flipped')) {
                issues.push({
                    code: 'flipped_tile_reference_missing',
                    message: `flippedTileIds references "${flippedId}", but no matching flipped tile exists.`,
                    tileIds: [flippedId]
                });
            }
        }
    }

    for (const wild of wildTiles) {
        if (
            tileIsActionableForCompletion(wild) &&
            !actionableRealTileExists &&
            !hiddenRealTileExists &&
            !isBoardComplete(board)
        ) {
            structurallyClearable = false;
            issues.push({
                code: 'wild_singleton_unmatched_without_route',
                message: 'Wild singleton is still actionable, but no real hidden tile or removal route remains.',
                pairKey: WILD_PAIR_KEY,
                tileIds: [wild.id]
            });
        }
    }
    const hasCompletionRoute =
        structurallyClearable && (isBoardComplete(board) || actionableRealPairKeys.length > 0);

    return {
        complete: isBoardComplete(board),
        issues,
        realPairKeys,
        actionableRealPairKeys,
        hiddenRealPairKeys,
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
            wildTileIds: [],
            hasCompletionRoute: false,
            status: 'missingBoard',
            intentionalBlockers: []
        };
    }

    const boardReport = inspectBoardFairness(run.board);
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
        if (Array.isArray(run.board.flippedTileIds) && run.board.flippedTileIds.length >= 2) {
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
