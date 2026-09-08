import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    getLongRunActBossRows,
    getLongRunFatigueRows,
    getLongRunRelicDecisionRows,
    getLongRunRoutePreviewRows,
    runLongRunSoak
} from './long-run-depth';
import { runBalanceSimulation } from './balance-simulation';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

const LONG_SIMULATION_TIMEOUT_MS = 15_000;

describe('GLD long-run depth contracts', () => {
    it('publishes a coherent scheduled act and boss read model', () => {
        const rows = getLongRunActBossRows({ seed: 42_001, rulesVersion: GAME_RULES_VERSION, floors: 12 });

        expect(rows).toHaveLength(12);
        expect(rows.filter((row) => row.expectedBoss).map((row) => row.floor)).toEqual([7, 9]);
        /*
         * Floors 7 and 9 are still tagged `boss` by the schedule, and generation no longer deals a
         * boss onto either of them. The read model calls that `needs_attention`, and it is right:
         * the run promises the player a landmark and the board does not have one.
         *
         * This is the between-floor layer outliving the board layer by one commit, and it is
         * asserted rather than softened so that it stays visible until T1.9-T1.17 takes the boss
         * tag out of the schedule too. Every other floor is coherent, which is what says this is
         * one specific gap rather than the read model having stopped working.
         */
        const bossFloors = rows.filter((row) => row.expectedBoss);
        expect(bossFloors.every((row) => row.generatedBossId === null)).toBe(true);
        expect(bossFloors.every((row) => row.objectiveId === 'find_exit')).toBe(true);
        expect(bossFloors.every((row) => row.status === 'needs_attention')).toBe(true);
        expect(rows.filter((row) => !row.expectedBoss).every((row) => row.status === 'coherent')).toBe(true);
        expect(rows.every((row) => row.actTitle.length > 0 && row.actProgress.includes('/'))).toBe(true);
    });

    it('projects route previews into actual next-board inputs', () => {
        const schedule = pickFloorScheduleEntry(42_001, GAME_RULES_VERSION, 4, 'endless');
        const rows = getLongRunRoutePreviewRows(
            schedule,
            [
                { id: 'safe', routeType: 'safe', label: 'Safe', detail: 'Stable combat route.' },
                { id: 'greed', routeType: 'greed', label: 'Greed', detail: 'Elite pressure route.' },
                { id: 'mystery', routeType: 'mystery', label: 'Mystery', detail: 'Treasure gallery route.' }
            ],
            4
        );

        expect(rows.map((row) => row.actualNextBoardInput)).toEqual(
            expect.arrayContaining([
                expect.stringContaining('combat:normal'),
                expect.stringContaining('trap:normal'),
                expect.stringContaining('treasure:normal')
            ])
        );
        expect(rows.find((row) => row.routeType === 'greed')?.riskBand).toBe('danger');
        expect(rows.find((row) => row.routeType === 'mystery')?.likelyReward).toMatch(/Treasure|Odd|Gold|Balanced|Spend/i);
    });


    it('requires every relic to expose a changed decision and UI surface', () => {
        const rows = getLongRunRelicDecisionRows();

        expect(rows.length).toBeGreaterThan(10);
        expect(rows.every((row) => row.changedDecision.length > 0)).toBe(true);
        expect(rows.every((row) => row.uiSurface.length > 0 && row.regression.startsWith('relic-decision:'))).toBe(true);
    });

    it('adds fatigue guardrails for long-run balance samples', () => {
        const report = runBalanceSimulation({ seeds: [42_001, 42_077], floors: 48, rulesVersion: GAME_RULES_VERSION });
        const rows = getLongRunFatigueRows(report);

        expect(rows.map((row) => row.key)).toEqual([
            'breather_spacing',
            'relic_offer_spacing'
        ]);
        expect(rows.every((row) => row.status === 'within_range')).toBe(true);
    }, LONG_SIMULATION_TIMEOUT_MS);

    it('runs the deterministic multi-seed long-run soak gate', () => {
        const report = runLongRunSoak({ seeds: [42_001, 42_077, 42_123], floors: 48, rulesVersion: GAME_RULES_VERSION });

        /*
         * Gen 172 recorded three issues here, all faces of the greedy profile's flat route offer
         * (`BALANCE_NOTES.md`, Gen 172). Gen 173 removed the route between floors and all three
         * went with it - including the gold-per-floor overrun, which was the toll a never-taken
         * safe route never collected. Asserted empty so the next issue fails loudly.
         */
        expect(report.offlineOnly).toBe(true);
        expect(report.issues).toEqual([]);
        expect(report.ok).toBe(true);
        expect(report.rows.length).toBeGreaterThanOrEqual(8);
        expect(report.rows.map((row) => row.key)).toContain('max_profile_worst_seed_low_life_share');
    }, LONG_SIMULATION_TIMEOUT_MS);
});
