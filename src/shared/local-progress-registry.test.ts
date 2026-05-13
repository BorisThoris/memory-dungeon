import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { getLocalProgressRegistryRows, getLocalProgressRegistrySummary } from './local-progress-registry';

describe('GLD-P1-009 local progress registry adapters', () => {
    it('normalizes daily archive, objective board, and quest campaign rows without merging registries', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: 5,
            dailiesCompleted: 3,
            dailyStreakCosmetic: 2,
            lastDailyDateKeyUtc: '20260425'
        };
        save.lastRunSummary = {
            totalScore: 120,
            bestScore: 120,
            levelsCleared: 1,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 2,
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        const rows = getLocalProgressRegistryRows(save, Date.UTC(2026, 3, 26, 1));

        expect(new Set(rows.map((row) => row.source))).toEqual(
            new Set(['daily_archive', 'objective_board', 'quest_campaign'])
        );
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.every((row) => row.progressLabel.length > 0)).toBe(true);
        expect(rows.every((row) => row.sourceFields.length > 0)).toBe(true);
        expect(rows.find((row) => row.source === 'daily_archive' && row.id === 'daily:20260425')).toMatchObject({
            status: 'completed',
            progressLabel: expect.stringContaining('20260425')
        });
        expect(rows.find((row) => row.source === 'objective_board' && row.id === 'daily_three')).toMatchObject({
            status: 'completed',
            progressLabel: '3/3'
        });
        expect(rows.find((row) => row.source === 'quest_campaign' && row.id === 'daily_rhythm')).toMatchObject({
            status: 'completed',
            progressLabel: '3/3'
        });
    });

    it('summarizes active, completed, locked, and failed status vocabulary consistently', () => {
        const save = createDefaultSaveData();
        const summary = getLocalProgressRegistrySummary(save, Date.UTC(2026, 3, 26, 1));

        expect(summary.localOnly).toBe(true);
        expect(summary.total).toBeGreaterThan(0);
        expect(summary.active).toBeGreaterThan(0);
        expect(summary.locked).toBeGreaterThan(0);
        expect(summary.failed).toBe(0);
    });
});
