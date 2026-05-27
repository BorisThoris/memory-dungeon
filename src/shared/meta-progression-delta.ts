import type { SaveData } from './contracts';
import {
    getMetaHonorMarkSourceRows,
    getMetaProgressionBoard,
    getMetaProgressionDifficultyTierLabel,
    getMetaProgressionFeedback,
    getMetaProgressionRows,
    type MetaHonorMarkSourceId,
    type MetaProgressionDifficultyTier,
    type MetaProgressionStatus
} from './meta-progression';

export type MetaProgressionDeltaKind = 'profile_level' | 'difficulty_tier' | 'honor_source' | 'reward_status' | 'milestone';

export interface MetaProgressionDeltaRow {
    id: string;
    kind: MetaProgressionDeltaKind;
    title: string;
    before: string;
    after: string;
    body: string;
    priority: number;
    progress?: { current: number; target: number };
}

export interface MetaProgressionRunDelta {
    changed: boolean;
    headline: string;
    summaryCopy: string;
    rows: MetaProgressionDeltaRow[];
    nextGoalCopy: string;
}

const statusRank: Record<MetaProgressionStatus, number> = {
    locked: 0,
    available: 1,
    owned: 2
};

const tierRank: Record<MetaProgressionDifficultyTier, number> = {
    initiate: 0,
    adept: 1,
    ascendant: 2,
    legend: 3
};

const honorSourceUnitCopy: Record<MetaHonorMarkSourceId, string> = {
    achievements: 'achievement progress',
    daily_archive: 'daily archive progress',
    no_powers_mastery: 'no-powers mastery',
    relic_mastery: 'relic mastery'
};

const statusCopy = (status: MetaProgressionStatus): string => {
    switch (status) {
        case 'owned':
            return 'owned';
        case 'available':
            return 'ready';
        case 'locked':
            return 'locked';
    }
};

const buildDeltaSummaryCopy = (rows: MetaProgressionDeltaRow[]): string =>
    rows
        .slice(0, 3)
        .map((row) => row.body)
        .join(' ');

export const buildMetaProgressionRunDelta = (before: SaveData, after: SaveData): MetaProgressionRunDelta => {
    const beforeBoard = getMetaProgressionBoard(before);
    const afterBoard = getMetaProgressionBoard(after);
    const beforeFeedback = getMetaProgressionFeedback(before);
    const afterFeedback = getMetaProgressionFeedback(after);
    const rows: MetaProgressionDeltaRow[] = [];

    if (afterBoard.level > beforeBoard.level) {
        rows.push({
            id: 'profile_level',
            kind: 'profile_level',
            title: 'Profile level up',
            before: String(beforeBoard.level),
            after: String(afterBoard.level),
            body: `${afterBoard.summary.honorMarks} honor marks total. ${afterFeedback.nextMilestoneCopy}`,
            priority: 100,
            progress: afterBoard.levelProgress
        });
    }

    if (tierRank[afterFeedback.difficultyTier] > tierRank[beforeFeedback.difficultyTier]) {
        rows.push({
            id: 'difficulty_tier',
            kind: 'difficulty_tier',
            title: 'Difficulty tier reached',
            before: getMetaProgressionDifficultyTierLabel(beforeFeedback.difficultyTier),
            after: getMetaProgressionDifficultyTierLabel(afterFeedback.difficultyTier),
            body: `${afterFeedback.difficultyTierLabel} is now the active profile tier.`,
            priority: 90
        });
    }

    const beforeSources = new Map(getMetaHonorMarkSourceRows(before).map((row) => [row.id, row]));
    for (const afterSource of getMetaHonorMarkSourceRows(after)) {
        const beforeSource = beforeSources.get(afterSource.id);
        if (!beforeSource || afterSource.marks <= beforeSource.marks) {
            continue;
        }
        const gained = afterSource.marks - beforeSource.marks;
        rows.push({
            id: `honor_source_${afterSource.id}`,
            kind: 'honor_source',
            title: `${afterSource.label} advanced`,
            before: `${beforeSource.marks} marks`,
            after: `${afterSource.marks} marks`,
            body: `+${gained} honor mark${gained === 1 ? '' : 's'} from ${honorSourceUnitCopy[afterSource.id]}.`,
            priority: 70,
            progress: afterSource.progress
        });
    }

    const beforeRows = new Map(getMetaProgressionRows(before).map((row) => [row.id, row]));
    for (const afterRow of getMetaProgressionRows(after)) {
        const beforeRow = beforeRows.get(afterRow.id);
        if (!beforeRow || statusRank[afterRow.status] <= statusRank[beforeRow.status]) {
            continue;
        }
        rows.push({
            id: `reward_${afterRow.id}`,
            kind: 'reward_status',
            title: afterRow.status === 'owned' ? `${afterRow.title} owned` : `${afterRow.title} ready`,
            before: statusCopy(beforeRow.status),
            after: statusCopy(afterRow.status),
            body:
                afterRow.status === 'owned'
                    ? `${afterRow.reward} is now active where its mode rule allows it.`
                    : `${afterRow.reward} can be unlocked from Profile.`,
            priority: afterRow.status === 'owned' ? 85 : 80,
            progress: afterRow.progress
        });
    }

    const beforeMilestoneLevel = beforeFeedback.nextMilestone?.level ?? Number.POSITIVE_INFINITY;
    const afterMilestoneLevel = afterFeedback.nextMilestone?.level ?? Number.POSITIVE_INFINITY;
    if (afterMilestoneLevel > beforeMilestoneLevel || (!afterFeedback.nextMilestone && beforeFeedback.nextMilestone)) {
        rows.push({
            id: 'milestone_reached',
            kind: 'milestone',
            title: 'Milestone reached',
            before: beforeFeedback.nextMilestoneCopy,
            after: afterFeedback.nextMilestoneCopy,
            body: afterFeedback.nextMilestone
                ? `Next milestone: ${afterFeedback.nextMilestoneCopy}`
                : 'All visible profile milestones are reached.',
            priority: 75,
            progress: afterBoard.levelProgress
        });
    }

    const sortedRows = rows.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    const headline =
        sortedRows[0]?.title ??
        (afterFeedback.nextHonorMarkSource?.nextMarkCopy
            ? `No new meta unlocks. ${afterFeedback.nextHonorMarkSource.nextMarkCopy}`
            : afterFeedback.motivationCopy);
    const summaryCopy = sortedRows.length > 0 ? buildDeltaSummaryCopy(sortedRows) : headline;

    return {
        changed: sortedRows.length > 0,
        headline,
        summaryCopy,
        rows: sortedRows,
        nextGoalCopy: `${afterFeedback.motivationCopy} ${afterFeedback.nextMilestoneCopy}`
    };
};
