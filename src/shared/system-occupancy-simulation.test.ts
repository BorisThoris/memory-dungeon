import { describe, expect, it } from 'vitest';
import {
    dominantSystemKeys,
    judgeSystemOccupancy,
    simulateSystemOccupancy,
    summarizeSystemOccupancy,
    SYSTEM_OCCUPANCY_BANDS,
    SYSTEM_OCCUPANCY_BASELINE,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS,
    SYSTEM_OCCUPANCY_COUNTERS,
    judgeSystemOccupancyAgainstBaseline
} from './system-occupancy-simulation';

/**
 * The census, gated as a ratchet.
 *
 * Twelve systems fire on no floor at all today. The drop is still one of them, and now for one
 * reason rather than two: a key or a treasure left in the suit no longer vetoes it (see
 * `DROP_MAX_PAIRS`), but at Sharp the ripple has already swept the suit's plain pairs, so there
 * is nothing left to fall. Two others - shuffle snares and the safe-hazard ward - come back the
 * moment a floor keeps pairs back from the dungeon's budget, which was measured and is its own
 * change (see `pairCapacityForDungeonEncounter`). That is the finding, not a reason to skip the
 * check: `SYSTEM_OCCUPANCY_BASELINE` is a baseline to burn down, and it is asserted exactly. A
 * system that goes quiet fails this test the moment it does, and a system brought back to life
 * fails it too, which is the only way a list like this ever shrinks.
 *
 * The baseline lives in the module rather than here so `yarn gate:occupancy` asserts the same
 * list this test does - one record, two readers.
 */
const KNOWN_SILENT = SYSTEM_OCCUPANCY_BASELINE.silent;

/** Systems under their cadence band but not silent. Same ratchet, same rules. */
const KNOWN_THIN = SYSTEM_OCCUPANCY_BASELINE.thin;

describe('what actually happens to a player', () => {
    const report = simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });

    it('is the same census on a replay', () => {
        expect(simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS }).rows).toEqual(report.rows);
    });

    it('agrees with the gate, so the gate and this test cannot drift apart', () => {
        expect(judgeSystemOccupancyAgainstBaseline(report), summarizeSystemOccupancy(report)).toEqual({
            ok: true,
            issues: []
        });
    });

    it('runs the loop on nearly every floor: matches resolve and matches pop', () => {
        for (const row of report.rows.filter((candidate) => candidate.cadence === 'core')) {
            expect(row.floorShare, `${row.key} (${summarizeSystemOccupancy(report)})`).toBeGreaterThanOrEqual(
                SYSTEM_OCCUPANCY_BANDS.core.min
            );
        }
    });

    it('names exactly the systems that never happen, so a new silence cannot hide in the crowd', () => {
        const silent = report.rows
            .filter((row) => row.floorShare === 0)
            .map((row) => row.key)
            .sort();
        expect(silent, summarizeSystemOccupancy(report)).toEqual([...KNOWN_SILENT].sort());
    });

    it('names exactly the systems a player meets too rarely to learn', () => {
        const thin = report.rows
            .filter((row) => row.floorShare > 0 && row.floorShare < SYSTEM_OCCUPANCY_BANDS[row.cadence].min)
            .map((row) => row.key)
            .sort();
        expect(thin, summarizeSystemOccupancy(report)).toEqual([...KNOWN_THIN].sort());
    });

    it('names nothing as dominant, because every cadence label now matches what the game does', () => {
        expect(dominantSystemKeys(report), summarizeSystemOccupancy(report)).toEqual([]);
        expect(SYSTEM_OCCUPANCY_BASELINE.dominant).toEqual([]);
    });

    it('would name a system that grew past its cadence, which is the half a minimum cannot see', () => {
        // The ceilings are new and everything currently passes them, so the only way to know they
        // are wired to anything is to hand the judge a census that breaches one. A `rare` system on
        // four floors in five is the case this exists for: still firing, still passing every
        // minimum, and no longer the occasional flourish it was designed as.
        const rare = report.rows.find((row) => row.cadence === 'rare')!;
        const swollen = { ...report, rows: report.rows.map((row) => (row.key === rare.key ? { ...row, floorShare: 0.8 } : row)) };
        expect(dominantSystemKeys(swollen)).toEqual([rare.key]);
        const verdict = judgeSystemOccupancy(swollen);
        expect(verdict.dominant.some((line) => line.includes(rare.key) && line.includes('above 0.25'))).toBe(true);
        expect(judgeSystemOccupancyAgainstBaseline(swollen).issues.some((line) => line.includes('is now dominant'))).toBe(true);
    });

    it('censuses a counter that tallies something that happened, never a charge that is merely available', () => {
        // `undoUsesThisFloor` is undos remaining, and reading it as an occurrence is the mistake
        // one level up from the one this file catches. Keep the roster free of "remaining" fields.
        expect(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.key)).not.toContain('undoUsesThisFloor');
        expect(SYSTEM_OCCUPANCY_COUNTERS.every((counter) => !/Charges|Remaining|Total/.test(counter.key))).toBe(true);
    });

    it('passes the aspirational check outright, which it could not do while the dungeon layer shipped', () => {
        // This assertion was `expect(verdict.ok).toBe(false)` for eleven generations, because the
        // honest reading of the census was that eleven shipped systems never fired. That is not a
        // test worth keeping green by widening a band, and it was never fixed by tuning: the
        // systems were deleted in Gen 171-172 and the census is now every system the game has.
        //
        // Keeping the assertion here rather than deleting it is the point. `ok` false again means
        // something shipped that a player cannot observe, and the reflex it should provoke is
        // "which system, and why does generation never make its board", not "update the baseline".
        const verdict = judgeSystemOccupancy(report);
        expect(verdict.ok, summarizeSystemOccupancy(report)).toBe(true);
        expect(verdict.silent).toEqual([]);
        expect(KNOWN_SILENT).toEqual([]);
    });
});
