import type { BalanceSimulationReport } from './balance-simulation';

export type EconomyLedgerKind = 'source' | 'sink';
export type EconomyLedgerCurrency = 'shop_gold' | 'key' | 'destroy_charge' | 'peek_charge' | 'treasure' | 'reward';

export interface EconomyLedgerRow {
    id: string;
    kind: EconomyLedgerKind;
    currency: EconomyLedgerCurrency;
    amount: number;
    source: string;
    localOnly: true;
}

export interface EconomyLedgerSummary {
    totalSources: number;
    totalSinks: number;
    currencies: Record<EconomyLedgerCurrency, { source: number; sink: number; net: number }>;
    localOnly: true;
}

const emptyCurrencyTotals = (): EconomyLedgerSummary['currencies'] => ({
    shop_gold: { source: 0, sink: 0, net: 0 },
    key: { source: 0, sink: 0, net: 0 },
    destroy_charge: { source: 0, sink: 0, net: 0 },
    peek_charge: { source: 0, sink: 0, net: 0 },
    treasure: { source: 0, sink: 0, net: 0 },
    reward: { source: 0, sink: 0, net: 0 }
});

export const summarizeEconomyLedger = (rows: readonly EconomyLedgerRow[]): EconomyLedgerSummary => {
    const currencies = emptyCurrencyTotals();
    let totalSources = 0;
    let totalSinks = 0;
    for (const row of rows) {
        const totals = currencies[row.currency];
        if (row.kind === 'source') {
            totals.source += row.amount;
            totalSources += row.amount;
        } else {
            totals.sink += row.amount;
            totalSinks += row.amount;
        }
        totals.net = totals.source - totals.sink;
    }
    return { totalSources, totalSinks, currencies, localOnly: true };
};

export const getBalanceSimulationEconomyLedgerRows = (
    report: Pick<BalanceSimulationReport, 'aggregate'>
): EconomyLedgerRow[] => [
    {
        id: 'sim_floor_clear_shop_gold',
        kind: 'source',
        currency: 'shop_gold',
        amount: report.aggregate.totalShopGoldEarned,
        source: 'floor clear reward',
        localOnly: true
    },
    {
        id: 'sim_live_shop_gold_potential',
        kind: 'source',
        currency: 'shop_gold',
        amount: report.aggregate.shopGoldInflowPotential,
        source: 'route, event, room, treasure, and clear estimates',
        localOnly: true
    },
    {
        id: 'sim_key_inflow_potential',
        kind: 'source',
        currency: 'key',
        amount: report.aggregate.keyInflowPotential,
        source: 'key cards and locked exits',
        localOnly: true
    },
    {
        id: 'sim_destroy_charge_inflow_potential',
        kind: 'source',
        currency: 'destroy_charge',
        amount: report.aggregate.destroyChargeInflowPotential,
        source: 'room, event, and reward estimates',
        localOnly: true
    },
    {
        id: 'sim_peek_charge_inflow_potential',
        kind: 'source',
        currency: 'peek_charge',
        amount: report.aggregate.peekChargeInflowPotential,
        source: 'shop and room estimates',
        localOnly: true
    },
    {
        id: 'sim_treasure_reward_potential',
        kind: 'source',
        currency: 'treasure',
        amount: report.aggregate.treasureRewardPairs + report.aggregate.routeRewardPairs,
        source: 'treasure and route reward carriers',
        localOnly: true
    }
];
