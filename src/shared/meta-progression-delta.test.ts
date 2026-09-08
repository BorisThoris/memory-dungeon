import { describe, expect, it } from 'vitest';
import { buildMetaProgressionRunDelta } from './meta-progression-delta';
import { createDefaultSaveData } from './save-data';

describe('meta progression run delta feedback', () => {
    it('summarizes honor mark gains, level ups, tier changes, and newly ready rewards', () => {
        const before = createDefaultSaveData();
        before.playerStats = {
            ...before.playerStats!,
            sharpFloors: 6,
            bestFloorNoPowers: 4
        };

        const after = createDefaultSaveData();
        after.achievements.ACH_FIRST_CLEAR = true;
        after.achievements.ACH_LEVEL_FIVE = true;
        after.achievements.ACH_SCORE_THOUSAND = true;
        after.achievements.ACH_PERFECT_CLEAR = true;
        after.playerStats = {
            ...after.playerStats!,
            sharpFloors: 7,
            bestFloorNoPowers: 5
        };

        const delta = buildMetaProgressionRunDelta(before, after);

        expect(delta.changed).toBe(true);
        expect(delta.headline).toBe('Profile level up');
        // The relic shrine's ready row and the relic-mastery source went with the draft (Gen 175).
        expect(delta.rows.map((row) => row.id)).toEqual([
            'profile_level',
            'difficulty_tier',
            'milestone_reached',
            'honor_source_achievements',
            'honor_source_no_powers_mastery',
            'honor_source_sharp_floors'
        ]);
        expect(delta.rows.find((row) => row.id === 'profile_level')).toMatchObject({
            before: '3',
            after: '5',
            progress: { current: 0, target: 5 }
        });
        expect(delta.rows.find((row) => row.id === 'difficulty_tier')).toMatchObject({
            before: 'Adept tier',
            after: 'Ascendant tier'
        });
        expect(delta.summaryCopy).toContain('20 honor marks total. Legend tier at profile level 8 (15 honor marks).');
        expect(delta.summaryCopy).toContain('Ascendant tier is now the active profile tier.');
        expect(delta.nextGoalCopy).toMatch(/Legend tier at profile level 8 \(15 honor marks\)\./);
    });


    it('returns nearest next-goal copy when a run produced no meta delta', () => {
        const before = createDefaultSaveData();
        const after = createDefaultSaveData();

        const delta = buildMetaProgressionRunDelta(before, after);

        expect(delta.changed).toBe(false);
        expect(delta.rows).toEqual([]);
        expect(delta.headline).toBe('No new meta unlocks. Earn one more achievement for 2 honor marks.');
        expect(delta.summaryCopy).toBe('No new meta unlocks. Earn one more achievement for 2 honor marks.');
        expect(delta.nextGoalCopy).toMatch(/^Next: .* Adept tier at profile level 3 \(10 honor marks\)\.$/);
    });
});
