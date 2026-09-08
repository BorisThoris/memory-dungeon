import { describe, expect, it } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import {
    shouldScheduleDebugRevealTimerOnResume,
    shouldScheduleMemorizeTimerOnResume
} from './runTimerResumeConditions';

describe('runTimerResumeConditions (REF-004)', () => {
    it('schedules memorize timer when remaining is 0 (not only when truthy)', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...base,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 0
            }
        };
        expect(shouldScheduleMemorizeTimerOnResume(run)).toBe(true);
    });

    it('does not schedule memorize when remaining is null', () => {
        const base = createNewRun(0, { echoFeedbackEnabled: false });
        const run: RunState = {
            ...base,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: null
            }
        };
        expect(shouldScheduleMemorizeTimerOnResume(run)).toBe(false);
    });

    it('schedules debug reveal when remaining is 0 and peek is active', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run: RunState = {
            ...playing,
            debugPeekActive: true,
            timerState: {
                ...playing.timerState,
                debugRevealRemainingMs: 0
            }
        };
        expect(shouldScheduleDebugRevealTimerOnResume(run)).toBe(true);
    });

    it('does not schedule debug reveal when remaining is null', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const run: RunState = {
            ...playing,
            debugPeekActive: true,
            timerState: {
                ...playing.timerState,
                debugRevealRemainingMs: null
            }
        };
        expect(shouldScheduleDebugRevealTimerOnResume(run)).toBe(false);
    });
});
