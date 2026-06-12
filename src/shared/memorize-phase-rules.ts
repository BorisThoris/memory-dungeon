import { type RunState } from './contracts';
import { getRunMemorizePhaseRecallFocus } from './dungeon-run-state-rules';

export const finishMemorizePhase = (run: RunState): RunState =>
    run.status !== 'memorize'
        ? run
        : {
              ...run,
              status: 'playing',
              recallFocus: getRunMemorizePhaseRecallFocus(run),
              timerState: {
                  ...run.timerState,
                  memorizeRemainingMs: null,
                  pausedFromStatus: null
              }
          };
