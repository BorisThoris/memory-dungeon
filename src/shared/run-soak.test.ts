import { describe, expect, it } from 'vitest';

import { createNewRun } from './game';
import { SOAK_INVARIANTS, SOAK_PLAYERS, soakRun } from './run-soak';

const SOAK_SEEDS = Number(process.env.RUN_SOAK_SEEDS ?? 12);

/*
 * Whole runs, every action checked (`run-soak.ts`). The seed count is small for the unit suite;
 * `RUN_SOAK_SEEDS=500 yarn vitest run src/shared/run-soak.test.ts` is the long soak.
 */
describe('the run soak', () => {
    for (const [name, player] of Object.entries(SOAK_PLAYERS)) {
        it(`keeps every invariant through whole runs played ${name}`, () => {
            const reports = Array.from({ length: SOAK_SEEDS }, (_unused, index) =>
                soakRun({ seed: 7_001 + index * 104_729, player, playerName: name })
            );
            const violations = reports.flatMap((report) => report.violations);
            expect(violations, JSON.stringify(violations.slice(0, 3), null, 2)).toEqual([]);
            // And it actually played: floors cleared, stops shopped, bombs thrown.
            expect(reports.reduce((sum, report) => sum + report.floorsCleared, 0)).toBeGreaterThan(SOAK_SEEDS);
        });
    }

    it('exercises the systems it exists to watch', () => {
        const reports = Array.from({ length: SOAK_SEEDS }, (_unused, index) =>
            soakRun({ seed: 9_001 + index * 7_919, player: SOAK_PLAYERS.careful, playerName: 'careful' })
        );
        expect(reports.some((report) => report.purchases > 0), 'no run ever shopped at a stop').toBe(true);
        expect(reports.some((report) => report.bombsUsed > 0), 'no run ever threw a bomb').toBe(true);
        /* The five run-economy mechanics have no row in the floor census (the reference player never
           shops), so this is where `scripts/mechanic-accountability.ts` points for proof they happen. */
        expect(reports.some((report) => report.goldEarned > 0), 'no run ever earned gold').toBe(true);
        expect(reports.some((report) => report.missesGranted > 0), 'no run ever had a miss granted').toBe(true);
        expect(reports.some((report) => report.relicsBought > 0), 'no run ever bought a relic').toBe(true);
        // The joker left its partner stranded and the floor unclearable until a soak player used it.
        const wild = Array.from({ length: 4 }, (_unused, index) =>
            soakRun({ seed: 7_001 + index * 7_919, player: SOAK_PLAYERS.wild, playerName: 'wild', maxFloors: 3 })
        );
        expect(wild.some((report) => report.wildMatches > 0), 'no wild run ever played its joker').toBe(true);
        expect(wild.flatMap((report) => report.violations)).toEqual([]);
        expect(Object.keys(SOAK_INVARIANTS).length).toBeGreaterThanOrEqual(15);
    });

    it('catches a broken invariant rather than passing it', () => {
        // The harness is only worth anything if it can fail: feed it a run the rules say cannot exist.
        const check = SOAK_INVARIANTS['charges, gold and counters are whole numbers, never negative']!;
        const run = soakRun({ seed: 1, player: SOAK_PLAYERS.average, playerName: 'average', maxFloors: 1 });
        expect(run.violations).toEqual([]);
        const base = createNewRun(0, { runSeed: 1, gameMode: 'endless' });
        expect(check(null, base, 'study')).toBeNull();
        expect(check(null, { ...base, gold: -1 }, 'buy:peek')).not.toBeNull();
        expect(check(null, { ...base, bombCharges: 1.5 }, 'bomb')).not.toBeNull();
    });
});
