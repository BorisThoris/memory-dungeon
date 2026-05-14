import { runLongRunSoak } from '../src/shared/long-run-depth';

const argv = process.argv.slice(2);
const numArg = (name: string, fallback: number): number => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    return raw == null ? fallback : Number(raw);
};

const floors = Math.max(1, Math.floor(numArg('floors', 48)));
const seedsArg = argv.find((arg) => arg.startsWith('--seeds='))?.split('=')[1];
const seeds = seedsArg
    ? seedsArg
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isFinite(value))
    : [42_001, 42_077, 42_123];

const report = runLongRunSoak({ seeds, floors });

const lines = [
    'key,value,targetMin,targetMax,status,source',
    ...report.rows.map((row) =>
        [row.key, row.value, row.targetMin, row.targetMax, row.status, row.source].join(',')
    )
];

process.stdout.write(`${lines.join('\n')}\n`);

if (!report.ok) {
    process.stderr.write(`${report.issues.join('\n')}\n`);
    process.exitCode = 1;
}
