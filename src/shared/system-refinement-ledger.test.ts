import { describe, expect, it } from 'vitest';
import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import {
    simulateRunOccupancy,
    simulateSystemOccupancy,
    SYSTEM_OCCUPANCY_BASELINE_FLOORS,
    SYSTEM_OCCUPANCY_COUNTERS
} from './system-occupancy-simulation';
import {
    SYSTEM_REFINEMENT_LEDGER,
    strandedLedgerIds,
    systemRefinementLedgerById,
    unexaminedSystemIds
} from './system-refinement-ledger';

describe('every system in the game has been passed over', () => {
    it('leaves no mechanic unexamined, and no ledger entry pointing at nothing', () => {
        /*
         * This is the check behind the claim. "Refine every system" is a statement about coverage,
         * and coverage is worth what the thing checking it is worth - so: every mechanic the
         * interaction graph knows about must carry a verdict, and every verdict must name a
         * mechanic that exists.
         *
         * The consequence worth having is the one on the next person: a new mechanic cannot ship
         * without someone writing down what state it is in, because the graph will list it and this
         * will fail until the ledger does too.
         */
        expect(unexaminedSystemIds(), 'systems nobody has said anything about').toEqual([]);
        expect(strandedLedgerIds(), 'ledger entries naming a mechanic the graph does not have').toEqual([]);
        expect(systemRefinementLedgerById().size).toBe(SYSTEM_REFINEMENT_LEDGER.length);
        expect(SYSTEM_REFINEMENT_LEDGER.length).toBeGreaterThanOrEqual(gameplayInteractionGraph.mechanics.length);
    });

    it('records a real finding for every entry, so "confirmed" is never a shrug', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            // A note shorter than a sentence is someone ticking a box rather than looking.
            expect(entry.note.length, `${entry.id} note is too short to be a finding`).toBeGreaterThan(60);
            expect(entry.note.trim().endsWith('.'), `${entry.id} note is not a sentence`).toBe(true);
            expect(entry.generation, `${entry.id} predates this pass`).toBeGreaterThanOrEqual(200);
        }
    });

    it('changed more systems than it confirmed unchanged, which is what a refinement pass means', () => {
        const changed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'changed').length;
        const confirmed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'confirmed').length;
        const removed = SYSTEM_REFINEMENT_LEDGER.filter((entry) => entry.verdict === 'removed').length;

        expect(changed + confirmed + removed).toBe(SYSTEM_REFINEMENT_LEDGER.length);
        // Not a target to chase later - a description of what generations 200-202 actually did.
        expect(changed).toBeGreaterThanOrEqual(18);
        expect(removed).toBeGreaterThanOrEqual(1);
    });
});

describe('the numbers the ledger quotes', () => {
    /*
     * Gen 208. Seven notes quote a measurement - "Occupancy 0.408", "1.000 x 4.46" - and a
     * measurement written into prose goes stale the moment the game moves. Two of the seven had:
     * the gambit said 0.408 against a census reading 0.446, and the turn resolution said 4.46 turns
     * a floor against 4.95. Neither is a big number and that is the point; nobody would ever catch
     * them by reading, and both are the kind of figure a later generation reasons from.
     *
     * So the note names its counter and the census re-measures it here. A run-scoped charge is read
     * off the run census, because that is the census entitled to band it (Gen 207).
     */
    const floorReport = simulateSystemOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });
    const runReport = simulateRunOccupancy({ floors: SYSTEM_OCCUPANCY_BASELINE_FLOORS });
    const runScoped = new Set(
        SYSTEM_OCCUPANCY_COUNTERS.filter((counter) => counter.scope === 'run').map((counter) => counter.id)
    );
    const measured = (counterId: string): { share: number; perFloor: number } => {
        if (runScoped.has(counterId)) {
            const row = runReport.rows.find((candidate) => candidate.key === counterId)!;
            return { share: row.runFloorShare, perFloor: row.perFloor };
        }
        const row = floorReport.rows.find((candidate) => candidate.key === counterId)!;
        return { share: row.floorShare, perFloor: row.perFloor };
    };

    it('names a counter for every note that quotes one', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!/[Oo]ccupancy \d/.test(entry.note)) continue;
            expect(entry.counter, `${entry.id} quotes an occupancy without naming its counter`).toBeTruthy();
        }
    });

    it('names a real counter, so a renamed one cannot go unnoticed', () => {
        const ids = new Set(SYSTEM_OCCUPANCY_COUNTERS.map((counter) => counter.id));
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!entry.counter) continue;
            expect(ids.has(entry.counter), `${entry.id} names ${entry.counter}`).toBe(true);
        }
    });

    it('quotes what the census says today, not what it said when the note was written', () => {
        for (const entry of SYSTEM_REFINEMENT_LEDGER) {
            if (!entry.counter) continue;
            const quoted = /[Oo]ccupancy (\d+\.\d+)/.exec(entry.note);
            expect(quoted, `${entry.id} names a counter but quotes no share`).toBeTruthy();
            const { share, perFloor } = measured(entry.counter);
            expect(Number(quoted![1]), `${entry.id} share`).toBeCloseTo(share, 2);
            const intensity = /[Oo]ccupancy \d+\.\d+ x (\d+\.\d+)/.exec(entry.note);
            if (intensity) {
                expect(Number(intensity[1]), `${entry.id} intensity`).toBeCloseTo(perFloor, 1);
            }
        }
    });
});
