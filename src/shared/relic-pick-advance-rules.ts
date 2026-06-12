import {
    type RelicId,
    type RunState
} from './contracts';
import { createRelicPickAdvanceResult } from './relic-offer-rules';
import { advanceToNextLevel } from './next-floor-transition-rules';

export const completeRelicPickAndAdvance = (run: RunState, relicId: RelicId): RunState => {
    const result = createRelicPickAdvanceResult(run, relicId);
    return result.kind === 'advanceToNextLevel' ? advanceToNextLevel(result.run) : result.run;
};
