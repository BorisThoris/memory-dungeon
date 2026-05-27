import { describe, expect, it } from 'vitest';
import {
    getChallengeModeGateForMode,
    getChallengeModeMotivationSummary,
    getChallengeModeProgressionRows
} from './challenge-progression';
import { createDefaultSaveData } from './save-data';

describe('REG-081 challenge mode progression gates', () => {
    it('projects offline-resolvable challenge gates from local save data', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 2,
            bestFloorNoPowers: 5
        };
        save.lastRunSummary = {
            totalScore: 100,
            bestScore: 100,
            levelsCleared: 1,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 2,
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        const rows = getChallengeModeProgressionRows(save);
        expect(rows.map((row) => row.modeId)).toEqual(['daily', 'gauntlet', 'puzzle_glyph_cross', 'scholar', 'pin_vow']);
        expect(rows.find((row) => row.modeId === 'gauntlet')?.status).toBe('unlocked');
        expect(rows.find((row) => row.modeId === 'gauntlet')).toMatchObject({
            recommendedTier: 'adept',
            recommendedTierLabel: 'Adept tier',
            motivationCopy: 'Gauntlet is ready for local play.'
        });
        expect(rows.find((row) => row.modeId === 'puzzle_glyph_cross')?.status).toBe('in_progress');
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
        expect(rows.every((row) => row.onlineRequired === false)).toBe(true);
    });

    it('returns explicit lock copy for a selected mode', () => {
        const gate = getChallengeModeGateForMode(createDefaultSaveData(), 'gauntlet');
        expect(gate?.status).toBe('locked');
        expect(gate?.lockReason).toContain('First clear');
    });

    it('summarizes the next challenge lane from the current profile difficulty tier', () => {
        const fresh = createDefaultSaveData();
        const freshSummary = getChallengeModeMotivationSummary(fresh);

        expect(freshSummary).toMatchObject({
            profileTier: 'initiate',
            profileTierLabel: 'Initiate tier',
            nextRecommendedRow: {
                modeId: 'gauntlet',
                recommendedTier: 'adept'
            },
            nextChallengeCopy:
                'Gauntlet sits as an Adept tier goal; First clear not completed yet.'
        });
        expect(freshSummary.activeRows.map((row) => row.modeId)).toEqual(['daily']);

        const adeptWithoutFirstClear = createDefaultSaveData();
        adeptWithoutFirstClear.playerStats = {
            ...adeptWithoutFirstClear.playerStats!,
            dailiesCompleted: 7,
            bestFloorNoPowers: 3
        };

        const adeptSummary = getChallengeModeMotivationSummary(adeptWithoutFirstClear);

        expect(adeptSummary.profileTier).toBe('adept');
        expect(adeptSummary.nextRecommendedRow).toMatchObject({
            modeId: 'gauntlet',
            recommendedTier: 'adept',
            status: 'locked'
        });
        expect(adeptSummary.nextChallengeCopy).toBe(
            'Gauntlet sits as an Adept tier goal; First clear not completed yet.'
        );

        const ascendant = createDefaultSaveData();
        ascendant.achievements.ACH_FIRST_CLEAR = true;
        ascendant.achievements.ACH_LEVEL_FIVE = true;
        ascendant.achievements.ACH_SCORE_THOUSAND = true;
        ascendant.achievements.ACH_PERFECT_CLEAR = true;
        ascendant.playerStats = {
            ...ascendant.playerStats!,
            dailiesCompleted: 7,
            bestFloorNoPowers: 5,
            puzzleCompletions: {
                starter_pairs: { completed: true, bestMistakes: 0, bestScore: 100 }
            }
        };

        const ascendantSummary = getChallengeModeMotivationSummary(ascendant);

        expect(ascendantSummary.profileTier).toBe('ascendant');
        expect(ascendantSummary.activeRows.map((row) => row.modeId)).toEqual([
            'daily',
            'gauntlet',
            'puzzle_glyph_cross',
            'scholar',
            'pin_vow'
        ]);
        expect(ascendantSummary.nextRecommendedRow).toBeNull();
        expect(ascendantSummary.nextChallengeCopy).toBe('All visible challenge lanes are in the active profile tier.');
    });
});
