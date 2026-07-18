import { fileURLToPath } from 'node:url';

import {
    analyzeEndlessSimulationHealth,
    type EndlessSimulationHealthReport
} from './sim-endless';
import { GAME_RULES_VERSION } from '../src/shared/contracts';
import { readNumericCliArg, resolveSeedSweep } from './seed-sweep-options';

const formatFailure = (seed: number, report: EndlessSimulationHealthReport): string =>
    [
        `seed=${seed}`,
        ...report.issues.map((issue) => `  - ${issue}`)
    ].join('\n');

export const runSoftlockSeedGate = (argv: readonly string[]): number => {
    const floors = Math.max(1, Math.floor(readNumericCliArg(argv, 'floors', 1000)));
    const rulesVersion = Math.max(1, Math.floor(readNumericCliArg(argv, 'rulesVersion', GAME_RULES_VERSION)));
    const defaultSeeds = [
        42_001,
        42_002,
        42_077,
        77_707,
        130_011,
        172_707,
        182_009,
        192_012,
        210_008,
        240_017,
        310_021,
        420_113,
        530_017,
        610_019,
        720_031,
        880_037
    ];
    const seeds = resolveSeedSweep(argv, defaultSeeds);
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
                `playableIssues=${metric.playableIssueReasons.join('+') || 'none'}`,
                `fairnessIssues=${metric.fairnessIssueFloors}`,
                `topologyIssues=${metric.topologyIssueFloors}`,
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
