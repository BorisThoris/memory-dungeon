import { fileURLToPath } from 'node:url';
import { runLongRunSoak, type LongRunSoakReport } from '../src/shared/long-run-depth';
import { readFlooredNumericCliArg, readSeedListCliArg } from './seed-sweep-options';

const DEFAULT_LONG_RUN_SEEDS = [42_001, 42_077, 42_123] as const;

export interface LongRunGateOptions {
    floors: number;
    seeds: number[];
}

export const parseLongRunGateOptions = (argv: readonly string[]): LongRunGateOptions => ({
    floors: Math.max(1, readFlooredNumericCliArg(argv, 'floors', 48)),
    seeds: readSeedListCliArg(argv, DEFAULT_LONG_RUN_SEEDS)
});

export const formatLongRunGateReport = (report: Pick<LongRunSoakReport, 'rows'>): string => {
    const lines = [
        'key,value,targetMin,targetMax,status,source',
        ...report.rows.map((row) =>
            [row.key, row.value, row.targetMin, row.targetMax, row.status, row.source].join(',')
        )
    ];
    return `${lines.join('\n')}\n`;
};

/**
 * Issues this gate reports and does not fail on, and why each is here.
 *
 * All three are one finding, recorded in `BALANCE_NOTES.md` under Gen 172 and asserted exactly in
 * `balance-simulation.test.ts` and `long-run-depth.test.ts`: with the dungeon layer gone, the route
 * offer is the same three doors on every floor, so a greedy profile takes the greedy route on all
 * 144 of them, never takes a safe route, never pays a safe route's toll, and ends holding gold
 * nothing can take out again.
 *
 * They are listed rather than tolerated. A fourth issue, or any of these three changing its exact
 * text, fails the gate - so this cannot quietly grow into "the long-run gate does not check
 * anything". The debt is settled by Phase 1 T1.9-T1.17 removing the between-floor layer, at which
 * point this list goes back to empty.
 */
const KNOWN_LONG_RUN_DEBT: readonly string[] = [
    'max_profile_ending_gold_per_floor:5.56 outside 0-5',
    'greedy@seed:42001/floor:48:dominantRouteShare=1',
    'greedy@seed:42001/floor:48:endingShopGold=801/144'
];

export const runLongRunGate = (argv: readonly string[]): number => {
    const report = runLongRunSoak(parseLongRunGateOptions(argv));
    process.stdout.write(formatLongRunGateReport(report));

    const unexpected = report.issues.filter((issue) => !KNOWN_LONG_RUN_DEBT.includes(issue));
    const missing = KNOWN_LONG_RUN_DEBT.filter((issue) => !report.issues.includes(issue));
    if (unexpected.length > 0) {
        process.stderr.write(`${unexpected.join('\n')}\n`);
        return 1;
    }
    if (missing.length > 0) {
        // A recorded debt that stopped happening is good news the list has to be told about, or the
        // list rots into an exemption nobody re-reads.
        process.stderr.write(
            `recorded long-run debt no longer reproduces; remove it from KNOWN_LONG_RUN_DEBT:\n${missing.join('\n')}\n`
        );
        return 1;
    }
    if (report.issues.length > 0) {
        process.stderr.write(`recorded debt (not failing, see KNOWN_LONG_RUN_DEBT):\n${report.issues.join('\n')}\n`);
    }
    return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exitCode = runLongRunGate(process.argv.slice(2));
}
