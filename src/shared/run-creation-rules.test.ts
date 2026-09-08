import { describe, expect, it, vi } from 'vitest';

import { GAME_RULES_VERSION } from './contracts';
import {
    createNewRun,
    createWildRun,
    isGauntletExpired
} from './run-creation-rules';

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

    it('creates wild menu runs with wild and stray affordances', () => {
        const run = createWildRun(0, {
            runSeed: 20_002,
            runRulesVersionOverride: GAME_RULES_VERSION
        });

        expect(run.wildMenuRun).toBe(true);
        expect(run.wildMatchesRemaining).toBe(1);
        expect(run.strayRemoveCharges).toBe(1);
        expect(run.activeMutators).toEqual(['sticky_fingers', 'short_memorize', 'findables_floor']);
    });


    it('carries the clock the setup sheet asked for', () => {
        const timed = createNewRun(0, { gauntletDurationMs: 60_000, runSeed: 20_005 });

        expect(timed.gameMode).toBe('endless');
        expect(timed.gauntletSessionDurationMs).toBe(60_000);
    });

    it('reports clock expiration only while unpaused', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        const run = createNewRun(0, { gauntletDurationMs: 500, runSeed: 20_006 });

        vi.setSystemTime(2_000);

        expect(isGauntletExpired(run)).toBe(true);
        expect(isGauntletExpired({ ...run, status: 'paused' })).toBe(false);
        vi.useRealTimers();
    });
});
