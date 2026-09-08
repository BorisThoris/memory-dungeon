import type { SaveData } from './contracts';
import {
    getMetaProgressionDifficultyTierLabel,
    getMetaProgressionFeedback,
    type MetaProgressionDifficultyTier
} from './meta-progression';
import { getRunModeCatalog, type RunModeDefinition } from './run-mode-catalog';

export type ChallengeGateStatus = 'available' | 'locked' | 'deferred';
export type ChallengeGateId = 'classic_open' | 'same_device_table' | 'local_mode_select';

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

/**
 * Which gate a mode sits behind.
 *
 * The fall-through used to be `endless_deferred`, which is not a default — it is the id meaning
 * "the deferred ultra-long mode". Every mode this list did not name inherited it, so adding
 * pass-and-play silently labelled a shipped, unlocked, same-device mode as the one thing in the
 * catalog that cannot be played. A mode nobody has classified is on local mode select like every
 * other v1 mode; say that instead, and let `endless_deferred` mean only what it says.
 */
const gateIdForMode = (mode: RunModeDefinition): ChallengeGateId => {
    if (mode.id === 'classic') return 'classic_open';
    if (mode.id === 'pass_and_play') return 'same_device_table';
    return 'local_mode_select';
};

const rowForMode = (_save: SaveData, mode: RunModeDefinition): ChallengeModeGateRow => {
    const gateId = gateIdForMode(mode);

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
    getRunModeCatalog().map((mode) => rowForMode(save, mode));

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

/**
 * The lanes a player progresses through, now that every preset is a Classic setup option rather
 * than a mode: the one mode, and the table.
 */
const progressionModeIds = ['classic', 'pass_and_play'] as const;

const challengeTierRank: Record<MetaProgressionDifficultyTier, number> = {
    initiate: 0,
    adept: 1,
    ascendant: 2,
    legend: 3
};

const recommendedTierByModeId: Record<(typeof progressionModeIds)[number], MetaProgressionDifficultyTier> = {
    classic: 'initiate',
    pass_and_play: 'adept'
};

const progressionStatus = (row: ChallengeModeGateRow): ChallengeProgressionStatus =>
    row.status === 'available'
        ? 'unlocked'
        : row.status === 'deferred'
          ? 'deferred'
          : row.progress.current > 0
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
