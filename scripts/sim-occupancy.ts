/**
 * Which systems actually happen to a player? Run: yarn sim:occupancy [--floors=16] [--check]
 *
 * Plays generated floors with a reference player and reports, per system, the share of floors
 * where the run's own counter for it moved. A system that never moves is decoration.
 */
import {
    judgeSystemOccupancy,
    judgeSystemOccupancyAgainstBaseline,
    simulateSystemOccupancy,
    summarizeSystemOccupancy,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS
} from '../src/shared/system-occupancy-simulation';

const argv = process.argv.slice(2);
const floorsArg = argv.find((arg) => arg.startsWith('--floors='));
/*
 * `--ratchet` measures at the baseline's own floor count, because a different count measures a
 * different game: three hazard caches that sit at 4-7% over 160 floors read as under 2% over 120.
 */
const ratchet = argv.includes('--ratchet');
const defaultFloors = ratchet ? SYSTEM_OCCUPANCY_BASELINE_FLOORS : 16;
const floors = floorsArg
    ? Math.max(1, Number.parseInt(floorsArg.split('=')[1] ?? String(defaultFloors), 10))
    : defaultFloors;
const report = simulateSystemOccupancy({ floors });
process.stdout.write(`${summarizeSystemOccupancy(report)}\n\nfloors played: ${report.floors}\n`);

const verdict = judgeSystemOccupancy(report);
if (verdict.silent.length > 0) {
    process.stdout.write(`\nSilent systems:\n${verdict.silent.map((line) => `- ${line}`).join('\n')}\n`);
}
if (verdict.issues.length > 0) {
    process.stdout.write(`\nThin systems:\n${verdict.issues.map((line) => `- ${line}`).join('\n')}\n`);
}
if (ratchet) {
    const against = judgeSystemOccupancyAgainstBaseline(report);
    if (!against.ok) {
        process.stderr.write(
            `\nThe census moved away from its recorded baseline:\n${against.issues.map((line) => `- ${line}`).join('\n')}\n\n` +
                'A system that went quiet is a regression; one that came back to life is progress that has to be ' +
                'recorded. Either way, update SYSTEM_OCCUPANCY_BASELINE deliberately.\n'
        );
        process.exit(1);
    }
    process.stdout.write('\nSystem occupancy matches its recorded baseline\n');
}
if (argv.includes('--check')) {
    if (!verdict.ok) {
        process.stderr.write('System occupancy check failed\n');
        process.exit(1);
    }
    process.stdout.write('System occupancy check passed\n');
}
