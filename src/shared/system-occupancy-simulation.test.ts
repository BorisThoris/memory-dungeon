import { describe, expect, it } from 'vitest';
import {
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

    it('censuses a counter that tallies something that happened, never a charge that is merely available', () => {
        // `undoUsesThisFloor` is undos remaining, and reading it as an occurrence is the mistake
        // one level up from the one this file catches. Keep the roster free of "remaining" fields.
        expect(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.key)).not.toContain('undoUsesThisFloor');
        expect(SYSTEM_OCCUPANCY_COUNTERS.every((counter) => !/Charges|Remaining|Total/.test(counter.key))).toBe(true);
    });

    it('reports every silent system by name and the verdict says so', () => {
        const verdict = judgeSystemOccupancy(report);
        expect(verdict.ok).toBe(false);
        expect(verdict.silent).toHaveLength(KNOWN_SILENT.length);
    });
});
