import type { RunState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { createGameplayRiskWagerAcceptCommand } from '../../shared/gameplay-core-contracts';
import { executeGameplayCommandThroughGameplayCore } from '../../shared/gameplay-core-adapters';

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
    const result = executeGameplayCommandThroughGameplayCore(run, command);
    if (!result.accepted) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            run: result.run
        },
        events: result.events
    };
};
