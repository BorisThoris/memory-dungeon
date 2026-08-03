import type { DungeonExitLockKind, RunState } from './contracts';
import { repairDungeonExitSoftlocks } from './board-inspection';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';
import { runNonNegativeInteger } from './run-number-guards';

export const RUN_PROGRESSION_REPAIR_KINDS = [
    'exit_lock',
    'exit_lever_count',
    'exit_metadata',
    'enemy_hazard'
] as const;

export type RunProgressionRepairKind = (typeof RUN_PROGRESSION_REPAIR_KINDS)[number];

export interface RunProgressionRepairSummary {
    repairKinds: RunProgressionRepairKind[];
    exitTileId: string | null;
    exitLockKindBefore: DungeonExitLockKind;
    exitLockKindAfter: DungeonExitLockKind;
    exitRequiredLeverCountBefore: number;
    exitRequiredLeverCountAfter: number;
    enemyHazardIdsDefeated: string[];
    dungeonEnemiesDefeatedBefore: number;
    dungeonEnemiesDefeatedAfter: number;
    dungeonEnemiesDefeatedThisFloorBefore: number;
    dungeonEnemiesDefeatedThisFloorAfter: number;
    enemyHazardsDefeatedThisFloorBefore: number;
    enemyHazardsDefeatedThisFloorAfter: number;
}

export interface RunProgressionRepairTransition {
    run: RunState;
    repaired: boolean;
    summary: RunProgressionRepairSummary;
}

const EXIT_LOCK_KINDS = new Set<DungeonExitLockKind>([
    'none',
    'lever',
    'iron',
    'treasure',
    'shrine',
    'boss',
    'trap'
]);

const exitLockKind = (value: unknown): DungeonExitLockKind =>
    typeof value === 'string' && EXIT_LOCK_KINDS.has(value as DungeonExitLockKind)
        ? value as DungeonExitLockKind
        : 'none';

const enemyHazards = (run: RunState) =>
    Array.isArray(run.board?.enemyHazards) ? run.board.enemyHazards : [];

const createRepairSummary = (before: RunState, after: RunState): RunProgressionRepairSummary => {
    const exitTileId = typeof before.board?.dungeonExitTileId === 'string'
        ? before.board.dungeonExitTileId
        : null;
    const exitBefore = before.board?.tiles.find((tile) => tile.id === exitTileId);
    const exitAfter = after.board?.tiles.find((tile) => tile.id === exitTileId);
    const exitLockKindBefore = exitLockKind(
        exitBefore?.dungeonExitLockKind ?? before.board?.dungeonExitLockKind
    );
    const exitLockKindAfter = exitLockKind(
        exitAfter?.dungeonExitLockKind ?? after.board?.dungeonExitLockKind
    );
    const exitRequiredLeverCountBefore = runNonNegativeInteger(
        exitBefore?.dungeonExitRequiredLeverCount ?? before.board?.dungeonExitRequiredLeverCount
    );
    const exitRequiredLeverCountAfter = runNonNegativeInteger(
        exitAfter?.dungeonExitRequiredLeverCount ?? after.board?.dungeonExitRequiredLeverCount
    );
    const hazardsBefore = new Map(enemyHazards(before).map((hazard) => [hazard.id, hazard]));
    const enemyHazardIdsDefeated = enemyHazards(after)
        .filter((hazard) => hazardsBefore.get(hazard.id)?.state !== 'defeated' && hazard.state === 'defeated')
        .map((hazard) => hazard.id)
        .sort((left, right) => left.localeCompare(right));
    const repairKindSet = new Set<RunProgressionRepairKind>();
    if (exitLockKindBefore !== exitLockKindAfter) {
        repairKindSet.add('exit_lock');
    }
    if (exitRequiredLeverCountBefore !== exitRequiredLeverCountAfter) {
        repairKindSet.add('exit_lever_count');
    }
    if (
        before.board !== after.board &&
        (before.board?.dungeonExitLockKind !== after.board?.dungeonExitLockKind ||
            before.board?.dungeonExitRequiredLeverCount !== after.board?.dungeonExitRequiredLeverCount)
    ) {
        repairKindSet.add('exit_metadata');
    }
    if (enemyHazardIdsDefeated.length > 0) {
        repairKindSet.add('enemy_hazard');
    }
    return {
        repairKinds: RUN_PROGRESSION_REPAIR_KINDS.filter((kind) => repairKindSet.has(kind)),
        exitTileId,
        exitLockKindBefore,
        exitLockKindAfter,
        exitRequiredLeverCountBefore,
        exitRequiredLeverCountAfter,
        enemyHazardIdsDefeated,
        dungeonEnemiesDefeatedBefore: runNonNegativeInteger(before.dungeonEnemiesDefeated),
        dungeonEnemiesDefeatedAfter: runNonNegativeInteger(after.dungeonEnemiesDefeated),
        dungeonEnemiesDefeatedThisFloorBefore: runNonNegativeInteger(before.dungeonEnemiesDefeatedThisFloor),
        dungeonEnemiesDefeatedThisFloorAfter: runNonNegativeInteger(after.dungeonEnemiesDefeatedThisFloor),
        enemyHazardsDefeatedThisFloorBefore: runNonNegativeInteger(before.enemyHazardsDefeatedThisFloor),
        enemyHazardsDefeatedThisFloorAfter: runNonNegativeInteger(after.enemyHazardsDefeatedThisFloor)
    };
};

export const createRunProgressionRepairTransition = (run: RunState): RunProgressionRepairTransition => {
    if (!run.board) {
        return { run, repaired: false, summary: createRepairSummary(run, run) };
    }

    const repairedBoard = repairDungeonExitSoftlocks(run.board, {
        dungeonKeys: run.dungeonKeys,
        dungeonMasterKeys: run.dungeonMasterKeys,
        preservePendingKeyFallback: true
    });
    const repairedRun = repairedBoard === run.board ? run : { ...run, board: repairedBoard };
    const nextRun = clearFinalPairEnemyHazardOccupationForRun(repairedRun);
    return {
        run: nextRun,
        repaired: nextRun !== run,
        summary: createRepairSummary(run, nextRun)
    };
};

export const repairRunProgressionSoftlocks = (run: RunState): RunState =>
    createRunProgressionRepairTransition(run).run;
