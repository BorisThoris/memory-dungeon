import type { LocalProgressRegistryRow } from '../../shared/local-progress-registry';

/**
 * What the Profile screen calls the three things it now tracks.
 *
 * The daily archive and the quest campaign were whole systems with no screen: a player who ran
 * dailies had a streak recorded in their save and nowhere to see it, and the quest campaign
 * counted steps nothing displayed. Profile showed the objective board alone.
 */

export const PROFILE_PROGRESS_COPY = {
    label: 'Progress',
    noRows: 'Play a run to start tracking progress here.',
    /** Streak line in the screen subtitle. Zero reads as no streak rather than "0 day streak". */
    streak: (days: number): string => (days > 0 ? `${days}-day daily streak` : 'no daily streak yet')
} as const;

export const PROFILE_PROGRESS_SOURCE_LABEL: Record<LocalProgressRegistryRow['source'], string> = {
    daily_archive: 'Daily',
    objective_board: 'Objective',
    quest_campaign: 'Quest'
};

export const PROFILE_PROGRESS_STATUS_LABEL: Record<LocalProgressRegistryRow['status'], string> = {
    active: 'In progress',
    completed: 'Done',
    failed: 'Missed',
    locked: 'Locked'
};
