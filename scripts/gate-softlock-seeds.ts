import { fileURLToPath } from 'node:url';

import {
    analyzeEndlessSimulationHealth,
    type EndlessSimulationHealthReport
} from './sim-endless';
import { GAME_RULES_VERSION } from '../src/shared/contracts';

const numArg = (argv: readonly string[], name: string, def: number): number => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    return raw != null ? Number(raw) : def;
};

const seedsArg = (argv: readonly string[], def: readonly number[]): number[] => {
    const raw = argv.find((arg) => arg.startsWith('--seeds='))?.split('=')[1];
    if (!raw) {
        return [...def];
    }
    const parsed = raw
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((seed) => Number.isSafeInteger(seed) && seed > 0);
    return parsed.length > 0 ? parsed : [...def];
};

const formatFailure = (seed: number, report: EndlessSimulationHealthReport): string =>
    [
        `seed=${seed}`,
        ...report.issues.map((issue) => `  - ${issue}`)
    ].join('\n');

export const runSoftlockSeedGate = (argv: readonly string[]): number => {
    const floors = Math.max(1, Math.floor(numArg(argv, 'floors', 1000)));
    const rulesVersion = Math.max(1, Math.floor(numArg(argv, 'rulesVersion', GAME_RULES_VERSION)));
    const seeds = seedsArg(argv, [42_001, 42_002, 42_077, 77_707, 130_011, 172_707, 182_009, 192_012]);
    const failures: string[] = [];

    process.stdout.write(`# Softlock seed gate\n\n`);
    process.stdout.write(`- Floors per seed: ${floors}\n`);
    process.stdout.write(`- Rules version: ${rulesVersion}\n`);
    process.stdout.write(`- Seeds: ${seeds.join(', ')}\n\n`);

    for (const seed of seeds) {
        const report = analyzeEndlessSimulationHealth({ floors, runSeed: seed, rulesVersion });
        const metric = report.metrics;
        process.stdout.write(
            [
                `seed=${seed}`,
                `playable=${metric.playableCheckedFloors - metric.playableIssueFloors}/${metric.playableCheckedFloors}`,
                `lockedExits=${metric.playableLockedExitFloors}`,
                `fairnessIssues=${metric.fairnessIssueFloors}`,
                `traitDead=${metric.deadTraitFloors}`,
                report.ok ? 'ok' : 'failed'
            ].join(',') + '\n'
        );
        if (!report.ok) {
            failures.push(formatFailure(seed, report));
        }
    }

    if (failures.length > 0) {
        process.stderr.write(`\nSoftlock seed gate failed:\n${failures.join('\n')}\n`);
        return 1;
    }

    process.stdout.write('\nSoftlock seed gate passed\n');
    return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    process.exitCode = runSoftlockSeedGate(process.argv.slice(2));
}
