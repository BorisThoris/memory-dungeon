import { describe, expect, it } from 'vitest';
import { INITIAL_RECALL_FOCUS } from './contracts';
import { createNewRun } from './run-creation-rules';
import { finishMemorizePhase } from './memorize-phase-rules';

describe('finishMemorizePhase', () => {
    it('moves a memorize run into playing and clears memorize timer state', () => {
        const run = {
            ...createNewRun(0, { echoFeedbackEnabled: false }),
            recallFocus: 0,
            timerState: {
                memorizeRemainingMs: 1200,
                resolveRemainingMs: null,
                debugRevealRemainingMs: null,
                pausedFromStatus: 'memorize' as const
            }
        };

        const next = finishMemorizePhase(run);

        expect(next.status).toBe('playing');
        expect(next.recallFocus).toBe(INITIAL_RECALL_FOCUS);
        expect(next.timerState).toMatchObject({
            memorizeRemainingMs: null,
            pausedFromStatus: null
        });
    });

    it('leaves non-memorize runs unchanged', () => {
        const run = {
            ...createNewRun(0, { echoFeedbackEnabled: false }),
            status: 'playing' as const
        };

        expect(finishMemorizePhase(run)).toBe(run);
    });
});
