import type { SaveData } from './contracts';
import {
    getMetaProgressionDifficultyTierLabel,
    getMetaProgressionFeedback,
    type MetaProgressionDifficultyTier
} from './meta-progression';
import { runNonNegativeInteger } from './run-number-guards';
import { RUN_MODE_CATALOG, type RunModeDefinition } from './run-mode-catalog';

export type ChallengeGateStatus = 'available' | 'locked' | 'deferred';
export type ChallengeGateId =
    | 'classic_open'
    | 'daily_local_seed'
    | 'gauntlet_local_timer'
    | 'puzzle_library'
    | 'wild_lab'
    | 'contract_training'
    | 'meditation_training'
    | 'endless_deferred';

export interface ChallengeModeGateRow {
    modeId: string;
    title: string;
    gateId: ChallengeGateId;
    status: ChallengeGateStatus;
    entryCondition: string;
    lockoutReason: string | null;
    progress: { current: number; target: number };
    saveFields: string[];
    offlineOnly: true;
    onlineRequired: false;
    qaRoute: string;
}

const puzzleCompleted = (save: SaveData, puzzleId: string): boolean =>
    save.playerStats?.puzzleCompletions?.[puzzleId]?.completed === true;

const gateIdForMode = (mode: RunModeDefinition): ChallengeGateId => {
    if (mode.id === 'classic') return 'classic_open';
    if (mode.id === 'daily') return 'daily_local_seed';
    if (mode.id === 'gauntlet') return 'gauntlet_local_timer';
    if (mode.id.startsWith('puzzle_')) return 'puzzle_library';
    if (mode.id === 'wild') return 'wild_lab';
    if (mode.id === 'scholar' || mode.id === 'pin_vow') return 'contract_training';
    if (mode.id === 'meditation' || mode.id === 'practice') return 'meditation_training';
    return 'endless_deferred';
};

const rowForMode = (save: SaveData, mode: RunModeDefinition): ChallengeModeGateRow => {
    const firstClear = save.achievements.ACH_FIRST_CLEAR ? 1 : 0;
    const dailies = runNonNegativeInteger(save.playerStats?.dailiesCompleted);
    const starterPuzzleDone = puzzleCompleted(save, 'starter_pairs') ? 1 : 0;
    const gateId = gateIdForMode(mode);

    if (mode.id === 'endless') {
        return {
            modeId: mode.id,
            title: mode.title,
            gateId,
            status: 'deferred',
            entryCondition: 'Deferred v1 mode: Classic owns playable endless-style progression.',
            lockoutReason: 'Future ultra-long balance pass; no online gate is required.',
            progress: { current: 0, target: 1 },
            saveFields: ['none'],
            offlineOnly: true,
            onlineRequired: false,
            qaRoute: 'Assert card is locked and Classic remains playable.'
        };
    }

    if (mode.id === 'gauntlet') {
        return {
            modeId: mode.id,
            title: mode.title,
            gateId,
            status: firstClear >= 1 ? 'available' : 'locked',
            entryCondition: 'Clear any local floor once to unlock timed challenge presets.',
            lockoutReason: firstClear >= 1 ? null : 'First clear not completed yet.',
            progress: { current: firstClear, target: 1 },
            saveFields: ['achievements.ACH_FIRST_CLEAR'],
            offlineOnly: true,
            onlineRequired: false,
            qaRoute: 'Toggle ACH_FIRST_CLEAR in local save; Gauntlet gate should flip to available.'
        };
    }

    if (mode.id === 'puzzle_glyph_cross') {
        return {
            modeId: mode.id,
            title: mode.title,
            gateId,
            status: starterPuzzleDone >= 1 ? 'available' : 'locked',
            entryCondition: 'Complete Starter Pairs locally before the advanced Glyph Cross puzzle.',
            lockoutReason: starterPuzzleDone >= 1 ? null : 'Starter Pairs puzzle completion missing.',
            progress: { current: starterPuzzleDone, target: 1 },
            saveFields: ['playerStats.puzzleCompletions.starter_pairs.completed'],
            offlineOnly: true,
            onlineRequired: false,
            qaRoute: 'Mark starter_pairs completed in SaveData; advanced puzzle gate should unlock.'
        };
    }

    if (mode.id === 'daily') {
        return {
            modeId: mode.id,
            title: mode.title,
            gateId,
            status: 'available',
            entryCondition: 'Available offline; UTC date derives the local seed.',
            lockoutReason: null,
            progress: { current: Math.min(dailies, 1), target: 1 },
            saveFields: ['playerStats.dailiesCompleted', 'playerStats.lastDailyDateKeyUtc'],
            offlineOnly: true,
            onlineRequired: false,
            qaRoute: 'Start Daily with network disabled; seed and countdown still resolve locally.'
        };
    }

    return {
        modeId: mode.id,
        title: mode.title,
        gateId,
        status: mode.availability === 'locked' ? 'locked' : 'available',
        entryCondition: 'Available from local mode select in v1.',
        lockoutReason: mode.availability === 'locked' ? (mode.availabilityDetail ?? 'Mode locked.') : null,
        progress: { current: mode.availability === 'locked' ? 0 : 1, target: 1 },
        saveFields: mode.id === 'scholar' || mode.id === 'pin_vow' ? ['activeContract at run start'] : ['none'],
        offlineOnly: true,
        onlineRequired: false,
        qaRoute: 'Open Choose Your Path and verify action availability matches this row.'
    };
};

export const getChallengeModeGateRows = (save: SaveData): ChallengeModeGateRow[] =>
    RUN_MODE_CATALOG.map((mode) => rowForMode(save, mode));

export const getChallengeModeGateRow = (
    save: SaveData,
    modeId: string
): ChallengeModeGateRow | undefined => getChallengeModeGateRows(save).find((row) => row.modeId === modeId);

export const challengeGateSummary = (
    save: SaveData
): { total: number; available: number; locked: number; deferred: number; onlineRequired: false } => {
    const rows = getChallengeModeGateRows(save);
    return {
        total: rows.length,
        available: rows.filter((row) => row.status === 'available').length,
        locked: rows.filter((row) => row.status === 'locked').length,
        deferred: rows.filter((row) => row.status === 'deferred').length,
        onlineRequired: false
    };
};

export type ChallengeProgressionStatus = 'unlocked' | 'in_progress' | 'locked' | 'deferred';

export type ChallengeModeProgressionRow = Omit<ChallengeModeGateRow, 'status'> & {
    status: ChallengeProgressionStatus;
    lockReason: string | null;
    recommendedTier: MetaProgressionDifficultyTier;
    recommendedTierLabel: string;
    motivationCopy: string;
};

const progressionModeIds = ['daily', 'gauntlet', 'puzzle_glyph_cross', 'scholar', 'pin_vow'] as const;

const challengeTierRank: Record<MetaProgressionDifficultyTier, number> = {
    initiate: 0,
    adept: 1,
    ascendant: 2,
    legend: 3
};

const recommendedTierByModeId: Record<(typeof progressionModeIds)[number], MetaProgressionDifficultyTier> = {
    daily: 'initiate',
    gauntlet: 'adept',
    puzzle_glyph_cross: 'adept',
    scholar: 'ascendant',
    pin_vow: 'ascendant'
};

const progressionStatus = (row: ChallengeModeGateRow): ChallengeProgressionStatus =>
    row.status === 'available'
        ? 'unlocked'
        : row.status === 'deferred'
          ? 'deferred'
          : row.modeId === 'puzzle_glyph_cross' || row.progress.current > 0
            ? 'in_progress'
            : 'locked';

const challengeMotivationCopy = (row: ChallengeModeGateRow, status: ChallengeProgressionStatus): string => {
    if (status === 'unlocked') {
        return `${row.title} is ready for local play.`;
    }
    if (status === 'in_progress') {
        return `${row.title}: ${row.progress.current}/${row.progress.target} toward ${row.entryCondition}`;
    }
    if (status === 'deferred') {
        return row.lockoutReason ?? `${row.title} is deferred in this build.`;
    }
    return row.lockoutReason ?? `${row.title} is locked.`;
};

export const getChallengeModeProgressionRows = (save: SaveData): ChallengeModeProgressionRow[] =>
    progressionModeIds.map((modeId) => {
        const row = getChallengeModeGateRow(save, modeId)!;
        const recommendedTier = recommendedTierByModeId[modeId];
        const status = progressionStatus(row);
        return {
            ...row,
            status,
            lockReason: row.lockoutReason,
            recommendedTier,
            recommendedTierLabel: getMetaProgressionDifficultyTierLabel(recommendedTier),
            motivationCopy: challengeMotivationCopy(row, status)
        };
    });

export const getChallengeModeGateForMode = (
    save: SaveData,
    modeId: string
): ChallengeModeProgressionRow | undefined => {
    const row = getChallengeModeGateRow(save, modeId);
    const progressionModeId = progressionModeIds.find((id) => id === modeId);
    const recommendedTier = progressionModeId ? recommendedTierByModeId[progressionModeId] : 'initiate';
    const status = row ? progressionStatus(row) : 'locked';
    return row
        ? {
              ...row,
              status,
              lockReason: row.lockoutReason,
              recommendedTier,
              recommendedTierLabel: getMetaProgressionDifficultyTierLabel(recommendedTier),
              motivationCopy: challengeMotivationCopy(row, status)
          }
        : undefined;
};

export interface ChallengeModeMotivationSummary {
    profileTier: MetaProgressionDifficultyTier;
    profileTierLabel: string;
    activeRows: ChallengeModeProgressionRow[];
    nextRecommendedRow: ChallengeModeProgressionRow | null;
    nextChallengeCopy: string;
}

const tierArticle = (label: string): 'a' | 'an' => (/^[aeiou]/i.test(label) ? 'an' : 'a');

export const getChallengeModeMotivationSummary = (save: SaveData): ChallengeModeMotivationSummary => {
    const feedback = getMetaProgressionFeedback(save);
    const rows = getChallengeModeProgressionRows(save);
    const profileTierRank = challengeTierRank[feedback.difficultyTier];
    const activeRows = rows.filter(
        (row) => row.status === 'unlocked' && challengeTierRank[row.recommendedTier] <= profileTierRank
    );
    const nextRecommendedRow =
        rows.find((row) => row.status !== 'unlocked' && challengeTierRank[row.recommendedTier] <= profileTierRank) ??
        rows.find((row) => challengeTierRank[row.recommendedTier] > profileTierRank) ??
        rows.find((row) => row.status !== 'unlocked') ??
        null;
    const nextChallengeCopy = nextRecommendedRow
        ? `${nextRecommendedRow.title} sits as ${tierArticle(nextRecommendedRow.recommendedTierLabel)} ${nextRecommendedRow.recommendedTierLabel} goal; ${nextRecommendedRow.motivationCopy}`
        : 'All visible challenge lanes are in the active profile tier.';

    return {
        profileTier: feedback.difficultyTier,
        profileTierLabel: feedback.difficultyTierLabel,
        activeRows,
        nextRecommendedRow,
        nextChallengeCopy
    };
};
