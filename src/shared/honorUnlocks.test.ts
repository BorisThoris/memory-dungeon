import { describe, expect, it } from 'vitest';
import {
    eligibleHonorUnlockIds,
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
            dailiesCompleted: 1,
            bestFloorNoPowers: 5
        };

        const merged = mergeHonorUnlockTags(base);

        expect(merged.unlocks).toContain(honorUnlockTag('honor_daily_initiate'));
        expect(merged.unlocks).toContain('cosmetic:crest_daily_bronze');
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
        expect(HONOR_UNLOCK_ORDER.length).toBe(totalHonorUnlocks);
        expect(totalHonorUnlocks).toBe(8);
    });

    it.each(['__proto__', 'constructor', 'toString'])('rejects prototype honor id %s', (honorId) => {
        expect(parseHonorUnlockTag(`honor:${honorId}`)).toBeNull();
    });

    it('eligibleHonorUnlockIds respects daily streak and no-powers floor', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 1,
            dailyStreakCosmetic: 7,
            bestFloorNoPowers: 10,
            relicPickCounts: { extra_shuffle_charge: 10 },
            lastDailyDateKeyUtc: '2026-01-01',
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
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        const ids = eligibleHonorUnlockIds(save);
        expect(ids).toContain('honor_daily_initiate');
        expect(ids).toContain('honor_daily_streak_7');
        expect(ids).toContain('honor_ascendant_10');
        expect(ids).toContain('honor_score_maestro');
        expect(ids).toContain('honor_relic_habit');
        expect(ids).toContain('honor_gauntlet_proof');
    });
});
