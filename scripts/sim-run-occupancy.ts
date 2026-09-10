/**
 * What does a player meet in a RUN? Run: yarn sim:run [--floors=24] [--check]
 *
 * The floor census (`sim:occupancy`) builds a fresh run for every floor, which is the right
 * instrument for a board and the wrong one for a run. This plays one continuous run per seed
 * through the game's own floor transition and reports where each system was last seen.
 */
import {
    judgeRunOccupancy,
    simulateRunOccupancy,
    summarizeRunOccupancy,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS
} from '../src/shared/system-occupancy-simulation';

const argv = process.argv.slice(2);
const floorsArg = argv.find((arg) => arg.startsWith('--floors='));
const floors = floorsArg
    ? Math.max(1, Number.parseInt(floorsArg.split('=')[1] ?? String(SYSTEM_OCCUPANCY_BASELINE_FLOORS), 10))
    : SYSTEM_OCCUPANCY_BASELINE_FLOORS;

const report = simulateRunOccupancy({ floors });
process.stdout.write(`${summarizeRunOccupancy(report)}\n\n`);
process.stdout.write(
    `${report.runs} runs, ${report.floors} floors played, deepest floor ${report.deepestFloor}, ` +
        `${report.meanFloorsPerRun.toFixed(1)} floors a run\n`
);
process.stdout.write(
    `runs ended: ${Object.entries(report.endReasons).map(([reason, count]) => `${reason} x${count}`).join(', ')}\n`
);

const verdict = judgeRunOccupancy(report);
if (verdict.onceOnly.length > 0) {
    process.stdout.write(
        `\nSeen once and never again:\n${verdict.onceOnly.map((line) => `- ${line}`).join('\n')}\n`
    );
}
if (verdict.silent.length > 0) {
    process.stdout.write(`\nSilent across whole runs:\n${verdict.silent.map((line) => `- ${line}`).join('\n')}\n`);
}
if (verdict.issues.length > 0) {
    process.stdout.write(`\nThin in a run:\n${verdict.issues.map((line) => `- ${line}`).join('\n')}\n`);
}
if (verdict.dominant.length > 0) {
    process.stdout.write(`\nDominant in a run:\n${verdict.dominant.map((line) => `- ${line}`).join('\n')}\n`);
}
if (process.argv.includes('--check')) {
    if (!verdict.ok) {
        process.stderr.write('Run occupancy check failed\n');
        process.exit(1);
    }
    process.stdout.write('\nRun occupancy check passed\n');
}
