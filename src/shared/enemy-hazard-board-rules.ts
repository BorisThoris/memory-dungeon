import type { BoardState, EnemyHazardState, RunState, Tile } from './contracts';
import {
    DECOY_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';
import { runArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';

const isEnemyHazardRelevantPairTile = (tile: Tile): boolean =>
    !isSingletonUtilityPairKey(tile.pairKey) &&
    tile.pairKey !== DECOY_PAIR_KEY &&
    tile.pairKey !== WILD_PAIR_KEY;

export const enemyHazardsForBoard = (board: Pick<BoardState, 'enemyHazards'> | null | undefined): EnemyHazardState[] =>
    runArray(board?.enemyHazards);

export const enemyHazardEligibleTiles = (tiles: readonly Tile[]): Tile[] =>
    tiles.filter(
        (tile) =>
            tile.state !== 'matched' &&
            tile.state !== 'removed' &&
            tile.dungeonCardState !== 'resolved' &&
            isEnemyHazardRelevantPairTile(tile)
    );

const unclearedRealPairKeys = (tiles: readonly Tile[]): string[] => [
    ...new Set(enemyHazardEligibleTiles(tiles).map((tile) => tile.pairKey))
];

const tileIsCleared = (tile: Tile | undefined): boolean =>
    tile != null && (tile.state === 'matched' || tile.state === 'removed' || tile.dungeonCardState === 'resolved');

export const allRealBoardPairsCleared = (board: BoardState): boolean =>
    board.tiles.some(isEnemyHazardRelevantPairTile) &&
    board.tiles
        .filter(isEnemyHazardRelevantPairTile)
        .every((tile) => tileIsCleared(tile));

export const enemyHazardReferencesOnlyClearedTiles = (
    board: BoardState,
    hazard: NonNullable<BoardState['enemyHazards']>[number]
): boolean => {
    const tileById = new Map(board.tiles.map((tile) => [tile.id, tile]));
    const referencesOnlyClearedTiles = [hazard.currentTileId, hazard.nextTileId].every((tileId) =>
        tileIsCleared(tileById.get(tileId))
    );
    if (referencesOnlyClearedTiles) {
        return true;
    }
    return allRealBoardPairsCleared(board) && hazard.state !== 'defeated';
};

export const activeEnemyHazardsForBoard = (board: BoardState | null | undefined): NonNullable<BoardState['enemyHazards']> => {
    if (!board) {
        return [];
    }
    return enemyHazardsForBoard(board).filter(
        (hazard) => hazard.state !== 'defeated' && !enemyHazardReferencesOnlyClearedTiles(board, hazard)
    );
};

export const collectEnemyHazardsOccupyingFinalPair = (board: BoardState): EnemyHazardState[] => {
    const activeHazards = enemyHazardsForBoard(board).filter((hazard) => hazard.state !== 'defeated');
    if (activeHazards.length === 0) {
        return [];
    }
    const remainingPairKeys = unclearedRealPairKeys(board.tiles);
    if (remainingPairKeys.length !== 1) {
        return [];
    }
    const finalPairTileIds = new Set(
        board.tiles
            .filter(
                (tile) =>
                    tile.pairKey === remainingPairKeys[0] &&
                    tile.state !== 'matched' &&
                    tile.state !== 'removed'
            )
            .map((tile) => tile.id)
    );
    if (finalPairTileIds.size === 0) {
        return [];
    }
    const occupyingHazards = activeHazards.filter(
        (hazard) => finalPairTileIds.has(hazard.currentTileId) || finalPairTileIds.has(hazard.nextTileId)
    );
    if (board.pairCount <= 1 && board.matchedPairs <= 0) {
        return occupyingHazards.filter((hazard) => hazard.currentTileId === hazard.nextTileId);
    }
    return occupyingHazards;
};

export const defeatEnemyHazardOccupationOnFinalPair = (board: BoardState): BoardState => {
    const activeHazards = collectEnemyHazardsOccupyingFinalPair(board);
    if (activeHazards.length === 0) {
        return board;
    }
    const hazardsToClear = new Set(activeHazards.map((hazard) => hazard.id));
    return {
        ...board,
        enemyHazards: enemyHazardsForBoard(board).map((hazard) =>
            hazardsToClear.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
        )
    };
};

export const defeatEnemyHazardsOnClearedTiles = (board: BoardState): BoardState => {
    if (!allRealBoardPairsCleared(board)) {
        return board;
    }
    const activeHazards = enemyHazardsForBoard(board).filter((hazard) => hazard.state !== 'defeated');
    if (activeHazards.length === 0) {
        return board;
    }
    const ids = new Set(activeHazards.map((hazard) => hazard.id));
    return {
        ...board,
        enemyHazards: enemyHazardsForBoard(board).map((hazard) =>
            ids.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
        )
    };
};

export const clearFinalPairEnemyHazardOccupationForRun = (run: RunState): RunState => {
    if (!run.board) {
        return run;
    }
    const finalPairHazards = collectEnemyHazardsOccupyingFinalPair(run.board);
    const boardAfterFinalPair = defeatEnemyHazardOccupationOnFinalPair(run.board);
    const boardAfterClearedTiles = defeatEnemyHazardsOnClearedTiles(boardAfterFinalPair);
    const finalPairIds = new Set(finalPairHazards.map((hazard) => hazard.id));
    const clearedTileHazards = enemyHazardsForBoard(boardAfterFinalPair).filter((hazard) => {
        const updated = enemyHazardsForBoard(boardAfterClearedTiles).find((candidate) => candidate.id === hazard.id);
        return !finalPairIds.has(hazard.id) && hazard.state !== 'defeated' && updated?.state === 'defeated';
    });
    const hazardsToClear = [...finalPairHazards, ...clearedTileHazards];
    if (hazardsToClear.length === 0 || boardAfterClearedTiles === run.board) {
        return run;
    }
    const bossHazardsToClear = hazardsToClear.filter((hazard) => hazard.bossId != null).length;
    return {
        ...run,
        board: boardAfterClearedTiles,
        dungeonEnemiesDefeated: runNonNegativeInteger(run.dungeonEnemiesDefeated) + bossHazardsToClear,
        dungeonEnemiesDefeatedThisFloor:
            runNonNegativeInteger(run.dungeonEnemiesDefeatedThisFloor) + bossHazardsToClear,
        enemyHazardsDefeatedThisFloor:
            runNonNegativeInteger(run.enemyHazardsDefeatedThisFloor) + hazardsToClear.length
    };
};
