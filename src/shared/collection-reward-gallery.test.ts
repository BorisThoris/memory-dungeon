import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { getCollectionRewardGalleryRows } from './collection-reward-gallery';

describe('REG-093 collection reward gallery', () => {
    it('derives owned, in-progress, and missing gallery rows from local save data', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.unlocks = ['cosmetic:crest_daily_bronze'];
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 2,
            relicPickCounts: { extra_shuffle_charge: 3 }
        };

        const rows = getCollectionRewardGalleryRows(save);
        expect(rows.map((row) => row.id)).toEqual(['achievements', 'profile_goal', 'cosmetics', 'relics', 'history']);
        expect(rows.find((row) => row.id === 'achievements')?.owned).toBe(1);
        expect(rows.find((row) => row.id === 'cosmetics')?.owned).toBeGreaterThan(1);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.every((row) => row.nextAction.length > 0)).toBe(true);
    });

    it('does not mark ready but unclaimed meta rewards as owned', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 7
        };

        const profileGoal = getCollectionRewardGalleryRows(save).find((row) => row.id === 'profile_goal');

        expect(profileGoal).toMatchObject({
            title: 'Week of Archives',
            owned: 7,
            total: 7,
            status: 'in_progress',
            progressLabel: '7/7'
        });
        expect(profileGoal?.unlockHint).toMatch(/seven Daily Challenge floors/i);
    });

    it('keeps fully progressed deferred upgrades out of the short-term gallery focus', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: 12
        };

        const profileGoal = getCollectionRewardGalleryRows(save).find((row) => row.id === 'profile_goal');

        expect(profileGoal).toMatchObject({
            title: 'Week of Archives',
            owned: 0,
            total: 7,
            status: 'missing'
        });
        expect(profileGoal?.unlockHint).toMatch(/seven Daily Challenge floors/i);
    });
});
