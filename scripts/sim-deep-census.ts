/**
 * The deep census (DGE-027): the reference player to the Warden's floor, watching the mechanics the
 * Descent deals past floor 24. Run: yarn sim:deep-census [--check]. `--check` fails when a deep
 * counter never fires, which means its mechanic never met the player (`deep-census.ts`).
 */
import { judgeDeepCensus, simulateDeepCensus } from '../src/shared/deep-census';

const report = simulateDeepCensus();
console.log(`${report.runs} runs, ${report.floors} floors, deepest ${report.deepestFloor}`);
console.log('share  per floor  counter');
for (const row of report.rows) {
    console.log(`${row.runFloorShare.toFixed(3)}  ${row.perFloor.toFixed(2).padStart(9)}  ${row.key}: ${row.label}`);
}
const issues = judgeDeepCensus(report);
for (const issue of issues) console.log(`- ${issue}`);
if (process.argv.includes('--check')) {
    if (issues.length > 0) {
        console.error('Deep census check failed');
        process.exitCode = 1;
    } else {
        console.log('Deep census check passed');
    }
}
