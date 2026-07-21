import { type RunState } from './contracts';
import { getRunMemorizePhaseRecallFocus } from './dungeon-run-state-rules';
import { createTimerState } from './run-timer-rules';

const memorizeTimerState = (value: unknown): RunState['timerState'] =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? createTimerState(value as Partial<RunState['timerState']>)
        : createTimerState();

export const finishMemorizePhase = (run: RunState): RunState =>
    run.status !== 'memorize'
        ? run
        : {
              ...run,
              status: 'playing',
              recallFocus: getRunMemorizePhaseRecallFocus(run),
              timerState: {
                  ...memorizeTimerState(run.timerState),
                  memorizeRemainingMs: null,
                  pausedFromStatus: null
              }
          };
