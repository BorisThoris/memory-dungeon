import type { LocalProgressRegistryRow } from '../../shared/local-progress-registry';

/**
 * What the Profile screen calls the two things it now tracks.
 *
 * The quest campaign was a whole system with no screen: it counted steps nothing displayed, and
 * Profile showed the objective board alone. The daily archive was the third, and went with the
 * mode (`docs/REMOVED_MODES.md`).
 */

export const PROFILE_PROGRESS_COPY = {
    label: 'Progress',
    noRows: 'Play a run to start tracking progress here.',
    /** Chain line in the screen subtitle. Zero reads as none yet rather than "0 Sharp floors". */
    sharpFloors: (floors: number): string => (floors > 0 ? `${floors} Sharp floor${floors === 1 ? '' : 's'}` : 'no Sharp floor yet')
} as const;

export const PROFILE_PROGRESS_SOURCE_LABEL: Record<LocalProgressRegistryRow['source'], string> = {
    objective_board: 'Objective',
    quest_campaign: 'Quest'
};

export const PROFILE_PROGRESS_STATUS_LABEL: Record<LocalProgressRegistryRow['status'], string> = {
    active: 'In progress',
    completed: 'Done',
    failed: 'Missed',
    locked: 'Locked'
};
