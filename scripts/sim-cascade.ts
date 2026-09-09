/**
 * The cascade, measured: plays endless floors with a player who misses a stated share of turns
 * and reports what the chain buys. Run: yarn sim:cascade [--seeds=48] [--floors=24] [--check]
 * See docs/CHAIN_CHUNK_FEVER_DESIGN.md §5 and docs/BALANCE_NOTES.md.
 */
import {
    assertCascadeBalanceWithinBands,
    CASCADE_BALANCE_BANDS,
    runCascadeBalanceSimulation,
    summarizeCascadeBalance
} from '../src/shared/cascade-balance-simulation';

const argv = process.argv.slice(2);
const read = (name: string, fallback: number): number => {
    const raw = argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
    const value = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
/*
 * Forty-eight seeds, not six. The clean-over-reference Fever ratio is a ratio of two shares of a
 * few dozen floors each, and at six seeds a rules-version bump alone - the same code, different
 * boards - moved it from 2.00 to 1.67 against a band of 2. The reference player's share is the
 * noisy half: 0.24 at six seeds, 0.24 at twelve, 0.22 at twenty-four, 0.20 from forty-eight up to
 * ninety-six, where it stops moving. Forty-eight is where the number has settled, and the run
 * takes six seconds.
 */
const seedCount = read('seeds', 48);
const floorCount = read('floors', 24);
const seeds = Array.from({ length: seedCount }, (_, index) => 42_001 + index * 7_919);
const floors = Array.from({ length: floorCount }, (_, index) => index + 1);
const report = runCascadeBalanceSimulation({ seeds, floors, missRates: [0, 0.1, CASCADE_BALANCE_BANDS.referenceMissRate] });
process.stdout.write(`${summarizeCascadeBalance(report)}\n`);
if (argv.includes('--check')) {
    const verdict = assertCascadeBalanceWithinBands(report, CASCADE_BALANCE_BANDS);
    if (!verdict.ok) {
        process.stderr.write(`Cascade balance check failed:\n${verdict.issues.map((issue) => `- ${issue}`).join('\n')}\n`);
        process.exit(1);
    }
    process.stdout.write('Cascade balance check passed\n');
}
