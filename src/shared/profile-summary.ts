import { getDailyArchiveSummary } from './daily-archive';
import { FEATURE_CLOUD_SAVE } from './feature-flags';
import { countEligibleHonors } from './honorUnlocks';
import { getMetaProgressionBoard, getMetaProgressionFeedback } from './meta-progression';
import { buildRunJournalRowsFromSave } from './run-history';
import type { SaveData } from './contracts';

export type CloudSyncState = 'not_available' | 'available';

export interface ProfileSaveShellSummary {
    profileScope: 'single_local_profile';
    profileLevel: number;
    honorMarks: number;
    honorsEarned: number;
    difficultyTierLabel: string;
    honorMarksToNextLevel: number;
    nextMilestoneLabel: string | null;
    nextMilestoneProgressCopy: string;
    nextRewardTitle: string | null;
    nextRewardProgressCopy: string | null;
    nextHonorMarkSourceCopy: string | null;
    progressionMotivationCopy: string;
    cosmeticOwned: number;
    runHistoryEntries: number;
    dailyStreak: number;
    saveLocationCopy: string;
    cloudSyncState: CloudSyncState;
    cloudSyncCopy: string;
    exportCopy: string;
    importCopy: string;
    resetCopy: string;
}

export interface ProfileSummaryRow {
    id: 'profile_level' | 'honor_marks' | 'best_score' | 'cosmetics' | 'history' | 'daily_streak';
    label: string;
    value: string;
    source: string;
}

export interface SaveTrustRow {
    id: 'slot_scope' | 'cloud_sync' | 'export_import' | 'backup' | 'reset';
    label: string;
    status: 'active' | 'not_available' | 'deferred' | 'manual';
    description: string;
}

export const buildProfileSaveShellSummary = (
    save: SaveData,
    { cloudSaveAvailable = FEATURE_CLOUD_SAVE }: { cloudSaveAvailable?: boolean } = {}
): ProfileSaveShellSummary => {
    const board = getMetaProgressionBoard(save);
    const progression = getMetaProgressionFeedback(save);
    const daily = getDailyArchiveSummary(save);
    return {
        profileScope: 'single_local_profile',
        profileLevel: board.level,
        honorMarks: board.summary.honorMarks,
        honorsEarned: countEligibleHonors(save),
        difficultyTierLabel: progression.difficultyTierLabel,
        honorMarksToNextLevel: progression.honorMarksToNextLevel,
        nextMilestoneLabel: progression.nextMilestone?.label ?? null,
        nextMilestoneProgressCopy: progression.nextMilestoneCopy,
        nextRewardTitle: progression.nextReward?.title ?? null,
        nextRewardProgressCopy: progression.nextReward?.progressCopy ?? null,
        nextHonorMarkSourceCopy: progression.nextHonorMarkSource?.nextMarkCopy ?? null,
        progressionMotivationCopy: progression.motivationCopy,
        cosmeticOwned: board.summary.cosmeticOwned,
        runHistoryEntries: buildRunJournalRowsFromSave(save).length,
        dailyStreak: daily.streak,
        saveLocationCopy: 'Single local profile on this device. Steam/cloud sync is not required for v1.',
        cloudSyncState: cloudSaveAvailable ? 'available' : 'not_available',
        cloudSyncCopy: cloudSaveAvailable
            ? 'Platform cloud sync is available for this profile.'
            : 'Cloud sync is not available in this build; backups are local/export-only.',
        exportCopy: 'Export/share strings contain local progress summaries only; no account or PII is required.',
        importCopy: 'Import is reserved for compatible local save payloads and must pass schema migration gates.',
        resetCopy: 'Reset settings is non-destructive; full profile deletion requires an explicit confirmation flow and is not enabled in this release shell.'
    };
};

export const getProfileSummaryRows = (save: SaveData): ProfileSummaryRow[] => {
    const summary = buildProfileSaveShellSummary(save);
    return [
        { id: 'profile_level', label: 'Profile level', value: String(summary.profileLevel), source: 'Honor marks' },
        { id: 'honor_marks', label: 'Honor marks', value: String(summary.honorMarks), source: 'Achievements/dailies/mastery' },
        { id: 'best_score', label: 'Best score', value: save.bestScore.toLocaleString('en-US'), source: 'SaveData.bestScore' },
        { id: 'cosmetics', label: 'Cosmetics owned', value: String(summary.cosmeticOwned), source: 'unlock tags' },
        { id: 'history', label: 'Run history rows', value: String(summary.runHistoryEntries), source: 'last run journal' },
        { id: 'daily_streak', label: 'Daily streak', value: String(summary.dailyStreak), source: 'playerStats.dailyStreakCosmetic' }
    ];
};

export const getSaveTrustRows = (
    save: SaveData,
    options: { cloudSaveAvailable?: boolean } = {}
): SaveTrustRow[] => {
    const summary = buildProfileSaveShellSummary(save, options);
    return [
        {
            id: 'slot_scope',
            label: 'Single local profile',
            status: 'active',
            description: summary.saveLocationCopy
        },
        {
            id: 'cloud_sync',
            label: 'Cloud sync',
            status: summary.cloudSyncState === 'available' ? 'active' : 'deferred',
            description: summary.cloudSyncCopy
        },
        {
            id: 'export_import',
            label: 'Export / import',
            status: 'manual',
            description: `${summary.exportCopy} ${summary.importCopy}`
        },
        {
            id: 'backup',
            label: 'Backups',
            status: 'manual',
            description: 'Use local/platform file backups until a first-class backup browser ships.'
        },
        {
            id: 'reset',
            label: 'Reset boundaries',
            status: 'manual',
            description: summary.resetCopy
        }
    ];
};
