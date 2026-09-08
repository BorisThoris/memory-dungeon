import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    getLongRunActBossRows,
    getLongRunFatigueRows,
    runLongRunSoak
} from './long-run-depth';
import { runBalanceSimulation } from './balance-simulation';

const LONG_SIMULATION_TIMEOUT_MS = 15_000;

describe('GLD long-run depth contracts', () => {
    it('publishes a coherent scheduled act and boss read model', () => {
        const rows = getLongRunActBossRows({ seed: 42_001, rulesVersion: GAME_RULES_VERSION, floors: 12 });

        expect(rows).toHaveLength(12);
        expect(rows.filter((row) => row.expectedBoss).map((row) => row.floor)).toEqual([7, 9]);
        expect(rows.filter((row) => row.expectedBoss).every((row) => row.encounterRank === 'boss')).toBe(true);
        expect(rows.filter((row) => !row.expectedBoss).every((row) => row.encounterRank === null)).toBe(true);
        expect(rows.every((row) => row.status === 'coherent')).toBe(true);
        expect(rows.every((row) => row.actTitle.length > 0 && row.actProgress.includes('/'))).toBe(true);
    });




    it('adds fatigue guardrails for long-run balance samples', () => {
        const report = runBalanceSimulation({ seeds: [42_001, 42_077], floors: 48, rulesVersion: GAME_RULES_VERSION });
        const rows = getLongRunFatigueRows(report);

        expect(rows.map((row) => row.key)).toEqual([
            'breather_spacing'
        ]);
        expect(rows.every((row) => row.status === 'within_range')).toBe(true);
    }, LONG_SIMULATION_TIMEOUT_MS);

    it('runs the deterministic multi-seed long-run soak gate', () => {
        const report = runLongRunSoak({ seeds: [42_001, 42_077, 42_123], floors: 48, rulesVersion: GAME_RULES_VERSION });

        expect(report.offlineOnly).toBe(true);
        expect(report.issues).toEqual([]);
        expect(report.ok).toBe(true);
        expect(report.rows.map((row) => row.key)).toEqual(['breather_spacing']);
    }, LONG_SIMULATION_TIMEOUT_MS);
});
