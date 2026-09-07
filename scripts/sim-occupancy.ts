/**
 * Which systems actually happen to a player? Run: yarn sim:occupancy [--floors=16] [--check]
 *
 * Plays generated floors with a reference player and reports, per system, the share of floors
 * where the run's own counter for it moved. A system that never moves is decoration.
 */
import { judgeSystemOccupancy, simulateSystemOccupancy, summarizeSystemOccupancy } from '../src/shared/system-occupancy-simulation';

const argv = process.argv.slice(2);
const floorsArg = argv.find((arg) => arg.startsWith('--floors='));
const floors = floorsArg ? Math.max(1, Number.parseInt(floorsArg.split('=')[1] ?? '16', 10)) : 16;
const report = simulateSystemOccupancy({ floors });
process.stdout.write(`${summarizeSystemOccupancy(report)}\n\nfloors played: ${report.floors}\n`);

const verdict = judgeSystemOccupancy(report);
if (verdict.silent.length > 0) {
    process.stdout.write(`\nSilent systems:\n${verdict.silent.map((line) => `- ${line}`).join('\n')}\n`);
}
if (verdict.issues.length > 0) {
    process.stdout.write(`\nThin systems:\n${verdict.issues.map((line) => `- ${line}`).join('\n')}\n`);
}
if (argv.includes('--check')) {
    if (!verdict.ok) {
        process.stderr.write('System occupancy check failed\n');
        process.exit(1);
    }
    process.stdout.write('System occupancy check passed\n');
}
