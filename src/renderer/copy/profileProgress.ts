import { plural, tr } from '../../shared/i18n';
import type { LocalProgressRegistryRow } from '../../shared/local-progress-registry';

/**
 * What the Profile screen calls the two things it now tracks.
 *
 * The quest campaign was a whole system with no screen: it counted steps nothing displayed, and
 * Profile showed the objective board alone. The daily archive was the third, and went with the
 * mode (`docs/REMOVED_MODES.md`).
 */

export const PROFILE_PROGRESS_COPY = {
    label: tr.s('Progress'),
    noRows: tr.s('Play a run to start tracking progress here.'),
    /** Chain line in the screen subtitle. Zero reads as none yet rather than "0 Sharp floors". */
    sharpFloors: (floors: number): string => (floors > 0 ? `${plural(floors, { one: '{0} Sharp floor', other: '{0} Sharp floors' })}` : tr.s('no Sharp floor yet'))
} as const;

export const PROFILE_PROGRESS_SOURCE_LABEL: Record<LocalProgressRegistryRow['source'], string> = {
    objective_board: tr.s('Objective'),
    quest_campaign: tr.s('Quest')
};

export const PROFILE_PROGRESS_STATUS_LABEL: Record<LocalProgressRegistryRow['status'], string> = {
    active: tr.s('In progress'),
    completed: tr.s('Done'),
    failed: tr.s('Missed'),
    locked: tr.s('Locked')
};
