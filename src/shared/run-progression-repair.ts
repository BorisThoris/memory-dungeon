import type { RunState } from './contracts';
import { repairDungeonExitSoftlocks } from './board-inspection';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';

export const repairRunProgressionSoftlocks = (run: RunState): RunState => {
    if (!run.board) {
        return run;
    }

    const repairedBoard = repairDungeonExitSoftlocks(run.board, {
        dungeonKeys: run.dungeonKeys,
        dungeonMasterKeys: run.dungeonMasterKeys,
        preservePendingKeyFallback: true
    });
    const repairedRun = repairedBoard === run.board ? run : { ...run, board: repairedBoard };
    return clearFinalPairEnemyHazardOccupationForRun(repairedRun);
};

export type RunProgressionRepairKind = 'exit_lock' | 'exit_metadata' | 'enemy_hazard';

export interface RunProgressionRepairTransition {
    run: RunState;
    repaired: boolean;
    /** What the repair actually changed, so the event can say rather than the caller guess. */
    repairKinds: RunProgressionRepairKind[];
    /** Hazards the repair had to defeat, named so the audit can tell which went stale. */
    enemyHazardIdsDefeated: string[];
}

/**
 * Same repair as `repairRunProgressionSoftlocks`, but reports whether anything
 * actually changed so callers can decide to emit an event or take another turn
 * instead of re-running the repair blindly.
 */
export const createRunProgressionRepairTransition = (run: RunState): RunProgressionRepairTransition => {
    const repairedRun = repairRunProgressionSoftlocks(run);
    if (repairedRun === run) {
        return { run, repaired: false, repairKinds: [], enemyHazardIdsDefeated: [] };
    }

    const before = run.board;
    const after = repairedRun.board;
    const exitTileBefore = before?.tiles.find((tile) => tile.id === before.dungeonExitTileId);
    const exitTileAfter = after?.tiles.find((tile) => tile.id === after.dungeonExitTileId);
    const repairKinds: RunProgressionRepairKind[] = [];
    if (before?.dungeonExitLockKind !== after?.dungeonExitLockKind) {
        repairKinds.push('exit_lock');
    }
    if (
        exitTileBefore?.dungeonExitLockKind !== exitTileAfter?.dungeonExitLockKind ||
        exitTileBefore?.dungeonCardState !== exitTileAfter?.dungeonCardState
    ) {
        repairKinds.push('exit_metadata');
    }
    const enemyHazardIdsDefeated = (after?.enemyHazards ?? [])
        .filter((hazard) => {
            const previous = (before?.enemyHazards ?? []).find((candidate) => candidate.id === hazard.id);
            return previous != null && previous.state !== 'defeated' && hazard.state === 'defeated';
        })
        .map((hazard) => hazard.id);
    if (JSON.stringify(before?.enemyHazards ?? []) !== JSON.stringify(after?.enemyHazards ?? [])) {
        repairKinds.push('enemy_hazard');
    }
    return { run: repairedRun, repaired: true, repairKinds, enemyHazardIdsDefeated };
};
