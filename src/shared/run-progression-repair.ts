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

export interface RunProgressionRepairTransition {
    run: RunState;
    repaired: boolean;
}

/**
 * Same repair as `repairRunProgressionSoftlocks`, but reports whether anything
 * actually changed so callers can decide to emit an event or take another turn
 * instead of re-running the repair blindly.
 */
export const createRunProgressionRepairTransition = (run: RunState): RunProgressionRepairTransition => {
    const repairedRun = repairRunProgressionSoftlocks(run);
    return { run: repairedRun, repaired: repairedRun !== run };
};
