import type { RunState } from './contracts';
import { createGameplayTileFlipCommand } from './gameplay-core-contracts';
import { runStringArray } from './run-array-guards';

export const createTileFlipCommandForRun = (run: RunState, tileId: string) => {
    const flipHistoryLength = runStringArray(run.flipHistory).length;
    const flippedTileIds = runStringArray(run.board?.flippedTileIds);
    return createGameplayTileFlipCommand(
        `tile-flip:${run.runSeed}:${run.board?.level ?? 0}:${flipHistoryLength}:${flippedTileIds.join('+') || 'none'}:${tileId}`,
        tileId
    );
};
