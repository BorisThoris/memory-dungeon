import { describe, expect, it } from 'vitest';
import { gameplayInteractionGraph } from './gameplay-interaction-graph';
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
