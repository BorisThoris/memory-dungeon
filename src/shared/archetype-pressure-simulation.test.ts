import { describe, expect, it } from 'vitest';

import {
    ARCHETYPE_PRESSURE_BANDS,
    ARCHETYPE_PRESSURE_FLOORS,
    type ArchetypePressureRow,
    judgeArchetypePressure,
    simulateArchetypePressure
} from '../../scripts/sim-archetype-pressure';
import { FLOOR_ARCHETYPE_CATALOG, pressureRoleForArchetype } from './floor-mutator-schedule';
import { PAR_OPENING_FLOORS } from './floor-par';
import { SUIT_DEAL_PROFILE_BY_ARCHETYPE, SCATTERED_SUIT_CEILING } from './tile-suit-rules';

/**
 * Gen 260. The cycle sorts eleven archetypes into five pacing roles and nothing had ever checked that
 * the roles describe how the floors play. Measured with the archetype as the only thing moving, the
 * recovery floor cost 0.778 of its par against the pressure floors' 0.739 - the pacing upside down at
 * the role level. These are about the band that holds it the right way up.
 */
const row = (overrides: Partial<ArchetypePressureRow> & { role: string; ofPar: number }): ArchetypePressureRow => ({
    archetypeId: 'breather',
    profile: 'clumped',
    suits: 4,
    pairs: 18,
    turns: 9,
    par: 12,
    boards: 120,
    ...overrides
});

describe('the archetype pressure bands', () => {
    it('fails a recovery floor that costs more of its par than the pressure floors', () => {
        const issues = judgeArchetypePressure([
            row({ role: 'recovery', ofPar: 0.778 }),
            row({ archetypeId: 'trap_hall', role: 'pressure', ofPar: 0.727 }),
            row({ archetypeId: 'speed_trial', role: 'pressure', ofPar: 0.751 }),
            row({ archetypeId: 'survey_hall', role: 'baseline', ofPar: 0.758 }),
            row({ archetypeId: 'treasure_gallery', role: 'reward', ofPar: 0.795 }),
            row({ archetypeId: 'script_room', role: 'mystery', ofPar: 0.767 })
        ]);
        // The numbers Gen 260 measured before the fix, so this asserts the band on its own history.
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatch(/the recovery floor is not a rest/);
        expect(issues[0]).toMatch(/0\.778/);
    });

    it('passes when the recovery floor is the rest it says it is', () => {
        expect(
            judgeArchetypePressure([
                row({ role: 'recovery', ofPar: 0.682 }),
                row({ archetypeId: 'trap_hall', role: 'pressure', ofPar: 0.727 }),
                row({ archetypeId: 'speed_trial', role: 'pressure', ofPar: 0.751 }),
                row({ archetypeId: 'survey_hall', role: 'baseline', ofPar: 0.758 }),
                row({ archetypeId: 'treasure_gallery', role: 'reward', ofPar: 0.795 }),
                row({ archetypeId: 'script_room', role: 'mystery', ofPar: 0.767 })
            ])
        ).toEqual([]);
    });

    it('notices a role that no archetype carries, so the role map cannot drift away from this gate', () => {
        const issues = judgeArchetypePressure([row({ role: 'recovery', ofPar: 0.6 })]);
        expect(issues.some((issue) => /no archetype carries the pressure role/.test(issue))).toBe(true);
        expect(issues.some((issue) => /no archetype carries the baseline role/.test(issue))).toBe(true);
    });

    it('reads its roles from the schedule rather than keeping a second copy of them', () => {
        // Every role the band requires has to be one the schedule actually hands out, or the gate is
        // checking a taxonomy of its own invention.
        const assigned = new Set(
            (Object.keys(FLOOR_ARCHETYPE_CATALOG) as (keyof typeof FLOOR_ARCHETYPE_CATALOG)[]).map((id) =>
                pressureRoleForArchetype(id)
            )
        );
        for (const role of ARCHETYPE_PRESSURE_BANDS.requiredRoles) {
            expect(assigned.has(role), `${role} is handed out by pressureRoleForArchetype`).toBe(true);
        }
    });

    it('gives the recovery floor the narrow palette, which is the one lever an archetype has', () => {
        /*
         * The whole finding: measured with the archetype as the only thing moving, every clumped
         * archetype came out 0.758-0.795 and every narrow one 0.697-0.727, so the deal profile is the
         * difficulty and the archetype id is a label. A recovery floor on the wide palette therefore
         * cannot be a rest however its hint reads.
         */
        const recovery = (Object.keys(FLOOR_ARCHETYPE_CATALOG) as (keyof typeof FLOOR_ARCHETYPE_CATALOG)[]).filter(
            (id) => pressureRoleForArchetype(id) === 'recovery'
        );
        expect(recovery.length).toBeGreaterThan(0);
        for (const id of recovery) {
            expect(SUIT_DEAL_PROFILE_BY_ARCHETYPE[id], `${id} deals a narrow palette`).not.toBe('clumped');
        }
    });

    it('measures past the opening tilt, so the opening allowance cannot carry the reading', () => {
        for (const floor of ARCHETYPE_PRESSURE_FLOORS) {
            expect(floor, `floor ${floor} is past the opening`).toBeGreaterThan(PAR_OPENING_FLOORS);
        }
    });
});

describe('the archetype pressure simulation', () => {
    it('holds everything but the archetype, and finds the deal profile is the difficulty', () => {
        const rows = simulateArchetypePressure({ seeds: [7, 8, 9], floors: [22] });
        expect(rows).toHaveLength(Object.keys(FLOOR_ARCHETYPE_CATALOG).length);
        // Same floor, so the same board size for every archetype: nothing but the deal differs.
        expect(new Set(rows.map((entry) => entry.pairs)).size).toBe(1);
        for (const entry of rows) {
            expect(entry.suits, `${entry.archetypeId} palette`).toBe(
                entry.profile === 'clumped' ? 4 : SCATTERED_SUIT_CEILING
            );
            expect(entry.boards).toBe(3);
        }
        const narrow = rows.filter((entry) => entry.profile !== 'clumped');
        const wide = rows.filter((entry) => entry.profile === 'clumped');
        const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
        // The reading this gate exists for: a narrow-palette floor takes fewer turns per pair than a
        // wide one on the identical board. Turns, not of-par - par follows the palette since Gen 259.
        expect(mean(narrow.map((entry) => entry.turns / entry.pairs))).toBeLessThan(
            mean(wide.map((entry) => entry.turns / entry.pairs))
        );
    });
});
