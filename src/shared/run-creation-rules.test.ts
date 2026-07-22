import { describe, expect, it, vi } from 'vitest';

import { GAME_RULES_VERSION, type Tile } from './contracts';
import {
    createDailyRun,
    createGauntletRun,
    createNewRun,
    createPuzzleRun,
    createWildRun,
    isGauntletExpired
} from './run-creation-rules';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden'
});

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

    it('creates puzzle runs from copied fixed tiles', () => {
        const tiles = [tile('p1', 'P'), tile('p2', 'P')];

        const run = createPuzzleRun(0, 'puzzle-one', tiles, 4, {
            runSeed: 20_003,
            runRulesVersionOverride: GAME_RULES_VERSION
        });

        expect(run.gameMode).toBe('puzzle');
        expect(run.puzzleId).toBe('puzzle-one');
        expect(run.board?.level).toBe(4);
        expect(run.board?.tiles).toEqual(tiles);
        expect(run.board?.tiles).not.toBe(tiles);
    });

    it('creates daily and gauntlet run metadata', () => {
        const daily = createDailyRun(0, { runSeed: 20_004 });
        const gauntlet = createGauntletRun(0, 60_000, { runSeed: 20_005 });

        expect(daily.gameMode).toBe('daily');
        expect(daily.dailyDateKeyUtc).not.toBeNull();
        expect(daily.activeMutators).toHaveLength(1);
        expect(gauntlet.gameMode).toBe('gauntlet');
        expect(gauntlet.gauntletSessionDurationMs).toBe(60_000);
    });

    it('reports gauntlet expiration only while unpaused', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        const run = createGauntletRun(0, 500, { runSeed: 20_006 });

        vi.setSystemTime(2_000);

        expect(isGauntletExpired(run)).toBe(true);
        expect(isGauntletExpired({ ...run, status: 'paused' })).toBe(false);
        vi.useRealTimers();
    });
});
