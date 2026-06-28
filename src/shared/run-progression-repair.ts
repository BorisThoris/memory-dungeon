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
