import { describe, expect, it } from 'vitest';
import {
    getChallengeModeGateRow,
    getChallengeModeGateRows,
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

    it('normalizes malformed daily counters before projecting challenge gates', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: Number.POSITIVE_INFINITY
        };

        const daily = getChallengeModeProgressionRows(save).find((row) => row.modeId === 'daily');

        expect(daily).toMatchObject({
            status: 'unlocked',
            progress: { current: 0, target: 1 }
        });
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

describe('gate ids stay attached to the mode they describe', () => {
    it('gives only the deferred endless mode the deferred endless gate', () => {
        const rows = getChallengeModeGateRows(createDefaultSaveData());
        const deferredEndless = rows.filter((row) => row.gateId === 'endless_deferred').map((row) => row.modeId);
        expect(deferredEndless).toEqual(['endless']);
    });

    it('does not label a shipped same-device mode as the one that cannot be played', () => {
        // Adding pass-and-play to the catalog inherited `endless_deferred` from a fall-through,
        // which is an id that means "deferred", on a row the Choose Path sheet renders.
        const row = getChallengeModeGateRow(createDefaultSaveData(), 'pass_and_play');
        expect(row?.gateId).toBe('same_device_table');
        expect(row?.status).toBe('available');
    });

    it('puts an unclassified mode on local mode select rather than on a deferral', () => {
        const rows = getChallengeModeGateRows(createDefaultSaveData());
        for (const row of rows) {
            if (row.status !== 'deferred') {
                expect(row.gateId, row.modeId).not.toBe('endless_deferred');
            }
        }
    });
});
