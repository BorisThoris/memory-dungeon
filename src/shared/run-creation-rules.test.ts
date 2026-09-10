import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION } from './contracts';
import { createNewRun } from './run-creation-rules';

describe('run creation rules', () => {
    it('creates a deterministic base run with an initialized board', () => {
        const run = createNewRun(123, {
            runSeed: 20_001,
            runRulesVersionOverride: GAME_RULES_VERSION,
            echoFeedbackEnabled: false
        });

        expect(run.status).toBe('memorize');
        expect(run.stats.bestScore).toBe(123);
        expect(run.board?.level).toBe(1);
        expect(run.findablesTotalThisFloor).toBeGreaterThanOrEqual(0);
        expect(run.timerState.memorizeRemainingMs).toBeGreaterThan(0);
    });


});
