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

export const runLongRunGate = (argv: readonly string[]): number => {
    const report = runLongRunSoak(parseLongRunGateOptions(argv));
    process.stdout.write(formatLongRunGateReport(report));

    if (!report.ok) {
        process.stderr.write(`${report.issues.join('\n')}\n`);
        return 1;
    }
    return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exitCode = runLongRunGate(process.argv.slice(2));
}
