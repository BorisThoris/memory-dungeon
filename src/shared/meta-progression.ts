import { getAchievementProgressSummary } from './achievements';
import type { SaveData } from './contracts';
import {
    COSMETIC_CATALOG,
    cosmeticIsOwned,
    cosmeticUnlockTag,
    deriveCosmeticStates,
    getCosmeticCatalogRows,
    type CosmeticId
} from './cosmetics';
import { countEligibleHonors } from './honorUnlocks';
import { getRelicPickTotal, normalizeSaveData } from './save-data';

export type MetaProgressionTrack = 'permanent_upgrade' | 'cosmetic';
export type MetaProgressionStatus = 'owned' | 'available' | 'locked';
export type LegacyMetaProgressionStatus = 'unlocked' | 'in_progress' | 'locked' | 'owned';
export type MetaCurrencyId = 'honor_marks';
export type MetaUpgradeModeRule = 'disabled_in_daily' | 'visible_in_classic' | 'cosmetic_only';

export interface MetaProgressionRow {
    id: string;
    track: MetaProgressionTrack;
    title: string;
    description: string;
    status: MetaProgressionStatus;
    progress: { current: number; target: number };
    reward: string;
    currencyId: MetaCurrencyId;
    cost: number;
    gameplayAffecting: boolean;
    localOnly: true;
    unlockTag?: string;
    gate: string;
    source: string;
    modeRule: MetaUpgradeModeRule;
}

export interface PermanentUpgradeRow {
    id: 'relic_shrine_extra_pick' | 'ascendant_title_track' | 'daily_cosmetic_track';
    title: string;
    status: LegacyMetaProgressionStatus;
    offlineOnly: true;
    payToSkip: false;
    progress: { current: number; target: number };
    reward: string;
}

export interface CosmeticTrackRow {
    trackId: 'starter' | 'daily' | 'mastery' | 'relic';
    cosmeticId: CosmeticId;
    label: string;
    status: LegacyMetaProgressionStatus;
    owned: number;
    progress: { current: number; target: number };
    gameplayAffecting: false;
}

export interface MetaProgressionSummary {
    honorMarks: number;
    honorsEarned: number;
    owned: number;
    available: number;
    locked: number;
    gameplayUpgradesOwned: number;
    cosmeticOwned: number;
}

export type MetaHonorMarkSourceId = 'achievements' | 'daily_archive' | 'no_powers_mastery' | 'relic_mastery';

export interface MetaHonorMarkSourceRow {
    id: MetaHonorMarkSourceId;
    label: string;
    marks: number;
    cap: number | null;
    progress: { current: number; target: number };
    nextMarkCopy: string | null;
    nextMarkUnitsRemaining: number | null;
}

export interface MetaProgressionBoard {
    level: number;
    levelProgress: { current: number; target: number };
    nextReward: MetaProgressionRow | null;
    longTermGoal: MetaProgressionRow | null;
    rows: MetaProgressionRow[];
    summary: MetaProgressionSummary;
}

export type MetaProgressionUnlockReason = 'applied' | 'already_owned' | 'locked' | 'unknown_row' | 'deferred';

export interface MetaProgressionUnlockResult {
    save: SaveData;
    row: MetaProgressionRow | null;
    applied: boolean;
    reason: MetaProgressionUnlockReason;
    feedbackCopy: string;
}

export type MetaProgressionDifficultyTier = 'initiate' | 'adept' | 'ascendant' | 'legend';
export type MetaProgressionMilestoneStatus = 'reached' | 'current' | 'upcoming';

export interface MetaProgressionRewardFeedback {
    id: string;
    title: string;
    status: MetaProgressionStatus;
    progressCopy: string;
    source: string;
    modeRule: MetaUpgradeModeRule;
}

export interface MetaProgressionFeedback {
    profileLevel: number;
    difficultyTier: MetaProgressionDifficultyTier;
    difficultyTierLabel: string;
    honorMarks: number;
    honorMarksToNextLevel: number;
    nextReward: MetaProgressionRewardFeedback | null;
    longTermGoal: MetaProgressionRewardFeedback | null;
    honorMarkSources: MetaHonorMarkSourceRow[];
    nextHonorMarkSource: MetaHonorMarkSourceRow | null;
    nextMilestone: MetaProgressionMilestoneRow | null;
    nextMilestoneCopy: string;
    motivationCopy: string;
}

export interface MetaProgressionMilestoneRow {
    level: number;
    tier: MetaProgressionDifficultyTier;
    label: string;
    status: MetaProgressionMilestoneStatus;
    marksRequired: number;
    marksRemaining: number;
    progress: { current: number; target: number };
    reward: string;
}

const nonNegativeMetaProgressionCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const META_MARKS_PER_LEVEL = 5;

const META_PROGRESS_MILESTONES: Array<{
    level: number;
    tier: MetaProgressionDifficultyTier;
    reward: string;
}> = [
    { level: 1, tier: 'initiate', reward: 'Profile ladder opened' },
    { level: 3, tier: 'adept', reward: 'Adept-tier challenge focus' },
    { level: 5, tier: 'ascendant', reward: 'Ascendant mastery identity' },
    { level: 8, tier: 'legend', reward: 'Legend long-run prestige target' }
];

export const getMetaHonorMarkSourceRows = (save: SaveData): MetaHonorMarkSourceRow[] => {
    const achievementProgress = getAchievementProgressSummary(save.achievements);
    const dailies = Math.min(7, nonNegativeMetaProgressionCount(save.playerStats?.dailiesCompleted));
    const noPowers = Math.min(5, nonNegativeMetaProgressionCount(save.playerStats?.bestFloorNoPowers));
    const relics = Math.min(10, getRelicPickTotal(save.playerStats?.relicPickCounts));
    const relicsToNextMark = relics >= 10 ? null : relics % 2 === 0 ? 2 : 1;
    return [
        {
            id: 'achievements',
            label: 'Achievements',
            marks: achievementProgress.earned * 2,
            cap: achievementProgress.total * 2,
            progress: { current: achievementProgress.earned, target: achievementProgress.total },
            nextMarkCopy: achievementProgress.earned < achievementProgress.total ? 'Earn one more achievement for 2 honor marks.' : null,
            nextMarkUnitsRemaining: achievementProgress.earned < achievementProgress.total ? 1 : null
        },
        {
            id: 'daily_archive',
            label: 'Daily archive',
            marks: dailies,
            cap: 7,
            progress: { current: dailies, target: 7 },
            nextMarkCopy: dailies < 7 ? 'Clear one more Daily Challenge for 1 honor mark.' : null,
            nextMarkUnitsRemaining: dailies < 7 ? 1 : null
        },
        {
            id: 'no_powers_mastery',
            label: 'No-powers mastery',
            marks: noPowers,
            cap: 5,
            progress: { current: noPowers, target: 5 },
            nextMarkCopy: noPowers < 5 ? 'Raise your best no-powers floor by 1 for 1 honor mark.' : null,
            nextMarkUnitsRemaining: noPowers < 5 ? 1 : null
        },
        {
            id: 'relic_mastery',
            label: 'Relic mastery',
            marks: Math.floor(relics / 2),
            cap: 5,
            progress: { current: relics, target: 10 },
            nextMarkCopy:
                relicsToNextMark === null
                    ? null
                    : `Pick ${relicsToNextMark} more relic${relicsToNextMark === 1 ? '' : 's'} for 1 honor mark.`,
            nextMarkUnitsRemaining: relicsToNextMark
        }
    ];
};

export const getMetaHonorMarks = (save: SaveData): number =>
    getMetaHonorMarkSourceRows(save).reduce((sum, source) => sum + source.marks, 0);

export const getNextMetaHonorMarkSource = (save: SaveData): MetaHonorMarkSourceRow | null =>
    getMetaHonorMarkSourceRows(save)
        .filter((source) => source.nextMarkUnitsRemaining !== null)
        .sort((a, b) => {
            const remainingA = a.nextMarkUnitsRemaining ?? Number.POSITIVE_INFINITY;
            const remainingB = b.nextMarkUnitsRemaining ?? Number.POSITIVE_INFINITY;
            if (remainingA !== remainingB) {
                return remainingA - remainingB;
            }
            return b.progress.current - a.progress.current;
        })[0] ?? null;

const statusForProgress = (current: number, target: number, owned: boolean): MetaProgressionStatus => {
    if (owned) {
        return 'owned';
    }
    return current >= target ? 'available' : 'locked';
};

const lockedStatusForProgress = (current: number, target: number, owned: boolean, enabled: boolean): MetaProgressionStatus =>
    enabled ? statusForProgress(current, target, owned) : owned ? 'owned' : 'locked';

export const getPermanentUpgradeRows = (save: SaveData): MetaProgressionRow[] => {
    const dailies = nonNegativeMetaProgressionCount(save.playerStats?.dailiesCompleted);
    const bestNoPowers = nonNegativeMetaProgressionCount(save.playerStats?.bestFloorNoPowers);
    return [
        {
            id: 'upgrade_relic_shrine_extra_pick',
            track: 'permanent_upgrade',
            title: 'Week of Archives',
            description: 'Permanent local upgrade: +1 relic selection at each milestone shrine.',
            status: statusForProgress(dailies, 7, save.playerStats?.relicShrineExtraPickUnlocked === true),
            progress: { current: Math.min(dailies, 7), target: 7 },
            reward: '+1 relic pick per milestone',
            currencyId: 'honor_marks',
            cost: 7,
            gameplayAffecting: true,
            localOnly: true,
            gate: 'Clear seven Daily Challenge floors. No online account required.',
            source: 'Daily archive completions',
            modeRule: 'disabled_in_daily'
        },
        {
            id: 'upgrade_scholar_prep_slot',
            track: 'permanent_upgrade',
            title: 'Scholar Prep Slot',
            description: 'Future permanent upgrade slot; visible for planning but locked until the balance pass ships.',
            status: lockedStatusForProgress(bestNoPowers, 8, false, false),
            progress: { current: Math.min(bestNoPowers, 8), target: 8 },
            reward: 'Future pre-run assist slot',
            currencyId: 'honor_marks',
            cost: 12,
            gameplayAffecting: true,
            localOnly: true,
            gate: 'Deferred: requires REG-016 feature flag and balance pass before enabling.',
            source: 'No-powers mastery',
            modeRule: 'visible_in_classic'
        }
    ];
};

export const getMetaCosmeticTrackRows = (save: SaveData): MetaProgressionRow[] =>
    getCosmeticCatalogRows()
        .filter((cosmetic) => cosmetic.defaultOwned !== true)
        .map((cosmetic) => ({
            id: `cosmetic_track_${cosmetic.id}`,
            track: 'cosmetic',
            title: cosmetic.label,
            description: cosmetic.description,
            status: cosmeticIsOwned(save, cosmetic.id) ? 'owned' : 'locked',
            progress: { current: cosmeticIsOwned(save, cosmetic.id) ? 1 : 0, target: 1 },
            reward: cosmetic.slot,
            currencyId: 'honor_marks',
            cost: 0,
            gameplayAffecting: false,
            localOnly: true,
            unlockTag: cosmeticUnlockTag(cosmetic.id),
            gate: cosmetic.unlockSource,
            source: cosmetic.unlockSource,
            modeRule: 'cosmetic_only'
        }));

export const getMetaProgressionRows = (save: SaveData): MetaProgressionRow[] => [
    ...getPermanentUpgradeRows(save),
    ...getMetaCosmeticTrackRows(save)
];

const isDeferredMetaProgressionRow = (row: MetaProgressionRow): boolean => row.gate.toLowerCase().startsWith('deferred:');

export const getMetaProgressionSummary = (
    save: SaveData
): MetaProgressionSummary => {
    const rows = getMetaProgressionRows(save);
    return {
        honorMarks: getMetaHonorMarks(save),
        honorsEarned: countEligibleHonors(save),
        owned: rows.filter((row) => row.status === 'owned').length,
        available: rows.filter((row) => row.status === 'available').length,
        locked: rows.filter((row) => row.status === 'locked').length,
        gameplayUpgradesOwned: rows.filter((row) => row.track === 'permanent_upgrade' && row.status === 'owned').length,
        cosmeticOwned: rows.filter((row) => row.track === 'cosmetic' && row.status === 'owned').length
    };
};

export const getMetaProgressionBoard = (save: SaveData): MetaProgressionBoard => {
    const rows = getMetaProgressionRows(save);
    const summary = getMetaProgressionSummary(save);
    const honorMarks = nonNegativeMetaProgressionCount(summary.honorMarks);
    const shortTermRows = rows.filter((row) => !isDeferredMetaProgressionRow(row));
    const nextReward =
        shortTermRows.find((row) => row.status === 'available') ??
        shortTermRows.find((row) => row.status === 'locked' && row.progress.current > 0) ??
        shortTermRows.find((row) => row.status === 'locked') ??
        null;
    const longTermGoal =
        rows.find((row) => row.id === 'upgrade_scholar_prep_slot') ??
        rows.find((row) => row.status !== 'owned') ??
        null;

    return {
        level: Math.max(1, Math.floor(honorMarks / 5) + 1),
        levelProgress: { current: honorMarks % 5, target: 5 },
        nextReward,
        longTermGoal,
        rows,
        summary
    };
};

export const applyMetaProgressionUnlock = (save: SaveData, rowId: string): MetaProgressionUnlockResult => {
    const row = getMetaProgressionRows(save).find((entry) => entry.id === rowId) ?? null;
    if (!row) {
        return {
            save,
            row: null,
            applied: false,
            reason: 'unknown_row',
            feedbackCopy: 'Progression reward not found.'
        };
    }
    if (isDeferredMetaProgressionRow(row)) {
        return {
            save,
            row,
            applied: false,
            reason: 'deferred',
            feedbackCopy: `${row.title} is visible for planning, but is not enabled in this build.`
        };
    }
    if (row.status === 'owned') {
        return {
            save,
            row,
            applied: false,
            reason: 'already_owned',
            feedbackCopy: `${row.title} is already owned.`
        };
    }
    if (row.status !== 'available') {
        return {
            save,
            row,
            applied: false,
            reason: 'locked',
            feedbackCopy: `${row.title} needs ${row.progress.target - row.progress.current} more from ${row.source}.`
        };
    }

    if (row.id === 'upgrade_relic_shrine_extra_pick') {
        const nextSave = normalizeSaveData({
            ...save,
            playerStats: {
                ...save.playerStats!,
                relicShrineExtraPickUnlocked: true
            }
        });
        return {
            save: nextSave,
            row: { ...row, status: 'owned' },
            applied: true,
            reason: 'applied',
            feedbackCopy: `${row.title} unlocked: ${row.reward}.`
        };
    }

    return {
        save,
        row,
        applied: false,
        reason: 'unknown_row',
        feedbackCopy: 'Progression reward has no unlock application rule yet.'
    };
};

export const getMetaProgressionDifficultyTier = (profileLevel: number): MetaProgressionDifficultyTier => {
    if (profileLevel >= 8) {
        return 'legend';
    }
    if (profileLevel >= 5) {
        return 'ascendant';
    }
    if (profileLevel >= 3) {
        return 'adept';
    }
    return 'initiate';
};

export const getMetaProgressionDifficultyTierLabel = (tier: MetaProgressionDifficultyTier): string => {
    switch (tier) {
        case 'legend':
            return 'Legend tier';
        case 'ascendant':
            return 'Ascendant tier';
        case 'adept':
            return 'Adept tier';
        case 'initiate':
            return 'Initiate tier';
    }
};

const metaMarksRequiredForLevel = (level: number): number =>
    Math.max(0, (nonNegativeMetaProgressionCount(level) - 1) * META_MARKS_PER_LEVEL);

export const getMetaProgressionMilestones = (save: SaveData): MetaProgressionMilestoneRow[] => {
    const board = getMetaProgressionBoard(save);
    const currentTier = getMetaProgressionDifficultyTier(board.level);
    const honorMarks = board.summary.honorMarks;

    return META_PROGRESS_MILESTONES.map((milestone) => {
        const marksRequired = metaMarksRequiredForLevel(milestone.level);
        const reached = honorMarks >= marksRequired;
        const status: MetaProgressionMilestoneStatus = reached
            ? milestone.tier === currentTier
                ? 'current'
                : 'reached'
            : 'upcoming';
        return {
            level: milestone.level,
            tier: milestone.tier,
            label: getMetaProgressionDifficultyTierLabel(milestone.tier),
            status,
            marksRequired,
            marksRemaining: Math.max(0, marksRequired - honorMarks),
            progress: { current: Math.min(honorMarks, marksRequired), target: marksRequired },
            reward: milestone.reward
        };
    });
};

export const getNextMetaProgressionMilestone = (save: SaveData): MetaProgressionMilestoneRow | null =>
    getMetaProgressionMilestones(save).find((row) => row.status === 'upcoming') ?? null;

const pluralHonorMarks = (count: number): string => `${count} honor mark${count === 1 ? '' : 's'}`;

const rowProgressCopy = (row: MetaProgressionRow): string => {
    if (row.status === 'owned') {
        return 'Owned';
    }
    if (row.status === 'available') {
        return 'Ready to unlock';
    }
    return `${row.progress.current}/${row.progress.target} from ${row.source}`;
};

const rowFeedback = (row: MetaProgressionRow | null): MetaProgressionRewardFeedback | null =>
    row === null
        ? null
        : {
              id: row.id,
              title: row.title,
              status: row.status,
              progressCopy: rowProgressCopy(row),
              source: row.source,
              modeRule: row.modeRule
          };

export const getMetaProgressionFeedback = (save: SaveData): MetaProgressionFeedback => {
    const board = getMetaProgressionBoard(save);
    const tier = getMetaProgressionDifficultyTier(board.level);
    const nextReward = rowFeedback(board.nextReward);
    const longTermGoal = rowFeedback(board.longTermGoal);
    const honorMarkSources = getMetaHonorMarkSourceRows(save);
    const nextHonorMarkSource = getNextMetaHonorMarkSource(save);
    const nextMilestone = getNextMetaProgressionMilestone(save);
    const honorMarksToNextLevel = board.levelProgress.target - board.levelProgress.current;
    const nextMilestoneCopy = nextMilestone
        ? `${nextMilestone.label} at profile level ${nextMilestone.level} (${pluralHonorMarks(nextMilestone.marksRemaining)}).`
        : 'Legend tier reached; keep pushing long-run mastery.';
    const motivationCopy =
        nextReward?.status === 'available'
            ? `${nextReward.title} is ready.`
            : nextReward
              ? `Next: ${nextReward.title} (${nextReward.progressCopy}).`
              : 'All visible rewards are complete.';

    return {
        profileLevel: board.level,
        difficultyTier: tier,
        difficultyTierLabel: getMetaProgressionDifficultyTierLabel(tier),
        honorMarks: board.summary.honorMarks,
        honorMarksToNextLevel,
        nextReward,
        longTermGoal,
        honorMarkSources,
        nextHonorMarkSource,
        nextMilestone,
        nextMilestoneCopy,
        motivationCopy
    };
};

const legacyStatus = (owned: boolean, current: number, target: number): LegacyMetaProgressionStatus =>
    owned ? 'owned' : current > 0 || current >= target ? 'in_progress' : 'locked';

export const buildPermanentUpgradeRows = (save: SaveData): PermanentUpgradeRow[] => {
    const dailies = nonNegativeMetaProgressionCount(save.playerStats?.dailiesCompleted);
    const noPowers = nonNegativeMetaProgressionCount(save.playerStats?.bestFloorNoPowers);
    return [
        {
            id: 'relic_shrine_extra_pick',
            title: 'Week of Archives',
            status: save.playerStats?.relicShrineExtraPickUnlocked ? 'unlocked' : dailies > 0 ? 'in_progress' : 'locked',
            offlineOnly: true,
            payToSkip: false,
            progress: { current: Math.min(dailies, 7), target: 7 },
            reward: '+1 relic selection at milestones'
        },
        {
            id: 'ascendant_title_track',
            title: 'Ascendant title track',
            status: noPowers >= 5 ? 'unlocked' : noPowers > 0 ? 'in_progress' : 'locked',
            offlineOnly: true,
            payToSkip: false,
            progress: { current: Math.min(noPowers, 5), target: 5 },
            reward: 'Ascendant title cosmetics'
        },
        {
            id: 'daily_cosmetic_track',
            title: 'Daily cosmetic track',
            status: dailies >= 3 ? 'unlocked' : dailies > 0 ? 'in_progress' : 'locked',
            offlineOnly: true,
            payToSkip: false,
            progress: { current: Math.min(dailies, 3), target: 3 },
            reward: 'Daily crest cosmetics'
        }
    ];
};

/** One row per cosmetic track (daily/mastery/relic gating), not the aggregate summary from `getCosmeticTrackProgressSummary`. */
export const getCosmeticTrackDefinitionRows = (save: SaveData): CosmeticTrackRow[] => {
    const dailies = nonNegativeMetaProgressionCount(save.playerStats?.dailiesCompleted);
    const noPowers = nonNegativeMetaProgressionCount(save.playerStats?.bestFloorNoPowers);
    return [
        {
            trackId: 'starter',
            cosmeticId: 'title_seeker',
            label: COSMETIC_CATALOG.title_seeker.label,
            status: 'owned',
            owned: 1,
            progress: { current: 1, target: 1 },
            gameplayAffecting: false
        },
        {
            trackId: 'daily',
            cosmeticId: 'crest_daily_bronze',
            label: COSMETIC_CATALOG.crest_daily_bronze.label,
            status: legacyStatus(cosmeticIsOwned(save, 'crest_daily_bronze'), dailies, 3),
            owned: cosmeticIsOwned(save, 'crest_daily_bronze') ? 1 : 0,
            progress: { current: Math.min(dailies, 3), target: 3 },
            gameplayAffecting: false
        },
        {
            trackId: 'mastery',
            cosmeticId: 'title_ascendant_v',
            label: COSMETIC_CATALOG.title_ascendant_v.label,
            status: legacyStatus(cosmeticIsOwned(save, 'title_ascendant_v'), noPowers, 5),
            owned: cosmeticIsOwned(save, 'title_ascendant_v') ? 1 : 0,
            progress: { current: Math.min(noPowers, 5), target: 5 },
            gameplayAffecting: false
        }
    ];
};

/** Aggregate owned/total per track for collection UI. Lives here to avoid a cosmetics/meta-progression import cycle. */
export const getCosmeticTrackProgressSummary = (save: SaveData) => {
    const legacyRows = getCosmeticTrackDefinitionRows(save);
    const trackIds = ['starter', 'daily', 'mastery'] as const;
    return trackIds.map((trackId) => {
        const matching =
            trackId === 'starter'
                ? deriveCosmeticStates(save).filter((row) => row.defaultOwned)
                : trackId === 'daily'
                  ? legacyRows.filter((row) => row.cosmeticId === 'crest_daily_bronze')
                  : legacyRows.filter((row) => row.cosmeticId === 'title_ascendant_v');
        return {
            trackId,
            owned: matching.filter((row) => row.status === 'owned').length,
            total: matching.length,
            gameplayAffecting: false
        };
    });
};

export const metaProgressionSummary = (save: SaveData): {
    upgradesUnlocked: number;
    cosmeticTrackOwned: number;
    honorsEarned: number;
} => ({
    upgradesUnlocked: buildPermanentUpgradeRows(save).filter((row) => row.status === 'unlocked').length,
    cosmeticTrackOwned: getCosmeticTrackDefinitionRows(save).filter((row) => row.status === 'owned').length,
    honorsEarned: countEligibleHonors(save)
});
