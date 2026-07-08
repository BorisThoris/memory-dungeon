import type { BoardState, RunState } from './contracts';
import { createDungeonExitActivationTransition, type DungeonExitActivationSpend } from './dungeon-exit-rules';
import { isBoardComplete } from './board-inspection';
import { applyDestroyPairTransition } from './board-power-actions';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';

interface FloorCompletionTransitionDeps {
    finalizeLevel: (run: RunState, board: BoardState) => RunState;
}

export const createApplyDestroyPair = ({ finalizeLevel }: FloorCompletionTransitionDeps) =>
    (run: RunState, tileId: string): RunState => {
        const transition = applyDestroyPairTransition(run, tileId, {
            isBoardComplete,
            rotateShiftingSpotlight: rotateRunShiftingSpotlight
        });

        if (!transition.changed) {
            return run;
        }

        const cleanedRun = clearFinalPairEnemyHazardOccupationForRun(transition.run);

        return transition.boardComplete && cleanedRun.board
            ? finalizeLevel(cleanedRun, cleanedRun.board)
            : cleanedRun;
    };

export const createActivateDungeonExit = ({ finalizeLevel }: FloorCompletionTransitionDeps) =>
    (run: RunState, spend?: DungeonExitActivationSpend): RunState => {
        const transition = createDungeonExitActivationTransition(run, spend);
        if (!transition) {
            return run;
        }
        return finalizeLevel(transition.run, transition.board);
    };
