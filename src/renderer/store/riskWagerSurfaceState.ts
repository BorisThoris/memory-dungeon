import type { RunState } from '../../shared/contracts';
import { acceptEndlessRiskWager } from '../../shared/objective-rules';

type RiskWagerSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: { run: RunState };
      };

export const createRiskWagerSurfaceResult = (run: RunState | null): RiskWagerSurfaceResult => {
    if (!run) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            run: acceptEndlessRiskWager(run)
        }
    };
};
