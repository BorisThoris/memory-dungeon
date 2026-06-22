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

describe('GLD long-run depth contracts', () => {
    it('publishes a coherent scheduled act and boss read model', () => {
        const rows = getLongRunActBossRows({ seed: 42_001, rulesVersion: GAME_RULES_VERSION, floors: 12 });

        expect(rows).toHaveLength(12);
        expect(rows.filter((row) => row.expectedBoss).map((row) => row.floor)).toEqual([7, 9]);
        expect(rows.filter((row) => row.expectedBoss).every((row) => row.generatedBossId != null)).toBe(true);
        expect(rows.filter((row) => row.expectedBoss).every((row) => row.objectiveId === 'defeat_boss')).toBe(true);
        expect(rows.every((row) => row.status === 'coherent')).toBe(true);
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
            'avg_long_run_hazard_pressure',
            'avg_long_run_contact_pressure',
            'breather_spacing',
            'relic_offer_spacing',
            'avg_reward_inflation'
        ]);
        expect(rows.every((row) => row.status === 'within_range')).toBe(true);
    });

    it('runs the deterministic multi-seed long-run soak gate', () => {
        const report = runLongRunSoak({ seeds: [42_001, 42_077, 42_123], floors: 48, rulesVersion: GAME_RULES_VERSION });

        expect(report.offlineOnly).toBe(true);
        expect(report.ok).toBe(true);
        expect(report.issues).toEqual([]);
        expect(report.rows.length).toBeGreaterThanOrEqual(8);
        expect(report.rows.map((row) => row.key)).toContain('max_profile_worst_seed_unhealed_low_life_share');
        expect(report.rows.map((row) => row.key)).toContain('max_profile_unhealed_low_life_streak');
        expect(report.economySummary.totalSources).toBeGreaterThan(0);
    }, 15_000);
});
