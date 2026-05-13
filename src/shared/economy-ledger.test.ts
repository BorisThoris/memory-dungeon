import { describe, expect, it } from 'vitest';
import { runBalanceSimulation } from './balance-simulation';
import { GAME_RULES_VERSION } from './contracts';
import { getBalanceSimulationEconomyLedgerRows, summarizeEconomyLedger } from './economy-ledger';

describe('GLD-P2 economy ledger', () => {
    it('maps balance simulation live inflow into local source rows', () => {
        const report = runBalanceSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });
        const rows = getBalanceSimulationEconomyLedgerRows(report);
        const summary = summarizeEconomyLedger(rows);

        expect(rows.every((row) => row.localOnly && row.kind === 'source')).toBe(true);
        expect(rows.map((row) => row.currency)).toEqual(
            expect.arrayContaining(['shop_gold', 'key', 'destroy_charge', 'peek_charge', 'treasure'])
        );
        expect(summary.localOnly).toBe(true);
        expect(summary.currencies.shop_gold.source).toBeGreaterThan(report.aggregate.totalShopGoldEarned);
        expect(summary.currencies.key.source).toBe(report.aggregate.keyInflowPotential);
        expect(summary.totalSinks).toBe(0);
    });
});
