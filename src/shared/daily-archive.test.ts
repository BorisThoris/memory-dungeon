import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from './save-data';
import {
    buildDailyArchiveShareString,
    buildDailyResultsLoopRows,
    dailyArchiveDateKeyForTimestamp,
    getDailyStreakEthicsRow,
    getDailyArchiveRows,
    getDailyArchiveSummary,
    seasonKeyForDaily,
    weekKeyForDaily
} from './daily-archive';

describe('REG-083 daily weekly season archive', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('derives offline daily, weekly, and season archive rows from local save data', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 8,
            dailyStreakCosmetic: 4,
            lastDailyDateKeyUtc: '20260425'
        };
        save.lastRunSummary = {
            totalScore: 2500,
            bestScore: 3000,
            levelsCleared: 2,
            highestLevel: 3,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 5,
            perfectClears: 1,
            gameMode: 'daily',
            dailyDateKeyUtc: '20260425',
            runSeed: 123,
            runRulesVersion: 15
        };

        const rows = getDailyArchiveRows(save);
        expect(rows.map((row) => row.archiveType)).toEqual(['daily', 'weekly', 'season']);
        expect(rows[0]).toMatchObject({
            archiveKey: '20260425',
            status: 'completed',
            localOnly: true,
            onlineLeaderboardDeferred: true
        });
        expect(rows[1]?.archiveKey).toBe(weekKeyForDaily('20260425'));
        expect(rows[2]?.archiveKey).toBe(seasonKeyForDaily('20260425'));
        expect(getDailyArchiveSummary(save)).toMatchObject({
            completedDailies: 8,
            currentStreak: 4,
            lastDailyDateKeyUtc: '20260425',
            onlineRequired: false
        });
    });

    it('builds privacy-safe local share strings without competitive rank', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, dailiesCompleted: 1, lastDailyDateKeyUtc: '20260425' };
        save.lastRunSummary = {
            totalScore: 900,
            bestScore: 900,
            levelsCleared: 1,
            highestLevel: 2,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 3,
            perfectClears: 0,
            gameMode: 'daily',
            dailyDateKeyUtc: '20260425'
        };

        const share = buildDailyArchiveShareString(save);
        expect(share).toContain('Daily 20260425');
        expect(share).toContain('local-only');
        expect(share).not.toMatch(/rank|leaderboard|account/i);
        // No chain, no chain clause: an older summary does not post "best chain ×0".
        expect(share).not.toContain('chain');
    });

    it('names the best chain and the Fever floors when the daily had them', () => {
        const save = createDefaultSaveData();
        save.playerStats = { ...save.playerStats!, dailiesCompleted: 1, lastDailyDateKeyUtc: '20260425' };
        save.lastRunSummary = {
            totalScore: 900,
            bestScore: 900,
            levelsCleared: 2,
            highestLevel: 3,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 3,
            perfectClears: 0,
            gameMode: 'daily',
            dailyDateKeyUtc: '20260425',
            bestChain: 9,
            sharpFloors: 2,
            feverFloors: 1
        };
        const share = buildDailyArchiveShareString(save);
        expect(share).toContain('best chain ×9');
        expect(share).toContain('Fever on 1 floor(s)');
        expect(share.indexOf('best chain')).toBeLessThan(share.indexOf('local-only'));
    });

    it('normalizes malformed archive counters before building summaries and share strings', () => {
        const save = createDefaultSaveData();
        save.bestScore = Number.POSITIVE_INFINITY;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: Number.POSITIVE_INFINITY,
            dailyStreakCosmetic: Number.NaN,
            lastDailyDateKeyUtc: '20260425'
        };
        save.lastRunSummary = {
            totalScore: Number.POSITIVE_INFINITY,
            bestScore: 0,
            levelsCleared: Number.NaN,
            highestLevel: Number.POSITIVE_INFINITY,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 0,
            perfectClears: 0,
            gameMode: 'daily',
            dailyDateKeyUtc: '20260425'
        };

        const summary = getDailyArchiveSummary(save);
        const share = buildDailyArchiveShareString(save);
        const loopRows = buildDailyResultsLoopRows(save);

        expect(summary.completedDailies).toBe(0);
        expect(summary.currentStreak).toBe(0);
        expect(share).toContain('0 pts · 0 clear(s)');
        expect(share).not.toMatch(/NaN|Infinity/);
        expect(loopRows[0]?.currentAttempt).toBe('0 score · floor 0 · 0 clear(s)');
        expect(loopRows[0]?.personalBest).toBe('0 all-mode best · 0 daily clear(s)');
    });

    it('rejects impossible compact UTC keys instead of rolling them into archive windows', () => {
        expect(weekKeyForDaily('20260231')).toBe('week:none');
        expect(seasonKeyForDaily('20261301')).toBe('season:none');

        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 1,
            dailyStreakCosmetic: 2,
            lastDailyDateKeyUtc: '20260231'
        };

        const summary = getDailyArchiveSummary(save, Date.UTC(2026, 1, 28, 12));

        expect(summary.lastDailyDateKeyUtc).toBeNull();
        expect(summary.rows[0]).toMatchObject({
            archiveKey: '20260228',
            comparisonString: 'Last daily unknown · 1 local clears · streak 2 · grace day held',
            key: '20260228'
        });
        expect(summary.rows[1]?.archiveKey).toBe(weekKeyForDaily('20260228'));
        expect(summary.rows[2]?.archiveKey).toBe(seasonKeyForDaily('20260228'));
    });

    it('falls back to the current UTC date for malformed archive timestamps', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.UTC(2026, 3, 30, 12)));

        expect(dailyArchiveDateKeyForTimestamp(Number.NaN)).toBe('20260430');

        const summary = getDailyArchiveSummary(createDefaultSaveData(), Number.POSITIVE_INFINITY);
        expect(summary.rows[0]?.archiveKey).toBe('20260430');
        expect(summary.rows[0]?.comparisonString).toContain('Today 20260430');
    });

    it('REG-023 builds local daily and weekly results loop rows', () => {
        const save = createDefaultSaveData();
        save.bestScore = 1200;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 3,
            dailyStreakCosmetic: 2,
            lastDailyDateKeyUtc: '20260425'
        };
        save.lastRunSummary = {
            totalScore: 950,
            bestScore: 1200,
            levelsCleared: 2,
            highestLevel: 4,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 5,
            perfectClears: 1,
            gameMode: 'daily',
            dailyDateKeyUtc: '20260425'
        };

        const rows = buildDailyResultsLoopRows(save);
        expect(rows.map((row) => row.scope)).toEqual(['daily', 'weekly']);
        expect(rows[0]).toMatchObject({
            currentAttempt: '950 score · floor 4 · 2 clear(s)',
            localOnly: true,
            onlineLeaderboardDeferred: true
        });
        expect(rows[0]?.shareString).toContain('Daily 20260425');
        expect(rows[1]?.shareString).toContain(`Weekly ${weekKeyForDaily('20260425')}`);
        expect(rows[0]?.repeatAttemptRule).toMatch(/local history/i);
    });

    it('REG-053 explains friendly UTC streak and no-freeze ethics', () => {
        const save = createDefaultSaveData();
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 5,
            dailyStreakCosmetic: 2,
            lastDailyDateKeyUtc: '20260425'
        };

        const row = getDailyStreakEthicsRow(save, Date.UTC(2026, 3, 26, 1));
        expect(row.currentStreak).toBe(2);
        expect(row.freezePolicy).toBe('one_grace_day_v1');
        expect(row.missedDayRule).toMatch(/forgiven|optional|starts again/i);
        expect(row.rewardCopy).toMatch(/cosmetic/i);
        expect(row.utcResetKey).toBe('20260426');
    });
});
