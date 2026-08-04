import type { RunState } from './contracts';
import { chooseDungeonExitActivationSpend, type DungeonExitActivationSpend } from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import {
    applyDestroyPairThroughGameplayCore,
    applyTileFlipThroughGameplayCore,
    executeGameplayCommandThroughGameplayCore,
    resolveBoardTurnThroughGameplayCore
} from './gameplay-core-adapters';
import { createGameplayDungeonExitActivateCommand, type GameplayEvent } from './gameplay-core-contracts';

/**
 * Compatibility functions keep the historical state-in/state-out API for
 * shared callers while making the serialized command core the only executor.
 */
export const flipTile = (run: RunState, tileId: string): RunState => {
    if (typeof tileId !== 'string' || tileId.length === 0) {
        return run;
    }
    const result = applyTileFlipThroughGameplayCore(run, tileId);
    return result.accepted ? result.run : run;
};

export const applyDestroyPair = (run: RunState, tileId: string): RunState => {
    const result = applyDestroyPairThroughGameplayCore(run, tileId);
    return result.accepted ? result.run : run;
};

export const activateDungeonExit = (
    run: RunState,
    spend?: DungeonExitActivationSpend
): RunState => {
    const resolvedSpend = spend ?? chooseDungeonExitActivationSpend(getDungeonExitStatus(run));
    const command = createGameplayDungeonExitActivateCommand(
        `dungeon-exit:${run.runSeed}:${run.board?.level ?? 0}:${run.dungeonGatewaysUsed}:${resolvedSpend}`,
        resolvedSpend
    );
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    return result.accepted ? result.run : run;
};

export interface BoardTurnResolutionResult {
    run: RunState;
    event: Extract<GameplayEvent, { type: 'board.turn_resolved' }> | null;
}

export const resolveBoardTurnWithEvent = (
    run: RunState,
    encorePairKeys: string[] = []
): BoardTurnResolutionResult => {
    const result = resolveBoardTurnThroughGameplayCore(run, encorePairKeys);
    const event = [...result.events].reverse().find(
        (item): item is Extract<GameplayEvent, { type: 'board.turn_resolved' }> =>
            item.type === 'board.turn_resolved'
    ) ?? null;
    return {
        run: result.migrated ? result.run : run,
        event
    };
};

export const resolveBoardTurn = (run: RunState, encorePairKeys: string[] = []): RunState =>
    resolveBoardTurnWithEvent(run, encorePairKeys).run;
