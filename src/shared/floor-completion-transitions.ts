import type { BoardState, RunState } from './contracts';
import { createDungeonExitActivationTransition, type DungeonExitActivationSpend } from './dungeon-exit-rules';
import { createGameplayDestroyPairCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';

interface FloorCompletionTransitionDeps {
    finalizeLevel: (run: RunState, board: BoardState) => RunState;
}

export const createApplyDestroyPair = ({ finalizeLevel }: FloorCompletionTransitionDeps) =>
    (run: RunState, tileId: string): RunState => {
        const command = createGameplayDestroyPairCommand(
            `destroy-pair:${run.runSeed}:${run.board?.level ?? 0}:${run.destroyPairCharges}:${tileId}`,
            tileId
        );
        const result = reduceGameplayCommand(run, command);
        if (!result.accepted) {
            return run;
        }
        const journaledRun = appendGameplayJournal(result.run, [command], result.events);
        const boardComplete = result.events.some(
            (event) => event.type === 'board.pair_destroyed' && event.boardComplete
        );
        return boardComplete && journaledRun.board
            ? finalizeLevel(journaledRun, journaledRun.board)
            : journaledRun;
    };

export const createActivateDungeonExit = ({ finalizeLevel }: FloorCompletionTransitionDeps) =>
    (run: RunState, spend?: DungeonExitActivationSpend): RunState => {
        const transition = createDungeonExitActivationTransition(run, spend);
        if (!transition) {
            return run;
        }
        return finalizeLevel(transition.run, transition.board);
    };
