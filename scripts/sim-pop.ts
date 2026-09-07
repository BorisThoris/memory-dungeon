/**
 * Does a match on a real generated floor pop anything? Run: yarn sim:pop [--levels=12] [--check]
 *
 * The cascade simulation measures what the loop pays over a run. This measures whether the loop
 * is reachable at all on the floors a player meets first, which is the thing that shipped broken.
 */
import { judgePopReach, simulatePopReach, summarizePopReach } from '../src/shared/pop-reach-simulation';

const argv = process.argv.slice(2);
const levelsArg = argv.find((arg) => arg.startsWith('--levels='));
const levels = levelsArg ? Math.max(1, Number.parseInt(levelsArg.split('=')[1] ?? '12', 10)) : 12;
const report = simulatePopReach(levels);
process.stdout.write(`${summarizePopReach(report)}\n`);

if (argv.includes('--check')) {
    const verdict = judgePopReach(report);
    if (!verdict.ok) {
        process.stderr.write(`Pop reach check failed:\n${verdict.issues.map((issue) => `- ${issue}`).join('\n')}\n`);
        process.exit(1);
    }
    process.stdout.write('Pop reach check passed\n');
}
