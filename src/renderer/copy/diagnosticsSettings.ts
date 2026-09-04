/**
 * The Settings line about crash reports.
 *
 * Reports never leave this machine, which is the right default and exactly why the player has to be
 * told where they are — a log nobody can find is the same as no log. The label leads with that
 * promise, because "crash reports" alone reads like telemetry.
 */
export const DIAGNOSTICS_COPY = {
    hint: 'Reports stay on this machine. Attach one if you write in about a problem.',
    label: 'Crash reports',
    /** Shown when nothing has gone wrong, so the row is not a permanent empty space. */
    none: 'No crash reports from earlier sessions.'
} as const;

/**
 * Export, import and backup are all "copy the file yourself" in this build, which only works if
 * the player can find the file. Reveal rather than open: opening a save in whatever handles .json
 * is an invitation to edit it by hand.
 */
export const SAVE_FILE_COPY = {
    reveal: 'Show save file',
    revealAriaLabel: 'Show the save file in the file manager'
} as const;
