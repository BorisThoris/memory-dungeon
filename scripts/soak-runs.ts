/**
 * The long run soak. Run: yarn soak [--seeds=200] [--floors=40] [--check]
 *
 * Whole runs played by the three soak players (`src/shared/run-soak.ts`), every action checked
 * against the run's invariants. The unit suite plays twelve seeds a player; this is the one to run
 * before a release or after touching anything between floors - the miss bank, gold, the store
 * stop, bombs, relics. A violation prints its seed, floor, step, action and invariant, which is
 * enough to replay it exactly.
 */
import { SOAK_PLAYERS, soakRun } from '../src/shared/run-soak';

const argv = process.argv.slice(2);
const numberArg = (name: string, fallback: number): number => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    const value = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
const seeds = numberArg('seeds', 200);
const floors = numberArg('floors', 40);

let violations = 0;
for (const [name, player] of Object.entries(SOAK_PLAYERS)) {
    const reports = Array.from({ length: seeds }, (_unused, index) =>
        soakRun({ seed: 31_337 + index * 7_919, player, playerName: name, maxFloors: floors })
    );
    const found = reports.flatMap((report) => report.violations);
    violations += found.length;
    const ended: Record<string, number> = {};
    for (const report of reports) ended[report.ended] = (ended[report.ended] ?? 0) + 1;
    const total = (read: (report: (typeof reports)[number]) => number): number =>
        reports.reduce((sum, report) => sum + read(report), 0);
    process.stdout.write(
        `${name}: ${seeds} runs, ${total((r) => r.floorsCleared)} floors, ${total((r) => r.turns)} turns, ` +
            `${total((r) => r.purchases)} purchases, ${total((r) => r.bombsUsed)} bombs, ${total((r) => r.goldEarned)} gold earned, ${total((r) => r.missesGranted)} misses granted, ${total((r) => r.relicsBought)} relics, ended ${JSON.stringify(ended)}, ` +
            `${found.length} violations\n`
    );
    for (const violation of found.slice(0, 10)) {
        process.stdout.write(`  ${JSON.stringify(violation)}\n`);
    }
}

if (argv.includes('--check')) {
    if (violations > 0) {
        process.stderr.write(`Run soak failed: ${violations} violations\n`);
        process.exit(1);
    }
    process.stdout.write('Run soak passed\n');
}
