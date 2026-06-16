import type { RunState } from './contracts';

export type RunEconomyBucket = 'score' | 'temporary_run' | 'durable_meta';
export type RunEconomyPersistence = 'temporary_run' | 'run_summary' | 'player_stats';

export interface RunEconomyDefinition {
    id: string;
    label: string;
    bucket: RunEconomyBucket;
    purpose: string;
    source: string;
    sink: string;
    persistence: RunEconomyPersistence;
    maxValue?: number;
}

export interface RunEconomyRow extends RunEconomyDefinition {
    key: string;
    value: string;
    numericValue: number;
}

export const RUN_ECONOMY_DEFINITIONS = [
    {
        id: 'shop_gold',
        label: 'Shop gold',
        bucket: 'temporary_run',
        purpose: 'Temporary run currency for vendor purchases.',
        source: 'floor clears',
        sink: 'buy local vendor services; resets at run end',
        persistence: 'temporary_run'
    },
    {
        id: 'score',
        label: 'Score',
        bucket: 'score',
        purpose: 'Score is performance value only; it is never spendable.',
        source: 'matches, floor clears, findables, objective bonuses',
        sink: 'local best-score comparison and run summary; never spendable',
        persistence: 'run_summary'
    },
    {
        id: 'combo_shards',
        label: 'Combo shards',
        bucket: 'temporary_run',
        purpose: 'Temporary run currency for sustain.',
        source: 'match streaks and shard-spark pickups',
        sink: 'three shards convert into one life during the run',
        persistence: 'temporary_run',
        maxValue: 2
    },
    {
        id: 'guard_tokens',
        label: 'Guard tokens',
        bucket: 'temporary_run',
        purpose: 'Temporary run protection token.',
        source: 'four-step streak rewards and relics',
        sink: 'absorbs mismatch life loss before health is spent',
        persistence: 'temporary_run',
        maxValue: 2
    },
    {
        id: 'relic_favor',
        label: 'Relic favor',
        bucket: 'temporary_run',
        purpose: 'Temporary run currency for relic-pick momentum.',
        source: 'endless featured objectives and risk wagers',
        sink: 'every three favor banks an extra relic pick for the next shrine',
        persistence: 'temporary_run',
        maxValue: 3
    },
    {
        id: 'dungeon_keys',
        label: 'Dungeon keys',
        bucket: 'temporary_run',
        purpose: 'Temporary run unlock resource for dungeon exits, locks, and cache rooms.',
        source: 'key cards, key cache rooms, shops, events, and rest shrine boss prep',
        sink: 'spent on locked exits, locked caches, and cache rooms',
        persistence: 'temporary_run'
    },
    {
        id: 'findable_pickups',
        label: 'Findable pickups',
        bucket: 'temporary_run',
        purpose: 'Temporary floor pickup progress.',
        source: 'pickup-marked pairs on eligible floors',
        sink: 'claimed by matching the carrier pair; forfeited by destroying the carrier',
        persistence: 'temporary_run'
    },
    {
        id: 'assist_charges',
        label: 'Assist charges',
        bucket: 'temporary_run',
        purpose: 'Temporary run action budget.',
        source: 'run start, shops, relics, events, rooms, and pickup rewards',
        sink: 'shuffle, row shuffle, tile swap, destroy, peek, and stray-remove actions',
        persistence: 'temporary_run'
    }
] as const satisfies readonly RunEconomyDefinition[];

export const RUN_ECONOMY_RESOURCE_PURPOSES = RUN_ECONOMY_DEFINITIONS.reduce<Record<string, string>>((acc, entry) => {
    acc[entry.id] = entry.sink;
    return acc;
}, {});

export const runEconomyDefinitionById = RUN_ECONOMY_DEFINITIONS.reduce<Record<string, RunEconomyDefinition>>(
    (acc, entry) => {
        acc[entry.id] = entry;
        return acc;
    },
    {}
);

const valueFor = (run: RunState, id: string): string => {
    switch (id) {
        case 'shop_gold':
            return String(run.shopGold);
        case 'score':
            return String(run.stats.totalScore);
        case 'combo_shards':
            return `${run.stats.comboShards}/2`;
        case 'guard_tokens':
            return `${run.stats.guardTokens}/2`;
        case 'relic_favor':
            return `${run.relicFavorProgress}/3`;
        case 'dungeon_keys': {
            const keyCount = Object.values(run.dungeonKeys).reduce((sum, count) => sum + (count ?? 0), 0);
            return `${keyCount} keys · ${run.dungeonMasterKeys} master`;
        }
        case 'findable_pickups':
            return `${run.findablesClaimedThisFloor}/${run.findablesTotalThisFloor}`;
        case 'assist_charges':
            return `Shuffle ${run.shuffleCharges} · Row ${run.regionShuffleCharges} · Destroy ${run.destroyPairCharges} · Peek ${run.peekCharges} · Stray ${run.strayRemoveCharges}`;
        default:
            return '0';
    }
};

const numericValueFor = (run: RunState, id: string): number => {
    switch (id) {
        case 'shop_gold':
            return run.shopGold;
        case 'score':
            return run.stats.totalScore;
        case 'combo_shards':
            return run.stats.comboShards;
        case 'guard_tokens':
            return run.stats.guardTokens;
        case 'relic_favor':
            return run.relicFavorProgress;
        case 'dungeon_keys':
            return Object.values(run.dungeonKeys).reduce((sum, count) => sum + (count ?? 0), 0) + run.dungeonMasterKeys;
        case 'findable_pickups':
            return run.findablesClaimedThisFloor;
        case 'assist_charges':
            return run.shuffleCharges + run.regionShuffleCharges + run.destroyPairCharges + run.peekCharges + run.strayRemoveCharges;
        default:
            return 0;
    }
};

export const getRunEconomyRows = (run: RunState): RunEconomyRow[] =>
    RUN_ECONOMY_DEFINITIONS.map((definition) => ({
        ...definition,
        key: definition.id,
        value: valueFor(run, definition.id),
        numericValue: numericValueFor(run, definition.id)
    }));

export const getRunEconomySnapshot = (run: RunState): {
    score: RunEconomyRow;
    temporaryRunCurrencies: RunEconomyRow[];
    durableMeta: RunEconomyRow[];
} => {
    const rows = getRunEconomyRows(run);
    return {
        score: rows.find((row) => row.id === 'score')!,
        temporaryRunCurrencies: rows.filter((row) => row.bucket === 'temporary_run'),
        durableMeta: rows.filter((row) => row.bucket === 'durable_meta')
    };
};

export const getRunEconomyEntry = (run: RunState, id: string): RunEconomyRow | undefined =>
    getRunEconomyRows(run).find((entry) => entry.id === id);
