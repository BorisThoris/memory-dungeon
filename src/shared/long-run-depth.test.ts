import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import {
    getLongRunActBossRows,
    getLongRunFatigueRows,
    getLongRunRelicDecisionRows,
    getLongRunRoutePreviewRows,
    getLongRunShopStockPools,
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

    it('splits long-run shop stock pools by source and route pressure', () => {
        const pools = getLongRunShopStockPools();

        expect(pools.map((pool) => pool.source)).toEqual([
            'floor_clear_shop',
            'board_shop',
            'route_shop',
            'rest_hook',
            'event_hook',
            'treasure_hook'
        ]);
        expect(pools.find((pool) => pool.source === 'route_shop')?.itemIds).toContain('master_key');
        expect(new Set(pools.map((pool) => pool.itemIds.join(','))).size).toBeGreaterThan(2);
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
            'relic_offer_spacing',
            'avg_reward_inflation'
        ]);
        expect(rows.every((row) => row.status === 'within_range')).toBe(true);
    }, LONG_SIMULATION_TIMEOUT_MS);

    it('runs the deterministic multi-seed long-run soak gate', () => {
        const report = runLongRunSoak({ seeds: [42_001, 42_077, 42_123], floors: 48, rulesVersion: GAME_RULES_VERSION });

        /*
         * Three issues, asserted exactly so a fourth fails. All three are the flat route offer
         * described in `balance-simulation.test.ts` and `BALANCE_NOTES.md`, and all three are
         * answered by Phase 1 T1.9-T1.17 removing the between-floor layer, not by moving a bound.
         */
        expect(report.offlineOnly).toBe(true);
        expect(report.issues).toEqual([
            'max_profile_ending_gold_per_floor:5.56 outside 0-5',
            'greedy@seed:42001/floor:48:dominantRouteShare=1',
            'greedy@seed:42001/floor:48:endingShopGold=801/144'
        ]);
        expect(report.ok).toBe(false);
        expect(report.rows.length).toBeGreaterThanOrEqual(8);
        expect(report.rows.map((row) => row.key)).toContain('max_profile_worst_seed_unhealed_low_life_share');
        expect(report.rows.map((row) => row.key)).toContain('max_profile_unhealed_low_life_streak');
        expect(report.economySummary.totalSources).toBeGreaterThan(0);
    }, LONG_SIMULATION_TIMEOUT_MS);
});
