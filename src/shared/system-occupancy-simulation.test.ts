import { describe, expect, it } from 'vitest';
import {
    dominantSystemKeys,
    floorBandedRows,
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
 * Twelve systems once fired on no floor at all, the drop among them; eleven left with the dungeon
 * layer and the drop came back as the severance drop (Gen 180), which fires on nearly half of
 * floors. `SYSTEM_OCCUPANCY_BASELINE` is a baseline to burn down, and it is asserted exactly. A
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
        // `floorBandedRows` and not `report.rows`: a run-scoped charge is banded by `sim:run`, and
        // reading its zero here would report the magpie as a silence when what it actually is is a
        // mechanic this census cannot see - it arrives on the third mismatch of a RUN (Gen 208).
        const silent = floorBandedRows(report)
            .filter((row) => row.floorShare === 0)
            .map((row) => row.key)
            .sort();
        expect(silent, summarizeSystemOccupancy(report)).toEqual([...KNOWN_SILENT].sort());
    });

    it('names exactly the systems a player meets too rarely to learn', () => {
        const thin = floorBandedRows(report)
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
        // are wired to anything is to hand the judge a census that breaches one. A `common` system
        // on nineteen floors in twenty is the case this exists for: still firing, still passing
        // every minimum, and no longer one system among several. (It was a `rare` row swollen to
        // 0.8 until the drop, the last rare system, became common in Gen 180.)
        const common = report.rows.find((row) => row.cadence === 'common')!;
        const swollen = { ...report, rows: report.rows.map((row) => (row.key === common.key ? { ...row, floorShare: 0.95 } : row)) };
        expect(dominantSystemKeys(swollen)).toEqual([common.key]);
        const verdict = judgeSystemOccupancy(swollen);
        expect(verdict.dominant.some((line) => line.includes(common.key) && line.includes('above 0.9'))).toBe(true);
        expect(judgeSystemOccupancyAgainstBaseline(swollen).issues.some((line) => line.includes('is now dominant'))).toBe(true);
    });

    it('never reads a charge that is merely available as a thing that happened', () => {
        /*
         * `undoUsesThisFloor` is undos remaining, and reading its value as an occurrence is the
         * mistake one level up from the one this file catches: it would report "the charge exists"
         * as "somebody pressed it". Gen 195 made such a field censusable, but only as a spend -
         * the fall, never the value - so the rule is now about the kind, not the name.
         */
        for (const counter of SYSTEM_OCCUPANCY_COUNTERS) {
            if (/Charges$|Remaining|UsesThisFloor$/u.test(counter.key)) {
                expect(counter.kind, counter.key).toBe('spend');
            }
        }
        // And nothing reads a total, which is neither an occurrence nor a charge.
        expect(SYSTEM_OCCUPANCY_COUNTERS.every((counter) => !/Total/u.test(counter.key))).toBe(true);
    });

    it('keeps the reference pass free of the tools, so a shuffled board never moves the cascade baseline', () => {
        const reference = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.player === 'reference');
        expect(reference.every((counter) => counter.kind === 'tally')).toBe(true);
        expect(reference.every((counter) => counter.family !== 'tools')).toBe(true);
        const tooled = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.player === 'tooled');
        expect(tooled.length).toBeGreaterThan(0);
        expect(tooled.every((counter) => counter.family === 'tools')).toBe(true);
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
