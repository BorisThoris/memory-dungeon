import { describe, expect, it } from 'vitest';
import { buildMetaProgressionRunDelta } from './meta-progression-delta';
import { applyMetaProgressionUnlock } from './meta-progression';
import { createDefaultSaveData } from './save-data';

describe('meta progression run delta feedback', () => {
    it('summarizes honor mark gains, level ups, tier changes, and newly ready rewards', () => {
        const before = createDefaultSaveData();
        before.playerStats = {
            ...before.playerStats!,
            dailiesCompleted: 6,
            bestFloorNoPowers: 4,
            relicPickCounts: {
                extra_shuffle_charge: 1
            }
        };

        const after = createDefaultSaveData();
        after.achievements.ACH_FIRST_CLEAR = true;
        after.achievements.ACH_LEVEL_FIVE = true;
        after.achievements.ACH_SCORE_THOUSAND = true;
        after.achievements.ACH_PERFECT_CLEAR = true;
        after.playerStats = {
            ...after.playerStats!,
            dailiesCompleted: 7,
            bestFloorNoPowers: 5,
            relicPickCounts: {
                extra_shuffle_charge: 2
            },
            relicShrineExtraPickUnlocked: false
        };

        const delta = buildMetaProgressionRunDelta(before, after);

        expect(delta.changed).toBe(true);
        expect(delta.headline).toBe('Profile level up');
        expect(delta.rows.map((row) => row.id)).toEqual([
            'profile_level',
            'difficulty_tier',
            'reward_upgrade_relic_shrine_extra_pick',
            'milestone_reached',
            'honor_source_achievements',
            'honor_source_daily_archive',
            'honor_source_no_powers_mastery',
            'honor_source_relic_mastery'
        ]);
        expect(delta.rows.find((row) => row.id === 'profile_level')).toMatchObject({
            before: '3',
            after: '5',
            progress: { current: 1, target: 5 }
        });
        expect(delta.rows.find((row) => row.id === 'difficulty_tier')).toMatchObject({
            before: 'Adept tier',
            after: 'Ascendant tier'
        });
        expect(delta.rows.find((row) => row.id === 'reward_upgrade_relic_shrine_extra_pick')).toMatchObject({
            title: 'Week of Archives ready',
            before: 'locked',
            after: 'ready',
            body: '+1 relic pick per milestone can be unlocked from Profile.'
        });
        expect(delta.summaryCopy).toBe(
            '21 honor marks total. Legend tier at profile level 8 (14 honor marks). Ascendant tier is now the active profile tier. +1 relic pick per milestone can be unlocked from Profile.'
        );
        expect(delta.nextGoalCopy).toBe(
            'Week of Archives is ready. Legend tier at profile level 8 (14 honor marks).'
        );
    });

    it('calls out a claimed permanent upgrade as owned without double-counting mark progress', () => {
        const ready = createDefaultSaveData();
        ready.playerStats = {
            ...ready.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: false
        };
        const owned = applyMetaProgressionUnlock(ready, 'upgrade_relic_shrine_extra_pick').save;

        const delta = buildMetaProgressionRunDelta(ready, owned);

        expect(delta).toMatchObject({
            changed: true,
            headline: 'Week of Archives owned',
            summaryCopy: '+1 relic pick per milestone is now active where its mode rule allows it.'
        });
        expect(delta.rows).toEqual([
            expect.objectContaining({
                id: 'reward_upgrade_relic_shrine_extra_pick',
                kind: 'reward_status',
                before: 'ready',
                after: 'owned',
                body: '+1 relic pick per milestone is now active where its mode rule allows it.'
            })
        ]);
    });

    it('returns nearest next-goal copy when a run produced no meta delta', () => {
        const before = createDefaultSaveData();
        const after = createDefaultSaveData();

        const delta = buildMetaProgressionRunDelta(before, after);

        expect(delta.changed).toBe(false);
        expect(delta.rows).toEqual([]);
        expect(delta.headline).toBe('No new meta unlocks. Earn one more achievement for 2 honor marks.');
        expect(delta.summaryCopy).toBe('No new meta unlocks. Earn one more achievement for 2 honor marks.');
        expect(delta.nextGoalCopy).toBe(
            'Next: Week of Archives (0/7 from Daily archive completions). Adept tier at profile level 3 (10 honor marks).'
        );
    });
});
