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
            gameMode: 'endless'
        };

        const rows = getChallengeModeProgressionRows(save);
        expect(rows.map((row) => row.modeId)).toEqual(['daily', 'pass_and_play', 'puzzle_glyph_cross']);
        expect(rows.find((row) => row.modeId === 'pass_and_play')?.status).toBe('unlocked');
        expect(rows.find((row) => row.modeId === 'pass_and_play')).toMatchObject({
            recommendedTier: 'adept',
            recommendedTierLabel: 'Adept tier',
            motivationCopy: 'Pass and Play is ready for local play.'
        });
        expect(rows.find((row) => row.modeId === 'puzzle_glyph_cross')?.status).toBe('in_progress');
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
        expect(rows.every((row) => row.onlineRequired === false)).toBe(true);
    });

    it('returns explicit lock copy for a selected mode', () => {
        // The puzzle lane is the one that still gates on something a player has to do first.
        const gate = getChallengeModeGateForMode(createDefaultSaveData(), 'puzzle_glyph_cross');
        expect(gate?.status).toBe('in_progress');
        expect(gate?.lockReason).toContain('Starter Pairs');
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
                modeId: 'pass_and_play',
                recommendedTier: 'adept'
            },
            nextChallengeCopy:
                'Pass and Play sits as an Adept tier goal; Pass and Play is ready for local play.'
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
        // Pass and Play is open to anyone, so at Adept the next lane is the authored puzzle,
        // which still gates on finishing Starter Pairs.
        expect(adeptSummary.nextRecommendedRow).toMatchObject({
            modeId: 'puzzle_glyph_cross',
            recommendedTier: 'adept',
            status: 'in_progress'
        });
        expect(adeptSummary.nextChallengeCopy).toContain('Glyph Cross');

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
            'pass_and_play',
            'puzzle_glyph_cross',
        ]);
        expect(ascendantSummary.nextRecommendedRow).toBeNull();
        expect(ascendantSummary.nextChallengeCopy).toBe('All visible challenge lanes are in the active profile tier.');
    });
});

describe('gate ids stay attached to the mode they describe', () => {
    it('has no deferred gate left, because the mode that needed one is gone', () => {
        // `endless_deferred` was the id every unclassified mode fell through to. The card it named
        // was locked from the day it was added and never became a game; retiring it retired the
        // deferral too.
        const rows = getChallengeModeGateRows(createDefaultSaveData());
        expect(rows.filter((row) => row.status === 'deferred')).toEqual([]);
    });

    it('does not label a shipped same-device mode as the one that cannot be played', () => {
        // Adding pass-and-play to the catalog inherited `endless_deferred` from a fall-through,
        // which is an id that means "deferred", on a row the Choose Path sheet renders.
        const row = getChallengeModeGateRow(createDefaultSaveData(), 'pass_and_play');
        expect(row?.gateId).toBe('same_device_table');
        expect(row?.status).toBe('available');
    });

    it('puts every catalog mode on a gate it can name', () => {
        const rows = getChallengeModeGateRows(createDefaultSaveData());
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(row.gateId, row.modeId).toBeTruthy();
        }
    });
});
