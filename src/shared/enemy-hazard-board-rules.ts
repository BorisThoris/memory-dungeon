import type { BoardState, EnemyHazardState, RunState, Tile } from './contracts';
import {
    DECOY_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

export const enemyHazardEligibleTiles = (tiles: readonly Tile[]): Tile[] =>
    tiles.filter(
        (tile) =>
            tile.state !== 'matched' &&
            tile.state !== 'removed' &&
            !isSingletonUtilityPairKey(tile.pairKey) &&
            tile.pairKey !== DECOY_PAIR_KEY &&
            tile.pairKey !== WILD_PAIR_KEY
    );

const unclearedRealPairKeys = (tiles: readonly Tile[]): string[] => [
    ...new Set(enemyHazardEligibleTiles(tiles).map((tile) => tile.pairKey))
];

export const collectEnemyHazardsOccupyingFinalPair = (board: BoardState): EnemyHazardState[] => {
    const activeHazards = board.enemyHazards?.filter((hazard) => hazard.state !== 'defeated') ?? [];
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
        enemyHazards: board.enemyHazards?.map((hazard) =>
            hazardsToClear.has(hazard.id) ? { ...hazard, hp: 0, state: 'defeated' as const } : hazard
        )
    };
};

export const clearFinalPairEnemyHazardOccupationForRun = (run: RunState): RunState => {
    if (!run.board) {
        return run;
    }
    const hazardsToClear = collectEnemyHazardsOccupyingFinalPair(run.board);
    if (hazardsToClear.length === 0) {
        return run;
    }
    const bossHazardsToClear = hazardsToClear.filter((hazard) => hazard.bossId != null).length;
    return {
        ...run,
        board: defeatEnemyHazardOccupationOnFinalPair(run.board),
        dungeonEnemiesDefeated: run.dungeonEnemiesDefeated + bossHazardsToClear,
        dungeonEnemiesDefeatedThisFloor: (run.dungeonEnemiesDefeatedThisFloor ?? 0) + bossHazardsToClear,
        enemyHazardsDefeatedThisFloor: (run.enemyHazardsDefeatedThisFloor ?? 0) + hazardsToClear.length
    };
};
