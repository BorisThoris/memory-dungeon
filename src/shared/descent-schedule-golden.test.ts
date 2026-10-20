import { describe, expect, it } from 'vitest';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

/**
 * The schedule as it stood before the Descent (DGE-002, 2026-10-19), pinned so the change cannot
 * move what it promises not to move: floors 1 to 12, and every floor past them that is not a
 * reserved act boss. The seeds include ones whose boss floors draw the seeded distraction channel
 * (`pickFloorScheduleEntry`'s one-in-four micro-variation) and ones whose do not, so floors 7 and 9
 * are pinned on both branches; floors 21, 33, 45 and 57 pin the position-nine rotation past Act I.
 */
/**
 * The rules the table was recorded at. The seeded draws hash the rules version, so a later bump (70: the
 * Wanderers) would reseed the distraction channel; the table pins the schedule code, at its own rules.
 */
const GOLDEN_RULES_VERSION = 69;
const GOLDEN_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234, 13, 27] as const;
const GOLDEN_FLOORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 21, 23, 33, 45, 57, 59] as const;

describe('the schedule the Descent keeps', () => {
    it('resolves the pinned floors exactly as before the Descent', () => {
        const table = GOLDEN_SEEDS.map((seed) => ({
            seed,
            floors: GOLDEN_FLOORS.map((level) => ({ level, entry: pickFloorScheduleEntry(seed, GOLDEN_RULES_VERSION, level, 'endless') }))
        }));
        expect(table).toMatchSnapshot();
    });

    it('pins both branches of the boss floors’ seeded distraction channel', () => {
        const withChannel = GOLDEN_SEEDS.filter((seed) => pickFloorScheduleEntry(seed, GOLDEN_RULES_VERSION, 7, 'endless').mutators.includes('distraction_channel'));
        expect(withChannel.length).toBeGreaterThan(0);
        expect(withChannel.length).toBeLessThan(GOLDEN_SEEDS.length);
    });
});
