import { describe, expect, it } from 'vitest';
import { type RunState } from './contracts';
import { createNewRun } from './game';
import { endlessPlaceForLevel } from './floor-mutator-schedule';
import { ENDLESS_RENT_GROWTH, endlessRentDue, endlessRentForFloor, settleEndlessRent } from './endless-rent-rules';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const at = (level: number, extra: Partial<RunState> = {}): RunState => {
    const base = createNewRun(0, { runSeed: 9191 });
    return { ...base, status: 'levelComplete', endless: true, board: { ...base.board!, level }, ...extra };
};

describe("Endless's rent (DGE-006)", () => {
    it('owes nothing on the Descent and something on every Endless floor', () => {
        for (let level = 1; level <= 60; level += 1) expect(endlessRentForFloor(level, CLASSIC_DESCENT_RULES)).toBe(0);
        for (let level = 61; level <= 300; level += 1) expect(endlessRentForFloor(level, CLASSIC_DESCENT_RULES), `floor ${level}`).toBeGreaterThan(0);
    });

    it('rises every cycle at the same place in an act', () => {
        // The first floor of each cycle's Gate.
        const gates = [61, 91, 108, 124];
        for (const level of gates) expect(endlessPlaceForLevel(level)?.act.id).toBe('gate');
        expect(ENDLESS_RENT_GROWTH).toBeGreaterThan(1);
        for (let i = 1; i < gates.length; i += 1) {
            expect(endlessRentForFloor(gates[i]!, CLASSIC_DESCENT_RULES)).toBeGreaterThan(endlessRentForFloor(gates[i - 1]!, CLASSIC_DESCENT_RULES));
        }
    });

    it('ends an Endless run whose clear paid less than its rent, and leaves a paying one going', () => {
        const rent = endlessRentForFloor(61, CLASSIC_DESCENT_RULES);
        expect(settleEndlessRent(at(61), rent - 1)).toMatchObject({ status: 'gameOver', runEndReason: 'rent_unpaid' });
        const paid = at(61);
        expect(settleEndlessRent(paid, rent)).toBe(paid);
        // A run that took the win never reaches Endless; one that is not Endless owes no rent at any depth.
        const descent = at(61, { endless: false });
        expect(settleEndlessRent(descent, 0)).toBe(descent);
    });

    it('shows on the run bar what the floor owes and what it has paid', () => {
        const run = at(61, { status: 'playing', stats: { ...at(61).stats, currentLevelScore: 1234 } });
        expect(endlessRentDue(run)).toEqual({ rent: endlessRentForFloor(61, CLASSIC_DESCENT_RULES), paid: 1234 });
        expect(endlessRentDue({ ...run, endless: false })).toBeNull();
        expect(endlessRentDue({ ...run, board: { ...run.board!, level: 40 } })).toBeNull();
    });
});
