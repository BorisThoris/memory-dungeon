import { type BoardState, type DungeonKeyKind, type RunState } from './contracts';
import {
    getDungeonExitStatus,
    getDungeonObjectiveStatus,
    type DungeonExitStatus
} from './dungeon-board-status';
import { addRunDungeonKey } from './dungeon-key-rules';
import { clearDungeonCardFields } from './dungeon-enemy-card-rules';
import { defeatEnemyHazardsForFloorClear } from './dungeon-enemy-hazard-rules';
import { gainRelicFavor } from './relic-favor-rules';
import { createRouteCardPlanForRoute } from './route-card-plan-rules';
import { normalizeSessionStats } from './session-stats-rules';
import {
    EXIT_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

export const DUNGEON_OBJECTIVE_SCORE_REWARD = 35;
export const DUNGEON_OBJECTIVE_FAVOR_REWARD = 1;

const nonNegativeDungeonExitCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export type DungeonExitActivationSpend = 'none' | 'key' | 'master_key';

export interface DungeonExitActivationSpendResult {
    canOpen: boolean;
    spendsKey: boolean;
    spendsMasterKey: boolean;
    keyKind: DungeonKeyKind | null;
}

export interface DungeonExitObjectiveRewardResult {
    run: RunState;
    rewarded: boolean;
}

export interface DungeonExitActivationTransition {
    board: BoardState;
    run: RunState;
}

export const chooseDungeonExitActivationSpend = (
    status: Pick<
        DungeonExitStatus,
        'canActivateWithoutSpend' | 'canActivateWithKey' | 'canActivateWithMasterKey'
    >
): DungeonExitActivationSpend => {
    if (status.canActivateWithoutSpend) {
        return 'none';
    }
    if (status.canActivateWithKey) {
        return 'key';
    }
    if (status.canActivateWithMasterKey) {
        return 'master_key';
    }
    return 'none';
};

export const resolveDungeonExitActivationSpend = (
    status: Pick<
        DungeonExitStatus,
        | 'canActivate'
        | 'canActivateWithKey'
        | 'canActivateWithMasterKey'
        | 'canActivateWithoutSpend'
        | 'lockKind'
    >,
    spend: DungeonExitActivationSpend
): DungeonExitActivationSpendResult => {
    const lockKind = status.lockKind;
    const spendsKey = spend === 'key' && lockKind !== 'none' && lockKind !== 'lever' && status.canActivateWithKey;
    const spendsMasterKey =
        spend === 'master_key' && lockKind !== 'none' && lockKind !== 'lever' && status.canActivateWithMasterKey;
    const canOpen =
        status.canActivateWithoutSpend ||
        (lockKind === 'lever' && status.canActivate) ||
        spendsKey ||
        spendsMasterKey;

    return {
        canOpen,
        spendsKey,
        spendsMasterKey,
        keyKind: spendsKey ? lockKind : null
    };
};

export const sealBoardForDungeonExit = (board: BoardState, activatedExitTileId?: string): BoardState => {
    const realPairKeys = new Set(
        board.tiles
            .map((tile) => tile.pairKey)
            .filter((pairKey) => !isSingletonUtilityPairKey(pairKey))
    );
    return {
        ...board,
        matchedPairs: realPairKeys.size,
        flippedTileIds: [],
        dungeonExitActivated: true,
        tiles: board.tiles.map((tile) => {
            if (tile.pairKey === EXIT_PAIR_KEY) {
                return {
                    ...tile,
                    state: 'matched' as const,
                    dungeonCardState: 'resolved' as const,
                    dungeonExitActivated: activatedExitTileId == null || tile.id === activatedExitTileId
                };
            }
            if (isSingletonUtilityPairKey(tile.pairKey)) {
                return tile.state === 'flipped' ? { ...tile, state: 'hidden' as const } : tile;
            }
            return tile.state === 'matched' || tile.state === 'removed'
                ? tile
                : clearDungeonCardFields({ ...tile, state: 'removed' as const });
        })
    };
};

export const applyDungeonExitObjectiveReward = (
    run: RunState,
    status: Pick<DungeonExitStatus, 'routeType'>
): DungeonExitObjectiveRewardResult => {
    const objective = getDungeonObjectiveStatus(run);
    const rewarded =
        (objective.completed || (objective.objectiveId === 'claim_route' && status.routeType != null)) &&
        objective.objectiveId !== 'find_exit';
    const favor = gainRelicFavor(run, rewarded ? DUNGEON_OBJECTIVE_FAVOR_REWARD : 0);
    const stats = normalizeSessionStats(run.stats);
    const totalScore = stats.totalScore + DUNGEON_OBJECTIVE_SCORE_REWARD;

    return {
        rewarded,
        run: {
            ...run,
            stats: rewarded
                ? {
                      ...stats,
                      totalScore,
                      currentLevelScore: stats.currentLevelScore + DUNGEON_OBJECTIVE_SCORE_REWARD,
                      bestScore: Math.max(stats.bestScore, totalScore)
                  }
                : run.stats,
            bonusRelicPicksNextOffer: favor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: favor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: favor.relicFavorProgress
        }
    };
};

export const createDungeonExitActivationTransition = (
    run: RunState,
    spend?: DungeonExitActivationSpend
): DungeonExitActivationTransition | null => {
    if (run.status !== 'playing' || !run.board) {
        return null;
    }
    const status = getDungeonExitStatus(run);
    if (!status.exitTile || !status.revealed) {
        return null;
    }
    const activationSpend = resolveDungeonExitActivationSpend(status, spend ?? chooseDungeonExitActivationSpend(status));
    if (!activationSpend.canOpen) {
        return null;
    }
    const nextKeys = activationSpend.keyKind
        ? addRunDungeonKey(run.dungeonKeys, activationSpend.keyKind, -1)
        : run.dungeonKeys;
    const objectiveReward = applyDungeonExitObjectiveReward(run, status);
    const floorClearHazards = defeatEnemyHazardsForFloorClear(sealBoardForDungeonExit(run.board, status.exitTile.id));
    const openedBoard = floorClearHazards.board;
    const routeType = status.routeType;

    return {
        board: openedBoard,
        run: {
            ...objectiveReward.run,
            dungeonKeys: nextKeys,
            dungeonMasterKeys: activationSpend.spendsMasterKey
                ? Math.max(0, nonNegativeDungeonExitCount(run.dungeonMasterKeys) - 1)
                : nonNegativeDungeonExitCount(run.dungeonMasterKeys),
            dungeonEnemiesDefeated:
                nonNegativeDungeonExitCount(objectiveReward.run.dungeonEnemiesDefeated) +
                floorClearHazards.bossesDefeated,
            dungeonEnemiesDefeatedThisFloor:
                nonNegativeDungeonExitCount(objectiveReward.run.dungeonEnemiesDefeatedThisFloor) +
                floorClearHazards.bossesDefeated,
            enemyHazardsDefeatedThisFloor:
                nonNegativeDungeonExitCount(objectiveReward.run.enemyHazardsDefeatedThisFloor) +
                floorClearHazards.defeated,
            dungeonGatewaysUsed: nonNegativeDungeonExitCount(run.dungeonGatewaysUsed) + 1,
            pendingRouteCardPlan:
                run.pendingRouteCardPlan == null && routeType
                    ? createRouteCardPlanForRoute(
                          run,
                          routeType,
                          `exit:${run.runRulesVersion}:${run.runSeed}:${run.board.level}:${routeType}`
                      )
                    : run.pendingRouteCardPlan,
            board: openedBoard
        }
    };
};
