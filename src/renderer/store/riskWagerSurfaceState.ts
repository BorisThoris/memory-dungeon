import type { RunState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { createGameplayRiskWagerAcceptCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';

type RiskWagerSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: { run: RunState };
          events: GameplayEvent[];
      };

export const createRiskWagerSurfaceResult = (run: RunState | null): RiskWagerSurfaceResult => {
    if (!run) {
        return { kind: 'ignored' };
    }

    const command = createGameplayRiskWagerAcceptCommand(
        `risk-wager:${run.runSeed}:${run.lastLevelResult?.level ?? run.board?.level ?? 0}`
    );
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            run: appendGameplayJournal(result.run, [command], result.events)
        },
        events: result.events
    };
};
