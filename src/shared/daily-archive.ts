import type { SaveData } from './contracts';
import { getDailyStreakEthicsState } from './save-data';

export type DailyArchiveScope = 'daily' | 'weekly' | 'season';

export interface DailyArchiveIdentity {
    scope: DailyArchiveScope;
    key: string;
    archiveType?: DailyArchiveScope;
    archiveKey?: string;
    status?: 'completed' | 'active';
    title: string;
    description: string;
    localOnly: true;
    onlineLeaderboardDeferred: true;
    comparisonString: string;
    sourceFields: string[];
}

export interface DailyArchiveSummary {
    rows: DailyArchiveIdentity[];
    dailiesCompleted: number;
    completedDailies?: number;
    streak: number;
    currentStreak?: number;
    lastDailyDateKeyUtc: string | null;
    offlineOnly: true;
    onlineRequired?: false;
}

export interface DailyResultsLoopRow {
    scope: DailyArchiveScope;
    key: string;
    title: string;
    currentAttempt: string;
    personalBest: string;
    shareString: string;
    repeatAttemptRule: string;
    localOnly: true;
    onlineLeaderboardDeferred: true;
}

export interface DailyStreakEthicsRow {
    id: 'current_streak' | 'next_reset' | 'missed_day' | 'reward_limit';
    label: string;
    value: string;
    description: string;
    ethicalTone: 'low_pressure';
    localOnly: true;
}

export interface DailyStreakEthicsSummary {
    currentStreak: number;
    freezePolicy: 'not_supported_v1';
    missedDayRule: string;
    rewardCopy: string;
    utcResetKey: string;
}

const parseDateKeyUtc = (dateKey: string | null | undefined): Date | null => {
    if (!dateKey || !/^\d{8}$/.test(dateKey)) {
        return null;
    }
    const year = Number(dateKey.slice(0, 4));
    const month = Number(dateKey.slice(4, 6)) - 1;
    const day = Number(dateKey.slice(6, 8));
    const date = new Date(Date.UTC(year, month, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
        ? date
        : null;
};

const formatDateKey = (date: Date): string =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;

const dateFromTimestampMs = (timestampMs: number): Date => {
    const date = new Date(timestampMs);
    if (Number.isFinite(date.getTime())) {
        return date;
    }
    const fallback = new Date(Date.now());
    return Number.isFinite(fallback.getTime()) ? fallback : new Date(0);
};

const isoWeekKey = (date: Date | null): string => {
    if (!date) {
        return 'week:none';
    }
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const seasonKey = (date: Date | null): string => {
    if (!date) {
        return 'season:none';
    }
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${date.getUTCFullYear()}-S${quarter}`;
};

export const dailyArchiveDateKeyForTimestamp = (timestampMs: number): string =>
    formatDateKey(dateFromTimestampMs(timestampMs));

export const weekKeyForDaily = (dateKey: string): string => isoWeekKey(parseDateKeyUtc(dateKey));

export const seasonKeyForDaily = (dateKey: string): string => seasonKey(parseDateKeyUtc(dateKey));

export const getDailyArchiveSummary = (save: SaveData, nowMs: number = Date.now()): DailyArchiveSummary => {
    const ps = save.playerStats;
    const completed = ps?.dailiesCompleted ?? 0;
    const streak = ps?.dailyStreakCosmetic ?? 0;
    const lastKey = ps?.lastDailyDateKeyUtc ?? null;
    const lastDate = parseDateKeyUtc(lastKey);
    const validLastKey = lastDate ? lastKey : null;
    const todayKey = dailyArchiveDateKeyForTimestamp(nowMs);
    const effectiveDate = lastDate ?? parseDateKeyUtc(todayKey);
    const rows: DailyArchiveIdentity[] = [
        {
            scope: 'daily',
            key: validLastKey ?? todayKey,
            archiveType: 'daily',
            archiveKey: validLastKey ?? todayKey,
            status: completed > 0 ? 'completed' : 'active',
            title: 'Daily archive',
            description: 'Local UTC daily identity and completion count.',
            localOnly: true,
            onlineLeaderboardDeferred: true,
            comparisonString:
                completed > 0
                    ? `Last daily ${validLastKey ?? 'unknown'} · ${completed} local clears · streak ${streak}`
                    : `Today ${todayKey} · no local clear recorded yet`,
            sourceFields: ['playerStats.dailiesCompleted', 'playerStats.lastDailyDateKeyUtc', 'playerStats.dailyStreakCosmetic']
        },
        {
            scope: 'weekly',
            key: isoWeekKey(effectiveDate),
            archiveType: 'weekly',
            archiveKey: isoWeekKey(effectiveDate),
            status: completed > 0 ? 'completed' : 'active',
            title: 'Weekly archive',
            description: 'Derived from UTC daily keys; stores no online season authority.',
            localOnly: true,
            onlineLeaderboardDeferred: true,
            comparisonString: `${isoWeekKey(effectiveDate)} · ${completed} cumulative local daily clears`,
            sourceFields: ['playerStats.lastDailyDateKeyUtc', 'playerStats.dailiesCompleted']
        },
        {
            scope: 'season',
            key: seasonKey(effectiveDate),
            archiveType: 'season',
            archiveKey: seasonKey(effectiveDate),
            status: completed > 0 ? 'completed' : 'active',
            title: 'Season archive',
            description: 'Offline season label for local journaling and future export strings.',
            localOnly: true,
            onlineLeaderboardDeferred: true,
            comparisonString: `${seasonKey(effectiveDate)} · streak ${streak} · online boards deferred`,
            sourceFields: ['playerStats.dailyStreakCosmetic', 'docs/LEADERBOARDS_DEFERRAL.md']
        }
    ];
    return {
        rows,
        dailiesCompleted: completed,
        completedDailies: completed,
        streak,
        currentStreak: streak,
        lastDailyDateKeyUtc: validLastKey,
        offlineOnly: true,
        onlineRequired: false
    };
};

export const getDailyArchiveRows = (save: SaveData, nowMs: number = Date.now()): DailyArchiveIdentity[] =>
    getDailyArchiveSummary(save, nowMs).rows;

export const buildDailyArchiveShareString = (save: SaveData): string => {
    const summary = getDailyArchiveSummary(save);
    const daily = summary.rows[0]!;
    const last = save.lastRunSummary;
    const score = last?.gameMode === 'daily' ? ` · ${last.totalScore} pts · ${last.levelsCleared} clear(s)` : '';
    return `Daily ${daily.key}${score} · ${summary.dailiesCompleted} local-only daily clear(s) · streak ${summary.streak}`;
};

export const buildDailyResultsShareString = (
    save: SaveData,
    scope: Extract<DailyArchiveScope, 'daily' | 'weekly'>,
    nowMs: number = Date.now()
): string => {
    if (scope === 'daily') {
        return buildDailyArchiveShareString(save);
    }
    const summary = getDailyArchiveSummary(save, nowMs);
    const weekly = summary.rows.find((row) => row.scope === 'weekly')!;
    return `Weekly ${weekly.key} · ${summary.dailiesCompleted} local daily clear(s) · streak ${summary.streak}`;
};

export const buildDailyResultsLoopRows = (save: SaveData, nowMs: number = Date.now()): DailyResultsLoopRow[] => {
    const summary = getDailyArchiveSummary(save, nowMs);
    const last = save.lastRunSummary;
    const dailyScore = last?.gameMode === 'daily' ? last.totalScore : null;
    const dailyFloor = last?.gameMode === 'daily' ? last.highestLevel : null;

    return summary.rows
        .filter((row): row is DailyArchiveIdentity & { scope: 'daily' | 'weekly' } => row.scope === 'daily' || row.scope === 'weekly')
        .map((row) => {
            const currentAttempt =
                row.scope === 'daily' && dailyScore !== null
                    ? `${dailyScore} score · floor ${dailyFloor ?? 0} · ${last?.levelsCleared ?? 0} clear(s)`
                    : 'No current local attempt recorded for this window';
            const personalBest =
                row.scope === 'daily'
                    ? `${save.bestScore} all-mode best · ${summary.dailiesCompleted} daily clear(s)`
                    : `${summary.dailiesCompleted} cumulative daily clear(s) this local profile`;
            const shareString = buildDailyResultsShareString(save, row.scope, nowMs);

            return {
                scope: row.scope,
                key: row.key,
                title: row.scope === 'daily' ? 'Daily result loop' : 'Weekly rollup',
                currentAttempt,
                personalBest,
                shareString,
                repeatAttemptRule:
                    'Repeat attempts update local history and share strings only; online leaderboard submission is deferred for v1.',
                localOnly: true,
                onlineLeaderboardDeferred: true
            };
        });
};

export const getDailyResultsLoopRows = buildDailyResultsLoopRows;

export const getDailyStreakEthicsRows = (save: SaveData, nowMs: number = Date.now()): DailyStreakEthicsRow[] => {
    const summary = getDailyStreakEthicsRow(save, nowMs);
    const archive = getDailyArchiveSummary(save, nowMs);
    return [
        {
            id: 'current_streak',
            label: 'Current streak',
            value: String(summary.currentStreak),
            description: 'Cosmetic UTC-day streak from local Daily Challenge clears.',
            ethicalTone: 'low_pressure',
            localOnly: true
        },
        {
            id: 'next_reset',
            label: 'Next reset',
            value: archive.rows[0]?.key ?? 'today',
            description: 'Daily identity uses UTC midnight, not local timezone pressure.',
            ethicalTone: 'low_pressure',
            localOnly: true
        },
        {
            id: 'missed_day',
            label: 'Missed-day rule',
            value: summary.missedDayRule,
            description: 'Missed days reset the cosmetic streak; no penalty blocks Classic or core progression.',
            ethicalTone: 'low_pressure',
            localOnly: true
        },
        {
            id: 'reward_limit',
            label: 'Reward limit',
            value: summary.rewardCopy,
            description: 'Rewards are profile/honor motivation and never required for run fairness.',
            ethicalTone: 'low_pressure',
            localOnly: true
        }
    ];
};

export const getDailyStreakEthicsRow = (save: SaveData, nowMs: number = Date.now()): DailyStreakEthicsSummary => {
    const todayKey = dailyArchiveDateKeyForTimestamp(nowMs);
    const state = getDailyStreakEthicsState(save, todayKey);
    return {
        currentStreak: state.currentStreak,
        freezePolicy: 'not_supported_v1',
        missedDayRule:
            state.missedDayBehavior === 'reset_to_one_on_next_completion'
                ? 'Missed days reset the cosmetic streak only; no core fairness is lost.'
                : 'Optional UTC streak; no pressure or penalty.',
        rewardCopy: 'Rewards are cosmetic/profile motivation only, never required for core run fairness.',
        utcResetKey: state.nextResetUtcKey
    };
};
