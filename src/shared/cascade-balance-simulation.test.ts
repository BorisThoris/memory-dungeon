import { describe, expect, it } from 'vitest';
import {
    assertCascadeBalanceWithinBands,
    CASCADE_BALANCE_BANDS,
    runCascadeBalanceSimulation,
    summarizeCascadeBalance
} from './cascade-balance-simulation';

const SEEDS = [42_001, 8_675_309, 1_234];
/*
 * Every floor of the first act and a half, not a stride through them: floor archetypes cycle, and
 * a stride of three lands on the same few (a rush boss with nothing to break, three times) and
 * calls that the game. The whole run takes a couple of seconds.
 */
const FLOORS = Array.from({ length: 18 }, (_, index) => index + 1);
const MISS_RATES = [0, 0.1, CASCADE_BALANCE_BANDS.referenceMissRate];

describe('the cascade, measured', () => {
    const report = runCascadeBalanceSimulation({ seeds: SEEDS, floors: FLOORS, missRates: MISS_RATES });

    it('is the same report on a replay', () => {
        const again = runCascadeBalanceSimulation({ seeds: SEEDS, floors: FLOORS, missRates: MISS_RATES });
        expect(again.bands).toEqual(report.bands);
    });

    it('never leaves a floor stuck at any miss rate, and a clean player clears every one', () => {
        for (const band of report.bands) {
            expect(band.settledShare, `miss ${band.missRate}`).toBe(1);
        }
        expect(report.bands.find((band) => band.missRate === 0)!.clearedShare).toBe(1);
    });

    it('never moves a rating because of a chunk: rating is mistakes and nothing else', () => {
        for (const sample of report.samples) {
            expect(sample.rating, `${sample.seed}/${sample.floor}/${sample.missRate}`).toBe(sample.ratingFromMistakes);
        }
    });

    it('clears faster the cleaner you play, and the chunk is why', () => {
        const clean = report.bands.find((band) => band.missRate === 0)!;
        const reference = report.bands.find((band) => band.missRate === CASCADE_BALANCE_BANDS.referenceMissRate)!;
        expect(clean.meanTurns).toBeLessThan(reference.meanTurns);
        expect(clean.chunkPairsPerFloor).toBeGreaterThanOrEqual(reference.chunkPairsPerFloor);
    });

    it('holds the stated bands, which is the whole point of writing them down', () => {
        const verdict = assertCascadeBalanceWithinBands(report);
        expect(verdict.issues, summarizeCascadeBalance(report)).toEqual([]);
        expect(verdict.ok).toBe(true);
    });
});
