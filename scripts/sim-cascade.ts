/**
 * The cascade, measured: plays endless floors with a player who misses a stated share of turns
 * and reports what the chain buys. Run: yarn sim:cascade [--seeds=6] [--floors=24] [--check] [--relics]
 * See docs/CHAIN_CHUNK_FEVER_DESIGN.md §5 and docs/BALANCE_NOTES.md.
 */
import {
    assertCascadeBalanceWithinBands,
    CASCADE_BALANCE_BANDS,
    CASCADE_RELIC_BANDS,
    CASCADE_RELIC_LOADOUT,
    runCascadeBalanceSimulation,
    summarizeCascadeBalance
} from '../src/shared/cascade-balance-simulation';
import type { RelicId } from '../src/shared/contracts';

const argv = process.argv.slice(2);
const read = (name: string, fallback: number): number => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    const value = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
const seedCount = read('seeds', 6);
const floorCount = read('floors', 24);
const seeds = Array.from({ length: seedCount }, (_, index) => 42_001 + index * 7_919);
const floors = Array.from({ length: floorCount }, (_, index) => index + 1);
const relicArg = argv.find((arg) => arg === '--relics' || arg.startsWith('--relics='));
const relicIds: readonly RelicId[] =
    relicArg === undefined
        ? []
        : relicArg === '--relics'
          ? CASCADE_RELIC_LOADOUT
          : (relicArg.slice('--relics='.length).split(',').filter(Boolean) as RelicId[]);
const report = runCascadeBalanceSimulation({ seeds, floors, missRates: [0, 0.1, CASCADE_BALANCE_BANDS.referenceMissRate], relicIds });
if (relicIds.length > 0) {
    process.stdout.write(`relics: ${relicIds.join(', ')}\n`);
}
process.stdout.write(`${summarizeCascadeBalance(report)}\n`);
if (argv.includes('--check')) {
    const verdict = assertCascadeBalanceWithinBands(report, relicIds.length > 0 ? CASCADE_RELIC_BANDS : CASCADE_BALANCE_BANDS);
    if (!verdict.ok) {
        process.stderr.write(`Cascade balance check failed:\n${verdict.issues.map((issue) => `- ${issue}`).join('\n')}\n`);
        process.exit(1);
    }
    process.stdout.write('Cascade balance check passed\n');
}
