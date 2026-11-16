import { tr } from '../../shared/i18n';
/**
 * What a player is told when a screen fails to draw.
 *
 * The alternative this replaces is a blank window, which reads as the game having died even though
 * the process is still running — so the copy has to do two things a blank screen cannot: say that
 * something broke rather than leaving them guessing, and say that their save is untouched, because
 * that is the first thing anyone will assume they have lost.
 */
export const APP_ERROR_COPY = {
    /** The action that puts them back somewhere usable. */
    action: tr.s('Reload the game'),
    detail: tr.s('Your saved progress is on disk and has not been changed. Reloading returns you to the menu.'),
    /** Shown under the detail when a report was written, so the file is findable. */
    reported: tr.s('A report was written to the crash-logs folder beside your save.'),
    title: tr.s('Something in the game failed to draw')
} as const;
