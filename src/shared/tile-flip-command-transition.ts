import type { RunState } from './contracts';
import { createGameplayTileFlipCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';
import { runStringArray } from './run-array-guards';

export const createTileFlipCommandForRun = (run: RunState, tileId: string) => {
    const flipHistoryLength = runStringArray(run.flipHistory).length;
    const flippedTileIds = runStringArray(run.board?.flippedTileIds);
    return createGameplayTileFlipCommand(
        `tile-flip:${run.runSeed}:${run.board?.level ?? 0}:${flipHistoryLength}:${flippedTileIds.join('+') || 'none'}:${tileId}`,
        tileId
    );
};

export const createApplyTileFlip = () =>
    (run: RunState, tileId: string): RunState => {
        if (typeof tileId !== 'string' || tileId.length === 0) {
            return run;
        }
        const command = createTileFlipCommandForRun(run, tileId);
        const result = reduceGameplayCommand(run, command);
        return result.accepted
            ? appendGameplayJournal(result.run, [command], result.events)
            : run;
    };
