import { describe, expect, it } from 'vitest';

import {
    judgeRunOccupancy,
    judgeSystemOccupancy,
    simulateRunOccupancy,
    simulateSystemOccupancy,
    summarizeRunOccupancy,
    SYSTEM_OCCUPANCY_BANDS,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS,
    SYSTEM_OCCUPANCY_COUNTERS
} from './system-occupancy-simulation';

/**
 * The census, played as a run.
 *
 * Every simulation in this repository builds a fresh run for every floor, which measures a board
 * well and a run not at all: a charge the run hands out once and never refills reads exactly like
 * a charge every floor hands back. Task 191 asked for this at Gen 150 and it stayed open until
 * Gen 207, which is about how long the wild joker had been filed `core` on the strength of 240
 * first floors.
 */
describe('the run census', () => {
    const report = simulateRunOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });

    it('plays whole runs rather than a heap of first floors', () => {
        expect(report.runs).toBeGreaterThan(0);
        expect(report.floors).toBe(report.runs * SYSTEM_OCCUPANCY_BASELINE_FLOORS);
        expect(report.deepestFloor).toBe(SYSTEM_OCCUPANCY_BASELINE_FLOORS);
        // At the reference miss rate a run does not end on its own: the turn ceiling is a gradient
        // for a player who is missing, and a clean run ends when the player stops (thesis §42.2).
        expect(report.endReasons['reached the cap']).toBe(report.runs);
    });

    it('is deterministic, like every other census here', () => {
        expect(simulateRunOccupancy({ floors: 6 })).toEqual(simulateRunOccupancy({ floors: 6 }));
    });

    it('reads a run-cumulative counter as what the floor moved, not as its running total', () => {
        /*
         * The pins placed this run and the trait matches in the session stats do not reset when a
         * floor does. Reading their end-of-floor value inside a continuous run reports a running
         * total as a rate: measured that way the traits read 0.80-0.83 of floors, because after the
         * first trait match the number is never zero again. As deltas they read 0.44-0.65, and the
         * floor census - which cannot tell the difference, since every floor is a new run - agrees
         * with them to within what a different board explains.
         */
        const pin = report.rows.find((row) => row.key === 'pin')!;
        expect(pin.runFloorShare).toBeLessThan(0.9);
        for (const trait of report.rows.filter((row) => row.key.startsWith('trait.'))) {
            expect(trait.runFloorShare, trait.key).toBeLessThan(0.9);
        }
    });

    it('names the wild joker as a thing seen once and never again', () => {
        // The finding that produced this file. The re-band below stops it failing the gate; this
        // keeps it visible, because "once a run" and "rarely" are different games.
        const verdict = judgeRunOccupancy(report);
        expect(verdict.onceOnly.join(' ')).toContain('wildMatch');
        const wild = report.rows.find((row) => row.key === 'wildMatch')!;
        expect(wild.lastFloorSeen).toBe(1);
    });

    it('holds every run-scoped charge inside the band a run actually gives it', () => {
        const verdict = judgeRunOccupancy(report);
        expect(verdict.issues).toEqual([]);
        expect(verdict.silent).toEqual([]);
        expect(verdict.dominant).toEqual([]);
        expect(verdict.ok).toBe(true);
    });

    it('leaves the run-scoped charges to this census and not to the floor one', () => {
        /*
         * The floor census still reports them - the numbers are real, they are just numbers about
         * first floors - but it may not band them. Without this the wild joker reads 1.000 against
         * a `rare` ceiling of 0.25 and the floor gate fails on a system that is behaving exactly as
         * the setup sheet sells it.
         */
        const runScoped = SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((c) => c.id);
        // Gen 216 added the featured objective, which is run-scoped for a different reason than
        // the charges: the streak is settled by the floor transition the run census steps, and the
        // floor census never runs one, so on a fresh run every floor it would read exactly zero.
        expect(runScoped).toEqual(['magpieThefts', 'featuredStreak', 'peek', 'shuffle', 'flashPair', 'wildMatch']);
        const floorReport = simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });
        const wildOnFloors = floorReport.rows.find((row) => row.key === 'wildMatch')!;
        expect(wildOnFloors.floorShare).toBeGreaterThan(SYSTEM_OCCUPANCY_BANDS.rare.max);
        expect(judgeSystemOccupancy(floorReport).ok).toBe(true);
    });

    it('sees the magpie steal in a real run, which the floor census cannot', () => {
        /*
         * Task 156, open since Gen 113: the magpie had no counter, and no test that it ever steals
         * in a run. It arrives on every third mismatch OF THE RUN and only on a floor carrying its
         * mutator, so a census that starts a fresh run every floor almost never reaches the third
         * mismatch before the board is cleared - it reported the bird SILENT across 240 floors.
         * A mechanic that ships, works, and is invisible to the instrument built to find exactly
         * that is the whole argument for this file.
         */
        const magpie = report.rows.find((row) => row.key === 'magpieThefts')!;
        expect(magpie.runFloorShare).toBeGreaterThan(0);
        expect(magpie.lastFloorSeen).toBeGreaterThan(1);
        const onFloors = simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS }).rows.find(
            (row) => row.key === 'magpieThefts'
        )!;
        expect(onFloors.floorShare).toBe(0);
    });

    it('says where each system was last seen, which is the number a floor census cannot have', () => {
        expect(summarizeRunOccupancy(report)).toContain('last floor');
        for (const row of report.rows.filter((r) => r.runFloorShare > 0)) {
            expect(row.lastFloorSeen, row.key).toBeGreaterThan(0);
        }
    });
});
