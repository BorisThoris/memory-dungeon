import type { RunState } from './contracts';
import {
    chooseDungeonExitActivationSpend,
    type DungeonExitActivationSpend
} from './dungeon-exit-rules';
import { getDungeonExitStatus } from './dungeon-board-status';
import {
    createGameplayDestroyPairCommand,
    createGameplayDungeonExitActivateCommand
} from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import { appendGameplayJournal } from './gameplay-journal';

export const createApplyDestroyPair = () =>
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
        return journaledRun;
    };

export const createActivateDungeonExit = () =>
    (run: RunState, spend?: DungeonExitActivationSpend): RunState => {
        const resolvedSpend = spend ?? chooseDungeonExitActivationSpend(getDungeonExitStatus(run));
        const command = createGameplayDungeonExitActivateCommand(
            `dungeon-exit:${run.runSeed}:${run.board?.level ?? 0}:${run.dungeonGatewaysUsed}:${resolvedSpend}`,
            resolvedSpend
        );
        const result = reduceGameplayCommand(run, command);
        if (!result.accepted) {
            return run;
        }
        return appendGameplayJournal(result.run, [command], result.events);
    };
