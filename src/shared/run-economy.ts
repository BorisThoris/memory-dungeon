import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

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

const SCORE_RUN_ECONOMY_DEFINITION = {
    id: 'score',
    label: 'Score',
    bucket: 'score',
    purpose: 'Score is performance value only; it is never spendable.',
    source: 'matches, floor clears, findables, objective bonuses',
    sink: 'local best-score comparison and run summary; never spendable',
    persistence: 'run_summary'
} as const satisfies RunEconomyDefinition;

export const RUN_ECONOMY_DEFINITIONS = [
    SCORE_RUN_ECONOMY_DEFINITION,
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
        source: 'run start and pickup rewards',
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
    const stats = normalizeSessionStats(run.stats);
    switch (id) {
        case 'score':
            return String(stats.totalScore);
        case 'findable_pickups':
            return `${runNonNegativeInteger(run.findablesClaimedThisFloor)}/${runNonNegativeInteger(run.findablesTotalThisFloor)}`;
        case 'assist_charges':
            return `Shuffle ${runNonNegativeInteger(run.shuffleCharges)} · Row ${runNonNegativeInteger(run.regionShuffleCharges)} · Destroy ${runNonNegativeInteger(run.destroyPairCharges)} · Peek ${runNonNegativeInteger(run.peekCharges)} · Stray ${runNonNegativeInteger(run.strayRemoveCharges)}`;
        default:
            return '0';
    }
};

const numericValueFor = (run: RunState, id: string): number => {
    const stats = normalizeSessionStats(run.stats);
    switch (id) {
        case 'score':
            return stats.totalScore;
        case 'findable_pickups':
            return runNonNegativeInteger(run.findablesClaimedThisFloor);
        case 'assist_charges':
            return (
                runNonNegativeInteger(run.shuffleCharges) +
                runNonNegativeInteger(run.regionShuffleCharges) +
                runNonNegativeInteger(run.destroyPairCharges) +
                runNonNegativeInteger(run.peekCharges) +
                runNonNegativeInteger(run.strayRemoveCharges)
            );
        default:
            return 0;
    }
};

const buildRunEconomyRow = (run: RunState, definition: RunEconomyDefinition): RunEconomyRow => ({
    ...definition,
    key: definition.id,
    value: valueFor(run, definition.id),
    numericValue: numericValueFor(run, definition.id)
});

export const getRunEconomyRows = (run: RunState): RunEconomyRow[] =>
    RUN_ECONOMY_DEFINITIONS.map((definition) => buildRunEconomyRow(run, definition));

export const getRunEconomySnapshot = (run: RunState): {
    score: RunEconomyRow;
    temporaryRunCurrencies: RunEconomyRow[];
    durableMeta: RunEconomyRow[];
} => {
    const rows = getRunEconomyRows(run);
    return {
        score: rows.find((row) => row.id === 'score') ?? buildRunEconomyRow(run, SCORE_RUN_ECONOMY_DEFINITION),
        temporaryRunCurrencies: rows.filter((row) => row.bucket === 'temporary_run'),
        durableMeta: rows.filter((row) => row.bucket === 'durable_meta')
    };
};

export const getRunEconomyEntry = (run: RunState, id: string): RunEconomyRow | undefined =>
    getRunEconomyRows(run).find((entry) => entry.id === id);
