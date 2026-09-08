import { describe, expect, it } from 'vitest';
import {
    eligibleHonorUnlockIds,
    HONOR_UNLOCK_CATALOG,
    HONOR_UNLOCK_IDS,
    HONOR_UNLOCK_ORDER,
    honorUnlockTag,
    mergeHonorUnlockTags,
    parseHonorUnlockTag,
    totalHonorUnlocks
} from './honorUnlocks';
import { createDefaultSaveData } from './save-data';

describe('honorUnlocks', () => {
    it('merges honor tags when eligible', () => {
        const base = createDefaultSaveData();
        base.bestScore = 2000;
        const merged = mergeHonorUnlockTags(base);
        expect(merged.unlocks).toContain(honorUnlockTag('honor_score_maestro'));
        expect(merged).not.toBe(base);
    });

    it('bridges earned honors into cosmetic unlock tags', () => {
        const base = createDefaultSaveData();
        base.playerStats = {
            ...base.playerStats!,
            sharpFloors: 1,
            bestFloorNoPowers: 5
        };

        const merged = mergeHonorUnlockTags(base);

        expect(merged.unlocks).toContain(honorUnlockTag('honor_ascendant_5'));
        expect(merged.unlocks).toContain('cosmetic:title_ascendant_v');
    });

    it('is idempotent when nothing new is eligible', () => {
        const base = createDefaultSaveData();
        const once = mergeHonorUnlockTags(base);
        const twice = mergeHonorUnlockTags(once);
        expect(twice).toBe(once);
    });

    it('lists expected catalog size', () => {
        expect(Object.keys(HONOR_UNLOCK_CATALOG)).toEqual(HONOR_UNLOCK_IDS);
        expect(HONOR_UNLOCK_ORDER).toBe(HONOR_UNLOCK_IDS);
        expect(HONOR_UNLOCK_ORDER).toHaveLength(totalHonorUnlocks);
        expect(totalHonorUnlocks).toBe(4);
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects prototype honor id %s', (honorId) => {
        expect(parseHonorUnlockTag(`honor:${honorId}`)).toBeNull();
    });

    it('eligibleHonorUnlockIds respects Sharp floors and the no-powers floor', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: 1,
            bestFloorNoPowers: 10,
            encorePairKeysLastRun: []
        };
        save.bestScore = 3000;
        save.lastRunSummary = {
            totalScore: 100,
            bestScore: 100,
            levelsCleared: 2,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 1,
            perfectClears: 0
        };

        const ids = eligibleHonorUnlockIds(save);
        expect(ids).toContain('honor_ascendant_10');
        expect(ids).toContain('honor_score_maestro');
    });

    it('normalizes malformed counters before granting eligible honors', () => {
        const save = createDefaultSaveData();
        save.bestScore = Number.POSITIVE_INFINITY;
        save.playerStats = {
            ...save.playerStats!,
            sharpFloors: Number.POSITIVE_INFINITY,
            bestFloorNoPowers: Number.POSITIVE_INFINITY
        };
        save.lastRunSummary = {
            totalScore: 100,
            bestScore: 100,
            levelsCleared: Number.POSITIVE_INFINITY,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 1,
            perfectClears: 0
        };

        expect(eligibleHonorUnlockIds(save)).toEqual([]);
        expect(mergeHonorUnlockTags(save)).toBe(save);
    });
});
