import { describe, expect, it } from 'vitest';
import { judgePopReach, POP_REACH_BANDS, simulatePopReach, summarizePopReach } from './pop-reach-simulation';

/**
 * The check that would have caught it.
 *
 * Every layer of the cascade had a unit test, the whole loop had a balance simulation, and an
 * end-to-end test played a fixture to Fever - and none of them asked the one question a player
 * asks on their first floor: when I match a pair, does anything go with it? On generated floors
 * 1 to 6 the answer was no, for every seed, because four suits were dealt over floors whose
 * breakable pairs numbered one or two.
 */
describe('the pop, on the floors a player actually meets', () => {
    const report = simulatePopReach(12);

    it('is the same report on a replay', () => {
        expect(simulatePopReach(12).levels).toEqual(report.levels);
    });

    it('fires on the early floors, where a player decides whether the game has a loop at all', () => {
        const early = report.levels.filter((level) => level.level <= POP_REACH_BANDS.earlyFloors);
        for (const level of early) {
            expect(level.popRate, `floor ${level.level} (${summarizePopReach(report)})`).toBeGreaterThan(0);
        }
    });

    it('holds the stated bands', () => {
        const verdict = judgePopReach(report);
        expect(verdict.issues, summarizePopReach(report)).toEqual([]);
        expect(verdict.ok).toBe(true);
    });

    it('deals a palette a floor can actually clump: never more suits than half its breakable pairs', () => {
        for (const level of report.levels) {
            expect(level.meanSuits, `floor ${level.level}`).toBeLessThanOrEqual(4);
            expect(level.meanSuits, `floor ${level.level}`).toBeGreaterThanOrEqual(1);
        }
    });
});
